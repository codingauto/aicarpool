#!/usr/bin/env npx tsx

/**
 * AiCarpool v2.1 数据迁移脚本
 * 
 * 功能：
 * 1. 将现有AI账号从拼车组关联迁移到企业关联
 * 2. 为现有拼车组创建默认的资源绑定配置
 * 3. 创建默认企业（如果不存在）
 * 4. 数据完整性验证
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface MigrationStats {
  enterprisesCreated: number;
  accountsMigrated: number;
  groupsLinked: number;
  resourceBindingsCreated: number;
  errors: string[];
}

async function migrateToV21(): Promise<MigrationStats> {
  const stats: MigrationStats = {
    enterprisesCreated: 0,
    accountsMigrated: 0,
    groupsLinked: 0,
    resourceBindingsCreated: 0,
    errors: []
  };

  console.log('🚀 开始 AiCarpool v2.1 数据迁移...');
  
  try {
    // 1. 检查并创建默认企业
    await createDefaultEnterprise(stats);
    
    // 2. 迁移AI账号到企业级管理
    await migrateAiAccounts(stats);
    
    // 3. 关联拼车组到企业
    await linkGroupsToEnterprise(stats);
    
    // 4. 为拼车组创建默认资源绑定
    await createDefaultResourceBindings(stats);
    
    // 5. 数据完整性验证
    await validateDataIntegrity(stats);
    
    console.log('✅ 数据迁移完成！');
    console.log('📊 迁移统计:');
    console.log(`  - 创建企业: ${stats.enterprisesCreated}`);
    console.log(`  - 迁移账号: ${stats.accountsMigrated}`);
    console.log(`  - 关联拼车组: ${stats.groupsLinked}`);
    console.log(`  - 创建资源绑定: ${stats.resourceBindingsCreated}`);
    
    if (stats.errors.length > 0) {
      console.log('⚠️  迁移过程中的警告:');
      stats.errors.forEach(error => console.log(`  - ${error}`));
    }
    
  } catch (error) {
    console.error('❌ 迁移失败:', error);
    stats.errors.push(error instanceof Error ? error.message : String(error));
    throw error;
  }

  return stats;
}

async function createDefaultEnterprise(stats: MigrationStats): Promise<string> {
  console.log('📝 1. 检查默认企业...');
  
  // 检查是否已存在企业
  const existingEnterprise = await prisma.enterprise.findFirst();
  
  if (existingEnterprise) {
    console.log(`   已存在企业: ${existingEnterprise.name}`);
    return existingEnterprise.id;
  }
  
  // 创建默认企业
  const defaultEnterprise = await prisma.enterprise.create({
    data: {
      name: '默认企业',
      planType: 'basic',
      settings: {
        description: '系统迁移时自动创建的默认企业',
        createdBy: 'migration-script'
      }
    }
  });
  
  stats.enterprisesCreated++;
  console.log(`   ✅ 创建默认企业: ${defaultEnterprise.name}`);
  
  return defaultEnterprise.id;
}

async function migrateAiAccounts(stats: MigrationStats): Promise<void> {
  console.log('📝 2. 迁移AI账号到企业级管理...');
  
  const enterpriseId = await createDefaultEnterprise(stats);
  
  // 查找所有需要迁移的AI账号（那些还没有enterpriseId的）
  const accountsToMigrate = await prisma.aiServiceAccount.findMany({
    where: {
      OR: [
        { enterpriseId: null },
        { enterpriseId: '' }
      ]
    }
  });
  
  console.log(`   发现 ${accountsToMigrate.length} 个账号需要迁移`);
  
  for (const account of accountsToMigrate) {
    try {
      // 更新账号，添加企业关联
      await prisma.aiServiceAccount.update({
        where: { id: account.id },
        data: {
          enterpriseId: enterpriseId,
          // 确保字段符合新的schema
          supportedModels: account.supportedModels || [],
          currentLoad: 0,
          totalRequests: BigInt(0),
          totalTokens: BigInt(0),
          totalCost: 0
        }
      });
      
      stats.accountsMigrated++;
      console.log(`   ✅ 迁移账号: ${account.name} (${account.serviceType})`);
      
    } catch (error) {
      const errorMsg = `迁移账号失败 ${account.name}: ${error}`;
      stats.errors.push(errorMsg);
      console.log(`   ❌ ${errorMsg}`);
    }
  }
}

async function linkGroupsToEnterprise(stats: MigrationStats): Promise<void> {
  console.log('📝 3. 关联拼车组到企业...');
  
  const enterpriseId = await createDefaultEnterprise(stats);
  
  // 查找所有没有企业关联的拼车组
  const groupsToLink = await prisma.group.findMany({
    where: {
      enterpriseId: null
    }
  });
  
  console.log(`   发现 ${groupsToLink.length} 个拼车组需要关联`);
  
  for (const group of groupsToLink) {
    try {
      await prisma.group.update({
        where: { id: group.id },
        data: {
          enterpriseId: enterpriseId
        }
      });
      
      stats.groupsLinked++;
      console.log(`   ✅ 关联拼车组: ${group.name}`);
      
    } catch (error) {
      const errorMsg = `关联拼车组失败 ${group.name}: ${error}`;
      stats.errors.push(errorMsg);
      console.log(`   ❌ ${errorMsg}`);
    }
  }
}

async function createDefaultResourceBindings(stats: MigrationStats): Promise<void> {
  console.log('📝 4. 创建默认资源绑定...');
  
  // 查找所有没有资源绑定的拼车组
  const groupsWithoutBinding = await prisma.group.findMany({
    where: {
      resourceBinding: null
    },
    include: {
      aiServices: {
        include: {
          account: true
        }
      }
    }
  });
  
  console.log(`   发现 ${groupsWithoutBinding.length} 个拼车组需要创建资源绑定`);
  
  for (const group of groupsWithoutBinding) {
    try {
      // 分析现有的AI服务配置，确定最佳的绑定模式
      const hasDirectAccounts = group.aiServices.some(service => service.accountId);
      
      let bindingMode = 'shared'; // 默认共享模式
      let bindingConfig = {};
      
      if (hasDirectAccounts) {
        // 如果已经有直接绑定的账号，使用专属模式
        bindingMode = 'dedicated';
        bindingConfig = {
          accounts: group.aiServices
            .filter(service => service.accountId)
            .map(service => ({
              accountId: service.accountId,
              serviceType: service.account?.serviceType,
              priority: 1
            }))
        };
      } else {
        // 使用共享模式，配置服务类型偏好
        bindingConfig = {
          poolConfig: [
            {
              serviceType: 'claude',
              maxUsagePercent: 80,
              priority: 1
            }
          ]
        };
      }
      
      // 创建资源绑定
      await prisma.groupResourceBinding.create({
        data: {
          groupId: group.id,
          bindingMode: bindingMode,
          bindingConfig: bindingConfig,
          dailyTokenLimit: 10000,
          monthlyBudget: 100.00,
          priorityLevel: 'medium',
          warningThreshold: 80,
          alertThreshold: 95
        }
      });
      
      stats.resourceBindingsCreated++;
      console.log(`   ✅ 创建资源绑定: ${group.name} (${bindingMode}模式)`);
      
    } catch (error) {
      const errorMsg = `创建资源绑定失败 ${group.name}: ${error}`;
      stats.errors.push(errorMsg);
      console.log(`   ❌ ${errorMsg}`);
    }
  }
}

async function validateDataIntegrity(stats: MigrationStats): Promise<void> {
  console.log('📝 5. 验证数据完整性...');
  
  // 验证所有AI账号都有企业关联
  const orphanAccounts = await prisma.aiServiceAccount.count({
    where: {
      enterpriseId: null
    }
  });
  
  if (orphanAccounts > 0) {
    const warning = `发现 ${orphanAccounts} 个AI账号没有企业关联`;
    stats.errors.push(warning);
    console.log(`   ⚠️  ${warning}`);
  }
  
  // 验证所有拼车组都有企业关联
  const orphanGroups = await prisma.group.count({
    where: {
      enterpriseId: null
    }
  });
  
  if (orphanGroups > 0) {
    const warning = `发现 ${orphanGroups} 个拼车组没有企业关联`;
    stats.errors.push(warning);
    console.log(`   ⚠️  ${warning}`);
  }
  
  // 验证所有拼车组都有资源绑定
  const groupsWithoutBinding = await prisma.group.count({
    where: {
      resourceBinding: null
    }
  });
  
  if (groupsWithoutBinding > 0) {
    const warning = `发现 ${groupsWithoutBinding} 个拼车组没有资源绑定`;
    stats.errors.push(warning);
    console.log(`   ⚠️  ${warning}`);
  }
  
  console.log('   ✅ 数据完整性验证完成');
}

// 主执行函数
async function main() {
  try {
    await migrateToV21();
  } catch (error) {
    console.error('迁移脚本执行失败:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  main();
}

export { migrateToV21 };
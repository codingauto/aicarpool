#!/usr/bin/env tsx
/**
 * 权限系统初始化脚本
 * 
 * 运行方式：
 * npm run init-permissions
 * 或
 * tsx scripts/init-permissions.ts
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

async function initPermissions() {
  console.log('🚀 开始初始化权限系统...');
  
  try {
    // 1. 创建系统管理员账号
    console.log('📝 创建系统管理员账号...');
    const adminPassword = process.env.ADMIN_PASSWORD || 'Admin@123456';
    const hashedPassword = await bcrypt.hash(adminPassword, 10);
    
    const admin = await prisma.user.upsert({
      where: { email: 'admin@aicarpool.com' },
      update: {
        name: '系统管理员',
        status: 'active',
        emailVerified: true,
        role: 'admin'
      },
      create: {
        email: 'admin@aicarpool.com',
        name: '系统管理员',
        password: hashedPassword,
        role: 'admin',
        status: 'active',
        emailVerified: true
      }
    });
    
    console.log('✅ 系统管理员账号创建成功');
    console.log(`   邮箱: admin@aicarpool.com`);
    console.log(`   密码: ${adminPassword}`);
    
    // 2. 为系统管理员分配全局权限
    console.log('🔑 分配系统管理员权限...');
    await prisma.userEnterpriseRole.upsert({
      where: {
        id: 'role_system_admin_001'
      },
      update: {
        role: 'system_admin',
        scope: 'global',
        isActive: true
      },
      create: {
        id: 'role_system_admin_001',
        userId: admin.id,
        role: 'system_admin',
        scope: 'global',
        isActive: true
      }
    });
    
    // 3. 迁移现有用户企业关系到角色表
    console.log('📊 迁移现有用户权限数据...');
    const userEnterprises = await prisma.userEnterprise.findMany({
      where: { isActive: true }
    });
    
    let migratedCount = 0;
    for (const ue of userEnterprises) {
      // 检查是否已存在角色记录
      const existingRole = await prisma.userEnterpriseRole.findFirst({
        where: {
          userId: ue.userId,
          enterpriseId: ue.enterpriseId,
          scope: 'enterprise'
        }
      });
      
      if (!existingRole) {
        await prisma.userEnterpriseRole.create({
          data: {
            userId: ue.userId,
            enterpriseId: ue.enterpriseId,
            role: ue.role || 'member',
            scope: 'enterprise',
            isActive: true
          }
        });
        migratedCount++;
      }
    }
    
    console.log(`✅ 成功迁移 ${migratedCount} 条用户权限记录`);
    
    // 4. 创建默认企业（如果需要）
    console.log('🏢 检查默认企业...');
    const defaultEnterprise = await prisma.enterprise.findFirst({
      where: { 
        name: 'AiCarpool默认企业'
      }
    });
    
    if (!defaultEnterprise) {
      const enterprise = await prisma.enterprise.create({
        data: {
          name: 'AiCarpool默认企业',
          planType: 'professional',
          organizationType: 'enterprise',
          uiTheme: 'professional',
          settings: {
            description: '系统默认企业，用于演示和测试',
            allowPublicJoin: false,
            requireApproval: true,
            maxGroups: 100,
            maxMembers: 1000,
            status: 'active'
          },
          featureSet: {
            aiServices: true,
            advancedAnalytics: true,
            customRoles: true,
            apiAccess: true
          }
        }
      });
      
      // 将管理员加入默认企业
      await prisma.userEnterprise.create({
        data: {
          userId: admin.id,
          enterpriseId: enterprise.id,
          role: 'owner',
          isActive: true
        }
      });
      
      await prisma.userEnterpriseRole.create({
        data: {
          userId: admin.id,
          enterpriseId: enterprise.id,
          role: 'enterprise_owner',
          scope: 'enterprise',
          isActive: true
        }
      });
      
      console.log('✅ 默认企业创建成功');
    }
    
    // 5. 初始化部门结构（如果需要）
    console.log('🏗️ 初始化部门结构...');
    if (defaultEnterprise) {
      const departments = [
        { name: '技术部', description: '负责技术研发和维护' },
        { name: '产品部', description: '负责产品设计和规划' },
        { name: '运营部', description: '负责日常运营和客户服务' }
      ];
      
      for (const dept of departments) {
        await prisma.department.upsert({
          where: {
            id: `dept_${dept.name}_001`
          },
          update: {},
          create: {
            id: `dept_${dept.name}_001`,
            enterpriseId: defaultEnterprise.id,
            name: dept.name,
            description: dept.description
          }
        });
      }
      
      console.log('✅ 部门结构初始化完成');
    }
    
    // 6. 清理过期的权限缓存
    console.log('🧹 清理过期数据...');
    // 这里可以添加清理逻辑
    
    console.log('\n✨ 权限系统初始化完成！\n');
    console.log('========================================');
    console.log('系统管理员账号信息：');
    console.log(`邮箱: admin@aicarpool.com`);
    console.log(`密码: ${adminPassword}`);
    console.log('========================================');
    console.log('\n请妥善保管管理员账号信息！');
    
  } catch (error) {
    console.error('❌ 初始化失败:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// 运行初始化
initPermissions()
  .then(() => {
    console.log('\n👍 脚本执行成功');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ 脚本执行失败:', error);
    process.exit(1);
  });
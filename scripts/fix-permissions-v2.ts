/**
 * 权限修复脚本 V2 - 适配简化的数据模型
 * 
 * 修复用户权限问题，确保用户有正确的角色和权限配置
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// 内置角色定义（简化版本，角色直接存储为字符串）
const BUILT_IN_ROLES = [
  'system_admin',
  'enterprise_owner', 
  'enterprise_admin',
  'enterprise_manager',
  'department_admin',
  'group_admin',
  'group_member',
  'carpool_group_owner'
];

interface FixResult {
  userId: string;
  userName: string;
  userEmail: string;
  fixedIssues: string[];
  errors: string[];
}

async function fixUserPermissions(userEmail?: string): Promise<FixResult[]> {
  console.log('🔧 开始权限修复 V2...');
  
  const results: FixResult[] = [];
  
  try {
    // 获取要修复的用户
    const users = userEmail 
      ? await prisma.user.findMany({ where: { email: userEmail } })
      : await prisma.user.findMany();
      
    console.log(`📊 找到 ${users.length} 个用户需要检查`);
    
    for (const user of users) {
      const result: FixResult = {
        userId: user.id,
        userName: user.name || 'Unknown',
        userEmail: user.email,
        fixedIssues: [],
        errors: []
      };
      
      console.log(`\n🔍 检查用户: ${user.email}`);
      
      // 1. 检查用户的企业成员关系
      const userEnterprises = await prisma.userEnterprise.findMany({
        where: { userId: user.id },
        include: { enterprise: true }
      });
      
      for (const ue of userEnterprises) {
        // 检查是否有对应的角色权限
        const existingRole = await prisma.userEnterpriseRole.findFirst({
          where: {
            userId: user.id,
            enterpriseId: ue.enterpriseId,
            isActive: true
          }
        });
        
        if (!existingRole) {
          // 根据UserEnterprise中的角色创建对应的权限角色
          const roleToAssign = ue.role === 'owner' ? 'enterprise_owner' :
                              ue.role === 'admin' ? 'enterprise_admin' :
                              'enterprise_manager';
                              
          console.log(`   📝 为用户在企业 ${ue.enterprise.name} 分配角色: ${roleToAssign}`);
          
          await prisma.userEnterpriseRole.create({
            data: {
              userId: user.id,
              enterpriseId: ue.enterpriseId,
              role: roleToAssign,
              scope: 'enterprise',
              isActive: true
            }
          });
          
          result.fixedIssues.push(`分配企业角色: ${roleToAssign} (${ue.enterprise.name})`);
        }
      }
      
      // 2. 检查系统管理员
      if (user.role === 'admin' || user.email === 'admin@aicarpool.com') {
        const hasSystemAdmin = await prisma.userEnterpriseRole.findFirst({
          where: {
            userId: user.id,
            role: 'system_admin',
            scope: 'global',
            isActive: true
          }
        });
        
        if (!hasSystemAdmin) {
          console.log(`   🌟 为系统管理员分配全局权限`);
          
          await prisma.userEnterpriseRole.create({
            data: {
              userId: user.id,
              role: 'system_admin',
              scope: 'global',
              isActive: true
            }
          });
          
          result.fixedIssues.push('分配系统管理员角色');
        }
      }
      
      // 3. 检查拼车组管理权限
      const groupMembers = await prisma.groupMember.findMany({
        where: { 
          userId: user.id,
          status: 'active'
        },
        include: { group: true }
      });
      
      for (const gm of groupMembers) {
        if (gm.role === 'admin' || gm.role === 'owner') {
          const hasGroupRole = await prisma.userEnterpriseRole.findFirst({
            where: {
              userId: user.id,
              role: 'group_admin',
              scope: 'group',
              resourceId: gm.groupId,
              isActive: true
            }
          });
          
          if (!hasGroupRole) {
            console.log(`   🚗 为用户在拼车组 ${gm.group.name} 分配管理权限`);
            
            await prisma.userEnterpriseRole.create({
              data: {
                userId: user.id,
                role: 'group_admin',
                scope: 'group',
                resourceId: gm.groupId,
                enterpriseId: gm.group.enterpriseId,
                isActive: true
              }
            });
            
            result.fixedIssues.push(`分配拼车组管理权限: ${gm.group.name}`);
          }
        }
      }
      
      results.push(result);
    }
    
    // 输出修复结果
    console.log('\n📊 修复结果汇总:');
    for (const result of results) {
      if (result.fixedIssues.length > 0 || result.errors.length > 0) {
        console.log(`\n用户: ${result.userEmail}`);
        if (result.fixedIssues.length > 0) {
          console.log('  ✅ 修复的问题:');
          result.fixedIssues.forEach(issue => console.log(`    - ${issue}`));
        }
        if (result.errors.length > 0) {
          console.log('  ❌ 错误:');
          result.errors.forEach(error => console.log(`    - ${error}`));
        }
      }
    }
    
    return results;
    
  } catch (error) {
    console.error('❌ 权限修复失败:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// 执行修复
async function main() {
  const args = process.argv.slice(2);
  const userEmail = args[0];
  
  if (userEmail) {
    console.log(`🎯 修复特定用户: ${userEmail}`);
  } else {
    console.log('🎯 修复所有用户');
  }
  
  await fixUserPermissions(userEmail);
}

main().catch(console.error);
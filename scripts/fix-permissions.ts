/**
 * 权限修复脚本 - 为用户分配必要的角色和权限
 */

import { PrismaClient } from '@prisma/client';
import { diagnoseUserPermissions, DiagnosisResult } from './diagnose-permissions';

const prisma = new PrismaClient();

interface FixResult {
  userId: string;
  userInfo: any;
  actions: string[];
  success: boolean;
  errors: string[];
}

// 内置角色和权限定义（与 permission-manager.ts 保持一致）
const BUILT_IN_ROLES = [
  {
    id: 'enterprise_admin',
    name: 'enterprise_admin',
    displayName: '企业管理员',
    description: '拥有企业所有权限的超级管理员',
    permissions: [
      'enterprise.read', 'enterprise.update', 'enterprise.manage',
      'department.create', 'department.read', 'department.update', 'department.delete', 'department.manage',
      'group.create', 'group.read', 'group.update', 'group.delete', 'group.manage',
      'user.create', 'user.read', 'user.update', 'user.delete', 'user.manage',
      'account.create', 'account.read', 'account.update', 'account.delete', 'account.manage',
      'binding.create', 'binding.read', 'binding.update', 'binding.delete',
      'cost.read', 'monitor.read', 'monitor.manage',
      'ai_service.use', 'ai_service.manage'
    ],
    isBuiltIn: true,
    isActive: true
  },
  {
    id: 'enterprise_manager',
    name: 'enterprise_manager',
    displayName: '企业经理',
    description: '企业级管理权限，但不能管理其他管理员',
    permissions: [
      'enterprise.read',
      'department.create', 'department.read', 'department.update', 'department.manage',
      'group.create', 'group.read', 'group.update', 'group.manage',
      'user.read', 'user.update',
      'account.create', 'account.read', 'account.update', 'account.manage',
      'binding.create', 'binding.read', 'binding.update',
      'cost.read', 'ai_service.use', 'ai_service.manage'
    ],
    isBuiltIn: true,
    isActive: true
  }
];

async function ensureBuiltInRoles() {
  console.log('🔧 确保内置角色存在...');
  
  for (const roleConfig of BUILT_IN_ROLES) {
    try {
      // 检查角色是否存在
      const existingRole = await prisma.enterpriseRole.findFirst({
        where: { name: roleConfig.name }
      });

      if (!existingRole) {
        console.log(`   创建角色: ${roleConfig.displayName}`);
        
        // 创建角色
        const role = await prisma.enterpriseRole.create({
          data: {
            id: roleConfig.id,
            name: roleConfig.name,
            displayName: roleConfig.displayName,
            description: roleConfig.description,
            isBuiltIn: roleConfig.isBuiltIn,
            isActive: roleConfig.isActive
          }
        });

        // 添加权限
        for (const permission of roleConfig.permissions) {
          await prisma.rolePermission.create({
            data: {
              roleId: role.id,
              permission: permission
            }
          });
        }
        
        console.log(`   ✅ 角色 ${roleConfig.displayName} 创建成功，包含 ${roleConfig.permissions.length} 个权限`);
      } else {
        console.log(`   ✅ 角色 ${roleConfig.displayName} 已存在`);
        
        // 检查权限是否完整
        const existingPermissions = await prisma.rolePermission.findMany({
          where: { roleId: existingRole.id },
          select: { permission: true }
        });
        
        const existingPermissionNames = existingPermissions.map(p => p.permission);
        const missingPermissions = roleConfig.permissions.filter(p => !existingPermissionNames.includes(p));
        
        if (missingPermissions.length > 0) {
          console.log(`   🔄 添加缺少的权限: ${missingPermissions.join(', ')}`);
          for (const permission of missingPermissions) {
            await prisma.rolePermission.create({
              data: {
                roleId: existingRole.id,
                permission: permission
              }
            });
          }
        }
      }
    } catch (error) {
      console.error(`❌ 处理角色 ${roleConfig.displayName} 失败:`, error);
    }
  }
}

async function fixUserPermissions(userIdOrEmail?: string, dryRun: boolean = false): Promise<FixResult[]> {
  console.log('🔧 开始权限修复...');
  if (dryRun) {
    console.log('🔍 运行模式: 预览模式（不会实际修改数据）');
  }

  // 确保内置角色存在
  if (!dryRun) {
    await ensureBuiltInRoles();
  }

  // 获取诊断结果
  const diagnosisResults = await diagnoseUserPermissions(userIdOrEmail);
  const fixResults: FixResult[] = [];

  for (const diagnosis of diagnosisResults) {
    const fixResult: FixResult = {
      userId: diagnosis.userId,
      userInfo: diagnosis.userInfo,
      actions: [],
      success: true,
      errors: []
    };

    try {
      console.log(`\n👤 修复用户权限: ${diagnosis.userInfo.name} (${diagnosis.userInfo.email})`);

      // 修复1: 为企业成员添加企业角色权限
      const enterpriseIds = diagnosis.enterprises.map(e => e.enterpriseId);
      const roleEnterpriseIds = diagnosis.enterpriseRoles.map(r => r.enterpriseId).filter(Boolean);

      for (const enterpriseId of enterpriseIds) {
        if (!roleEnterpriseIds.includes(enterpriseId)) {
          const enterprise = diagnosis.enterprises.find(e => e.enterpriseId === enterpriseId);
          const userRole = enterprise?.role || 'member';
          
          // 根据用户在企业中的角色选择权限角色
          let targetRoleId = 'enterprise_manager';
          if (userRole === 'admin' || userRole === 'owner') {
            targetRoleId = 'enterprise_admin';
          }

          fixResult.actions.push(`为企业 ${enterprise?.enterpriseName} 分配角色: ${targetRoleId}`);

          if (!dryRun) {
            // 检查是否已存在相同的角色分配
            const existingRole = await prisma.userEnterpriseRole.findFirst({
              where: {
                userId: diagnosis.userId,
                roleId: targetRoleId,
                enterpriseId: enterpriseId,
                isActive: true
              }
            });

            if (!existingRole) {
              await prisma.userEnterpriseRole.create({
                data: {
                  userId: diagnosis.userId,
                  roleId: targetRoleId,
                  enterpriseId: enterpriseId,
                  scope: 'enterprise',
                  isActive: true
                }
              });
              console.log(`   ✅ 已为企业 ${enterprise?.enterpriseName} 分配角色 ${targetRoleId}`);
            } else {
              console.log(`   ℹ️  企业 ${enterprise?.enterpriseName} 已有角色配置`);
            }
          }
        }
      }

      // 修复2: 为企业级拼车组成员添加企业权限
      const enterpriseGroups = diagnosis.groupMemberships.filter(gm => 
        gm.organizationType === 'enterprise_group' && gm.enterpriseId
      );

      for (const group of enterpriseGroups) {
        if (!roleEnterpriseIds.includes(group.enterpriseId!)) {
          // 根据在拼车组中的角色确定企业权限角色
          let targetRoleId = 'enterprise_manager';
          if (group.role === 'admin' || group.role === 'owner') {
            targetRoleId = 'enterprise_admin';
          }

          fixResult.actions.push(`为企业级拼车组 ${group.groupName} 添加企业权限: ${targetRoleId}`);

          if (!dryRun) {
            const existingRole = await prisma.userEnterpriseRole.findFirst({
              where: {
                userId: diagnosis.userId,
                roleId: targetRoleId,
                enterpriseId: group.enterpriseId,
                isActive: true
              }
            });

            if (!existingRole) {
              await prisma.userEnterpriseRole.create({
                data: {
                  userId: diagnosis.userId,
                  roleId: targetRoleId,
                  enterpriseId: group.enterpriseId!,
                  scope: 'enterprise',
                  isActive: true
                }
              });
              console.log(`   ✅ 已为企业级拼车组 ${group.groupName} 添加企业权限`);
            }
          }
        }
      }

      // 修复3: 激活非活跃的权限配置
      const inactiveRoles = diagnosis.enterpriseRoles.filter(r => !r.isActive);
      if (inactiveRoles.length > 0) {
        fixResult.actions.push(`激活 ${inactiveRoles.length} 个非活跃的角色配置`);
        
        if (!dryRun) {
          for (const role of inactiveRoles) {
            await prisma.userEnterpriseRole.updateMany({
              where: {
                userId: diagnosis.userId,
                roleId: role.roleId,
                enterpriseId: role.enterpriseId,
                isActive: false
              },
              data: {
                isActive: true
              }
            });
          }
          console.log(`   ✅ 已激活 ${inactiveRoles.length} 个角色配置`);
        }
      }

      if (fixResult.actions.length === 0) {
        fixResult.actions.push('无需修复，权限配置正常');
        console.log(`   ✅ 用户权限配置正常，无需修复`);
      }

    } catch (error) {
      fixResult.success = false;
      fixResult.errors.push(error instanceof Error ? error.message : String(error));
      console.error(`   ❌ 修复用户 ${diagnosis.userInfo.name} 权限失败:`, error);
    }

    fixResults.push(fixResult);
  }

  return fixResults;
}

function printFixReport(results: FixResult[], dryRun: boolean) {
  console.log(`\n📊 权限修复报告 ${dryRun ? '(预览模式)' : ''}`);
  console.log('='.repeat(60));

  let totalActions = 0;
  let successCount = 0;
  let errorCount = 0;

  for (const result of results) {
    console.log(`\n👤 用户: ${result.userInfo.name} (${result.userInfo.email})`);
    
    if (result.success) {
      successCount++;
      console.log(`   ✅ 修复状态: 成功`);
    } else {
      errorCount++;
      console.log(`   ❌ 修复状态: 失败`);
    }

    if (result.actions.length > 0) {
      console.log(`   🔧 执行操作:`);
      for (const action of result.actions) {
        console.log(`     - ${action}`);
        totalActions++;
      }
    }

    if (result.errors.length > 0) {
      console.log(`   ❌ 错误信息:`);
      for (const error of result.errors) {
        console.log(`     - ${error}`);
      }
    }
  }

  console.log(`\n📈 修复总结:`);
  console.log(`   处理用户数: ${results.length}`);
  console.log(`   成功修复数: ${successCount}`);
  console.log(`   失败数量: ${errorCount}`);
  console.log(`   执行操作数: ${totalActions}`);

  if (dryRun && totalActions > 0) {
    console.log(`\n💡 要应用这些修复，请运行: npx tsx scripts/fix-permissions.ts --apply`);
  }
}

async function main() {
  const args = process.argv.slice(2);
  const userIdOrEmail = args.find(arg => !arg.startsWith('--'));
  const dryRun = !args.includes('--apply');
  const help = args.includes('--help') || args.includes('-h');

  if (help) {
    console.log(`
权限修复脚本使用说明:

npx tsx scripts/fix-permissions.ts [用户ID或邮箱] [选项]

选项:
  --apply           实际应用修复（默认为预览模式）
  --help, -h        显示帮助信息

示例:
  npx tsx scripts/fix-permissions.ts                    # 预览所有用户的修复
  npx tsx scripts/fix-permissions.ts --apply            # 应用所有用户的修复
  npx tsx scripts/fix-permissions.ts user@example.com   # 预览特定用户的修复
  npx tsx scripts/fix-permissions.ts user123 --apply    # 应用特定用户的修复
    `);
    return;
  }

  if (userIdOrEmail) {
    console.log(`🎯 修复指定用户: ${userIdOrEmail}`);
  } else {
    console.log(`🔧 修复所有用户权限配置`);
  }

  try {
    const results = await fixUserPermissions(userIdOrEmail, dryRun);
    printFixReport(results, dryRun);

    if (!dryRun) {
      console.log(`\n✅ 权限修复完成！建议重新运行诊断脚本验证结果。`);
    }
  } catch (error) {
    console.error('❌ 权限修复失败:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main();
}
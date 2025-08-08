/**
 * 权限诊断脚本 - 用于检查用户权限配置
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface DiagnosisResult {
  userId: string;
  userInfo: any;
  enterprises: any[];
  groupMemberships: any[];
  enterpriseRoles: any[];
  permissionIssues: string[];
  recommendations: string[];
}

async function diagnoseUserPermissions(userIdOrEmail?: string): Promise<DiagnosisResult[]> {
  try {
    console.log('🔍 开始权限诊断...\n');

    // 如果提供了用户ID或邮箱，只诊断该用户；否则诊断所有用户
    let users;
    if (userIdOrEmail) {
      const isEmail = userIdOrEmail.includes('@');
      users = await prisma.user.findMany({
        where: isEmail ? { email: userIdOrEmail } : { id: userIdOrEmail },
        take: 1
      });
      
      if (users.length === 0) {
        console.log(`❌ 找不到用户: ${userIdOrEmail}`);
        return [];
      }
    } else {
      // 获取所有活跃用户
      users = await prisma.user.findMany({
        where: { status: 'active' }
      });
    }

    const results: DiagnosisResult[] = [];

    for (const user of users) {
      console.log(`📋 诊断用户: ${user.name} (${user.email})`);
      
      const result: DiagnosisResult = {
        userId: user.id,
        userInfo: {
          id: user.id,
          name: user.name,
          email: user.email,
          status: user.status,
          createdAt: user.createdAt
        },
        enterprises: [],
        groupMemberships: [],
        enterpriseRoles: [],
        permissionIssues: [],
        recommendations: []
      };

      // 1. 检查用户在企业中的角色
      const userEnterprises = await prisma.userEnterprise.findMany({
        where: { userId: user.id },
        include: {
          enterprise: {
            select: {
              id: true,
              name: true,
              createdAt: true
            }
          }
        }
      });

      result.enterprises = userEnterprises.map(ue => ({
        enterpriseId: ue.enterpriseId,
        enterpriseName: ue.enterprise.name,
        role: ue.role,
        status: ue.isActive ? 'active' : 'inactive',
        joinedAt: ue.joinedAt
      }));

      // 2. 检查拼车组成员身份
      const groupMemberships = await prisma.groupMember.findMany({
        where: { userId: user.id },
        include: {
          group: {
            select: {
              id: true,
              name: true,
              organizationType: true,
              enterpriseId: true,
              status: true
            }
          }
        }
      });

      result.groupMemberships = groupMemberships.map(gm => ({
        groupId: gm.groupId,
        groupName: gm.group.name,
        role: gm.role,
        status: gm.status,
        organizationType: gm.group.organizationType,
        enterpriseId: gm.group.enterpriseId,
        joinedAt: gm.joinedAt
      }));

      // 3. 检查企业角色权限配置
      const enterpriseRoles = await prisma.userEnterpriseRole.findMany({
        where: { userId: user.id }
      });

      result.enterpriseRoles = enterpriseRoles.map(uer => ({
        roleId: uer.role,
        roleName: uer.role,
        roleDisplayName: uer.role,
        enterpriseId: uer.enterpriseId,
        scope: uer.scope,
        resourceId: uer.resourceId,
        isActive: uer.isActive,
        permissions: [] // 权限需要从权限管理器获取
      }));

      // 4. 分析权限问题
      await analyzePermissionIssues(result);

      results.push(result);
    }

    return results;

  } catch (error) {
    console.error('权限诊断失败:', error);
    throw error;
  }
}

async function analyzePermissionIssues(result: DiagnosisResult) {
  const { enterprises, groupMemberships, enterpriseRoles, permissionIssues, recommendations } = result;

  // 检查1: 用户是否在企业中但没有企业角色权限
  const enterpriseIds = enterprises.map(e => e.enterpriseId);
  const roleEnterpriseIds = enterpriseRoles.map(r => r.enterpriseId).filter(Boolean);
  
  for (const enterpriseId of enterpriseIds) {
    if (!roleEnterpriseIds.includes(enterpriseId)) {
      const enterprise = enterprises.find(e => e.enterpriseId === enterpriseId);
      permissionIssues.push(`缺少企业 ${enterprise?.enterpriseName} (${enterpriseId}) 的角色权限配置`);
      recommendations.push(`为用户在企业 ${enterprise?.enterpriseName} 中分配角色，建议使用 enterprise_admin 或 enterprise_manager 角色`);
    }
  }

  // 检查2: 用户是否是企业级拼车组成员但没有对应的企业权限
  const enterpriseGroups = groupMemberships.filter(gm => 
    gm.organizationType === 'enterprise_group' && gm.enterpriseId
  );
  
  for (const group of enterpriseGroups) {
    if (!roleEnterpriseIds.includes(group.enterpriseId!)) {
      permissionIssues.push(`是企业级拼车组 ${group.groupName} 的成员，但缺少企业 ${group.enterpriseId} 的角色权限`);
      recommendations.push(`为用户在企业 ${group.enterpriseId} 中分配角色，确保能访问企业级拼车组功能`);
    }
  }

  // 检查3: 角色权限是否包含必要的权限
  for (const role of enterpriseRoles) {
    if (role.isActive) {
      const hasGroupRead = role.permissions.includes('group.read') || 
                          role.permissions.includes('group.manage');
      const hasGroupUpdate = role.permissions.includes('group.update') || 
                            role.permissions.includes('group.manage');
      
      if (!hasGroupRead) {
        permissionIssues.push(`角色 ${role.roleDisplayName} 缺少 group.read 权限，无法查看拼车组API密钥`);
        recommendations.push(`更新角色 ${role.roleDisplayName} 的权限配置，添加 group.read 权限`);
      }

      if (!hasGroupUpdate && groupMemberships.some(gm => gm.role === 'admin' || gm.role === 'owner')) {
        permissionIssues.push(`角色 ${role.roleDisplayName} 缺少 group.update 权限，无法管理拼车组API密钥`);
        recommendations.push(`更新角色 ${role.roleDisplayName} 的权限配置，添加 group.update 权限`);
      }
    }
  }

  // 检查4: 是否有非活跃的权限配置
  const inactiveRoles = enterpriseRoles.filter(r => !r.isActive);
  if (inactiveRoles.length > 0) {
    permissionIssues.push(`存在 ${inactiveRoles.length} 个非活跃的角色配置`);
    recommendations.push('清理非活跃的角色配置或重新激活必要的角色');
  }
}

function printDiagnosisReport(results: DiagnosisResult[]) {
  console.log('\n📊 权限诊断报告');
  console.log('='.repeat(60));

  let totalIssues = 0;
  
  for (const result of results) {
    console.log(`\n👤 用户: ${result.userInfo.name} (${result.userInfo.email})`);
    console.log(`   ID: ${result.userInfo.id}`);
    
    // 企业信息
    if (result.enterprises.length > 0) {
      console.log(`\n   🏢 企业角色:`);
      for (const enterprise of result.enterprises) {
        console.log(`     - ${enterprise.enterpriseName}: ${enterprise.role} (${enterprise.status})`);
      }
    } else {
      console.log(`\n   🏢 企业角色: 无`);
    }

    // 拼车组信息
    if (result.groupMemberships.length > 0) {
      console.log(`\n   🚗 拼车组成员:`);
      for (const group of result.groupMemberships) {
        console.log(`     - ${group.groupName}: ${group.role} (${group.organizationType})`);
      }
    } else {
      console.log(`\n   🚗 拼车组成员: 无`);
    }

    // 权限角色
    if (result.enterpriseRoles.length > 0) {
      console.log(`\n   🔐 权限角色:`);
      for (const role of result.enterpriseRoles) {
        const status = role.isActive ? '✅' : '❌';
        console.log(`     ${status} ${role.roleDisplayName} (${role.scope})`);
        console.log(`        权限: ${role.permissions.join(', ')}`);
      }
    } else {
      console.log(`\n   🔐 权限角色: 无`);
    }

    // 权限问题
    if (result.permissionIssues.length > 0) {
      console.log(`\n   ⚠️  权限问题:`);
      for (const issue of result.permissionIssues) {
        console.log(`     - ${issue}`);
      }
      totalIssues += result.permissionIssues.length;
    } else {
      console.log(`\n   ✅ 权限状态: 正常`);
    }

    // 修复建议
    if (result.recommendations.length > 0) {
      console.log(`\n   💡 修复建议:`);
      for (const recommendation of result.recommendations) {
        console.log(`     - ${recommendation}`);
      }
    }

    console.log('\n' + '-'.repeat(60));
  }

  console.log(`\n📈 诊断总结:`);
  console.log(`   检查用户数: ${results.length}`);
  console.log(`   发现问题数: ${totalIssues}`);
  
  if (totalIssues > 0) {
    console.log(`   建议运行权限修复脚本: npm run fix-permissions`);
  } else {
    console.log(`   ✅ 所有用户权限配置正常`);
  }
}

async function main() {
  const userIdOrEmail = process.argv[2];
  
  if (userIdOrEmail) {
    console.log(`🎯 诊断指定用户: ${userIdOrEmail}`);
  } else {
    console.log(`🔍 诊断所有用户权限配置`);
  }

  try {
    const results = await diagnoseUserPermissions(userIdOrEmail);
    printDiagnosisReport(results);
  } catch (error) {
    console.error('❌ 权限诊断失败:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main();
}

export { diagnoseUserPermissions };
export type { DiagnosisResult };
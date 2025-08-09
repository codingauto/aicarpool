/**
 * 简化权限诊断脚本 - 快速检查用户权限状态
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function quickDiagnose(userIdOrEmail?: string) {
  try {
    console.log('🔍 快速权限诊断...\n');

    // 查找用户
    let users;
    if (userIdOrEmail) {
      const isEmail = userIdOrEmail.includes('@');
      users = await prisma.user.findMany({
        where: isEmail ? { email: userIdOrEmail } : { id: userIdOrEmail },
        take: 1
      });
    } else {
      users = await prisma.user.findMany({
        where: { status: 'active' },
        take: 5 // 只检查前5个用户
      });
    }

    if (users.length === 0) {
      console.log('❌ 没有找到用户');
      return;
    }

    for (const user of users) {
      console.log(`👤 用户: ${user.name} (${user.email})`);
      
      // 1. 检查企业角色
      const userEnterprises = await prisma.userEnterprise.findMany({
        where: { userId: user.id },
        include: {
          enterprise: {
            select: { id: true, name: true }
          }
        }
      });
      
      console.log(`   🏢 企业角色: ${userEnterprises.length} 个`);
      userEnterprises.forEach(ue => {
        console.log(`     - ${ue.enterprise.name}: ${ue.role} (${ue.isActive ? '活跃' : '非活跃'})`);
      });

      // 2. 检查拼车组成员
      const groupMemberships = await prisma.groupMember.findMany({
        where: { userId: user.id },
        include: {
          group: {
            select: {
              id: true,
              name: true,
              organizationType: true,
              enterpriseId: true
            }
          }
        }
      });
      
      console.log(`   🚗 拼车组成员: ${groupMemberships.length} 个`);
      groupMemberships.forEach(gm => {
        console.log(`     - ${gm.group.name}: ${gm.role} (${gm.group.organizationType})`);
        if (gm.group.enterpriseId) {
          console.log(`       企业ID: ${gm.group.enterpriseId}`);
        }
      });

      // 3. 检查企业权限角色
      const enterpriseRoles = await prisma.userEnterpriseRole.findMany({
        where: { userId: user.id }
      });
      
      console.log(`   🔐 企业权限角色: ${enterpriseRoles.length} 个`);
      enterpriseRoles.forEach(er => {
        console.log(`     - 角色: ${er.role}, 企业: ${er.enterpriseId}, 范围: ${er.scope}, 状态: ${er.isActive ? '活跃' : '非活跃'}`);
      });

      // 4. 分析问题
      console.log(`   📊 问题分析:`);
      
      const enterpriseIds = userEnterprises.map(ue => ue.enterpriseId);
      const roleEnterpriseIds = enterpriseRoles.filter(er => er.enterpriseId).map(er => er.enterpriseId!);
      
      // 检查企业成员是否有对应权限角色
      const missingEnterpriseRoles = enterpriseIds.filter(id => !roleEnterpriseIds.includes(id));
      if (missingEnterpriseRoles.length > 0) {
        console.log(`     ⚠️  缺少企业权限角色: ${missingEnterpriseRoles.length} 个企业`);
        missingEnterpriseRoles.forEach(id => {
          const enterprise = userEnterprises.find(ue => ue.enterpriseId === id);
          console.log(`       - ${enterprise?.enterprise.name} (${id})`);
        });
      }
      
      // 检查企业级拼车组
      const enterpriseGroups = groupMemberships.filter(gm => 
        gm.group.organizationType === 'enterprise_group' && gm.group.enterpriseId
      );
      
      for (const group of enterpriseGroups) {
        if (!roleEnterpriseIds.includes(group.group.enterpriseId!)) {
          console.log(`     ⚠️  企业级拼车组 ${group.group.name} 缺少对应的企业权限`);
        }
      }
      
      // 检查是否有活跃的权限角色
      const activeRoles = enterpriseRoles.filter(er => er.isActive);
      if (activeRoles.length === 0 && (userEnterprises.length > 0 || enterpriseGroups.length > 0)) {
        console.log(`     ❌ 需要企业权限但没有活跃的权限角色`);
      }

      console.log('');
    }

  } catch (error) {
    console.error('❌ 诊断失败:', error);
  } finally {
    await prisma.$disconnect();
  }
}

async function main() {
  const userIdOrEmail = process.argv[2];
  await quickDiagnose(userIdOrEmail);
}

if (require.main === module) {
  main();
}
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixAdminPermissions() {
  console.log('🔧 修复管理员权限...\n');

  try {
    // 1. 查找管理员用户
    const adminUser = await prisma.user.findFirst({
      where: {
        email: 'admin@aicarpool.com'
      }
    });

    if (!adminUser) {
      console.log('❌ 未找到管理员用户');
      return;
    }

    console.log('✅ 找到管理员用户:', adminUser.name);

    // 2. 查找用户的所有企业关系
    const userEnterprises = await prisma.userEnterprise.findMany({
      where: {
        userId: adminUser.id,
        role: 'owner' // 只处理 owner 角色的企业
      }
    });

    console.log(`📋 找到 ${userEnterprises.length} 个用户拥有的企业`);

    // 3. 为每个企业更新或创建管理员权限
    for (const ue of userEnterprises) {
      // 更新现有的权限角色
      const updated = await prisma.userEnterpriseRole.updateMany({
        where: {
          userId: adminUser.id,
          enterpriseId: ue.enterpriseId,
          scope: 'enterprise'
        },
        data: {
          role: 'enterprise_admin', // 更新为管理员角色
          isActive: true
        }
      });

      if (updated.count > 0) {
        console.log(`✅ 更新企业 ${ue.enterpriseId} 的权限角色为 enterprise_admin`);
      } else {
        // 如果没有找到，创建新的权限角色
        const newRole = await prisma.userEnterpriseRole.create({
          data: {
            userId: adminUser.id,
            enterpriseId: ue.enterpriseId,
            role: 'enterprise_admin',
            scope: 'enterprise',
            isActive: true
          }
        });
        console.log(`✅ 为企业 ${ue.enterpriseId} 创建新的 enterprise_admin 权限角色`);
      }
    }

    // 4. 确保系统管理员角色是活跃的
    await prisma.userEnterpriseRole.updateMany({
      where: {
        userId: adminUser.id,
        role: 'system_admin'
      },
      data: {
        isActive: true
      }
    });

    console.log('✅ 确保系统管理员角色活跃');

    // 5. 验证权限
    const finalRoles = await prisma.userEnterpriseRole.findMany({
      where: {
        userId: adminUser.id,
        isActive: true
      }
    });

    console.log('\n🔑 最终权限角色:');
    finalRoles.forEach(role => {
      console.log(`   - ${role.role} (企业: ${role.enterpriseId || '全局'})`);
    });

    console.log('\n🎉 管理员权限修复完成！');

  } catch (error) {
    console.error('❌ 修复权限时出错:', error);
    throw error;
  }
}

// 执行修复
fixAdminPermissions()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
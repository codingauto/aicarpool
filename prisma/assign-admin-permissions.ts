import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function assignAdminPermissions() {
  console.log('🔧 为系统管理员分配权限...');

  try {
    // 查找管理员账号
    const adminUser = await prisma.user.findUnique({
      where: { email: 'admin@aicarpool.com' }
    });

    if (!adminUser) {
      console.log('❌ 未找到管理员账号，请先运行 npm run db:create-admin');
      return;
    }

    // 检查是否已经分配了系统管理员角色
    const existingRole = await prisma.userEnterpriseRole.findFirst({
      where: {
        userId: adminUser.id,
        role: 'system_admin',
        scope: 'global'
      }
    });

    if (existingRole) {
      console.log('✅ 系统管理员权限已存在');
      console.log('📝 角色信息:');
      console.log('   用户ID:', existingRole.userId);
      console.log('   角色:', existingRole.role);
      console.log('   范围:', existingRole.scope);
      console.log('   状态:', existingRole.isActive ? '激活' : '禁用');
      return;
    }

    // 分配系统管理员角色
    const adminRole = await prisma.userEnterpriseRole.create({
      data: {
        userId: adminUser.id,
        role: 'system_admin',
        scope: 'global',
        isActive: true
      }
    });

    console.log('✅ 系统管理员权限分配成功!');
    console.log('📝 权限信息:');
    console.log('   用户:', adminUser.name, '(' + adminUser.email + ')');
    console.log('   角色:', adminRole.role);
    console.log('   范围:', adminRole.scope);
    console.log('   权限ID:', adminRole.id);
    console.log('');
    console.log('🔐 现在该用户拥有以下权限:');
    console.log('   • system.admin - 系统管理员权限');
    console.log('   • enterprise.manage - 企业管理');
    console.log('   • group.manage - 拼车组管理');
    console.log('   • ai.manage - AI账号管理');
    console.log('   • user.manage - 用户管理');

  } catch (error) {
    console.error('❌ 分配管理员权限失败:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// 如果直接运行此文件，则分配权限
if (require.main === module) {
  assignAdminPermissions()
    .then(() => {
      console.log('🎉 管理员权限分配完成');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 分配失败:', error);
      process.exit(1);
    });
}

export { assignAdminPermissions };
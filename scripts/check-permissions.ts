import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkPermissions() {
  console.log('🔍 检查权限数据...\n');

  try {
    // 1. 检查用户
    const adminUser = await prisma.user.findFirst({
      where: {
        email: 'admin@aicarpool.com'
      }
    });

    if (!adminUser) {
      console.log('❌ 未找到 admin@aicarpool.com 用户');
      return;
    }

    console.log('✅ 找到用户:', adminUser.name, '(', adminUser.email, ')');
    console.log('   用户ID:', adminUser.id);

    // 2. 检查该用户的企业关系
    const userEnterprises = await prisma.userEnterprise.findMany({
      where: {
        userId: adminUser.id
      },
      include: {
        enterprise: true
      }
    });

    console.log('\n📋 用户的企业关系:');
    userEnterprises.forEach(ue => {
      console.log(`   - 企业: ${ue.enterprise.name} (${ue.enterpriseId})`);
      console.log(`     角色: ${ue.role}`);
      console.log(`     状态: ${ue.isActive ? '活跃' : '未激活'}`);
    });

    // 3. 检查用户的权限角色
    const userRoles = await prisma.userEnterpriseRole.findMany({
      where: {
        userId: adminUser.id
      }
    });

    console.log('\n🔑 用户的权限角色:');
    if (userRoles.length === 0) {
      console.log('   ❌ 没有任何权限角色！');
    } else {
      userRoles.forEach(role => {
        console.log(`   - 角色: ${role.role}`);
        console.log(`     企业ID: ${role.enterpriseId}`);
        console.log(`     范围: ${role.scope}`);
        console.log(`     资源ID: ${role.resourceId || '无'}`);
        console.log(`     状态: ${role.isActive ? '活跃' : '未激活'}`);
      });
    }

    // 4. 检查特定的临时拼车组
    const tempGroup = await prisma.group.findFirst({
      where: {
        name: '邀请链接组-邀请链接-2025/8/5 16:37:47'
      },
      include: {
        enterprise: true,
        members: {
          where: {
            userId: adminUser.id
          }
        }
      }
    });

    if (tempGroup) {
      console.log('\n🏢 目标拼车组信息:');
      console.log(`   名称: ${tempGroup.name}`);
      console.log(`   ID: ${tempGroup.id}`);
      console.log(`   企业: ${tempGroup.enterprise?.name || '无'}`);
      console.log(`   企业ID: ${tempGroup.enterpriseId || '无'}`);
      console.log(`   组织类型: ${tempGroup.organizationType}`);
      console.log(`   状态: ${tempGroup.status}`);
      console.log(`   用户是否为成员: ${tempGroup.members.length > 0 ? '是' : '否'}`);

      // 检查资源绑定
      const resourceBinding = await prisma.groupResourceBinding.findFirst({
        where: {
          groupId: tempGroup.id
        }
      });

      console.log(`   资源绑定: ${resourceBinding ? '已配置' : '未配置'}`);
      if (resourceBinding) {
        console.log(`     绑定模式: ${resourceBinding.bindingMode}`);
        console.log(`     配置: ${JSON.stringify(resourceBinding.bindingConfig)}`);
      }
    }

    // 5. 检查权限管理器能否验证权限
    if (tempGroup && tempGroup.enterpriseId) {
      console.log('\n🔐 权限检查测试:');
      console.log(`   检查用户 ${adminUser.id} 对企业 ${tempGroup.enterpriseId} 的 group.read 权限...`);
      
      // 检查是否有企业管理员角色
      const hasAdminRole = userRoles.some(role => 
        role.enterpriseId === tempGroup.enterpriseId && 
        role.role === 'enterprise_admin' &&
        role.isActive
      );
      
      console.log(`   是否有企业管理员角色: ${hasAdminRole ? '是' : '否'}`);
    }

  } catch (error) {
    console.error('❌ 检查权限数据时出错:', error);
    throw error;
  }
}

// 执行检查
checkPermissions()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
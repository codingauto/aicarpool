import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seedPermissions() {
  console.log('🌱 开始创建权限系统种子数据...');

  try {
    // 1. 创建测试用户
    const testUser = await prisma.user.upsert({
      where: { email: 'test@example.com' },
      update: {},
      create: {
        id: 'user_test_001',
        email: 'test@example.com',
        name: '测试用户',
        password: 'hashed_password', // 在实际应用中应该是哈希后的密码
        emailVerified: true
      }
    });

    console.log('✅ 测试用户创建完成:', testUser.name);

    // 2. 创建测试企业
    const testEnterprise = await prisma.enterprise.upsert({
      where: { id: 'ent_test_001' },
      update: {},
      create: {
        id: 'ent_test_001',
        name: '测试科技公司',
        planType: 'enterprise',
        organizationType: 'enterprise'
      }
    });

    console.log('✅ 测试企业创建完成:', testEnterprise.name);

    // 3. 创建用户企业关系
    const userEnterprise = await prisma.userEnterprise.upsert({
      where: {
        userId_enterpriseId: {
          userId: testUser.id,
          enterpriseId: testEnterprise.id
        }
      },
      update: {},
      create: {
        userId: testUser.id,
        enterpriseId: testEnterprise.id,
        role: 'admin',
        isActive: true
      }
    });

    console.log('✅ 用户企业关系创建完成');

    // 4. 创建用户权限角色
    const userRole = await prisma.userEnterpriseRole.upsert({
      where: { id: 'role_test_001' },
      update: {},
      create: {
        id: 'role_test_001',
        userId: testUser.id,
        enterpriseId: testEnterprise.id,
        role: 'enterprise_admin',
        scope: 'enterprise',
        isActive: true
      }
    });

    console.log('✅ 用户权限角色创建完成:', userRole.role);

    // 5. 创建测试拼车组
    const testGroup = await prisma.group.upsert({
      where: { id: 'group_test_001' },
      update: {},
      create: {
        id: 'group_test_001',
        name: '前端开发组',
        description: '负责前端开发的拼车组',
        createdById: testUser.id,
        enterpriseId: testEnterprise.id,
        organizationType: 'enterprise_group',
        maxMembers: 10
      }
    });

    console.log('✅ 测试拼车组创建完成:', testGroup.name);

    // 6. 创建组内角色
    const groupRole = await prisma.userEnterpriseRole.upsert({
      where: { id: 'role_group_test_001' },
      update: {},
      create: {
        id: 'role_group_test_001',
        userId: testUser.id,
        enterpriseId: testEnterprise.id,
        role: 'group_owner',
        scope: 'group',
        resourceId: testGroup.id,
        isActive: true
      }
    });

    console.log('✅ 组内权限角色创建完成:', groupRole.role);

    // 7. 创建拼车组成员关系
    const groupMember = await prisma.groupMember.upsert({
      where: {
        groupId_userId: {
          groupId: testGroup.id,
          userId: testUser.id
        }
      },
      update: {},
      create: {
        groupId: testGroup.id,
        userId: testUser.id,
        role: 'owner',
        status: 'active'
      }
    });

    console.log('✅ 拼车组成员关系创建完成');

    console.log('\n🎉 权限系统种子数据创建完成！');
    console.log('\n📋 创建的数据：');
    console.log(`- 用户: ${testUser.name} (${testUser.email})`);
    console.log(`- 企业: ${testEnterprise.name}`);
    console.log(`- 拼车组: ${testGroup.name}`);
    console.log(`- 企业角色: ${userRole.role}`);
    console.log(`- 组内角色: ${groupRole.role}`);

  } catch (error) {
    console.error('❌ 创建种子数据时出错:', error);
    throw error;
  }
}

// 执行种子数据创建
seedPermissions()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
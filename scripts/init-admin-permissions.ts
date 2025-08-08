/**
 * 初始化管理员权限数据脚本
 * 
 * 为admin@aicarpool.com用户创建完整的权限数据
 * 确保管理员拥有系统所有权限
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🔧 开始初始化管理员权限数据...');

  try {
    // 1. 查找或创建管理员用户
    let adminUser = await prisma.user.findUnique({
      where: { email: 'admin@aicarpool.com' }
    });

    if (!adminUser) {
      console.log('📝 创建管理员用户...');
      // 默认密码: admin123
      const hashedPassword = await bcrypt.hash('admin123', 10);
      
      adminUser = await prisma.user.create({
        data: {
          email: 'admin@aicarpool.com',
          name: '系统管理员',
          password: hashedPassword,
          role: 'admin',
          status: 'active',
          emailVerified: true
        }
      });
      console.log('✅ 管理员用户创建成功:', adminUser.id);
      console.log('   默认密码: admin123（请及时修改）');
    } else {
      console.log('✅ 管理员用户已存在:', adminUser.id);
      
      // 确保用户角色是 admin
      if (adminUser.role !== 'admin') {
        await prisma.user.update({
          where: { id: adminUser.id },
          data: { role: 'admin' }
        });
        console.log('   已更新用户角色为 admin');
      }
    }

    // 2. 查找或创建测试企业
    let testEnterprise = await prisma.enterprise.findFirst({
      where: { name: '测试科技公司' }
    });

    if (!testEnterprise) {
      console.log('📝 创建测试企业...');
      testEnterprise = await prisma.enterprise.create({
        data: {
          id: 'ent_test_001',
          name: '测试科技公司',
          planType: 'enterprise',
          organizationType: 'enterprise'
        }
      });
      console.log('✅ 测试企业创建成功:', testEnterprise.id);
    } else {
      console.log('✅ 测试企业已存在:', testEnterprise.id);
    }

    // 3. 创建管理员的企业关系
    const existingUserEnterprise = await prisma.userEnterprise.findFirst({
      where: {
        userId: adminUser.id,
        enterpriseId: testEnterprise.id
      }
    });

    if (!existingUserEnterprise) {
      console.log('📝 创建管理员企业关系...');
      await prisma.userEnterprise.create({
        data: {
          userId: adminUser.id,
          enterpriseId: testEnterprise.id,
          role: 'owner',
          isActive: true,
          permissions: JSON.stringify([
            'system.admin',
            'enterprise.manage',
            'enterprise.view',
            'group.create',
            'group.manage',
            'group.view',
            'ai.use',
            'ai.manage',
            'user.invite',
            'user.manage'
          ])
        }
      });
      console.log('✅ 管理员企业关系创建成功');
    } else {
      console.log('✅ 管理员企业关系已存在');
    }

    // 4. 创建管理员的系统级权限角色
    const existingSystemRole = await prisma.userEnterpriseRole.findFirst({
      where: {
        userId: adminUser.id,
        scope: 'global'
      }
    });

    if (!existingSystemRole) {
      console.log('📝 创建管理员系统级权限...');
      await prisma.userEnterpriseRole.create({
        data: {
          userId: adminUser.id,
          role: 'system_admin',
          scope: 'global',
          isActive: true
        }
      });
      console.log('✅ 管理员系统级权限创建成功');
    } else {
      console.log('✅ 管理员系统级权限已存在');
    }

    // 5. 创建管理员的企业级权限角色
    const existingEnterpriseRole = await prisma.userEnterpriseRole.findFirst({
      where: {
        userId: adminUser.id,
        enterpriseId: testEnterprise.id,
        scope: 'enterprise'
      }
    });

    if (!existingEnterpriseRole) {
      console.log('📝 创建管理员企业级权限...');
      await prisma.userEnterpriseRole.create({
        data: {
          userId: adminUser.id,
          enterpriseId: testEnterprise.id,
          role: 'enterprise_owner',
          scope: 'enterprise',
          isActive: true
        }
      });
      console.log('✅ 管理员企业级权限创建成功');
    } else {
      console.log('✅ 管理员企业级权限已存在');
    }

    // 6. 创建测试用户权限数据
    let testUser = await prisma.user.findFirst({
      where: { email: 'test@example.com' }
    });

    if (!testUser) {
      console.log('📝 创建测试用户...');
      testUser = await prisma.user.create({
        data: {
          id: 'user_test_001',
          email: 'test@example.com',
          name: '测试用户',
          password: '$2b$10$TestHashedPassword',
          role: 'user',
          status: 'active',
          emailVerified: true
        }
      });
      console.log('✅ 测试用户创建成功:', testUser.id);
    } else {
      console.log('✅ 测试用户已存在:', testUser.id);
    }

    // 7. 创建测试用户的企业关系
    const existingTestUserEnterprise = await prisma.userEnterprise.findFirst({
      where: {
        userId: testUser.id,
        enterpriseId: testEnterprise.id
      }
    });

    if (!existingTestUserEnterprise) {
      console.log('📝 创建测试用户企业关系...');
      await prisma.userEnterprise.create({
        data: {
          userId: testUser.id,
          enterpriseId: testEnterprise.id,
          role: 'admin',
          isActive: true
        }
      });
      console.log('✅ 测试用户企业关系创建成功');
    } else {
      console.log('✅ 测试用户企业关系已存在');
    }

    // 8. 创建测试用户的权限角色
    const existingTestUserRole = await prisma.userEnterpriseRole.findFirst({
      where: {
        userId: testUser.id,
        enterpriseId: testEnterprise.id
      }
    });

    if (!existingTestUserRole) {
      console.log('📝 创建测试用户权限角色...');
      await prisma.userEnterpriseRole.createMany({
        data: [
          {
            userId: testUser.id,
            enterpriseId: testEnterprise.id,
            role: 'enterprise_admin',
            scope: 'enterprise',
            isActive: true
          },
          {
            userId: testUser.id,
            enterpriseId: testEnterprise.id,
            role: 'group_owner',
            scope: 'group',
            resourceId: 'group_test_001',
            isActive: true
          }
        ]
      });
      console.log('✅ 测试用户权限角色创建成功');
    } else {
      console.log('✅ 测试用户权限角色已存在');
    }

    console.log('🎉 管理员权限数据初始化完成！');

    // 验证数据
    console.log('\n📊 验证权限数据:');
    const adminRoles = await prisma.userEnterpriseRole.findMany({
      where: { userId: adminUser.id }
    });
    console.log('管理员角色数量:', adminRoles.length);
    
    const testUserRoles = await prisma.userEnterpriseRole.findMany({
      where: { userId: testUser.id }
    });
    console.log('测试用户角色数量:', testUserRoles.length);

  } catch (error) {
    console.error('❌ 初始化失败:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// 运行脚本
main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
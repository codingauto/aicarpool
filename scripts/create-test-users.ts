import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function createTestUsers() {
  console.log('👥 创建测试用户...');

  const testUsers = [
    {
      email: 'user1@aicarpool.com',
      name: '张三',
      password: 'user123456',
      role: 'user'
    },
    {
      email: 'user2@aicarpool.com',
      name: '李四',
      password: 'user123456',
      role: 'user'
    },
    {
      email: 'user3@aicarpool.com',
      name: '王五',
      password: 'user123456',
      role: 'user'
    },
    {
      email: 'manager@aicarpool.com',
      name: '经理张',
      password: 'manager123456',
      role: 'admin'
    }
  ];

  try {
    for (const userData of testUsers) {
      const existingUser = await prisma.user.findUnique({
        where: { email: userData.email }
      });

      if (!existingUser) {
        const hashedPassword = await bcrypt.hash(userData.password, 12);
        
        const user = await prisma.user.create({
          data: {
            email: userData.email,
            name: userData.name,
            password: hashedPassword,
            role: userData.role,
            status: 'active',
            emailVerified: true
          }
        });

        console.log(`✅ 创建用户: ${user.name} (${user.email})`);
      } else {
        console.log(`⚠️  用户已存在: ${existingUser.name} (${existingUser.email})`);
      }
    }

    // 创建用户与企业的关联关系
    const users = await prisma.user.findMany({
      where: {
        email: {
          in: testUsers.map(u => u.email)
        }
      }
    });

    const admin = await prisma.user.findUnique({
      where: { email: 'admin@aicarpool.com' }
    });

    if (admin) {
      users.push(admin);
    }

    // 为用户分配企业关系
    for (const user of users) {
      const existingRelation = await prisma.userEnterprise.findFirst({
        where: {
          userId: user.id,
          enterpriseId: 'ent_001'
        }
      });

      if (!existingRelation) {
        let role = 'member';
        if (user.email === 'admin@aicarpool.com') {
          role = 'owner';
        } else if (user.email === 'manager@aicarpool.com') {
          role = 'admin';
        }

        await prisma.userEnterprise.create({
          data: {
            userId: user.id,
            enterpriseId: 'ent_001',
            role: role,
            isActive: true
          }
        });

        console.log(`✅ 分配用户 ${user.name} 到企业 ent_001，角色: ${role}`);
      }
    }

    console.log('🎉 测试用户创建完成');

  } catch (error) {
    console.error('❌ 创建测试用户失败:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// 如果直接运行此文件
if (require.main === module) {
  createTestUsers()
    .then(() => {
      console.log('🎉 完成');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 失败:', error);
      process.exit(1);
    });
}

export { createTestUsers };
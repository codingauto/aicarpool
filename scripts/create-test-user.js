const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function createTestUser() {
  try {
    // 检查是否已存在测试用户
    const existingUser = await prisma.user.findUnique({
      where: { email: 'test@example.com' }
    });

    if (existingUser) {
      console.log('测试用户已存在');
      return;
    }

    // 创建测试用户
    const hashedPassword = await bcrypt.hash('123456', 10);
    
    const user = await prisma.user.create({
      data: {
        email: 'test@example.com',
        name: '测试用户',
        password: hashedPassword,
        role: 'user',
        status: 'active',
        emailVerified: true
      }
    });

    console.log('测试用户创建成功:', {
      id: user.id,
      email: user.email,
      name: user.name
    });

  } catch (error) {
    console.error('创建测试用户失败:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createTestUser();
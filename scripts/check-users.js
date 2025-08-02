const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkUsers() {
  try {
    const users = await prisma.user.findMany({
      take: 5,
      select: {
        id: true,
        name: true,
        email: true
      }
    });
    
    console.log('用户列表:', users);
    
    const groups = await prisma.group.findMany({
      where: { enterpriseId: 'ent_001' },
      take: 3,
      select: {
        id: true,
        name: true
      }
    });
    
    console.log('拼车组列表:', groups);
    
  } catch (error) {
    console.error('查询失败:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkUsers();
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function fixAdmin() {
  try {
    const admin = await prisma.user.findUnique({
      where: { email: 'admin@aicarpool.com' }
    });
    
    if (admin) {
      console.log('Admin user found:', {
        id: admin.id,
        email: admin.email,
        name: admin.name,
        hasPassword: Boolean(admin.password),
        createdAt: admin.createdAt
      });
      
      // 重置密码为admin123456
      console.log('Resetting password to admin123456...');
      const hashedPassword = await bcrypt.hash('admin123456', 10);
      await prisma.user.update({
        where: { email: 'admin@aicarpool.com' },
        data: { password: hashedPassword }
      });
      console.log('Password reset complete! You can now login with:');
      console.log('Email: admin@aicarpool.com');
      console.log('Password: admin123456');
    } else {
      console.log('Admin user not found, creating...');
      const hashedPassword = await bcrypt.hash('admin123456', 10);
      await prisma.user.create({
        data: {
          email: 'admin@aicarpool.com',
          name: 'Admin',
          password: hashedPassword,
          emailVerified: true,
          role: 'admin'
        }
      });
      console.log('Admin user created! You can now login with:');
      console.log('Email: admin@aicarpool.com');
      console.log('Password: admin123456');
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixAdmin();
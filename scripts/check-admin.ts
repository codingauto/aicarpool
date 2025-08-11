import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function checkAdmin() {
  const admin = await prisma.user.findUnique({
    where: { email: 'admin@aicarpool.com' }
  });
  
  if (admin) {
    console.log('Admin user found:', {
      id: admin.id,
      email: admin.email,
      name: admin.name,
      status: admin.status,
      emailVerified: admin.emailVerified
    });
    
    // 测试密码
    const testPassword = 'Admin@123456';
    const isValid = await bcrypt.compare(testPassword, admin.password);
    console.log('Password test:', isValid ? '✅ Valid' : '❌ Invalid');
    
    // 重设密码
    if (!isValid) {
      const newHash = await bcrypt.hash(testPassword, 10);
      await prisma.user.update({
        where: { id: admin.id },
        data: { password: newHash }
      });
      console.log('Password reset to:', testPassword);
    }
  } else {
    console.log('Admin user not found');
  }
  
  await prisma.$disconnect();
}

checkAdmin();
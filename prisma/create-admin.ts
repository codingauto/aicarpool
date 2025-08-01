import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function createAdminUser() {
  console.log('🔧 创建管理员账号...');

  try {
    // 管理员信息
    const adminEmail = 'admin@aicarpool.com';
    const adminPassword = 'admin123456';
    const adminName = '系统管理员';

    // 检查管理员是否已存在
    const existingAdmin = await prisma.user.findUnique({
      where: { email: adminEmail }
    });

    if (existingAdmin) {
      console.log('❌ 管理员账号已存在:', adminEmail);
      console.log('📝 账号信息:');
      console.log('   邮箱:', existingAdmin.email);
      console.log('   姓名:', existingAdmin.name);
      console.log('   角色:', existingAdmin.role);
      console.log('   状态:', existingAdmin.status);
      return;
    }

    // 加密密码
    const hashedPassword = await bcrypt.hash(adminPassword, 12);

    // 创建管理员账号
    const admin = await prisma.user.create({
      data: {
        email: adminEmail,
        name: adminName,
        password: hashedPassword,
        role: 'admin',
        status: 'active',
        emailVerified: true
      }
    });

    console.log('✅ 管理员账号创建成功!');
    console.log('📝 账号信息:');
    console.log('   邮箱:', admin.email);
    console.log('   姓名:', admin.name);
    console.log('   角色:', admin.role);
    console.log('   密码:', adminPassword);
    console.log('');
    console.log('🔐 请使用以下信息登录:');
    console.log('   用户名:', adminEmail);
    console.log('   密码:', adminPassword);
    console.log('');
    console.log('⚠️  请在首次登录后立即修改密码!');

  } catch (error) {
    console.error('❌ 创建管理员账号失败:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// 如果直接运行此文件，则创建管理员
if (require.main === module) {
  createAdminUser()
    .then(() => {
      console.log('🎉 管理员账号创建完成');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 创建失败:', error);
      process.exit(1);
    });
}

export { createAdminUser };
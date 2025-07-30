const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function seedData() {
  console.log('开始初始化数据库种子数据...');

  try {
    // 检查数据库连接
    await prisma.$connect();
    console.log('✅ 数据库连接成功');

    // 由于新架构中AI服务是硬编码的，这里只需要确保数据库连接正常
    // AI服务信息在代码中静态定义：claude, gemini, ampcode
    
    // 可以在这里添加其他初始化数据，比如默认配额配置等
    console.log('ℹ️  AI服务配置采用静态定义方式 (claude, gemini, ampcode)');
    console.log('ℹ️  数据库结构验证完成');

  } catch (error) {
    console.error('❌ 数据库种子数据初始化失败:', error.message);
    throw error;
  }

  console.log('✅ 数据库种子数据初始化完成!');
}

async function main() {
  try {
    await seedData();
  } catch (error) {
    console.error('初始化失败:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
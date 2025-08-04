/**
 * 主数据库种子脚本
 * 初始化数据库并创建示例数据
 */

const { PrismaClient } = require('@prisma/client');
const { seedGroups } = require('./seed-groups');
const { seedEnterprises } = require('./seed-enterprise');

const prisma = new PrismaClient();

async function main() {
  console.log('🚀 开始初始化数据库...');

  try {
    // 检查数据库连接
    await prisma.$connect();
    console.log('✅ 数据库连接成功');

    // 创建企业和用户数据
    await seedEnterprises();

    // 创建示例拼车组
    await seedGroups();

    console.log('🎉 数据库初始化完成！');
    
  } catch (error) {
    console.error('❌ 数据库初始化失败:', error);
    throw error;
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
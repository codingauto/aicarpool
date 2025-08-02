/**
 * 拼车组数据种子脚本
 * 为新用户创建示例拼车组，帮助他们快速了解系统功能
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function seedGroups() {
  console.log('🌱 开始创建拼车组示例数据...');

  try {
    // 检查是否已有拼车组数据
    const existingGroups = await prisma.group.count();
    if (existingGroups > 0) {
      console.log('📋 数据库中已有拼车组数据，跳过种子创建');
      return;
    }

    // 获取第一个用户作为默认创建者
    const firstUser = await prisma.user.findFirst({
      where: { status: 'active' }
    });

    if (!firstUser) {
      console.log('⚠️  没有找到活跃用户，无法创建示例拼车组');
      return;
    }

    console.log(`👤 使用用户 ${firstUser.name} (${firstUser.email}) 作为示例拼车组创建者`);

    // 创建示例拼车组
    const exampleGroups = [
      {
        name: '前端开发组',
        description: '专注于React、Vue等前端技术的开发团队，共享AI资源进行代码生成和优化',
        maxMembers: 10,
        status: 'active'
      },
      {
        name: '后端开发组',
        description: '负责API开发和数据库设计，使用AI辅助后端架构设计和代码审查',
        maxMembers: 8,
        status: 'active'
      },
      {
        name: '产品设计组',
        description: 'UI/UX设计和用户体验优化，利用AI进行设计方案生成和用户反馈分析',
        maxMembers: 6,
        status: 'active'
      }
    ];

    const createdGroups = [];

    for (const groupData of exampleGroups) {
      // 创建拼车组
      const group = await prisma.group.create({
        data: {
          ...groupData,
          createdById: firstUser.id
        }
      });

      // 添加创建者为管理员成员
      await prisma.groupMember.create({
        data: {
          groupId: group.id,
          userId: firstUser.id,
          role: 'admin',
          status: 'active'
        }
      });

      createdGroups.push(group);
      console.log(`✅ 创建拼车组: ${group.name}`);
    }

    // 为部分拼车组创建示例AI服务配置
    if (createdGroups.length > 0) {
      const frontendGroup = createdGroups[0];
      
      // 添加示例AI服务配置
      await prisma.groupAiService.create({
        data: {
          groupId: frontendGroup.id,
          aiServiceId: 'claude',
          isEnabled: true,
          quota: JSON.stringify({
            dailyTokens: 50000,
            monthlyBudget: 300
          }),
          authConfig: JSON.stringify({
            type: 'shared_pool',
            fallbackEnabled: true
          }),
          proxySettings: JSON.stringify({
            enabled: true,
            timeout: 30000
          })
        }
      });

      console.log(`🔧 为 ${frontendGroup.name} 配置了 Claude AI 服务`);
    }

    console.log(`🎉 成功创建了 ${createdGroups.length} 个示例拼车组`);
    console.log('💡 用户现在可以在拼车组列表中看到这些示例，并了解如何使用系统');

  } catch (error) {
    console.error('❌ 创建拼车组种子数据失败:', error);
    throw error;
  }
}

async function main() {
  try {
    await seedGroups();
  } catch (error) {
    console.error('种子脚本执行失败:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  main();
}

module.exports = { seedGroups };
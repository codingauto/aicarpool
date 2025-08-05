const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function seedTestGroups() {
  console.log('🌱 开始创建测试拼车组数据...');

  try {
    // 查找第一个企业和用户
    const enterprise = await prisma.enterprise.findFirst();
    const user = await prisma.user.findFirst();

    if (!enterprise) {
      console.error('❌ 没有找到企业，请先创建企业');
      return;
    }

    if (!user) {
      console.error('❌ 没有找到用户，请先创建用户');
      return;
    }

    console.log(`✅ 找到企业: ${enterprise.name} (${enterprise.id})`);
    console.log(`✅ 找到用户: ${user.name} (${user.id})`);

    // 创建测试拼车组
    const testGroups = [
      {
        name: '技术团队拼车组',
        description: '专为技术团队成员提供的AI资源共享组',
        maxMembers: 10,
        status: 'active',
        enterpriseId: enterprise.id,
        createdById: user.id,
        organizationType: 'enterprise_group',
        bindingMode: 'shared'
      },
      {
        name: '产品团队拼车组',
        description: '产品团队使用Claude和GPT等AI工具的共享组',
        maxMembers: 8,
        status: 'active',
        enterpriseId: enterprise.id,
        createdById: user.id,
        organizationType: 'enterprise_group',
        bindingMode: 'exclusive'
      },
      {
        name: '测试开发组',
        description: '用于测试和开发的低优先级拼车组',
        maxMembers: 5,
        status: 'active',
        enterpriseId: enterprise.id,
        createdById: user.id,
        organizationType: 'enterprise_group',
        bindingMode: 'shared'
      }
    ];

    for (const groupData of testGroups) {
      console.log(`📝 创建拼车组: ${groupData.name}`);
      
      const group = await prisma.group.create({
        data: groupData
      });

      // 添加创建者为管理员成员
      await prisma.groupMember.create({
        data: {
          groupId: group.id,
          userId: user.id,
          role: 'admin',
          status: 'active'
        }
      });

      // 创建资源绑定配置
      await prisma.groupResourceBinding.create({
        data: {
          groupId: group.id,
          bindingMode: groupData.bindingMode,
          bindingConfig: {},
          dailyTokenLimit: 50000,
          monthlyBudget: 200,
          priorityLevel: 'medium',
          warningThreshold: 80,
          alertThreshold: 95
        }
      });

      console.log(`✅ 成功创建拼车组: ${group.name} (${group.id})`);
    }

    console.log('🎉 测试拼车组数据创建完成！');

  } catch (error) {
    console.error('❌ 创建测试数据失败:', error);
  } finally {
    await prisma.$disconnect();
  }
}

seedTestGroups();
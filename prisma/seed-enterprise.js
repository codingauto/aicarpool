/**
 * 企业和用户数据种子脚本
 * 创建测试用户、企业和相关关系数据
 */

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function seedEnterprises() {
  console.log('🏢 开始创建企业和用户示例数据...');

  try {
    // 检查是否已有企业数据
    const existingEnterprises = await prisma.enterprise.count();
    if (existingEnterprises > 0) {
      console.log('📋 数据库中已有企业数据，但继续检查用户-企业关系...');
    }

    // 创建测试用户
    const users = [
      {
        id: 'user_test_001',
        email: 'test@example.com',
        name: '测试用户',
        password: await bcrypt.hash('123456', 10),
        role: 'user',
        status: 'active'
      },
      {
        id: 'admin_001',
        email: 'admin@aicarpool.com',
        name: '系统管理员',
        password: await bcrypt.hash('admin123456', 10),
        role: 'admin',
        status: 'active'
      },
      {
        id: 'owner_001',
        email: 'owner@example.com',
        name: '企业所有者',
        password: await bcrypt.hash('owner123456', 10),
        role: 'user',
        status: 'active'
      }
    ];

    // 创建用户
    for (const userData of users) {
      const existingUser = await prisma.user.findUnique({
        where: { email: userData.email }
      });

      if (!existingUser) {
        await prisma.user.create({ data: userData });
        console.log(`✅ 创建用户: ${userData.name} (${userData.email})`);
      } else {
        console.log(`📋 用户已存在: ${userData.name} (${userData.email})`);
      }
    }

    // 创建示例企业
    const enterprises = [
      {
        id: 'cmdvk08gt0000rfsvwbj5o9oe',
        name: '示例科技公司',
        planType: 'professional',
        organizationType: 'enterprise',
        uiTheme: 'professional',
        featureSet: {
          ai_resources: true,
          group_management: true,
          analytics: true,
          permissions: true
        },
        settings: {
          limits: {
            maxGroups: 50,
            maxMembers: 200,
            maxAiAccounts: 20
          }
        }
      },
      {
        id: 'enterprise_002',
        name: '创新设计工作室',
        planType: 'basic',
        organizationType: 'enterprise',
        uiTheme: 'creative',
        featureSet: {
          ai_resources: true,
          group_management: true,
          analytics: false
        },
        settings: {
          limits: {
            maxGroups: 20,
            maxMembers: 50,
            maxAiAccounts: 10
          }
        }
      }
    ];

    // 创建企业
    for (const enterpriseData of enterprises) {
      const existingEnterprise = await prisma.enterprise.findUnique({
        where: { id: enterpriseData.id }
      });

      if (!existingEnterprise) {
        await prisma.enterprise.create({ data: enterpriseData });
        console.log(`✅ 创建企业: ${enterpriseData.name}`);
      } else {
        console.log(`📋 企业已存在: ${enterpriseData.name}`);
      }
    }

    // 创建用户-企业关系
    const userEnterprises = [
      {
        userId: 'user_test_001',
        enterpriseId: 'cmdvk08gt0000rfsvwbj5o9oe',
        role: 'member',
        isActive: true,
        permissions: JSON.stringify([
          'enterprise.view',
          'ai_resources.view',
          'groups.view',
          'groups.create',
          'groups.manage_own'
        ])
      },
      {
        userId: 'admin_001',
        enterpriseId: 'cmdvk08gt0000rfsvwbj5o9oe',
        role: 'admin',
        isActive: true,
        permissions: JSON.stringify([
          'enterprise.view',
          'enterprise.manage',
          'ai_resources.view',
          'ai_resources.manage',
          'groups.view',
          'groups.create',
          'groups.manage',
          'users.view',
          'users.manage',
          'analytics.view'
        ])
      },
      {
        userId: 'owner_001',
        enterpriseId: 'cmdvk08gt0000rfsvwbj5o9oe',
        role: 'owner',
        isActive: true,
        permissions: JSON.stringify([
          'enterprise.view',
          'enterprise.manage',
          'enterprise.delete',
          'ai_resources.view',
          'ai_resources.manage',
          'groups.view',
          'groups.create',
          'groups.manage',
          'users.view',
          'users.manage',
          'users.invite',
          'analytics.view',
          'settings.manage'
        ])
      },
      {
        userId: 'admin_001',
        enterpriseId: 'enterprise_002',
        role: 'owner',
        isActive: true,
        permissions: JSON.stringify([
          'enterprise.view',
          'enterprise.manage',
          'ai_resources.view',
          'ai_resources.manage',
          'groups.view',
          'groups.create',
          'groups.manage',
          'users.view',
          'users.manage'
        ])
      }
    ];

    // 创建用户-企业关系
    for (const relation of userEnterprises) {
      const existing = await prisma.userEnterprise.findFirst({
        where: {
          userId: relation.userId,
          enterpriseId: relation.enterpriseId
        }
      });

      if (!existing) {
        await prisma.userEnterprise.create({ data: relation });
        const user = await prisma.user.findUnique({ where: { id: relation.userId } });
        const enterprise = await prisma.enterprise.findUnique({ where: { id: relation.enterpriseId } });
        console.log(`✅ 关联用户到企业: ${user?.name} -> ${enterprise?.name} (${relation.role})`);
      }
    }

    // 创建示例AI服务账号
    const aiAccounts = [
      {
        id: 'ai_account_001',
        enterpriseId: 'cmdvk08gt0000rfsvwbj5o9oe',
        name: 'Claude主账号',
        description: '企业主要的Claude AI服务账号',
        serviceType: 'claude',
        accountType: 'shared',
        authType: 'api_key',
        encryptedCredentials: JSON.stringify({
          apiKey: 'sk-ant-api03-...',
          apiSecret: null
        }),
        apiEndpoint: 'https://api.anthropic.com',
        supportedModels: ['claude-3-sonnet', 'claude-3-haiku'],
        currentModel: 'claude-3-sonnet',
        dailyLimit: 10000,
        costPerToken: 0.00003,
        totalRequests: 1250,
        totalTokens: 485000,
        totalCost: 14.55,
        currentLoad: 25,
        status: 'active',
        isEnabled: true,
        lastUsedAt: new Date()
      },
      {
        id: 'ai_account_002',
        enterpriseId: 'cmdvk08gt0000rfsvwbj5o9oe',
        name: 'OpenAI备用账号',
        description: '备用的OpenAI GPT服务账号',
        serviceType: 'openai',
        accountType: 'dedicated',
        authType: 'api_key',
        encryptedCredentials: JSON.stringify({
          apiKey: 'sk-...',
          apiSecret: null
        }),
        apiEndpoint: 'https://api.openai.com/v1',
        supportedModels: ['gpt-4', 'gpt-3.5-turbo'],
        currentModel: 'gpt-4',
        dailyLimit: 5000,
        costPerToken: 0.00006,
        totalRequests: 890,
        totalTokens: 234000,
        totalCost: 14.04,
        currentLoad: 15,
        status: 'active',
        isEnabled: true,
        lastUsedAt: new Date(Date.now() - 2 * 60 * 60 * 1000) // 2小时前
      }
    ];

    // 创建AI服务账号
    for (const accountData of aiAccounts) {
      const existing = await prisma.aiServiceAccount.findUnique({
        where: { id: accountData.id }
      });

      if (!existing) {
        await prisma.aiServiceAccount.create({ data: accountData });
        console.log(`✅ 创建AI账号: ${accountData.name} (${accountData.serviceType})`);
      }
    }

    // 创建使用统计数据
    const usageStats = [
      {
        accountId: 'ai_account_001',
        requestTime: new Date(),
        totalTokens: 1500,
        cost: 0.045,
        responseTime: 850,
        status: 'success',
        groupId: null
      },
      {
        accountId: 'ai_account_001',
        requestTime: new Date(Date.now() - 60 * 60 * 1000), // 1小时前
        totalTokens: 2200,
        cost: 0.066,
        responseTime: 920,
        status: 'success',
        groupId: null
      },
      {
        accountId: 'ai_account_002',
        requestTime: new Date(Date.now() - 30 * 60 * 1000), // 30分钟前
        totalTokens: 1800,
        cost: 0.108,
        responseTime: 1200,
        status: 'success',
        groupId: null
      }
    ];

    // 创建使用统计
    for (const stat of usageStats) {
      await prisma.usageStat.create({ data: stat });
    }

    // 创建健康检查记录
    const healthChecks = [
      {
        accountId: 'ai_account_001',
        isHealthy: true,
        responseTime: 850,
        errorMessage: null,
        checkedAt: new Date()
      },
      {
        accountId: 'ai_account_002',
        isHealthy: true,
        responseTime: 1200,
        errorMessage: null,
        checkedAt: new Date(Date.now() - 5 * 60 * 1000) // 5分钟前
      }
    ];

    // 创建健康检查记录
    for (const check of healthChecks) {
      await prisma.accountHealthCheck.create({ data: check });
    }

    console.log('🎉 企业和用户数据初始化完成！');
    console.log('📝 创建的测试账号:');
    console.log('   - test@example.com / 123456 (普通用户)');
    console.log('   - admin@aicarpool.com / admin123456 (管理员)');
    console.log('   - owner@example.com / owner123456 (企业所有者)');

  } catch (error) {
    console.error('❌ 创建企业种子数据失败:', error);
    throw error;
  }
}

async function main() {
  try {
    await seedEnterprises();
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

module.exports = { seedEnterprises };
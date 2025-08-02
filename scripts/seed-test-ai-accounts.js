/**
 * 为测试企业创建一些AI账号和使用数据
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function createTestAiAccounts() {
  try {
    console.log('🚀 开始创建测试AI账号...');

    // 查找测试企业
    const enterprise = await prisma.enterprise.findFirst({
      where: {
        name: {
          contains: '创新科技'
        }
      }
    });

    if (!enterprise) {
      console.log('❌ 未找到测试企业');
      return;
    }

    console.log(`✅ 找到企业: ${enterprise.name} (${enterprise.id})`);

    // 创建测试AI账号
    const aiAccounts = [
      {
        name: 'Claude-3 主账号',
        description: '企业主要的Claude-3 Sonnet账号',
        serviceType: 'claude',
        accountType: 'dedicated',
        authType: 'api_key',
        encryptedCredentials: JSON.stringify({ apiKey: 'sk-test-claude-key-123' }),
        supportedModels: ['claude-3-sonnet', 'claude-3-haiku'],
        currentModel: 'claude-3-sonnet',
        dailyLimit: 10000,
        costPerToken: 0.00003,
        isEnabled: true,
        status: 'active',
        currentLoad: 45,
        totalRequests: BigInt(2500),
        totalTokens: BigInt(125000),
        totalCost: 37.5
      },
      {
        name: 'OpenAI GPT-4 账号',
        description: '用于复杂任务的GPT-4账号',
        serviceType: 'openai',
        accountType: 'shared',
        authType: 'api_key',
        encryptedCredentials: JSON.stringify({ apiKey: 'sk-test-openai-key-456' }),
        supportedModels: ['gpt-4', 'gpt-4-turbo'],
        currentModel: 'gpt-4',
        dailyLimit: 5000,
        costPerToken: 0.00006,
        isEnabled: true,
        status: 'active',
        currentLoad: 32,
        totalRequests: BigInt(1200),
        totalTokens: BigInt(80000),
        totalCost: 48.0
      },
      {
        name: 'Gemini Pro 账号',
        description: 'Google Gemini Pro服务账号',
        serviceType: 'gemini',
        accountType: 'shared',
        authType: 'api_key',
        encryptedCredentials: JSON.stringify({ apiKey: 'test-gemini-key-789' }),
        supportedModels: ['gemini-pro', 'gemini-pro-vision'],
        currentModel: 'gemini-pro',
        dailyLimit: 8000,
        costPerToken: 0.00002,
        isEnabled: true,
        status: 'active',
        currentLoad: 67,
        totalRequests: BigInt(800),
        totalTokens: BigInt(60000),
        totalCost: 12.0
      },
      {
        name: '通义千问 测试账号',
        description: '阿里云通义千问API账号',
        serviceType: 'qwen',
        accountType: 'shared',
        authType: 'api_key',
        encryptedCredentials: JSON.stringify({ apiKey: 'test-qwen-key-101' }),
        supportedModels: ['qwen-turbo', 'qwen-plus'],
        currentModel: 'qwen-turbo',
        dailyLimit: 12000,
        costPerToken: 0.00001,
        isEnabled: false,
        status: 'inactive',
        currentLoad: 0,
        totalRequests: BigInt(150),
        totalTokens: BigInt(15000),
        totalCost: 1.5
      }
    ];

    // 创建AI账号
    const createdAccounts = [];
    for (const accountData of aiAccounts) {
      const account = await prisma.aiServiceAccount.create({
        data: {
          ...accountData,
          enterpriseId: enterprise.id
        }
      });
      createdAccounts.push(account);
      console.log(`✅ 创建AI账号: ${account.name}`);
    }

    // 查找企业的拼车组
    const groups = await prisma.group.findMany({
      where: { enterpriseId: enterprise.id }
    });

    if (groups.length === 0) {
      console.log('⚠️ 企业没有拼车组，跳过创建绑定关系');
    } else {
      // 为拼车组绑定AI账号
      for (let i = 0; i < Math.min(groups.length, createdAccounts.length); i++) {
        const group = groups[i];
        const account = createdAccounts[i];
        
        await prisma.groupAccountBinding.create({
          data: {
            groupId: group.id,
            accountId: account.id,
            priority: i + 1,
            weight: 100 - (i * 20),
            isActive: account.isEnabled
          }
        });
        
        console.log(`✅ 绑定账号 ${account.name} 到拼车组 ${group.name}`);
      }
    }

    // 创建一些使用统计数据
    const today = new Date();
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
    
    for (const account of createdAccounts) {
      if (!account.isEnabled) continue;
      
      // 为每个账号创建一些今日使用记录
      const usageCount = Math.floor(Math.random() * 50) + 10;
      
      for (let i = 0; i < usageCount; i++) {
        const requestTime = new Date(today.getTime() + Math.random() * 24 * 60 * 60 * 1000);
        const tokens = Math.floor(Math.random() * 2000) + 100;
        const cost = tokens * Number(account.costPerToken);
        
        const groupId = groups.length > 0 ? groups[Math.floor(Math.random() * groups.length)].id : null;
        
        await prisma.usageStat.create({
          data: {
            userId: 'cmdu0npxh0000rfc3t2utuwuu', // 使用真实的用户ID
            groupId: groupId || 'grp_001',
            aiServiceId: account.serviceType,
            accountId: account.id,
            enterpriseId: enterprise.id,
            requestType: 'chat',
            cost: cost,
            requestTime: requestTime,
            responseTime: Math.floor(Math.random() * 2000) + 200,
            status: 'success',
            requestTokens: tokens,
            responseTokens: Math.floor(tokens * 1.2),
            totalTokens: Math.floor(tokens * 2.2)
          }
        });
      }
      
      console.log(`✅ 为账号 ${account.name} 创建了 ${usageCount} 条使用记录`);
    }

    console.log('🎉 测试数据创建完成！');

  } catch (error) {
    console.error('❌ 创建测试数据失败:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createTestAiAccounts();
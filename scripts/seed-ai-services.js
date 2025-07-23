const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function seedAiServices() {
  console.log('开始初始化AI服务数据...');

  const aiServices = [
    {
      serviceName: 'claude',
      displayName: 'Claude',
      description: 'Anthropic Claude - 强大的AI助手，擅长代码理解和生成',
      baseUrl: 'https://api.anthropic.com',
      isEnabled: true,
      rateLimits: {
        requestsPerMinute: 60,
        tokensPerDay: 100000
      }
    },
    {
      serviceName: 'gemini',
      displayName: 'Gemini',
      description: 'Google Gemini - 高性价比的多模态AI模型',
      baseUrl: 'https://generativelanguage.googleapis.com',
      isEnabled: true,
      rateLimits: {
        requestsPerMinute: 60,
        tokensPerDay: 200000
      }
    },
    {
      serviceName: 'ampcode',
      displayName: 'AmpCode',
      description: 'AmpCode - 专注于代码生成和优化的AI工具',
      baseUrl: 'https://api.ampcode.com',
      isEnabled: false,
      rateLimits: {
        requestsPerMinute: 30,
        tokensPerDay: 50000
      }
    }
  ];

  for (const service of aiServices) {
    try {
      const existingService = await prisma.aiService.findUnique({
        where: { serviceName: service.serviceName }
      });

      if (!existingService) {
        const created = await prisma.aiService.create({
          data: service
        });
        console.log(`✅ 创建AI服务: ${created.displayName}`);
      } else {
        console.log(`ℹ️  AI服务已存在: ${existingService.displayName}`);
      }
    } catch (error) {
      console.error(`❌ 创建AI服务失败 ${service.displayName}:`, error.message);
    }
  }

  console.log('AI服务数据初始化完成!');
}

async function main() {
  try {
    await seedAiServices();
  } catch (error) {
    console.error('初始化失败:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
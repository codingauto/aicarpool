/**
 * 为 aicarpool 添加 Claude Code 服务的种子数据脚本
 */
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  console.log('🚀 开始添加 Claude Code 服务...');

  try {
    // 检查是否已存在 claude-code 服务
    const existingService = await prisma.aiService.findUnique({
      where: { serviceName: 'claude-code' }
    });

    if (existingService) {
      console.log('✅ Claude Code 服务已存在，更新配置...');
      
      const updatedService = await prisma.aiService.update({
        where: { serviceName: 'claude-code' },
        data: {
          displayName: 'Claude Code CLI',
          description: 'Official Claude Code CLI proxy service with advanced features',
          baseUrl: 'https://api.anthropic.com/v1',
          isEnabled: true,
          rateLimits: {
            maxRequestsPerMinute: 60,
            maxTokensPerMinute: 50000,
            maxRequestsPerDay: 5000,
            maxTokensPerDay: 1000000
          }
        }
      });

      console.log(`✅ 已更新 Claude Code 服务: ${updatedService.id}`);
    } else {
      console.log('➕ 创建新的 Claude Code 服务...');
      
      const newService = await prisma.aiService.create({
        data: {
          serviceName: 'claude-code',
          displayName: 'Claude Code CLI',
          description: 'Official Claude Code CLI proxy service with advanced features',
          baseUrl: 'https://api.anthropic.com/v1',
          isEnabled: true,
          rateLimits: {
            maxRequestsPerMinute: 60,
            maxTokensPerMinute: 50000,
            maxRequestsPerDay: 5000,
            maxTokensPerDay: 1000000
          }
        }
      });

      console.log(`✅ 已创建 Claude Code 服务: ${newService.id}`);
    }

    // 添加 Claude Code 支持的模型
    const models = [
      {
        modelName: 'claude-3-5-sonnet-20241022',
        displayName: 'Claude 3.5 Sonnet',
        description: 'Latest Claude 3.5 Sonnet model with enhanced capabilities',
        inputCost: 0.000015, // $0.015 per 1K tokens
        outputCost: 0.000075, // $0.075 per 1K tokens
        maxTokens: 8192,
        isEnabled: true,
        metadata: {
          features: ['tools', 'files', 'streaming', 'cache'],
          contextWindow: 200000,
          recommended: true
        }
      },
      {
        modelName: 'claude-3-5-haiku-20241022',
        displayName: 'Claude 3.5 Haiku',
        description: 'Fast and efficient Claude 3.5 Haiku model',
        inputCost: 0.000008, // $0.008 per 1K tokens
        outputCost: 0.000024, // $0.024 per 1K tokens
        maxTokens: 8192,
        isEnabled: true,
        metadata: {
          features: ['tools', 'streaming'],
          contextWindow: 200000,
          speed: 'fast'
        }
      },
      {
        modelName: 'claude-sonnet-4-20250514',
        displayName: 'Claude 4 Sonnet',
        description: 'Latest Claude 4 Sonnet model (beta)',
        inputCost: 0.000020, // $0.020 per 1K tokens
        outputCost: 0.000100, // $0.100 per 1K tokens
        maxTokens: 8192,
        isEnabled: true,
        metadata: {
          features: ['tools', 'files', 'streaming', 'cache', 'memory'],
          contextWindow: 200000,
          version: 'beta',
          recommended: false
        }
      }
    ];

    const service = await prisma.aiService.findUnique({
      where: { serviceName: 'claude-code' }
    });

    for (const modelData of models) {
      const existingModel = await prisma.aiServiceModel.findUnique({
        where: {
          aiServiceId_modelName: {
            aiServiceId: service.id,
            modelName: modelData.modelName
          }
        }
      });

      if (existingModel) {
        console.log(`🔄 更新模型: ${modelData.modelName}`);
        await prisma.aiServiceModel.update({
          where: { id: existingModel.id },
          data: modelData
        });
      } else {
        console.log(`➕ 创建模型: ${modelData.modelName}`);
        await prisma.aiServiceModel.create({
          data: {
            ...modelData,
            aiServiceId: service.id
          }
        });
      }
    }

    console.log('✅ Claude Code 服务和模型配置完成！');
    console.log('\n📋 服务信息:');
    console.log(`- 服务名称: claude-code`);
    console.log(`- 显示名称: Claude Code CLI`);
    console.log(`- 支持的模型: ${models.length} 个`);
    console.log(`- 基础 URL: https://api.anthropic.com/v1`);
    console.log('\n🔧 下一步:');
    console.log('1. 在组设置中启用 Claude Code 服务');
    console.log('2. 为 Claude Code 服务创建 API Key');
    console.log('3. 配置边缘节点支持 Claude Code 代理');

  } catch (error) {
    console.error('❌ 添加 Claude Code 服务失败:', error);
    process.exit(1);
  }
}

main()
  .catch((e) => {
    console.error('❌ 脚本执行失败:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
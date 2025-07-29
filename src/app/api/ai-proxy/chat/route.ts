import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { createApiResponse } from '@/lib/middleware';
import { AIServiceFactory, SupportedAIService } from '@/lib/ai-services/factory';
import { ChatRequest } from '@/lib/ai-services/base';
import { aiServiceRouter } from '@/lib/ai-services/router';

const chatRequestSchema = z.object({
  messages: z.array(z.object({
    role: z.enum(['system', 'user', 'assistant']),
    content: z.string(),
  })),
  model: z.string().optional(),
  maxTokens: z.number().optional(),
  temperature: z.number().min(0).max(2).optional(),
  routingStrategy: z.enum(['round_robin', 'priority', 'least_connections', 'response_time']).optional(),
  preferredService: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    // 从请求头获取API密钥
    const apiKey = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!apiKey) {
      return createApiResponse(false, null, '请提供API密钥', 401);
    }

    // 验证API密钥并获取相关信息
    const apiKeyRecord = await prisma.apiKey.findUnique({
      where: { 
        key: apiKey,
        status: 'active',
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            status: true,
          },
        },
        group: {
          select: {
            id: true,
            name: true,
            status: true,
          },
        },
      },
    });

    if (!apiKeyRecord) {
      return createApiResponse(false, null, 'API密钥无效', 401);
    }

    // 检查用户和组状态
    if (apiKeyRecord.user.status !== 'active') {
      return createApiResponse(false, null, '用户账户已被禁用', 403);
    }

    if (apiKeyRecord.group.status !== 'active') {
      return createApiResponse(false, null, '拼车组已被禁用', 403);
    }

    // 静态AI服务信息
    const staticAiServices = {
      claude: {
        id: 'claude',
        serviceName: 'claude',
        displayName: 'Claude Code',
        baseUrl: 'https://api.anthropic.com',
        isEnabled: true,
      },
      gemini: {
        id: 'gemini',
        serviceName: 'gemini',
        displayName: 'Gemini CLI',
        baseUrl: 'https://generativelanguage.googleapis.com',
        isEnabled: true,
      },
      ampcode: {
        id: 'ampcode',
        serviceName: 'ampcode',
        displayName: 'AmpCode',
        baseUrl: 'https://api.ampcode.com',
        isEnabled: true,
      },
    };

    const aiServiceInfo = staticAiServices[apiKeyRecord.aiServiceId as keyof typeof staticAiServices];
    if (!aiServiceInfo || !aiServiceInfo.isEnabled) {
      return createApiResponse({ error: 'AI服务已被禁用' }, false, 403);
    }

    // 检查配额
    if (apiKeyRecord.quotaLimit && apiKeyRecord.quotaUsed >= apiKeyRecord.quotaLimit) {
      return createApiResponse(false, null, '配额已用完', 429);
    }

    // 解析请求体
    const body = await request.json();
    const validatedData = chatRequestSchema.parse(body);

    // 获取组的AI服务配置
    const groupAiService = await prisma.groupAiService.findFirst({
      where: {
        groupId: apiKeyRecord.group.id,
        aiServiceId: apiKeyRecord.aiServiceId,
        isEnabled: true,
      },
    });

    if (!groupAiService || !groupAiService.authConfig) {
      return createApiResponse({ error: '拼车组未配置该AI服务' }, false, 400);
    }

    const authConfig = groupAiService.authConfig as Record<string, unknown>;
    if (!authConfig.apiKey) {
      return createApiResponse({ error: 'AI服务未配置API密钥' }, false, 400);
    }

    // 创建AI服务实例
    const aiService = AIServiceFactory.create(
      aiServiceInfo.serviceName as SupportedAIService,
      {
        apiKey: authConfig.apiKey as string,
        baseUrl: aiServiceInfo.baseUrl,
        timeout: 30000,
      }
    );

    const startTime = Date.now();

    try {
      // 调用AI服务
      const response = await aiService.chat(validatedData as ChatRequest);
      const endTime = Date.now();
      const responseTime = endTime - startTime;

      // 计算成本
      const cost = aiService.calculateCost(response.usage, response.model);

      // 记录使用统计
      await prisma.$transaction(async (tx) => {
        // 创建使用记录
        await tx.usageStat.create({
          data: {
            userId: apiKeyRecord.user.id,
            groupId: apiKeyRecord.group.id,
            aiServiceId: apiKeyRecord.aiServiceId,
            requestType: 'chat',
            tokenCount: BigInt(response.usage.totalTokens),
            cost: cost,
            requestTime: new Date(startTime),
            responseTime: responseTime,
            status: 'success',
            metadata: {
              model: response.model,
              promptTokens: response.usage.promptTokens,
              completionTokens: response.usage.completionTokens,
              apiKeyId: apiKeyRecord.id,
            },
          },
        });

        // 更新API密钥使用量
        await tx.apiKey.update({
          where: { id: apiKeyRecord.id },
          data: {
            quotaUsed: {
              increment: BigInt(response.usage.totalTokens),
            },
            lastUsedAt: new Date(),
          },
        });
      });

      return createApiResponse(response, true, 200);

    } catch (aiError) {
      const endTime = Date.now();
      const responseTime = endTime - startTime;

      console.error('AI service error:', aiError);

      // 记录错误统计
      await prisma.usageStat.create({
        data: {
          userId: apiKeyRecord.user.id,
          groupId: apiKeyRecord.group.id,
          aiServiceId: apiKeyRecord.aiServiceId,
          requestType: 'chat',
          tokenCount: BigInt(0),
          cost: 0,
          requestTime: new Date(startTime),
          responseTime: responseTime,
          status: 'error',
          errorCode: aiError instanceof Error ? aiError.message : 'unknown_error',
          metadata: {
            apiKeyId: apiKeyRecord.id,
            error: aiError instanceof Error ? aiError.message : 'Unknown error',
          },
        },
      });

      const errorMessage = aiError instanceof Error ? aiError.message : 'AI服务调用失败';
      return createApiResponse({ error: errorMessage }, false, 500);
    }

  } catch (error) {
    if (error instanceof z.ZodError) {
      return createApiResponse({ error: error.errors[0].message }, false, 400);
    }

    console.error('Chat proxy error:', error);
    return createApiResponse({ error: '请求处理失败' }, false, 500);
  }
}
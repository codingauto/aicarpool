import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { createApiResponse } from '@/lib/middleware';
// 临时注释掉旧的引用，将迁移到新架构
// import { AIServiceFactory, SupportedAIService } from '@/lib/ai-services/factory';
// import { ChatRequest } from '@/lib/ai-services/base';
// import { EnhancedAiServiceRouter } from '@/lib/ai-services/enhanced-router';

// 新架构的引用
import { AiServiceClient, AiRequest } from '@/lib/ai-platforms/ai-service-client';
import { ServiceType } from '@/lib/ai-platforms/platform-configs';

// 导入限流模块
import { checkApiKeyLimits, updateApiKeyUsage } from '@/lib/rate-limit';
import { checkGroupQuota, updateGroupUsage } from '@/lib/rate-limit';

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
    // 检查是否启用优化路由
    const ENABLE_OPTIMIZED_ROUTER = process.env.ENABLE_OPTIMIZED_ROUTER === 'true';
    
    if (!ENABLE_OPTIMIZED_ROUTER) {
      // 临时返回维护中状态，直到新架构迁移完成
      return createApiResponse(false, null, 'AI Proxy正在升级中，暂时不可用', 503);
    }
    
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
    if (apiKeyRecord && apiKeyRecord.user?.status !== 'active') {
      return createApiResponse(false, null, '用户账户已被禁用', 403);
    }

    if (apiKeyRecord && apiKeyRecord.group?.status !== 'active') {
      return createApiResponse(false, null, '拼车组已被禁用', 403);
    }

    // 解析请求体获取预估Token数
    const body = await request.json();
    const validatedData = chatRequestSchema.parse(body);
    
    // 预估Token使用量（简单估算）
    let estimatedTokens = 100; // 基础响应
    if (validatedData.messages) {
      estimatedTokens += validatedData.messages.reduce((acc, msg) => 
        acc + Math.ceil(msg.content.length / 4), 0); // 粗略估算：4字符=1token
    }
    
    // 预估费用（根据模型）
    let estimatedCost = 0.002; // 默认费用
    if (validatedData.model?.includes('gpt-4')) {
      estimatedCost = estimatedTokens * 0.00003;
    } else if (validatedData.model?.includes('claude')) {
      estimatedCost = estimatedTokens * 0.00002;
    } else {
      estimatedCost = estimatedTokens * 0.000002;
    }

    // 检查API密钥限流
    const rateLimitResult = await checkApiKeyLimits(
      apiKeyRecord.id,
      apiKeyRecord,
      estimatedTokens,
      estimatedCost
    );

    if (!rateLimitResult.allowed) {
      return createApiResponse(false, null, rateLimitResult.reason || '请求被限流', 429, {
        headers: rateLimitResult.headers
      });
    }

    // 检查拼车组配额
    if (apiKeyRecord.group) {
      const groupQuotaResult = await checkGroupQuota(
        apiKeyRecord.group.id,
        estimatedTokens,
        estimatedCost
      );

      if (!groupQuotaResult.allowed) {
        return createApiResponse(false, null, groupQuotaResult.reason || '拼车组配额不足', 429);
      }
    }

    // 静态AI服务信息
    const staticAiServices = {
      claude: {
        id: 'claude',
        serviceName: 'claude',
        displayName: 'Claude Code',
        baseUrl: 'https://api.anthropic.com',
        isEnabled: true,
        platform: 'claude_code' as const,
      },
      gemini: {
        id: 'gemini',
        serviceName: 'gemini',
        displayName: 'Gemini CLI',
        baseUrl: 'https://generativelanguage.googleapis.com',
        isEnabled: true,
        platform: 'gemini' as const,
      },
      ampcode: {
        id: 'ampcode',
        serviceName: 'ampcode',
        displayName: 'AmpCode',
        baseUrl: 'https://api.ampcode.com',
        isEnabled: true,
        platform: 'ampcode' as const,
      },
    };

    // 从 apiKey 的 permissions 字段获取服务类型，默认为 claude
    const serviceId = apiKeyRecord?.permissions || 'claude';
    const aiServiceInfo = staticAiServices[serviceId as keyof typeof staticAiServices] || staticAiServices.claude;
    if (!aiServiceInfo || !aiServiceInfo.isEnabled) {
      return createApiResponse(false, null, 'AI服务已被禁用', 403);
    }

    // 旧的配额检查已被Redis限流替代
    // 保留向后兼容
    if (apiKeyRecord && apiKeyRecord.quotaLimit && apiKeyRecord.quotaUsed && apiKeyRecord.quotaUsed >= apiKeyRecord.quotaLimit) {
      return createApiResponse(false, null, '配额已用完', 429);
    }

    // 检查服务类型以决定使用哪种路由策略
    const serviceType = aiServiceInfo.serviceType;
    const startTime = Date.now();
    
    let response: any = null;
    let cost = 0;

    try {
      if (serviceType === 'claude_code') {
        // Claude Code CLI使用多模型路由
        // 临时禁用增强路由器，使用基础版本
        response = {
          message: {
            role: 'assistant' as const,
            content: 'Claude Code 智能路由器正在维护中'
          },
          usage: {
            promptTokens: 100,
            completionTokens: 50,
            totalTokens: 150
          },
          model: 'claude-3-sonnet',
          cost: 0.01
        };
        /*
        // 保留原代码供之后恢复
        const enhancedRouter = new EnhancedAiServiceRouter();
        await enhancedRouter.initializeMultiModelRoutes(apiKeyRecord?.group?.id || '');
        response = await enhancedRouter.routeToOptimalModel(
          apiKeyRecord?.group?.id || '',
          validatedData as ChatRequest,
          serviceType
        );
        
        // 模拟成本计算 - 实际实现中需要根据具体使用的模型计算
        cost = response.usage.totalTokens * 0.00002; // 临时费率
        */
        
      } else {
        // Gemini CLI和AmpCode CLI使用原有逻辑
        const groupAiService = await prisma.groupAiService.findFirst({
          where: {
            groupId: apiKeyRecord?.group?.id || '',
            aiServiceId: serviceId,
            isEnabled: true,
          },
        });

        if (!groupAiService || !groupAiService.authConfig) {
          return createApiResponse(false, null, '拼车组未配置该AI服务', 400);
        }

        const authConfig = groupAiService.authConfig as Record<string, unknown>;
        if (!authConfig.apiKey) {
          return createApiResponse(false, null, 'AI服务未配置API密钥', 400);
        }

        // 暂时返回模拟响应，待AIServiceFactory实现
        response = {
          message: {
            role: 'assistant' as const,
            content: `${aiServiceInfo.displayName} 服务正在维护中`
          },
          usage: {
            promptTokens: 100,
            completionTokens: 50,
            totalTokens: 150
          },
          model: 'default',
          cost: 0.01
        };
        
        // 计算成本
        cost = response.cost || 0.01;
      }

      const endTime = Date.now();
      const responseTime = endTime - startTime;

      // 更新Redis限流计数器
      const actualTokens = response?.usage?.totalTokens || estimatedTokens;
      const actualCost = cost || estimatedCost;
      
      await Promise.all([
        // 更新API密钥使用量
        updateApiKeyUsage(apiKeyRecord.id, {
          tokens: actualTokens,
          cost: actualCost,
          requests: 1
        }),
        // 更新拼车组使用量
        apiKeyRecord.group && updateGroupUsage(apiKeyRecord.group.id, {
          tokens: actualTokens,
          cost: actualCost
        })
      ]);

      // 记录使用统计
      await prisma.$transaction(async (tx) => {
        // 创建使用记录
        await tx.usageStat.create({
          data: {
            userId: apiKeyRecord?.user?.id || '',
            groupId: apiKeyRecord?.group?.id || '',
            aiServiceId: serviceId,
            requestType: 'chat',
            totalTokens: BigInt(response?.usage?.totalTokens || 0),
            cost: cost,
            requestTime: new Date(startTime),
            responseTime: responseTime,
            status: 'success',
            metadata: {
              model: response.model,
              promptTokens: response.usage.promptTokens,
              completionTokens: response.usage.completionTokens,
              apiKeyId: apiKeyRecord?.id || '',
            },
          },
        });

        // 更新API密钥使用量
        await tx.apiKey.update({
          where: { id: apiKeyRecord?.id || '' },
          data: {
            quotaUsed: {
              increment: BigInt(response?.usage?.totalTokens || 0),
            },
            lastUsedAt: new Date(),
          },
        });
      });

      // 返回响应，包含限流头信息
      const responseHeaders = rateLimitResult?.headers || {};
      return new Response(
        JSON.stringify(createApiResponse(true, response, 'AI服务调用成功', 200)),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            ...responseHeaders
          }
        }
      );

    } catch (aiError) {
      const endTime = Date.now();
      const responseTime = endTime - startTime;

      console.error('AI service error:', aiError);

      // 记录错误统计
      if (apiKeyRecord) {
        await prisma.usageStat.create({
          data: {
            userId: apiKeyRecord.user?.id || '',
            groupId: apiKeyRecord.group?.id || '',
            aiServiceId: serviceId,
            requestType: 'chat',
            totalTokens: BigInt(0),
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
      }

      const errorMessage = aiError instanceof Error ? aiError.message : 'AI服务调用失败';
      return createApiResponse(false, null, errorMessage, 500);
    }

  } catch (error) {
    if (error instanceof z.ZodError) {
      return createApiResponse(false, null, error.issues[0].message, 400);
    }

    console.error('Chat proxy error:', error);
    return createApiResponse(false, null, '请求处理失败', 500);
  }
}
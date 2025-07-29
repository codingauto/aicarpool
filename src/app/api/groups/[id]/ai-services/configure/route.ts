import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { createApiResponse } from '@/lib/middleware';
import { verifyToken } from '@/lib/auth';

const aiServiceConfigSchema = z.object({
  aiServiceId: z.string(),
  isEnabled: z.boolean(),
  priority: z.number().int().min(1).max(100).default(1),
  quota: z.object({
    dailyTokenLimit: z.number().int().min(0).optional(),
    monthlyTokenLimit: z.number().int().min(0).optional(),
    dailyCostLimit: z.number().min(0).optional(),
    monthlyCostLimit: z.number().min(0).optional(),
    userDailyTokenLimit: z.number().int().min(0).optional(),
    userMonthlyTokenLimit: z.number().int().min(0).optional(),
  }).optional(),
  authConfig: z.object({
    apiKey: z.string().min(1),
  }),
  proxySettings: z.object({
    enableProxy: z.boolean().default(false),
    proxyType: z.enum(['none', 'static', 'pool']).default('none'),
    staticProxyId: z.string().optional(),
    routingStrategy: z.enum(['round_robin', 'priority', 'least_connections', 'response_time']).default('priority'),
    failoverEnabled: z.boolean().default(true),
    healthCheckEnabled: z.boolean().default(true),
  }).optional(),
});

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    const decoded = verifyToken(token);
    
    if (!decoded) {
      return createApiResponse({ error: '未授权访问' }, false, 401);
    }

    const resolvedParams = await params;
    const groupId = resolvedParams.id;
    
    // 验证用户是否为组管理员
    const groupMember = await prisma.groupMember.findFirst({
      where: {
        userId: (decoded as any).userId,
        groupId: groupId,
        status: 'active',
        role: { in: ['admin', 'owner'] },
      },
    });

    if (!groupMember) {
      return createApiResponse({ error: '权限不足' }, false, 403);
    }

    const body = await request.json();
    const validatedData = aiServiceConfigSchema.parse(body);

    // 验证AI服务ID是否为支持的服务
    const supportedServices = ['claude', 'gemini', 'ampcode'];
    if (!supportedServices.includes(validatedData.aiServiceId)) {
      return createApiResponse({ error: 'AI服务不存在' }, false, 404);
    }

    // 更新或创建组AI服务配置
    const existingConfig = await prisma.groupAiService.findUnique({
      where: {
        groupId_aiServiceId: {
          groupId: groupId,
          aiServiceId: validatedData.aiServiceId,
        },
      },
    });

    let result;
    if (existingConfig) {
      // 更新现有配置
      result = await prisma.groupAiService.update({
        where: { id: existingConfig.id },
        data: {
          isEnabled: validatedData.isEnabled,
          authConfig: validatedData.authConfig,
          proxySettings: validatedData.proxySettings,
          quota: validatedData.quota,
        },
      });
    } else {
      // 创建新配置
      result = await prisma.groupAiService.create({
        data: {
          groupId: groupId,
          aiServiceId: validatedData.aiServiceId,
          isEnabled: validatedData.isEnabled,
          authConfig: validatedData.authConfig,
          proxySettings: validatedData.proxySettings,
          quota: validatedData.quota,
        },
      });
    }

    // 创建或更新配额配置
    if (validatedData.quota) {
      await prisma.quotaConfig.upsert({
        where: {
          groupId_aiServiceId: {
            groupId: groupId,
            aiServiceId: validatedData.aiServiceId,
          },
        },
        update: {
          dailyTokenLimit: BigInt(validatedData.quota.dailyTokenLimit || 100000),
          monthlyTokenLimit: BigInt(validatedData.quota.monthlyTokenLimit || 3000000),
          dailyCostLimit: validatedData.quota.dailyCostLimit || 10.0,
          monthlyCostLimit: validatedData.quota.monthlyCostLimit || 300.0,
          userDailyTokenLimit: validatedData.quota.userDailyTokenLimit ? BigInt(validatedData.quota.userDailyTokenLimit) : null,
          userMonthlyTokenLimit: validatedData.quota.userMonthlyTokenLimit ? BigInt(validatedData.quota.userMonthlyTokenLimit) : null,
          isEnabled: validatedData.isEnabled,
        },
        create: {
          groupId: groupId,
          aiServiceId: validatedData.aiServiceId,
          dailyTokenLimit: BigInt(validatedData.quota.dailyTokenLimit || 100000),
          monthlyTokenLimit: BigInt(validatedData.quota.monthlyTokenLimit || 3000000),
          dailyCostLimit: validatedData.quota.dailyCostLimit || 10.0,
          monthlyCostLimit: validatedData.quota.monthlyCostLimit || 300.0,
          userDailyTokenLimit: validatedData.quota.userDailyTokenLimit ? BigInt(validatedData.quota.userDailyTokenLimit) : null,
          userMonthlyTokenLimit: validatedData.quota.userMonthlyTokenLimit ? BigInt(validatedData.quota.userMonthlyTokenLimit) : null,
          isEnabled: validatedData.isEnabled,
        },
      });
    }

    return createApiResponse(result, true, 200);

  } catch (error) {
    if (error instanceof z.ZodError) {
      return createApiResponse({ error: error.errors[0].message }, false, 400);
    }

    console.error('Configure AI service error:', error);
    return createApiResponse({ error: '配置AI服务失败' }, false, 500);
  }
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    const decoded = verifyToken(token);
    
    if (!decoded) {
      return createApiResponse({ error: '未授权访问' }, false, 401);
    }

    const resolvedParams = await params;
    const groupId = resolvedParams.id;
    
    // 验证用户是否属于该组
    const groupMember = await prisma.groupMember.findFirst({
      where: {
        userId: (decoded as any).userId,
        groupId: groupId,
        status: 'active',
      },
    });

    if (!groupMember) {
      return createApiResponse({ error: '权限不足' }, false, 403);
    }

    // 获取组的AI服务配置
    const groupAiServices = await prisma.groupAiService.findMany({
      where: { groupId },
      orderBy: {
        createdAt: 'asc',
      },
    });

    // 定义静态AI服务信息
    const staticAiServices = {
      'claude': {
        id: 'claude',
        serviceName: 'claude',
        displayName: 'Claude Code',
        description: 'Anthropic Claude AI服务',
        baseUrl: 'https://api.anthropic.com',
        isEnabled: true,
      },
      'gemini': {
        id: 'gemini',
        serviceName: 'gemini',
        displayName: 'Gemini CLI',
        description: 'Google Gemini AI服务',
        baseUrl: 'https://generativelanguage.googleapis.com',
        isEnabled: true,
      },
      'ampcode': {
        id: 'ampcode',
        serviceName: 'ampcode',
        displayName: 'AmpCode',
        description: 'AmpCode AI服务',
        baseUrl: 'https://api.ampcode.com',
        isEnabled: true,
      },
    };

    // 获取配额配置
    const quotaConfigs = await prisma.quotaConfig.findMany({
      where: { groupId },
    });

    // 获取配额使用情况
    const quotaUsage = await prisma.quotaUsage.findMany({
      where: { groupId },
    });

    // 序列化BigInt的辅助函数
    const serializeBigInt = (obj: any): any => {
      if (obj === null || obj === undefined) return obj;
      if (typeof obj === 'bigint') return Number(obj);
      if (Array.isArray(obj)) return obj.map(serializeBigInt);
      if (typeof obj === 'object') {
        const result: any = {};
        for (const [key, value] of Object.entries(obj)) {
          result[key] = serializeBigInt(value);
        }
        return result;
      }
      return obj;
    };

    // 组合数据
    const servicesWithDetails = groupAiServices.map(service => {
      const quotaConfig = quotaConfigs.find(q => q.aiServiceId === service.aiServiceId);
      const usage = quotaUsage.find(u => u.aiServiceId === service.aiServiceId);
      const proxySettings = service.proxySettings as any;
      const aiServiceInfo = staticAiServices[service.aiServiceId as keyof typeof staticAiServices];
      
      return serializeBigInt({
        ...service,
        aiService: aiServiceInfo || {
          id: service.aiServiceId,
          serviceName: service.aiServiceId,
          displayName: service.aiServiceId,
          description: '',
          baseUrl: '',
          isEnabled: true,
        },
        quotaConfig,
        quotaUsage: usage,
        priority: proxySettings?.priority || 1,
        routingStrategy: proxySettings?.routingStrategy || 'priority',
        healthStatus: 'healthy', // TODO: 从监控系统获取实际状态
        responseTime: 0, // TODO: 从监控系统获取实际响应时间
      });
    });

    return createApiResponse(servicesWithDetails, true, 200);

  } catch (error) {
    console.error('Get AI service configuration error:', error);
    console.error('Error details:', error.message, error.stack);
    return createApiResponse({ error: '获取AI服务配置失败', details: error.message }, false, 500);
  }
}
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
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

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    const decoded = verifyToken(token);
    
    if (!decoded) {
      return createApiResponse(false, null, '未授权访问', 401);
    }

    const groupId = params.id;
    
    // 验证用户是否为组管理员
    const groupMember = await prisma.groupMember.findFirst({
      where: {
        userId: decoded.userId,
        groupId: groupId,
        status: 'active',
        role: { in: ['admin', 'owner'] },
      },
    });

    if (!groupMember) {
      return createApiResponse(false, null, '无权管理该组的AI服务配置', 403);
    }

    const body = await request.json();
    const validatedData = aiServiceConfigSchema.parse(body);

    // 检查AI服务是否存在
    const aiService = await prisma.aiService.findUnique({
      where: { id: validatedData.aiServiceId },
    });

    if (!aiService) {
      return createApiResponse(false, null, 'AI服务不存在', 404);
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
        include: {
          aiService: {
            select: {
              id: true,
              serviceName: true,
              displayName: true,
              description: true,
            },
          },
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
        include: {
          aiService: {
            select: {
              id: true,
              serviceName: true,
              displayName: true,
              description: true,
            },
          },
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

    return createApiResponse(true, result);

  } catch (error) {
    if (error instanceof z.ZodError) {
      return createApiResponse(false, null, error.errors[0].message, 400);
    }

    console.error('Configure AI service error:', error);
    return createApiResponse(false, null, '配置AI服务失败', 500);
  }
}

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    const decoded = verifyToken(token);
    
    if (!decoded) {
      return createApiResponse(false, null, '未授权访问', 401);
    }

    const groupId = params.id;
    
    // 验证用户是否属于该组
    const groupMember = await prisma.groupMember.findFirst({
      where: {
        userId: decoded.userId,
        groupId: groupId,
        status: 'active',
      },
    });

    if (!groupMember) {
      return createApiResponse(false, null, '无权访问该组信息', 403);
    }

    // 获取组的AI服务配置（包括详细配置信息）
    const groupAiServices = await prisma.groupAiService.findMany({
      where: { groupId },
      include: {
        aiService: {
          select: {
            id: true,
            serviceName: true,
            displayName: true,
            description: true,
            baseUrl: true,
            isEnabled: true,
          },
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    // 获取配额配置
    const quotaConfigs = await prisma.quotaConfig.findMany({
      where: { groupId },
    });

    // 获取配额使用情况
    const quotaUsage = await prisma.quotaUsage.findMany({
      where: { groupId },
    });

    // 组合数据
    const servicesWithDetails = groupAiServices.map(service => {
      const quotaConfig = quotaConfigs.find(q => q.aiServiceId === service.aiServiceId);
      const usage = quotaUsage.find(u => u.aiServiceId === service.aiServiceId);
      
      return {
        ...service,
        quotaConfig,
        quotaUsage: usage,
        priority: service.proxySettings?.['priority'] || 1,
        routingStrategy: service.proxySettings?.['routingStrategy'] || 'priority',
        healthStatus: 'healthy', // TODO: 从监控系统获取实际状态
        responseTime: 0, // TODO: 从监控系统获取实际响应时间
      };
    });

    return createApiResponse(true, servicesWithDetails);

  } catch (error) {
    console.error('Get AI service configuration error:', error);
    return createApiResponse(false, null, '获取AI服务配置失败', 500);
  }
}
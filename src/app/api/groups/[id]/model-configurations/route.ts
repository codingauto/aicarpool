import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { createApiResponse } from '@/lib/middleware';
import { getUserFromRequest } from '@/lib/auth';
import { cacheManager } from '@/lib/cache';

const createModelConfigSchema = z.object({
  serviceType: z.enum(['claude_code', 'gemini', 'ampcode']).default('claude_code'),
  primaryModel: z.string().default('claude-4-sonnet'),
  fallbackModels: z.array(z.string()).default(['claude-4-opus', 'kimi-k2-instruct', 'glm-4.5', 'qwen3-32b']),
  failoverTrigger: z.enum(['manual', 'automatic', 'hybrid']).default('automatic'),
  healthCheckThreshold: z.number().min(0).max(100).default(80),
  failbackEnabled: z.boolean().default(true),
  strategy: z.enum(['priority', 'round_robin', 'least_used']).default('priority'),
  maxRetries: z.number().min(1).max(10).default(3),
  timeout: z.number().min(5000).max(120000).default(30000),
  healthCheckInterval: z.number().min(30000).max(600000).default(60000),
});

const updateModelConfigSchema = createModelConfigSchema.partial();

// GET /api/groups/[id]/model-configurations - 获取组的模型配置
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return createApiResponse(false, null, '未授权', 401);
    }

    const resolvedParams = await params;
    const groupId = resolvedParams.id;

    // 检查用户是否为组成员
    const membership = await prisma.groupMember.findFirst({
      where: {
        groupId,
        userId: user.id,
        status: 'active',
      },
    });

    if (!membership) {
      return createApiResponse(false, null, '无权访问该拼车组', 403);
    }

    // 从缓存获取模型配置
    const configurations = await cacheManager.getModelConfigurations(groupId);

    return createApiResponse(true, configurations, '获取模型配置成功', 200);

  } catch (error) {
    console.error('Get model configurations error:', error);
    return createApiResponse(false, null, '获取模型配置失败', 500);
  }
}

// POST /api/groups/[id]/model-configurations - 创建模型配置
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return createApiResponse(false, null, '未授权', 401);
    }

    const resolvedParams = await params;
    const groupId = resolvedParams.id;

    // 检查用户是否为组管理员
    const membership = await prisma.groupMember.findFirst({
      where: {
        groupId,
        userId: user.id,
        role: { in: ['admin', 'owner'] },
        status: 'active',
      },
    });

    if (!membership) {
      return createApiResponse(false, null, '无权限管理该拼车组', 403);
    }

    const body = await request.json();
    const validatedData = createModelConfigSchema.parse(body);

    // 检查是否已存在相同服务类型的配置
    const existingConfig = await prisma.modelConfiguration.findUnique({
      where: {
        groupId_serviceType: {
          groupId,
          serviceType: validatedData.serviceType,
        },
      },
    });

    if (existingConfig) {
      return createApiResponse(false, null, '该服务类型的配置已存在，请使用更新接口', 400);
    }

    // 创建模型配置
    const configuration = await prisma.modelConfiguration.create({
      data: {
        groupId,
        ...validatedData,
      },
    });
    
    // 清理相关缓存
    await cacheManager.invalidateModelCache(groupId);

    return createApiResponse(true, configuration, '模型配置创建成功', 201);

  } catch (error) {
    if (error instanceof z.ZodError) {
      return createApiResponse(false, null, error.issues[0].message, 400);
    }

    console.error('Create model configuration error:', error);
    return createApiResponse(false, null, '创建模型配置失败', 500);
  }
}

// PUT /api/groups/[id]/model-configurations - 更新模型配置
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return createApiResponse(false, null, '未授权', 401);
    }

    const resolvedParams = await params;
    const groupId = resolvedParams.id;

    // 检查用户是否为组管理员
    const membership = await prisma.groupMember.findFirst({
      where: {
        groupId,
        userId: user.id,
        role: { in: ['admin', 'owner'] },
        status: 'active',
      },
    });

    if (!membership) {
      return createApiResponse(false, null, '无权限管理该拼车组', 403);
    }

    const body = await request.json();
    const { serviceType, ...updateData } = updateModelConfigSchema.parse(body);

    if (!serviceType) {
      return createApiResponse(false, null, 'serviceType 是必需的', 400);
    }

    // 查找并更新配置
    const configuration = await prisma.modelConfiguration.upsert({
      where: {
        groupId_serviceType: {
          groupId,
          serviceType,
        },
      },
      update: updateData,
      create: {
        groupId,
        serviceType,
        primaryModel: updateData.primaryModel || 'claude-4-sonnet',
        fallbackModels: updateData.fallbackModels || ['claude-4-opus', 'kimi-k2', 'glm-4.5', 'qwen-max'],
        failoverTrigger: updateData.failoverTrigger || 'automatic',
        healthCheckThreshold: updateData.healthCheckThreshold || 80,
        failbackEnabled: updateData.failbackEnabled ?? true,
        strategy: updateData.strategy || 'priority',
        maxRetries: updateData.maxRetries || 3,
        timeout: updateData.timeout || 30000,
        healthCheckInterval: updateData.healthCheckInterval || 60000,
      },
    });
    
    // 清理相关缓存
    await cacheManager.invalidateModelCache(groupId);

    return createApiResponse(true, configuration, '模型配置更新成功', 200);

  } catch (error) {
    if (error instanceof z.ZodError) {
      return createApiResponse(false, null, error.issues[0].message, 400);
    }

    console.error('Update model configuration error:', error);
    return createApiResponse(false, null, '更新模型配置失败', 500);
  }
}
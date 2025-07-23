import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { createApiResponse } from '@/lib/middleware';
import { verifyToken } from '@/lib/auth';

const deploymentModeSchema = z.object({
  mode: z.enum(['centralized', 'distributed', 'hybrid']),
  config: z.object({
    enableHealthCheck: z.boolean().default(true),
    healthCheckInterval: z.number().int().min(60).max(3600).default(300),
    enableFailover: z.boolean().default(true),
    maxRetries: z.number().int().min(1).max(10).default(3),
    requestTimeout: z.number().int().min(5).max(300).default(30),
    enableLoadBalancing: z.boolean().default(true),
    loadBalanceStrategy: z.enum(['round_robin', 'priority', 'least_connections', 'response_time']).default('round_robin'),
    enableGeoRouting: z.boolean().default(false),
    preferredRegions: z.array(z.string()).default([]),
    enableSessionStickiness: z.boolean().default(false),
    sessionTtl: z.number().int().min(300).max(86400).default(3600),
  }),
  description: z.string().optional(),
});

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

    // 获取组的部署模式配置
    const deploymentModes = await prisma.deploymentMode.findMany({
      where: { groupId },
      orderBy: {
        updatedAt: 'desc',
      },
    });

    return createApiResponse(true, deploymentModes);

  } catch (error) {
    console.error('Get deployment modes error:', error);
    return createApiResponse(false, null, '获取部署模式失败', 500);
  }
}

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
      return createApiResponse(false, null, '无权管理该组的部署模式', 403);
    }

    const body = await request.json();
    const validatedData = deploymentModeSchema.parse(body);

    // 使用事务来确保数据一致性
    const result = await prisma.$transaction(async (tx) => {
      // 首先将现有的所有模式设为非激活状态
      await tx.deploymentMode.updateMany({
        where: { groupId },
        data: { isActive: false },
      });

      // 然后创建或更新新的部署模式
      const deploymentMode = await tx.deploymentMode.upsert({
        where: {
          groupId_mode: {
            groupId: groupId,
            mode: validatedData.mode,
          },
        },
        update: {
          config: validatedData.config,
          isActive: true,
          description: validatedData.description,
        },
        create: {
          groupId: groupId,
          mode: validatedData.mode,
          config: validatedData.config,
          isActive: true,
          description: validatedData.description,
        },
      });

      return deploymentMode;
    });

    return createApiResponse(true, result);

  } catch (error) {
    if (error instanceof z.ZodError) {
      return createApiResponse(false, null, error.errors[0].message, 400);
    }

    console.error('Update deployment mode error:', error);
    return createApiResponse(false, null, '更新部署模式失败', 500);
  }
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
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
      return createApiResponse(false, null, '无权管理该组的部署模式', 403);
    }

    const body = await request.json();
    const validatedData = deploymentModeSchema.parse(body);

    // 创建新的部署模式配置（不激活）
    const deploymentMode = await prisma.deploymentMode.create({
      data: {
        groupId: groupId,
        mode: validatedData.mode,
        config: validatedData.config,
        isActive: false,
        description: validatedData.description,
      },
    });

    return createApiResponse(true, deploymentMode);

  } catch (error) {
    if (error instanceof z.ZodError) {
      return createApiResponse(false, null, error.errors[0].message, 400);
    }

    console.error('Create deployment mode error:', error);
    return createApiResponse(false, null, '创建部署模式失败', 500);
  }
}
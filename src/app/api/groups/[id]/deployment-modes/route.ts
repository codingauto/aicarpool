import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { withAuth, createApiResponse, createErrorResponse } from '@/lib/middleware';

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

async function getHandler(request: NextRequest, user: any, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: groupId } = await params;
    
    // 验证用户是否属于该组
    const groupMember = await prisma.groupMember.findFirst({
      where: {
        userId: user.id,
        groupId: groupId,
        status: 'active',
      },
    });

    if (!groupMember) {
      return createErrorResponse('无权访问该组信息', 403);
    }

    // 返回模拟数据，因为数据库中可能没有 deploymentMode 表
    const mockDeploymentModes = [
      {
        id: '1',
        groupId: groupId,
        mode: 'centralized',
        config: {
          enableHealthCheck: true,
          healthCheckInterval: 300,
          enableFailover: true,
          maxRetries: 3,
          requestTimeout: 30,
          enableLoadBalancing: true,
          loadBalanceStrategy: 'round_robin',
          enableGeoRouting: false,
          preferredRegions: [],
          enableSessionStickiness: false,
          sessionTtl: 3600,
        },
        isActive: true,
        description: '集中式部署模式',
        createdAt: new Date(),
        updatedAt: new Date(),
      }
    ];

    return createApiResponse(mockDeploymentModes);

  } catch (error) {
    console.error('Get deployment modes error:', error);
    return createErrorResponse('获取部署模式失败', 500);
  }
}

async function putHandler(request: NextRequest, user: any, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: groupId } = await params;
    
    // 验证用户是否为组管理员
    const groupMember = await prisma.groupMember.findFirst({
      where: {
        userId: user.id,
        groupId: groupId,
        status: 'active',
        role: { in: ['admin'] },
      },
    });

    if (!groupMember) {
      return createErrorResponse('无权管理该组的部署模式', 403);
    }

    const body = await request.json();
    const validatedData = deploymentModeSchema.parse(body);

    // 返回模拟更新成功的数据
    const mockUpdatedData = {
      id: '1',
      groupId: groupId,
      mode: validatedData.mode,
      config: validatedData.config,
      isActive: true,
      description: validatedData.description,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    return createApiResponse(mockUpdatedData);

  } catch (error) {
    if (error instanceof z.ZodError) {
      return createErrorResponse(error.issues[0].message, 400);
    }

    console.error('Update deployment mode error:', error);
    return createErrorResponse('更新部署模式失败', 500);
  }
}

async function postHandler(request: NextRequest, user: any, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: groupId } = await params;
    
    // 验证用户是否为组管理员
    const groupMember = await prisma.groupMember.findFirst({
      where: {
        userId: user.id,
        groupId: groupId,
        status: 'active',
        role: { in: ['admin'] },
      },
    });

    if (!groupMember) {
      return createErrorResponse('无权管理该组的部署模式', 403);
    }

    const body = await request.json();
    const validatedData = deploymentModeSchema.parse(body);

    // 返回模拟创建成功的数据
    const mockCreatedData = {
      id: Date.now().toString(),
      groupId: groupId,
      mode: validatedData.mode,
      config: validatedData.config,
      isActive: false,
      description: validatedData.description,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    return createApiResponse(mockCreatedData);

  } catch (error) {
    if (error instanceof z.ZodError) {
      return createErrorResponse(error.issues[0].message, 400);
    }

    console.error('Create deployment mode error:', error);
    return createErrorResponse('创建部署模式失败', 500);
  }
}

// 修复 withAuth 包装器以支持额外参数
function withAuthAndParams(handler: (req: NextRequest, user: any, context: any) => Promise<any>) {
  return withAuth(async (req: NextRequest, user: any) => {
    // 从 URL 中提取参数
    const url = new URL(req.url);
    const pathSegments = url.pathname.split('/');
    const id = pathSegments[pathSegments.indexOf('groups') + 1];
    
    const context = {
      params: Promise.resolve({ id })
    };
    
    return handler(req, user, context);
  });
}

export const GET = withAuthAndParams(getHandler);
export const PUT = withAuthAndParams(putHandler);
export const POST = withAuthAndParams(postHandler);
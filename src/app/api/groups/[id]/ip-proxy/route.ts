import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, createApiResponse, createErrorResponse } from '@/lib/middleware';
import { z } from 'zod';

// 创建IP代理配置的验证schema
const createIpProxySchema = z.object({
  name: z.string().min(1, '代理名称不能为空'),
  description: z.string().optional(),
  proxyType: z.enum(['http', 'https', 'socks5']),
  host: z.string().min(1, '主机地址不能为空'),
  port: z.number().int().min(1).max(65535, '端口号必须在 1-65535 之间'),
  username: z.string().optional(),
  password: z.string().optional(),
  location: z.string().optional(),
  maxConnections: z.number().int().min(1).default(10),
  trafficLimit: z.number().int().min(0).optional()
});

const updateIpProxySchema = createIpProxySchema.partial();

// GET - 获取拼车组的IP代理配置列表
async function getHandler(
  request: NextRequest,
  user: any,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: groupId } = await params;

    // 验证用户是否为该拼车组成员
    const membership = await prisma.groupMember.findFirst({
      where: {
        groupId,
        userId: user.id,
        status: 'active'
      }
    });

    if (!membership) {
      return createErrorResponse('无权限访问该拼车组', 403);
    }

    // 从数据库中获取真实的IP代理配置数据
    const ipProxyConfigs = await prisma.ipProxyConfig.findMany({
      where: {
        groupId
      },
      include: {
        _count: {
          select: {
            usageLogs: true,
            memberConfigs: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    // 处理 BigInt 序列化
    const processedConfigs = ipProxyConfigs.map(config => ({
      ...config,
      trafficUsed: config.trafficUsed.toString(),
      trafficLimit: config.trafficLimit ? config.trafficLimit.toString() : null
    }));

    return createApiResponse(processedConfigs);

  } catch (error) {
    console.error('获取IP代理配置失败:', error);
    return createErrorResponse('获取IP代理配置失败', 500);
  }
}

// POST - 创建新的IP代理配置
async function postHandler(
  request: NextRequest,
  user: any,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: groupId } = await params;
    const body = await request.json();

    // 验证用户是否为该拼车组管理员
    const membership = await prisma.groupMember.findFirst({
      where: {
        groupId,
        userId: user.id,
        status: 'active',
        role: { in: ['admin'] }
      }
    });

    if (!membership) {
      return createErrorResponse('无权限管理该拼车组的IP代理', 403);
    }

    // 验证请求数据
    const validatedData = createIpProxySchema.parse(body);

    // 检查名称是否已存在
    const existingConfig = await prisma.ipProxyConfig.findFirst({
      where: {
        groupId,
        name: validatedData.name
      }
    });

    if (existingConfig) {
      return createErrorResponse('代理配置名称已存在', 400);
    }

    // 创建新的IP代理配置
    const newConfig = await prisma.ipProxyConfig.create({
      data: {
        ...validatedData,
        groupId,
        trafficLimit: validatedData.trafficLimit ? BigInt(validatedData.trafficLimit * 1024 * 1024) : null, // 转换为字节
        isEnabled: true,
        status: 'active',
        currentConnections: 0,
        trafficUsed: BigInt(0)
      },
      include: {
        _count: {
          select: {
            usageLogs: true,
            memberConfigs: true
          }
        }
      }
    });

    // 处理 BigInt 序列化
    const processedConfig = {
      ...newConfig,
      trafficUsed: newConfig.trafficUsed.toString(),
      trafficLimit: newConfig.trafficLimit ? newConfig.trafficLimit.toString() : null
    };

    return createApiResponse(processedConfig, true, 201);

  } catch (error) {
    if (error instanceof z.ZodError) {
      return createErrorResponse(error.issues[0].message, 400);
    }

    console.error('创建IP代理配置失败:', error);
    return createErrorResponse('创建IP代理配置失败', 500);
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
export const POST = withAuthAndParams(postHandler);
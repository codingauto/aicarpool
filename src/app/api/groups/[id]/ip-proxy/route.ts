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

    // 返回模拟数据，因为数据库中没有 ipProxyConfig 表
    const mockData = [
      {
        id: '1',
        name: '示例代理配置',
        description: '这是一个示例IP代理配置',
        proxyType: 'http',
        host: '127.0.0.1',
        port: 8080,
        location: '本地',
        maxConnections: 10,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];

    return createApiResponse(mockData);

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

    // 返回模拟创建成功的数据
    const mockCreatedData = {
      id: Date.now().toString(),
      ...validatedData,
      groupId,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    return createApiResponse(mockCreatedData);

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
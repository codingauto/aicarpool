import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, createApiResponse, createErrorResponse } from '@/lib/middleware';
import { z } from 'zod';

// 更新IP代理配置的验证schema
const updateIpProxySchema = z.object({
  name: z.string().min(1, '代理名称不能为空').optional(),
  description: z.string().optional(),
  proxyType: z.enum(['http', 'https', 'socks5']).optional(),
  host: z.string().min(1, '主机地址不能为空').optional(),
  port: z.number().int().min(1).max(65535, '端口号必须在 1-65535 之间').optional(),
  username: z.string().optional(),
  password: z.string().optional(),
  location: z.string().optional(),
  maxConnections: z.number().int().min(1).optional(),
  trafficLimit: z.number().int().min(0).optional(),
  isEnabled: z.boolean().optional()
});

// GET - 获取单个IP代理配置详情
async function getHandler(req: NextRequest, user: any, { params }: { params: Promise<{ id: string; proxyId: string }> }) {
  try {
    const { id: groupId, proxyId } = await params;

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

    // 获取IP代理配置详情
    const proxyConfig = await prisma.ipProxyConfig.findFirst({
      where: {
        id: proxyId,
        groupId
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

    if (!proxyConfig) {
      return createErrorResponse('代理配置不存在', 404);
    }

    // 处理 BigInt 序列化
    const result = {
      ...proxyConfig,
      trafficUsed: proxyConfig.trafficUsed.toString(),
      trafficLimit: proxyConfig.trafficLimit ? proxyConfig.trafficLimit.toString() : null
    };

    return createApiResponse(result);

  } catch (error) {
    console.error('获取IP代理配置详情失败:', error);
    return createErrorResponse('获取IP代理配置详情失败', 500);
  }
}

// PUT - 更新IP代理配置
async function putHandler(req: NextRequest, user: any, { params }: { params: Promise<{ id: string; proxyId: string }> }) {
  try {
    const { id: groupId, proxyId } = await params;
    const body = await req.json();

    // 验证用户是否为该拼车组成员（允许所有活跃成员编辑）
    console.log('PUT - 检查用户权限:', { groupId, userId: user.id });
    
    const membership = await prisma.groupMember.findFirst({
      where: {
        groupId,
        userId: user.id,
        status: 'active'
      }
    });

    console.log('PUT - 找到的成员关系:', membership);

    if (!membership) {
      // 检查是否是组创建者
      const group = await prisma.group.findFirst({
        where: {
          id: groupId,
          createdById: user.id
        }
      });

      console.log('PUT - 检查组创建者:', group);

      if (!group) {
        return createErrorResponse('无权限访问该拼车组', 403);
      }
    }

    // 验证代理配置是否存在
    const existingProxy = await prisma.ipProxyConfig.findFirst({
      where: {
        id: proxyId,
        groupId
      }
    });

    if (!existingProxy) {
      return createErrorResponse('代理配置不存在', 404);
    }

    // 验证请求数据
    const validatedData = updateIpProxySchema.parse(body);

    // 如果更新名称，检查是否与其他配置冲突
    if (validatedData.name && validatedData.name !== existingProxy.name) {
      const nameConflict = await prisma.ipProxyConfig.findFirst({
        where: {
          groupId,
          name: validatedData.name,
          id: { not: proxyId }
        }
      });

      if (nameConflict) {
        return createErrorResponse('代理名称已存在', 400);
      }
    }

    // 准备更新数据
    const updateData: any = { ...validatedData };
    if (validatedData.trafficLimit !== undefined) {
      updateData.trafficLimit = validatedData.trafficLimit ? BigInt(validatedData.trafficLimit * 1024 * 1024) : null;
    }

    // 更新IP代理配置
    const updatedProxy = await prisma.ipProxyConfig.update({
      where: { id: proxyId },
      data: updateData,
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
    const result = {
      ...updatedProxy,
      trafficUsed: updatedProxy.trafficUsed.toString(),
      trafficLimit: updatedProxy.trafficLimit ? updatedProxy.trafficLimit.toString() : null
    };

    return createApiResponse(result);

  } catch (error) {
    if (error instanceof z.ZodError) {
      return createErrorResponse('数据验证失败: ' + error.errors[0].message, 400);
    }

    console.error('更新IP代理配置失败:', error);
    return createErrorResponse('更新IP代理配置失败', 500);
  }
}

// DELETE - 删除IP代理配置
async function deleteHandler(req: NextRequest, user: any, { params }: { params: Promise<{ id: string; proxyId: string }> }) {
  try {
    const { id: groupId, proxyId } = await params;

    // 验证用户是否为该拼车组成员（允许所有活跃成员删除）
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

    // 验证代理配置是否存在
    const existingProxy = await prisma.ipProxyConfig.findFirst({
      where: {
        id: proxyId,
        groupId
      }
    });

    if (!existingProxy) {
      return createErrorResponse('代理配置不存在', 404);
    }

    // 删除IP代理配置（级联删除相关的使用日志和成员配置）
    await prisma.ipProxyConfig.delete({
      where: { id: proxyId }
    });

    return createApiResponse({ message: '代理配置删除成功' });

  } catch (error) {
    console.error('删除IP代理配置失败:', error);
    return createErrorResponse('删除IP代理配置失败', 500);
  }
}

// 修复 withAuth 包装器以支持额外参数
function withAuthAndParams(handler: (req: NextRequest, user: any, context: any) => Promise<any>) {
  return withAuth(async (req: NextRequest, user: any) => {
    // 从 URL 中提取参数
    const url = new URL(req.url);
    const pathSegments = url.pathname.split('/').filter(segment => segment !== '');
    
    // 路径格式: api/groups/[id]/ip-proxy/[proxyId]
    // 索引:      0   1      2    3        4
    const id = pathSegments[2]; // groups 后面的 ID
    const proxyId = pathSegments[4]; // ip-proxy 后面的 ID
    
    console.log('URL路径解析:', { 
      pathname: url.pathname, 
      pathSegments, 
      extractedId: id, 
      extractedProxyId: proxyId 
    });
    
    const context = {
      params: Promise.resolve({ id, proxyId })
    };
    
    return handler(req, user, context);
  });
}

export const GET = withAuthAndParams(getHandler);
export const PUT = withAuthAndParams(putHandler);
export const DELETE = withAuthAndParams(deleteHandler);
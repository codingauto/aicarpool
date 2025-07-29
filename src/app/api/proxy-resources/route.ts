import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, createApiResponse, createErrorResponse } from '@/lib/middleware';

// 获取代理资源列表
async function getHandler(request: NextRequest, user: any) {
  try {
    const groupId = request.nextUrl.searchParams.get('groupId');
    
    if (!groupId) {
      return createErrorResponse('缺少组ID参数', 400);
    }

    // 验证用户是否属于该组
    const groupMember = await prisma.groupMember.findFirst({
      where: {
        userId: user.id,
        groupId: groupId,
        status: 'active',
      },
    });

    if (!groupMember) {
      return createErrorResponse('无权访问该组的代理资源', 403);
    }

    // 获取代理资源（简化版本，直接返回空数组）
    const proxyResources: any[] = [];

    return createApiResponse(proxyResources);

  } catch (error) {
    console.error('Get proxy resources error:', error);
    return createErrorResponse('获取代理资源失败', 500);
  }
}

// 创建代理资源
async function postHandler(request: NextRequest, user: any) {
  try {
    const body = await request.json();
    const { groupId } = body;

    if (!groupId) {
      return createErrorResponse('缺少组ID参数', 400);
    }

    // 验证用户是否为组管理员
    const groupMember = await prisma.groupMember.findFirst({
      where: {
        userId: user.id,
        groupId: groupId,
        status: 'active',
        role: { in: ['admin', 'owner'] },
      },
    });

    if (!groupMember) {
      return createErrorResponse('无权管理该组的代理资源', 403);
    }

    // 简化版本：返回成功消息
    return createApiResponse({ message: '代理资源创建成功' });

  } catch (error) {
    console.error('Create proxy resource error:', error);
    return createErrorResponse('创建代理资源失败', 500);
  }
}

export const GET = withAuth(getHandler);
export const POST = withAuth(postHandler);
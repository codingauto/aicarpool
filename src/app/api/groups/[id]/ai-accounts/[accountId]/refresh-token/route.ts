import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createApiResponse } from '@/lib/middleware';
import { verifyToken } from '@/lib/auth';
import { aiAccountService } from '@/lib/ai-accounts';
import { getErrorMessage, errorHasMessage, errorMessageIncludes } from '@/lib/utils';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string; accountId: string }> }) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    const decoded = verifyToken(token);
    
    if (!decoded) {
      return createApiResponse({ error: '未授权访问' }, false, 401);
    }

    const resolvedParams = await params;
    const groupId = resolvedParams.id;
    const accountId = resolvedParams.accountId;
    
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

    // 验证账户存在且属于该组
    const existingAccount = await aiAccountService.getAccount(accountId);
    if (existingAccount.groupId !== groupId) {
      return createApiResponse({ error: '账户不属于该组' }, false, 403);
    }

    // 执行token刷新
    const refreshResult = await aiAccountService.refreshToken(accountId);

    return createApiResponse({
      success: true,
      message: 'Token刷新成功',
      accessToken: refreshResult.accessToken,
      expiresAt: refreshResult.expiresAt,
    }, true, 200);

  } catch (error) {
    if (errorHasMessage(error, 'Account not found')) {
      return createApiResponse({ error: '账户不存在' }, false, 404);
    }

    if (errorHasMessage(error, 'Account not found or not OAuth account')) {
      return createApiResponse({ error: '账户不是OAuth类型' }, false, 400);
    }

    if (errorHasMessage(error, 'No refresh token available')) {
      return createApiResponse({ error: '没有可用的刷新令牌' }, false, 400);
    }

    if (errorMessageIncludes(error, 'not supported for service type')) {
      return createApiResponse({ error: '此服务类型不支持token刷新' }, false, 400);
    }

    console.error('Refresh token error:', error);
    return createApiResponse({ 
      error: 'Token刷新失败', 
      details: getErrorMessage(error)
    }, false, 500);
  }
}
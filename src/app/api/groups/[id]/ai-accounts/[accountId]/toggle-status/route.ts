import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createApiResponse } from '@/lib/middleware';
import { verifyToken } from '@/lib/auth';
import { aiAccountService } from '@/lib/ai-accounts';

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

    // 切换账户状态
    const updatedAccount = await aiAccountService.toggleAccountStatus(accountId);

    return createApiResponse({
      success: true,
      message: `账户已${updatedAccount.isEnabled ? '启用' : '禁用'}`,
      account: updatedAccount,
    }, true, 200);

  } catch (error) {
    if (error.message === 'Account not found') {
      return createApiResponse({ error: '账户不存在' }, false, 404);
    }

    console.error('Toggle account status error:', error);
    return createApiResponse({ error: '切换账户状态失败' }, false, 500);
  }
}
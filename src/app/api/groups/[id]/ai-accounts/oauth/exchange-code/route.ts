import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { createApiResponse } from '@/lib/middleware';
import { verifyToken } from '@/lib/auth';
import { aiAccountService } from '@/lib/ai-accounts';

const exchangeCodeSchema = z.object({
  sessionId: z.string(),
  authCodeOrUrl: z.string(),
  accountName: z.string().min(1).max(255),
  description: z.string().optional(),
  accountType: z.enum(['shared', 'dedicated']).default('shared'),
});

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    const decoded = verifyToken(token);
    
    if (!decoded) {
      return createApiResponse({ error: '未授权访问' }, false, 401);
    }

    const resolvedParams = await params;
    const groupId = resolvedParams.id;
    
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

    const body = await request.json();
    const validatedData = exchangeCodeSchema.parse(body);

    // 交换OAuth授权码获取tokens
    const tokenResult = await aiAccountService.exchangeOAuthCode(
      validatedData.sessionId,
      validatedData.authCodeOrUrl
    );

    if (!tokenResult.success) {
      return createApiResponse({ error: '授权码交换失败' }, false, 400);
    }

    // 从session中获取服务类型
    const session = aiAccountService.getOAuthSession(validatedData.sessionId);
    if (!session) {
      return createApiResponse({ error: 'OAuth会话不存在或已过期' }, false, 400);
    }
    const serviceType = session.serviceType;

    // 创建账户
    const account = await aiAccountService.createAccount({
      groupId,
      serviceType: serviceType as any,
      name: validatedData.accountName,
      description: validatedData.description,
      accountType: validatedData.accountType,
      authType: 'oauth',
      credentials: {
        accessToken: tokenResult.tokens.accessToken,
        refreshToken: tokenResult.tokens.refreshToken,
        expiresAt: tokenResult.tokens.expiresAt,
        scopes: tokenResult.tokens.scopes,
      },
    });

    return createApiResponse({
      success: true,
      account,
      message: 'OAuth账户创建成功',
    }, true, 201);

  } catch (error) {
    if (error instanceof z.ZodError) {
      return createApiResponse({ error: error.issues[0].message }, false, 400);
    }

    console.error('Exchange OAuth code error:', error);
    return createApiResponse({ error: '授权码交换失败: ' + error.message }, false, 500);
  }
}
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { createApiResponse } from '@/lib/middleware';
import { verifyToken } from '@/lib/auth';
import { aiAccountService } from '@/lib/ai-accounts';

const updateAccountSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  accountType: z.enum(['shared', 'dedicated']).optional(),
  credentials: z.object({
    apiKey: z.string().optional(),
    accessToken: z.string().optional(),
    refreshToken: z.string().optional(),
    expiresAt: z.number().optional(),
    scopes: z.array(z.string()).optional(),
    projectId: z.string().optional(),
  }).optional(),
  proxy: z.object({
    type: z.enum(['socks5', 'http', 'https']),
    host: z.string(),
    port: z.number(),
    username: z.string().optional(),
    password: z.string().optional(),
  }).optional(),
});

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string; accountId: string }> }) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return createApiResponse({ error: '缺少授权令牌' }, false, 401);
    }
    
    const decoded = verifyToken(token);
    
    if (!decoded) {
      return createApiResponse({ error: '未授权访问' }, false, 401);
    }

    const resolvedParams = await params;
    const groupId = resolvedParams.id;
    const accountId = resolvedParams.accountId;
    
    // 验证用户是否属于该组
    const groupMember = await prisma.groupMember.findFirst({
      where: {
        userId: (decoded as any).userId,
        groupId: groupId,
        status: 'active',
      },
    });

    if (!groupMember) {
      return createApiResponse({ error: '权限不足' }, false, 403);
    }

    const account = await aiAccountService.getAccount(accountId);

    // 验证账户是否属于该组
    if (account.groupId !== groupId) {
      return createApiResponse({ error: '账户不属于该组' }, false, 403);
    }

    return createApiResponse(account, true, 200);

  } catch (error) {
    if (error instanceof Error && error.message === 'Account not found') {
      return createApiResponse({ error: '账户不存在' }, false, 404);
    }

    console.error('Get AI account error:', error);
    return createApiResponse({ error: '获取AI账户失败' }, false, 500);
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string; accountId: string }> }) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return createApiResponse({ error: '缺少授权令牌' }, false, 401);
    }
    
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

    const body = await request.json();
    const validatedData = updateAccountSchema.parse(body);

    const updatedAccount = await aiAccountService.updateAccount(accountId, validatedData);

    return createApiResponse(updatedAccount, true, 200);

  } catch (error) {
    if (error instanceof z.ZodError) {
      return createApiResponse({ error: error.issues[0].message }, false, 400);
    }

    if (error instanceof Error && error.message === 'Account not found') {
      return createApiResponse({ error: '账户不存在' }, false, 404);
    }

    console.error('Update AI account error:', error);
    return createApiResponse({ error: '更新AI账户失败' }, false, 500);
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string; accountId: string }> }) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return createApiResponse({ error: '缺少授权令牌' }, false, 401);
    }
    
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

    await aiAccountService.deleteAccount(accountId);

    return createApiResponse({ message: '账户删除成功' }, true, 200);

  } catch (error) {
    if (error instanceof Error && error.message === 'Account not found') {
      return createApiResponse({ error: '账户不存在' }, false, 404);
    }

    if (error instanceof Error && error.message.includes('services are bound to this account')) {
      return createApiResponse({ error: error.message }, false, 400);
    }

    console.error('Delete AI account error:', error);
    return createApiResponse({ error: '删除AI账户失败' }, false, 500);
  }
}
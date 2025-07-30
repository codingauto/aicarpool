import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { createApiResponse } from '@/lib/middleware';
import { verifyToken } from '@/lib/auth';
import { aiAccountService } from '@/lib/ai-accounts';

const createAccountSchema = z.object({
  serviceType: z.enum(['claude', 'gemini', 'ampcode']),
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  accountType: z.enum(['shared', 'dedicated']).default('shared'),
  authType: z.enum(['oauth', 'api_key']),
  credentials: z.object({
    apiKey: z.string().optional(),
    accessToken: z.string().optional(),
    refreshToken: z.string().optional(),
    expiresAt: z.number().optional(),
    scopes: z.array(z.string()).optional(),
    projectId: z.string().optional(),
  }),
  proxy: z.object({
    type: z.enum(['socks5', 'http', 'https']),
    host: z.string(),
    port: z.number(),
    username: z.string().optional(),
    password: z.string().optional(),
  }).optional(),
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
    const validatedData = createAccountSchema.parse(body);

    const account = await aiAccountService.createAccount({
      groupId,
      ...validatedData,
    });

    return createApiResponse(account, true, 201);

  } catch (error) {
    if (error instanceof z.ZodError) {
      return createApiResponse({ error: error.errors[0].message }, false, 400);
    }

    console.error('Create AI account error:', error);
    return createApiResponse({ error: '创建AI账户失败' }, false, 500);
  }
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    const decoded = verifyToken(token);
    
    if (!decoded) {
      return createApiResponse({ error: '未授权访问' }, false, 401);
    }

    const resolvedParams = await params;
    const groupId = resolvedParams.id;
    
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

    const { searchParams } = new URL(request.url);
    const serviceType = searchParams.get('serviceType') as string | undefined;

    const accounts = await aiAccountService.getAllAccounts(groupId, serviceType);

    return createApiResponse(accounts, true, 200);

  } catch (error) {
    console.error('Get AI accounts error:', error);
    return createApiResponse({ error: '获取AI账户失败' }, false, 500);
  }
}
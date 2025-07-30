import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { createApiResponse } from '@/lib/middleware';
import { verifyToken } from '@/lib/auth';
import { aiAccountService } from '@/lib/ai-accounts';

const generateAuthUrlSchema = z.object({
  serviceType: z.enum(['claude', 'gemini', 'ampcode']),
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
    if (!token) {
      return createApiResponse({ error: '未提供授权令牌' }, false, 401);
    }
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
    const validatedData = generateAuthUrlSchema.parse(body);

    const authInfo = await aiAccountService.generateOAuthUrl(
      validatedData.serviceType,
      validatedData.proxy
    );

    return createApiResponse(authInfo, true, 200);

  } catch (error) {
    if (error instanceof z.ZodError) {
      return createApiResponse({ error: error.issues[0].message }, false, 400);
    }

    console.error('Generate OAuth URL error:', error);
    return createApiResponse({ error: '生成授权链接失败' }, false, 500);
  }
}
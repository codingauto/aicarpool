import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { createApiResponse } from '@/lib/middleware';
import { verifyToken } from '@/lib/auth';
import { aiAccountService } from '@/lib/ai-accounts';

const createAccountSchema = z.object({
  serviceType: z.enum(['claude', 'gemini', 'ampcode', 'kimi', 'zhipu', 'qwen']),
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  accountType: z.enum(['shared', 'dedicated']).default('shared'),
  authType: z.enum(['oauth', 'api_key']),
  // 支持多模型凭证配置
  credentials: z.object({
    // 通用API密钥
    apiKey: z.string().optional(),
    // OAuth相关
    accessToken: z.string().optional(),
    refreshToken: z.string().optional(),
    expiresAt: z.number().optional(),
    scopes: z.array(z.string()).optional(),
    // Gemini专用
    projectId: z.string().optional(),
    // 多模型专用配置
    modelSpecificKeys: z.record(z.string(), z.string()).optional(), // 模型特定的API密钥
    fallbackKeys: z.array(z.string()).optional(), // 备用API密钥列表
  }),
  proxy: z.object({
    type: z.enum(['socks5', 'http', 'https']),
    host: z.string(),
    port: z.number(),
    username: z.string().optional(),
    password: z.string().optional(),
  }).optional(),
  // 多模型支持配置
  multiModelConfig: z.object({
    supportedModels: z.array(z.string()).optional(), // 该账号支持的模型列表
    defaultModel: z.string().optional(), // 默认模型
    rateLimits: z.record(z.string(), z.object({
      requestsPerMinute: z.number().optional(),
      tokensPerMinute: z.number().optional(),
    })).optional(), // 各模型的速率限制
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
    const validatedData = createAccountSchema.parse(body);

    const account = await aiAccountService.createAccount({
      groupId,
      ...validatedData,
    });

    return createApiResponse(account, true, 201);

  } catch (error) {
    if (error instanceof z.ZodError) {
      return createApiResponse({ error: error.issues[0].message }, false, 400);
    }

    console.error('Create AI account error:', error);
    return createApiResponse({ error: '创建AI账户失败' }, false, 500);
  }
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { withAuth, createApiResponse, createErrorResponse } from '@/lib/middleware';
import { randomBytes } from 'crypto';

const createApiKeySchema = z.object({
  name: z.string().min(1, 'API密钥名称不能为空').max(50, 'API密钥名称不能超过50个字符'),
  description: z.string().max(200, '描述不能超过200个字符').optional(),
  aiServiceId: z.string(),
  quotaLimit: z.number().positive('配额限制必须大于0').optional(),
  expiresInDays: z.number().positive('过期天数必须大于0').max(365, '过期天数不能超过365天').optional(),
});

// 获取拼车组的API密钥列表
async function getHandler(req: NextRequest, user: any, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = user.id;
    const resolvedParams = await params;
    const groupId = resolvedParams.id;

    // 检查用户是否为该组成员
    const membership = await prisma.groupMember.findFirst({
      where: {
        groupId,
        userId,
        status: 'active',
      },
    });

    if (!membership) {
      return createErrorResponse('您不是该拼车组的成员', 403);
    }

    // 获取API密钥列表
    const apiKeys = await prisma.apiKey.findMany({
      where: {
        groupId,
        status: { not: 'revoked' },
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // 静态AI服务信息
    const staticAiServices = {
      claude: {
        id: 'claude',
        serviceName: 'claude',
        displayName: 'Claude Code',
      },
      gemini: {
        id: 'gemini',
        serviceName: 'gemini',
        displayName: 'Gemini CLI',
      },
      ampcode: {
        id: 'ampcode',
        serviceName: 'ampcode',
        displayName: 'AmpCode',
      },
    };

    // 序列化BigInt的辅助函数
    const serializeBigInt = (obj: any): any => {
      if (obj === null || obj === undefined) return obj;
      if (typeof obj === 'bigint') return Number(obj);
      if (Array.isArray(obj)) return obj.map(serializeBigInt);
      if (typeof obj === 'object') {
        const result: any = {};
        for (const [key, value] of Object.entries(obj)) {
          result[key] = serializeBigInt(value);
        }
        return result;
      }
      return obj;
    };

    // 格式化返回数据，对于非创建者隐藏密钥
    const formattedApiKeys = apiKeys.map((apiKey) => serializeBigInt({
      ...apiKey,
      key: apiKey.userId === userId ? apiKey.key : '***...***', // 只有创建者能看到完整密钥
      aiService: staticAiServices[apiKey.aiServiceId as keyof typeof staticAiServices] || {
        id: apiKey.aiServiceId,
        serviceName: apiKey.aiServiceId,
        displayName: apiKey.aiServiceId,
      },
    }));

    return createApiResponse(formattedApiKeys);

  } catch (error) {
    console.error('Get API keys error:', error);
    return createErrorResponse('获取API密钥列表失败', 500);
  }
}

// 创建新的API密钥
async function postHandler(req: NextRequest, user: any, { params }: { params: Promise<{ id: string }> }) {
  try {
    const body = await req.json();
    const validatedData = createApiKeySchema.parse(body);
    const userId = user.id;
    const resolvedParams = await params;
    const groupId = resolvedParams.id;

    const { name, description, aiServiceId, quotaLimit, expiresInDays } = validatedData;

    // 检查用户是否为该组成员
    const membership = await prisma.groupMember.findFirst({
      where: {
        groupId,
        userId,
        status: 'active',
      },
    });

    if (!membership) {
      return createErrorResponse('您不是该拼车组的成员', 403);
    }

    // 检查AI服务是否已为该组启用
    const groupAiService = await prisma.groupAiService.findFirst({
      where: {
        groupId,
        aiServiceId,
        isEnabled: true,
      },
    });

    if (!groupAiService) {
      return createErrorResponse('该AI服务未为拼车组启用', 400);
    }

    // 检查同名API密钥是否已存在
    const existingApiKey = await prisma.apiKey.findFirst({
      where: {
        groupId,
        userId,
        name,
        status: { not: 'revoked' },
      },
    });

    if (existingApiKey) {
      return createErrorResponse('同名API密钥已存在', 400);
    }

    // 生成API密钥
    const keyPrefix = 'ac'; // AiCarpool
    const keyBody = randomBytes(24).toString('base64url');
    const apiKey = `${keyPrefix}_${keyBody}`;

    // 计算过期时间
    let expiresAt: Date | null = null;
    if (expiresInDays) {
      expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + expiresInDays);
    }

    // 创建API密钥
    const newApiKey = await prisma.apiKey.create({
      data: {
        key: apiKey,
        name,
        description,
        groupId,
        userId,
        aiServiceId,
        quotaLimit: quotaLimit ? BigInt(quotaLimit) : null,
        quotaUsed: BigInt(0),
        status: 'active',
        expiresAt,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    // 静态AI服务信息
    const staticAiServices = {
      claude: {
        id: 'claude',
        serviceName: 'claude',
        displayName: 'Claude Code',
      },
      gemini: {
        id: 'gemini',
        serviceName: 'gemini',
        displayName: 'Gemini CLI',
      },
      ampcode: {
        id: 'ampcode',
        serviceName: 'ampcode',
        displayName: 'AmpCode',
      },
    };

    // 序列化BigInt的辅助函数
    const serializeBigInt = (obj: any): any => {
      if (obj === null || obj === undefined) return obj;
      if (typeof obj === 'bigint') return Number(obj);
      if (Array.isArray(obj)) return obj.map(serializeBigInt);
      if (typeof obj === 'object') {
        const result: any = {};
        for (const [key, value] of Object.entries(obj)) {
          result[key] = serializeBigInt(value);
        }
        return result;
      }
      return obj;
    };

    const result = serializeBigInt({
      ...newApiKey,
      aiService: staticAiServices[newApiKey.aiServiceId as keyof typeof staticAiServices] || {
        id: newApiKey.aiServiceId,
        serviceName: newApiKey.aiServiceId,
        displayName: newApiKey.aiServiceId,
      },
    });

    return createApiResponse(result, true, 201);

  } catch (error) {
    if (error instanceof z.ZodError) {
      return createErrorResponse(error.errors[0].message, 400);
    }

    console.error('Create API key error:', error);
    return createErrorResponse('创建API密钥失败', 500);
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
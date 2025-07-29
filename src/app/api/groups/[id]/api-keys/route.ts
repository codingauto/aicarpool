import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { withAuth, createApiResponse } from '@/lib/middleware';
import { randomBytes } from 'crypto';

const createApiKeySchema = z.object({
  name: z.string().min(1, 'API密钥名称不能为空').max(50, 'API密钥名称不能超过50个字符'),
  description: z.string().max(200, '描述不能超过200个字符').optional(),
  aiServiceId: z.string(),
  quotaLimit: z.number().positive('配额限制必须大于0').optional(),
  expiresInDays: z.number().positive('过期天数必须大于0').max(365, '过期天数不能超过365天').optional(),
});

// 获取拼车组的API密钥列表
async function getHandler(req: { params }: { params: { id: string } }) {
  try {
    const userId = user.id;
    const groupId = params.id;

    // 检查用户是否为该组成员
    const membership = await prisma.groupMember.findFirst({
      where: {
        groupId,
        userId,
        status: 'active',
      },
    });

    if (!membership) {
      return createApiResponse(false, null, '您不是该拼车组的成员', 403);
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
        aiService: {
          select: {
            id: true,
            serviceName: true,
            displayName: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // 格式化返回数据，对于非创建者隐藏密钥
    const formattedApiKeys = apiKeys.map((apiKey) => ({
      ...apiKey,
      key: apiKey.userId === userId ? apiKey.key : '***...***', // 只有创建者能看到完整密钥
    }));

    return createApiResponse(true, formattedApiKeys);

  } catch (error) {
    console.error('Get API keys error:', error);
    return createApiResponse(false, null, '获取API密钥列表失败', 500);
  }
}

// 创建新的API密钥
async function postHandler(req: { params }: { params: { id: string } }) {
  try {
    const body = await req.json();
    const validatedData = createApiKeySchema.parse(body);
    const userId = user.id;
    const groupId = params.id;

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
      return createApiResponse(false, null, '您不是该拼车组的成员', 403);
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
      return createApiResponse(false, null, '该AI服务未为拼车组启用', 400);
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
      return createApiResponse(false, null, '同名API密钥已存在', 400);
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
        aiService: {
          select: {
            id: true,
            serviceName: true,
            displayName: true,
          },
        },
      },
    });

    return createApiResponse(true, newApiKey, 'API密钥创建成功');

  } catch (error) {
    if (error instanceof z.ZodError) {
      return createApiResponse(false, null, error.errors[0].message, 400);
    }

    console.error('Create API key error:', error);
    return createApiResponse(false, null, '创建API密钥失败', 500);
  }
}

export const GET = withAuth(getHandler);
export const POST = withAuth(postHandler);
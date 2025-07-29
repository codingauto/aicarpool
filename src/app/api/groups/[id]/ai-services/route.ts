import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { withAuth, createApiResponse } from '@/lib/middleware';
import { AIServiceFactory, SupportedAIService } from '@/lib/ai-services/factory';
import { generateApiKey } from '@/lib/crypto';

const addAiServiceSchema = z.object({
  aiServiceId: z.string(),
  keyName: z.string().min(1, '密钥名称不能为空'),
  quota: z.object({
    dailyLimit: z.number().positive().optional(),
    monthlyLimit: z.number().positive().optional(),
  }).optional(),
  proxySettings: z.object({
    timeout: z.number().positive().optional(),
    retries: z.number().min(0).max(5).optional(),
  }).optional(),
});

const updateAiServiceSchema = z.object({
  isEnabled: z.boolean().optional(),
  authConfig: z.object({
    apiKey: z.string().min(1, 'API密钥不能为空'),
  }).optional(),
  quota: z.object({
    dailyLimit: z.number().positive().optional(),
    monthlyLimit: z.number().positive().optional(),
  }).optional(),
  proxySettings: z.object({
    timeout: z.number().positive().optional(),
    retries: z.number().min(0).max(5).optional(),
  }).optional(),
});

// 获取拼车组的AI服务配置
async function getHandler(req: { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = user.id;
    const { id: groupId } = await params;

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

    // 获取所有可用的AI服务
    const allAiServices = await prisma.aiService.findMany({
      where: { isEnabled: true },
      orderBy: { serviceName: 'asc' },
    });

    // 获取拼车组已配置的AI服务
    const groupAiServices = await prisma.groupAiService.findMany({
      where: { groupId },
      include: {
        aiService: true,
      },
    });

    // 组合数据
    const result = allAiServices.map((service) => {
      const groupService = groupAiServices.find(gas => gas.aiServiceId === service.id);
      
      return {
        aiService: service,
        isConfigured: !!groupService,
        isEnabled: groupService?.isEnabled || false,
        quota: groupService?.quota || null,
        proxySettings: groupService?.proxySettings || null,
        // 只有管理员能看到认证配置
        authConfig: membership.role === 'admin' ? groupService?.authConfig : null,
        configuredAt: groupService?.createdAt || null,
        updatedAt: groupService?.updatedAt || null,
      };
    });

    return createApiResponse(true, result);

  } catch (error) {
    console.error('Get group AI services error:', error);
    return createApiResponse(false, null, '获取AI服务配置失败', 500);
  }
}

// 为拼车组添加AI服务配置
async function postHandler(req: { params }: { params: Promise<{ id: string }> }) {
  try {
    const body = await req.json();
    const validatedData = addAiServiceSchema.parse(body);
    const userId = user.id;
    const { id: groupId } = await params;

    const { aiServiceId, keyName, quota, proxySettings } = validatedData;

    // 检查用户是否为该组管理员
    const membership = await prisma.groupMember.findFirst({
      where: {
        groupId,
        userId,
        status: 'active',
        role: 'admin',
      },
    });

    if (!membership) {
      return createApiResponse(false, null, '只有管理员可以配置AI服务', 403);
    }

    // 检查AI服务是否存在且可用
    const aiService = await prisma.aiService.findFirst({
      where: {
        id: aiServiceId,
        isEnabled: true,
      },
    });

    if (!aiService) {
      return createApiResponse(false, null, 'AI服务不存在或已被禁用', 404);
    }

    // 检查该服务是否已为拼车组配置
    const existingConfig = await prisma.groupAiService.findFirst({
      where: {
        groupId,
        aiServiceId,
      },
    });

    if (existingConfig) {
      return createApiResponse(false, null, '该AI服务已为拼车组配置', 400);
    }

    // 生成API密钥
    const generatedApiKey = generateApiKey('ac');
    const authConfig = {
      internalApiKey: generatedApiKey,
    };

    // 使用事务创建AI服务配置和API密钥
    const result = await prisma.$transaction(async (tx) => {
      // 创建AI服务配置
      const groupAiService = await tx.groupAiService.create({
        data: {
          groupId,
          aiServiceId,
          isEnabled: true,
          quota,
          authConfig,
          proxySettings,
        },
        include: {
          aiService: true,
        },
      });

      // 创建对应的API密钥记录
      const apiKey = await tx.apiKey.create({
        data: {
          name: keyName,
          description: `为${aiService.displayName}服务自动生成的密钥`,
          key: generatedApiKey,
          groupId,
          aiServiceId,
          userId,
          status: 'active',
          expiresAt: null, // 不设置过期时间
        },
      });

      return { groupAiService, apiKey };
    });

    return createApiResponse(true, {
      ...result.groupAiService,
      generatedApiKey, // 只在创建时返回完整密钥
    }, 'AI服务配置成功');

  } catch (error) {
    if (error instanceof z.ZodError) {
      return createApiResponse(false, null, error.errors[0].message, 400);
    }

    console.error('Add group AI service error:', error);
    return createApiResponse(false, null, '配置AI服务失败', 500);
  }
}

// 更新拼车组AI服务配置
async function putHandler(req: { params }: { params: Promise<{ id: string }> }) {
  try {
    const body = await req.json();
    const validatedData = updateAiServiceSchema.parse(body);
    const userId = user.id;
    const { id: groupId } = await params;

    const { aiServiceId } = body; // 需要从body中获取aiServiceId

    if (!aiServiceId) {
      return createApiResponse(false, null, '缺少AI服务ID', 400);
    }

    // 检查用户是否为该组管理员
    const membership = await prisma.groupMember.findFirst({
      where: {
        groupId,
        userId,
        status: 'active',
        role: 'admin',
      },
    });

    if (!membership) {
      return createApiResponse(false, null, '只有管理员可以修改AI服务配置', 403);
    }

    // 检查AI服务配置是否存在
    const existingConfig = await prisma.groupAiService.findFirst({
      where: {
        groupId,
        aiServiceId,
      },
    });

    if (!existingConfig) {
      return createApiResponse(false, null, 'AI服务配置不存在', 404);
    }

    // 更新AI服务配置
    const updatedConfig = await prisma.groupAiService.update({
      where: {
        id: existingConfig.id,
      },
      data: validatedData,
      include: {
        aiService: true,
      },
    });

    return createApiResponse(true, updatedConfig, 'AI服务配置更新成功');

  } catch (error) {
    if (error instanceof z.ZodError) {
      return createApiResponse(false, null, error.errors[0].message, 400);
    }

    console.error('Update group AI service error:', error);
    return createApiResponse(false, null, '更新AI服务配置失败', 500);
  }
}

export const GET = withAuth(getHandler);
export const POST = withAuth(postHandler);
export const PUT = withAuth(putHandler);
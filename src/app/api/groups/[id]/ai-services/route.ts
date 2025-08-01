import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { withAuth, createApiResponse, createErrorResponse } from '@/lib/middleware';
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
async function getHandler(req: NextRequest, user: any, { params }: { params: Promise<{ id: string }> }): Promise<any> {
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

    // 静态AI服务列表（包含多模型支持）
    const staticAiServices = {
      claude: {
        id: 'claude',
        serviceName: 'claude',
        displayName: 'Claude Code',
        description: 'Anthropic Claude AI服务 - 支持多模型切换',
        baseUrl: 'https://api.anthropic.com',
        isEnabled: true,
        category: 'primary',
        supportedModels: ['claude-4-sonnet', 'claude-4-opus', 'claude-3.5-sonnet'],
      },
      gemini: {
        id: 'gemini',
        serviceName: 'gemini',
        displayName: 'Gemini CLI',
        description: 'Google Gemini AI服务',
        baseUrl: 'https://generativelanguage.googleapis.com',
        isEnabled: true,
        category: 'primary',
        supportedModels: ['gemini-1.5-pro', 'gemini-1.5-flash'],
      },
      ampcode: {
        id: 'ampcode',
        serviceName: 'ampcode',
        displayName: 'AmpCode',
        description: 'AmpCode AI服务',
        baseUrl: 'https://api.ampcode.com',
        isEnabled: true,
        category: 'primary',
        supportedModels: ['ampcode-v1'],
      },
      kimi: {
        id: 'kimi',
        serviceName: 'kimi',
        displayName: 'Kimi K2 (2025)',
        description: 'Moonshot AI Kimi K2 - 1T参数MoE模型，优越的Agent能力',
        baseUrl: 'https://api.moonshot.cn',
        isEnabled: true,
        category: 'fallback',
        supportedModels: ['kimi-k2-instruct', 'kimi-k2-base', 'moonshot-v1-128k'],
      },
      zhipu: {
        id: 'zhipu',
        serviceName: 'zhipu',
        displayName: 'GLM-4.5 (2025)',
        description: '智谱GLM-4.5 - 3550亿参数，综合性能全球第三',
        baseUrl: 'https://open.bigmodel.cn',
        isEnabled: true,
        category: 'fallback',
        supportedModels: ['glm-4.5', 'glm-4.5-air', 'glm-4-plus', 'glm-4-flash'],
      },
      qwen: {
        id: 'qwen',
        serviceName: 'qwen',
        displayName: 'Qwen3 (2025)',
        description: '阿里通义千问Qwen3 - 235B MoE，支持思考模式',
        baseUrl: 'https://dashscope.aliyuncs.com',
        isEnabled: true,
        category: 'fallback',
        supportedModels: ['qwen3-32b', 'qwen3-14b', 'qwen3-8b', 'qwen3-coder-plus'],
      },
    };

    // 获取拼车组已配置的AI服务
    const groupAiServices = await prisma.groupAiService.findMany({
      where: { groupId },
    });

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

    // 组合数据
    const result = Object.values(staticAiServices).map((service) => {
      const groupService = groupAiServices.find(gas => gas.aiServiceId === service.id);
      
      return serializeBigInt({
        aiService: service,
        isConfigured: !!groupService,
        isEnabled: groupService?.isEnabled || false,
        quota: groupService?.quota || null,
        proxySettings: groupService?.proxySettings || null,
        // 只有管理员能看到认证配置
        authConfig: membership.role === 'admin' ? groupService?.authConfig : null,
        configuredAt: groupService?.createdAt || null,
        updatedAt: groupService?.updatedAt || null,
      });
    });

    return createApiResponse(result);

  } catch (error) {
    console.error('Get group AI services error:', error);
    return createErrorResponse('获取AI服务配置失败', 500);
  }
}

// 为拼车组添加AI服务配置
async function postHandler(req: NextRequest, user: any, { params }: { params: Promise<{ id: string }> }): Promise<any> {
  try {
    const body = await req.json();
    const validatedData = addAiServiceSchema.parse(body);
    const userId = user.id;
    const resolvedParams = await params;
    const groupId = resolvedParams.id;

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
      return createErrorResponse('只有管理员可以配置AI服务', 403);
    }

    // 检查AI服务是否在支持列表中
    const supportedServices = ['claude', 'gemini', 'ampcode'];
    if (!supportedServices.includes(aiServiceId)) {
      return createErrorResponse('不支持的AI服务', 404);
    }

    // 检查该服务是否已为拼车组配置
    const existingConfig = await prisma.groupAiService.findFirst({
      where: {
        groupId,
        aiServiceId,
      },
    });

    if (existingConfig) {
      return createErrorResponse('该AI服务已为拼车组配置', 400);
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
      });

      // 创建对应的API密钥记录
      const apiKey = await tx.apiKey.create({
        data: {
          name: keyName,
          description: `为${aiServiceId}服务自动生成的密钥`,
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

    // 静态AI服务信息
    const staticAiServices = {
      claude: {
        id: 'claude',
        serviceName: 'claude',
        displayName: 'Claude Code',
        description: 'Anthropic Claude AI服务',
        baseUrl: 'https://api.anthropic.com',
        isEnabled: true,
      },
      gemini: {
        id: 'gemini',
        serviceName: 'gemini',
        displayName: 'Gemini CLI',
        description: 'Google Gemini AI服务',
        baseUrl: 'https://generativelanguage.googleapis.com',
        isEnabled: true,
      },
      ampcode: {
        id: 'ampcode',
        serviceName: 'ampcode',
        displayName: 'AmpCode',
        description: 'AmpCode AI服务',
        baseUrl: 'https://api.ampcode.com',
        isEnabled: true,
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

    const responseData = serializeBigInt({
      ...result.groupAiService,
      aiService: staticAiServices[aiServiceId as keyof typeof staticAiServices],
      generatedApiKey, // 只在创建时返回完整密钥
    });

    return createApiResponse(responseData, true, 201);

  } catch (error) {
    if (error instanceof z.ZodError) {
      return createErrorResponse(error.issues[0].message, 400);
    }

    console.error('Add group AI service error:', error);
    return createErrorResponse('配置AI服务失败', 500);
  }
}

// 更新拼车组AI服务配置
async function putHandler(req: NextRequest, user: any, { params }: { params: Promise<{ id: string }> }): Promise<any> {
  try {
    const body = await req.json();
    const validatedData = updateAiServiceSchema.parse(body);
    const userId = user.id;
    const resolvedParams = await params;
    const groupId = resolvedParams.id;

    const { aiServiceId } = body; // 需要从body中获取aiServiceId

    if (!aiServiceId) {
      return createErrorResponse('缺少AI服务ID', 400);
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
      return createErrorResponse('只有管理员可以修改AI服务配置', 403);
    }

    // 检查AI服务配置是否存在
    const existingConfig = await prisma.groupAiService.findFirst({
      where: {
        groupId,
        aiServiceId,
      },
    });

    if (!existingConfig) {
      return createErrorResponse('AI服务配置不存在', 404);
    }

    // 更新AI服务配置
    const updatedConfig = await prisma.groupAiService.update({
      where: {
        id: existingConfig.id,
      },
      data: validatedData,
    });

    // 静态AI服务信息
    const staticAiServices = {
      claude: {
        id: 'claude',
        serviceName: 'claude',
        displayName: 'Claude Code',
        description: 'Anthropic Claude AI服务',
        baseUrl: 'https://api.anthropic.com',
        isEnabled: true,
      },
      gemini: {
        id: 'gemini',
        serviceName: 'gemini',
        displayName: 'Gemini CLI',
        description: 'Google Gemini AI服务',
        baseUrl: 'https://generativelanguage.googleapis.com',
        isEnabled: true,
      },
      ampcode: {
        id: 'ampcode',
        serviceName: 'ampcode',
        displayName: 'AmpCode',
        description: 'AmpCode AI服务',
        baseUrl: 'https://api.ampcode.com',
        isEnabled: true,
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

    const responseData = serializeBigInt({
      ...updatedConfig,
      aiService: staticAiServices[aiServiceId as keyof typeof staticAiServices],
    });

    return createApiResponse(responseData);

  } catch (error) {
    if (error instanceof z.ZodError) {
      return createErrorResponse(error.issues[0].message, 400);
    }

    console.error('Update group AI service error:', error);
    return createErrorResponse('更新AI服务配置失败', 500);
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
export const PUT = withAuthAndParams(putHandler);
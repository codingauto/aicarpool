import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { withAuth, createApiResponse } from '@/lib/middleware';

const createAiServiceSchema = z.object({
  serviceName: z.enum(['claude', 'gemini', 'ampcode']),
  displayName: z.string().min(1, '显示名称不能为空'),
  description: z.string().optional(),
  baseUrl: z.string().url('请输入有效的URL'),
  rateLimits: z.record(z.any()).optional(),
});

const updateAiServiceSchema = z.object({
  displayName: z.string().min(1, '显示名称不能为空').optional(),
  description: z.string().optional(),
  baseUrl: z.string().url('请输入有效的URL').optional(),
  isEnabled: z.boolean().optional(),
  rateLimits: z.record(z.any()).optional(),
});

// 获取所有AI服务
async function getHandler(req: NextRequest, user: any) {
  try {
    const services = await prisma.aiService.findMany({
      orderBy: {
        serviceName: 'asc',
      },
    });

    return createApiResponse(true, services);

  } catch (error) {
    console.error('Get AI services error:', error);
    return createApiResponse(false, null, '获取AI服务列表失败', 500);
  }
}

// 创建新的AI服务（仅管理员）
async function postHandler(req: NextRequest, user: any) {
  try {
    const body = await req.json();
    const validatedData = createAiServiceSchema.parse(body);
    const userRole = req.user!.role;

    // 检查是否为管理员
    if (userRole !== 'admin') {
      return createApiResponse(false, null, '只有管理员可以创建AI服务', 403);
    }

    const { serviceName, displayName, description, baseUrl, rateLimits } = validatedData;

    // 检查服务名是否已存在
    const existingService = await prisma.aiService.findUnique({
      where: { serviceName },
    });

    if (existingService) {
      return createApiResponse(false, null, '该AI服务已存在', 400);
    }

    // 创建AI服务
    const service = await prisma.aiService.create({
      data: {
        serviceName,
        displayName,
        description,
        baseUrl,
        rateLimits,
        isEnabled: true,
      },
    });

    return createApiResponse(true, service, 'AI服务创建成功');

  } catch (error) {
    if (error instanceof z.ZodError) {
      return createApiResponse(false, null, error.errors[0].message, 400);
    }

    console.error('Create AI service error:', error);
    return createApiResponse(false, null, '创建AI服务失败', 500);
  }
}

export const GET = withAuth(getHandler);
export const POST = withAuth(postHandler);
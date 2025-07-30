import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { createApiResponse } from '@/lib/middleware';
import { verifyToken } from '@/lib/auth';

const priorityUpdateSchema = z.object({
  services: z.array(z.object({
    aiServiceId: z.string(),
    priority: z.number().int().min(1).max(100),
  })),
});

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    const decoded = verifyToken(token);
    
    if (!decoded) {
      return createApiResponse(false, null, '未授权访问', 401);
    }

    const { id: groupId } = await params;
    
    // 验证用户是否为组管理员
    const groupMember = await prisma.groupMember.findFirst({
      where: {
        userId: decoded.userId,
        groupId: groupId,
        status: 'active',
        role: { in: ['admin', 'owner'] },
      },
    });

    if (!groupMember) {
      return createApiResponse(false, null, '无权管理该组的AI服务配置', 403);
    }

    const body = await request.json();
    const validatedData = priorityUpdateSchema.parse(body);

    // 批量更新优先级
    const updatePromises = validatedData.services.map(service => {
      return prisma.groupAiService.updateMany({
        where: {
          groupId: groupId,
          aiServiceId: service.aiServiceId,
        },
        data: {
          proxySettings: {
            priority: service.priority,
          },
        },
      });
    });

    await prisma.$transaction(updatePromises);

    return createApiResponse(true, { message: '优先级更新成功' });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return createApiResponse(false, null, error.issues[0].message, 400);
    }

    console.error('Update service priority error:', error);
    return createApiResponse(false, null, '更新服务优先级失败', 500);
  }
}
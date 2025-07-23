import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { withAuth, AuthenticatedRequest, createApiResponse } from '@/lib/middleware';

const updateGroupSchema = z.object({
  name: z.string().min(2, '组名至少需要2个字符').max(50, '组名不能超过50个字符').optional(),
  description: z.string().max(200, '描述不能超过200个字符').optional(),
  maxMembers: z.number().min(2, '最少需要2个成员').max(20, '最多支持20个成员').optional(),
  status: z.enum(['active', 'inactive', 'suspended']).optional(),
});

// 获取拼车组详细信息
async function getHandler(req: AuthenticatedRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = req.user!.userId;
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

    // 获取拼车组详细信息
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
          },
        },
        members: {
          where: { status: 'active' },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                avatar: true,
              },
            },
          },
          orderBy: {
            joinedAt: 'asc',
          },
        },
        aiServices: {
          include: {
            aiService: {
              select: {
                id: true,
                serviceName: true,
                displayName: true,
                description: true,
                baseUrl: true,
                isEnabled: true,
              },
            },
          },
        },
        apiKeys: {
          where: { status: { not: 'revoked' } },
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
        },
        invitations: {
          where: { status: 'pending' },
          include: {
            inviter: {
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
        },
        _count: {
          select: {
            members: {
              where: { status: 'active' },
            },
            apiKeys: {
              where: { status: 'active' },
            },
            usageStats: true,
          },
        },
      },
    });

    if (!group) {
      return createApiResponse(false, null, '拼车组不存在', 404);
    }

    // 格式化返回数据
    const result = {
      ...group,
      userRole: membership.role,
      userJoinedAt: membership.joinedAt,
      stats: {
        memberCount: group._count.members,
        apiKeyCount: group._count.apiKeys,
        aiServiceCount: group.aiServices.length,
        totalUsage: 0,
        totalCost: 0,
      },
    };

    return createApiResponse(true, result);

  } catch (error) {
    console.error('Get group details error:', error);
    return createApiResponse(false, null, '获取拼车组信息失败', 500);
  }
}

// 更新拼车组信息
async function putHandler(req: AuthenticatedRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const body = await req.json();
    const validatedData = updateGroupSchema.parse(body);
    const userId = req.user!.userId;
    const { id: groupId } = await params;

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
      return createApiResponse(false, null, '只有管理员可以修改拼车组信息', 403);
    }

    // 如果要修改组名，检查是否重复
    if (validatedData.name) {
      const existingGroup = await prisma.group.findFirst({
        where: {
          name: validatedData.name,
          id: { not: groupId },
          status: { not: 'deleted' },
        },
      });

      if (existingGroup) {
        return createApiResponse(false, null, '该组名已被使用', 400);
      }
    }

    // 更新拼车组信息
    const updatedGroup = await prisma.group.update({
      where: { id: groupId },
      data: validatedData,
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        _count: {
          select: {
            members: {
              where: { status: 'active' },
            },
          },
        },
      },
    });

    return createApiResponse(true, updatedGroup, '拼车组信息更新成功');

  } catch (error) {
    if (error instanceof z.ZodError) {
      return createApiResponse(false, null, error.errors[0].message, 400);
    }

    console.error('Update group error:', error);
    return createApiResponse(false, null, '更新拼车组信息失败', 500);
  }
}

// 删除拼车组
async function deleteHandler(req: AuthenticatedRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = req.user!.userId;
    const { id: groupId } = await params;

    // 检查用户是否为该组创建者
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      select: {
        id: true,
        createdById: true,
        name: true,
        _count: {
          select: {
            members: {
              where: { status: 'active' },
            },
            apiKeys: {
              where: { status: 'active' },
            },
          },
        },
      },
    });

    if (!group) {
      return createApiResponse(false, null, '拼车组不存在', 404);
    }

    if (group.createdById !== userId) {
      return createApiResponse(false, null, '只有组创建者可以删除拼车组', 403);
    }

    // 检查是否还有活跃的API密钥
    if (group._count.apiKeys > 0) {
      return createApiResponse(false, null, '请先撤销所有API密钥后再删除拼车组', 400);
    }

    // 软删除拼车组
    await prisma.$transaction(async (tx) => {
      // 更新组状态为已删除
      await tx.group.update({
        where: { id: groupId },
        data: { status: 'deleted' },
      });

      // 移除所有成员
      await tx.groupMember.updateMany({
        where: { groupId },
        data: { status: 'inactive' },
      });

      // 撤销待处理的邀请
      await tx.invitation.updateMany({
        where: { groupId, status: 'pending' },
        data: { status: 'revoked' },
      });
    });

    return createApiResponse(true, null, '拼车组删除成功');

  } catch (error) {
    console.error('Delete group error:', error);
    return createApiResponse(false, null, '删除拼车组失败', 500);
  }
}

export const GET = withAuth(getHandler);
export const PUT = withAuth(putHandler);
export const DELETE = withAuth(deleteHandler);
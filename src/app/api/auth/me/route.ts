import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { withAuth, AuthenticatedRequest, createApiResponse } from '@/lib/middleware';

async function handler(req: AuthenticatedRequest) {
  try {
    const userId = req.user!.userId;

    // 获取用户详细信息
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        avatar: true,
        role: true,
        status: true,
        emailVerified: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      return createApiResponse(false, null, '用户不存在', 404);
    }

    // 获取用户所属的组
    const groups = await prisma.groupMember.findMany({
      where: {
        userId: userId,
        status: 'active',
      },
      include: {
        group: {
          select: {
            id: true,
            name: true,
            description: true,
            status: true,
            createdAt: true,
          },
        },
      },
    });

    return createApiResponse(true, {
      user,
      groups: groups.map(gm => ({
        ...gm.group,
        memberRole: gm.role,
        joinedAt: gm.joinedAt,
      })),
    });

  } catch (error) {
    console.error('Get user profile error:', error);
    return createApiResponse(false, null, '获取用户信息失败', 500);
  }
}

export const GET = withAuth(handler);
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { withAuth, createApiResponse } from '@/lib/middleware';

const updateMemberSchema = z.object({
  memberId: z.string(),
  role: z.enum(['admin', 'member']).optional(),
  status: z.enum(['active', 'inactive']).optional(),
});

// 获取拼车组成员列表
async function getHandler(req: Request, { params }: { params: { id: string } }) {
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

    // 获取成员列表
    const members = await prisma.groupMember.findMany({
      where: {
        groupId,
        status: 'active',
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
            status: true,
            createdAt: true,
          },
        },
      },
      orderBy: [
        { role: 'asc' }, // admin first
        { joinedAt: 'asc' },
      ],
    });

    // 获取每个成员的使用统计
    const memberStats = await Promise.all(
      members.map(async (member) => {
        const stats = await prisma.usageStat.aggregate({
          where: {
            userId: member.userId,
            groupId,
            requestTime: {
              gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 最近30天
            },
          },
          _sum: {
            tokenCount: true,
            cost: true,
          },
          _count: {
            id: true,
          },
        });

        return {
          ...member,
          stats: {
            tokenCount: stats._sum.tokenCount || BigInt(0),
            cost: stats._sum.cost || 0,
            requestCount: stats._count.id,
          },
        };
      })
    );

    return createApiResponse(true, memberStats);

  } catch (error) {
    console.error('Get group members error:', error);
    return createApiResponse(false, null, '获取成员列表失败', 500);
  }
}

// 更新成员信息（角色、状态等）
async function putHandler(req: Request, { params }: { params: { id: string } }) {
  try {
    const body = await req.json();
    const validatedData = updateMemberSchema.parse(body);
    const userId = user.id;
    const groupId = params.id;

    const { memberId, role, status } = validatedData;

    // 检查当前用户是否为该组管理员
    const currentUserMembership = await prisma.groupMember.findFirst({
      where: {
        groupId,
        userId,
        status: 'active',
        role: 'admin',
      },
    });

    if (!currentUserMembership) {
      return createApiResponse(false, null, '只有管理员可以修改成员信息', 403);
    }

    // 检查目标成员是否存在
    const targetMember = await prisma.groupMember.findFirst({
      where: {
        id: memberId,
        groupId,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        group: {
          select: {
            createdById: true,
          },
        },
      },
    });

    if (!targetMember) {
      return createApiResponse(false, null, '成员不存在', 404);
    }

    // 不能修改组创建者的角色
    if (targetMember.user.id === targetMember.group.createdById && role === 'member') {
      return createApiResponse(false, null, '不能将组创建者降级为普通成员', 400);
    }

    // 不能修改自己的角色（防止最后一个管理员把自己降级）
    if (targetMember.user.id === userId && role === 'member') {
      // 检查是否还有其他管理员
      const otherAdmins = await prisma.groupMember.count({
        where: {
          groupId,
          role: 'admin',
          status: 'active',
          userId: { not: userId },
        },
      });

      if (otherAdmins === 0) {
        return createApiResponse(false, null, '拼车组至少需要一个管理员', 400);
      }
    }

    // 更新成员信息
    const updatedMember = await prisma.groupMember.update({
      where: { id: memberId },
      data: {
        ...(role && { role }),
        ...(status && { status }),
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
            status: true,
            createdAt: true,
          },
        },
      },
    });

    return createApiResponse(true, updatedMember, '成员信息更新成功');

  } catch (error) {
    if (error instanceof z.ZodError) {
      return createApiResponse(false, null, error.errors[0].message, 400);
    }

    console.error('Update member error:', error);
    return createApiResponse(false, null, '更新成员信息失败', 500);
  }
}

export const GET = withAuth(getHandler);
export const PUT = withAuth(putHandler);
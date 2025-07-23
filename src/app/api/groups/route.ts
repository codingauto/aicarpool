import { z } from 'zod';
import { prisma } from '@/lib/db';
import { withAuth, AuthenticatedRequest, createApiResponse } from '@/lib/middleware';

const createGroupSchema = z.object({
  name: z.string().min(2, '组名至少需要2个字符').max(50, '组名不能超过50个字符'),
  description: z.string().max(200, '描述不能超过200个字符').optional(),
  maxMembers: z.number().min(2, '最少需要2个成员').max(20, '最多支持20个成员').default(5),
});

// 获取用户的所有拼车组
async function getHandler(req: AuthenticatedRequest) {
  try {
    const userId = req.user!.userId;

    const groups = await prisma.groupMember.findMany({
      where: {
        userId,
        status: 'active',
      },
      include: {
        group: {
          include: {
            createdBy: {
              select: {
                id: true,
                name: true,
                email: true,
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
            },
            aiServices: {
              where: { isEnabled: true },
              include: {
                aiService: {
                  select: {
                    id: true,
                    serviceName: true,
                    displayName: true,
                  },
                },
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
              },
            },
          },
        },
      },
      orderBy: {
        joinedAt: 'desc',
      },
    });

    const formattedGroups = groups.map((gm) => ({
      id: gm.group.id,
      name: gm.group.name,
      description: gm.group.description,
      maxMembers: gm.group.maxMembers,
      status: gm.group.status,
      settings: gm.group.settings,
      createdBy: gm.group.createdBy,
      createdAt: gm.group.createdAt,
      updatedAt: gm.group.updatedAt,
      memberRole: gm.role,
      joinedAt: gm.joinedAt,
      members: gm.group.members.map((m) => ({
        id: m.id,
        role: m.role,
        status: m.status,
        joinedAt: m.joinedAt,
        user: m.user,
      })),
      aiServices: gm.group.aiServices.map((as) => ({
        id: as.id,
        isEnabled: as.isEnabled,
        quota: as.quota,
        aiService: as.aiService,
      })),
      stats: {
        memberCount: gm.group._count.members,
        apiKeyCount: gm.group._count.apiKeys,
      },
    }));

    return createApiResponse(true, formattedGroups);

  } catch (error) {
    console.error('Get groups error:', error);
    return createApiResponse(false, null, '获取拼车组列表失败', 500);
  }
}

// 创建新的拼车组
async function postHandler(req: AuthenticatedRequest) {
  try {
    const body = await req.json();
    const validatedData = createGroupSchema.parse(body);
    const userId = req.user!.userId;

    const { name, description, maxMembers } = validatedData;

    // 检查组名是否已存在
    const existingGroup = await prisma.group.findFirst({
      where: {
        name,
        status: { not: 'deleted' },
      },
    });

    if (existingGroup) {
      return createApiResponse(false, null, '该组名已被使用', 400);
    }

    // 创建拼车组和管理员成员关系
    const result = await prisma.$transaction(async (tx) => {
      // 创建拼车组
      const group = await tx.group.create({
        data: {
          name,
          description,
          maxMembers,
          createdById: userId,
          status: 'active',
        },
      });

      // 添加创建者为管理员
      await tx.groupMember.create({
        data: {
          groupId: group.id,
          userId,
          role: 'admin',
          status: 'active',
        },
      });

      return group;
    });

    // 获取完整的组信息
    const groupWithDetails = await prisma.group.findUnique({
      where: { id: result.id },
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
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

    return createApiResponse(true, groupWithDetails, '拼车组创建成功');

  } catch (error) {
    if (error instanceof z.ZodError) {
      return createApiResponse(false, null, error.errors[0].message, 400);
    }

    console.error('Create group error:', error);
    return createApiResponse(false, null, '创建拼车组失败', 500);
  }
}

export const GET = withAuth(getHandler);
export const POST = withAuth(postHandler);
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { withAuth, createApiResponse, createErrorResponse } from '@/lib/middleware';
import { hashPassword } from '@/lib/auth';

const updateProfileSchema = z.object({
  name: z.string().min(2, '姓名至少需要2个字符').optional(),
  avatar: z.string().url('头像必须是有效的URL').optional(),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, '请输入当前密码'),
  newPassword: z.string().min(6, '新密码至少需要6个字符'),
});

// 获取用户档案
async function getHandler(req: NextRequest, user: any) {
  try {
    const userId = user.id;

    const userData = await prisma.user.findUnique({
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
        groups: {
          where: { status: 'active' },
          select: {
            role: true,
            joinedAt: true,
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
        },
        apiKeys: {
          where: { status: 'active' },
          select: {
            id: true,
            name: true,
            aiServiceId: true,
            quotaLimit: true,
            quotaUsed: true,
            status: true,
            lastUsedAt: true,
            createdAt: true,
          },
        },
      },
    });

    if (!userData) {
      return createErrorResponse('用户不存在', 404);
    }

    // 格式化返回数据，处理 BigInt 类型
    const formattedData = {
      ...userData,
      groups: userData.groups.map(gm => ({
        ...gm.group,
        memberRole: gm.role,
        joinedAt: gm.joinedAt,
      })),
      apiKeys: userData.apiKeys.map(key => ({
        ...key,
        quotaLimit: key.quotaLimit ? key.quotaLimit.toString() : null,
        quotaUsed: key.quotaUsed.toString(),
      })),
    };

    return createApiResponse(formattedData);

  } catch (error) {
    console.error('Get user profile error:', error);
    return createErrorResponse('获取用户档案失败', 500);
  }
}

// 更新用户档案
async function putHandler(req: NextRequest, user: any) {
  try {
    const body = await req.json();
    const validatedData = updateProfileSchema.parse(body);
    const userId = user.id;

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: validatedData,
      select: {
        id: true,
        name: true,
        email: true,
        avatar: true,
        role: true,
        status: true,
        emailVerified: true,
        updatedAt: true,
      },
    });

    return createApiResponse(updatedUser);

  } catch (error) {
    if (error instanceof z.ZodError) {
      return createErrorResponse(error.issues[0].message, 400);
    }

    console.error('Update user profile error:', error);
    return createErrorResponse('更新档案失败', 500);
  }
}

export const GET = withAuth(getHandler);
export const PUT = withAuth(putHandler);
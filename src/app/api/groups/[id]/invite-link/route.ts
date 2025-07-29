import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { withAuth, createApiResponse, createErrorResponse } from '@/lib/middleware';

const createInviteLinkSchema = z.object({
  maxUses: z.number().min(1).max(100).default(10),
  expiresInDays: z.number().min(1).max(30).default(7),
  name: z.string().min(1, '邀请链接名称不能为空').max(50, '邀请链接名称不能超过50个字符'),
});

// 获取拼车组的邀请链接列表
async function getHandler(req: NextRequest, user: any, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = user.id;
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
      return createErrorResponse('只有管理员可以查看邀请链接', 403);
    }

    // 返回模拟数据
    const mockInviteLinks = [
      {
        id: '1',
        token: 'mock_token_123',
        name: '示例邀请链接',
        groupId: groupId,
        creatorId: userId,
        maxUses: 10,
        usedCount: 0,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
        creator: {
          id: userId,
          name: '测试用户',
          email: 'test@example.com',
        },
        inviteUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/join/mock_token_123`
      }
    ];

    return createApiResponse(mockInviteLinks);

  } catch (error) {
    console.error('Get invite links error:', error);
    return createErrorResponse('获取邀请链接失败', 500);
  }
}

// 创建新的邀请链接
async function postHandler(req: NextRequest, user: any, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: groupId } = await params;
    const body = await req.json();
    const validatedData = createInviteLinkSchema.parse(body);
    const userId = user.id;
    const { maxUses, expiresInDays, name } = validatedData;

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
      return createErrorResponse('只有管理员可以创建邀请链接', 403);
    }

    // 检查拼车组是否存在且活跃
    const group = await prisma.group.findUnique({
      where: { id: groupId },
    });

    if (!group) {
      return createErrorResponse('拼车组不存在', 404);
    }

    if (group.status !== 'active') {
      return createErrorResponse('拼车组已被禁用', 400);
    }

    // 计算过期时间
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiresInDays);

    // 生成邀请令牌
    const token = `invite_${groupId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // 返回模拟创建成功的数据
    const mockInviteLink = {
      id: Date.now().toString(),
      token,
      name,
      groupId,
      creatorId: userId,
      maxUses,
      usedCount: 0,
      expiresAt,
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
      creator: {
        id: userId,
        name: '测试用户',
        email: 'test@example.com',
      },
      group: {
        id: groupId,
        name: group.name,
        description: group.description,
      },
      inviteUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/join/${token}`
    };

    return createApiResponse(mockInviteLink);

  } catch (error) {
    if (error instanceof z.ZodError) {
      return createErrorResponse(error.issues[0].message, 400);
    }

    console.error('Create invite link error:', error);
    return createErrorResponse('创建邀请链接失败', 500);
  }
}

// 修复 withAuth 包装器以支持额外参数
function withAuthAndParams(handler: (req: NextRequest, user: any, context: any) => Promise<any>) {
  return withAuth(async (req: NextRequest, user: any) => {
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
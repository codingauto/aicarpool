import { z } from 'zod';
import { prisma } from '@/lib/db';
import { withAuth, AuthenticatedRequest, createApiResponse, serializeBigInt } from '@/lib/middleware';
import { generateInviteToken } from '@/lib/auth';

const createInviteLinkSchema = z.object({
  maxUses: z.number().min(1).max(100).default(10), // 最大使用次数
  expiresInDays: z.number().min(1).max(30).default(7),
  name: z.string().min(1, '邀请链接名称不能为空').max(50, '邀请链接名称不能超过50个字符'),
});

// 获取拼车组的邀请链接列表
async function getHandler(req: AuthenticatedRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = req.user!.userId;
    const resolvedParams = await params;
    const groupId = resolvedParams.id;

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
      return createApiResponse(false, null, '只有管理员可以查看邀请链接', 403);
    }

    // 获取邀请链接列表
    const inviteLinks = await prisma.inviteLink.findMany({
      where: { groupId },
      include: {
        creator: {
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
    });

    return createApiResponse(true, inviteLinks.map((link: any) => serializeBigInt(link)));

  } catch (error) {
    console.error('Get invite links error:', error);
    return createApiResponse(false, null, '获取邀请链接失败', 500);
  }
}

// 创建新的邀请链接
async function postHandler(req: AuthenticatedRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    console.log('=== 创建邀请链接开始 ===');
    console.log('用户ID:', req.user?.userId);
    
    const resolvedParams = await params;
    const groupId = resolvedParams.id;
    console.log('拼车组ID:', groupId);

    const body = await req.json();
    console.log('请求数据:', body);

    const validatedData = createInviteLinkSchema.parse(body);
    console.log('验证后数据:', validatedData);

    const userId = req.user!.userId;
    const { maxUses, expiresInDays, name } = validatedData;

    // 检查用户是否为该组管理员
    console.log('检查管理员权限...');
    const membership = await prisma.groupMember.findFirst({
      where: {
        groupId,
        userId,
        status: 'active',
        role: 'admin',
      },
    });

    console.log('用户权限查询结果:', membership);

    if (!membership) {
      console.log('权限检查失败: 用户不是管理员');
      return createApiResponse(false, null, '只有管理员可以创建邀请链接', 403);
    }

    // 检查拼车组是否存在且活跃
    console.log('检查拼车组状态...');
    const group = await prisma.group.findUnique({
      where: { id: groupId },
    });

    console.log('拼车组查询结果:', group);

    if (!group) {
      console.log('拼车组不存在');
      return createApiResponse(false, null, '拼车组不存在', 404);
    }

    if (group.status !== 'active') {
      console.log('拼车组状态异常:', group.status);
      return createApiResponse(false, null, '拼车组已被禁用', 400);
    }

    // 计算过期时间
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiresInDays);
    console.log('过期时间:', expiresAt);

    // 生成邀请令牌
    const token = generateInviteToken(groupId, `link_${Date.now()}`);
    console.log('生成的令牌:', token);

    // 创建邀请链接
    console.log('创建邀请链接到数据库...');
    const inviteLink = await prisma.inviteLink.create({
      data: {
        token,
        name,
        groupId,
        creatorId: userId,
        maxUses,
        usedCount: 0,
        expiresAt,
        status: 'active',
      },
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        group: {
          select: {
            id: true,
            name: true,
            description: true,
          },
        },
      },
    });

    console.log('邀请链接创建成功:', inviteLink);

    // 生成邀请链接URL
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const inviteUrl = `${baseUrl}/join/${token}`;
    console.log('邀请链接URL:', inviteUrl);

    const result = {
      ...serializeBigInt(inviteLink),
      inviteUrl,
    };

    console.log('=== 创建邀请链接成功 ===');
    return createApiResponse(true, result, '邀请链接创建成功');

  } catch (error) {
    console.error('=== 创建邀请链接失败 ===');
    console.error('错误详情:', error);
    console.error('错误堆栈:', error instanceof Error ? error.stack : 'No stack trace');

    // 处理Zod验证错误
    if (error && typeof error === 'object' && 'issues' in error) {
      const zodError = error as { issues: Array<{ message: string; path: string[] }> };
      console.error('Zod验证错误:', zodError.issues);
      const errorMessage = zodError.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`).join(', ');
      return createApiResponse(false, null, `数据验证失败: ${errorMessage}`, 400);
    }

    // 处理Prisma错误
    if (error && typeof error === 'object' && 'code' in error) {
      const prismaError = error as { code: string; message: string };
      console.error('Prisma错误代码:', prismaError.code);
      console.error('Prisma错误信息:', prismaError.message);
      
      switch (prismaError.code) {
        case 'P2002':
          return createApiResponse(false, null, '邀请链接令牌重复，请重试', 400);
        case 'P2025':
          return createApiResponse(false, null, '相关记录不存在', 404);
        case 'P1001':
          return createApiResponse(false, null, '数据库连接失败，请稍后重试', 503);
        default:
          return createApiResponse(false, null, `数据库操作失败: ${prismaError.message}`, 500);
      }
    }

    // 处理JWT错误
    if (error instanceof Error && error.message.includes('token')) {
      console.error('JWT令牌错误:', error.message);
      return createApiResponse(false, null, '令牌生成失败，请重试', 500);
    }

    // 通用错误处理
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    return createApiResponse(false, null, `创建邀请链接失败: ${errorMessage}`, 500);
  }
}

export const GET = withAuth(getHandler);
export const POST = withAuth(postHandler);
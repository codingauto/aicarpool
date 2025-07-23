import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { createApiResponse, serializeBigInt } from '@/lib/middleware';

// 验证邀请token
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    const invitation = await prisma.invitation.findUnique({
      where: { token },
      include: {
        group: {
          select: {
            id: true,
            name: true,
            description: true,
            maxMembers: true,
            _count: {
              select: {
                members: {
                  where: { status: 'active' },
                },
              },
            },
          },
        },
        inviter: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!invitation) {
      return createApiResponse(false, null, '邀请不存在', 404);
    }

    if (invitation.status !== 'pending') {
      return createApiResponse(false, null, '邀请已失效', 400);
    }

    if (invitation.expiresAt < new Date()) {
      // 自动更新过期邀请状态
      await prisma.invitation.update({
        where: { id: invitation.id },
        data: { status: 'expired' },
      });
      return createApiResponse(false, null, '邀请已过期', 400);
    }

    // 检查拼车组是否已满
    if (invitation.group._count.members >= invitation.group.maxMembers) {
      return createApiResponse(false, null, '拼车组已满', 400);
    }

    return createApiResponse(true, serializeBigInt(invitation), '邀请有效');

  } catch (error) {
    console.error('Verify invitation error:', error);
    return createApiResponse(false, null, '验证邀请失败', 500);
  }
}

// 接受邀请
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const { userId } = await req.json();

    if (!userId) {
      return createApiResponse(false, null, '用户ID不能为空', 400);
    }

    const invitation = await prisma.invitation.findUnique({
      where: { token },
      include: {
        group: true,
        inviter: true,
      },
    });

    if (!invitation) {
      return createApiResponse(false, null, '邀请不存在', 404);
    }

    if (invitation.status !== 'pending') {
      return createApiResponse(false, null, '邀请已失效', 400);
    }

    if (invitation.expiresAt < new Date()) {
      await prisma.invitation.update({
        where: { id: invitation.id },
        data: { status: 'expired' },
      });
      return createApiResponse(false, null, '邀请已过期', 400);
    }

    // 验证用户邮箱是否匹配
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return createApiResponse(false, null, '用户不存在', 404);
    }

    if (user.email !== invitation.email) {
      return createApiResponse(false, null, '邮箱地址不匹配', 400);
    }

    // 检查是否已是成员
    const existingMember = await prisma.groupMember.findFirst({
      where: {
        groupId: invitation.groupId,
        userId: userId,
      },
    });

    if (existingMember) {
      return createApiResponse(false, null, '您已经是该拼车组成员', 400);
    }

    // 检查拼车组是否已满
    const memberCount = await prisma.groupMember.count({
      where: {
        groupId: invitation.groupId,
        status: 'active',
      },
    });

    if (memberCount >= invitation.group.maxMembers) {
      return createApiResponse(false, null, '拼车组已满', 400);
    }

    // 使用事务处理邀请接受
    const result = await prisma.$transaction(async (tx) => {
      // 更新邀请状态
      await tx.invitation.update({
        where: { id: invitation.id },
        data: { status: 'accepted' },
      });

      // 添加用户到拼车组
      const member = await tx.groupMember.create({
        data: {
          groupId: invitation.groupId,
          userId: userId,
          role: 'member',
          status: 'active',
        },
        include: {
          group: true,
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      });

      return member;
    });

    // 发送欢迎邮件
    const { emailQueue } = await import('@/lib/email');
    await emailQueue.addToQueue('welcome', {
      to: user.email,
      userName: user.name,
      groupName: invitation.group.name,
    });

    return createApiResponse(true, serializeBigInt(result), '成功加入拼车组');

  } catch (error) {
    console.error('Accept invitation error:', error);
    return createApiResponse(false, null, '接受邀请失败', 500);
  }
}
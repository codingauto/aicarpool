import { z } from 'zod';
import { prisma } from '@/lib/db';
import { withAuth, AuthenticatedRequest, createApiResponse, serializeBigInt } from '@/lib/middleware';
import { generateInviteToken } from '@/lib/auth';
import { emailQueue } from '@/lib/email';

// 重新发送邀请
async function postHandler(
  req: AuthenticatedRequest, 
  { params }: { params: { id: string; invitationId: string } }
) {
  try {
    const userId = req.user!.userId;
    const groupId = params.id;
    const invitationId = params.invitationId;

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
      return createApiResponse(false, null, '只有管理员可以重新发送邀请', 403);
    }

    // 查找邀请
    const invitation = await prisma.invitation.findUnique({
      where: { id: invitationId },
      include: {
        group: {
          select: {
            id: true,
            name: true,
            description: true,
            maxMembers: true,
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

    if (invitation.groupId !== groupId) {
      return createApiResponse(false, null, '邀请不属于该拼车组', 400);
    }

    if (invitation.status !== 'pending') {
      return createApiResponse(false, null, '只能重新发送待处理的邀请', 400);
    }

    // 检查是否已过期
    if (invitation.expiresAt < new Date()) {
      // 延长过期时间
      const newExpiresAt = new Date();
      newExpiresAt.setDate(newExpiresAt.getDate() + 7);

      await prisma.invitation.update({
        where: { id: invitationId },
        data: { expiresAt: newExpiresAt },
      });
    }

    // 生成邀请链接
    const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001'}/invite/${invitation.token}`;

    // 重新发送邀请邮件
    await emailQueue.addToQueue('invitation', {
      to: invitation.email,
      inviterName: invitation.inviter.name,
      groupName: invitation.group.name,
      invitationLink: inviteUrl,
    });

    const result = {
      ...serializeBigInt(invitation),
      inviteUrl,
    };

    return createApiResponse(true, result, '邀请已重新发送');

  } catch (error) {
    console.error('Resend invitation error:', error);
    return createApiResponse(false, null, '重新发送邀请失败', 500);
  }
}

// 撤销邀请
async function deleteHandler(
  req: AuthenticatedRequest, 
  { params }: { params: { id: string; invitationId: string } }
) {
  try {
    const userId = req.user!.userId;
    const groupId = params.id;
    const invitationId = params.invitationId;

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
      return createApiResponse(false, null, '只有管理员可以撤销邀请', 403);
    }

    // 查找邀请
    const invitation = await prisma.invitation.findUnique({
      where: { id: invitationId },
      include: {
        group: true,
      },
    });

    if (!invitation) {
      return createApiResponse(false, null, '邀请不存在', 404);
    }

    if (invitation.groupId !== groupId) {
      return createApiResponse(false, null, '邀请不属于该拼车组', 400);
    }

    if (invitation.status !== 'pending') {
      return createApiResponse(false, null, '只能撤销待处理的邀请', 400);
    }

    // 更新邀请状态为已撤销
    const updatedInvitation = await prisma.invitation.update({
      where: { id: invitationId },
      data: { status: 'cancelled' },
      include: {
        inviter: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    return createApiResponse(true, serializeBigInt(updatedInvitation), '邀请已撤销');

  } catch (error) {
    console.error('Cancel invitation error:', error);
    return createApiResponse(false, null, '撤销邀请失败', 500);
  }
}

export const POST = withAuth(postHandler);
export const DELETE = withAuth(deleteHandler);
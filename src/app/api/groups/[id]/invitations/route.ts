import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { withAuth, createApiResponse } from '@/lib/middleware';
import { generateInviteToken } from '@/lib/auth';
import { emailQueue } from '@/lib/email';

const createInvitationSchema = z.object({
  email: z.string().email('请输入有效的邮箱地址'),
  expiresInDays: z.number().min(1).max(30).default(7),
});

// 获取拼车组的邀请列表
async function getHandler(req: Request, { params }: { params: { id: string } }) {
  try {
    const userId = user.id;
    const groupId = params.id;

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
      return createApiResponse(false, null, '只有管理员可以查看邀请列表', 403);
    }

    // 获取邀请列表
    const invitations = await prisma.invitation.findMany({
      where: { groupId },
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
    });

    return createApiResponse(true, invitations);

  } catch (error) {
    console.error('Get invitations error:', error);
    return createApiResponse(false, null, '获取邀请列表失败', 500);
  }
}

// 创建新邀请
async function postHandler(req: Request, { params }: { params: { id: string } }) {
  try {
    const body = await req.json();
    const validatedData = createInvitationSchema.parse(body);
    const userId = user.id;
    const groupId = params.id;

    const { email, expiresInDays } = validatedData;

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
      return createApiResponse(false, null, '只有管理员可以邀请成员', 403);
    }

    // 检查拼车组是否存在且活跃
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      include: {
        _count: {
          select: {
            members: {
              where: { status: 'active' },
            },
          },
        },
      },
    });

    if (!group || group.status !== 'active') {
      return createApiResponse(false, null, '拼车组不存在或已被禁用', 400);
    }

    // 检查是否已达到最大成员数
    if (group._count.members >= group.maxMembers) {
      return createApiResponse(false, null, '拼车组已达到最大成员数', 400);
    }

    // 检查用户是否已是成员
    const existingMember = await prisma.groupMember.findFirst({
      where: {
        groupId,
        user: { email },
        status: 'active',
      },
    });

    if (existingMember) {
      return createApiResponse(false, null, '该用户已是拼车组成员', 400);
    }

    // 检查是否有待处理的邀请
    const existingInvitation = await prisma.invitation.findFirst({
      where: {
        groupId,
        email,
        status: 'pending',
        expiresAt: { gt: new Date() },
      },
    });

    if (existingInvitation) {
      return createApiResponse(false, null, '该邮箱已有待处理的邀请', 400);
    }

    // 计算过期时间
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiresInDays);

    // 生成邀请令牌
    const token = generateInviteToken(groupId, email);

    // 创建邀请
    const invitation = await prisma.invitation.create({
      data: {
        token,
        email,
        groupId,
        inviterId: userId,
        expiresAt,
        status: 'pending',
      },
      include: {
        inviter: {
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

    // 生成邀请链接
    const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001'}/invite/${token}`;

    // 发送邀请邮件
    await emailQueue.addToQueue('invitation', {
      to: email,
      inviterName: invitation.inviter.name,
      groupName: invitation.group.name,
      invitationLink: inviteUrl,
    });

    const result = {
      ...serializeBigInt(invitation),
      inviteUrl,
    };

    return createApiResponse(true, result, '邀请创建成功，邮件已发送');

  } catch (error) {
    if (error && typeof error === 'object' && 'issues' in error) {
      return createApiResponse(false, null, (error as { issues: Array<{ message: string }> }).issues[0].message, 400);
    }

    console.error('Create invitation error:', error);
    return createApiResponse(false, null, '创建邀请失败', 500);
  }
}

// 撤销邀请
async function deleteHandler(req: Request, { params }: { params: { id: string } }) {
  try {
    const body = await req.json();
    const { invitationId } = body;
    const userId = user.id;
    const groupId = params.id;

    if (!invitationId) {
      return createApiResponse(false, null, '邀请ID不能为空', 400);
    }

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

    return createApiResponse(true(updatedInvitation), '邀请已撤销');

  } catch (error) {
    console.error('Cancel invitation error:', error);
    return createApiResponse(false, null, '撤销邀请失败', 500);
  }
}

export const GET = withAuth(getHandler);
export const POST = withAuth(postHandler);
export const DELETE = withAuth(deleteHandler);
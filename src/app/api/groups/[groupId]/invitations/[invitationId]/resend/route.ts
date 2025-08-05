/**
 * 重发邀请API
 */

import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { createApiResponse } from '@/lib/middleware';
import { verifyToken } from '@/lib/auth';

const prisma = new PrismaClient();

/**
 * 重发邀请
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ groupId: string; invitationId: string }> }
) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) {
      return createApiResponse(false, null, '缺少认证令牌', 401);
    }

    const user = await verifyToken(token);
    if (!user) {
      return createApiResponse(false, null, '认证令牌无效', 401);
    }

    const resolvedParams = await params;
    const { groupId, invitationId } = resolvedParams;

    // 验证当前用户是否为拼车组管理员
    const groupMembership = await prisma.groupMember.findFirst({
      where: {
        groupId,
        userId: user.id,
        role: { in: ['admin', 'owner'] },
        status: 'active'
      }
    });

    if (!groupMembership) {
      return createApiResponse(false, null, '无权限管理邀请', 403);
    }

    // 查找邀请
    const invitation = await prisma.invitation.findFirst({
      where: {
        id: invitationId,
        groupId: groupId
      }
    });

    if (!invitation) {
      return createApiResponse(false, null, '邀请不存在', 404);
    }

    if (invitation.status !== 'pending') {
      return createApiResponse(false, null, '只能重发待处理的邀请', 400);
    }

    // 延长过期时间
    const newExpiresAt = new Date();
    newExpiresAt.setDate(newExpiresAt.getDate() + 7);

    await prisma.invitation.update({
      where: { id: invitationId },
      data: { expiresAt: newExpiresAt }
    });

    console.log(`✅ API 邀请管理: 成功重发邀请 ${invitationId}`);

    // TODO: 重新发送邀请邮件
    // await sendInvitationEmail(invitation);

    return createApiResponse(true, true, '邀请已重新发送', 200);

  } catch (error) {
    console.error('重发邀请失败:', error);
    return createApiResponse(false, null, '重发邀请失败', 500);
  }
}
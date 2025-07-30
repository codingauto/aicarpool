import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { withAuth, createApiResponse } from '@/lib/middleware';
import { generateInviteToken, verifyToken } from '@/lib/auth';
import { NextRequest } from 'next/server';
import { emailQueue } from '@/lib/email';

const batchInvitationSchema = z.object({
  emails: z.array(z.string().email('请输入有效的邮箱地址')).min(1, '至少需要一个邮箱地址').max(50, '一次最多邀请50个用户'),
  expiresInDays: z.number().min(1).max(30).default(7),
});

// 序列化BigInt的辅助函数
const serializeBigInt = (obj: any): any => {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'bigint') return Number(obj);
  if (Array.isArray(obj)) return obj.map(serializeBigInt);
  if (typeof obj === 'object') {
    const result: any = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = serializeBigInt(value);
    }
    return result;
  }
  return obj;
};

// 批量创建邀请
async function postHandler(req: Request, { params }: { params: Promise<{ id: string }> }, user: any) {
  try {
    const body = await req.json();
    const validatedData = batchInvitationSchema.parse(body);
    const userId = user.id;
    const { id: groupId } = await params;

    const { emails, expiresInDays } = validatedData;

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

    // 去重邮箱
    const uniqueEmails = [...new Set(emails)];
    
    // 检查邮箱是否超出最大成员数限制
    if (group._count.members + uniqueEmails.length > group.maxMembers) {
      return createApiResponse(false, null, `批量邀请后将超出最大成员数限制（${group.maxMembers}人）`, 400);
    }

    // 批量检查已存在的成员和待处理的邀请
    const existingMembers = await prisma.groupMember.findMany({
      where: {
        groupId,
        user: { email: { in: uniqueEmails } },
        status: 'active',
      },
      include: {
        user: { select: { email: true } },
      },
    });

    const existingInvitations = await prisma.invitation.findMany({
      where: {
        groupId,
        email: { in: uniqueEmails },
        status: 'pending',
        expiresAt: { gt: new Date() },
      },
    });

    const existingMemberEmails = existingMembers.map(m => m.user.email);
    const existingInvitationEmails = existingInvitations.map(i => i.email);
    
    // 过滤出需要邀请的邮箱
    const emailsToInvite = uniqueEmails.filter(email => 
      !existingMemberEmails.includes(email) && !existingInvitationEmails.includes(email)
    );

    if (emailsToInvite.length === 0) {
      return createApiResponse(false, null, '所有邮箱都已是成员或已有待处理的邀请', 400);
    }

    // 计算过期时间
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiresInDays);

    // 批量创建邀请
    const invitations = [];
    const failedEmails = [];

    for (const email of emailsToInvite) {
      try {
        // 生成邀请令牌
        const token = generateInviteToken({ groupId, email });

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

        invitations.push(invitation);

        // 生成邀请链接并发送邮件
        const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001'}/invite/${token}`;
        
        await emailQueue.addToQueue('invitation', {
          to: email,
          inviterName: invitation.inviter.name,
          groupName: invitation.group.name,
          invitationLink: inviteUrl,
        });

      } catch (error) {
        console.error(`Failed to create invitation for ${email}:`, error);
        failedEmails.push(email);
      }
    }

    const result = {
      successful: invitations.map(inv => serializeBigInt(inv)),
      failed: failedEmails,
      skipped: {
        existingMembers: existingMemberEmails,
        existingInvitations: existingInvitationEmails,
      },
      summary: {
        total: uniqueEmails.length,
        successful: invitations.length,
        failed: failedEmails.length,
        skippedMembers: existingMemberEmails.length,
        skippedInvitations: existingInvitationEmails.length,
      },
    };

    let message = `成功发送 ${invitations.length} 个邀请`;
    if (failedEmails.length > 0) {
      message += `，${failedEmails.length} 个失败`;
    }
    if (existingMemberEmails.length > 0 || existingInvitationEmails.length > 0) {
      message += `，跳过 ${existingMemberEmails.length + existingInvitationEmails.length} 个已存在的邮箱`;
    }

    return createApiResponse(result, true, 200);

  } catch (error) {
    if (error && typeof error === 'object' && 'issues' in error) {
      return createApiResponse(false, null, (error as { issues: Array<{ message: string }> }).issues[0].message, 400);
    }

    console.error('Batch create invitations error:', error);
    return createApiResponse(false, null, '批量创建邀请失败', 500);
  }
}

// 添加withAuthAndParams函数
function withAuthAndParams(handler: (req: NextRequest, context: any, user: any) => Promise<any>) {
  return async (req: NextRequest, context: any) => {
    try {
      const token = req.headers.get('authorization')?.replace('Bearer ', '');
      if (!token) {
        return createApiResponse({ error: '未提供授权令牌' }, false, 401);
      }
      
      const decoded = await verifyToken(token);
      if (!decoded) {
        return createApiResponse({ error: '未授权访问' }, false, 401);
      }

      return await handler(req, context, decoded);
    } catch (error) {
      console.error('Auth error:', error);
      return createApiResponse({ error: '认证失败' }, false, 500);
    }
  };
}

export const POST = withAuthAndParams(postHandler);
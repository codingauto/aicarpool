import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createApiResponse } from '@/lib/middleware';

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

    return createApiResponse(invitation, '邀请有效');

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
    const body = await req.json();
    const { name, password } = body; // 支持用户注册信息

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

    // 查找或创建用户
    let user = await prisma.user.findUnique({
      where: { email: invitation.email },
    });

    if (!user) {
      // 用户不存在，自动注册
      if (!name || !password) {
        return createApiResponse(false, null, '新用户需要提供姓名和密码', 400);
      }

      const { hashPassword } = await import('@/lib/auth');
      const hashedPassword = await hashPassword(password);

      user = await prisma.user.create({
        data: {
          email: invitation.email,
          name,
          password: hashedPassword,
          emailVerified: true, // 通过邀请链接验证邮箱
        },
      });
    }

    // 检查是否已是成员
    const existingMember = await prisma.groupMember.findFirst({
      where: {
        groupId: invitation.groupId,
        userId: user.id,
      },
    });

    if (existingMember) {
      return createApiResponse(false, null, '您已经是该拼车组成员', 400);
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
          userId: user.id,
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

    // 生成登录token
    const { generateToken } = await import('@/lib/auth');
    const authToken = generateToken(user.id);

    return createApiResponse({
      member: serializeBigInt(result),
      authToken,
      isNewUser: user.createdAt.getTime() > Date.now() - 60000, // 刚刚创建的用户
      message: '成功加入拼车组'
    }, true, 200);

  } catch (error) {
    console.error('Accept invitation error:', error);
    return createApiResponse({ error: '接受邀请失败' }, false, 500);
  }
}
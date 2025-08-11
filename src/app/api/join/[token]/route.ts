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

// 验证邀请链接
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    const inviteLink = await prisma.inviteLink.findUnique({
      where: { token },
      include: {
        group: {
          select: {
            id: true,
            name: true,
            description: true,
            maxMembers: true,
            status: true,
            organizationType: true,
            enterpriseId: true,
            settings: true,
            enterprise: {
              select: {
                id: true,
                name: true,
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
        },
        creator: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!inviteLink) {
      return createApiResponse(false, null, '邀请链接不存在', 404);
    }

    if (inviteLink.status !== 'active') {
      return createApiResponse(false, null, '邀请链接已失效', 400);
    }

    if (inviteLink.expiresAt < new Date()) {
      // 自动更新过期链接状态
      await prisma.inviteLink.update({
        where: { id: inviteLink.id },
        data: { status: 'expired' },
      });
      return createApiResponse(false, null, '邀请链接已过期', 400);
    }

    if (inviteLink.usedCount >= inviteLink.maxUses) {
      // 自动更新已用完的链接状态
      await prisma.inviteLink.update({
        where: { id: inviteLink.id },
        data: { status: 'inactive' },
      });
      return createApiResponse(false, null, '邀请链接使用次数已达上限', 400);
    }

    // 检查是否是企业邀请
    const isEnterpriseInvite = inviteLink.group.organizationType === 'enterprise_group' &&
                               inviteLink.group.settings?.invitationType === 'enterprise_link';

    if (!isEnterpriseInvite) {
      // 普通拼车组邀请的检查
      if (inviteLink.group.status !== 'active') {
        return createApiResponse(false, null, '拼车组已被禁用', 400);
      }

      // 检查拼车组是否已满
      if (inviteLink.group._count.members >= inviteLink.group.maxMembers) {
        return createApiResponse(false, null, '拼车组已满', 400);
      }
    }

    return createApiResponse(true, inviteLink, '邀请链接有效', 200);

  } catch (error) {
    console.error('Verify invite link error:', error);
    return createApiResponse(false, null, '验证邀请链接失败', 500);
  }
}

// 通过邀请链接加入拼车组
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const body = await req.json();
    const { email, name, password } = body;

    console.log('Join request data:', { token, email, name, hasPassword: !!password });

    if (!email) {
      console.log('Error: 邮箱地址不能为空');
      return createApiResponse(false, null, '邮箱地址不能为空', 400);
    }

    const inviteLink = await prisma.inviteLink.findUnique({
      where: { token },
      include: {
        group: {
          include: {
            enterprise: true,
          },
        },
      },
    });

    console.log('Found invite link:', inviteLink ? 'Yes' : 'No');

    if (!inviteLink) {
      console.log('Error: 邀请链接不存在');
      return createApiResponse(false, null, '邀请链接不存在', 404);
    }

    console.log('Invite link status:', inviteLink.status);
    console.log('Invite link expires at:', inviteLink.expiresAt);
    console.log('Current time:', new Date());
    console.log('Used count:', inviteLink.usedCount, '/', inviteLink.maxUses);

    if (inviteLink.status !== 'active') {
      console.log('Error: 邀请链接已失效');
      return createApiResponse(false, null, '邀请链接已失效', 400);
    }

    if (inviteLink.expiresAt < new Date()) {
      console.log('Error: 邀请链接已过期');
      await prisma.inviteLink.update({
        where: { id: inviteLink.id },
        data: { status: 'expired' },
      });
      return createApiResponse(false, null, '邀请链接已过期', 400);
    }

    if (inviteLink.usedCount >= inviteLink.maxUses) {
      console.log('Error: 邀请链接使用次数已达上限');
      await prisma.inviteLink.update({
        where: { id: inviteLink.id },
        data: { status: 'inactive' },
      });
      return createApiResponse(false, null, '邀请链接使用次数已达上限', 400);
    }

    // 检查是否是企业邀请
    const isEnterpriseInvite = inviteLink.group.organizationType === 'enterprise_group' &&
                               inviteLink.group.settings?.invitationType === 'enterprise_link';

    // 如果不是企业邀请，检查拼车组是否已满
    if (!isEnterpriseInvite) {
      const memberCount = await prisma.groupMember.count({
        where: {
          groupId: inviteLink.groupId,
          status: 'active',
        },
      });

      console.log('Current member count:', memberCount, '/', inviteLink.group.maxMembers);

      if (memberCount >= inviteLink.group.maxMembers) {
        console.log('Error: 拼车组已满');
        return createApiResponse(false, null, '拼车组已满', 400);
      }
    }

    // 查找或创建用户
    let user = await prisma.user.findUnique({
      where: { email },
    });

    console.log('Found existing user:', user ? 'Yes' : 'No');

    if (!user) {
      // 用户不存在，需要注册
      if (!name || !password) {
        console.log('Error: 新用户需要提供姓名和密码');
        return createApiResponse(false, null, '新用户需要提供姓名和密码', 400);
      }

      const { hashPassword } = await import('@/lib/auth');
      const hashedPassword = await hashPassword(password);

      user = await prisma.user.create({
        data: {
          email,
          name,
          password: hashedPassword,
          emailVerified: true, // 通过邀请链接验证邮箱
        },
      });

      console.log('Created new user:', user.id);
    }

    // 如果是企业邀请，检查是否已是企业成员
    if (isEnterpriseInvite) {
      const existingEnterpriseMember = await prisma.userEnterprise.findFirst({
        where: {
          enterpriseId: inviteLink.group.enterpriseId!,
          userId: user.id,
        },
      });

      if (existingEnterpriseMember) {
        console.log('Error: 用户已经是企业成员');
        return createApiResponse(false, null, '用户已经是企业成员', 400);
      }
    } else {
      // 普通拼车组邀请，检查是否已是成员
      const existingMember = await prisma.groupMember.findFirst({
        where: {
          groupId: inviteLink.groupId,
          userId: user.id,
        },
      });

      if (existingMember) {
        console.log('Error: 用户已经是成员');
        return createApiResponse(false, null, '您已经是该拼车组成员', 400);
      }
    }

    // 使用事务处理加入
    const result = await prisma.$transaction(async (tx) => {
      // 更新邀请链接使用次数
      await tx.inviteLink.update({
        where: { id: inviteLink.id },
        data: { usedCount: inviteLink.usedCount + 1 },
      });

      if (isEnterpriseInvite) {
        // 企业邀请：添加用户到企业
        const inviteRole = inviteLink.group.settings?.inviteRole || 'member';
        const inviteDepartmentId = inviteLink.group.settings?.inviteDepartmentId;

        const userEnterprise = await tx.userEnterprise.create({
          data: {
            userId: user.id,
            enterpriseId: inviteLink.group.enterpriseId!,
            role: inviteRole,
            isActive: true,
          },
          include: {
            enterprise: true,
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        });

        return { 
          isEnterpriseInvite: true, 
          userEnterprise,
          enterpriseId: inviteLink.group.enterpriseId
        };
      } else {
        // 普通拼车组邀请：添加用户到拼车组
        const member = await tx.groupMember.create({
          data: {
            groupId: inviteLink.groupId,
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

        return { 
          isEnterpriseInvite: false, 
          member 
        };
      }
    });

    console.log('Successfully joined:', result);

    // 发送欢迎邮件
    try {
      const { emailQueue } = await import('@/lib/email');
      const emailData = result.isEnterpriseInvite
        ? {
            to: user.email,
            userName: user.name,
            enterpriseName: result.userEnterprise.enterprise.name,
          }
        : {
            to: user.email,
            userName: user.name,
            groupName: inviteLink.group.name,
          };
      await emailQueue.addToQueue('welcome', emailData);
    } catch (emailError) {
      console.log('Email sending failed:', emailError);
      // 不阻止加入流程
    }

    // 生成登录token
    const { generateToken } = await import('@/lib/auth');
    const authToken = generateToken(user.id);

    const responseData = result.isEnterpriseInvite
      ? {
          userEnterprise: serializeBigInt(result.userEnterprise),
          enterpriseId: result.enterpriseId,
          authToken,
          isNewUser: user.createdAt.getTime() > Date.now() - 60000,
          isEnterpriseInvite: true,
        }
      : {
          member: serializeBigInt(result.member),
          authToken,
          isNewUser: user.createdAt.getTime() > Date.now() - 60000,
          isEnterpriseInvite: false,
        };

    return createApiResponse(
      true, 
      responseData, 
      result.isEnterpriseInvite ? '成功加入企业' : '成功加入拼车组', 
      200
    );

  } catch (error) {
    console.error('Join through invite link error:', error);
    return createApiResponse(false, null, '加入拼车组失败', 500);
  }
}
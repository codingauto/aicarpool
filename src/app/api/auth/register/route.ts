import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { hashPassword, generateToken, verifyInviteToken } from '@/lib/auth';
import { createApiResponse } from '@/lib/middleware';

const registerSchema = z.object({
  name: z.string().min(2, '姓名至少需要2个字符'),
  email: z.string().email('请输入有效的邮箱地址'),
  password: z.string().min(6, '密码至少需要6个字符'),
  inviteToken: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = registerSchema.parse(body);
    
    const { name, email, password, inviteToken } = validatedData;

    // 检查邮箱是否已存在
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return createApiResponse(false, null, '该邮箱已被注册', 400);
    }

    // 验证邀请码（如果提供）
    let groupId: string | null = null;
    if (inviteToken) {
      try {
        const inviteData = verifyInviteToken(inviteToken);
        if (inviteData.email !== email) {
          return createApiResponse(false, null, '邀请码与邮箱不匹配', 400);
        }
        
        // 检查邀请是否存在且有效
        const invitation = await prisma.invitation.findUnique({
          where: { token: inviteToken },
        });

        if (!invitation || invitation.status !== 'pending' || invitation.expiresAt < new Date()) {
          return createApiResponse(false, null, '邀请码无效或已过期', 400);
        }

        groupId = invitation.groupId;
      } catch {
        return createApiResponse(false, null, '无效的邀请码', 400);
      }
    }

    // 创建用户
    const hashedPassword = await hashPassword(password);
    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        emailVerified: false,
        role: 'user',
        status: 'active',
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        emailVerified: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // 如果有邀请码，加入对应的组
    if (groupId && inviteToken) {
      await prisma.$transaction([
        // 添加用户到组
        prisma.groupMember.create({
          data: {
            groupId,
            userId: user.id,
            role: 'member',
            status: 'active',
          },
        }),
        // 更新邀请状态
        prisma.invitation.update({
          where: { token: inviteToken },
          data: { status: 'accepted' },
        }),
      ]);
    }

    // 生成JWT令牌
    const token = generateToken(user);

    return createApiResponse(true, {
      user,
      token,
      message: '注册成功',
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return createApiResponse(false, null, error.issues[0].message, 400);
    }

    console.error('Registration error:', error);
    return createApiResponse(false, null, '注册失败，请稍后重试', 500);
  }
}
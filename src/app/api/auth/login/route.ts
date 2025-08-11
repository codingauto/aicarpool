import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { verifyPassword } from '@/lib/auth';
import { generateTokenPair } from '@/lib/auth/jwt-utils';
import { createApiResponse, createErrorResponse } from '@/lib/middleware';

const loginSchema = z.object({
  email: z.string().email('请输入有效的邮箱地址'),
  password: z.string().min(1, '请输入密码'),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = loginSchema.parse(body);
    
    const { email, password } = validatedData;

    // 查找用户
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return createErrorResponse('邮箱或密码错误', 401);
    }

    // 检查用户状态
    if (user.status !== 'active') {
      return createErrorResponse('账户已被禁用，请联系管理员', 401);
    }

    // 验证密码
    const isPasswordValid = await verifyPassword(password, user.password);
    if (!isPasswordValid) {
      return createErrorResponse('邮箱或密码错误', 401);
    }

    // 获取用户的默认企业和角色
    const userEnterprise = await prisma.userEnterprise.findFirst({
      where: {
        userId: user.id,
        isActive: true
      },
      orderBy: {
        joinedAt: 'desc'
      },
      select: {
        enterpriseId: true,
        role: true,
        enterprise: {
          select: {
            name: true
          }
        }
      }
    });

    // 准备返回的用户数据（排除密码）
    const userData = {
      id: user.id,
      name: user.name,
      email: user.email,
      avatar: user.avatar,
      role: userEnterprise?.role || user.role,
      status: user.status,
      emailVerified: user.emailVerified,
      enterprise: userEnterprise ? {
        id: userEnterprise.enterpriseId,
        name: userEnterprise.enterprise.name
      } : undefined,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };

    // 生成JWT令牌对
    const tokenPayload = {
      userId: user.id,
      email: user.email,
      name: user.name || '未知用户',
      role: userEnterprise?.role || user.role,
      enterpriseId: userEnterprise?.enterpriseId
    };
    
    const tokens = generateTokenPair(tokenPayload);

    // 更新最后登录时间（如果需要可以记录到其他表）
    // 暂时注释掉，因为User模型没有lastLoginAt字段
    // await prisma.user.update({
    //   where: { id: user.id },
    //   data: { lastLoginAt: new Date() }
    // });

    return createApiResponse(true, {
      user: userData,
      tokens: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresIn: tokens.expiresIn
      }
    }, '登录成功', 200);

  } catch (error) {
    if (error instanceof z.ZodError) {
      return createApiResponse(false, null, error.issues[0].message, 400);
    }

    console.error('Login error:', error);
    return createApiResponse(false, null, '登录失败，请稍后重试', 500);
  }
}
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { verifyPassword, generateToken } from '@/lib/auth';
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

    // 准备返回的用户数据（排除密码）
    const userData = {
      id: user.id,
      name: user.name,
      email: user.email,
      avatar: user.avatar,
      role: user.role,
      status: user.status,
      emailVerified: user.emailVerified,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };

    // 生成JWT令牌
    const token = generateToken(user.id);

    return createApiResponse({
      user: userData,
      token,
      message: '登录成功',
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return createApiResponse(false, null, error.issues[0].message, 400);
    }

    console.error('Login error:', error);
    return createApiResponse(false, null, '登录失败，请稍后重试', 500);
  }
}
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { withAuth, createApiResponse } from '@/lib/middleware';
import { hashPassword, verifyPassword } from '@/lib/auth';

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, '请输入当前密码'),
  newPassword: z.string().min(6, '新密码至少需要6个字符'),
});

async function handler(req: NextRequest, user: any) {
  try {
    const body = await req.json();
    const validatedData = changePasswordSchema.parse(body);
    const userId: string = user.id;

    const { currentPassword, newPassword } = validatedData;

    // 获取用户当前密码
    const userRecord = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, password: true },
    });

    if (!userRecord) {
      return createApiResponse({ error: '用户不存在' }, false, 404);
    }

    // 验证当前密码
    const isCurrentPasswordValid = await verifyPassword(currentPassword, userRecord.password);
    if (!isCurrentPasswordValid) {
      return createApiResponse({ error: '当前密码错误' }, false, 400);
    }

    // 哈希新密码
    const hashedNewPassword = await hashPassword(newPassword);

    // 更新密码
    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedNewPassword },
    });

    return createApiResponse({ message: '密码修改成功' }, true, 200);

  } catch (error) {
    if (error instanceof z.ZodError) {
      return createApiResponse(false, null, error.issues[0].message, 400);
    }

    console.error('Change password error:', error);
    return createApiResponse({ error: '修改密码失败' }, false, 500);
  }
}

export const POST = withAuth(handler);
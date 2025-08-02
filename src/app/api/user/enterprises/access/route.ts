import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createApiResponse } from '@/lib/middleware';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// 验证JWT token
async function verifyToken(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.substring(7);
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    return decoded;
  } catch (error) {
    return null;
  }
}

// POST /api/user/enterprises/access - 更新企业访问时间
export async function POST(request: NextRequest) {
  try {
    const user = await verifyToken(request);
    if (!user) {
      return NextResponse.json(
        createApiResponse(false, null, '未授权访问', 401),
        { status: 401 }
      );
    }

    const body = await request.json();
    const { enterpriseId } = body;

    if (!enterpriseId) {
      return NextResponse.json(
        createApiResponse(false, null, '企业ID不能为空', 400),
        { status: 400 }
      );
    }

    // 验证用户是否有权限访问此企业
    const userEnterprise = await prisma.userEnterprise.findFirst({
      where: {
        userId: user.id,
        enterpriseId: enterpriseId,
        isActive: true
      }
    });

    if (!userEnterprise) {
      return NextResponse.json(
        createApiResponse(false, null, '没有权限访问该企业', 403),
        { status: 403 }
      );
    }

    // 更新最后访问时间
    await prisma.userEnterprise.update({
      where: {
        id: userEnterprise.id
      },
      data: {
        lastAccessed: new Date()
      }
    });

    return NextResponse.json(
      createApiResponse(true, { enterpriseId }, '访问时间更新成功', 200)
    );

  } catch (error) {
    console.error('更新企业访问时间失败:', error);
    return NextResponse.json(
      createApiResponse(false, null, '服务器内部错误', 500),
      { status: 500 }
    );
  }
}
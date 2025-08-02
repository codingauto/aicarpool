import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { verifyToken } from '@/lib/auth/jwt-utils';

const prisma = new PrismaClient();

/**
 * 解决告警
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ alertId: string }> }
) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ success: false, error: '未提供认证令牌' }, { status: 401 });
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ success: false, error: '无效的认证令牌' }, { status: 401 });
    }

    const { alertId } = await params;
    const body = await request.json();
    const { resolution, notes } = body;

    // 验证alertId
    if (!alertId) {
      return NextResponse.json(
        { success: false, error: '无效的告警ID' },
        { status: 400 }
      );
    }

    // 模拟解决告警（实际应该更新数据库）
    const resolvedAlert = {
      id: alertId,
      isResolved: true,
      resolvedAt: new Date().toISOString(),
      resolvedBy: decoded.userId,
      resolution: resolution || 'manual',
      notes: notes || '手动标记为已解决'
    };

    console.log('解决告警:', resolvedAlert);

    return NextResponse.json({
      success: true,
      data: resolvedAlert,
      message: '告警已成功解决'
    });

  } catch (error) {
    console.error('解决告警失败:', error);
    return NextResponse.json(
      { success: false, error: '解决告警失败' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
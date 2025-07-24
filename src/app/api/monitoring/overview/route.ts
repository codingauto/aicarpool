import { NextRequest, NextResponse } from 'next/server';
import { monitoringManager } from '@/lib/monitoring';
import { verifyToken } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    // 验证用户身份
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { success: false, message: '未授权访问' },
        { status: 401 }
      );
    }
    
    const token = authHeader.split(' ')[1];
    try {
      verifyToken(token);
    } catch (error) {
      return NextResponse.json(
        { success: false, message: '无效的令牌' },
        { status: 401 }
      );
    }

    // 获取系统概览数据
    const overview = await monitoringManager.getSystemOverview();

    return NextResponse.json({
      success: true,
      data: overview
    });
  } catch (error) {
    console.error('获取系统概览失败:', error);
    return NextResponse.json(
      { success: false, message: '获取系统概览失败' },
      { status: 500 }
    );
  }
}
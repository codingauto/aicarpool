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

    // 获取查询参数
    const url = new URL(request.url);
    const status = url.searchParams.get('status') as 'active' | 'resolved' | 'suppressed' | undefined;
    const severity = url.searchParams.get('severity') || undefined;
    const ruleId = url.searchParams.get('ruleId') || undefined;
    
    // 获取告警事件
    const incidents = await monitoringManager.getAlertIncidents({
      status,
      severity,
      ruleId
    });

    return NextResponse.json({
      success: true,
      data: incidents
    });
  } catch (error) {
    console.error('获取告警事件失败:', error);
    return NextResponse.json(
      { success: false, message: '获取告警事件失败' },
      { status: 500 }
    );
  }
}
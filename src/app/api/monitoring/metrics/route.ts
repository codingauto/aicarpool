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
    const component = url.searchParams.get('component') || undefined;
    const metricName = url.searchParams.get('metricName') || undefined;
    const groupId = url.searchParams.get('groupId') || undefined;
    const startTimeStr = url.searchParams.get('startTime');
    const endTimeStr = url.searchParams.get('endTime');
    
    // 解析时间参数
    const startTime = startTimeStr ? new Date(startTimeStr) : undefined;
    const endTime = endTimeStr ? new Date(endTimeStr) : undefined;
    
    // 获取指标数据
    const metrics = await monitoringManager.getMetrics({
      component,
      metricName,
      groupId,
      startTime,
      endTime
    });

    return NextResponse.json({
      success: true,
      data: metrics
    });
  } catch (error) {
    console.error('获取指标数据失败:', error);
    return NextResponse.json(
      { success: false, message: '获取指标数据失败' },
      { status: 500 }
    );
  }
}
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';

// GET - 获取实时监控数据
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; proxyId: string }> }
) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ success: false, error: '未提供认证令牌' }, { status: 401 });
    }

    const user = await verifyToken(token);
    if (!user) {
      return NextResponse.json({ success: false, error: '无效的认证令牌' }, { status: 401 });
    }

    const { id: groupId, proxyId } = await params;

    // 验证用户是否为拼车组成员
    const membership = await prisma.groupMember.findFirst({
      where: {
        groupId,
        userId: user.id,
        status: 'active'
      }
    });

    if (!membership) {
      return NextResponse.json({ success: false, error: '无权限访问此拼车组' }, { status: 403 });
    }

    // 获取代理配置
    const proxyConfig = await prisma.ipProxyConfig.findFirst({
      where: {
        id: proxyId,
        groupId
      }
    });

    if (!proxyConfig) {
      return NextResponse.json({ success: false, error: '代理配置不存在' }, { status: 404 });
    }

    // 获取实时监控数据
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    // 获取最近1小时的使用日志
    const recentLogs = await prisma.ipUsageLog.findMany({
      where: {
        proxyId: proxyId,
        startTime: {
          gte: oneHourAgo
        }
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      },
      orderBy: {
        startTime: 'desc'
      },
      take: 50
    });

    // 计算实时统计
    const activeConnections = recentLogs.filter(log => 
      !log.endTime || new Date(log.endTime) > new Date(now.getTime() - 5 * 60 * 1000)
    ).length;

    const totalConnections = recentLogs.length;
    const successfulConnections = recentLogs.filter(log => log.status === 'success').length;
    const successRate = totalConnections > 0 ? Math.round((successfulConnections / totalConnections) * 100) : 0;

    const totalBytes = recentLogs.reduce((sum, log) => 
      sum + Number(log.bytesIn || 0) + Number(log.bytesOut || 0), 0
    );

    // 按分钟分组的连接统计（最近60分钟）
    const minuteStats = [];
    for (let i = 59; i >= 0; i--) {
      const minuteStart = new Date(now.getTime() - i * 60 * 1000);
      const minuteEnd = new Date(minuteStart.getTime() + 60 * 1000);
      
      const minuteLogs = recentLogs.filter(log => 
        new Date(log.startTime) >= minuteStart && new Date(log.startTime) < minuteEnd
      );

      minuteStats.push({
        time: minuteStart.toISOString(),
        connections: minuteLogs.length,
        successfulConnections: minuteLogs.filter(log => log.status === 'success').length,
        bytes: minuteLogs.reduce((sum, log) => 
          sum + Number(log.bytesIn || 0) + Number(log.bytesOut || 0), 0
        )
      });
    }

    // 用户连接统计
    const userStats = {};
    recentLogs.forEach(log => {
      const userId = log.userId;
      if (!userStats[userId]) {
        userStats[userId] = {
          user: log.user,
          connections: 0,
          successfulConnections: 0,
          bytes: 0
        };
      }
      userStats[userId].connections++;
      if (log.status === 'success') {
        userStats[userId].successfulConnections++;
      }
      userStats[userId].bytes += Number(log.bytesIn || 0) + Number(log.bytesOut || 0);
    });

    const monitorData = {
      proxyId,
      timestamp: now.toISOString(),
      realTimeStats: {
        activeConnections,
        totalConnections,
        successRate,
        totalBytes,
        avgResponseTime: proxyConfig.responseTime || 0
      },
      minuteStats,
      userStats: Object.values(userStats),
      recentLogs: recentLogs.slice(0, 10).map(log => ({
        id: log.id,
        userId: log.userId,
        user: log.user,
        targetHost: log.targetHost,
        targetPort: log.targetPort,
        status: log.status,
        startTime: log.startTime,
        endTime: log.endTime,
        duration: log.duration,
        bytesIn: log.bytesIn.toString(),
        bytesOut: log.bytesOut.toString(),
        errorCode: log.errorCode
      })),
      proxyStatus: {
        status: proxyConfig.status,
        isEnabled: proxyConfig.isEnabled,
        currentConnections: proxyConfig.currentConnections,
        maxConnections: proxyConfig.maxConnections,
        trafficUsed: proxyConfig.trafficUsed.toString(),
        trafficLimit: proxyConfig.trafficLimit ? proxyConfig.trafficLimit.toString() : null,
        lastCheckAt: proxyConfig.lastCheckAt,
        responseTime: proxyConfig.responseTime,
        errorMessage: proxyConfig.errorMessage
      }
    };

    return NextResponse.json({
      success: true,
      data: monitorData
    });

  } catch (error) {
    console.error('获取实时监控数据失败:', error);
    return NextResponse.json(
      { success: false, error: '获取实时监控数据失败' },
      { status: 500 }
    );
  }
}

// POST - 更新代理状态（用于健康检查）
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; proxyId: string }> }
) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ success: false, error: '未提供认证令牌' }, { status: 401 });
    }

    const user = await verifyToken(token);
    if (!user) {
      return NextResponse.json({ success: false, error: '无效的认证令牌' }, { status: 401 });
    }

    const { id: groupId, proxyId } = await params;

    // 验证用户是否为拼车组管理员
    const membership = await prisma.groupMember.findFirst({
      where: {
        groupId,
        userId: user.id,
        role: 'admin',
        status: 'active'
      }
    });

    if (!membership) {
      return NextResponse.json({ success: false, error: '无权限执行此操作' }, { status: 403 });
    }

    const body = await request.json();
    const { action, healthCheckData } = body;

    if (action === 'health_check') {
      // 更新代理健康状态
      const updatedProxy = await prisma.ipProxyConfig.update({
        where: { id: proxyId },
        data: {
          status: healthCheckData.isHealthy ? 'active' : 'error',
          responseTime: healthCheckData.responseTime,
          lastCheckAt: new Date(),
          errorMessage: healthCheckData.errorMessage || null,
          updatedAt: new Date()
        }
      });

      return NextResponse.json({
        success: true,
        message: '代理健康状态已更新',
        data: {
          status: updatedProxy.status,
          responseTime: updatedProxy.responseTime,
          lastCheckAt: updatedProxy.lastCheckAt
        }
      });
    }

    return NextResponse.json({ success: false, error: '不支持的操作' }, { status: 400 });

  } catch (error) {
    console.error('更新代理状态失败:', error);
    return NextResponse.json(
      { success: false, error: '更新代理状态失败' },
      { status: 500 }
    );
  }
}
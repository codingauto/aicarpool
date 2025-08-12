import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { verifyToken } from '@/lib/auth/jwt-utils';

const prisma = new PrismaClient();

/**
 * 获取告警列表
 */
export async function GET(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ success: false, error: '未提供认证令牌' }, { status: 401 });
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ success: false, error: '无效的认证令牌' }, { status: 401 });
    }

    const url = new URL(request.url);
    const status = url.searchParams.get('status'); // 'active', 'resolved', 'all'
    const severity = url.searchParams.get('severity'); // 'info', 'warning', 'error', 'critical'
    const limit = parseInt(url.searchParams.get('limit') || '50');

    // 模拟告警数据
    const mockAlerts = [
      {
        id: '1',
        type: 'error',
        severity: 'critical',
        service: '通义千问',
        platform: 'qwen',
        title: '服务响应超时',
        message: '服务响应时间过长，平均5.4秒，超出阈值3秒',
        timestamp: new Date(Date.now() - 300000).toISOString(),
        isResolved: false,
        resolvedAt: null,
        resolvedBy: null,
        affectedAccounts: ['qwen-account-1', 'qwen-account-2'],
        metrics: {
          responseTime: 5400,
          threshold: 3000,
          failureRate: 15.2
        }
      },
      {
        id: '2',
        type: 'warning',
        severity: 'warning',
        service: 'OpenAI GPT',
        platform: 'openai',
        title: 'API调用失败率偏高',
        message: 'API调用失败率较高，当前2.2%，超出正常范围1%',
        timestamp: new Date(Date.now() - 600000).toISOString(),
        isResolved: false,
        resolvedAt: null,
        resolvedBy: null,
        affectedAccounts: ['openai-account-1'],
        metrics: {
          failureRate: 2.2,
          threshold: 1.0,
          totalRequests: 2234
        }
      },
      {
        id: '3',
        type: 'warning',
        severity: 'warning',
        service: 'Claude',
        platform: 'claude',
        title: '成本预警',
        message: '日成本接近预算上限，当前$156.78，预算$180',
        timestamp: new Date(Date.now() - 900000).toISOString(),
        isResolved: true,
        resolvedAt: new Date(Date.now() - 300000).toISOString(),
        resolvedBy: 'admin',
        affectedAccounts: ['claude-account-1'],
        metrics: {
          currentCost: 156.78,
          budgetLimit: 180,
          utilizationRate: 87.1
        }
      },
      {
        id: '4',
        type: 'info',
        severity: 'info',
        service: 'Gemini',
        platform: 'gemini',
        title: '性能优化完成',
        message: '负载均衡优化已生效，响应时间改善25%',
        timestamp: new Date(Date.now() - 1200000).toISOString(),
        isResolved: true,
        resolvedAt: new Date(Date.now() - 600000).toISOString(),
        resolvedBy: 'system',
        affectedAccounts: ['gemini-account-1', 'gemini-account-2'],
        metrics: {
          oldResponseTime: 1200,
          newResponseTime: 900,
          improvement: 25
        }
      },
      {
        id: '5',
        type: 'error',
        severity: 'error',
        service: 'Claude',
        platform: 'claude',
        title: '账号配额耗尽',
        message: 'Claude账号已达到月配额限制，需要升级或添加新账号',
        timestamp: new Date(Date.now() - 1800000).toISOString(),
        isResolved: false,
        resolvedAt: null,
        resolvedBy: null,
        affectedAccounts: ['claude-account-2'],
        metrics: {
          usedQuota: 100000,
          totalQuota: 100000,
          utilizationRate: 100
        }
      }
    ];

    // 过滤告警
    let filteredAlerts = mockAlerts;

    if (status && status !== 'all') {
      if (status === 'active') {
        filteredAlerts = filteredAlerts.filter(alert => !alert.isResolved);
      } else if (status === 'resolved') {
        filteredAlerts = filteredAlerts.filter(alert => alert.isResolved);
      }
    }

    if (severity) {
      filteredAlerts = filteredAlerts.filter(alert => alert.severity === severity);
    }

    // 限制结果数量
    filteredAlerts = filteredAlerts.slice(0, limit);

    // 统计信息
    const stats = {
      total: mockAlerts.length,
      active: mockAlerts.filter(alert => !alert.isResolved).length,
      resolved: mockAlerts.filter(alert => alert.isResolved).length,
      bySeverity: {
        critical: mockAlerts.filter(alert => alert.severity === 'critical').length,
        error: mockAlerts.filter(alert => alert.severity === 'error').length,
        warning: mockAlerts.filter(alert => alert.severity === 'warning').length,
        info: mockAlerts.filter(alert => alert.severity === 'info').length
      },
      byService: mockAlerts.reduce((acc, alert) => {
        acc[alert.serviceType] = (acc[alert.serviceType] || 0) + 1;
        return acc;
      }, {} as Record<string, number>)
    };

    return NextResponse.json({
      success: true,
      data: {
        alerts: filteredAlerts,
        stats,
        pagination: {
          limit,
          total: filteredAlerts.length,
          hasMore: mockAlerts.length > limit
        }
      }
    });

  } catch (error) {
    console.error('获取告警列表失败:', error);
    return NextResponse.json(
      { success: false, error: '获取告警列表失败' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

/**
 * 创建新告警
 */
export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ success: false, error: '未提供认证令牌' }, { status: 401 });
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ success: false, error: '无效的认证令牌' }, { status: 401 });
    }

    const body = await request.json();
    const {
      type,
      severity,
      service,
      serviceType,
      title,
      message,
      affectedAccounts,
      metrics
    } = body;

    // 验证必填字段
    if (!type || !severity || !service || !title || !message) {
      return NextResponse.json(
        { success: false, error: '缺少必填字段' },
        { status: 400 }
      );
    }

    // 创建新告警（实际应该保存到数据库）
    const newAlert = {
      id: Date.now().toString(),
      type,
      severity,
      service,
      platform: serviceType || service.toLowerCase(),
      title,
      message,
      timestamp: new Date().toISOString(),
      isResolved: false,
      resolvedAt: null,
      resolvedBy: null,
      affectedAccounts: affectedAccounts || [],
      metrics: metrics || {},
      createdBy: decoded.userId
    };

    console.log('创建新告警:', newAlert);

    return NextResponse.json({
      success: true,
      data: newAlert
    });

  } catch (error) {
    console.error('创建告警失败:', error);
    return NextResponse.json(
      { success: false, error: '创建告警失败' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
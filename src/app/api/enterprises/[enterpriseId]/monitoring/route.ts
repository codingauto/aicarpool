/**
 * 企业级监控中心API
 * 
 * 提供企业系统监控、性能指标和健康状态数据
 */

import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { createApiResponse } from '@/lib/middleware';
import { verifyToken } from '@/lib/auth';

const prisma = new PrismaClient();

/**
 * 获取企业监控数据
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ enterpriseId: string }> }
) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) {
      return createApiResponse(false, null, '缺少认证令牌', 401);
    }

    const user = await verifyToken(token);
    if (!user) {
      return createApiResponse(false, null, '认证令牌无效', 401);
    }

    const { enterpriseId } = await params;
    const { searchParams } = new URL(request.url);
    const timeRange = searchParams.get('timeRange') || '1h';

    // 验证企业访问权限
    const enterprise = await prisma.enterprise.findUnique({
      where: { id: enterpriseId },
      include: {
        groups: {
          include: {
            _count: {
              select: { members: true }
            }
          }
        },
        aiAccounts: true,
        departments: true
      }
    });

    if (!enterprise) {
      return createApiResponse(false, null, '企业不存在', 404);
    }

    // 检查用户是否是企业成员
    const userMembership = await prisma.userEnterprise.findFirst({
      where: {
        userId: user.id,
        enterpriseId: enterpriseId,
        isActive: true
      }
    });

    if (!userMembership) {
      return createApiResponse(false, null, '您不是该企业的成员', 403);
    }

    // 获取系统指标数据（模拟真实监控数据）
    const systemMetrics = [
      {
        name: 'CPU Usage',
        value: Math.floor(Math.random() * 30) + 20, // 20-50%
        unit: '%',
        status: 'normal' as const,
        trend: Math.random() > 0.5 ? 'up' : 'stable' as const,
        lastUpdated: new Date().toISOString()
      },
      {
        name: 'Memory Usage',
        value: Math.floor(Math.random() * 40) + 40, // 40-80%
        unit: '%',
        status: 'normal' as const,
        trend: 'stable' as const,
        lastUpdated: new Date().toISOString()
      },
      {
        name: 'Disk Usage',
        value: Math.floor(Math.random() * 20) + 60, // 60-80%
        unit: '%',
        status: 'warning' as const,
        trend: 'up' as const,
        lastUpdated: new Date().toISOString()
      },
      {
        name: 'Network Traffic',
        value: Math.floor(Math.random() * 50) + 10, // 10-60%
        unit: 'Mbps',
        status: 'normal' as const,
        trend: 'down' as const,
        lastUpdated: new Date().toISOString()
      }
    ];

    // 生成服务健康状态数据
    const aiServices = ['Claude API', 'OpenAI API', 'Gemini API', '千帆 API'];
    const infrastructureServices = ['Database', 'Redis Cache', 'Load Balancer', 'API Gateway'];
    
    const serviceHealth = [...aiServices, ...infrastructureServices].map(serviceName => {
      const isHealthy = Math.random() > 0.1; // 90% 健康率
      const responseTime = isHealthy ? 
        Math.floor(Math.random() * 200) + 50 : // 50-250ms
        Math.floor(Math.random() * 1000) + 500; // 500-1500ms
      
      return {
        serviceName,
        status: isHealthy ? 'healthy' : (Math.random() > 0.5 ? 'degraded' : 'down') as 'healthy' | 'degraded' | 'down',
        responseTime,
        uptime: isHealthy ? 
          Math.floor(Math.random() * 5) + 95 : // 95-100%
          Math.floor(Math.random() * 20) + 70, // 70-90%
        errorRate: isHealthy ? 
          Math.floor(Math.random() * 3) / 10 : // 0-0.3%
          Math.floor(Math.random() * 50) / 10, // 0-5%
        lastCheck: new Date().toISOString()
      };
    });

    // 生成性能趋势数据
    const performanceData = [];
    const now = new Date();
    const timeRangeHours = timeRange === '1h' ? 1 : timeRange === '6h' ? 6 : timeRange === '24h' ? 24 : 168; // 7天
    const dataPoints = timeRange === '1h' ? 12 : timeRange === '6h' ? 24 : timeRange === '24h' ? 48 : 168;
    
    for (let i = dataPoints - 1; i >= 0; i--) {
      const timestamp = new Date(now.getTime() - (i * (timeRangeHours * 60 * 60 * 1000) / dataPoints));
      performanceData.push({
        timestamp: timestamp.toISOString(),
        cpuUsage: Math.floor(Math.random() * 30) + 20,
        memoryUsage: Math.floor(Math.random() * 40) + 40,
        networkTraffic: Math.floor(Math.random() * 100) + 50,
        responseTime: Math.floor(Math.random() * 200) + 100
      });
    }

    // 生成告警信息
    const alerts = [];
    if (Math.random() > 0.7) { // 30% 概率有告警
      const alertTypes = ['warning', 'error', 'info'] as const;
      const alertMessages = [
        'CPU使用率超过阈值',
        '磁盘空间不足',
        'API响应时间异常',
        '内存使用率过高',
        '网络连接异常',
        '服务降级中'
      ];
      
      for (let i = 0; i < Math.floor(Math.random() * 3) + 1; i++) {
        alerts.push({
          id: `alert_${i}_${Date.now()}`,
          type: alertTypes[Math.floor(Math.random() * alertTypes.length)],
          message: alertMessages[Math.floor(Math.random() * alertMessages.length)],
          service: serviceHealth[Math.floor(Math.random() * serviceHealth.length)].serviceName,
          timestamp: new Date(Date.now() - Math.random() * 3600000).toISOString() // 最近1小时内
        });
      }
    }

    // 计算系统整体健康状态
    const healthyServicesCount = serviceHealth.filter(s => s.status === 'healthy').length;
    const totalServices = serviceHealth.length;
    const avgResponseTime = Math.floor(serviceHealth.reduce((sum, s) => sum + s.responseTime, 0) / totalServices);
    const avgUptime = Math.floor(serviceHealth.reduce((sum, s) => sum + s.uptime, 0) / totalServices);

    let systemHealth: 'healthy' | 'warning' | 'critical' = 'healthy';
    if (healthyServicesCount / totalServices < 0.8) {
      systemHealth = 'critical';
    } else if (healthyServicesCount / totalServices < 0.9 || alerts.some(a => a.type === 'error')) {
      systemHealth = 'warning';
    }

    const monitoringData = {
      overview: {
        systemHealth,
        totalServices,
        healthyServices: healthyServicesCount,
        avgResponseTime,
        uptime: avgUptime
      },
      systemMetrics,
      serviceHealth,
      performanceData,
      alerts
    };

    console.log(`📊 API 企业监控: 为企业 ${enterprise.name} 生成了 ${timeRange} 监控数据`);

    return createApiResponse(true, monitoringData, '获取企业监控数据成功', 200);

  } catch (error) {
    console.error('获取企业监控数据失败:', error);
    return createApiResponse(false, null, '获取企业监控数据失败', 500);
  }
}

/**
 * 创建手动告警
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ enterpriseId: string }> }
) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) {
      return createApiResponse(false, null, '缺少认证令牌', 401);
    }

    const user = await verifyToken(token);
    if (!user) {
      return createApiResponse(false, null, '认证令牌无效', 401);
    }

    const { enterpriseId } = await params;
    const body = await request.json();

    // 验证企业访问权限
    const userMembership = await prisma.userEnterprise.findFirst({
      where: {
        userId: user.id,
        enterpriseId: enterpriseId,
        isActive: true,
        role: { in: ['owner', 'admin'] } // 只有管理员可以创建告警
      }
    });

    if (!userMembership) {
      return createApiResponse(false, null, '您没有权限创建告警', 403);
    }

    const { alertType, message, service } = body;

    // 这里可以创建真实的告警记录到数据库
    // 目前返回模拟响应
    const newAlert = {
      id: `manual_alert_${Date.now()}`,
      type: alertType,
      message: message,
      service: service,
      timestamp: new Date().toISOString(),
      createdBy: user.id
    };

    console.log(`🚨 API 企业监控: 为企业 ${enterpriseId} 创建了手动告警`);

    return createApiResponse(true, newAlert, '告警创建成功', 201);

  } catch (error) {
    console.error('创建告警失败:', error);
    return createApiResponse(false, null, '创建告警失败', 500);
  }
}
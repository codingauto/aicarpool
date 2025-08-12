import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { verifyToken } from '@/lib/auth/jwt-utils';

const prisma = new PrismaClient();

/**
 * 获取AI服务监控指标
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
    const timeRange = url.searchParams.get('timeRange') || '24h';

    // 获取时间范围
    const now = new Date();
    let startTime: Date;
    
    switch (timeRange) {
      case '1h':
        startTime = new Date(now.getTime() - 60 * 60 * 1000);
        break;
      case '6h':
        startTime = new Date(now.getTime() - 6 * 60 * 60 * 1000);
        break;
      case '24h':
        startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case '7d':
        startTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startTime = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      default:
        startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    }

    // 获取所有AI服务账号
    const aiAccounts = await prisma.aiServiceAccount.findMany({
      where: {
        isEnabled: true
      },
      select: {
        id: true,
        name: true,
        platform: true,
        accountType: true,
        healthStatus: true,
        lastHealthCheck: true,
        dailyUsageStats: true,
        createdAt: true
      }
    });

    // 模拟生成服务指标数据
    const serviceMetrics = aiAccounts.map(account => {
      // 模拟负载和性能数据
      const baseResponseTime = {
        'claude': 1200,
        'gemini': 900,
        'openai': 1800,
        'qwen': 2500
      }[account.platform] || 1500;

      const isHealthy = Math.random() > 0.1; // 90%概率健康
      const responseTime = isHealthy ? 
        baseResponseTime + Math.floor(Math.random() * 500) : 
        baseResponseTime * 2 + Math.floor(Math.random() * 3000);

      const successRate = isHealthy ? 
        95 + Math.floor(Math.random() * 5) : 
        80 + Math.floor(Math.random() * 15);

      const totalRequests = Math.floor(Math.random() * 5000) + 1000;
      const errorCount = Math.floor(totalRequests * (100 - successRate) / 100);
      const currentLoad = Math.floor(Math.random() * 100);

      let status: 'healthy' | 'warning' | 'error';
      if (!isHealthy || successRate < 90) {
        status = 'error';
      } else if (responseTime > baseResponseTime * 1.5 || currentLoad > 80) {
        status = 'warning';
      } else {
        status = 'healthy';
      }

      return {
        platform: account.platform,
        serviceName: getServiceDisplayName(account.platform),
        accountId: account.id,
        accountName: account.name,
        status,
        responseTime,
        successRate,
        totalRequests,
        errorCount,
        dailyCost: Math.floor(Math.random() * 200) + 50,
        currentLoad,
        lastCheck: new Date().toISOString()
      };
    });

    // 按服务类型聚合指标
    const serviceAggregatedMetrics = aggregateMetricsByService(serviceMetrics);

    return NextResponse.json({
      success: true,
      data: {
        timeRange,
        serviceMetrics: serviceAggregatedMetrics,
        accountDetails: serviceMetrics,
        summary: {
          totalServices: serviceAggregatedMetrics.length,
          healthyServices: serviceAggregatedMetrics.filter(s => s.status === 'healthy').length,
          totalRequests: serviceMetrics.reduce((sum, s) => sum + s.totalRequests, 0),
          totalCost: serviceMetrics.reduce((sum, s) => sum + s.dailyCost, 0),
          avgResponseTime: Math.floor(serviceMetrics.reduce((sum, s) => sum + s.responseTime, 0) / serviceMetrics.length),
          avgSuccessRate: Math.floor(serviceMetrics.reduce((sum, s) => sum + s.successRate, 0) / serviceMetrics.length)
        }
      }
    });

  } catch (error) {
    console.error('获取服务监控指标失败:', error);
    return NextResponse.json(
      { success: false, error: '获取监控数据失败' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

function getServiceDisplayName(platform: string): string {
  const displayNames: Record<string, string> = {
    'claude': 'Claude (Anthropic)',
    'gemini': 'Gemini (Google)',
    'openai': 'OpenAI GPT',
    'qwen': '通义千问 (Alibaba)'
  };
  return displayNames[serviceType] || serviceType;
}

function aggregateMetricsByService(accountMetrics: any[]) {
  const serviceGroups = accountMetrics.reduce((groups, metric) => {
    const serviceType = metric.serviceType;
    if (!groups[serviceType]) {
      groups[serviceType] = [];
    }
    groups[serviceType].push(metric);
    return groups;
  }, {} as Record<string, any[]>);

  return Object.entries(serviceGroups).map(([serviceType, metrics]) => {
    const totalRequests = metrics.reduce((sum, m) => sum + m.totalRequests, 0);
    const totalErrors = metrics.reduce((sum, m) => sum + m.errorCount, 0);
    const totalCost = metrics.reduce((sum, m) => sum + m.dailyCost, 0);
    const avgResponseTime = Math.floor(metrics.reduce((sum, m) => sum + m.responseTime, 0) / metrics.length);
    const avgLoad = Math.floor(metrics.reduce((sum, m) => sum + m.currentLoad, 0) / metrics.length);
    const successRate = totalRequests > 0 ? Math.floor(((totalRequests - totalErrors) / totalRequests) * 100) : 100;

    // 确定整体状态
    const errorCount = metrics.filter(m => m.status === 'error').length;
    const warningCount = metrics.filter(m => m.status === 'warning').length;
    
    let status: 'healthy' | 'warning' | 'error';
    if (errorCount > 0) {
      status = 'error';
    } else if (warningCount > 0) {
      status = 'warning';
    } else {
      status = 'healthy';
    }

    return {
      serviceType,
      serviceName: getServiceDisplayName(serviceType),
      status,
      responseTime: avgResponseTime,
      successRate,
      totalRequests,
      errorCount: totalErrors,
      dailyCost: totalCost,
      currentLoad: avgLoad,
      accountCount: metrics.length,
      healthyAccounts: metrics.filter(m => m.status === 'healthy').length,
      lastCheck: new Date().toISOString()
    };
  });
}
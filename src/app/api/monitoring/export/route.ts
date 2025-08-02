import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth/jwt-utils';

/**
 * 导出监控数据
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
      timeRange = '24h',
      format = 'json',
      includeServices = true,
      includeUsageStats = true,
      includeAlerts = true,
      includeOptimization = false
    } = body;

    // 收集要导出的数据
    const exportData: any = {
      metadata: {
        exportedAt: new Date().toISOString(),
        exportedBy: decoded.userId,
        timeRange,
        format
      }
    };

    // 生成服务监控数据
    if (includeServices) {
      exportData.serviceMetrics = generateServiceMetricsForExport(timeRange);
    }

    // 生成使用统计数据
    if (includeUsageStats) {
      exportData.usageStats = generateUsageStatsForExport(timeRange);
    }

    // 生成告警数据
    if (includeAlerts) {
      exportData.alerts = generateAlertsForExport();
    }

    // 生成优化建议
    if (includeOptimization) {
      exportData.optimizationSuggestions = generateOptimizationForExport();
    }

    // 根据格式返回数据
    if (format === 'csv') {
      const csvData = convertToCSV(exportData);
      return new NextResponse(csvData, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename=monitoring-report-${timeRange}-${new Date().toISOString().split('T')[0]}.csv`
        }
      });
    } else {
      // 默认返回JSON格式
      return NextResponse.json({
        success: true,
        data: exportData
      });
    }

  } catch (error) {
    console.error('导出监控数据失败:', error);
    return NextResponse.json(
      { success: false, error: '导出数据失败' },
      { status: 500 }
    );
  }
}

function generateServiceMetricsForExport(timeRange: string) {
  const services = ['claude', 'gemini', 'openai', 'qwen'];
  
  return services.map(serviceType => ({
    serviceType,
    serviceName: getServiceDisplayName(serviceType),
    timeRange,
    metrics: {
      avgResponseTime: Math.floor(1000 + Math.random() * 2000),
      successRate: Math.round((95 + Math.random() * 5) * 100) / 100,
      totalRequests: Math.floor(500 + Math.random() * 2000),
      totalCost: Math.round((50 + Math.random() * 150) * 100) / 100,
      errorCount: Math.floor(Math.random() * 50),
      currentLoad: Math.floor(Math.random() * 100)
    },
    healthStatus: Math.random() > 0.2 ? 'healthy' : Math.random() > 0.5 ? 'warning' : 'error',
    lastChecked: new Date().toISOString()
  }));
}

function generateUsageStatsForExport(timeRange: string) {
  const timeMultiplier = timeRange === '1h' ? 1 : timeRange === '24h' ? 24 : timeRange === '7d' ? 168 : 720;
  
  return {
    timeRange,
    summary: {
      totalRequests: Math.floor((500 + Math.random() * 2000) * timeMultiplier),
      totalCost: Math.round((100 + Math.random() * 400) * timeMultiplier * 100) / 100,
      totalTokens: Math.floor((50000 + Math.random() * 200000) * timeMultiplier),
      avgResponseTime: Math.floor(1200 + Math.random() * 800),
      successRate: Math.round((96 + Math.random() * 4) * 100) / 100
    },
    topUsers: Array.from({ length: 10 }, (_, i) => ({
      rank: i + 1,
      username: `user${i + 1}`,
      requests: Math.floor(100 + Math.random() * 500),
      cost: Math.round((10 + Math.random() * 50) * 100) / 100,
      tokens: Math.floor(5000 + Math.random() * 20000)
    })),
    topGroups: Array.from({ length: 5 }, (_, i) => ({
      rank: i + 1,
      groupName: `${['前端', '后端', '产品', '测试', '运维'][i]}开发组`,
      requests: Math.floor(200 + Math.random() * 1000),
      cost: Math.round((20 + Math.random() * 100) * 100) / 100,
      memberCount: Math.floor(3 + Math.random() * 15)
    })),
    serviceBreakdown: [
      { service: 'Claude', percentage: 40, requests: Math.floor(400 * timeMultiplier), cost: Math.round(200 * timeMultiplier * 100) / 100 },
      { service: 'Gemini', percentage: 30, requests: Math.floor(300 * timeMultiplier), cost: Math.round(100 * timeMultiplier * 100) / 100 },
      { service: 'OpenAI', percentage: 20, requests: Math.floor(200 * timeMultiplier), cost: Math.round(150 * timeMultiplier * 100) / 100 },
      { service: '通义千问', percentage: 10, requests: Math.floor(100 * timeMultiplier), cost: Math.round(50 * timeMultiplier * 100) / 100 }
    ]
  };
}

function generateAlertsForExport() {
  return [
    {
      id: 'alert_001',
      title: '通义千问服务响应超时',
      severity: 'error',
      service: '通义千问',
      status: 'active',
      createdAt: new Date(Date.now() - 300000).toISOString(),
      message: '服务响应时间超过5秒阈值'
    },
    {
      id: 'alert_002',
      title: 'OpenAI API调用失败率过高',
      severity: 'warning',
      service: 'OpenAI',
      status: 'active',
      createdAt: new Date(Date.now() - 600000).toISOString(),
      message: '失败率达到2.2%，超过告警阈值'
    },
    {
      id: 'alert_003',
      title: 'Claude服务成本预警',
      severity: 'warning',
      service: 'Claude',
      status: 'resolved',
      createdAt: new Date(Date.now() - 900000).toISOString(),
      resolvedAt: new Date(Date.now() - 300000).toISOString(),
      message: '日成本达到预算限制的90%'
    }
  ];
}

function generateOptimizationForExport() {
  return [
    {
      id: 'opt_001',
      title: '负载均衡优化',
      category: 'performance',
      priority: 'high',
      description: '配置智能负载均衡以优化响应时间',
      estimatedSavings: 0,
      estimatedImprovementPercent: 60
    },
    {
      id: 'opt_002',
      title: 'Claude服务成本控制',
      category: 'cost',
      priority: 'high',
      description: '将部分请求转移到成本更低的服务',
      estimatedSavings: 47,
      estimatedImprovementPercent: 30
    },
    {
      id: 'opt_003',
      title: '资源池利用率优化',
      category: 'cost',
      priority: 'medium',
      description: '重新分配低利用率资源',
      estimatedSavings: 89,
      estimatedImprovementPercent: 25
    }
  ];
}

function getServiceDisplayName(serviceType: string): string {
  const displayNames: Record<string, string> = {
    'claude': 'Claude (Anthropic)',
    'gemini': 'Gemini (Google)',
    'openai': 'OpenAI GPT',
    'qwen': '通义千问'
  };
  return displayNames[serviceType] || serviceType;
}

function convertToCSV(data: any): string {
  const lines: string[] = [];
  
  // 添加元数据
  lines.push('# 监控数据导出报告');
  lines.push(`# 导出时间: ${data.metadata.exportedAt}`);
  lines.push(`# 时间范围: ${data.metadata.timeRange}`);
  lines.push('');

  // 服务指标CSV
  if (data.serviceMetrics) {
    lines.push('## 服务指标');
    lines.push('服务类型,服务名称,平均响应时间(ms),成功率(%),总请求数,总成本($),错误数,当前负载(%),健康状态');
    
    data.serviceMetrics.forEach((service: any) => {
      lines.push([
        service.serviceType,
        service.serviceName,
        service.metrics.avgResponseTime,
        service.metrics.successRate,
        service.metrics.totalRequests,
        service.metrics.totalCost,
        service.metrics.errorCount,
        service.metrics.currentLoad,
        service.healthStatus
      ].join(','));
    });
    lines.push('');
  }

  // 使用统计CSV
  if (data.usageStats) {
    lines.push('## 使用统计汇总');
    lines.push('指标,数值');
    lines.push(`总请求数,${data.usageStats.summary.totalRequests}`);
    lines.push(`总成本($),${data.usageStats.summary.totalCost}`);
    lines.push(`总Token数,${data.usageStats.summary.totalTokens}`);
    lines.push(`平均响应时间(ms),${data.usageStats.summary.avgResponseTime}`);
    lines.push(`成功率(%),${data.usageStats.summary.successRate}`);
    lines.push('');

    lines.push('## 热门用户');
    lines.push('排名,用户名,请求数,成本($),Token数');
    data.usageStats.topUsers.forEach((user: any) => {
      lines.push([user.rank, user.username, user.requests, user.cost, user.tokens].join(','));
    });
    lines.push('');
  }

  // 告警CSV
  if (data.alerts) {
    lines.push('## 告警列表');
    lines.push('告警ID,标题,严重程度,服务,状态,创建时间,解决时间');
    
    data.alerts.forEach((alert: any) => {
      lines.push([
        alert.id,
        alert.title,
        alert.severity,
        alert.service,
        alert.status,
        alert.createdAt,
        alert.resolvedAt || ''
      ].join(','));
    });
    lines.push('');
  }

  return lines.join('\n');
}
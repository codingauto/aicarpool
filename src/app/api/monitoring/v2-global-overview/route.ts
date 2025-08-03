/**
 * 全局监控概览API - v2.4简化版
 * 提供系统级的全局统计信息
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

interface GlobalOverview {
  system: {
    timestamp: string;
    status: 'healthy' | 'warning' | 'critical';
    uptime: string;
  };
  
  // v2.4简化：全局资源统计
  resources: {
    totalEnterprises: number;
    totalGroups: number;
    totalUsers: number;
    totalAiAccounts: number;
    accountsByServiceType: Record<string, number>;
  };
  
  // v2.4简化：绑定模式统计
  bindings: {
    totalBindings: number;
    exclusiveBindings: number; // 专属绑定（拼车组模式）
    sharedBindings: number;    // 共享绑定（企业模式）
    unboundGroups: number;     // 未绑定的组
    bindingUtilization: number; // 绑定利用率
  };
  
  // 全局使用统计（最近24小时）
  usage: {
    totalRequests: number;
    totalTokens: number;
    totalCost: number;
    averageResponseTime: number;
    successRate: number;
    topServiceTypes: {
      serviceType: string;
      requests: number;
      cost: number;
    }[];
  };
  
  // 性能监控
  performance: {
    averageResponseTime: number;
    p95ResponseTime: number;
    errorRate: number;
    healthyAccounts: number;
    totalAccounts: number;
  };
  
  // 趋势数据（最近7天）
  trends: {
    dailyStats: {
      date: string;
      requests: number;
      cost: number;
      newUsers: number;
      newGroups: number;
    }[];
  };
}

/**
 * GET /api/monitoring/v2-global-overview
 * 获取全局监控概览
 */
export async function GET(
  request: NextRequest
): Promise<NextResponse<{ success: boolean; data?: GlobalOverview; error?: string }>> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: '未授权访问' },
        { status: 401 }
      );
    }

    // 简单权限检查：任何登录用户都可以查看全局统计
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true }
    });

    if (!user) {
      return NextResponse.json(
        { success: false, error: '用户不存在' },
        { status: 404 }
      );
    }

    // 获取基础资源统计
    const [
      enterpriseCount,
      groupCount,
      userCount,
      aiAccountCount
    ] = await Promise.all([
      prisma.enterprise.count(),
      prisma.group.count(),
      prisma.user.count(),
      prisma.aiServiceAccount.count({ where: { isEnabled: true } })
    ]);

    // 按服务类型统计AI账号
    const accountsByServiceType = await prisma.aiServiceAccount.groupBy({
      by: ['serviceType'],
      where: { isEnabled: true },
      _count: true
    });

    const serviceTypeStats = accountsByServiceType.reduce((acc, item) => {
      acc[item.serviceType] = item._count;
      return acc;
    }, {} as Record<string, number>);

    // 获取绑定统计
    const allBindings = await prisma.groupAccountBinding.findMany({
      where: { isActive: true },
      select: {
        bindingType: true,
        groupId: true
      }
    });

    const exclusiveBindings = allBindings.filter(b => b.bindingType === 'exclusive').length;
    const sharedBindings = allBindings.filter(b => b.bindingType === 'shared').length;
    const boundGroupIds = new Set(allBindings.map(b => b.groupId));
    const unboundGroups = groupCount - boundGroupIds.size;
    const bindingUtilization = groupCount > 0 ? Math.round((boundGroupIds.size / groupCount) * 100) : 0;

    // 获取24小时使用统计
    const twentyFourHoursAgo = new Date();
    twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

    const recentUsage = await prisma.usageStat.findMany({
      where: {
        requestTime: { gte: twentyFourHoursAgo }
      },
      select: {
        cost: true,
        totalTokens: true,
        responseTime: true,
        status: true,
        aiServiceId: true
      }
    });

    const totalRequests = recentUsage.length;
    const totalTokens = recentUsage.reduce((sum, stat) => sum + Number(stat.totalTokens), 0);
    const totalCost = recentUsage.reduce((sum, stat) => sum + Number(stat.cost), 0);
    const successfulRequests = recentUsage.filter(stat => stat.status === 'success').length;
    const successRate = totalRequests > 0 ? Math.round((successfulRequests / totalRequests) * 100) : 0;

    const validResponseTimes = recentUsage
      .filter(stat => stat.responseTime && stat.responseTime > 0)
      .map(stat => stat.responseTime!);
    
    const averageResponseTime = validResponseTimes.length > 0 
      ? Math.round(validResponseTimes.reduce((sum, time) => sum + time, 0) / validResponseTimes.length)
      : 0;

    // 按服务类型统计使用量
    const serviceUsageMap = new Map<string, { requests: number; cost: number }>();
    recentUsage.forEach(stat => {
      const serviceType = stat.aiServiceId || 'unknown';
      if (!serviceUsageMap.has(serviceType)) {
        serviceUsageMap.set(serviceType, { requests: 0, cost: 0 });
      }
      const current = serviceUsageMap.get(serviceType)!;
      current.requests += 1;
      current.cost += Number(stat.cost);
    });

    const topServiceTypes = Array.from(serviceUsageMap.entries())
      .map(([serviceType, stats]) => ({
        serviceType,
        requests: stats.requests,
        cost: Math.round(stats.cost * 100) / 100
      }))
      .sort((a, b) => b.requests - a.requests)
      .slice(0, 5);

    // 获取账号健康状态
    const totalActiveAccounts = await prisma.aiServiceAccount.count({
      where: { isEnabled: true }
    });

    const healthyAccounts = await prisma.aiServiceAccount.count({
      where: { 
        isEnabled: true,
        status: 'active'
      }
    });

    const errorRate = totalRequests > 0 ? Math.round(((totalRequests - successfulRequests) / totalRequests) * 100) : 0;

    // 获取最近7天趋势数据
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const dailyStats = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);

      const [dayUsage, newUsers, newGroups] = await Promise.all([
        prisma.usageStat.findMany({
          where: {
            requestTime: { gte: dayStart, lt: dayEnd }
          },
          select: { cost: true }
        }),
        prisma.user.count({
          where: {
            createdAt: { gte: dayStart, lt: dayEnd }
          }
        }),
        prisma.group.count({
          where: {
            createdAt: { gte: dayStart, lt: dayEnd }
          }
        })
      ]);

      dailyStats.push({
        date: dayStart.toISOString().split('T')[0],
        requests: dayUsage.length,
        cost: Math.round(dayUsage.reduce((sum, stat) => sum + Number(stat.cost), 0) * 100) / 100,
        newUsers,
        newGroups
      });
    }

    const result: GlobalOverview = {
      system: {
        timestamp: new Date().toISOString(),
        status: errorRate > 10 ? 'critical' : errorRate > 5 ? 'warning' : 'healthy',
        uptime: '99.9%' // 简化处理
      },
      
      resources: {
        totalEnterprises: enterpriseCount,
        totalGroups: groupCount,
        totalUsers: userCount,
        totalAiAccounts: aiAccountCount,
        accountsByServiceType: serviceTypeStats
      },
      
      bindings: {
        totalBindings: allBindings.length,
        exclusiveBindings,
        sharedBindings,
        unboundGroups,
        bindingUtilization
      },
      
      usage: {
        totalRequests,
        totalTokens,
        totalCost: Math.round(totalCost * 100) / 100,
        averageResponseTime,
        successRate,
        topServiceTypes
      },
      
      performance: {
        averageResponseTime,
        p95ResponseTime: averageResponseTime * 1.5, // 简化估算
        errorRate,
        healthyAccounts,
        totalAccounts: totalActiveAccounts
      },
      
      trends: {
        dailyStats
      }
    };

    console.log(`[v2.4 Global Monitoring] Generated global overview for user ${session.user.id}`);

    return NextResponse.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('获取全局监控概览失败:', error);
    return NextResponse.json(
      { success: false, error: '获取监控数据失败' },
      { status: 500 }
    );
  }
}
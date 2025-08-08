/**
 * 拼车组使用统计API - 适配企业级架构
 * 
 * 基于AiServiceAccount统计，替代原有的单一AI服务统计
 * 支持：
 * - 企业AI账号级别的使用统计
 * - 按服务类型分组统计
 * - 成本和Token使用量追踪
 * - 时间范围查询和多种粒度统计
 */

import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { createApiResponse } from '@/lib/middleware';
import { verifyToken } from '@/lib/auth';

const prisma = new PrismaClient();

/**
 * 获取拼车组使用统计
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ groupId: string }> }
) {
  try {
    // 1. 认证验证
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) {
      return createApiResponse(false, null, '缺少认证令牌', 401);
    }

    const user = await verifyToken(token);
    if (!user) {
      return createApiResponse(false, null, '认证令牌无效', 401);
    }

    const resolvedParams = await params;
    const { groupId } = resolvedParams;

    // 2. 参数验证
    if (!groupId) {
      return createApiResponse(false, null, '缺少拼车组ID', 400);
    }

    // 3. 权限验证
    const groupMembership = await prisma.groupMember.findFirst({
      where: {
        groupId,
        userId: user.id,
        status: 'active'
      }
    });

    if (!groupMembership) {
      return createApiResponse(false, null, '无权限访问该拼车组', 403);
    }

    // 4. 获取查询参数
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const granularity = searchParams.get('granularity') || 'day'; // hour, day, week, month
    const serviceType = searchParams.get('serviceType');
    const includeEnterprise = searchParams.get('includeEnterprise') === 'true';

    // 5. 构建查询时间范围
    const now = new Date();
    let queryStartDate: Date;
    let queryEndDate: Date;

    if (startDate && endDate) {
      queryStartDate = new Date(startDate);
      queryEndDate = new Date(endDate);
    } else {
      // 默认查询最近30天
      queryEndDate = now;
      queryStartDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    // 6. 获取拼车组和企业信息
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      include: {
        enterprise: {
          select: {
            id: true,
            name: true
          }
        },
        resourceBinding: true
      }
    });

    if (!group) {
      return createApiResponse(false, null, '拼车组不存在', 404);
    }

    // 7. 构建查询条件
    const baseWhere = {
      groupId,
      requestTime: {
        gte: queryStartDate,
        lte: queryEndDate
      },
      ...(serviceType && { aiServiceType: serviceType }) // 使用新的字段名
    };

    // 8. 查询使用统计数据
    const [rawStats, serviceBreakdown, hourlyDistribution] = await Promise.all([
      // 基础统计数据
      prisma.usageStat.findMany({
        where: baseWhere,
        select: {
          requestTime: true,
          aiServiceType: true,
          aiModel: true,
          inputTokens: true,
          outputTokens: true,
          totalTokens: true,
          cost: true,
          responseTime: true,
          errorType: true
        },
        orderBy: {
          requestTime: 'asc'
        }
      }),

      // 按服务类型分组统计
      prisma.usageStat.groupBy({
        by: ['aiServiceType'],
        where: baseWhere,
        _sum: {
          totalTokens: true,
          cost: true
        },
        _count: true,
        _avg: {
          responseTime: true
        }
      }),

      // 按小时分布统计
      prisma.$queryRaw`
        SELECT 
          HOUR(requestTime) as hour,
          COUNT(*) as requests,
          SUM(CAST(totalTokens AS UNSIGNED)) as tokens,
          SUM(cost) as cost
        FROM usage_stats 
        WHERE groupId = ${groupId}
          AND requestTime >= ${queryStartDate}
          AND requestTime <= ${queryEndDate}
          ${serviceType ? prisma.$queryRaw`AND aiServiceType = ${serviceType}` : prisma.$queryRaw``}
        GROUP BY HOUR(requestTime)
        ORDER BY hour
      `
    ]);

    // 9. 处理时间序列数据
    const timeSeriesStats = processTimeSeriesData(rawStats, granularity, queryStartDate, queryEndDate);

    // 10. 计算汇总统计
    const totalRequests = rawStats.length;
    const totalTokens = rawStats.reduce((sum, stat) => sum + Number(stat.totalTokens), 0);
    const totalCost = rawStats.reduce((sum, stat) => sum + Number(stat.cost), 0);
    const averageResponseTime = rawStats
      .filter(stat => stat.responseTime)
      .reduce((sum, stat, _, arr) => sum + (stat.responseTime || 0) / arr.length, 0);
    const errorRate = rawStats.length > 0 ? 
      (rawStats.filter(stat => stat.errorType).length / rawStats.length * 100) : 0;

    // 11. 获取使用最多的模型统计
    const modelUsage = rawStats.reduce((acc, stat) => {
      const modelKey = stat.aiModel || 'Unknown';
      if (!acc[modelKey]) {
        acc[modelKey] = { requests: 0, tokens: 0, cost: 0 };
      }
      acc[modelKey].requests++;
      acc[modelKey].tokens += Number(stat.totalTokens);
      acc[modelKey].cost += Number(stat.cost);
      return acc;
    }, {} as Record<string, { requests: number; tokens: number; cost: number }>);

    const topModels = Object.entries(modelUsage)
      .sort(([,a], [,b]) => b.requests - a.requests)
      .slice(0, 5)
      .map(([model, usage]) => ({ model, ...usage }));

    // 12. 获取企业AI账号使用情况（如果是管理员且请求企业信息）
    let enterpriseAccountStats: any[] = [];
    if (['admin', 'owner'].includes(groupMembership.role) && includeEnterprise && group.enterpriseId) {
      enterpriseAccountStats = await prisma.aiServiceAccount.findMany({
        where: {
          enterpriseId: group.enterpriseId,
          isEnabled: true
        },
        select: {
          id: true,
          name: true,
          serviceType: true,
          currentLoad: true,
          totalRequests: true,
          totalTokens: true,
          totalCost: true,
          dailyLimit: true,
          lastUsedAt: true
        }
      });
    }

    // 13. 获取峰值时间
    const peakHours = (hourlyDistribution as any[])
      .sort((a, b) => Number(b.requests) - Number(a.requests))
      .slice(0, 3)
      .map(item => Number(item.hour));

    console.log(`📊 使用统计: 返回拼车组 ${groupId} 的统计数据，时间范围: ${queryStartDate.toISOString().split('T')[0]} ~ ${queryEndDate.toISOString().split('T')[0]}`);

    return createApiResponse({
      group: {
        id: group.id,
        name: group.name,
        enterpriseId: group.enterpriseId,
        enterpriseName: group.enterprise?.name
      },
      stats: timeSeriesStats,
      summary: {
        period: {
          startDate: queryStartDate.toISOString(),
          endDate: queryEndDate.toISOString(),
          granularity
        },
        totals: {
          requests: totalRequests,
          tokens: totalTokens,
          cost: totalCost,
          averageResponseTime: Math.round(averageResponseTime),
          errorRate: Math.round(errorRate * 100) / 100
        },
        breakdown: serviceBreakdown.map(item => ({
          serviceType: item.aiServiceType,
          requests: item._count,
          tokens: Number(item._sum.totalTokens || 0),
          cost: Number(item._sum.cost || 0),
          averageResponseTime: Math.round(Number(item._avg.responseTime || 0))
        })),
        topModels,
        peakHours,
        hourlyDistribution: (hourlyDistribution as any[]).map(item => ({
          hour: Number(item.hour),
          requests: Number(item.requests),
          tokens: Number(item.tokens),
          cost: Number(item.cost)
        }))
      },
      enterpriseAccountStats: enterpriseAccountStats.map(account => ({
        ...account,
        totalRequests: Number(account.totalRequests),
        totalTokens: Number(account.totalTokens),
        totalCost: Number(account.totalCost),
        loadPercentage: Math.round((account.currentLoad / (account.dailyLimit || 1)) * 100)
      })),
      resourceBinding: group.resourceBinding,
      isAdmin: ['admin', 'owner'].includes(groupMembership.role)
    }, true, 200);

  } catch (error) {
    console.error('获取使用统计失败:', error);
    return createApiResponse(false, null, '获取使用统计失败', 500);
  }
}

/**
 * 处理时间序列数据
 */
function processTimeSeriesData(
  rawStats: any[], 
  granularity: string, 
  startDate: Date, 
  endDate: Date
) {
  const timeSeriesMap = new Map<string, {
    period: string;
    requests: number;
    tokens: number;
    cost: number;
    averageResponseTime: number;
    successRate: number;
    breakdown: Record<string, { requests: number; tokens: number; cost: number }>;
  }>();

  // 生成时间段键值
  const getTimeKey = (date: Date, granularity: string): string => {
    switch (granularity) {
      case 'hour':
        return date.toISOString().substring(0, 13); // YYYY-MM-DDTHH
      case 'week':
        const week = getWeekNumber(date);
        return `${date.getFullYear()}-W${week.toString().padStart(2, '0')}`;
      case 'month':
        return date.toISOString().substring(0, 7); // YYYY-MM
      default: // day
        return date.toISOString().substring(0, 10); // YYYY-MM-DD
    }
  };

  // 初始化时间序列
  const current = new Date(startDate);
  while (current <= endDate) {
    const key = getTimeKey(current, granularity);
    if (!timeSeriesMap.has(key)) {
      timeSeriesMap.set(key, {
        period: key,
        requests: 0,
        tokens: 0,
        cost: 0,
        averageResponseTime: 0,
        successRate: 0,
        breakdown: {}
      });
    }

    // 递增时间
    switch (granularity) {
      case 'hour':
        current.setHours(current.getHours() + 1);
        break;
      case 'week':
        current.setDate(current.getDate() + 7);
        break;
      case 'month':
        current.setMonth(current.getMonth() + 1);
        break;
      default: // day
        current.setDate(current.getDate() + 1);
    }
  }

  // 填入实际数据
  rawStats.forEach(stat => {
    const key = getTimeKey(new Date(stat.requestTime), granularity);
    const timeSlot = timeSeriesMap.get(key);
    
    if (timeSlot) {
      timeSlot.requests++;
      timeSlot.tokens += Number(stat.totalTokens);
      timeSlot.cost += Number(stat.cost);

      // 按服务类型分组
      const serviceType = stat.aiServiceType;
      if (!timeSlot.breakdown[serviceType]) {
        timeSlot.breakdown[serviceType] = { requests: 0, tokens: 0, cost: 0 };
      }
      timeSlot.breakdown[serviceType].requests++;
      timeSlot.breakdown[serviceType].tokens += Number(stat.totalTokens);
      timeSlot.breakdown[serviceType].cost += Number(stat.cost);
    }
  });

  // 计算平均响应时间和成功率
  timeSeriesMap.forEach((timeSlot, key) => {
    const periodStats = rawStats.filter(stat => 
      getTimeKey(new Date(stat.requestTime), granularity) === key
    );

    if (periodStats.length > 0) {
      const responseTimes = periodStats.filter(stat => stat.responseTime);
      timeSlot.averageResponseTime = responseTimes.length > 0 ?
        Math.round(responseTimes.reduce((sum, stat) => sum + (stat.responseTime || 0), 0) / responseTimes.length) : 0;
      
      timeSlot.successRate = Math.round(
        (periodStats.filter(stat => stat.status === 'success').length / periodStats.length * 100) * 100
      ) / 100;
    }
  });

  return Array.from(timeSeriesMap.values()).sort((a, b) => a.period.localeCompare(b.period));
}

/**
 * 获取周数
 */
function getWeekNumber(date: Date): number {
  const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
  const pastDaysOfYear = (date.getTime() - firstDayOfYear.getTime()) / 86400000;
  return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
}
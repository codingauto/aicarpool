/**
 * 企业级数据分析API
 * 
 * 提供企业所有拼车组的综合使用统计和分析数据
 * - 使用趋势分析
 * - 服务使用分布
 * - 拼车组排行
 * - 部门统计
 */

import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient, Prisma } from '@prisma/client';
import { createApiResponse } from '@/lib/middleware';
import { verifyToken } from '@/lib/auth';

const prisma = new PrismaClient();

/**
 * 获取企业级使用分析数据
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ enterpriseId: string }> }
) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    
    // 开发模式：允许无token访问
    let user = null;
    if (process.env.NODE_ENV === 'development' && !token) {
      console.log('🔐 开发模式：使用默认测试用户');
      user = {
        id: 'user_test_001',
        email: 'test@example.com',
        name: '测试用户',
        role: 'user'
      };
    } else {
      if (!token) {
        return createApiResponse(false, null, '缺少认证令牌', 401);
      }

      user = await verifyToken(token);
      if (!user) {
        return createApiResponse(false, null, '认证令牌无效', 401);
      }
    }

    const { enterpriseId } = await params;
    const { searchParams } = new URL(request.url);
    const timeRange = searchParams.get('timeRange') || '30d';

    // 验证企业访问权限
    const enterprise = await prisma.enterprise.findUnique({
      where: { id: enterpriseId }
    });

    if (!enterprise) {
      return createApiResponse(false, null, '企业不存在', 404);
    }

    // 检查用户是否是企业成员（开发模式下跳过）
    if (process.env.NODE_ENV !== 'development') {
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
    }

    // 计算时间范围
    const days = timeRange === '1d' ? 1 : 
                timeRange === '7d' ? 7 : 
                timeRange === '30d' ? 30 : 90;
    
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);
    
    const endDate = new Date();
    endDate.setHours(23, 59, 59, 999);

    // 获取企业下所有拼车组
    const groups = await prisma.group.findMany({
      where: { enterpriseId },
      include: {
        _count: {
          select: { members: true }
        }
      }
    });

    const groupIds = groups.map(g => g.id);

    // 并发获取各项数据
    const [
      usageStats,
      quotaUsage,
      performanceMetrics,
      departments,
      totalMembers
    ] = await Promise.all([
      // 获取使用统计数据
      prisma.usageStat.findMany({
        where: {
          groupId: { in: groupIds },
          requestTime: {
            gte: startDate,
            lte: endDate
          }
        },
        select: {
          id: true,
          groupId: true,
          requestTime: true,
          requestTokens: true,
          responseTokens: true,
          totalTokens: true,
          cost: true,
          responseTime: true,
          status: true,
          modelName: true,
          accountId: true
        }
      }),
      
      // 获取配额使用数据
      prisma.quotaUsage.findMany({
        where: {
          groupId: { in: groupIds }
        },
        select: {
          groupId: true,
          dailyTokens: true,
          monthlyTokens: true,
          dailyCost: true,
          monthlyCost: true,
          dateKey: true,
          monthKey: true
        }
      }),
      
      // 获取性能指标
      prisma.modelPerformanceMetric.findMany({
        where: {
          groupId: { in: groupIds },
          windowStart: { gte: startDate },
          windowEnd: { lte: endDate }
        },
        select: {
          groupId: true,
          modelId: true,
          metricType: true,
          value: true,
          windowStart: true,
          windowEnd: true
        }
      }),
      
      // 获取部门数据
      prisma.department.findMany({
        where: { enterpriseId },
        include: {
          groups: {
            include: {
              _count: {
                select: { members: true }
              }
            }
          }
        }
      }),
      
      // 获取总成员数
      prisma.groupMember.count({
        where: {
          groupId: { in: groupIds },
          status: 'active'
        }
      })
    ]);

    // 按日期分组统计使用数据
    const dailyStats = new Map<string, {
      date: string;
      tokens: number;
      cost: number;
      requests: number;
      responseTime: number;
      successCount: number;
      totalCount: number;
    }>();

    // 初始化每天的数据
    for (let i = 0; i < days; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateKey = date.toISOString().split('T')[0];
      
      dailyStats.set(dateKey, {
        date: dateKey,
        tokens: 0,
        cost: 0,
        requests: 0,
        responseTime: 0,
        successCount: 0,
        totalCount: 0
      });
    }

    // 聚合使用统计数据
    usageStats.forEach(stat => {
      const dateKey = stat.requestTime.toISOString().split('T')[0];
      const daily = dailyStats.get(dateKey);
      
      if (daily) {
        daily.tokens += Number(stat.totalTokens);
        daily.cost += parseFloat(stat.cost.toString());
        daily.requests += 1;
        daily.responseTime += stat.responseTime || 0;
        daily.totalCount += 1;
        if (stat.status === 'success') {
          daily.successCount += 1;
        }
      }
    });

    // 转换为数组并计算平均值
    const usageData = Array.from(dailyStats.values())
      .map(day => ({
        date: day.date,
        tokens: day.tokens,
        cost: parseFloat(day.cost.toFixed(2)),
        requests: day.requests,
        responseTime: day.totalCount > 0 ? Math.floor(day.responseTime / day.totalCount) : 0,
        successRate: day.totalCount > 0 ? Math.floor((day.successCount / day.totalCount) * 100) : 100
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // 按模型/平台分组统计服务使用分布
    const serviceStats = new Map<string, {
      platform: string;
      tokens: number;
      cost: number;
      requests: number;
    }>();

    // 获取AI账号信息以确定平台
    const aiAccounts = await prisma.aiServiceAccount.findMany({
      where: { enterpriseId },
      select: { id: true, platform: true, name: true }
    });

    const accountPlatformMap = new Map(
      aiAccounts.map(acc => [acc.id, acc.platform || 'unknown'])
    );

    // 聚合服务使用数据
    usageStats.forEach(stat => {
      const platform = stat.accountId ? 
        (accountPlatformMap.get(stat.accountId) || 
         (stat.modelName?.includes('claude') ? 'claude' :
          stat.modelName?.includes('gpt') ? 'openai' :
          stat.modelName?.includes('gemini') ? 'gemini' : 'other')) : 'unknown';
      
      if (!serviceStats.has(platform)) {
        serviceStats.set(platform, {
          platform: platform,
          tokens: 0,
          cost: 0,
          requests: 0
        });
      }
      
      const service = serviceStats.get(platform)!;
      service.tokens += Number(stat.totalTokens);
      service.cost += parseFloat(stat.cost.toString());
      service.requests += 1;
    });

    // 计算百分比并转换为数组
    const totalTokens = Array.from(serviceStats.values()).reduce((sum, s) => sum + s.tokens, 0);
    const serviceUsage = Array.from(serviceStats.values())
      .map(service => ({
        ...service,
        cost: parseFloat(service.cost.toFixed(2)),
        percentage: totalTokens > 0 ? Math.floor((service.tokens / totalTokens) * 100) : 0
      }))
      .sort((a, b) => b.tokens - a.tokens);

    // 生成拼车组使用统计
    const groupStatsMap = new Map<string, {
      groupId: string;
      groupName: string;
      memberCount: number;
      tokens: number;
      cost: number;
      requests: number;
      avgResponseTime: number;
      successCount: number;
    }>();

    // 初始化拼车组统计
    groups.forEach(group => {
      groupStatsMap.set(group.id, {
        groupId: group.id,
        groupName: group.name,
        memberCount: group._count.members,
        tokens: 0,
        cost: 0,
        requests: 0,
        avgResponseTime: 0,
        successCount: 0
      });
    });

    // 聚合拼车组数据
    usageStats.forEach(stat => {
      const groupStat = groupStatsMap.get(stat.groupId);
      if (groupStat) {
        groupStat.tokens += Number(stat.totalTokens);
        groupStat.cost += parseFloat(stat.cost.toString());
        groupStat.requests += 1;
        groupStat.avgResponseTime += stat.responseTime || 0;
        if (stat.status === 'success') {
          groupStat.successCount += 1;
        }
      }
    });

    // 从配额使用中补充数据
    quotaUsage.forEach(quota => {
      const groupStat = groupStatsMap.get(quota.groupId);
      if (groupStat && groupStat.tokens === 0) {
        // 如果没有实时数据，使用配额数据
        groupStat.tokens = Number(quota.dailyTokens);
        groupStat.cost = parseFloat(quota.dailyCost.toString());
      }
    });

    // 转换为数组并计算日均值
    const groupStats = Array.from(groupStatsMap.values())
      .map(group => ({
        groupId: group.groupId,
        groupName: group.groupName,
        memberCount: group.memberCount,
        resourceMode: groups.find(g => g.id === group.groupId)?.bindingMode || 'shared',
        dailyTokens: Math.floor(group.tokens / days),
        dailyCost: parseFloat((group.cost / days).toFixed(2)),
        utilizationRate: group.requests > 0 ? Math.min(100, Math.floor((group.requests / (days * 100)) * 100)) : 0,
        efficiency: group.requests > 0 ? Math.floor((group.successCount / group.requests) * 100) : 100
      }))
      .sort((a, b) => b.dailyTokens - a.dailyTokens)
      .slice(0, 10); // 取前10个拼车组

    // 生成部门统计
    const deptAnalytics = departments.map(dept => {
      const deptGroups = dept.groups;
      const deptGroupIds = deptGroups.map(g => g.id);
      
      // 计算部门的总使用量
      let deptTokens = 0;
      let deptCost = 0;
      let deptRequests = 0;
      
      usageStats.forEach(stat => {
        if (deptGroupIds.includes(stat.groupId)) {
          deptTokens += Number(stat.totalTokens);
          deptCost += parseFloat(stat.cost.toString());
          deptRequests += 1;
        }
      });
      
      const totalMembers = deptGroups.reduce((sum, group) => sum + group._count.members, 0);
      
      return {
        departmentId: dept.id,
        departmentName: dept.name,
        groupCount: deptGroups.length,
        memberCount: totalMembers,
        dailyTokens: Math.floor(deptTokens / days),
        dailyCost: parseFloat((deptCost / days).toFixed(2)),
        efficiency: deptRequests > 0 ? 95 : 0 // 简化的效率计算
      };
    }).filter(dept => dept.groupCount > 0); // 只返回有拼车组的部门

    // 计算汇总统计
    const totalTokensSum = usageStats.reduce((sum, stat) => sum + Number(stat.totalTokens), 0);
    const totalCostSum = usageStats.reduce((sum, stat) => sum + parseFloat(stat.cost.toString()), 0);
    const totalRequestsSum = usageStats.length;
    const avgResponseTime = usageStats.length > 0 ?
      Math.floor(usageStats.reduce((sum, stat) => sum + (stat.responseTime || 0), 0) / usageStats.length) : 0;
    const successCount = usageStats.filter(stat => stat.status === 'success').length;
    const avgSuccessRate = usageStats.length > 0 ?
      Math.floor((successCount / usageStats.length) * 100) : 100;

    // 如果没有实时数据，使用配额数据作为备选
    const quotaTokensSum = quotaUsage.reduce((sum, quota) => sum + Number(quota.monthlyTokens), 0);
    const quotaCostSum = quotaUsage.reduce((sum, quota) => sum + parseFloat(quota.monthlyCost.toString()), 0);

    const analyticsData = {
      enterprise: {
        id: enterprise.id,
        name: enterprise.name
      },
      timeRange,
      summary: {
        totalGroups: groups.length,
        totalMembers: totalMembers,
        totalTokens: totalTokensSum || quotaTokensSum,
        totalCost: parseFloat((totalCostSum || quotaCostSum).toFixed(2)),
        totalRequests: totalRequestsSum,
        avgResponseTime: avgResponseTime,
        avgSuccessRate: avgSuccessRate
      },
      usageData: usageData.length > 0 ? usageData : generateDefaultData(days), // 如果没有数据，生成默认数据
      serviceUsage: serviceUsage.length > 0 ? serviceUsage : generateDefaultServiceUsage(),
      groupStats,
      departmentStats: deptAnalytics
    };

    console.log(`📊 API 企业分析: 为企业 ${enterprise.name} 获取了 ${days} 天的真实使用数据`);
    console.log(`  - 使用记录: ${usageStats.length} 条`);
    console.log(`  - 拼车组: ${groups.length} 个`);
    console.log(`  - 部门: ${departments.length} 个`);

    return createApiResponse(true, analyticsData, '获取企业分析数据成功', 200);

  } catch (error) {
    console.error('获取企业分析数据失败:', error);
    return createApiResponse(false, null, '获取企业分析数据失败', 500);
  }
}

// 生成默认数据（当没有历史数据时）
function generateDefaultData(days: number) {
  const data = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    data.push({
      date: date.toISOString().split('T')[0],
      tokens: 0,
      cost: 0,
      requests: 0,
      responseTime: 0,
      successRate: 100
    });
  }
  return data;
}

// 生成默认服务使用分布
function generateDefaultServiceUsage() {
  return [
    { platform: 'claude', tokens: 0, cost: 0, requests: 0, percentage: 0 },
    { platform: 'openai', tokens: 0, cost: 0, requests: 0, percentage: 0 },
    { platform: 'gemini', tokens: 0, cost: 0, requests: 0, percentage: 0 }
  ];
}
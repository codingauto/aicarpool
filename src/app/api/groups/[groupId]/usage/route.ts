/**
 * 拼车组使用统计API - 基于企业级AI账号
 * 
 * 新架构下的使用统计：
 * - 统计基于AiServiceAccount而非旧的GroupAiService
 * - 支持专属、共享、混合模式的分别统计
 * - 集成SmartAiRouter的路由统计
 * - 提供企业级成本分析
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
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) {
      return createApiResponse(null, false, '缺少认证令牌', 401);
    }

    const user = await verifyToken(token);
    if (!user) {
      return createApiResponse(null, false, '认证令牌无效', 401);
    }

    const resolvedParams = await params;
    const { groupId } = resolvedParams;

    // 验证用户是否属于该拼车组
    const groupMembership = await prisma.groupMember.findFirst({
      where: {
        groupId,
        userId: user.id,
        status: 'active'
      }
    });

    if (!groupMembership) {
      return createApiResponse(null, false, '无权限访问该拼车组', 403);
    }

    // 获取查询参数
    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || '7d'; // 7d, 30d, 90d
    const serviceType = searchParams.get('serviceType'); // 可选筛选

    // 计算时间范围
    const now = new Date();
    let startDate = new Date();
    
    switch (period) {
      case '1d':
        startDate.setDate(now.getDate() - 1);
        break;
      case '7d':
        startDate.setDate(now.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(now.getDate() - 30);
        break;
      case '90d':
        startDate.setDate(now.getDate() - 90);
        break;
      default:
        startDate.setDate(now.getDate() - 7);
    }

    // 获取拼车组和资源绑定信息
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      include: {
        enterprise: {
          select: {
            id: true,
            name: true,
            aiAccounts: {
              where: {
                serviceType: serviceType ? serviceType : undefined,
                isEnabled: true
              },
              select: {
                id: true,
                name: true,
                serviceType: true,
                accountType: true,
                totalRequests: true,
                totalTokens: true,
                totalCost: true
              }
            }
          }
        },
        resourceBinding: true,
        accountBindings: {
          include: {
            account: {
              select: {
                id: true,
                name: true,
                serviceType: true,
                accountType: true
              }
            }
          }
        }
      }
    });

    if (!group) {
      return createApiResponse(null, false, '拼车组不存在', 404);
    }

    // 如果没有关联企业，返回空统计
    if (!group.enterpriseId) {
      return createApiResponse({
        hasEnterprise: false,
        message: '该拼车组未关联企业，无法获取使用统计',
        usage: {
          summary: {},
          dailyStats: [],
          serviceStats: [],
          accountStats: []
        }
      }, true, 200);
    }

    // 获取拼车组的使用统计数据
    const usageStats = await prisma.usageStat.findMany({
      where: {
        groupId,
        requestTime: {
          gte: startDate,
          lte: now
        }
      },
      orderBy: { requestTime: 'asc' }
    });

    // 获取绑定的AI账号统计
    const boundAccountIds = group.accountBindings.map(binding => binding.accountId);
    const aiAccounts = group.enterprise?.aiAccounts || [];

    // 计算总体统计
    const totalStats = usageStats.reduce((acc, stat) => {
      acc.totalRequests += 1;
      acc.totalTokens += Number(stat.totalTokens);
      acc.totalCost += Number(stat.cost);
      return acc;
    }, { totalRequests: 0, totalTokens: 0, totalCost: 0 });

    // 按日期分组统计
    const dailyStatsMap = new Map<string, any>();
    
    usageStats.forEach(stat => {
      const dateKey = stat.requestTime.toISOString().split('T')[0];
      
      if (!dailyStatsMap.has(dateKey)) {
        dailyStatsMap.set(dateKey, {
          date: dateKey,
          requests: 0,
          tokens: 0,
          cost: 0,
          services: new Set()
        });
      }
      
      const dayStats = dailyStatsMap.get(dateKey);
      dayStats.requests += 1;
      dayStats.tokens += Number(stat.totalTokens);
      dayStats.cost += Number(stat.cost);
      dayStats.services.add(stat.serviceType);
    });

    const dailyStats = Array.from(dailyStatsMap.values()).map(stats => ({
      ...stats,
      services: stats.services.size
    }));

    // 按服务类型分组统计
    const serviceStatsMap = new Map<string, any>();
    
    usageStats.forEach(stat => {
      const serviceType = stat.serviceType;
      
      if (!serviceStatsMap.has(serviceType)) {
        serviceStatsMap.set(serviceType, {
          serviceType,
          displayName: getServiceDisplayName(serviceType),
          requests: 0,
          tokens: 0,
          cost: 0,
          successRate: 0,
          avgLatency: 0,
          totalLatency: 0
        });
      }
      
      const serviceStats = serviceStatsMap.get(serviceType);
      serviceStats.requests += 1;
      serviceStats.tokens += Number(stat.totalTokens);
      serviceStats.cost += Number(stat.cost);
      serviceStats.totalLatency += Number(stat.latency || 0);
    });

    const serviceStats = Array.from(serviceStatsMap.values()).map(stats => ({
      ...stats,
      avgLatency: stats.requests > 0 ? Math.round(stats.totalLatency / stats.requests) : 0,
      costPerToken: stats.tokens > 0 ? stats.cost / stats.tokens : 0
    }));

    // 分析资源绑定使用情况
    let bindingAnalysis: any = {
      mode: group.resourceBinding?.bindingMode || 'none',
      configured: !!group.resourceBinding,
      dedicatedAccounts: 0,
      sharedAccounts: 0,
      hybridConfig: null
    };

    if (group.resourceBinding) {
      const config = group.resourceBinding.bindingConfig as any;
      
      switch (group.resourceBinding.bindingMode) {
        case 'dedicated':
          bindingAnalysis.dedicatedAccounts = config.accounts?.length || 0;
          break;
        case 'shared':
          bindingAnalysis.sharedAccounts = aiAccounts.filter(acc => acc.accountType === 'shared').length;
          break;
        case 'hybrid':
          bindingAnalysis.hybridConfig = {
            primaryAccounts: config.primaryAccounts?.length || 0,
            fallbackPools: config.fallbackPools?.length || 0
          };
          break;
      }
    }

    // 计算账号级别统计
    const accountStats = aiAccounts.map(account => {
      const isInUse = boundAccountIds.includes(account.id);
      
      return {
        id: account.id,
        name: account.name,
        serviceType: account.serviceType,
        accountType: account.accountType,
        isInUse,
        totalRequests: Number(account.totalRequests),
        totalTokens: Number(account.totalTokens),
        totalCost: Number(account.totalCost),
        utilization: isInUse ? 'active' : 'idle'
      };
    });

    // 计算今日统计
    const today = new Date().toISOString().split('T')[0];
    const todayStats = dailyStats.find(stat => stat.date === today) || {
      requests: 0,
      tokens: 0,
      cost: 0
    };

    console.log(`📊 API 使用统计: 返回拼车组 ${groupId} 在 ${period} 内的使用数据`);

    return createApiResponse({
      period,
      dateRange: {
        start: startDate.toISOString(),
        end: now.toISOString()
      },
      summary: {
        totalRequests: totalStats.totalRequests,
        totalTokens: totalStats.totalTokens,
        totalCost: totalStats.totalCost,
        averageCostPerRequest: totalStats.totalRequests > 0 
          ? totalStats.totalCost / totalStats.totalRequests 
          : 0,
        activeServices: serviceStats.length,
        today: todayStats
      },
      dailyStats,
      serviceStats,
      accountStats,
      bindingAnalysis,
      group: {
        id: group.id,
        name: group.name,
        enterpriseId: group.enterpriseId,
        enterpriseName: group.enterprise?.name
      },
      hasEnterprise: true
    }, true, 200);

  } catch (error) {
    console.error('获取使用统计失败:', error);
    return createApiResponse(null, false, '获取使用统计失败', 500);
  }
}

/**
 * 导出使用统计数据
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ groupId: string }> }
) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) {
      return createApiResponse(null, false, '缺少认证令牌', 401);
    }

    const user = await verifyToken(token);
    if (!user) {
      return createApiResponse(null, false, '认证令牌无效', 401);
    }

    const resolvedParams = await params;
    const { groupId } = resolvedParams;

    const body = await request.json();
    const { format = 'csv', period = '30d', includeDetails = false } = body;

    // 验证用户权限
    const groupMembership = await prisma.groupMember.findFirst({
      where: {
        groupId,
        userId: user.id,
        role: { in: ['admin', 'owner'] }, // 只有管理员可以导出
        status: 'active'
      }
    });

    if (!groupMembership) {
      return createApiResponse(null, false, '无权限导出使用统计', 403);
    }

    // 获取详细统计数据
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(period.replace('d', '')));

    const usageStats = await prisma.usageStat.findMany({
      where: {
        groupId,
        requestTime: {
          gte: startDate
        }
      },
      orderBy: { requestTime: 'asc' }
    });

    let exportData: any;
    
    if (format === 'csv') {
      // 生成CSV格式数据
      const headers = ['日期', '时间', '服务类型', '模型', '令牌数', '费用', '延迟'];
      const rows = usageStats.map(stat => [
        stat.requestTime.toISOString().split('T')[0],
        stat.requestTime.toISOString().split('T')[1].split('.')[0],
        stat.serviceType,
        stat.model || 'N/A',
        stat.totalTokens.toString(),
        stat.cost.toString(),
        stat.latency?.toString() || '0'
      ]);
      
      exportData = {
        format: 'csv',
        headers,
        data: rows,
        filename: `aicarpool-usage-${groupId}-${period}.csv`
      };
    } else {
      // JSON格式
      exportData = {
        format: 'json',
        data: usageStats.map(stat => ({
          timestamp: stat.requestTime.toISOString(),
          serviceType: stat.serviceType,
          model: stat.model,
          tokens: Number(stat.totalTokens),
          cost: Number(stat.cost),
          latency: Number(stat.latency || 0)
        })),
        filename: `aicarpool-usage-${groupId}-${period}.json`
      };
    }

    console.log(`📤 API 使用统计: 导出拼车组 ${groupId} 的 ${format} 格式数据`);

    return createApiResponse(true, exportData, '导出使用统计成功', 200);

  } catch (error) {
    console.error('导出使用统计失败:', error);
    return createApiResponse(false, null, '导出使用统计失败', 500);
  }
}

// 辅助函数
function getServiceDisplayName(serviceType: string): string {
  const displayNames: Record<string, string> = {
    'claude': 'Claude',
    'gemini': 'Gemini',
    'openai': 'OpenAI',
    'qwen': '通义千问',
    'zhipu': '智谱AI',
    'kimi': 'Kimi'
  };
  return displayNames[serviceType] || serviceType;
}
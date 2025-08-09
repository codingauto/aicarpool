/**
 * 拼车组使用统计API - v2.4简化版
 * 提供简单直观的费用分摊统计
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

interface CarpoolUsageStats {
  groupInfo: {
    id: string;
    name: string;
    memberCount: number;
    organizationType: string;
    bindingMode: string;
    boundAccount?: {
      id: string;
      name: string;
      platform: string;
      status: string;
    };
  };
  
  currentPeriod: {
    period: string; // 'daily', 'monthly'
    startDate: string;
    endDate: string;
    totalRequests: number;
    totalTokens: number;
    totalCost: number;
    costPerMember: number; // 简单平均分摊
    averageCostPerRequest: number;
  };
  
  memberBreakdown: {
    userId: string;
    userName: string;
    requests: number;
    tokens: number;
    cost: number;
    percentage: number; // 使用占比
  }[];
  
  // v2.4简化版：只提供基础趋势
  dailyTrend: {
    date: string;
    requests: number;
    cost: number;
  }[];
}

// GET /api/groups/[groupId]/v2-usage-stats
export async function GET(
  request: NextRequest,
  { params }: { params: { groupId: string } }
): Promise<NextResponse<{ success: boolean; data?: CarpoolUsageStats; error?: string }>> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: '未授权访问' },
        { status: 401 }
      );
    }

    const { groupId } = params;
    const url = new URL(request.url);
    const period = url.searchParams.get('period') || 'monthly'; // daily, monthly
    
    // 检查组权限
    const groupMember = await prisma.groupMember.findFirst({
      where: {
        groupId,
        userId: session.user.id
      },
      include: {
        group: {
          select: {
            id: true,
            name: true,
            organizationType: true,
            bindingMode: true,
            members: {
              select: {
                userId: true,
                user: {
                  select: {
                    id: true,
                    name: true
                  }
                }
              }
            },
            accountBindings: {
              where: { isActive: true },
              include: {
                account: {
                  select: {
                    id: true,
                    name: true,
                    platform: true,
                    status: true
                  }
                }
              }
            }
          }
        }
      }
    });

    if (!groupMember) {
      return NextResponse.json(
        { success: false, error: '无权限访问此拼车组' },
        { status: 403 }
      );
    }

    const group = groupMember.group;
    
    // 计算时间范围
    const now = new Date();
    let startDate: Date;
    let endDate: Date = now;
    
    if (period === 'daily') {
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    } else { // monthly
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    // 获取绑定的账号信息
    const boundAccount = group.accountBindings[0]?.account;

    // 获取使用统计数据
    const usageStats = await prisma.usageStat.findMany({
      where: {
        groupId,
        requestTime: {
          gte: startDate,
          lte: endDate
        }
      },
      include: {
        user: {
          select: {
            id: true,
            name: true
          }
        }
      },
      orderBy: {
        requestTime: 'desc'
      }
    });

    // 聚合统计数据
    const totalStats = usageStats.reduce(
      (acc, stat) => {
        acc.totalRequests += 1;
        acc.totalTokens += Number(stat.totalTokens);
        acc.totalCost += Number(stat.cost);
        return acc;
      },
      { totalRequests: 0, totalTokens: 0, totalCost: 0 }
    );

    // 按用户分组统计
    const userStatsMap = new Map<string, {
      userId: string;
      userName: string;
      requests: number;
      tokens: number;
      cost: number;
    }>();

    usageStats.forEach(stat => {
      const userId = stat.userId;
      const userName = stat.user.name;
      
      if (!userStatsMap.has(userId)) {
        userStatsMap.set(userId, {
          userId,
          userName,
          requests: 0,
          tokens: 0,
          cost: 0
        });
      }
      
      const userStat = userStatsMap.get(userId)!;
      userStat.requests += 1;
      userStat.tokens += Number(stat.totalTokens);
      userStat.cost += Number(stat.cost);
    });

    // 转换为数组并计算占比
    const memberBreakdown = Array.from(userStatsMap.values()).map(userStat => ({
      ...userStat,
      percentage: totalStats.totalCost > 0 
        ? Math.round((userStat.cost / totalStats.totalCost) * 100 * 100) / 100 
        : 0
    }));

    // 生成每日趋势（最近7天）
    const dailyTrend: { date: string; requests: number; cost: number }[] = [];
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - i);
      return date;
    }).reverse();

    for (const date of last7Days) {
      const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);

      const dayStats = usageStats.filter(stat => 
        stat.requestTime >= dayStart && stat.requestTime < dayEnd
      );

      const dayTotal = dayStats.reduce(
        (acc, stat) => ({
          requests: acc.requests + 1,
          cost: acc.cost + Number(stat.cost)
        }),
        { requests: 0, cost: 0 }
      );

      dailyTrend.push({
        date: dayStart.toISOString().split('T')[0],
        requests: dayTotal.requests,
        cost: Math.round(dayTotal.cost * 100) / 100
      });
    }

    // 计算平均费用分摊
    const memberCount = group.members.length;
    const costPerMember = memberCount > 0 
      ? Math.round((totalStats.totalCost / memberCount) * 100) / 100 
      : 0;

    const averageCostPerRequest = totalStats.totalRequests > 0
      ? Math.round((totalStats.totalCost / totalStats.totalRequests) * 10000) / 10000
      : 0;

    const result: CarpoolUsageStats = {
      groupInfo: {
        id: group.id,
        name: group.name,
        memberCount,
        organizationType: group.organizationType,
        bindingMode: group.bindingMode,
        boundAccount: boundAccount ? {
          id: boundAccount.id,
          name: boundAccount.name,
          platform: boundAccount.serviceType,
          status: boundAccount.status
        } : undefined
      },
      
      currentPeriod: {
        period,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        totalRequests: totalStats.totalRequests,
        totalTokens: totalStats.totalTokens,
        totalCost: Math.round(totalStats.totalCost * 100) / 100,
        costPerMember,
        averageCostPerRequest
      },
      
      memberBreakdown,
      dailyTrend
    };

    console.log(`[v2.4 Usage Stats] Generated stats for group ${groupId}, period: ${period}`);

    return NextResponse.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('获取拼车组使用统计失败:', error);
    return NextResponse.json(
      { success: false, error: '获取统计数据失败' },
      { status: 500 }
    );
  }
}
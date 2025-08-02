import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { verifyToken } from '@/lib/auth/jwt-utils';

const prisma = new PrismaClient();

/**
 * 获取使用统计数据
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

    // 获取用户使用统计
    const users = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        email: true,
        createdAt: true,
        groupMemberships: {
          select: {
            group: {
              select: {
                id: true,
                name: true
              }
            }
          }
        }
      },
      take: 100
    });

    // 获取拼车组统计
    const groups = await prisma.group.findMany({
      select: {
        id: true,
        name: true,
        description: true,
        createdAt: true,
        members: {
          select: {
            user: {
              select: {
                id: true,
                username: true
              }
            }
          }
        },
        resourceBinding: {
          select: {
            bindingMode: true,
            isActive: true,
            dailyTokenLimit: true,
            monthlyCostLimit: true
          }
        }
      },
      take: 50
    });

    // 模拟使用统计数据
    const mockUserStats = users.map(user => ({
      userId: user.id,
      name: user.username || user.email,
      requests: Math.floor(Math.random() * 1000) + 100,
      tokens: Math.floor(Math.random() * 50000) + 5000,
      cost: Math.floor(Math.random() * 100) + 10,
      groups: user.groupMemberships.map(m => m.group.name)
    }));

    const mockGroupStats = groups.map(group => ({
      groupId: group.id,
      name: group.name,
      requests: Math.floor(Math.random() * 5000) + 500,
      tokens: Math.floor(Math.random() * 200000) + 20000,
      cost: Math.floor(Math.random() * 500) + 50,
      memberCount: group.members.length,
      bindingMode: group.resourceBinding?.bindingMode || 'shared',
      isActive: group.resourceBinding?.isActive || false
    }));

    // 计算总体统计
    const totalRequests = mockUserStats.reduce((sum, user) => sum + user.requests, 0);
    const totalTokens = mockUserStats.reduce((sum, user) => sum + user.tokens, 0);
    const totalCost = mockUserStats.reduce((sum, user) => sum + user.cost, 0);

    // 模拟响应时间数据
    const avgResponseTime = 1200 + Math.floor(Math.random() * 800);
    const successRate = 95 + Math.floor(Math.random() * 5);

    // 排序获取热门用户和拼车组
    const topUsers = mockUserStats
      .sort((a, b) => b.requests - a.requests)
      .slice(0, 10)
      .map(user => ({
        name: user.name,
        requests: user.requests,
        cost: user.cost,
        tokens: user.tokens
      }));

    const topGroups = mockGroupStats
      .sort((a, b) => b.requests - a.requests)
      .slice(0, 10)
      .map(group => ({
        name: group.name,
        requests: group.requests,
        cost: group.cost,
        tokens: group.tokens,
        memberCount: group.memberCount
      }));

    // 模拟趋势数据（按小时）
    const hourlyTrends = [];
    const hoursToShow = timeRange === '1h' ? 1 : timeRange === '6h' ? 6 : timeRange === '24h' ? 24 : 24;
    
    for (let i = hoursToShow - 1; i >= 0; i--) {
      const hour = new Date(now.getTime() - i * 60 * 60 * 1000);
      hourlyTrends.push({
        timestamp: hour.toISOString(),
        requests: Math.floor(Math.random() * 500) + 100,
        cost: Math.floor(Math.random() * 50) + 10,
        responseTime: 1000 + Math.floor(Math.random() * 1000),
        successRate: 90 + Math.floor(Math.random() * 10)
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        timeRange,
        summary: {
          totalRequests,
          totalCost,
          totalTokens,
          avgResponseTime,
          successRate,
          totalUsers: users.length,
          totalGroups: groups.length,
          activeGroups: mockGroupStats.filter(g => g.isActive).length
        },
        topUsers,
        topGroups,
        trends: hourlyTrends,
        serviceBreakdown: {
          claude: {
            requests: Math.floor(totalRequests * 0.4),
            cost: Math.floor(totalCost * 0.45),
            successRate: 99.2
          },
          gemini: {
            requests: Math.floor(totalRequests * 0.3),
            cost: Math.floor(totalCost * 0.25),
            successRate: 98.8
          },
          openai: {
            requests: Math.floor(totalRequests * 0.2),
            cost: Math.floor(totalCost * 0.25),
            successRate: 97.5
          },
          qwen: {
            requests: Math.floor(totalRequests * 0.1),
            cost: Math.floor(totalCost * 0.05),
            successRate: 95.2
          }
        }
      }
    });

  } catch (error) {
    console.error('获取使用统计失败:', error);
    return NextResponse.json(
      { success: false, error: '获取使用统计失败' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
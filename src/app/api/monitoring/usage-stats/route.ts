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

    const { searchParams } = new URL(request.url);
    const timeRange = searchParams.get('timeRange') || '24h';
    const groupId = searchParams.get('groupId');
    const enterpriseId = searchParams.get('enterpriseId');

    // 计算时间范围
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

    // 获取热门用户（按使用量排序）
    const topUsers = await prisma.user.findMany({
      take: 10,
      select: {
        id: true,
        username: true,
        email: true,
        createdAt: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    // 获取热门拼车组
    const topGroups = await prisma.group.findMany({
      take: 10,
      include: {
        _count: {
          select: { members: true }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    // 模拟使用统计数据
    const mockUsageStats = generateMockUsageStats(timeRange, topUsers, topGroups);

    // 获取企业级统计（如果提供了enterpriseId）
    let enterpriseStats = null;
    if (enterpriseId) {
      const enterprise = await prisma.enterprise.findUnique({
        where: { id: enterpriseId },
        include: {
          _count: {
            select: {
              departments: true,
              aiServiceAccounts: true
            }
          }
        }
      });

      if (enterprise) {
        enterpriseStats = {
          enterpriseId: enterprise.id,
          enterpriseName: enterprise.name,
          departmentCount: enterprise._count.departments,
          accountCount: enterprise._count.aiServiceAccounts,
          ...mockUsageStats.enterpriseOverview
        };
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        timeRange,
        totalRequests: mockUsageStats.totalRequests,
        totalCost: mockUsageStats.totalCost,
        totalTokens: mockUsageStats.totalTokens,
        avgResponseTime: mockUsageStats.avgResponseTime,
        successRate: mockUsageStats.successRate,
        topUsers: mockUsageStats.topUsers,
        topGroups: mockUsageStats.topGroups,
        serviceBreakdown: mockUsageStats.serviceBreakdown,
        hourlyTrends: mockUsageStats.hourlyTrends,
        enterpriseStats,
        timestamp: new Date().toISOString()
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

function generateMockUsageStats(timeRange: string, users: any[], groups: any[]) {
  const timeMultiplier = timeRange === '1h' ? 1 : timeRange === '24h' ? 24 : timeRange === '7d' ? 168 : 720;
  
  // 生成基础统计
  const totalRequests = Math.floor((500 + Math.random() * 2000) * timeMultiplier);
  const totalTokens = Math.floor(totalRequests * (1000 + Math.random() * 5000));
  const totalCost = Math.round(totalTokens * 0.00001 * 100) / 100;
  const avgResponseTime = Math.floor(1000 + Math.random() * 1000);
  const successRate = Math.round((95 + Math.random() * 5) * 10) / 10;

  // 生成热门用户数据
  const topUsers = users.slice(0, 5).map((user, index) => {
    const baseRequests = Math.floor(totalRequests * (0.3 - index * 0.05));
    const userRequests = Math.floor(baseRequests + Math.random() * baseRequests * 0.3);
    const userCost = Math.round(userRequests * 0.05 * 100) / 100;
    
    return {
      id: user.id,
      name: user.username || user.email.split('@')[0],
      email: user.email,
      requests: userRequests,
      cost: userCost,
      tokens: Math.floor(userRequests * (800 + Math.random() * 400)),
      avgResponseTime: Math.floor(avgResponseTime + (Math.random() - 0.5) * 500)
    };
  });

  // 生成热门拼车组数据
  const topGroups = groups.slice(0, 5).map((group, index) => {
    const baseRequests = Math.floor(totalRequests * (0.4 - index * 0.08));
    const groupRequests = Math.floor(baseRequests + Math.random() * baseRequests * 0.4);
    const groupCost = Math.round(groupRequests * 0.08 * 100) / 100;
    
    return {
      id: group.id,
      name: group.name,
      memberCount: group._count.members,
      requests: groupRequests,
      cost: groupCost,
      tokens: Math.floor(groupRequests * (1200 + Math.random() * 800)),
      avgResponseTime: Math.floor(avgResponseTime + (Math.random() - 0.5) * 600)
    };
  });

  // 按服务类型分解
  const serviceBreakdown = [
    {
      serviceType: 'claude',
      serviceName: 'Claude',
      requests: Math.floor(totalRequests * 0.4),
      cost: Math.round(totalCost * 0.5 * 100) / 100,
      percentage: 40
    },
    {
      serviceType: 'gemini',
      serviceName: 'Gemini',
      requests: Math.floor(totalRequests * 0.3),
      cost: Math.round(totalCost * 0.2 * 100) / 100,
      percentage: 30
    },
    {
      serviceType: 'openai',
      serviceName: 'OpenAI',
      requests: Math.floor(totalRequests * 0.2),
      cost: Math.round(totalCost * 0.25 * 100) / 100,
      percentage: 20
    },
    {
      serviceType: 'qwen',
      serviceName: '通义千问',
      requests: Math.floor(totalRequests * 0.1),
      cost: Math.round(totalCost * 0.05 * 100) / 100,
      percentage: 10
    }
  ];

  // 生成每小时趋势数据
  const hourlyTrends = Array.from({ length: 24 }, (_, hour) => {
    const peakHours = [9, 10, 11, 14, 15, 16, 17]; // 工作时间高峰
    const isPeak = peakHours.includes(hour);
    const multiplier = isPeak ? 1.2 + Math.random() * 0.5 : 0.3 + Math.random() * 0.4;
    
    return {
      hour,
      requests: Math.floor(totalRequests / 24 * multiplier),
      cost: Math.round(totalCost / 24 * multiplier * 100) / 100,
      responseTime: Math.floor(avgResponseTime + (Math.random() - 0.5) * 200)
    };
  });

  return {
    totalRequests,
    totalCost,
    totalTokens,
    avgResponseTime,
    successRate,
    topUsers,
    topGroups,
    serviceBreakdown,
    hourlyTrends,
    enterpriseOverview: {
      totalUsers: users.length,
      totalGroups: groups.length,
      activeUsers: Math.floor(users.length * 0.7),
      activeGroups: Math.floor(groups.length * 0.8)
    }
  };
}
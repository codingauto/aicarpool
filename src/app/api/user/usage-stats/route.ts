import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { withAuth, AuthenticatedRequest, createApiResponse } from '@/lib/middleware';

async function handler(req: AuthenticatedRequest) {
  try {
    const userId = req.user!.userId;
    const { searchParams } = new URL(req.url);
    
    // 获取查询参数
    const days = parseInt(searchParams.get('days') || '30');
    const groupId = searchParams.get('groupId');
    const aiServiceId = searchParams.get('aiServiceId');

    // 计算时间范围
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // 构建查询条件
    const whereCondition: Record<string, unknown> = {
      userId,
      requestTime: {
        gte: startDate,
      },
    };

    if (groupId) {
      whereCondition.groupId = groupId;
    }

    if (aiServiceId) {
      whereCondition.aiServiceId = aiServiceId;
    }

    // 获取使用统计
    const [totalStats, dailyStats, serviceStats] = await Promise.all([
      // 总体统计
      prisma.usageStat.aggregate({
        where: whereCondition,
        _sum: {
          tokenCount: true,
          cost: true,
        },
        _count: {
          id: true,
        },
        _avg: {
          responseTime: true,
        },
      }),

      // 每日统计
      prisma.$queryRaw`
        SELECT 
          DATE(requestTime) as date,
          SUM(tokenCount) as tokenCount,
          SUM(cost) as cost,
          COUNT(*) as requestCount,
          AVG(responseTime) as avgResponseTime
        FROM usage_stats 
        WHERE userId = ${userId} 
          AND requestTime >= ${startDate}
          ${groupId ? `AND groupId = ${groupId}` : ''}
          ${aiServiceId ? `AND aiServiceId = ${aiServiceId}` : ''}
        GROUP BY DATE(requestTime)
        ORDER BY date DESC
        LIMIT 30
      `,

      // 按AI服务统计
      prisma.usageStat.groupBy({
        by: ['aiServiceId'],
        where: whereCondition,
        _sum: {
          tokenCount: true,
          cost: true,
        },
        _count: {
          id: true,
        },
        _avg: {
          responseTime: true,
        },
      }),
    ]);

    // 获取AI服务信息
    const aiServices = await prisma.aiService.findMany({
      select: {
        id: true,
        serviceName: true,
        displayName: true,
      },
    });

    // 格式化服务统计数据
    const formattedServiceStats = serviceStats.map(stat => {
      const service = aiServices.find(s => s.id === stat.aiServiceId);
      return {
        aiServiceId: stat.aiServiceId,
        serviceName: service?.serviceName || 'unknown',
        displayName: service?.displayName || 'Unknown Service',
        tokenCount: stat._sum.tokenCount || BigInt(0),
        cost: stat._sum.cost || 0,
        requestCount: stat._count.id,
        avgResponseTime: stat._avg.responseTime || 0,
      };
    });

    const result = {
      period: {
        days,
        startDate,
        endDate: new Date(),
      },
      total: {
        tokenCount: totalStats._sum.tokenCount || BigInt(0),
        cost: totalStats._sum.cost || 0,
        requestCount: totalStats._count.id,
        avgResponseTime: totalStats._avg.responseTime || 0,
      },
      daily: dailyStats,
      byService: formattedServiceStats,
    };

    return createApiResponse(true, result);

  } catch (error) {
    console.error('Get usage stats error:', error);
    return createApiResponse(false, null, '获取使用统计失败', 500);
  }
}

export const GET = withAuth(handler);
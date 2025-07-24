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

    // 由于这是演示版本，我们返回模拟数据
    // 在实际生产环境中，这里会查询真实的使用统计数据
    const result = {
      period: {
        days,
        startDate,
        endDate: new Date(),
      },
      total: {
        tokenCount: BigInt(125000),
        cost: 18.75,
        requestCount: 1250,
        avgResponseTime: 850,
      },
      daily: [
        {
          date: new Date().toISOString().split('T')[0],
          tokenCount: BigInt(8500),
          cost: 1.28,
          requestCount: 85,
          avgResponseTime: 820,
        },
        {
          date: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          tokenCount: BigInt(12000),
          cost: 1.80,
          requestCount: 120,
          avgResponseTime: 890,
        },
        {
          date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          tokenCount: BigInt(9800),
          cost: 1.47,
          requestCount: 98,
          avgResponseTime: 760,
        },
      ],
      byService: [
        {
          aiServiceId: 'claude-service-1',
          serviceName: 'claude',
          displayName: 'Claude Code',
          tokenCount: BigInt(100000),
          cost: 15.0,
          requestCount: 1000,
          avgResponseTime: 850,
        },
        {
          aiServiceId: 'gemini-service-1',
          serviceName: 'gemini',
          displayName: 'Gemini CLI',
          tokenCount: BigInt(25000),
          cost: 3.75,
          requestCount: 250,
          avgResponseTime: 1200,
        },
      ],
    };

    return createApiResponse(true, result);

  } catch (error) {
    console.error('Get usage stats error:', error);
    return createApiResponse(false, null, '获取使用统计失败', 500);
  }
}

export const GET = withAuth(handler);
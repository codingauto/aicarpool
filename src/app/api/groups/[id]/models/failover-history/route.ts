import { NextRequest } from 'next/server';
import { createApiResponse } from '@/lib/middleware';
import { getUserFromRequest } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// GET /api/groups/[id]/models/failover-history - 获取故障转移历史
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return createApiResponse(false, null, '未授权', 401);
    }

    const resolvedParams = await params;
    const { id: groupId } = resolvedParams;

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    try {
      // 尝试从数据库获取故障转移历史
      const failoverHistory = await prisma.modelFailoverLog.findMany({
        where: { groupId },
        orderBy: { timestamp: 'desc' },
        take: limit,
        skip: offset,
        select: {
          id: true,
          fromModel: true,
          toModel: true,
          reason: true,
          success: true,
          errorMsg: true,
          responseTime: true,
          timestamp: true
        }
      });

      const totalCount = await prisma.modelFailoverLog.count({
        where: { groupId }
      });

      return createApiResponse(true, {
        groupId,
        history: failoverHistory,
        pagination: {
          total: totalCount,
          limit,
          offset,
          hasMore: offset + limit < totalCount
        }
      }, '获取故障转移历史成功', 200);

    } catch (dbError) {
      // 如果数据库表不存在，返回空历史
      console.warn('Failover log table not found:', dbError);
      return createApiResponse(true, {
        groupId,
        history: [],
        pagination: {
          total: 0,
          limit,
          offset,
          hasMore: false
        }
      }, '获取故障转移历史成功', 200);
    }

  } catch (error) {
    console.error('Get failover history error:', error);
    return createApiResponse(false, null, '获取故障转移历史失败', 500);
  }
}
import { NextRequest } from 'next/server';
import { createApiResponse } from '@/lib/middleware';
import { getUserFromRequest } from '@/lib/auth';
import { costTracker } from '@/lib/enterprise/cost-tracker';

// GET /api/enterprises/[enterpriseId]/costs - 获取企业成本统计
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ enterpriseId: string }> }
) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return createApiResponse(false, null, '未授权', 401);
    }

    const resolvedParams = await params;
    const { enterpriseId } = resolvedParams;

    const { searchParams } = new URL(request.url);
    const timeRange = searchParams.get('timeRange') || '30d';
    const entityType = searchParams.get('entityType') || 'enterprise';
    const entityId = searchParams.get('entityId') || enterpriseId;

    // 获取成本汇总
    const costSummary = await costTracker.getCostSummary(
      entityType as any,
      entityId,
      timeRange as any
    );

    // 获取预算使用情况
    const budgetUsage = await costTracker.getBudgetUsage(
      entityType as any,
      entityId,
      'monthly'
    );

    return createApiResponse(true, {
      enterpriseId,
      entityType,
      entityId,
      timeRange,
      costSummary,
      budgetUsage,
      generatedAt: new Date()
    }, '获取企业成本统计成功', 200);

  } catch (error) {
    console.error('Get enterprise costs error:', error);
    return createApiResponse(false, null, '获取企业成本统计失败', 500);
  }
}
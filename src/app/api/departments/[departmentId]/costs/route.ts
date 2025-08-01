import { NextRequest } from 'next/server';
import { createApiResponse } from '@/lib/middleware';
import { getUserFromRequest } from '@/lib/auth';
import { costTracker } from '@/lib/enterprise/cost-tracker';
import { prisma } from '@/lib/prisma';

// GET /api/departments/[departmentId]/costs - 获取部门成本统计
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ departmentId: string }> }
) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return createApiResponse(false, null, '未授权', 401);
    }

    const resolvedParams = await params;
    const { departmentId } = resolvedParams;

    const { searchParams } = new URL(request.url);
    const timeRange = searchParams.get('timeRange') || '30d';
    const includeBudget = searchParams.get('includeBudget') === 'true';

    // 验证部门存在
    const department = await prisma.department.findUnique({
      where: { id: departmentId },
      select: {
        id: true,
        name: true,
        budgetLimit: true,
        enterpriseId: true,
        groups: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    if (!department) {
      return createApiResponse(false, null, '部门不存在', 404);
    }

    // 获取部门成本汇总
    const costSummary = await costTracker.getCostSummary(
      'department',
      departmentId,
      timeRange as any
    );

    let budgetInfo = null;
    if (includeBudget && department.budgetLimit) {
      budgetInfo = await costTracker.getBudgetUsage('department', departmentId, 'monthly');
    }

    // 获取子组的成本分布
    const groupCosts = await Promise.all(
      department.groups.map(async (group) => {
        const groupCostSummary = await costTracker.getCostSummary('group', group.id, timeRange as any);
        return {
          groupId: group.id,
          groupName: group.name,
          totalCost: groupCostSummary.totalCost,
          totalTokens: groupCostSummary.totalTokens,
          totalRequests: groupCostSummary.totalRequests
        };
      })
    );

    return createApiResponse(true, {
      department: {
        id: department.id,
        name: department.name,
        budgetLimit: department.budgetLimit,
        enterpriseId: department.enterpriseId
      },
      timeRange,
      costSummary,
      budgetInfo,
      groupCosts,
      generatedAt: new Date()
    }, '获取部门成本统计成功', 200);

  } catch (error) {
    console.error('Get department costs error:', error);
    return createApiResponse(false, null, '获取部门成本统计失败', 500);
  }
}
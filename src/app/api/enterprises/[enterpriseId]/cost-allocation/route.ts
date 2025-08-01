import { NextRequest } from 'next/server';
import { z } from 'zod';
import { createApiResponse } from '@/lib/middleware';
import { getUserFromRequest } from '@/lib/auth';
import { costAllocator, AllocationRule } from '@/lib/enterprise/cost-allocator';

const allocationRuleSchema = z.object({
  name: z.string().min(1, '规则名称不能为空'),
  type: z.enum(['equal', 'usage_based', 'user_count', 'custom_weight']),
  description: z.string().optional(),
  parameters: z.record(z.any()).optional()
});

// POST /api/enterprises/[enterpriseId]/cost-allocation - 执行成本分摊
export async function POST(
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

    const body = await request.json();
    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || 'monthly';

    // 验证分摊规则
    const validatedRule = allocationRuleSchema.parse(body);
    
    const allocationRule: AllocationRule = {
      id: `rule_${Date.now()}`,
      name: validatedRule.name,
      type: validatedRule.type,
      description: validatedRule.description || '',
      isActive: true,
      parameters: validatedRule.parameters || {}
    };

    // 执行成本分摊
    const allocationReport = await costAllocator.allocateCosts(
      enterpriseId,
      allocationRule,
      period as any
    );

    return createApiResponse(true, {
      enterpriseId,
      allocationReport,
      executedAt: new Date()
    }, '成本分摊执行成功', 200);

  } catch (error) {
    if (error instanceof z.ZodError) {
      return createApiResponse(false, null, error.issues[0].message, 400);
    }
    
    console.error('Execute cost allocation error:', error);
    return createApiResponse(false, null, '执行成本分摊失败', 500);
  }
}

// GET /api/enterprises/[enterpriseId]/cost-allocation - 获取分摊历史
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
    const limit = parseInt(searchParams.get('limit') || '12');

    // 获取分摊历史
    const allocationHistory = await costAllocator.getAllocationHistory(enterpriseId, limit);

    return createApiResponse(true, {
      enterpriseId,
      history: allocationHistory,
      total: allocationHistory.length
    }, '获取分摊历史成功', 200);

  } catch (error) {
    console.error('Get allocation history error:', error);
    return createApiResponse(false, null, '获取分摊历史失败', 500);
  }
}
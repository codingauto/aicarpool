import { NextRequest } from 'next/server';
import { createApiResponse } from '@/lib/middleware';
import { getUserFromRequest } from '@/lib/auth';
import { healthChecker } from '@/lib/enterprise/health-checker';

// GET /api/groups/[id]/models/health - 获取组的模型健康状态
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
    const modelId = searchParams.get('modelId');
    const timeRange = searchParams.get('timeRange') || '1h';

    if (modelId) {
      // 获取单个模型的健康状态
      const healthResult = await healthChecker.checkModelHealth(modelId, groupId);
      const performanceMetrics = await healthChecker.getPerformanceMetrics(modelId, undefined, timeRange);

      return createApiResponse(true, {
        model: modelId,
        health: healthResult,
        metrics: performanceMetrics
      }, '获取模型健康状态成功', 200);
    } else {
      // 获取所有模型的健康状态
      const defaultModels = ['claude-4-sonnet', 'claude-4-opus', 'kimi-k2', 'glm-4.5', 'qwen-max'];
      const healthResults = await healthChecker.checkMultipleModels(defaultModels, groupId);

      return createApiResponse(true, {
        groupId,
        models: healthResults,
        lastChecked: new Date()
      }, '获取模型健康状态成功', 200);
    }

  } catch (error) {
    console.error('Get model health error:', error);
    return createApiResponse(false, null, '获取模型健康状态失败', 500);
  }
}
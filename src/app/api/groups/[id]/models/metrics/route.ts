import { NextRequest } from 'next/server';
import { createApiResponse } from '@/lib/middleware';
import { getUserFromRequest } from '@/lib/auth';
import { healthChecker } from '@/lib/enterprise/health-checker';
import { prisma } from '@/lib/prisma';

// GET /api/groups/[id]/models/metrics - 获取模型性能指标
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
    const metricType = searchParams.get('metricType') as 'response_time' | 'success_rate' | 'error_rate' | 'health_score' | undefined;
    const timeRange = searchParams.get('timeRange') || '1h';

    if (!modelId) {
      return createApiResponse(false, null, '缺少modelId参数', 400);
    }

    // 获取性能指标
    const metrics = await healthChecker.getPerformanceMetrics(modelId, metricType, timeRange);

    // 获取当前健康分数
    const currentHealthScore = await healthChecker.getModelHealthScore(modelId);

    // 计算统计信息
    const stats = {
      totalSamples: metrics.reduce((sum, metric) => sum + metric.sampleCount, 0),
      avgValue: metrics.length > 0 ? metrics.reduce((sum, metric) => sum + metric.value, 0) / metrics.length : 0,
      currentHealthScore,
      lastUpdated: metrics.length > 0 ? metrics[0].windowEnd : new Date()
    };

    return createApiResponse(true, {
      groupId,
      modelId,
      metricType: metricType || 'all',
      timeRange,
      metrics,
      stats
    }, '获取模型性能指标成功', 200);

  } catch (error) {
    console.error('Get model metrics error:', error);
    return createApiResponse(false, null, '获取模型性能指标失败', 500);
  }
}


import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { createApiResponse } from '@/lib/middleware';
import { getUserFromRequest } from '@/lib/auth';
import { cacheManager } from '@/lib/cache';

const metricsQuerySchema = z.object({
  modelId: z.string().optional(),
  metricType: z.enum(['response_time', 'success_rate', 'error_rate', 'health_score']).optional(),
  timeRange: z.enum(['1h', '6h', '24h', '7d', '30d']).default('24h'),
  limit: z.number().min(1).max(1000).default(100),
});

// GET /api/groups/[id]/model-metrics - 获取模型性能指标
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
    const groupId = resolvedParams.id;

    // 检查用户是否为组成员
    const membership = await prisma.groupMember.findFirst({
      where: {
        groupId,
        userId: user.id,
        status: 'active',
      },
    });

    if (!membership) {
      return createApiResponse(false, null, '无权访问该拼车组', 403);
    }

    const { searchParams } = new URL(request.url);
    const query = metricsQuerySchema.parse({
      modelId: searchParams.get('modelId') || undefined,
      metricType: searchParams.get('metricType') || undefined,
      timeRange: searchParams.get('timeRange') || '24h',
      limit: parseInt(searchParams.get('limit') || '100'),
    });

    // 计算时间范围
    const timeRangeMap = {
      '1h': 1 * 60 * 60 * 1000,
      '6h': 6 * 60 * 60 * 1000,
      '24h': 24 * 60 * 60 * 1000,
      '7d': 7 * 24 * 60 * 60 * 1000,
      '30d': 30 * 24 * 60 * 60 * 1000,
    };

    const timeRangeMs = timeRangeMap[query.timeRange];
    const startTime = new Date(Date.now() - timeRangeMs);

    // 构建查询条件
    const whereCondition: any = {
      groupId,
      windowStart: {
        gte: startTime,
      },
    };

    if (query.modelId) {
      whereCondition.modelId = query.modelId;
    }

    if (query.metricType) {
      whereCondition.metricType = query.metricType;
    }

    // 获取性能指标
    const metrics = await prisma.modelPerformanceMetric.findMany({
      where: whereCondition,
      orderBy: { windowStart: 'desc' },
      take: query.limit,
    });

    // 获取可用的模型列表
    const availableModels = await prisma.modelPerformanceMetric.findMany({
      where: { groupId },
      select: { modelId: true },
      distinct: ['modelId'],
    });

    // 计算汇总统计
    const summary = await calculateMetricsSummary(groupId, query.modelId, startTime);

    return createApiResponse({
      metrics: metrics.map(metric => ({
        id: metric.id,
        modelId: metric.modelId,
        metricType: metric.metricType,
        value: Number(metric.value),
        unit: metric.unit,
        windowStart: metric.windowStart,
        windowEnd: metric.windowEnd,
        sampleCount: metric.sampleCount,
        tags: metric.tags as any,
      })),
      summary,
      availableModels: availableModels.map(m => m.modelId),
      query: {
        timeRange: query.timeRange,
        modelId: query.modelId,
        metricType: query.metricType,
      },
      totalCount: metrics.length,
    }, true);

  } catch (error) {
    if (error instanceof z.ZodError) {
      return createApiResponse(false, null, error.issues[0].message, 400);
    }

    console.error('Get model metrics error:', error);
    return createApiResponse(false, null, '获取模型指标失败', 500);
  }
}

// POST /api/groups/[id]/model-metrics - 记录模型性能指标 (用于系统内部)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 这个接口主要用于系统内部记录指标，需要内部API密钥
    const apiKey = request.headers.get('x-internal-api-key');
    if (apiKey !== process.env.INTERNAL_API_KEY) {
      return createApiResponse(false, null, '无权限访问内部API', 403);
    }

    const groupId = params.id;
    const body = await request.json();

    const metricSchema = z.object({
      modelId: z.string(),
      metricType: z.enum(['response_time', 'success_rate', 'error_rate', 'health_score']),
      value: z.number(),
      unit: z.string(),
      windowStart: z.string().datetime(),
      windowEnd: z.string().datetime(),
      sampleCount: z.number().default(1),
      tags: z.record(z.any()).optional(),
    });

    const metrics = z.array(metricSchema).parse(Array.isArray(body) ? body : [body]);

    // 批量插入指标
    const createdMetrics = await prisma.modelPerformanceMetric.createMany({
      data: metrics.map(metric => ({
        groupId,
        modelId: metric.modelId,
        metricType: metric.metricType,
        value: metric.value,
        unit: metric.unit,
        windowStart: new Date(metric.windowStart),
        windowEnd: new Date(metric.windowEnd),
        sampleCount: metric.sampleCount,
        tags: metric.tags as any,
      })),
    });
    
    // 清理相关缓存
    await cacheManager.invalidateModelCache(groupId);

    return createApiResponse(true, {
      success: true,
      count: createdMetrics.count,
      message: `成功记录 ${createdMetrics.count} 条指标`,
    }, '指标记录成功', 201);

  } catch (error) {
    if (error instanceof z.ZodError) {
      return createApiResponse(false, null, error.issues[0].message, 400);
    }

    console.error('Record model metrics error:', error);
    return createApiResponse(false, null, '记录模型指标失败', 500);
  }
}

// 计算指标汇总统计
async function calculateMetricsSummary(
  groupId: string,
  modelId?: string,
  startTime?: Date
) {
  const whereCondition: any = { groupId };
  
  if (modelId) {
    whereCondition.modelId = modelId;
  }
  
  if (startTime) {
    whereCondition.windowStart = { gte: startTime };
  }

  // 获取各类指标的统计
  const responseTimeMetrics = await prisma.modelPerformanceMetric.aggregate({
    where: { ...whereCondition, metricType: 'response_time' },
    _avg: { value: true },
    _min: { value: true },
    _max: { value: true },
    _count: true,
  });

  const successRateMetrics = await prisma.modelPerformanceMetric.aggregate({
    where: { ...whereCondition, metricType: 'success_rate' },
    _avg: { value: true },
    _count: true,
  });

  const errorRateMetrics = await prisma.modelPerformanceMetric.aggregate({
    where: { ...whereCondition, metricType: 'error_rate' },
    _avg: { value: true },
    _count: true,
  });

  const healthScoreMetrics = await prisma.modelPerformanceMetric.aggregate({
    where: { ...whereCondition, metricType: 'health_score' },
    _avg: { value: true },
    _count: true,
  });

  return {
    responseTime: {
      average: responseTimeMetrics._avg.value ? Number(responseTimeMetrics._avg.value) : null,
      min: responseTimeMetrics._min.value ? Number(responseTimeMetrics._min.value) : null,
      max: responseTimeMetrics._max.value ? Number(responseTimeMetrics._max.value) : null,
      count: responseTimeMetrics._count,
      unit: 'ms',
    },
    successRate: {
      average: successRateMetrics._avg.value ? Number(successRateMetrics._avg.value) : null,
      count: successRateMetrics._count,
      unit: 'percent',
    },
    errorRate: {
      average: errorRateMetrics._avg.value ? Number(errorRateMetrics._avg.value) : null,
      count: errorRateMetrics._count,
      unit: 'percent',
    },
    healthScore: {
      average: healthScoreMetrics._avg.value ? Number(healthScoreMetrics._avg.value) : null,
      count: healthScoreMetrics._count,
      unit: 'score',
    },
  };
}
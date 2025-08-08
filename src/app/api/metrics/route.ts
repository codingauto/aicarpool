import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { redisClient } from '@/lib/redis';
import { getGroupUsageStats } from '@/lib/rate-limit';

/**
 * Metrics端点
 * 提供系统健康状态和性能指标
 */
export async function GET(request: NextRequest) {
  try {
    // 验证访问权限
    const authHeader = request.headers.get('authorization');
    const metricsSecret = process.env.METRICS_SECRET;
    
    if (metricsSecret && authHeader !== `Bearer ${metricsSecret}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // 收集各种指标
    const metrics = await collectMetrics();
    
    // 返回Prometheus格式的metrics
    const prometheusFormat = formatPrometheusMetrics(metrics);
    
    return new NextResponse(prometheusFormat, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; version=0.0.4',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
  } catch (error) {
    console.error('Metrics collection error:', error);
    return NextResponse.json(
      { error: 'Failed to collect metrics' },
      { status: 500 }
    );
  }
}

async function collectMetrics() {
  const now = new Date();
  const startOfDay = new Date(now.setHours(0, 0, 0, 0));
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  // 并发收集所有指标
  const [
    // 数据库指标
    userCount,
    activeUserCount,
    groupCount,
    activeGroupCount,
    apiKeyCount,
    activeApiKeyCount,
    
    // 使用统计
    dailyRequests,
    monthlyRequests,
    dailyTokens,
    monthlyTokens,
    
    // Redis健康检查
    redisInfo,
    
    // 系统健康
    dbHealth,
  ] = await Promise.all([
    // 用户指标
    prisma.user.count(),
    prisma.user.count({ where: { status: 'active' } }),
    
    // 拼车组指标
    prisma.carpoolGroup.count(),
    prisma.carpoolGroup.count({ where: { status: 'active' } }),
    
    // API密钥指标
    prisma.apiKey.count(),
    prisma.apiKey.count({ where: { status: 'active' } }),
    
    // 使用统计
    prisma.usageStat.count({
      where: { requestTime: { gte: startOfDay } }
    }),
    prisma.usageStat.count({
      where: { requestTime: { gte: startOfMonth } }
    }),
    prisma.usageStat.aggregate({
      where: { requestTime: { gte: startOfDay } },
      _sum: { totalTokens: true }
    }),
    prisma.usageStat.aggregate({
      where: { requestTime: { gte: startOfMonth } },
      _sum: { totalTokens: true }
    }),
    
    // Redis信息
    getRedisInfo(),
    
    // 数据库健康检查
    checkDatabaseHealth(),
  ]);

  // 计算错误率
  const [dailyErrors, dailyTotal] = await Promise.all([
    prisma.usageStat.count({
      where: {
        requestTime: { gte: startOfDay },
        status: 'error'
      }
    }),
    prisma.usageStat.count({
      where: { requestTime: { gte: startOfDay } }
    }),
  ]);

  const errorRate = dailyTotal > 0 ? (dailyErrors / dailyTotal) * 100 : 0;

  // 获取平均响应时间
  const avgResponseTime = await prisma.usageStat.aggregate({
    where: { requestTime: { gte: startOfDay } },
    _avg: { responseTime: true }
  });

  return {
    // 系统健康
    system_health: {
      database: dbHealth ? 1 : 0,
      redis: redisInfo.connected ? 1 : 0,
    },
    
    // 用户指标
    users: {
      total: userCount,
      active: activeUserCount,
    },
    
    // 拼车组指标
    groups: {
      total: groupCount,
      active: activeGroupCount,
    },
    
    // API密钥指标
    api_keys: {
      total: apiKeyCount,
      active: activeApiKeyCount,
    },
    
    // 使用统计
    usage: {
      daily_requests: dailyRequests,
      monthly_requests: monthlyRequests,
      daily_tokens: Number(dailyTokens._sum.totalTokens || 0),
      monthly_tokens: Number(monthlyTokens._sum.totalTokens || 0),
      error_rate: errorRate,
      avg_response_time_ms: avgResponseTime._avg.responseTime || 0,
    },
    
    // Redis指标
    redis: {
      connected: redisInfo.connected ? 1 : 0,
      memory_used_mb: redisInfo.memoryUsed,
      keys_count: redisInfo.keysCount,
    },
  };
}

async function getRedisInfo() {
  try {
    const info = await redisClient.info('memory');
    const dbSize = await redisClient.dbsize();
    
    // 解析Redis INFO输出
    const memoryUsed = info.match(/used_memory:(\d+)/)?.[1];
    
    return {
      connected: true,
      memoryUsed: memoryUsed ? parseInt(memoryUsed) / 1024 / 1024 : 0,
      keysCount: dbSize,
    };
  } catch (error) {
    console.error('Redis info error:', error);
    return {
      connected: false,
      memoryUsed: 0,
      keysCount: 0,
    };
  }
}

async function checkDatabaseHealth() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch (error) {
    console.error('Database health check failed:', error);
    return false;
  }
}

function formatPrometheusMetrics(metrics: any): string {
  const lines: string[] = [];
  
  // Helper function to add metric
  const addMetric = (name: string, value: number, help?: string, type?: string) => {
    if (help) lines.push(`# HELP ${name} ${help}`);
    if (type) lines.push(`# TYPE ${name} ${type}`);
    lines.push(`${name} ${value}`);
    lines.push('');
  };
  
  // System health metrics
  addMetric(
    'aicarpool_system_health_database',
    metrics.system_health.database,
    'Database health status (1=healthy, 0=unhealthy)',
    'gauge'
  );
  
  addMetric(
    'aicarpool_system_health_redis',
    metrics.system_health.redis,
    'Redis health status (1=healthy, 0=unhealthy)',
    'gauge'
  );
  
  // User metrics
  addMetric(
    'aicarpool_users_total',
    metrics.users.total,
    'Total number of users',
    'gauge'
  );
  
  addMetric(
    'aicarpool_users_active',
    metrics.users.active,
    'Number of active users',
    'gauge'
  );
  
  // Group metrics
  addMetric(
    'aicarpool_groups_total',
    metrics.groups.total,
    'Total number of carpool groups',
    'gauge'
  );
  
  addMetric(
    'aicarpool_groups_active',
    metrics.groups.active,
    'Number of active carpool groups',
    'gauge'
  );
  
  // API key metrics
  addMetric(
    'aicarpool_api_keys_total',
    metrics.api_keys.total,
    'Total number of API keys',
    'gauge'
  );
  
  addMetric(
    'aicarpool_api_keys_active',
    metrics.api_keys.active,
    'Number of active API keys',
    'gauge'
  );
  
  // Usage metrics
  addMetric(
    'aicarpool_requests_daily_total',
    metrics.usage.daily_requests,
    'Total requests today',
    'counter'
  );
  
  addMetric(
    'aicarpool_requests_monthly_total',
    metrics.usage.monthly_requests,
    'Total requests this month',
    'counter'
  );
  
  addMetric(
    'aicarpool_tokens_daily_total',
    metrics.usage.daily_tokens,
    'Total tokens used today',
    'counter'
  );
  
  addMetric(
    'aicarpool_tokens_monthly_total',
    metrics.usage.monthly_tokens,
    'Total tokens used this month',
    'counter'
  );
  
  addMetric(
    'aicarpool_error_rate_percent',
    metrics.usage.error_rate,
    'Error rate percentage',
    'gauge'
  );
  
  addMetric(
    'aicarpool_response_time_avg_ms',
    metrics.usage.avg_response_time_ms,
    'Average response time in milliseconds',
    'gauge'
  );
  
  // Redis metrics
  addMetric(
    'aicarpool_redis_memory_used_mb',
    metrics.redis.memory_used_mb,
    'Redis memory usage in MB',
    'gauge'
  );
  
  addMetric(
    'aicarpool_redis_keys_total',
    metrics.redis.keys_count,
    'Total number of Redis keys',
    'gauge'
  );
  
  return lines.join('\n');
}

// 健康检查端点
export async function HEAD() {
  try {
    // 快速健康检查
    await prisma.$queryRaw`SELECT 1`;
    await redisClient.ping();
    
    return new NextResponse(null, { status: 200 });
  } catch (error) {
    console.error('Health check failed:', error);
    return new NextResponse(null, { status: 503 });
  }
}
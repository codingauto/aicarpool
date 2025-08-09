import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { redisClient } from '@/lib/redis';

interface HealthCheck {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  checks: {
    database: CheckResult;
    redis: CheckResult;
    api: CheckResult;
  };
  metrics?: {
    responseTime: number;
    uptime: number;
    memoryUsage: number;
  };
}

interface CheckResult {
  status: 'pass' | 'fail' | 'warning';
  message?: string;
  responseTime?: number;
}

// 记录启动时间
const startTime = Date.now();

/**
 * 健康检查端点
 * GET /api/health - 详细健康检查
 * HEAD /api/health - 快速健康检查
 */
export async function GET(request: NextRequest) {
  const healthCheck: HealthCheck = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    checks: {
      database: { status: 'pass' },
      redis: { status: 'pass' },
      api: { status: 'pass' }
    }
  };

  // 检查数据库
  const dbStart = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    healthCheck.checks.database.responseTime = Date.now() - dbStart;
    healthCheck.checks.database.message = 'Database connection successful';
  } catch (error) {
    healthCheck.checks.database.status = 'fail';
    healthCheck.checks.database.message = error instanceof Error ? error.message : 'Database connection failed';
    healthCheck.status = 'unhealthy';
  }

  // 检查Redis
  const redisStart = Date.now();
  try {
    await redisClient.ping();
    const info = await redisClient.info('server');
    healthCheck.checks.redis.responseTime = Date.now() - redisStart;
    healthCheck.checks.redis.message = 'Redis connection successful';
    
    // 检查Redis内存使用
    const memoryInfo = await redisClient.info('memory');
    const usedMemory = memoryInfo.match(/used_memory:(\d+)/)?.[1];
    if (usedMemory && parseInt(usedMemory) > 100 * 1024 * 1024) { // 100MB警告阈值
      healthCheck.checks.redis.status = 'warning';
      healthCheck.checks.redis.message = 'Redis memory usage is high';
      if (healthCheck.status === 'healthy') {
        healthCheck.status = 'degraded';
      }
    }
  } catch (error) {
    healthCheck.checks.redis.status = 'fail';
    healthCheck.checks.redis.message = error instanceof Error ? error.message : 'Redis connection failed';
    healthCheck.status = 'unhealthy';
  }

  // 检查API响应时间
  const apiResponseTime = 
    (healthCheck.checks.database.responseTime || 0) + 
    (healthCheck.checks.redis.responseTime || 0);
  
  if (apiResponseTime > 1000) { // 1秒警告阈值
    healthCheck.checks.api.status = 'warning';
    healthCheck.checks.api.message = 'API response time is slow';
    if (healthCheck.status === 'healthy') {
      healthCheck.status = 'degraded';
    }
  } else {
    healthCheck.checks.api.message = 'API is responsive';
  }
  healthCheck.checks.api.responseTime = apiResponseTime;

  // 添加系统指标
  healthCheck.metrics = {
    responseTime: apiResponseTime,
    uptime: Date.now() - startTime,
    memoryUsage: process.memoryUsage().heapUsed / 1024 / 1024 // MB
  };

  // 根据健康状态返回不同的HTTP状态码
  const statusCode = 
    healthCheck.status === 'healthy' ? 200 :
    healthCheck.status === 'degraded' ? 200 :
    503;

  return NextResponse.json(healthCheck, { status: statusCode });
}

/**
 * HEAD请求 - 快速健康检查
 */
export async function HEAD() {
  try {
    // 快速检查数据库和Redis连接
    await Promise.all([
      prisma.$queryRaw`SELECT 1`,
      redisClient.ping()
    ]);
    
    return new NextResponse(null, { status: 200 });
  } catch (error) {
    return new NextResponse(null, { status: 503 });
  }
}

/**
 * 就绪检查端点
 * 用于Kubernetes等容器编排系统
 */
export async function POST(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type');

  if (type === 'readiness') {
    // 就绪检查：系统是否准备好接收流量
    try {
      // 检查关键依赖
      await Promise.all([
        prisma.$queryRaw`SELECT 1`,
        redisClient.ping()
      ]);
      
      return NextResponse.json({ ready: true }, { status: 200 });
    } catch (error) {
      return NextResponse.json({ 
        ready: false, 
        error: error instanceof Error ? error.message : 'System not ready' 
      }, { status: 503 });
    }
  }

  if (type === 'liveness') {
    // 存活检查：进程是否还在运行
    return NextResponse.json({ alive: true }, { status: 200 });
  }

  return NextResponse.json({ error: 'Invalid check type' }, { status: 400 });
}
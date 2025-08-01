/**
 * 缓存中间件
 * 为API路由提供自动缓存功能
 */

import { NextRequest, NextResponse } from 'next/server';
import { cacheManager } from '@/lib/cache';

export interface CacheMiddlewareOptions {
  ttl?: number;
  keyGenerator?: (req: NextRequest) => string;
  skipConditions?: (req: NextRequest) => boolean;
  invalidatePatterns?: string[];
}

/**
 * 创建缓存中间件
 */
export function createCacheMiddleware(options: CacheMiddlewareOptions = {}) {
  const {
    ttl = 300, // 默认5分钟
    keyGenerator = (req) => `api:${req.nextUrl.pathname}:${req.nextUrl.search}`,
    skipConditions = () => false,
    invalidatePatterns = []
  } = options;

  return async function cacheMiddleware(
    req: NextRequest,
    handler: (req: NextRequest) => Promise<NextResponse>
  ): Promise<NextResponse> {
    // 跳过缓存的条件检查
    if (skipConditions(req) || req.method !== 'GET') {
      return handler(req);
    }

    const cacheKey = keyGenerator(req);

    try {
      // 尝试从缓存获取数据
      const cached = await cacheManager.get<any>(cacheKey);
      if (cached) {
        console.log(`Cache hit: ${cacheKey}`);
        return NextResponse.json(cached, {
          headers: {
            'X-Cache': 'HIT',
            'Cache-Control': 'public, max-age=300'
          }
        });
      }

      // 缓存未命中，执行原始处理器
      console.log(`Cache miss: ${cacheKey}`);
      const response = await handler(req);
      
      // 只缓存成功的响应
      if (response.ok) {
        const responseData = await response.json();
        await cacheManager.set(cacheKey, responseData, ttl);
        
        return NextResponse.json(responseData, {
          headers: {
            'X-Cache': 'MISS',
            'Cache-Control': 'public, max-age=300'
          }
        });
      }

      return response;
    } catch (error) {
      console.error('Cache middleware error:', error);
      // 缓存出错时直接执行原始处理器
      return handler(req);
    }
  };
}

/**
 * 简单的GET请求缓存装饰器
 */
export function withCache(options: CacheMiddlewareOptions = {}) {
  return function decorator(
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;
    const middleware = createCacheMiddleware(options);

    descriptor.value = async function (req: NextRequest, ...args: any[]) {
      return middleware(req, () => originalMethod.call(this, req, ...args));
    };

    return descriptor;
  };
}

/**
 * API路由缓存辅助函数
 */
export class ApiCache {
  /**
   * 为特定的API路由创建缓存键
   */
  static createKey(segments: string[]): string {
    return segments.filter(Boolean).join(':');
  }

  /**
   * 用户相关API缓存
   */
  static userApi(userId: string, endpoint: string, params?: string): string {
    return this.createKey(['api', 'user', userId, endpoint, params || '']);
  }

  /**
   * 组相关API缓存
   */
  static groupApi(groupId: string, endpoint: string, params?: string): string {
    return this.createKey(['api', 'group', groupId, endpoint, params || '']);
  }

  /**
   * 监控相关API缓存
   */
  static monitoringApi(endpoint: string, params?: string): string {
    return this.createKey(['api', 'monitoring', endpoint, params || '']);
  }

  /**
   * 统计相关API缓存
   */
  static statsApi(identifier: string, period: string, params?: string): string {
    return this.createKey(['api', 'stats', identifier, period, params || '']);
  }
}

/**
 * 预定义的缓存配置
 */
export const CACHE_CONFIGS = {
  // 用户数据 - 30分钟
  USER_DATA: {
    ttl: 30 * 60,
    keyGenerator: (req: NextRequest) => {
      const userId = req.nextUrl.pathname.split('/')[3]; // /api/user/{userId}/...
      return ApiCache.userApi(userId, req.nextUrl.pathname, req.nextUrl.search);
    }
  },

  // 组数据 - 15分钟
  GROUP_DATA: {
    ttl: 15 * 60,
    keyGenerator: (req: NextRequest) => {
      const groupId = req.nextUrl.pathname.split('/')[3]; // /api/groups/{groupId}/...
      return ApiCache.groupApi(groupId, req.nextUrl.pathname, req.nextUrl.search);
    }
  },

  // 统计数据 - 5分钟
  STATS_DATA: {
    ttl: 5 * 60,
    keyGenerator: (req: NextRequest) => {
      const pathSegments = req.nextUrl.pathname.split('/');
      const identifier = pathSegments[3]; // groupId or userId
      const searchParams = new URLSearchParams(req.nextUrl.search);
      const period = searchParams.get('period') || 'day';
      return ApiCache.statsApi(identifier, period, req.nextUrl.search);
    }
  },

  // 监控数据 - 1分钟
  MONITORING_DATA: {
    ttl: 1 * 60,
    keyGenerator: (req: NextRequest) => {
      return ApiCache.monitoringApi(req.nextUrl.pathname, req.nextUrl.search);
    }
  },

  // 配置数据 - 1小时
  CONFIG_DATA: {
    ttl: 60 * 60,
    skipConditions: (req: NextRequest) => {
      // 如果包含敏感信息的请求跳过缓存
      return req.headers.get('authorization')?.includes('admin') || false;
    }
  }
} as const;
/**
 * Redis缓存管理层
 * 统一的缓存策略和数据操作接口
 */

import redis from './redis';
import { prisma } from './prisma';

// 缓存键前缀定义
export const CACHE_KEYS = {
  // 用户相关 (TTL: 30分钟)
  USER_PROFILE: (userId: string) => `user:profile:${userId}`,
  USER_GROUPS: (userId: string) => `user:groups:${userId}`,
  
  // 组相关 (TTL: 15分钟)
  GROUP_DETAIL: (groupId: string) => `group:detail:${groupId}`,
  GROUP_MEMBERS: (groupId: string) => `group:members:${groupId}`,
  GROUP_AI_SERVICES: (groupId: string) => `group:ai_services:${groupId}`,
  GROUP_AI_ACCOUNTS: (groupId: string) => `group:ai_accounts:${groupId}`,
  
  // 统计数据 (TTL: 5分钟)
  USAGE_STATS: (groupId: string, period: string) => `stats:usage:${groupId}:${period}`,
  USER_USAGE_STATS: (userId: string, period: string) => `stats:user:${userId}:${period}`,
  DASHBOARD_STATS: (userId: string) => `stats:dashboard:${userId}`,
  
  // 系统监控 (TTL: 1分钟)
  SYSTEM_HEALTH: () => `monitor:health`,
  EDGE_NODES: () => `monitor:edge_nodes`,
  EDGE_NODE_METRICS: (nodeId: string) => `monitor:edge_node:${nodeId}`,
  
  // AI服务状态 (TTL: 10分钟)
  AI_SERVICE_STATUS: (serviceId: string) => `service:status:${serviceId}`,
  
  // 配置缓存 (TTL: 1小时)
  GROUP_CONFIG: (groupId: string) => `config:group:${groupId}`,
} as const;

// TTL配置 (秒)
export const CACHE_TTL = {
  USER_DATA: 30 * 60,        // 30分钟
  GROUP_DATA: 15 * 60,       // 15分钟  
  STATS_DATA: 5 * 60,        // 5分钟
  MONITORING: 1 * 60,        // 1分钟
  AI_SERVICE: 10 * 60,       // 10分钟
  CONFIG: 60 * 60,           // 1小时
  SESSION: 10 * 60,          // 10分钟 (OAuth等临时数据)
} as const;

interface CacheOptions {
  ttl?: number;
  forceRefresh?: boolean;
}

class CacheManager {
  private client = redis;

  /**
   * 通用缓存获取方法
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const redisClient = this.client.getClient();
      if (!redisClient) return null;

      const cached = await redisClient.get(key);
      if (!cached) return null;

      return JSON.parse(cached) as T;
    } catch (error) {
      console.error(`Cache get error for key ${key}:`, error);
      return null;
    }
  }

  /**
   * 通用缓存设置方法
   */
  async set<T>(key: string, value: T, ttl: number): Promise<void> {
    try {
      const redisClient = this.client.getClient();
      if (!redisClient) return;

      await redisClient.setex(key, ttl, JSON.stringify(value));
    } catch (error) {
      console.error(`Cache set error for key ${key}:`, error);
    }
  }

  /**
   * 删除缓存
   */
  async del(key: string | string[]): Promise<void> {
    try {
      const redisClient = this.client.getClient();
      if (!redisClient) return;

      if (Array.isArray(key)) {
        await redisClient.del(...key);
      } else {
        await redisClient.del(key);
      }
    } catch (error) {
      console.error(`Cache del error:`, error);
    }
  }

  /**
   * 批量删除匹配的键
   */
  async delPattern(pattern: string): Promise<void> {
    try {
      const redisClient = this.client.getClient();
      if (!redisClient) return;

      const keys = await redisClient.keys(pattern);
      if (keys.length > 0) {
        await redisClient.del(...keys);
      }
    } catch (error) {
      console.error(`Cache delPattern error for pattern ${pattern}:`, error);
    }
  }

  /**
   * 缓存穿透保护的数据获取
   */
  async getOrSet<T>(
    key: string,
    fetcher: () => Promise<T>,
    options: CacheOptions = {}
  ): Promise<T> {
    const { ttl = CACHE_TTL.GROUP_DATA, forceRefresh = false } = options;

    // 强制刷新时跳过缓存
    if (!forceRefresh) {
      const cached = await this.get<T>(key);
      if (cached !== null) {
        return cached;
      }
    }

    // 缓存未命中，执行数据获取
    try {
      const data = await fetcher();
      await this.set(key, data, ttl);
      return data;
    } catch (error) {
      console.error(`Fetcher error for key ${key}:`, error);
      throw error;
    }
  }

  // === 用户相关缓存 ===
  async getUserProfile(userId: string, forceRefresh = false) {
    return this.getOrSet(
      CACHE_KEYS.USER_PROFILE(userId),
      async () => {
        return await prisma.user.findUnique({
          where: { id: userId },
          select: {
            id: true,
            email: true,
            username: true,
            role: true,
            isActive: true,
            createdAt: true,
            updatedAt: true,
          }
        });
      },
      { ttl: CACHE_TTL.USER_DATA, forceRefresh }
    );
  }

  async getUserGroups(userId: string, forceRefresh = false) {
    return this.getOrSet(
      CACHE_KEYS.USER_GROUPS(userId),
      async () => {
        return await prisma.groupMember.findMany({
          where: { userId },
          include: {
            group: {
              select: {
                id: true,
                name: true,
                description: true,
                isActive: true,
                createdAt: true,
              }
            }
          }
        });
      },
      { ttl: CACHE_TTL.USER_DATA, forceRefresh }
    );
  }

  // === 组相关缓存 ===
  async getGroupMembers(groupId: string, forceRefresh = false) {
    return this.getOrSet(
      CACHE_KEYS.GROUP_MEMBERS(groupId),
      async () => {
        return await prisma.groupMember.findMany({
          where: { groupId },
          include: {
            user: {
              select: {
                id: true,
                email: true,
                username: true,
                isActive: true,
              }
            }
          }
        });
      },
      { ttl: CACHE_TTL.GROUP_DATA, forceRefresh }
    );
  }

  async getGroupAiServices(groupId: string, forceRefresh = false) {
    return this.getOrSet(
      CACHE_KEYS.GROUP_AI_SERVICES(groupId),
      async () => {
        return await prisma.groupAiService.findMany({
          where: { groupId },
          include: {
            aiService: true,
          }
        });
      },
      { ttl: CACHE_TTL.GROUP_DATA, forceRefresh }
    );
  }

  async getGroupAiAccounts(groupId: string, forceRefresh = false) {
    return this.getOrSet(
      CACHE_KEYS.GROUP_AI_ACCOUNTS(groupId),
      async () => {
        return await prisma.aiServiceAccount.findMany({
          where: { groupId },
          select: {
            id: true,
            name: true,
            serviceType: true,
            accountType: true,
            authType: true,
            isActive: true,
            lastUsed: true,
            createdAt: true,
          }
        });
      },
      { ttl: CACHE_TTL.GROUP_DATA, forceRefresh }
    );
  }

  // === 统计数据缓存 ===
  async getUsageStats(groupId: string, period: string, forceRefresh = false) {
    return this.getOrSet(
      CACHE_KEYS.USAGE_STATS(groupId, period),
      async () => {
        // 这里应该实现具体的统计查询逻辑
        // 暂时返回模拟数据结构
        return {
          period,
          totalRequests: 0,
          totalTokens: 0,
          totalCost: 0,
          byService: {},
          byUser: {},
        };
      },
      { ttl: CACHE_TTL.STATS_DATA, forceRefresh }
    );
  }

  // === 监控数据缓存 ===
  async getSystemHealth(forceRefresh = false) {
    return this.getOrSet(
      CACHE_KEYS.SYSTEM_HEALTH(),
      async () => {
        // 系统健康检查逻辑
        return {
          status: 'healthy',
          timestamp: new Date(),
          services: {
            database: 'up',
            redis: 'up',
            ai_services: 'up',
          }
        };
      },
      { ttl: CACHE_TTL.MONITORING, forceRefresh }
    );
  }

  async getEdgeNodes(forceRefresh = false) {
    return this.getOrSet(
      CACHE_KEYS.EDGE_NODES(),
      async () => {
        return await prisma.edgeNode.findMany({
          select: {
            id: true,
            name: true,
            host: true,
            port: true,
            status: true,
            lastHeartbeat: true,
            region: true,
            isActive: true,
          }
        });
      },
      { ttl: CACHE_TTL.MONITORING, forceRefresh }
    );
  }

  // === 缓存失效方法 ===
  async invalidateUserCache(userId: string) {
    await this.del([
      CACHE_KEYS.USER_PROFILE(userId),
      CACHE_KEYS.USER_GROUPS(userId),
    ]);
    
    // 删除用户相关的统计数据缓存
    await this.delPattern(`stats:user:${userId}:*`);
    await this.delPattern(`stats:dashboard:${userId}`);
  }

  async invalidateGroupCache(groupId: string) {
    await this.del([
      CACHE_KEYS.GROUP_DETAIL(groupId),
      CACHE_KEYS.GROUP_MEMBERS(groupId),
      CACHE_KEYS.GROUP_AI_SERVICES(groupId),
      CACHE_KEYS.GROUP_AI_ACCOUNTS(groupId),
      CACHE_KEYS.GROUP_CONFIG(groupId),
    ]);
    
    // 删除组相关的统计数据缓存
    await this.delPattern(`stats:usage:${groupId}:*`);
  }

  async invalidateStatsCache(identifier?: string) {
    if (identifier) {
      await this.delPattern(`stats:*:${identifier}:*`);
    } else {
      await this.delPattern('stats:*');
    }
  }

  async invalidateMonitoringCache() {
    await this.del([
      CACHE_KEYS.SYSTEM_HEALTH(),
      CACHE_KEYS.EDGE_NODES(),
    ]);
    await this.delPattern('monitor:*');
  }
}

// 创建单例缓存管理器
export const cacheManager = new CacheManager();
export default cacheManager;
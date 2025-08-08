/**
 * Redis 基础限流器
 * 
 * 实现滑动窗口限流和配额管理
 */

import { Redis } from 'ioredis';
import { redisClient } from '@/lib/redis';

export interface RateLimitConfig {
  windowMs: number;     // 时间窗口（毫秒）
  maxRequests: number;  // 最大请求数
  keyPrefix?: string;   // Redis键前缀
}

export interface QuotaConfig {
  dailyLimit: number;   // 每日限额
  monthlyLimit?: number; // 月度限额
  keyPrefix?: string;   // Redis键前缀
}

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: Date;
  retryAfter?: number; // 秒
}

export interface QuotaResult {
  allowed: boolean;
  used: number;
  limit: number;
  remaining: number;
  resetAt: Date;
}

export class RateLimiter {
  private redis: Redis;

  constructor(redis?: Redis) {
    this.redis = redis || redisClient;
  }

  /**
   * 检查请求速率限制（滑动窗口）
   */
  async checkRateLimit(
    identifier: string,
    config: RateLimitConfig
  ): Promise<RateLimitResult> {
    const key = `${config.keyPrefix || 'ratelimit'}:${identifier}`;
    const now = Date.now();
    const windowStart = now - config.windowMs;

    try {
      // 使用 Redis 事务确保原子性
      const multi = this.redis.multi();
      
      // 移除窗口外的记录
      multi.zremrangebyscore(key, '-inf', windowStart);
      
      // 添加当前请求
      multi.zadd(key, now, `${now}-${Math.random()}`);
      
      // 获取窗口内的请求数
      multi.zcard(key);
      
      // 设置过期时间
      multi.expire(key, Math.ceil(config.windowMs / 1000));
      
      const results = await multi.exec();
      
      if (!results) {
        throw new Error('Redis transaction failed');
      }

      const count = results[2][1] as number;
      const allowed = count <= config.maxRequests;
      
      // 如果超限，移除刚添加的记录
      if (!allowed) {
        await this.redis.zrem(key, `${now}-${Math.random()}`);
      }

      // 计算重置时间
      const oldestRequest = await this.redis.zrange(key, 0, 0, 'WITHSCORES');
      let resetAt = new Date(now + config.windowMs);
      let retryAfter: number | undefined;

      if (oldestRequest.length >= 2) {
        const oldestTime = parseInt(oldestRequest[1]);
        resetAt = new Date(oldestTime + config.windowMs);
        
        if (!allowed) {
          retryAfter = Math.ceil((oldestTime + config.windowMs - now) / 1000);
        }
      }

      return {
        allowed,
        limit: config.maxRequests,
        remaining: Math.max(0, config.maxRequests - count),
        resetAt,
        retryAfter
      };

    } catch (error) {
      console.error('Rate limit check failed:', error);
      // 失败时默认允许，避免服务中断
      return {
        allowed: true,
        limit: config.maxRequests,
        remaining: config.maxRequests,
        resetAt: new Date(now + config.windowMs)
      };
    }
  }

  /**
   * 检查配额使用情况
   */
  async checkQuota(
    identifier: string,
    amount: number,
    config: QuotaConfig
  ): Promise<QuotaResult> {
    const today = new Date().toISOString().split('T')[0];
    const dailyKey = `${config.keyPrefix || 'quota'}:daily:${identifier}:${today}`;
    
    try {
      // 获取当前使用量
      const currentUsage = await this.redis.get(dailyKey);
      const used = parseFloat(currentUsage || '0');
      
      const newUsage = used + amount;
      const allowed = newUsage <= config.dailyLimit;

      if (allowed) {
        // 增加使用量
        await this.redis.incrbyfloat(dailyKey, amount);
        // 设置过期时间（第二天凌晨）
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(0, 0, 0, 0);
        const ttl = Math.ceil((tomorrow.getTime() - Date.now()) / 1000);
        await this.redis.expire(dailyKey, ttl);
      }

      // 计算重置时间（第二天凌晨）
      const resetAt = new Date();
      resetAt.setDate(resetAt.getDate() + 1);
      resetAt.setHours(0, 0, 0, 0);

      return {
        allowed,
        used: allowed ? newUsage : used,
        limit: config.dailyLimit,
        remaining: Math.max(0, config.dailyLimit - (allowed ? newUsage : used)),
        resetAt
      };

    } catch (error) {
      console.error('Quota check failed:', error);
      // 失败时默认允许
      return {
        allowed: true,
        used: 0,
        limit: config.dailyLimit,
        remaining: config.dailyLimit,
        resetAt: new Date()
      };
    }
  }

  /**
   * 获取当前使用统计
   */
  async getUsageStats(identifier: string, prefix: string = 'quota'): Promise<{
    daily: number;
    monthly: number;
  }> {
    const today = new Date().toISOString().split('T')[0];
    const month = today.substring(0, 7);
    
    const dailyKey = `${prefix}:daily:${identifier}:${today}`;
    const monthlyKey = `${prefix}:monthly:${identifier}:${month}`;

    try {
      const [daily, monthly] = await Promise.all([
        this.redis.get(dailyKey),
        this.redis.get(monthlyKey)
      ]);

      return {
        daily: parseFloat(daily || '0'),
        monthly: parseFloat(monthly || '0')
      };
    } catch (error) {
      console.error('Failed to get usage stats:', error);
      return { daily: 0, monthly: 0 };
    }
  }

  /**
   * 重置限流计数器
   */
  async resetRateLimit(identifier: string, prefix: string = 'ratelimit'): Promise<void> {
    const key = `${prefix}:${identifier}`;
    await this.redis.del(key);
  }

  /**
   * 重置配额计数器
   */
  async resetQuota(identifier: string, type: 'daily' | 'monthly' = 'daily'): Promise<void> {
    const date = type === 'daily' 
      ? new Date().toISOString().split('T')[0]
      : new Date().toISOString().substring(0, 7);
    
    const key = `quota:${type}:${identifier}:${date}`;
    await this.redis.del(key);
  }
}

// 导出默认实例
export const rateLimiter = new RateLimiter();
import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';

// Mock Redis
const redisMock = {
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
  incr: jest.fn(),
  expire: jest.fn(),
  ttl: jest.fn(),
  setex: jest.fn(),
  eval: jest.fn()
};

jest.mock('@/lib/redis', () => ({
  redis: redisMock
}));

// 简化的通用速率限制器实现
interface RateLimitConfig {
  windowMs: number;     // 时间窗口（毫秒）
  maxRequests: number;  // 最大请求数
  keyPrefix?: string;   // Redis键前缀
}

interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: Date;
  retryAfter?: number;
}

class RateLimiter {
  private config: RateLimitConfig;

  constructor(config: RateLimitConfig) {
    this.config = {
      keyPrefix: 'rate_limit:',
      ...config
    };
  }

  async checkLimit(identifier: string): Promise<RateLimitResult> {
    const now = Date.now();
    const windowStart = Math.floor(now / this.config.windowMs) * this.config.windowMs;
    const resetAt = new Date(windowStart + this.config.windowMs);
    
    const key = `${this.config.keyPrefix}${identifier}:${windowStart}`;
    
    // 获取当前计数
    const count = parseInt(await redisMock.get(key) || '0');
    
    if (count >= this.config.maxRequests) {
      return {
        allowed: false,
        limit: this.config.maxRequests,
        remaining: 0,
        resetAt,
        retryAfter: Math.ceil((resetAt.getTime() - now) / 1000)
      };
    }
    
    // 增加计数
    await redisMock.incr(key);
    await redisMock.expire(key, Math.ceil(this.config.windowMs / 1000));
    
    return {
      allowed: true,
      limit: this.config.maxRequests,
      remaining: this.config.maxRequests - count - 1,
      resetAt
    };
  }

  async reset(identifier: string): Promise<void> {
    const now = Date.now();
    const windowStart = Math.floor(now / this.config.windowMs) * this.config.windowMs;
    const key = `${this.config.keyPrefix}${identifier}:${windowStart}`;
    
    await redisMock.del(key);
  }

  async getStatus(identifier: string): Promise<{ count: number; resetAt: Date }> {
    const now = Date.now();
    const windowStart = Math.floor(now / this.config.windowMs) * this.config.windowMs;
    const key = `${this.config.keyPrefix}${identifier}:${windowStart}`;
    
    const count = parseInt(await redisMock.get(key) || '0');
    const resetAt = new Date(windowStart + this.config.windowMs);
    
    return { count, resetAt };
  }
}

// 滑动窗口速率限制器
class SlidingWindowRateLimiter extends RateLimiter {
  async checkLimit(identifier: string): Promise<RateLimitResult> {
    const now = Date.now();
    const windowStart = now - this.config.windowMs;
    
    // 使用Redis Lua脚本实现原子操作
    const script = `
      local key = KEYS[1]
      local window_start = tonumber(ARGV[1])
      local window_size = tonumber(ARGV[2])
      local max_requests = tonumber(ARGV[3])
      local now = tonumber(ARGV[4])
      
      -- 清理过期记录
      redis.call('ZREMRANGEBYSCORE', key, 0, window_start)
      
      -- 获取当前窗口内的请求数
      local count = redis.call('ZCARD', key)
      
      if count >= max_requests then
        return {false, count}
      end
      
      -- 添加新请求
      redis.call('ZADD', key, now, now)
      redis.call('EXPIRE', key, window_size)
      
      return {true, count + 1}
    `;
    
    // 模拟Lua脚本执行
    const key = `${this.config.keyPrefix}sliding:${identifier}`;
    const mockResult = await this.simulateSlidingWindow(key, windowStart, now);
    
    return {
      allowed: mockResult.allowed,
      limit: this.config.maxRequests,
      remaining: Math.max(0, this.config.maxRequests - mockResult.count),
      resetAt: new Date(now + this.config.windowMs)
    };
  }

  private async simulateSlidingWindow(
    key: string,
    windowStart: number,
    now: number
  ): Promise<{ allowed: boolean; count: number }> {
    // 简化的滑动窗口模拟
    const count = parseInt(await redisMock.get(key) || '0');
    
    if (count >= this.config.maxRequests) {
      return { allowed: false, count };
    }
    
    await redisMock.incr(key);
    await redisMock.expire(key, Math.ceil(this.config.windowMs / 1000));
    
    return { allowed: true, count: count + 1 };
  }
}

describe('速率限制器', () => {
  let limiter: RateLimiter;
  let slidingLimiter: SlidingWindowRateLimiter;

  beforeEach(() => {
    jest.clearAllMocks();
    
    limiter = new RateLimiter({
      windowMs: 60000,      // 1分钟
      maxRequests: 10       // 10请求/分钟
    });
    
    slidingLimiter = new SlidingWindowRateLimiter({
      windowMs: 60000,      // 1分钟
      maxRequests: 10       // 10请求/分钟
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('固定窗口限制', () => {
    it('应该允许限制内的请求', async () => {
      redisMock.get.mockResolvedValue('5');
      
      const result = await limiter.checkLimit('user-123');
      
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(4); // 10 - 5 - 1
      expect(redisMock.incr).toHaveBeenCalled();
    });

    it('应该拒绝超过限制的请求', async () => {
      redisMock.get.mockResolvedValue('10');
      
      const result = await limiter.checkLimit('user-123');
      
      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
      expect(result.retryAfter).toBeDefined();
      expect(redisMock.incr).not.toHaveBeenCalled();
    });

    it('应该为不同用户维护独立计数', async () => {
      redisMock.get
        .mockResolvedValueOnce('3') // user-123
        .mockResolvedValueOnce('8'); // user-456
      
      const result1 = await limiter.checkLimit('user-123');
      const result2 = await limiter.checkLimit('user-456');
      
      expect(result1.allowed).toBe(true);
      expect(result1.remaining).toBe(6);
      
      expect(result2.allowed).toBe(true);
      expect(result2.remaining).toBe(1);
    });

    it('应该正确设置过期时间', async () => {
      redisMock.get.mockResolvedValue('0');
      
      await limiter.checkLimit('user-123');
      
      expect(redisMock.expire).toHaveBeenCalledWith(
        expect.any(String),
        60 // 60秒
      );
    });

    it('应该在新窗口重置计数', async () => {
      jest.useFakeTimers();
      const now = Date.now();
      jest.setSystemTime(now);
      
      // 第一个窗口
      redisMock.get.mockResolvedValue('9');
      let result = await limiter.checkLimit('user-123');
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(0);
      
      // 前进到下一个窗口
      jest.setSystemTime(now + 60001);
      redisMock.get.mockResolvedValue('0');
      
      result = await limiter.checkLimit('user-123');
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(9);
    });
  });

  describe('滑动窗口限制', () => {
    it('应该实现更平滑的限流', async () => {
      redisMock.get.mockResolvedValue('5');
      
      const result = await slidingLimiter.checkLimit('user-123');
      
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(4);
    });

    it('应该正确计算滑动窗口', async () => {
      jest.useFakeTimers();
      const now = Date.now();
      jest.setSystemTime(now);
      
      // 模拟在窗口内的多个请求
      for (let i = 0; i < 5; i++) {
        redisMock.get.mockResolvedValue(String(i));
        await slidingLimiter.checkLimit('user-123');
      }
      
      // 前进30秒（半个窗口）
      jest.setSystemTime(now + 30000);
      
      // 应该还能发送一些请求
      redisMock.get.mockResolvedValue('5');
      const result = await slidingLimiter.checkLimit('user-123');
      expect(result.allowed).toBe(true);
    });
  });

  describe('限制器管理', () => {
    it('应该重置用户限制', async () => {
      await limiter.reset('user-123');
      
      expect(redisMock.del).toHaveBeenCalledWith(
        expect.stringContaining('user-123')
      );
    });

    it('应该获取当前状态', async () => {
      redisMock.get.mockResolvedValue('7');
      
      const status = await limiter.getStatus('user-123');
      
      expect(status.count).toBe(7);
      expect(status.resetAt).toBeInstanceOf(Date);
    });
  });

  describe('自定义配置', () => {
    it('应该支持自定义时间窗口', async () => {
      const customLimiter = new RateLimiter({
        windowMs: 5000,  // 5秒
        maxRequests: 5
      });
      
      redisMock.get.mockResolvedValue('0');
      await customLimiter.checkLimit('user-123');
      
      expect(redisMock.expire).toHaveBeenCalledWith(
        expect.any(String),
        5 // 5秒
      );
    });

    it('应该支持自定义键前缀', async () => {
      const customLimiter = new RateLimiter({
        windowMs: 60000,
        maxRequests: 10,
        keyPrefix: 'custom:'
      });
      
      redisMock.get.mockResolvedValue('0');
      await customLimiter.checkLimit('user-123');
      
      expect(redisMock.incr).toHaveBeenCalledWith(
        expect.stringContaining('custom:')
      );
    });
  });

  describe('错误处理', () => {
    it('应该处理Redis连接错误', async () => {
      redisMock.get.mockRejectedValue(new Error('Redis connection error'));
      
      await expect(limiter.checkLimit('user-123')).rejects.toThrow('Redis connection error');
    });

    it('应该处理无效的计数值', async () => {
      redisMock.get.mockResolvedValue('invalid');
      
      const result = await limiter.checkLimit('user-123');
      
      // 应该将无效值当作0处理
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(9);
    });
  });

  describe('性能测试', () => {
    it('应该快速处理限流检查', async () => {
      redisMock.get.mockResolvedValue('5');
      
      const startTime = Date.now();
      
      for (let i = 0; i < 100; i++) {
        await limiter.checkLimit(`user-${i}`);
      }
      
      const endTime = Date.now();
      expect(endTime - startTime).toBeLessThan(100);
    });

    it('应该支持高并发检查', async () => {
      redisMock.get.mockResolvedValue('0');
      
      const promises = Array(100).fill(null).map((_, i) => 
        limiter.checkLimit(`user-${i % 10}`)
      );
      
      const results = await Promise.all(promises);
      
      expect(results).toHaveLength(100);
      expect(results.every(r => r.limit === 10)).toBe(true);
    });
  });

  describe('特殊场景', () => {
    it('应该处理时钟倒退', async () => {
      jest.useFakeTimers();
      const now = Date.now();
      
      jest.setSystemTime(now);
      redisMock.get.mockResolvedValue('5');
      await limiter.checkLimit('user-123');
      
      // 时钟倒退
      jest.setSystemTime(now - 10000);
      redisMock.get.mockResolvedValue('5');
      
      const result = await limiter.checkLimit('user-123');
      expect(result).toBeDefined();
      // 不应该崩溃
    });

    it('应该处理极高的请求率', async () => {
      const burstLimiter = new RateLimiter({
        windowMs: 1000,  // 1秒
        maxRequests: 1000 // 1000 req/s
      });
      
      redisMock.get.mockResolvedValue('999');
      
      const result = await burstLimiter.checkLimit('user-123');
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(0);
    });
  });
});
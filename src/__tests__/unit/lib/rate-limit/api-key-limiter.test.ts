import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { createPrismaMock } from '@/test-utils/mocks/setup-prisma-mock';

// 创建Prisma Mock
const prismaMock = createPrismaMock();

// Mock Prisma模块
jest.mock('@/lib/prisma', () => ({
  prisma: prismaMock
}));

// Mock Redis
const redisMock = {
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
  incr: jest.fn(),
  expire: jest.fn(),
  ttl: jest.fn(),
  setex: jest.fn()
};

jest.mock('@/lib/redis', () => ({
  redis: redisMock
}));

// 简化的API密钥限流器实现（用于测试）
interface ApiKeyConfig {
  rateLimit: number;  // 每分钟请求数
  quota: number;      // 每日配额
  burstLimit: number; // 突发限制
}

class ApiKeyLimiter {
  private configs: Map<string, ApiKeyConfig> = new Map();
  private usage: Map<string, { count: number; resetAt: number }> = new Map();

  constructor() {
    // 设置默认配置
    this.configs.set('default', {
      rateLimit: 60,
      quota: 10000,
      burstLimit: 100
    });
  }

  async validateApiKey(apiKey: string): Promise<{ valid: boolean; error?: string }> {
    // 检查API密钥格式
    if (!apiKey || !apiKey.startsWith('sk-')) {
      return { valid: false, error: 'Invalid API key format' };
    }

    // 从数据库获取API密钥信息
    const keyInfo = await prismaMock.apiKey.findUnique({
      where: { key: apiKey }
    });

    if (!keyInfo) {
      return { valid: false, error: 'API key not found' };
    }

    if (keyInfo.status !== 'active') {
      return { valid: false, error: 'API key is inactive' };
    }

    if (keyInfo.expiresAt && new Date(keyInfo.expiresAt) < new Date()) {
      return { valid: false, error: 'API key has expired' };
    }

    return { valid: true };
  }

  async checkRateLimit(apiKey: string): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
    const config = this.configs.get(apiKey) || this.configs.get('default')!;
    const now = Date.now();
    const windowStart = Math.floor(now / 60000) * 60000; // 当前分钟的开始

    // 获取或创建使用记录
    let usage = this.usage.get(apiKey);
    
    if (!usage || usage.resetAt <= now) {
      usage = { count: 0, resetAt: windowStart + 60000 };
      this.usage.set(apiKey, usage);
    }

    if (usage.count >= config.rateLimit) {
      return {
        allowed: false,
        remaining: 0,
        resetAt: usage.resetAt
      };
    }

    usage.count++;
    
    return {
      allowed: true,
      remaining: config.rateLimit - usage.count,
      resetAt: usage.resetAt
    };
  }

  async checkQuota(apiKey: string): Promise<{ allowed: boolean; used: number; limit: number }> {
    const config = this.configs.get(apiKey) || this.configs.get('default')!;
    
    // 从Redis获取今日使用量
    const dailyKey = `quota:${apiKey}:${new Date().toISOString().split('T')[0]}`;
    const used = parseInt(await redisMock.get(dailyKey) || '0');

    if (used >= config.quota) {
      return {
        allowed: false,
        used,
        limit: config.quota
      };
    }

    // 增加使用量
    await redisMock.incr(dailyKey);
    await redisMock.expire(dailyKey, 86400); // 24小时过期

    return {
      allowed: true,
      used: used + 1,
      limit: config.quota
    };
  }

  async checkBurstLimit(apiKey: string): Promise<{ allowed: boolean; tokensRemaining: number }> {
    const config = this.configs.get(apiKey) || this.configs.get('default')!;
    
    // 简化的令牌桶算法
    const bucketKey = `burst:${apiKey}`;
    const tokens = parseInt(await redisMock.get(bucketKey) || String(config.burstLimit));

    if (tokens <= 0) {
      return {
        allowed: false,
        tokensRemaining: 0
      };
    }

    await redisMock.set(bucketKey, tokens - 1);
    await redisMock.expire(bucketKey, 60); // 1分钟后重置

    return {
      allowed: true,
      tokensRemaining: tokens - 1
    };
  }

  setConfig(apiKey: string, config: ApiKeyConfig): void {
    this.configs.set(apiKey, config);
  }

  resetUsage(apiKey: string): void {
    this.usage.delete(apiKey);
  }

  async recordUsage(apiKey: string, tokens: number): Promise<void> {
    // 记录使用统计
    const stats = {
      apiKey,
      tokens,
      timestamp: new Date(),
      endpoint: '/api/chat'
    };

    await prismaMock.apiUsageLog.create({
      data: stats
    });
  }
}

describe('API密钥限流器', () => {
  let limiter: ApiKeyLimiter;

  beforeEach(() => {
    jest.clearAllMocks();
    limiter = new ApiKeyLimiter();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('API密钥验证', () => {
    it('应该验证有效的API密钥', async () => {
      const apiKey = 'sk-test-123456';
      
      prismaMock.apiKey.findUnique.mockResolvedValue({
        id: 'key-1',
        key: apiKey,
        status: 'active',
        expiresAt: new Date(Date.now() + 86400000), // 明天
        userId: 'user-123'
      });

      const result = await limiter.validateApiKey(apiKey);
      
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('应该拒绝格式错误的API密钥', async () => {
      const result = await limiter.validateApiKey('invalid-key');
      
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid API key format');
    });

    it('应该拒绝不存在的API密钥', async () => {
      prismaMock.apiKey.findUnique.mockResolvedValue(null);
      
      const result = await limiter.validateApiKey('sk-nonexistent');
      
      expect(result.valid).toBe(false);
      expect(result.error).toBe('API key not found');
    });

    it('应该拒绝非活跃状态的API密钥', async () => {
      const apiKey = 'sk-test-123456';
      
      prismaMock.apiKey.findUnique.mockResolvedValue({
        id: 'key-1',
        key: apiKey,
        status: 'revoked',
        expiresAt: null,
        userId: 'user-123'
      });

      const result = await limiter.validateApiKey(apiKey);
      
      expect(result.valid).toBe(false);
      expect(result.error).toBe('API key is inactive');
    });

    it('应该拒绝已过期的API密钥', async () => {
      const apiKey = 'sk-test-123456';
      
      prismaMock.apiKey.findUnique.mockResolvedValue({
        id: 'key-1',
        key: apiKey,
        status: 'active',
        expiresAt: new Date(Date.now() - 86400000), // 昨天
        userId: 'user-123'
      });

      const result = await limiter.validateApiKey(apiKey);
      
      expect(result.valid).toBe(false);
      expect(result.error).toBe('API key has expired');
    });
  });

  describe('速率限制', () => {
    it('应该允许在限制内的请求', async () => {
      const apiKey = 'sk-test-123456';
      
      const result = await limiter.checkRateLimit(apiKey);
      
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(59); // 默认60请求/分钟，用了1个
    });

    it('应该拒绝超过速率限制的请求', async () => {
      const apiKey = 'sk-test-123456';
      limiter.setConfig(apiKey, {
        rateLimit: 5,
        quota: 1000,
        burstLimit: 10
      });

      // 发送5个请求（达到限制）
      for (let i = 0; i < 5; i++) {
        await limiter.checkRateLimit(apiKey);
      }

      // 第6个请求应该被拒绝
      const result = await limiter.checkRateLimit(apiKey);
      
      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });

    it('应该在时间窗口重置后允许请求', async () => {
      jest.useFakeTimers();
      const now = Date.now();
      jest.setSystemTime(now);

      const apiKey = 'sk-test-123456';
      limiter.setConfig(apiKey, {
        rateLimit: 1,
        quota: 1000,
        burstLimit: 10
      });

      // 第一个请求
      await limiter.checkRateLimit(apiKey);
      
      // 第二个请求被拒绝
      let result = await limiter.checkRateLimit(apiKey);
      expect(result.allowed).toBe(false);

      // 前进到下一分钟
      jest.setSystemTime(now + 60001);
      
      // 应该可以再次请求
      result = await limiter.checkRateLimit(apiKey);
      expect(result.allowed).toBe(true);
    });
  });

  describe('配额管理', () => {
    it('应该跟踪每日配额使用', async () => {
      const apiKey = 'sk-test-123456';
      redisMock.get.mockResolvedValue('100');

      const result = await limiter.checkQuota(apiKey);
      
      expect(result.allowed).toBe(true);
      expect(result.used).toBe(101);
      expect(result.limit).toBe(10000);
      expect(redisMock.incr).toHaveBeenCalled();
    });

    it('应该拒绝超过配额的请求', async () => {
      const apiKey = 'sk-test-123456';
      limiter.setConfig(apiKey, {
        rateLimit: 60,
        quota: 100,
        burstLimit: 10
      });

      redisMock.get.mockResolvedValue('100');

      const result = await limiter.checkQuota(apiKey);
      
      expect(result.allowed).toBe(false);
      expect(result.used).toBe(100);
      expect(result.limit).toBe(100);
    });

    it('应该在新的一天重置配额', async () => {
      const apiKey = 'sk-test-123456';
      
      // 模拟没有今日使用记录
      redisMock.get.mockResolvedValue(null);

      const result = await limiter.checkQuota(apiKey);
      
      expect(result.allowed).toBe(true);
      expect(result.used).toBe(1);
      expect(redisMock.expire).toHaveBeenCalledWith(
        expect.any(String),
        86400
      );
    });
  });

  describe('突发限制', () => {
    it('应该允许突发请求在限制内', async () => {
      const apiKey = 'sk-test-123456';
      redisMock.get.mockResolvedValue('50');

      const result = await limiter.checkBurstLimit(apiKey);
      
      expect(result.allowed).toBe(true);
      expect(result.tokensRemaining).toBe(49);
    });

    it('应该拒绝超过突发限制的请求', async () => {
      const apiKey = 'sk-test-123456';
      redisMock.get.mockResolvedValue('0');

      const result = await limiter.checkBurstLimit(apiKey);
      
      expect(result.allowed).toBe(false);
      expect(result.tokensRemaining).toBe(0);
    });

    it('应该初始化满令牌桶', async () => {
      const apiKey = 'sk-test-123456';
      redisMock.get.mockResolvedValue(null);

      const result = await limiter.checkBurstLimit(apiKey);
      
      expect(result.allowed).toBe(true);
      expect(result.tokensRemaining).toBe(99); // 默认100，用了1个
    });
  });

  describe('使用记录', () => {
    it('应该记录API使用情况', async () => {
      const apiKey = 'sk-test-123456';
      
      await limiter.recordUsage(apiKey, 150);
      
      expect(prismaMock.apiUsageLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          apiKey,
          tokens: 150,
          endpoint: '/api/chat'
        })
      });
    });
  });

  describe('性能测试', () => {
    it('应该快速处理验证请求', async () => {
      const apiKey = 'sk-test-123456';
      prismaMock.apiKey.findUnique.mockResolvedValue({
        id: 'key-1',
        key: apiKey,
        status: 'active',
        expiresAt: null,
        userId: 'user-123'
      });

      const startTime = Date.now();
      
      for (let i = 0; i < 100; i++) {
        await limiter.validateApiKey(apiKey);
      }
      
      const endTime = Date.now();
      expect(endTime - startTime).toBeLessThan(100);
    });

    it('应该支持并发限流检查', async () => {
      const apiKey = 'sk-test-123456';
      
      const promises = Array(50).fill(null).map(() => 
        limiter.checkRateLimit(apiKey)
      );
      
      const results = await Promise.all(promises);
      
      // 所有请求都应该得到响应
      expect(results).toHaveLength(50);
      
      // 计算允许的请求数
      const allowedCount = results.filter(r => r.allowed).length;
      expect(allowedCount).toBeLessThanOrEqual(60); // 不超过速率限制
    });
  });
});
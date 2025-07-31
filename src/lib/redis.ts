/**
 * Redis 客户端配置和管理
 * 完全参考 claude-relay-service 的实现
 */

import Redis from 'ioredis';

// Redis 配置
const REDIS_CONFIG = {
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD || '',
  db: parseInt(process.env.REDIS_DB || '0'),
  connectTimeout: 10000,
  commandTimeout: 5000,
  retryDelayOnFailover: 100,
  maxRetriesPerRequest: 3,
  lazyConnect: true,
  enableTLS: process.env.REDIS_ENABLE_TLS === 'true',
};

class RedisClient {
  private client: Redis | null = null;
  private isConnected: boolean = false;
  private memoryStore: Map<string, any> = new Map(); // 内存回退存储
  private memoryTTL: Map<string, number> = new Map(); // TTL 存储

  async connect(): Promise<Redis> {
    try {
      this.client = new Redis({
        host: REDIS_CONFIG.host,
        port: REDIS_CONFIG.port,
        password: REDIS_CONFIG.password,
        db: REDIS_CONFIG.db,
        retryDelayOnFailover: REDIS_CONFIG.retryDelayOnFailover,
        maxRetriesPerRequest: REDIS_CONFIG.maxRetriesPerRequest,
        lazyConnect: REDIS_CONFIG.lazyConnect,
        tls: REDIS_CONFIG.enableTLS ? {} : false
      });

      this.client.on('connect', () => {
        this.isConnected = true;
        console.log('🔗 Redis connected successfully');
      });

      this.client.on('error', (err) => {
        this.isConnected = false;
        console.error('❌ Redis connection error:', err);
      });

      this.client.on('close', () => {
        this.isConnected = false;
        console.warn('⚠️  Redis connection closed');
      });

      await this.client.connect();
      return this.client;
    } catch (error) {
      console.error('💥 Failed to connect to Redis:', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.quit();
      this.isConnected = false;
      console.log('👋 Redis disconnected');
    }
  }

  getClient(): Redis | null {
    if (!this.client || !this.isConnected) {
      console.warn('⚠️ Redis client is not connected');
      return null;
    }
    return this.client;
  }

  // 安全获取客户端（用于关键操作）
  getClientSafe(): Redis {
    if (!this.client || !this.isConnected) {
      throw new Error('Redis client is not connected');
    }
    return this.client;
  }

  // 🔗 OAuth会话管理
  async setOAuthSession(sessionId: string, sessionData: any, ttl: number = 600): Promise<void> {
    const key = `oauth:${sessionId}`;

    if (this.isConnected && this.client) {
      // 使用 Redis 存储
      const serializedData: Record<string, string> = {};
      for (const [dataKey, value] of Object.entries(sessionData)) {
        if (typeof value === 'object' && value !== null) {
          serializedData[dataKey] = JSON.stringify(value);
        } else {
          serializedData[dataKey] = String(value);
        }
      }

      await this.client.hset(key, serializedData);
      await this.client.expire(key, ttl);
    } else {
      // 使用内存存储
      this.memoryStore.set(key, sessionData);
      this.memoryTTL.set(key, Date.now() + ttl * 1000);
      console.warn('⚠️ Using memory storage for OAuth session (Redis not available)');
    }
  }

  async getOAuthSession(sessionId: string): Promise<any> {
    const key = `oauth:${sessionId}`;

    if (this.isConnected && this.client) {
      // 使用 Redis 存储
      const data = await this.client.hgetall(key);

      if (!data || Object.keys(data).length === 0) {
        return null;
      }

      // 反序列化 proxy 字段
      if (data.proxy) {
        try {
          data.proxy = JSON.parse(data.proxy);
        } catch (error) {
          // 如果解析失败，设置为 null
          data.proxy = null;
        }
      }

      return data;
    } else {
      // 使用内存存储
      const ttl = this.memoryTTL.get(key);
      if (ttl && Date.now() > ttl) {
        // 过期了，删除
        this.memoryStore.delete(key);
        this.memoryTTL.delete(key);
        return null;
      }

      return this.memoryStore.get(key) || null;
    }
  }

  async deleteOAuthSession(sessionId: string): Promise<number> {
    const key = `oauth:${sessionId}`;

    if (this.isConnected && this.client) {
      // 使用 Redis 存储
      return await this.client.del(key);
    } else {
      // 使用内存存储
      const existed = this.memoryStore.has(key);
      this.memoryStore.delete(key);
      this.memoryTTL.delete(key);
      return existed ? 1 : 0;
    }
  }

  // 检查会话是否存在
  async hasOAuthSession(sessionId: string): Promise<boolean> {
    const key = `oauth:${sessionId}`;

    if (this.isConnected && this.client) {
      const exists = await this.client.exists(key);
      return exists === 1;
    } else {
      const ttl = this.memoryTTL.get(key);
      if (ttl && Date.now() > ttl) {
        // 过期了，删除
        this.memoryStore.delete(key);
        this.memoryTTL.delete(key);
        return false;
      }
      return this.memoryStore.has(key);
    }
  }

  // 获取会话剩余时间
  async getOAuthSessionTTL(sessionId: string): Promise<number> {
    const key = `oauth:${sessionId}`;

    if (this.isConnected && this.client) {
      return await this.client.ttl(key);
    } else {
      const ttl = this.memoryTTL.get(key);
      if (!ttl) return -2; // 不存在
      const remaining = Math.floor((ttl - Date.now()) / 1000);
      return remaining > 0 ? remaining : -1; // -1 表示已过期
    }
  }
}

// 创建全局 Redis 客户端实例
const globalForRedis = globalThis as unknown as {
  redis: RedisClient | undefined;
};

export const redis = globalForRedis.redis ?? new RedisClient();

if (process.env.NODE_ENV !== 'production') {
  globalForRedis.redis = redis;
}

// 自动连接 Redis（如果配置了 Redis）
if (process.env.REDIS_HOST || process.env.NODE_ENV !== 'development') {
  redis.connect().catch((error) => {
    console.warn('Redis connection failed, falling back to memory storage:', error.message);
  });
}

export default redis;
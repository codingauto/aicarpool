/**
 * Redis 缓存配置和连接管理
 * v2.7 高并发优化 - 缓存层基础架构
 */

import Redis from 'ioredis';

// Redis 配置接口
export interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  db: number;
  keyPrefix: string;
  retryDelayOnFailure: number;
  maxRetriesPerRequest: number;
  lazyConnect: boolean;
  family: number;
  keepAlive: number;
  connectTimeout: number;
  commandTimeout: number;
}

// 默认 Redis 配置
export const defaultRedisConfig: RedisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  db: parseInt(process.env.REDIS_DB || '0'),
  keyPrefix: process.env.REDIS_KEY_PREFIX || 'aicarpool:',
  retryDelayOnFailure: parseInt(process.env.REDIS_RETRY_DELAY || '100'),
  maxRetriesPerRequest: parseInt(process.env.REDIS_MAX_RETRIES || '3'),
  lazyConnect: true,
  family: 4,
  keepAlive: parseInt(process.env.REDIS_KEEP_ALIVE || '30000'),
  connectTimeout: parseInt(process.env.REDIS_CONNECT_TIMEOUT || '10000'),
  commandTimeout: parseInt(process.env.REDIS_COMMAND_TIMEOUT || '5000'),
};

// TTL 配置常量
export const CacheTTL = {
  API_KEY: parseInt(process.env.CACHE_TTL_API_KEY || '300'), // 5分钟
  GROUP_BINDING: parseInt(process.env.CACHE_TTL_GROUP_BINDING || '600'), // 10分钟
  ACCOUNT_HEALTH: parseInt(process.env.CACHE_TTL_ACCOUNT_HEALTH || '300'), // 5分钟
  QUOTA_INFO: parseInt(process.env.CACHE_TTL_QUOTA_INFO || '60'), // 1分钟
  RATE_LIMIT: parseInt(process.env.CACHE_TTL_RATE_LIMIT || '300'), // 5分钟
  ACCOUNT_POOL: parseInt(process.env.CACHE_TTL_ACCOUNT_POOL || '120'), // 2分钟
  DAILY_STATS: parseInt(process.env.CACHE_TTL_DAILY_STATS || '3600'), // 1小时
  MONTHLY_STATS: parseInt(process.env.CACHE_TTL_MONTHLY_STATS || '21600'), // 6小时
} as const;

// 缓存键名常量
export const CacheKeys = {
  API_KEY: (keyValue: string) => `api_key:${keyValue}`,
  GROUP_BINDING: (groupId: string) => `group_binding:${groupId}`,
  ACCOUNT_HEALTH: (accountId: string) => `account_health:${accountId}`,
  QUOTA_INFO: (apiKeyId: string) => `quota_info:${apiKeyId}`,
  RATE_LIMIT: (apiKeyId: string, window: string) => `rate_limit:${apiKeyId}:${window}`,
  ACCOUNT_POOL: (serviceType: string) => `account_pool:${serviceType}`,
  DAILY_QUOTA: (groupId: string, date: string) => `daily_quota:${groupId}:${date}`,
  MONTHLY_BUDGET: (groupId: string, month: string) => `monthly_budget:${groupId}:${month}`,
  USAGE_STATS: (key: string) => `usage_stats:${key}`,
} as const;

// Redis 连接实例
class RedisConnection {
  private static instance: RedisConnection;
  private client: Redis;
  private isConnected: boolean = false;
  private connectionPromise: Promise<void> | null = null;

  private constructor() {
    const config = defaultRedisConfig;
    
    this.client = new Redis({
      host: config.host,
      port: config.port,
      password: config.password,
      db: config.db,
      keyPrefix: config.keyPrefix,
      retryDelayOnFailure: config.retryDelayOnFailure,
      maxRetriesPerRequest: config.maxRetriesPerRequest,
      lazyConnect: config.lazyConnect,
      family: config.family,
      keepAlive: config.keepAlive,
      connectTimeout: config.connectTimeout,
      commandTimeout: config.commandTimeout,
    });

    this.setupEventHandlers();
  }

  public static getInstance(): RedisConnection {
    if (!RedisConnection.instance) {
      RedisConnection.instance = new RedisConnection();
    }
    return RedisConnection.instance;
  }

  private setupEventHandlers(): void {
    this.client.on('connect', () => {
      console.log('🔗 Redis连接已建立');
      this.isConnected = true;
    });

    this.client.on('ready', () => {
      console.log('✅ Redis连接就绪');
    });

    this.client.on('error', (error) => {
      console.error('❌ Redis连接错误:', error);
      this.isConnected = false;
    });

    this.client.on('close', () => {
      console.log('📴 Redis连接已关闭');
      this.isConnected = false;
    });

    this.client.on('reconnecting', () => {
      console.log('🔄 Redis重新连接中...');
    });
  }

  public async connect(): Promise<void> {
    if (this.isConnected) {
      return;
    }

    if (this.connectionPromise) {
      return this.connectionPromise;
    }

    this.connectionPromise = this.client.connect().then(() => {
      this.connectionPromise = null;
    });

    return this.connectionPromise;
  }

  public getClient(): Redis {
    return this.client;
  }

  public isClientConnected(): boolean {
    return this.isConnected;
  }

  public async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.disconnect();
      this.isConnected = false;
    }
  }

  // 健康检查
  public async healthCheck(): Promise<{ isHealthy: boolean; responseTime: number; error?: string }> {
    const startTime = Date.now();
    
    try {
      await this.client.ping();
      const responseTime = Date.now() - startTime;
      
      return {
        isHealthy: true,
        responseTime
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      return {
        isHealthy: false,
        responseTime,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  // 获取连接统计信息
  public async getStats(): Promise<{
    isConnected: boolean;
    keyCount: number;
    memoryUsage: string;
    uptime: number;
  }> {
    try {
      const info = await this.client.info('server');
      const keyCount = await this.client.dbsize();
      
      // 解析 Redis info 输出
      const lines = info.split('\r\n');
      const stats: { [key: string]: string } = {};
      
      lines.forEach(line => {
        if (line.includes(':')) {
          const [key, value] = line.split(':');
          stats[key] = value;
        }
      });

      return {
        isConnected: this.isConnected,
        keyCount,
        memoryUsage: stats.used_memory_human || 'N/A',
        uptime: parseInt(stats.uptime_in_seconds || '0')
      };
    } catch (error) {
      console.error('获取Redis统计信息失败:', error);
      return {
        isConnected: false,
        keyCount: 0,
        memoryUsage: 'N/A',
        uptime: 0
      };
    }
  }
}

// 导出 Redis 客户端实例
export const redisConnection = RedisConnection.getInstance();
export const cacheClient = redisConnection.getClient();

// 连接初始化函数
export async function initializeRedis(): Promise<void> {
  try {
    await redisConnection.connect();
    console.log('🚀 Redis缓存系统初始化完成');
  } catch (error) {
    console.error('❌ Redis初始化失败:', error);
    throw error;
  }
}

// 优雅关闭函数
export async function closeRedis(): Promise<void> {
  try {
    await redisConnection.disconnect();
    console.log('👋 Redis连接已优雅关闭');
  } catch (error) {
    console.error('❌ Redis关闭失败:', error);
  }
}
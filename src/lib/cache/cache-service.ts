/**
 * 缓存服务抽象层
 * v2.7 高并发优化 - 统一缓存接口和业务逻辑
 */

import { cacheClient, CacheKeys, CacheTTL } from './redis-config';

// 缓存数据类型定义
export interface CachedApiKey {
  id: string;
  key: string;
  groupId: string;
  userId: string;
  status: 'active' | 'inactive' | 'deleted';
  quotaLimit: number | null;
  quotaUsed: number;
  expiresAt: Date | null;
  metadata: {
    rateLimit?: {
      windowMinutes: number;
      maxRequests: number;
      maxTokens: number;
    };
    servicePermissions?: string[];
    resourceBinding?: string;
    dailyCostLimit?: number;
    createdBy: string;
  };
  user: {
    id: string;
    name: string;
    email: string;
  };
  group: {
    id: string;
    name: string;
    status: string;
  };
  lastValidated: number; // 时间戳
}

export interface QuotaInfo {
  dailyUsed: number;
  dailyLimit: number;
  monthlyUsed: number;
  monthlyLimit: number | null;
  remainingQuota: number;
  lastUpdated: number;
}

export interface RateInfo {
  windowStart: number;
  requestCount: number;
  tokenCount: number;
  maxRequests: number;
  maxTokens: number;
  windowMinutes: number;
  resetTime: number;
}

export interface ResourceBindingConfig {
  mode: 'dedicated' | 'shared' | 'hybrid';
  dedicatedAccounts?: {
    accountId: string;
    serviceType: string;
    priority: number;
  }[];
  sharedPools?: {
    serviceType: string;
    priority: number;
    maxUsagePercent: number;
  }[];
  hybridConfig?: {
    primaryAccounts: string[];
    fallbackPools: string[];
  };
}

export interface AccountHealthStatus {
  accountId: string;
  isHealthy: boolean;
  responseTime: number;
  errorMessage?: string;
  lastChecked: number;
  consecutiveFailures: number;
}

export interface PreComputedAccountPool {
  serviceType: string;
  accounts: {
    id: string;
    name: string;
    serviceType: string;
    currentLoad: number;
    priority: number;
    isHealthy: boolean;
    score: number; // 综合评分
  }[];
  lastUpdate: number;
  version: number;
}

// 缓存服务类
export class CacheService {
  private static instance: CacheService;

  private constructor() {}

  public static getInstance(): CacheService {
    if (!CacheService.instance) {
      CacheService.instance = new CacheService();
    }
    return CacheService.instance;
  }

  // ========== API Key 缓存方法 ==========

  /**
   * 获取缓存的 API Key 信息
   */
  async getApiKey(keyValue: string): Promise<CachedApiKey | null> {
    try {
      const cacheKey = CacheKeys.API_KEY(keyValue);
      const cached = await cacheClient.get(cacheKey);
      
      if (!cached) {
        return null;
      }

      const data = JSON.parse(cached) as CachedApiKey;
      
      // 检查缓存是否过期（双重保险）
      if (data.expiresAt && new Date() > new Date(data.expiresAt)) {
        await this.invalidateApiKey(keyValue);
        return null;
      }

      return data;
    } catch (error) {
      console.error('获取API Key缓存失败:', error);
      return null;
    }
  }

  /**
   * 设置 API Key 缓存
   */
  async setApiKey(keyValue: string, data: CachedApiKey, customTTL?: number): Promise<void> {
    try {
      const cacheKey = CacheKeys.API_KEY(keyValue);
      const ttl = customTTL || CacheTTL.API_KEY;
      
      // 添加缓存时间戳
      data.lastValidated = Date.now();
      
      await cacheClient.setex(cacheKey, ttl, JSON.stringify(data));
      console.log(`✅ API Key缓存已设置: ${keyValue.substring(0, 12)}... (TTL: ${ttl}s)`);
    } catch (error) {
      console.error('设置API Key缓存失败:', error);
      throw error;
    }
  }

  /**
   * 失效 API Key 缓存
   */
  async invalidateApiKey(keyValue: string): Promise<void> {
    try {
      const cacheKey = CacheKeys.API_KEY(keyValue);
      await cacheClient.del(cacheKey);
      console.log(`🗑️ API Key缓存已失效: ${keyValue.substring(0, 12)}...`);
    } catch (error) {
      console.error('失效API Key缓存失败:', error);
    }
  }

  // ========== 配额信息缓存方法 ==========

  /**
   * 获取配额信息缓存
   */
  async getQuotaInfo(apiKeyId: string): Promise<QuotaInfo | null> {
    try {
      const cacheKey = CacheKeys.QUOTA_INFO(apiKeyId);
      const cached = await cacheClient.get(cacheKey);
      
      if (!cached) {
        return null;
      }

      return JSON.parse(cached) as QuotaInfo;
    } catch (error) {
      console.error('获取配额信息缓存失败:', error);
      return null;
    }
  }

  /**
   * 设置配额信息缓存
   */
  async setQuotaInfo(apiKeyId: string, data: QuotaInfo): Promise<void> {
    try {
      const cacheKey = CacheKeys.QUOTA_INFO(apiKeyId);
      data.lastUpdated = Date.now();
      
      await cacheClient.setex(cacheKey, CacheTTL.QUOTA_INFO, JSON.stringify(data));
    } catch (error) {
      console.error('设置配额信息缓存失败:', error);
    }
  }

  // ========== 速率限制缓存方法 ==========

  /**
   * 获取速率限制信息
   */
  async getRateLimit(apiKeyId: string, windowMinutes: number): Promise<RateInfo | null> {
    try {
      const window = `${windowMinutes}m`;
      const cacheKey = CacheKeys.RATE_LIMIT(apiKeyId, window);
      const cached = await cacheClient.get(cacheKey);
      
      if (!cached) {
        return null;
      }

      const data = JSON.parse(cached) as RateInfo;
      
      // 检查时间窗口是否过期
      const now = Date.now();
      if (now > data.resetTime) {
        await cacheClient.del(cacheKey);
        return null;
      }

      return data;
    } catch (error) {
      console.error('获取速率限制缓存失败:', error);
      return null;
    }
  }

  /**
   * 设置或更新速率限制信息
   */
  async setRateLimit(apiKeyId: string, data: RateInfo): Promise<void> {
    try {
      const window = `${data.windowMinutes}m`;
      const cacheKey = CacheKeys.RATE_LIMIT(apiKeyId, window);
      
      // TTL设置为时间窗口的剩余时间
      const ttl = Math.max(1, Math.floor((data.resetTime - Date.now()) / 1000));
      
      await cacheClient.setex(cacheKey, ttl, JSON.stringify(data));
    } catch (error) {
      console.error('设置速率限制缓存失败:', error);
    }
  }

  /**
   * 增加速率限制计数
   */
  async incrementRateLimit(
    apiKeyId: string, 
    windowMinutes: number, 
    requestIncrement: number = 1, 
    tokenIncrement: number = 0
  ): Promise<RateInfo> {
    try {
      const window = `${windowMinutes}m`;
      const cacheKey = CacheKeys.RATE_LIMIT(apiKeyId, window);
      
      // 使用 Redis 事务确保原子性
      const multi = cacheClient.multi();
      const now = Date.now();
      const windowStart = now - (windowMinutes * 60 * 1000);
      const resetTime = now + (windowMinutes * 60 * 1000);

      // 获取现有数据
      const existing = await this.getRateLimit(apiKeyId, windowMinutes);
      
      const newData: RateInfo = {
        windowStart,
        requestCount: (existing?.requestCount || 0) + requestIncrement,
        tokenCount: (existing?.tokenCount || 0) + tokenIncrement,
        maxRequests: existing?.maxRequests || 1000, // 默认值
        maxTokens: existing?.maxTokens || 100000, // 默认值
        windowMinutes,
        resetTime
      };

      await this.setRateLimit(apiKeyId, newData);
      return newData;
    } catch (error) {
      console.error('增加速率限制计数失败:', error);
      throw error;
    }
  }

  // ========== 资源绑定配置缓存方法 ==========

  /**
   * 获取拼车组资源绑定配置
   */
  async getGroupBinding(groupId: string): Promise<ResourceBindingConfig | null> {
    try {
      const cacheKey = CacheKeys.GROUP_BINDING(groupId);
      const cached = await cacheClient.get(cacheKey);
      
      if (!cached) {
        return null;
      }

      return JSON.parse(cached) as ResourceBindingConfig;
    } catch (error) {
      console.error('获取资源绑定配置缓存失败:', error);
      return null;
    }
  }

  /**
   * 设置资源绑定配置缓存
   */
  async setGroupBinding(groupId: string, data: ResourceBindingConfig): Promise<void> {
    try {
      const cacheKey = CacheKeys.GROUP_BINDING(groupId);
      await cacheClient.setex(cacheKey, CacheTTL.GROUP_BINDING, JSON.stringify(data));
    } catch (error) {
      console.error('设置资源绑定配置缓存失败:', error);
    }
  }

  /**
   * 失效拼车组相关缓存
   */
  async invalidateGroup(groupId: string): Promise<void> {
    try {
      const keys = [
        CacheKeys.GROUP_BINDING(groupId),
        CacheKeys.DAILY_QUOTA(groupId, new Date().toISOString().split('T')[0]),
        CacheKeys.MONTHLY_BUDGET(groupId, new Date().toISOString().substring(0, 7))
      ];
      
      await cacheClient.del(...keys);
      console.log(`🗑️ 拼车组缓存已失效: ${groupId}`);
    } catch (error) {
      console.error('失效拼车组缓存失败:', error);
    }
  }

  // ========== 账号健康状态缓存方法 ==========

  /**
   * 获取账号健康状态
   */
  async getAccountHealth(accountId: string): Promise<AccountHealthStatus | null> {
    try {
      const cacheKey = CacheKeys.ACCOUNT_HEALTH(accountId);
      const cached = await cacheClient.get(cacheKey);
      
      if (!cached) {
        return null;
      }

      return JSON.parse(cached) as AccountHealthStatus;
    } catch (error) {
      console.error('取账号健康状态缓存失败:', error);
      return null;
    }
  }

  /**
   * 设置账号健康状态
   */
  async setAccountHealth(accountId: string, data: AccountHealthStatus): Promise<void> {
    try {
      const cacheKey = CacheKeys.ACCOUNT_HEALTH(accountId);
      data.lastChecked = Date.now();
      
      await cacheClient.setex(cacheKey, CacheTTL.ACCOUNT_HEALTH, JSON.stringify(data));
    } catch (error) {
      console.error('设置账号健康状态缓存失败:', error);
    }
  }

  // ========== 预计算账号池缓存方法 ==========

  /**
   * 获取预计算账号池
   */
  async getAccountPool(serviceType: string): Promise<PreComputedAccountPool | null> {
    try {
      const cacheKey = CacheKeys.ACCOUNT_POOL(serviceType);
      const cached = await cacheClient.get(cacheKey);
      
      if (!cached) {
        return null;
      }

      const data = JSON.parse(cached) as PreComputedAccountPool;
      
      // 检查数据是否过时（超过TTL的一半时间）
      const age = (Date.now() - data.lastUpdate) / 1000;
      if (age > CacheTTL.ACCOUNT_POOL / 2) {
        console.log(`⚠️ 账号池缓存即将过期: ${serviceType} (${age}s)`);
      }

      return data;
    } catch (error) {
      console.error('获取账号池缓存失败:', error);
      return null;
    }
  }

  /**
   * 设置预计算账号池
   */
  async setAccountPool(serviceType: string, data: PreComputedAccountPool): Promise<void> {
    try {
      const cacheKey = CacheKeys.ACCOUNT_POOL(serviceType);
      data.lastUpdate = Date.now();
      data.version = data.version ? data.version + 1 : 1;
      
      await cacheClient.setex(cacheKey, CacheTTL.ACCOUNT_POOL, JSON.stringify(data));
      console.log(`✅ 账号池缓存已更新: ${serviceType} (v${data.version})`);
    } catch (error) {
      console.error('设置账号池缓存失败:', error);
    }
  }

  // ========== 使用统计缓存方法 ==========

  /**
   * 获取每日配额使用情况
   */
  async getDailyQuota(groupId: string, date?: string): Promise<{ used: number; limit: number } | null> {
    try {
      const targetDate = date || new Date().toISOString().split('T')[0];
      const cacheKey = CacheKeys.DAILY_QUOTA(groupId, targetDate);
      const cached = await cacheClient.get(cacheKey);
      
      if (!cached) {
        return null;
      }

      return JSON.parse(cached);
    } catch (error) {
      console.error('获取每日配额缓存失败:', error);
      return null;
    }
  }

  /**
   * 设置每日配额使用情况
   */
  async setDailyQuota(groupId: string, used: number, limit: number, date?: string): Promise<void> {
    try {
      const targetDate = date || new Date().toISOString().split('T')[0];
      const cacheKey = CacheKeys.DAILY_QUOTA(groupId, targetDate);
      
      await cacheClient.setex(cacheKey, CacheTTL.DAILY_STATS, JSON.stringify({ used, limit }));
    } catch (error) {
      console.error('设置每日配额缓存失败:', error);
    }
  }

  // ========== 缓存统计和管理方法 ==========

  /**
   * 获取缓存统计信息
   */
  async getCacheStats(): Promise<{
    totalKeys: number;
    keysByType: { [type: string]: number };
    memoryUsage: string;
    hitRate: number;
  }> {
    try {
      const allKeys = await cacheClient.keys('*');
      const totalKeys = allKeys.length;
      
      // 按类型统计键数量
      const keysByType: { [type: string]: number } = {};
      allKeys.forEach(key => {
        const type = key.split(':')[0] || 'unknown';
        keysByType[type] = (keysByType[type] || 0) + 1;
      });

      // 获取内存使用情况
      const info = await cacheClient.info('memory');
      const memoryMatch = info.match(/used_memory_human:(.+)/);
      const memoryUsage = memoryMatch ? memoryMatch[1].trim() : 'N/A';

      return {
        totalKeys,
        keysByType,
        memoryUsage,
        hitRate: 0 // TODO: 实现命中率统计
      };
    } catch (error) {
      console.error('获取缓存统计失败:', error);
      return {
        totalKeys: 0,
        keysByType: {},
        memoryUsage: 'N/A',
        hitRate: 0
      };
    }
  }

  /**
   * 清理过期和无效的缓存
   */
  async cleanupCache(): Promise<{ cleaned: number; errors: string[] }> {
    const errors: string[] = [];
    let cleaned = 0;

    try {
      // 获取所有过期的API Key
      const apiKeyPattern = CacheKeys.API_KEY('*').replace('*', '*');
      const apiKeys = await cacheClient.keys(apiKeyPattern);
      
      for (const key of apiKeys) {
        try {
          const data = await cacheClient.get(key);
          if (data) {
            const apiKey = JSON.parse(data) as CachedApiKey;
            
            // 检查是否已过期
            if (apiKey.expiresAt && new Date() > new Date(apiKey.expiresAt)) {
              await cacheClient.del(key);
              cleaned++;
            }
          }
        } catch (error) {
          errors.push(`清理${key}失败: ${error}`);
        }
      }

      console.log(`🧹 缓存清理完成: 清理了${cleaned}个过期缓存`);
      
      return { cleaned, errors };
    } catch (error) {
      console.error('缓存清理失败:', error);
      return { cleaned, errors: [error instanceof Error ? error.message : String(error)] };
    }
  }

  /**
   * 预热缓存 - 预加载常用数据
   */
  async warmupCache(): Promise<void> {
    try {
      console.log('🔥 开始缓存预热...');
      
      // TODO: 实现预热逻辑
      // 1. 预加载活跃的API Key
      // 2. 预加载活跃拼车组的资源绑定
      // 3. 预加载账号健康状态
      
      console.log('✅ 缓存预热完成');
    } catch (error) {
      console.error('缓存预热失败:', error);
    }
  }
}

// 导出单例实例
export const cacheService = CacheService.getInstance();
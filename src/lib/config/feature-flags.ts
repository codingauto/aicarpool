/**
 * 功能开关和渐进式部署配置
 * v2.7 高并发优化 - 支持安全的分阶段部署和快速回滚
 */

import { cacheClient } from '../cache/redis-config';

// 功能开关枚举
export enum FeatureFlag {
  // 缓存相关开关
  ENABLE_API_KEY_CACHE = 'ENABLE_API_KEY_CACHE',
  ENABLE_QUOTA_CACHE = 'ENABLE_QUOTA_CACHE',
  ENABLE_RATE_LIMIT_CACHE = 'ENABLE_RATE_LIMIT_CACHE',
  ENABLE_GROUP_BINDING_CACHE = 'ENABLE_GROUP_BINDING_CACHE',
  
  // SmartAiRouter优化开关
  ENABLE_SMART_ROUTER_OPTIMIZATION = 'ENABLE_SMART_ROUTER_OPTIMIZATION',
  ENABLE_PRECOMPUTED_ACCOUNT_POOL = 'ENABLE_PRECOMPUTED_ACCOUNT_POOL',
  ENABLE_PARALLEL_PROCESSING = 'ENABLE_PARALLEL_PROCESSING',
  
  // 异步处理开关
  ENABLE_ASYNC_USAGE_RECORDING = 'ENABLE_ASYNC_USAGE_RECORDING',
  ENABLE_BATCH_PROCESSING = 'ENABLE_BATCH_PROCESSING',
  
  // 监控和作业开关
  ENABLE_PERFORMANCE_MONITORING = 'ENABLE_PERFORMANCE_MONITORING',
  ENABLE_BACKGROUND_JOBS = 'ENABLE_BACKGROUND_JOBS',
  ENABLE_HEALTH_CHECKS = 'ENABLE_HEALTH_CHECKS',
  
  // 回滚开关
  FALLBACK_TO_ORIGINAL_API_KEY_VALIDATION = 'FALLBACK_TO_ORIGINAL_API_KEY_VALIDATION',
  FALLBACK_TO_ORIGINAL_ROUTER = 'FALLBACK_TO_ORIGINAL_ROUTER',
  
  // 调试开关
  ENABLE_DETAILED_LOGGING = 'ENABLE_DETAILED_LOGGING',
  ENABLE_PERFORMANCE_METRICS_LOGGING = 'ENABLE_PERFORMANCE_METRICS_LOGGING'
}

// 部署阶段枚举
export enum DeploymentPhase {
  DISABLED = 'disabled',           // 完全关闭
  CANARY = 'canary',              // 金丝雀部署（5%流量）
  GRADUAL = 'gradual',            // 渐进部署（25%流量）  
  MAJORITY = 'majority',          // 大部分流量（75%流量）
  FULL = 'full'                   // 全量部署（100%流量）
}

// 功能配置接口
export interface FeatureConfig {
  enabled: boolean;
  phase: DeploymentPhase;
  rolloutPercentage: number;
  userWhitelist?: string[];
  userBlacklist?: string[];
  metadata?: {
    description?: string;
    owner?: string;
    rolloutStartTime?: number;
    expectedCompletionTime?: number;
    rollbackReason?: string;
    [key: string]: any;
  };
}

// 默认功能配置
const DEFAULT_FEATURE_CONFIGS: Partial<Record<FeatureFlag, FeatureConfig>> = {
  // 缓存功能 - 高优先级，快速推广
  [FeatureFlag.ENABLE_API_KEY_CACHE]: {
    enabled: true,
    phase: DeploymentPhase.FULL,
    rolloutPercentage: 100,
    metadata: {
      description: 'API Key验证缓存优化',
      owner: 'performance-team'
    }
  },
  
  // SmartAiRouter优化 - 中等优先级，谨慎推广
  [FeatureFlag.ENABLE_SMART_ROUTER_OPTIMIZATION]: {
    enabled: true,
    phase: DeploymentPhase.GRADUAL,
    rolloutPercentage: 25,
    metadata: {
      description: 'SmartAiRouter性能优化',
      owner: 'performance-team'
    }
  },
  
  // 预计算账号池 - 中等优先级
  [FeatureFlag.ENABLE_PRECOMPUTED_ACCOUNT_POOL]: {
    enabled: true,
    phase: DeploymentPhase.CANARY,
    rolloutPercentage: 5,
    metadata: {
      description: '预计算账号池优化',
      owner: 'performance-team'
    }
  },
  
  // 异步处理 - 高优先级，但需要监控
  [FeatureFlag.ENABLE_ASYNC_USAGE_RECORDING]: {
    enabled: true,
    phase: DeploymentPhase.MAJORITY,
    rolloutPercentage: 75,
    metadata: {
      description: '异步使用统计记录',
      owner: 'performance-team'
    }
  },
  
  // 性能监控 - 低风险，快速部署
  [FeatureFlag.ENABLE_PERFORMANCE_MONITORING]: {
    enabled: true,  
    phase: DeploymentPhase.FULL,
    rolloutPercentage: 100,
    metadata: {
      description: '性能监控和指标收集',
      owner: 'ops-team'
    }
  },
  
  // 回滚开关 - 默认关闭
  [FeatureFlag.FALLBACK_TO_ORIGINAL_API_KEY_VALIDATION]: {
    enabled: false,
    phase: DeploymentPhase.DISABLED,
    rolloutPercentage: 0,
    metadata: {
      description: '回滚到原始API Key验证逻辑',
      owner: 'performance-team'
    }
  }
};

// 功能开关管理器
export class FeatureFlagManager {
  private static instance: FeatureFlagManager;
  private localCache: Map<FeatureFlag, FeatureConfig> = new Map();
  private cacheExpiry: Map<FeatureFlag, number> = new Map();
  private readonly CACHE_TTL = 60000; // 1分钟本地缓存

  private constructor() {}

  public static getInstance(): FeatureFlagManager {
    if (!FeatureFlagManager.instance) {
      FeatureFlagManager.instance = new FeatureFlagManager();
    }
    return FeatureFlagManager.instance;
  }

  /**
   * 检查功能是否启用
   */
  async isEnabled(flag: FeatureFlag, userId?: string): Promise<boolean> {
    try {
      const config = await this.getFeatureConfig(flag);
      
      if (!config.enabled) {
        return false;
      }

      // 检查部署阶段
      if (config.phase === DeploymentPhase.DISABLED) {
        return false;
      }

      // 检查用户黑名单
      if (userId && config.userBlacklist?.includes(userId)) {
        return false;
      }

      // 检查用户白名单
      if (userId && config.userWhitelist?.includes(userId)) {
        return true;
      }

      // 基于百分比的灰度发布
      if (config.rolloutPercentage >= 100) {
        return true;
      }

      if (config.rolloutPercentage <= 0) {
        return false;
      }

      // 使用用户ID或随机数进行灰度
      const seed = userId ? this.hashString(userId) : Math.random();
      const percentage = (seed * 100) % 100;
      
      return percentage < config.rolloutPercentage;

    } catch (error) {
      console.error(`功能开关检查失败 ${flag}:`, error);
      
      // 出错时使用默认配置
      const defaultConfig = DEFAULT_FEATURE_CONFIGS[flag];
      return defaultConfig?.enabled || false;
    }
  }

  /**
   * 获取功能配置
   */
  async getFeatureConfig(flag: FeatureFlag): Promise<FeatureConfig> {
    try {
      // 检查本地缓存
      const cached = this.localCache.get(flag);
      const expiry = this.cacheExpiry.get(flag) || 0;
      
      if (cached && Date.now() < expiry) {
        return cached;
      }

      // 从Redis获取配置
      const cacheKey = `feature_flags:${flag}`;
      const cached配置 = await cacheClient.get(cacheKey);
      
      let config: FeatureConfig;
      
      if (cached配置) {
        config = JSON.parse(cached配置);
      } else {
        // 使用默认配置
        config = DEFAULT_FEATURE_CONFIGS[flag] || {
          enabled: false,
          phase: DeploymentPhase.DISABLED,
          rolloutPercentage: 0
        };
        
        // 将默认配置保存到Redis
        await this.setFeatureConfig(flag, config);
      }

      // 更新本地缓存
      this.localCache.set(flag, config);
      this.cacheExpiry.set(flag, Date.now() + this.CACHE_TTL);

      return config;

    } catch (error) {
      console.error(`获取功能配置失败 ${flag}:`, error);
      
      // 返回默认配置
      return DEFAULT_FEATURE_CONFIGS[flag] || {
        enabled: false,
        phase: DeploymentPhase.DISABLED,
        rolloutPercentage: 0
      };
    }
  }

  /**
   * 设置功能配置
   */
  async setFeatureConfig(flag: FeatureFlag, config: FeatureConfig): Promise<void> {
    try {
      const cacheKey = `feature_flags:${flag}`;
      
      // 添加时间戳
      if (!config.metadata) {
        config.metadata = {};
      }
      config.metadata.lastUpdated = Date.now();
      
      // 保存到Redis
      await cacheClient.setex(cacheKey, 86400, JSON.stringify(config)); // 24小时过期
      
      // 更新本地缓存
      this.localCache.set(flag, config);
      this.cacheExpiry.set(flag, Date.now() + this.CACHE_TTL);
      
      console.log(`✅ 功能配置已更新: ${flag}`, {
        enabled: config.enabled,
        phase: config.phase,
        rolloutPercentage: config.rolloutPercentage
      });

    } catch (error) {
      console.error(`设置功能配置失败 ${flag}:`, error);
      throw error;
    }
  }

  /**
   * 启用功能（渐进式部署）
   */
  async enableFeature(
    flag: FeatureFlag, 
    phase: DeploymentPhase = DeploymentPhase.CANARY,
    metadata?: any
  ): Promise<void> {
    const rolloutPercentages = {
      [DeploymentPhase.DISABLED]: 0,
      [DeploymentPhase.CANARY]: 5,
      [DeploymentPhase.GRADUAL]: 25,
      [DeploymentPhase.MAJORITY]: 75,
      [DeploymentPhase.FULL]: 100
    };

    const config: FeatureConfig = {
      enabled: true,
      phase, 
      rolloutPercentage: rolloutPercentages[phase],
      metadata: {
        ...metadata,
        rolloutStartTime: Date.now()
      }
    };

    await this.setFeatureConfig(flag, config);
  }

  /**
   * 禁用功能
   */
  async disableFeature(flag: FeatureFlag, reason?: string): Promise<void> {
    const currentConfig = await this.getFeatureConfig(flag);
    
    const config: FeatureConfig = {
      ...currentConfig,
      enabled: false,
      phase: DeploymentPhase.DISABLED,
      rolloutPercentage: 0,
      metadata: {
        ...currentConfig.metadata,
        rollbackReason: reason,
        rollbackTime: Date.now()
      }
    };

    await this.setFeatureConfig(flag, config);
  }

  /**
   * 推进功能部署到下一阶段
   */
  async promoteFeature(flag: FeatureFlag): Promise<void> {
    const currentConfig = await this.getFeatureConfig(flag);
    
    const phaseOrder = [
      DeploymentPhase.DISABLED,
      DeploymentPhase.CANARY,
      DeploymentPhase.GRADUAL,
      DeploymentPhase.MAJORITY,
      DeploymentPhase.FULL
    ];

    const currentIndex = phaseOrder.indexOf(currentConfig.phase);
    if (currentIndex === -1 || currentIndex >= phaseOrder.length - 1) {
      throw new Error(`功能 ${flag} 已处于最终阶段或状态无效`);
    }

    const nextPhase = phaseOrder[currentIndex + 1];
    const rolloutPercentages = {
      [DeploymentPhase.DISABLED]: 0,
      [DeploymentPhase.CANARY]: 5,
      [DeploymentPhase.GRADUAL]: 25,
      [DeploymentPhase.MAJORITY]: 75,
      [DeploymentPhase.FULL]: 100
    };

    const updatedConfig: FeatureConfig = {
      ...currentConfig,
      phase: nextPhase,
      rolloutPercentage: rolloutPercentages[nextPhase],
      metadata: {
        ...currentConfig.metadata,
        lastPromotedTime: Date.now(),
        previousPhase: currentConfig.phase
      }
    };

    await this.setFeatureConfig(flag, updatedConfig);
    
    console.log(`🚀 功能 ${flag} 已推进到 ${nextPhase} 阶段 (${rolloutPercentages[nextPhase]}%)`);
  }

  /**
   * 回滚功能到上一阶段
   */
  async rollbackFeature(flag: FeatureFlag, reason: string): Promise<void> {
    const currentConfig = await this.getFeatureConfig(flag);
    
    const phaseOrder = [
      DeploymentPhase.DISABLED,
      DeploymentPhase.CANARY,
      DeploymentPhase.GRADUAL,
      DeploymentPhase.MAJORITY,
      DeploymentPhase.FULL
    ];

    const currentIndex = phaseOrder.indexOf(currentConfig.phase);
    if (currentIndex <= 0) {
      throw new Error(`功能 ${flag} 已处于最低阶段或状态无效`);
    }

    const previousPhase = phaseOrder[currentIndex - 1];
    const rolloutPercentages = {
      [DeploymentPhase.DISABLED]: 0,
      [DeploymentPhase.CANARY]: 5,
      [DeploymentPhase.GRADUAL]: 25,
      [DeploymentPhase.MAJORITY]: 75,
      [DeploymentPhase.FULL]: 100
    };

    const updatedConfig: FeatureConfig = {
      ...currentConfig,
      phase: previousPhase,
      rolloutPercentage: rolloutPercentages[previousPhase],
      metadata: {
        ...currentConfig.metadata,
        rollbackTime: Date.now(),
        rollbackReason: reason,
        previousPhase: currentConfig.phase
      }
    };

    await this.setFeatureConfig(flag, updatedConfig);
    
    console.log(`⚠️ 功能 ${flag} 已回滚到 ${previousPhase} 阶段 (${rolloutPercentages[previousPhase]}%) - ${reason}`);
  }

  /**
   * 获取所有功能开关状态
   */
  async getAllFeatureFlags(): Promise<Array<{ flag: FeatureFlag; config: FeatureConfig }>> {
    const results = [];
    
    for (const flag of Object.values(FeatureFlag)) {
      try {
        const config = await this.getFeatureConfig(flag);
        results.push({ flag, config });
      } catch (error) {
        console.error(`获取功能开关失败 ${flag}:`, error);
        results.push({
          flag,
          config: {
            enabled: false,
            phase: DeploymentPhase.DISABLED,
            rolloutPercentage: 0,
            metadata: { error: error instanceof Error ? error.message : String(error) }
          }
        });
      }
    }
    
    return results;
  }

  /**
   * 清除本地缓存
   */
  clearLocalCache(): void {
    this.localCache.clear();
    this.cacheExpiry.clear();
    console.log('🗑️ 功能开关本地缓存已清除');
  }

  /**
   * 字符串哈希函数（用于用户ID的一致性哈希）
   */
  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // 转换为32位整数
    }
    return Math.abs(hash) / 2147483647; // 归一化到[0,1]
  }

  /**
   * 批量操作：紧急关闭所有优化功能
   */
  async emergencyDisableAllOptimizations(reason: string): Promise<void> {
    const optimizationFlags = [
      FeatureFlag.ENABLE_API_KEY_CACHE,
      FeatureFlag.ENABLE_SMART_ROUTER_OPTIMIZATION,
      FeatureFlag.ENABLE_PRECOMPUTED_ACCOUNT_POOL,
      FeatureFlag.ENABLE_ASYNC_USAGE_RECORDING
    ];

    console.log(`🚨 紧急关闭所有优化功能: ${reason}`);

    const disablePromises = optimizationFlags.map(flag => 
      this.disableFeature(flag, `紧急关闭: ${reason}`)
    );

    await Promise.allSettled(disablePromises);

    // 同时启用所有回滚开关
    const fallbackFlags = [
      FeatureFlag.FALLBACK_TO_ORIGINAL_API_KEY_VALIDATION,
      FeatureFlag.FALLBACK_TO_ORIGINAL_ROUTER
    ];

    const enableFallbackPromises = fallbackFlags.map(flag =>
      this.enableFeature(flag, DeploymentPhase.FULL, { 
        emergencyFallback: true, 
        reason 
      })
    );

    await Promise.allSettled(enableFallbackPromises);

    console.log('✅ 紧急关闭操作完成，系统已回滚到原始实现');
  }

  /**
   * 批量操作：恢复所有优化功能
   */
  async restoreAllOptimizations(): Promise<void> {
    console.log('🔄 恢复所有优化功能...');

    // 先关闭回滚开关
    const fallbackFlags = [
      FeatureFlag.FALLBACK_TO_ORIGINAL_API_KEY_VALIDATION,
      FeatureFlag.FALLBACK_TO_ORIGINAL_ROUTER
    ];

    for (const flag of fallbackFlags) {
      await this.disableFeature(flag, '恢复正常操作');
    }

    // 重新启用优化功能（从金丝雀阶段开始）
    const optimizationFlags = [
      FeatureFlag.ENABLE_API_KEY_CACHE,
      FeatureFlag.ENABLE_SMART_ROUTER_OPTIMIZATION,
      FeatureFlag.ENABLE_PRECOMPUTED_ACCOUNT_POOL,
      FeatureFlag.ENABLE_ASYNC_USAGE_RECORDING
    ];

    for (const flag of optimizationFlags) {
      await this.enableFeature(flag, DeploymentPhase.CANARY, {
        restoredFromEmergency: true,
        restoreTime: Date.now()
      });
    }

    console.log('✅ 优化功能恢复完成，从金丝雀阶段开始');
  }
}

// 导出单例实例和便捷函数
export const featureFlagManager = FeatureFlagManager.getInstance();

// 便捷函数
export async function isFeatureEnabled(flag: FeatureFlag, userId?: string): Promise<boolean> {
  return featureFlagManager.isEnabled(flag, userId);
}

export async function getFeatureConfig(flag: FeatureFlag): Promise<FeatureConfig> {
  return featureFlagManager.getFeatureConfig(flag);
}

export async function setFeatureConfig(flag: FeatureFlag, config: FeatureConfig): Promise<void> {
  return featureFlagManager.setFeatureConfig(flag, config);
}
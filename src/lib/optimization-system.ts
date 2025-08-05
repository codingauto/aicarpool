/**
 * v2.7 高并发优化系统集成初始化
 * 统一管理所有优化组件的启动、停止和状态监控
 */

import { initializeRedis, closeRedis, redisConnection } from './cache/redis-config';
import { cacheService } from './cache/cache-service';
import { usageQueueProcessor } from './queue/usage-queue-processor';
import { accountPoolManager } from './services/account-pool-manager';
import { performanceMonitor } from './monitoring/performance-monitor';
import { backgroundJobsScheduler } from './jobs/background-jobs-scheduler';
import { featureFlagManager, FeatureFlag } from './config/feature-flags';

// 系统状态枚举
export enum SystemStatus {
  STOPPED = 'stopped',
  STARTING = 'starting',
  RUNNING = 'running',
  STOPPING = 'stopping',
  ERROR = 'error'
}

// 组件状态接口
export interface ComponentStatus {
  name: string;
  status: 'running' | 'stopped' | 'error';
  uptime: number;
  lastError?: string;
  metadata?: any;
}

// 系统统计接口
export interface SystemStats {
  status: SystemStatus;
  uptime: number;
  components: ComponentStatus[];
  performance: {
    totalRequests: number;
    avgResponseTime: number;
    cacheHitRate: number;
    queueBacklog: number;
    errorRate: number;
  };
  featureFlags: {
    enabled: number;
    disabled: number;
    inRollout: number;
  };
}

/**
 * v2.7 高并发优化系统主控制器
 */
export class OptimizationSystem {
  private static instance: OptimizationSystem;
  private status: SystemStatus = SystemStatus.STOPPED;
  private startTime: number = 0;
  private components: Map<string, { startTime: number; status: 'running' | 'stopped' | 'error'; lastError?: string }> = new Map();

  private constructor() {}

  public static getInstance(): OptimizationSystem {
    if (!OptimizationSystem.instance) {
      OptimizationSystem.instance = new OptimizationSystem();
    }
    return OptimizationSystem.instance;
  }

  /**
   * 启动优化系统
   */
  async start(): Promise<void> {
    if (this.status === SystemStatus.RUNNING) {
      console.log('⚠️ 优化系统已在运行');
      return;
    }

    console.log('🚀 启动 AiCarpool v2.7 高并发优化系统...');
    this.status = SystemStatus.STARTING;
    this.startTime = Date.now();

    try {
      // 1. 检查功能开关
      const systemEnabled = await featureFlagManager.isEnabled(FeatureFlag.ENABLE_PERFORMANCE_MONITORING);
      if (!systemEnabled) {
        console.log('⚠️ 性能监控功能已禁用，跳过优化系统启动');
        this.status = SystemStatus.STOPPED;
        return;
      }

      // 2. 初始化Redis缓存层
      await this.startComponent('redis', async () => {
        await initializeRedis();
        
        // 测试Redis连接
        const healthCheck = await redisConnection.healthCheck();
        if (!healthCheck.isHealthy) {
          throw new Error(`Redis健康检查失败: ${healthCheck.error}`);
        }
        
        console.log(`✅ Redis连接成功 (响应时间: ${healthCheck.responseTime}ms)`);
      });

      // 3. 启动缓存服务预热
      await this.startComponent('cache-service', async () => {
        await cacheService.warmupCache();
        console.log('✅ 缓存服务预热完成');
      });

      // 4. 启动使用统计队列处理器
      const asyncEnabled = await featureFlagManager.isEnabled(FeatureFlag.ENABLE_ASYNC_USAGE_RECORDING);
      if (asyncEnabled) {
        await this.startComponent('usage-queue', async () => {
          // 使用统计队列处理器是单例，自动启动
          console.log('✅ 使用统计队列处理器已启动');
        });
      }

      // 5. 启动账号池管理器
      const poolEnabled = await featureFlagManager.isEnabled(FeatureFlag.ENABLE_PRECOMPUTED_ACCOUNT_POOL);
      if (poolEnabled) {
        await this.startComponent('account-pool', async () => {
          await accountPoolManager.start();
        });
      }

      // 6. 启动性能监控器
      const monitoringEnabled = await featureFlagManager.isEnabled(FeatureFlag.ENABLE_PERFORMANCE_MONITORING);
      if (monitoringEnabled) {
        await this.startComponent('performance-monitor', async () => {
          await performanceMonitor.start();
        });
      }

      // 7. 启动后台作业调度器
      const jobsEnabled = await featureFlagManager.isEnabled(FeatureFlag.ENABLE_BACKGROUND_JOBS);
      if (jobsEnabled) {
        await this.startComponent('background-jobs', async () => {
          await backgroundJobsScheduler.start();
        });
      }

      this.status = SystemStatus.RUNNING;
      const startupTime = Date.now() - this.startTime;
      
      console.log(`🎉 AiCarpool v2.7 高并发优化系统启动完成! (${startupTime}ms)`);
      console.log(`📊 已启动组件: ${Array.from(this.components.keys()).join(', ')}`);
      
      // 打印系统状态摘要
      await this.printSystemSummary();

    } catch (error) {
      this.status = SystemStatus.ERROR;
      console.error('❌ 优化系统启动失败:', error);
      
      // 尝试清理已启动的组件
      await this.stop();
      
      throw error;
    }
  }

  /**
   * 停止优化系统
   */
  async stop(): Promise<void> {
    if (this.status === SystemStatus.STOPPED) {
      console.log('⚠️ 优化系统未运行');
      return;
    }

    console.log('📴 停止 AiCarpool v2.7 高并发优化系统...');
    this.status = SystemStatus.STOPPING;

    try {
      // 按启动的相反顺序停止组件
      const componentNames = Array.from(this.components.keys()).reverse();
      
      for (const componentName of componentNames) {
        await this.stopComponent(componentName);
      }

      // 最后关闭Redis连接
      await closeRedis();

      this.status = SystemStatus.STOPPED;
      this.components.clear();
      
      console.log('✅ 优化系统已完全停止');

    } catch (error) {
      this.status = SystemStatus.ERROR;
      console.error('❌ 优化系统停止过程中出现错误:', error);
      throw error;
    }
  }

  /**
   * 重启优化系统
   */
  async restart(): Promise<void> {
    console.log('🔄 重启优化系统...');
    await this.stop();
    await new Promise(resolve => setTimeout(resolve, 2000)); // 等待2秒
    await this.start();
  }

  /**
   * 启动单个组件
   */
  private async startComponent(name: string, startFunction: () => Promise<void>): Promise<void> {
    const startTime = Date.now();
    
    try {
      console.log(`🔧 启动组件: ${name}`);
      
      await startFunction();
      
      this.components.set(name, {
        startTime,
        status: 'running'
      });
      
      const duration = Date.now() - startTime;
      console.log(`✅ 组件启动成功: ${name} (${duration}ms)`);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      this.components.set(name, {
        startTime,
        status: 'error',
        lastError: errorMessage
      });
      
      console.error(`❌ 组件启动失败: ${name} - ${errorMessage}`);
      throw error;
    }
  }

  /**
   * 停止单个组件
   */
  private async stopComponent(name: string): Promise<void> {
    const component = this.components.get(name);
    if (!component) {
      return;
    }

    try {
      console.log(`📴 停止组件: ${name}`);

      switch (name) {
        case 'account-pool':
          await accountPoolManager.stop();
          break;
        case 'performance-monitor':
          await performanceMonitor.stop();
          break;
        case 'background-jobs':
          await backgroundJobsScheduler.stop();
          break;
        case 'usage-queue':
          await usageQueueProcessor.manualFlush();
          break;
        default:
          // 其他组件可能不需要特殊的停止逻辑
          break;
      }

      component.status = 'stopped';
      console.log(`✅ 组件已停止: ${name}`);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      component.status = 'error';
      component.lastError = errorMessage;
      console.error(`❌ 组件停止失败: ${name} - ${errorMessage}`);
    }
  }

  /**
   * 获取系统状态
   */
  async getSystemStatus(): Promise<SystemStats> {
    try {
      // 获取组件状态
      const componentStatuses: ComponentStatus[] = [];
      for (const [name, component] of this.components.entries()) {
        componentStatuses.push({
          name,
          status: component.status,
          uptime: Date.now() - component.startTime,
          lastError: component.lastError
        });
      }

      // 获取性能指标
      const currentMetrics = performanceMonitor.getCurrentMetrics();
      const performance = {
        totalRequests: currentMetrics?.apiMetrics.totalRequests || 0,
        avgResponseTime: currentMetrics?.apiMetrics.avgResponseTime || 0,
        cacheHitRate: currentMetrics?.cacheMetrics.hitRate || 0,
        queueBacklog: currentMetrics?.queueMetrics.backlog || 0,
        errorRate: currentMetrics?.apiMetrics.errorRate || 0
      };

      // 获取功能开关统计
      const allFlags = await featureFlagManager.getAllFeatureFlags();
      const featureFlags = {
        enabled: allFlags.filter(f => f.config.enabled).length,
        disabled: allFlags.filter(f => !f.config.enabled).length,
        inRollout: allFlags.filter(f => f.config.enabled && f.config.rolloutPercentage < 100).length
      };

      return {
        status: this.status,
        uptime: this.startTime > 0 ? Date.now() - this.startTime : 0,
        components: componentStatuses,
        performance,
        featureFlags
      };

    } catch (error) {
      console.error('获取系统状态失败:', error);
      return {
        status: SystemStatus.ERROR,
        uptime: 0,
        components: [],
        performance: {
          totalRequests: 0,
          avgResponseTime: 0,
          cacheHitRate: 0,
          queueBacklog: 0,
          errorRate: 0
        },
        featureFlags: {
          enabled: 0,
          disabled: 0,
          inRollout: 0
        }
      };
    }
  }

  /**
   * 打印系统状态摘要
   */
  async printSystemSummary(): Promise<void> {
    try {
      const stats = await this.getSystemStatus();
      
      console.log('\n📊 系统状态摘要:');
      console.log(`状态: ${stats.status}`);
      console.log(`运行时间: ${Math.floor(stats.uptime / 1000)}秒`);
      console.log(`运行组件: ${stats.components.filter(c => c.status === 'running').length}/${stats.components.length}`);
      console.log(`功能开关: ${stats.featureFlags.enabled}个已启用, ${stats.featureFlags.inRollout}个在推广中`);
      
      if (stats.performance.totalRequests > 0) {
        console.log(`性能指标:`);
        console.log(`  - 平均响应时间: ${stats.performance.avgResponseTime.toFixed(2)}ms`);
        console.log(`  - 缓存命中率: ${(stats.performance.cacheHitRate * 100).toFixed(1)}%`);
        console.log(`  - 错误率: ${(stats.performance.errorRate * 100).toFixed(2)}%`);
        console.log(`  - 队列积压: ${stats.performance.queueBacklog}条`);
      }
      
      console.log('');

    } catch (error) {
      console.error('打印系统摘要失败:', error);
    }
  }

  /**
   * 健康检查
   */
  async healthCheck(): Promise<{
    healthy: boolean;
    issues: string[];
    components: { [name: string]: boolean };
  }> {
    const issues: string[] = [];
    const components: { [name: string]: boolean } = {};

    try {
      // 检查系统状态
      if (this.status !== SystemStatus.RUNNING) {
        issues.push(`系统状态异常: ${this.status}`);
      }

      // 检查各组件状态
      for (const [name, component] of this.components.entries()) {
        const isHealthy = component.status === 'running';
        components[name] = isHealthy;
        
        if (!isHealthy) {
          issues.push(`组件 ${name} 状态异常: ${component.status} ${component.lastError ? `(${component.lastError})` : ''}`);
        }
      }

      // 检查Redis连接
      if (this.components.has('redis')) {
        const redisHealth = await redisConnection.healthCheck();
        components['redis-connection'] = redisHealth.isHealthy;
        
        if (!redisHealth.isHealthy) {
          issues.push(`Redis连接异常: ${redisHealth.error}`);
        }
      }

      return {
        healthy: issues.length === 0,
        issues,
        components
      };

    } catch (error) {
      issues.push(`健康检查执行失败: ${error instanceof Error ? error.message : String(error)}`);
      
      return {
        healthy: false,
        issues,
        components
      };
    }
  }

  /**
   * 紧急停止所有优化（回滚到原始实现）
   */
  async emergencyFallback(reason: string): Promise<void> {
    console.log(`🚨 紧急回滚: ${reason}`);
    
    try {
      // 通过功能开关快速禁用所有优化
      await featureFlagManager.emergencyDisableAllOptimizations(reason);
      
      // 清理缓存以确保立即生效
      featureFlagManager.clearLocalCache();
      
      console.log('✅ 紧急回滚完成，系统已切换到原始实现');
      
    } catch (error) {
      console.error('❌ 紧急回滚失败:', error);
      
      // 如果功能开关失败，尝试直接停止系统
      await this.stop();
      
      throw error;
    }
  }

  /**
   * 获取当前状态
   */
  getStatus(): SystemStatus {
    return this.status;
  }

  /**
   * 获取运行时间
   */
  getUptime(): number {
    return this.startTime > 0 ? Date.now() - this.startTime : 0;
  }
}

// 导出单例实例
export const optimizationSystem = OptimizationSystem.getInstance();

// 便捷函数
export async function startOptimizationSystem(): Promise<void> {
  return optimizationSystem.start();
}

export async function stopOptimizationSystem(): Promise<void> {
  return optimizationSystem.stop();
}

export async function getOptimizationSystemStatus(): Promise<SystemStats> {
  return optimizationSystem.getSystemStatus();
}

export async function healthCheckOptimizationSystem(): Promise<boolean> {
  const result = await optimizationSystem.healthCheck();
  return result.healthy;
}
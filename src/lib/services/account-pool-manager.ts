/**
 * 账号池管理器 - 预计算账号池和健康检查缓存
 * v2.7 高并发优化 - 提前计算账号池，缓存健康状态
 */

import { PrismaClient, ServiceType } from '@prisma/client';
import { cacheService, AccountHealthStatus, PreComputedAccountPool } from '../cache/cache-service';

const prisma = new PrismaClient();

// 健康检查配置
const HEALTH_CHECK_CONFIG = {
  INTERVAL: parseInt(process.env.HEALTH_CHECK_INTERVAL || '300000'), // 5分钟
  TIMEOUT: parseInt(process.env.HEALTH_CHECK_TIMEOUT || '10000'), // 10秒
  MAX_CONSECUTIVE_FAILURES: parseInt(process.env.MAX_CONSECUTIVE_FAILURES || '3'),
  PARALLEL_CHECKS: parseInt(process.env.PARALLEL_HEALTH_CHECKS || '5'),
} as const;

// 账号池配置
const POOL_CONFIG = {
  REFRESH_INTERVAL: parseInt(process.env.POOL_REFRESH_INTERVAL || '120000'), // 2分钟
  MIN_HEALTHY_ACCOUNTS: parseInt(process.env.MIN_HEALTHY_ACCOUNTS || '2'),
  SCORE_WEIGHTS: {
    LOAD: 0.4,        // 负载权重
    HEALTH: 0.3,      // 健康状态权重
    RESPONSE_TIME: 0.2, // 响应时间权重
    RECENT_USE: 0.1   // 最近使用权重
  }
} as const;

// 临时AI服务客户端接口
interface HealthCheckResult {
  isHealthy: boolean;
  responseTime: number;
  error?: string;
}

// 模拟健康检查客户端
class HealthCheckClient {
  constructor(private account: any) {}

  async healthCheck(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    
    try {
      // 模拟网络请求
      const delay = Math.random() * 2000 + 100; // 100-2100ms
      await new Promise(resolve => setTimeout(resolve, delay));
      
      // 90%的成功率
      const isHealthy = Math.random() > 0.1;
      const responseTime = Date.now() - startTime;
      
      if (!isHealthy) {
        throw new Error('Health check failed - service unavailable');
      }
      
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
}

/**
 * 账号池管理器
 */
export class AccountPoolManager {
  private static instance: AccountPoolManager;
  private healthCheckTimers: Map<string, NodeJS.Timeout> = new Map();
  private poolRefreshTimers: Map<string, NodeJS.Timeout> = new Map();
  private isRunning = false;

  private constructor() {}

  public static getInstance(): AccountPoolManager {
    if (!AccountPoolManager.instance) {
      AccountPoolManager.instance = new AccountPoolManager();
    }
    return AccountPoolManager.instance;
  }

  /**
   * 启动账号池管理器
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('⚠️ 账号池管理器已在运行');
      return;
    }

    console.log('🚀 启动账号池管理器...');
    this.isRunning = true;

    try {
      // 1. 初始化所有服务类型的账号池
      await this.initializeAllPools();

      // 2. 启动健康检查定时器
      await this.startHealthCheckScheduler();

      // 3. 启动账号池刷新定时器
      this.startPoolRefreshScheduler();

      console.log('✅ 账号池管理器启动完成');

    } catch (error) {
      console.error('❌ 账号池管理器启动失败:', error);
      this.isRunning = false;
      throw error;
    }
  }

  /**
   * 停止账号池管理器
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    console.log('📴 停止账号池管理器...');
    this.isRunning = false;

    // 清理所有定时器
    this.healthCheckTimers.forEach(timer => clearInterval(timer));
    this.poolRefreshTimers.forEach(timer => clearInterval(timer));
    
    this.healthCheckTimers.clear();
    this.poolRefreshTimers.clear();

    console.log('✅ 账号池管理器已停止');
  }

  /**
   * 初始化所有服务类型的账号池
   */
  private async initializeAllPools(): Promise<void> {
    try {
      // 获取所有支持的服务类型
      const serviceTypes = await prisma.aiServiceAccount.findMany({
        where: { isEnabled: true },
        select: { serviceType: true },
        distinct: ['serviceType']
      });

      const initPromises = serviceTypes.map(({ serviceType }) => 
        this.initializePool(serviceType)
      );

      await Promise.allSettled(initPromises);
      
      console.log(`🔄 已初始化 ${serviceTypes.length} 个服务类型的账号池`);

    } catch (error) {
      console.error('初始化账号池失败:', error);
      throw error;
    }
  }

  /**
   * 初始化单个服务类型的账号池
   */
  private async initializePool(serviceType: string): Promise<void> {
    try {
      console.log(`🔧 初始化账号池: ${serviceType}`);

      // 1. 获取所有启用的账号
      const accounts = await prisma.aiServiceAccount.findMany({
        where: {
          serviceType: serviceType as ServiceType,
          isEnabled: true
        },
        select: {
          id: true,
          name: true,
          serviceType: true,
          currentLoad: true,
          totalRequests: true,
          lastUsedAt: true,
          status: true,
          createdAt: true
        }
      });

      if (accounts.length === 0) {
        console.log(`⚠️ 服务类型 ${serviceType} 没有可用账号`);
        return;
      }

      // 2. 并行执行健康检查
      const healthCheckPromises = accounts.map(account => 
        this.performHealthCheck(account.id).catch(error => {
          console.error(`健康检查失败 ${account.id}:`, error);
          return {
            accountId: account.id,
            isHealthy: false,
            responseTime: 0,
            errorMessage: error.message,
            lastChecked: Date.now(),
            consecutiveFailures: 1
          } as AccountHealthStatus;
        })
      );

      const healthResults = await Promise.allSettled(healthCheckPromises);

      // 3. 计算账号评分并创建预计算池
      const now = Date.now();
      const computedAccounts = accounts.map((account, index) => {
        const healthResult = healthResults[index];
        const health = healthResult.status === 'fulfilled' ? healthResult.value : {
          isHealthy: false,
          responseTime: 9999,
          consecutiveFailures: 1
        };

        // 计算综合评分
        const score = this.calculateAccountScore(account, health, now);

        return {
          id: account.id,
          name: account.name,
          serviceType: account.serviceType,
          currentLoad: account.currentLoad,
          priority: this.calculatePriority(score),
          isHealthy: health.isHealthy,
          score
        };
      }).sort((a, b) => b.score - a.score); // 按评分降序排列

      // 4. 创建预计算账号池
      const accountPool: PreComputedAccountPool = {
        serviceType,
        accounts: computedAccounts,
        lastUpdate: now,
        version: 1
      };

      // 5. 保存到缓存
      await cacheService.setAccountPool(serviceType, accountPool);

      console.log(`✅ 账号池初始化完成: ${serviceType} (${computedAccounts.length}个账号)`);

    } catch (error) {
      console.error(`初始化账号池失败 ${serviceType}:`, error);
      throw error;
    }
  }

  /**
   * 执行账号健康检查
   */
  private async performHealthCheck(accountId: string): Promise<AccountHealthStatus> {
    const startTime = Date.now();

    try {
      // 1. 获取账号信息
      const account = await prisma.aiServiceAccount.findUnique({
        where: { id: accountId }
      });

      if (!account) {
        throw new Error('账号不存在');
      }

      // 2. 获取历史健康状态
      const existingHealth = await cacheService.getAccountHealth(accountId);

      // 3. 执行健康检查
      const client = new HealthCheckClient(account);
      const healthResult = await Promise.race([
        client.healthCheck(),
        new Promise<HealthCheckResult>((_, reject) => 
          setTimeout(() => reject(new Error('Health check timeout')), HEALTH_CHECK_CONFIG.TIMEOUT)
        )
      ]);

      // 4. 计算连续失败次数
      let consecutiveFailures = 0;
      if (!healthResult.isHealthy) {
        consecutiveFailures = (existingHealth?.consecutiveFailures || 0) + 1;
      }

      // 5. 创建健康状态记录
      const healthStatus: AccountHealthStatus = {
        accountId,
        isHealthy: healthResult.isHealthy,
        responseTime: healthResult.responseTime,
        errorMessage: healthResult.error,
        lastChecked: Date.now(),
        consecutiveFailures
      };

      // 6. 保存到缓存和数据库
      await Promise.all([
        cacheService.setAccountHealth(accountId, healthStatus),
        this.saveHealthCheckToDatabase(healthStatus)
      ]);

      // 7. 更新账号状态
      if (consecutiveFailures >= HEALTH_CHECK_CONFIG.MAX_CONSECUTIVE_FAILURES) {
        await this.markAccountUnhealthy(accountId, healthResult.error);
      } else if (healthResult.isHealthy && account.status === 'error') {
        await this.markAccountHealthy(accountId);
      }

      const checkTime = Date.now() - startTime;
      console.log(`🔍 健康检查完成: ${account.name} (${healthResult.isHealthy ? '健康' : '异常'}, ${checkTime}ms)`);

      return healthStatus;

    } catch (error) {
      const checkTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      console.error(`❌ 健康检查失败: ${accountId} (${checkTime}ms):`, errorMessage);

      const healthStatus: AccountHealthStatus = {
        accountId,
        isHealthy: false,
        responseTime: checkTime,
        errorMessage,
        lastChecked: Date.now(),
        consecutiveFailures: 1
      };

      // 保存失败状态
      await cacheService.setAccountHealth(accountId, healthStatus);
      
      return healthStatus;
    }
  }

  /**
   * 保存健康检查结果到数据库
   */
  private async saveHealthCheckToDatabase(health: AccountHealthStatus): Promise<void> {
    try {
      await prisma.accountHealthCheck.create({
        data: {
          accountId: health.accountId,
          isHealthy: health.isHealthy,
          responseTime: health.responseTime,
          errorMessage: health.errorMessage,
          checkedAt: new Date(health.lastChecked)
        }
      });
    } catch (error) {
      console.error('保存健康检查记录失败:', error);
    }
  }

  /**
   * 标记账号为不健康
   */
  private async markAccountUnhealthy(accountId: string, errorMessage?: string): Promise<void> {
    try {
      await prisma.aiServiceAccount.update({
        where: { id: accountId },
        data: {
          status: 'error',
          errorMessage: errorMessage?.substring(0, 500)
        }
      });

      console.log(`⚠️ 账号已标记为不健康: ${accountId}`);

    } catch (error) {
      console.error('标记账号不健康失败:', error);
    }
  }

  /**
   * 标记账号为健康
   */
  private async markAccountHealthy(accountId: string): Promise<void> {
    try {
      await prisma.aiServiceAccount.update({
        where: { id: accountId },
        data: {
          status: 'active',
          errorMessage: null
        }
      });

      console.log(`✅ 账号已恢复健康: ${accountId}`);

    } catch (error) {
      console.error('标记账号健康失败:', error);
    }
  }

  /**
   * 计算账号综合评分
   */
  private calculateAccountScore(
    account: any, 
    health: { isHealthy: boolean; responseTime: number; consecutiveFailures?: number }, 
    now: number
  ): number {
    let score = 100;

    // 负载评分 (0-40分)
    const loadScore = Math.max(0, 40 - (account.currentLoad * POOL_CONFIG.SCORE_WEIGHTS.LOAD));
    score -= (40 - loadScore);

    // 健康状态评分 (0-30分)
    if (!health.isHealthy) {
      score -= 30 * POOL_CONFIG.SCORE_WEIGHTS.HEALTH;
    }
    if (health.consecutiveFailures && health.consecutiveFailures > 0) {
      score -= Math.min(20, health.consecutiveFailures * 5);
    }

    // 响应时间评分 (0-20分)
    const responseTimeScore = Math.max(0, 20 - (health.responseTime / 100) * POOL_CONFIG.SCORE_WEIGHTS.RESPONSE_TIME);
    score -= (20 - responseTimeScore);

    // 最近使用时间评分 (0-10分)
    if (account.lastUsedAt) {
      const lastUsedAge = (now - account.lastUsedAt.getTime()) / 1000 / 60; // 分钟
      const recentUseScore = Math.max(0, 10 - (lastUsedAge / 60) * POOL_CONFIG.SCORE_WEIGHTS.RECENT_USE);
      score -= (10 - recentUseScore);
    }

    return Math.max(0, Math.min(100, score));
  }

  /**
   * 根据评分计算优先级
   */
  private calculatePriority(score: number): number {
    if (score >= 80) return 1;      // 高优先级
    if (score >= 60) return 2;      // 中优先级
    if (score >= 40) return 3;      // 低优先级
    return 4;                       // 最低优先级
  }

  /**
   * 启动健康检查调度器
   */
  private async startHealthCheckScheduler(): Promise<void> {
    try {
      // 获取所有服务类型
      const serviceTypes = await prisma.aiServiceAccount.findMany({
        where: { isEnabled: true },
        select: { serviceType: true },
        distinct: ['serviceType']
      });

      // 为每个服务类型启动健康检查定时器
      serviceTypes.forEach(({ serviceType }) => {
        const timer = setInterval(async () => {
          if (this.isRunning) {
            await this.performServiceHealthChecks(serviceType);
          }
        }, HEALTH_CHECK_CONFIG.INTERVAL);

        this.healthCheckTimers.set(serviceType, timer);
      });

      console.log(`⏰ 健康检查调度器已启动: ${serviceTypes.length} 个服务类型`);

    } catch (error) {
      console.error('启动健康检查调度器失败:', error);
      throw error;
    }
  }

  /**
   * 执行服务类型的健康检查
   */
  private async performServiceHealthChecks(serviceType: string): Promise<void> {
    try {
      console.log(`🔍 开始健康检查: ${serviceType}`);

      // 获取服务类型下的所有账号
      const accounts = await prisma.aiServiceAccount.findMany({
        where: {
          serviceType: serviceType as ServiceType,
          isEnabled: true
        },
        select: { id: true, name: true }
      });

      if (accounts.length === 0) {
        return;
      }

      // 分批进行健康检查，避免过载
      const batches = this.chunkArray(accounts, HEALTH_CHECK_CONFIG.PARALLEL_CHECKS);
      
      for (const batch of batches) {
        const checkPromises = batch.map(account => 
          this.performHealthCheck(account.id).catch(error => {
            console.error(`健康检查失败 ${account.name}:`, error);
          })
        );

        await Promise.allSettled(checkPromises);
        
        // 批次间稍作停顿
        if (batches.length > 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      console.log(`✅ 健康检查完成: ${serviceType} (${accounts.length} 个账号)`);

    } catch (error) {
      console.error(`服务健康检查失败 ${serviceType}:`, error);
    }
  }

  /**
   * 启动账号池刷新调度器
   */
  private startPoolRefreshScheduler(): void {
    try {
      // 通用刷新定时器
      const refreshTimer = setInterval(async () => {
        if (this.isRunning) {
          await this.refreshAllPools();
        }
      }, POOL_CONFIG.REFRESH_INTERVAL);

      this.poolRefreshTimers.set('global', refreshTimer);

      console.log(`⏰ 账号池刷新调度器已启动 (间隔: ${POOL_CONFIG.REFRESH_INTERVAL}ms)`);

    } catch (error) {
      console.error('启动账号池刷新调度器失败:', error);
    }
  }

  /**
   * 刷新所有账号池
   */
  private async refreshAllPools(): Promise<void> {
    try {
      console.log('🔄 开始刷新所有账号池...');

      // 获取所有服务类型
      const serviceTypes = await prisma.aiServiceAccount.findMany({
        where: { isEnabled: true },
        select: { serviceType: true },
        distinct: ['serviceType']
      });

      // 并行刷新所有服务类型的账号池
      const refreshPromises = serviceTypes.map(({ serviceType }) =>
        this.refreshPool(serviceType).catch(error => {
          console.error(`刷新账号池失败 ${serviceType}:`, error);
        })
      );

      await Promise.allSettled(refreshPromises);
      
      console.log(`✅ 所有账号池刷新完成 (${serviceTypes.length} 个服务类型)`);

    } catch (error) {
      console.error('刷新所有账号池失败:', error);
    }
  }

  /**
   * 刷新单个服务类型的账号池
   */
  private async refreshPool(serviceType: string): Promise<void> {
    try {
      // 获取现有账号池版本
      const existingPool = await cacheService.getAccountPool(serviceType);
      const currentVersion = existingPool?.version || 0;

      // 重新初始化账号池
      await this.initializePool(serviceType);

      // 获取更新后的账号池
      const updatedPool = await cacheService.getAccountPool(serviceType);
      
      if (updatedPool && updatedPool.version > currentVersion) {
        console.log(`🔄 账号池已更新: ${serviceType} (v${currentVersion} -> v${updatedPool.version})`);
      }

    } catch (error) {
      console.error(`刷新账号池失败 ${serviceType}:`, error);
      throw error;
    }
  }

  /**
   * 手动触发健康检查
   */
  async triggerHealthCheck(serviceType?: string): Promise<void> {
    try {
      if (serviceType) {
        await this.performServiceHealthChecks(serviceType);
      } else {
        const serviceTypes = await prisma.aiServiceAccount.findMany({
          where: { isEnabled: true },
          select: { serviceType: true },
          distinct: ['serviceType']
        });

        for (const { serviceType } of serviceTypes) {
          await this.performServiceHealthChecks(serviceType);
        }
      }

      console.log(`✅ 手动健康检查完成: ${serviceType || '所有服务'}`);

    } catch (error) {
      console.error('手动健康检查失败:', error);
      throw error;
    }
  }

  /**
   * 获取账号池管理器状态
   */
  async getStatus(): Promise<{
    isRunning: boolean;
    poolCounts: { [serviceType: string]: number };
    healthyAccounts: { [serviceType: string]: number };
    lastHealthCheck: { [serviceType: string]: number };
    avgResponseTime: { [serviceType: string]: number };
  }> {
    try {
      const serviceTypes = await prisma.aiServiceAccount.findMany({
        where: { isEnabled: true },
        select: { serviceType: true },
        distinct: ['serviceType']
      });

      const status = {
        isRunning: this.isRunning,
        poolCounts: {} as { [serviceType: string]: number },
        healthyAccounts: {} as { [serviceType: string]: number },
        lastHealthCheck: {} as { [serviceType: string]: number },
        avgResponseTime: {} as { [serviceType: string]: number }
      };

      // 并行获取每个服务类型的状态
      const statusPromises = serviceTypes.map(async ({ serviceType }) => {
        try {
          const pool = await cacheService.getAccountPool(serviceType);
          const healthyCount = pool?.accounts.filter(acc => acc.isHealthy).length || 0;
          const avgResponseTime = pool?.accounts.reduce((sum, acc) => sum + (acc.score || 0), 0) / (pool?.accounts.length || 1) || 0;

          status.poolCounts[serviceType] = pool?.accounts.length || 0;
          status.healthyAccounts[serviceType] = healthyCount;
          status.lastHealthCheck[serviceType] = pool?.lastUpdate || 0;
          status.avgResponseTime[serviceType] = avgResponseTime;

        } catch (error) {
          console.error(`获取服务状态失败 ${serviceType}:`, error);
          status.poolCounts[serviceType] = 0;
          status.healthyAccounts[serviceType] = 0;
          status.lastHealthCheck[serviceType] = 0;
          status.avgResponseTime[serviceType] = 0;
        }
      });

      await Promise.allSettled(statusPromises);

      return status;

    } catch (error) {
      console.error('获取账号池管理器状态失败:', error);
      throw error;
    }
  }

  /**
   * 工具方法：数组分块
   */
  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }
}

// 导出单例实例
export const accountPoolManager = AccountPoolManager.getInstance();
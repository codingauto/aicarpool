import { prisma } from '@/lib/prisma';
import { cacheManager } from '@/lib/cache';
import type { AiServiceAccount, AccountPool, GroupPoolBinding } from '@prisma/client';

interface AccountAllocationRequest {
  groupId: string;
  serviceType: 'claude' | 'gemini' | 'ampcode' | 'kimi' | 'zhipu' | 'qwen';
  estimatedTokens?: number;
  priority?: 'high' | 'normal' | 'low';
}

interface EnterpriseServiceRoute {
  serviceId: string;
  serviceName: string;
  priority: number;
  isEnabled: boolean;
  healthScore: number;
  responseTime: number;
  errorRate: number;
  lastHealthCheck: Date;
  // 企业级扩展字段
  poolId?: string;
  accountId: string;
  weight: number;
  maxLoadPercentage: number;
  currentLoad: number;
}

interface PoolRoutingStrategy {
  poolId: string;
  strategy: 'round_robin' | 'least_connections' | 'weighted' | 'health_based';
  accounts: EnterpriseServiceRoute[];
}

export class EnterpriseAccountAllocator {
  private poolStrategies: Map<string, PoolRoutingStrategy> = new Map();
  private accountLoads: Map<string, number> = new Map();
  private healthScores: Map<string, number> = new Map();
  private counters: Map<string, number> = new Map();

  constructor() {}

  /**
   * 智能分配账号
   */
  async allocateAccount(request: AccountAllocationRequest): Promise<AiServiceAccount | null> {
    try {
      // 1. 获取拼车组绑定的账号池
      const pools = await this.getGroupPools(request.groupId);
      
      // 2. 按优先级排序池
      const sortedPools = pools.sort((a, b) => a.priority - b.priority);
      
      // 3. 遍历池，寻找可用账号
      for (const pool of sortedPools) {
        // 检查使用限额
        if (await this.checkUsageLimit(request.groupId, pool.poolId)) {
          // 根据负载均衡策略选择账号
          const account = await this.selectAccount(pool, request);
          if (account && await this.isAccountHealthy(account.accountId)) {
            return await this.getAccountDetails(account.accountId);
          }
        }
      }
      
      // 4. 如果没有可用账号，返回null或加入等待队列
      return await this.handleNoAvailableAccount(request);
      
    } catch (error) {
      console.error('Account allocation error:', error);
      return null;
    }
  }

  /**
   * 获取拼车组绑定的账号池
   */
  private async getGroupPools(groupId: string): Promise<any[]> {
    const cacheKey = `group:pools:${groupId}`;
    
    return await cacheManager.getOrSet(
      cacheKey,
      async () => {
        const poolBindings = await prisma.groupPoolBinding.findMany({
          where: { groupId, isActive: true },
          include: {
            pool: {
              include: {
                accountBindings: {
                  where: { isActive: true },
                  include: {
                    account: {
                      where: { isEnabled: true, status: 'active' }
                    }
                  }
                }
              }
            }
          },
          orderBy: { priority: 'asc' }
        });

        return poolBindings.map(binding => ({
          poolId: binding.poolId,
          priority: binding.priority,
          bindingType: binding.bindingType,
          usageLimitHourly: binding.usageLimitHourly,
          usageLimitDaily: binding.usageLimitDaily,
          usageLimitMonthly: binding.usageLimitMonthly,
          pool: binding.pool
        }));
      },
      { ttl: 300 } // 5分钟缓存
    );
  }

  /**
   * 从账号池中选择最佳账号
   */
  private async selectAccount(
    poolBinding: any, 
    request: AccountAllocationRequest
  ): Promise<EnterpriseServiceRoute | null> {
    
    const pool = poolBinding.pool;
    
    // 过滤可用账号
    const availableAccounts: EnterpriseServiceRoute[] = [];
    
    for (const accountBinding of pool.accountBindings) {
      const account = accountBinding.account;
      if (!account || account.serviceType !== request.serviceType) continue;
      
      const currentLoad = await this.getAccountCurrentLoad(account.id);
      const healthScore = await this.getAccountHealthScore(account.id);
      
      if (currentLoad < accountBinding.maxLoadPercentage && healthScore > 50) {
        availableAccounts.push({
          serviceId: account.id,
          serviceName: `${account.name} (${account.serviceType})`,
          priority: poolBinding.priority,
          isEnabled: true,
          healthScore,
          responseTime: await this.getAccountResponseTime(account.id),
          errorRate: await this.getAccountErrorRate(account.id),
          lastHealthCheck: new Date(),
          poolId: pool.id,
          accountId: account.id,
          weight: accountBinding.weight,
          maxLoadPercentage: accountBinding.maxLoadPercentage,
          currentLoad
        });
      }
    }

    if (availableAccounts.length === 0) return null;

    // 根据策略选择账号
    const strategy = pool.loadBalanceStrategy as PoolRoutingStrategy['strategy'];
    
    switch (strategy) {
      case 'round_robin':
        return this.roundRobinSelection(pool.id, availableAccounts);
      case 'least_connections':
        return this.leastConnectionsSelection(availableAccounts);
      case 'weighted':
        return this.weightedSelection(availableAccounts);
      case 'health_based':
        return this.healthBasedSelection(availableAccounts);
      default:
        return availableAccounts[0];
    }
  }

  /**
   * 轮询选择算法
   */
  private roundRobinSelection(
    poolId: string, 
    accounts: EnterpriseServiceRoute[]
  ): EnterpriseServiceRoute {
    const counterKey = `pool_counter:${poolId}`;
    const counter = this.counters.get(counterKey) || 0;
    const selectedAccount = accounts[counter % accounts.length];
    this.counters.set(counterKey, counter + 1);
    return selectedAccount;
  }

  /**
   * 最少连接选择算法
   */
  private leastConnectionsSelection(
    accounts: EnterpriseServiceRoute[]
  ): EnterpriseServiceRoute {
    return accounts.reduce((min, current) => 
      current.currentLoad < min.currentLoad ? current : min
    );
  }

  /**
   * 加权选择算法
   */
  private weightedSelection(accounts: EnterpriseServiceRoute[]): EnterpriseServiceRoute {
    const totalWeight = accounts.reduce((sum, acc) => sum + acc.weight, 0);
    const randomWeight = Math.random() * totalWeight;
    
    let currentWeight = 0;
    for (const account of accounts) {
      currentWeight += account.weight;
      if (randomWeight <= currentWeight) {
        return account;
      }
    }
    
    return accounts[0];
  }

  /**
   * 基于健康分数的选择算法
   */
  private healthBasedSelection(accounts: EnterpriseServiceRoute[]): EnterpriseServiceRoute {
    // 按健康分数和负载的综合评分排序
    const scored = accounts.map(account => ({
      account,
      score: account.healthScore * 0.7 + (100 - account.currentLoad) * 0.3
    })).sort((a, b) => b.score - a.score);
    
    return scored[0].account;
  }

  /**
   * 检查使用限额
   */
  private async checkUsageLimit(groupId: string, poolId: string): Promise<boolean> {
    const binding = await prisma.groupPoolBinding.findUnique({
      where: {
        groupId_poolId: { groupId, poolId }
      }
    });

    if (!binding) return false;

    const now = new Date();
    const hourKey = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}-${now.getHours()}`;
    const dayKey = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;
    const monthKey = `${now.getFullYear()}-${now.getMonth()}`;

    // 检查小时限额
    if (binding.usageLimitHourly > 0) {
      const hourlyUsage = await cacheManager.get<number>(`pool_usage:${poolId}:${groupId}:${hourKey}`) || 0;
      if (hourlyUsage >= binding.usageLimitHourly) return false;
    }

    // 检查日限额
    if (binding.usageLimitDaily > 0) {
      const dailyUsage = await cacheManager.get<number>(`pool_usage:${poolId}:${groupId}:${dayKey}`) || 0;
      if (dailyUsage >= binding.usageLimitDaily) return false;
    }

    // 检查月限额
    if (binding.usageLimitMonthly > 0) {
      const monthlyUsage = await cacheManager.get<number>(`pool_usage:${poolId}:${groupId}:${monthKey}`) || 0;
      if (monthlyUsage >= binding.usageLimitMonthly) return false;
    }

    return true;
  }

  /**
   * 记录使用量并更新限额计数器
   */
  async recordUsage(
    groupId: string, 
    poolId: string, 
    accountId: string, 
    tokens: number
  ): Promise<void> {
    const now = new Date();
    const hourKey = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}-${now.getHours()}`;
    const dayKey = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;
    const monthKey = `${now.getFullYear()}-${now.getMonth()}`;

    // 更新各时间维度的使用量计数器
    const hourUsageKey = `pool_usage:${poolId}:${groupId}:${hourKey}`;
    const dayUsageKey = `pool_usage:${poolId}:${groupId}:${dayKey}`;
    const monthUsageKey = `pool_usage:${poolId}:${groupId}:${monthKey}`;

    const redis = cacheManager.getClient();
    if (redis) {
      await Promise.all([
        redis.incrby(hourUsageKey, tokens),
        redis.expire(hourUsageKey, 3600), // 1小时过期
        redis.incrby(dayUsageKey, tokens),
        redis.expire(dayUsageKey, 86400), // 1天过期
        redis.incrby(monthUsageKey, tokens),
        redis.expire(monthUsageKey, 2592000), // 30天过期
      ]);
    }

    // 更新账号负载
    const currentLoad = await this.getAccountCurrentLoad(accountId);
    await this.updateAccountLoad(accountId, currentLoad);
  }

  /**
   * 实时负载监控和更新
   */
  async updateAccountLoad(accountId: string, newLoad: number): Promise<void> {
    this.accountLoads.set(accountId, newLoad);
    
    // 更新缓存
    await cacheManager.set(`account:load:${accountId}`, newLoad, 60);
    
    // 如果负载过高，触发告警
    if (newLoad > 90) {
      await this.triggerHighLoadAlert(accountId, newLoad);
    }
  }

  // 辅助方法
  private async getAccountHealthScore(accountId: string): Promise<number> {
    const cached = await cacheManager.get<number>(`account:health_score:${accountId}`);
    return cached !== null ? cached : 100;
  }

  private async getAccountResponseTime(accountId: string): Promise<number> {
    const cached = await cacheManager.get<number>(`account:response_time:${accountId}`);
    return cached !== null ? cached : 0;
  }

  private async getAccountErrorRate(accountId: string): Promise<number> {
    const cached = await cacheManager.get<number>(`account:error_rate:${accountId}`);
    return cached !== null ? cached : 0;
  }

  private async getAccountCurrentLoad(accountId: string): Promise<number> {
    const cached = await cacheManager.get<number>(`account:load:${accountId}`);
    if (cached !== null) return cached;

    // 基于最近5分钟的请求数计算负载
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const recentRequests = await prisma.enhancedUsageStat.count({
      where: {
        accountId,
        requestTime: { gte: fiveMinutesAgo }
      }
    });

    const load = Math.min(100, (recentRequests / 500) * 100); // 假设500为满负载
    await cacheManager.set(`account:load:${accountId}`, load, 30);
    return load;
  }

  private async isAccountHealthy(accountId: string): Promise<boolean> {
    try {
      const account = await prisma.aiServiceAccount.findUnique({
        where: { id: accountId }
      });

      if (!account || !account.isEnabled || account.status !== 'active') {
        return false;
      }

      // 这里可以实现具体的健康检查逻辑
      // 比如发送一个简单的API请求来验证账号可用性
      return true;
      
    } catch (error) {
      console.error(`Health check error for account ${accountId}:`, error);
      return false;
    }
  }

  private async getAccountDetails(accountId: string): Promise<AiServiceAccount | null> {
    return await prisma.aiServiceAccount.findUnique({
      where: { id: accountId }
    });
  }

  private async handleNoAvailableAccount(request: AccountAllocationRequest): Promise<AiServiceAccount | null> {
    console.warn(`No available account for group ${request.groupId}, service ${request.serviceType}`);
    return null;
  }

  private async triggerHighLoadAlert(accountId: string, load: number): Promise<void> {
    console.warn(`High load alert: Account ${accountId} at ${load}% load`);
    // 实现告警逻辑，如发送邮件、Slack通知等
  }
}
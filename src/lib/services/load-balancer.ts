/**
 * 负载均衡器
 * 
 * 支持多种负载均衡算法：
 * - 轮询 (Round Robin)
 * - 最少连接 (Least Connections)
 * - 加权轮询 (Weighted Round Robin)
 * - 最少响应时间 (Least Response Time)
 * - 一致性哈希 (Consistent Hash)
 */

export interface LoadBalanceAccount {
  id: string;
  name: string;
  serviceType: string;
  currentLoad: number;
  isEnabled: boolean;
  status: string;
  priority?: number;
  weight?: number;
  averageResponseTime?: number;
  totalRequests?: number;
}

export type LoadBalanceStrategy = 
  | 'round_robin'
  | 'least_connections' 
  | 'weighted_round_robin'
  | 'least_response_time'
  | 'consistent_hash';

export class LoadBalancer {
  private roundRobinCounters: Map<string, number> = new Map();
  private lastSelectedTimes: Map<string, number> = new Map();

  /**
   * 选择最佳账号
   */
  selectAccount(
    accounts: LoadBalanceAccount[], 
    strategy: LoadBalanceStrategy = 'least_connections',
    requestKey?: string // 用于一致性哈希
  ): LoadBalanceAccount | null {
    // 过滤可用账号
    const availableAccounts = accounts.filter(account => 
      account.isEnabled && 
      account.status === 'active' && 
      account.currentLoad < 95 // 负载不超过95%
    );

    if (availableAccounts.length === 0) {
      return null;
    }

    if (availableAccounts.length === 1) {
      return availableAccounts[0];
    }

    switch (strategy) {
      case 'round_robin':
        return this.roundRobin(availableAccounts);
      
      case 'least_connections':
        return this.leastConnections(availableAccounts);
      
      case 'weighted_round_robin':
        return this.weightedRoundRobin(availableAccounts);
      
      case 'least_response_time':
        return this.leastResponseTime(availableAccounts);
      
      case 'consistent_hash':
        return this.consistentHash(availableAccounts, requestKey || '');
      
      default:
        return this.leastConnections(availableAccounts);
    }
  }

  /**
   * 轮询算法
   */
  private roundRobin(accounts: LoadBalanceAccount[]): LoadBalanceAccount {
    const serviceType = accounts[0].serviceType;
    const counterKey = `round_robin_${serviceType}`;
    
    let counter = this.roundRobinCounters.get(counterKey) || 0;
    const selectedAccount = accounts[counter % accounts.length];
    
    this.roundRobinCounters.set(counterKey, counter + 1);
    return selectedAccount;
  }

  /**
   * 最少连接算法（基于当前负载）
   */
  private leastConnections(accounts: LoadBalanceAccount[]): LoadBalanceAccount {
    return accounts.reduce((best, current) => {
      if (current.currentLoad < best.currentLoad) {
        return current;
      }
      
      // 负载相同时，选择总请求数较少的
      if (current.currentLoad === best.currentLoad) {
        const currentRequests = current.totalRequests || 0;
        const bestRequests = best.totalRequests || 0;
        return currentRequests < bestRequests ? current : best;
      }
      
      return best;
    });
  }

  /**
   * 加权轮询算法
   */
  private weightedRoundRobin(accounts: LoadBalanceAccount[]): LoadBalanceAccount {
    // 创建加权账号池
    const weightedPool: LoadBalanceAccount[] = [];
    
    accounts.forEach(account => {
      const weight = account.weight || 1;
      // 根据权重添加多个副本
      for (let i = 0; i < weight; i++) {
        weightedPool.push(account);
      }
    });

    // 使用轮询选择
    return this.roundRobin(weightedPool);
  }

  /**
   * 最少响应时间算法
   */
  private leastResponseTime(accounts: LoadBalanceAccount[]): LoadBalanceAccount {
    return accounts.reduce((best, current) => {
      const currentResponseTime = current.averageResponseTime || 0;
      const bestResponseTime = best.averageResponseTime || 0;
      
      // 综合考虑响应时间和当前负载
      const currentScore = currentResponseTime * (1 + current.currentLoad / 100);
      const bestScore = bestResponseTime * (1 + best.currentLoad / 100);
      
      return currentScore < bestScore ? current : best;
    });
  }

  /**
   * 一致性哈希算法
   */
  private consistentHash(accounts: LoadBalanceAccount[], requestKey: string): LoadBalanceAccount {
    if (!requestKey) {
      // 如果没有请求键，回退到最少连接算法
      return this.leastConnections(accounts);
    }

    // 简单的哈希实现
    let hash = 0;
    for (let i = 0; i < requestKey.length; i++) {
      const char = requestKey.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // 转换为32位整数
    }

    const index = Math.abs(hash) % accounts.length;
    return accounts[index];
  }

  /**
   * 根据优先级排序账号
   */
  sortByPriority(accounts: LoadBalanceAccount[]): LoadBalanceAccount[] {
    return accounts.sort((a, b) => {
      const priorityA = a.priority || 999;
      const priorityB = b.priority || 999;
      
      if (priorityA !== priorityB) {
        return priorityA - priorityB; // 优先级数字越小越优先
      }
      
      // 优先级相同时，按负载排序
      return a.currentLoad - b.currentLoad;
    });
  }

  /**
   * 检查账号是否过载
   */
  isAccountOverloaded(account: LoadBalanceAccount, threshold: number = 80): boolean {
    return account.currentLoad >= threshold;
  }

  /**
   * 获取账号健康评分
   */
  getAccountHealthScore(account: LoadBalanceAccount): number {
    let score = 100;
    
    // 负载因子 (0-100)
    score -= account.currentLoad;
    
    // 响应时间因子
    const avgResponseTime = account.averageResponseTime || 0;
    if (avgResponseTime > 2000) { // 超过2秒
      score -= 20;
    } else if (avgResponseTime > 1000) { // 超过1秒
      score -= 10;
    }
    
    // 状态因子
    if (account.status !== 'active') {
      score -= 50;
    }
    
    if (!account.isEnabled) {
      score = 0;
    }
    
    return Math.max(0, score);
  }

  /**
   * 获取负载分布统计
   */
  getLoadDistribution(accounts: LoadBalanceAccount[]): {
    totalAccounts: number;
    activeAccounts: number;
    averageLoad: number;
    maxLoad: number;
    minLoad: number;
    overloadedAccounts: number;
  } {
    const activeAccounts = accounts.filter(acc => acc.isEnabled && acc.status === 'active');
    
    if (activeAccounts.length === 0) {
      return {
        totalAccounts: accounts.length,
        activeAccounts: 0,
        averageLoad: 0,
        maxLoad: 0,
        minLoad: 0,
        overloadedAccounts: 0
      };
    }

    const loads = activeAccounts.map(acc => acc.currentLoad);
    const totalLoad = loads.reduce((sum, load) => sum + load, 0);
    
    return {
      totalAccounts: accounts.length,
      activeAccounts: activeAccounts.length,
      averageLoad: Math.round(totalLoad / activeAccounts.length),
      maxLoad: Math.max(...loads),
      minLoad: Math.min(...loads),
      overloadedAccounts: activeAccounts.filter(acc => this.isAccountOverloaded(acc)).length
    };
  }

  /**
   * 重置轮询计数器
   */
  resetCounters(): void {
    this.roundRobinCounters.clear();
    this.lastSelectedTimes.clear();
  }

  /**
   * 获取推荐的负载均衡策略
   */
  getRecommendedStrategy(accounts: LoadBalanceAccount[]): LoadBalanceStrategy {
    const distribution = this.getLoadDistribution(accounts);
    
    // 如果账号较少，使用轮询
    if (distribution.activeAccounts <= 2) {
      return 'round_robin';
    }
    
    // 如果负载差异较大，使用最少连接
    if (distribution.maxLoad - distribution.minLoad > 30) {
      return 'least_connections';
    }
    
    // 如果有权重配置，使用加权轮询
    if (accounts.some(acc => acc.weight && acc.weight !== 1)) {
      return 'weighted_round_robin';
    }
    
    // 如果有响应时间数据，使用最少响应时间
    if (accounts.some(acc => acc.averageResponseTime)) {
      return 'least_response_time';
    }
    
    // 默认使用最少连接
    return 'least_connections';
  }
}
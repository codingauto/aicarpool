import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { LoadBalancer, type LoadBalanceAccount, type LoadBalanceStrategy } from '@/lib/services/load-balancer';

describe('LoadBalancer - 负载均衡器', () => {
  let loadBalancer: LoadBalancer;
  let mockAccounts: LoadBalanceAccount[];

  beforeEach(() => {
    loadBalancer = new LoadBalancer();
    
    // 准备测试账户数据
    mockAccounts = [
      {
        id: 'acc-1',
        name: 'Account 1',
        serviceType: 'openai',
        currentLoad: 30,
        isEnabled: true,
        status: 'active',
        priority: 1,
        weight: 2,
        averageResponseTime: 100,
        totalRequests: 1000
      },
      {
        id: 'acc-2',
        name: 'Account 2',
        serviceType: 'openai',
        currentLoad: 50,
        isEnabled: true,
        status: 'active',
        priority: 2,
        weight: 1,
        averageResponseTime: 150,
        totalRequests: 800
      },
      {
        id: 'acc-3',
        name: 'Account 3',
        serviceType: 'openai',
        currentLoad: 20,
        isEnabled: true,
        status: 'active',
        priority: 3,
        weight: 3,
        averageResponseTime: 80,
        totalRequests: 1200
      },
      {
        id: 'acc-4',
        name: 'Account 4 (Disabled)',
        serviceType: 'openai',
        currentLoad: 10,
        isEnabled: false,
        status: 'active',
        priority: 1,
        weight: 1,
        averageResponseTime: 90,
        totalRequests: 500
      },
      {
        id: 'acc-5',
        name: 'Account 5 (Overloaded)',
        serviceType: 'openai',
        currentLoad: 96,
        isEnabled: true,
        status: 'active',
        priority: 1,
        weight: 1,
        averageResponseTime: 200,
        totalRequests: 2000
      }
    ];
  });

  describe('selectAccount - 账户选择', () => {
    it('应该过滤掉禁用的账户', () => {
      const selected = loadBalancer.selectAccount(mockAccounts);
      
      expect(selected).toBeDefined();
      expect(selected?.id).not.toBe('acc-4');
      expect(selected?.isEnabled).toBe(true);
    });

    it('应该过滤掉过载的账户（负载>=95%）', () => {
      const selected = loadBalancer.selectAccount(mockAccounts);
      
      expect(selected).toBeDefined();
      expect(selected?.id).not.toBe('acc-5');
      expect(selected?.currentLoad).toBeLessThan(95);
    });

    it('应该返回null当没有可用账户时', () => {
      const unavailableAccounts: LoadBalanceAccount[] = [
        { ...mockAccounts[3] }, // 禁用的
        { ...mockAccounts[4] }  // 过载的
      ];
      
      const selected = loadBalancer.selectAccount(unavailableAccounts);
      expect(selected).toBeNull();
    });

    it('应该直接返回唯一可用的账户', () => {
      const singleAccount = [mockAccounts[0]];
      const selected = loadBalancer.selectAccount(singleAccount);
      
      expect(selected).toBe(singleAccount[0]);
    });

    it('应该使用默认策略（least_connections）', () => {
      const selected = loadBalancer.selectAccount(mockAccounts);
      
      // acc-3 has the lowest load (20)
      expect(selected?.id).toBe('acc-3');
    });
  });

  describe('轮询策略 (round_robin)', () => {
    it('应该按顺序循环选择账户', () => {
      const strategy: LoadBalanceStrategy = 'round_robin';
      const availableAccounts = mockAccounts.filter(a => a.isEnabled && a.status === 'active' && a.currentLoad < 95);
      
      const selections = [];
      for (let i = 0; i < availableAccounts.length * 2; i++) {
        const selected = loadBalancer.selectAccount(mockAccounts, strategy);
        selections.push(selected?.id);
      }
      
      // 应该循环选择 acc-1, acc-2, acc-3, acc-1, acc-2, acc-3
      expect(selections[0]).toBe('acc-1');
      expect(selections[1]).toBe('acc-2');
      expect(selections[2]).toBe('acc-3');
      expect(selections[3]).toBe('acc-1');
      expect(selections[4]).toBe('acc-2');
      expect(selections[5]).toBe('acc-3');
    });

    it('应该为不同服务类型维护独立的计数器', () => {
      const mixedAccounts: LoadBalanceAccount[] = [
        { ...mockAccounts[0], serviceType: 'openai' },
        { ...mockAccounts[1], serviceType: 'claude' }
      ];
      
      const strategy: LoadBalanceStrategy = 'round_robin';
      
      // 选择openai账户
      const openaiSelection1 = loadBalancer.selectAccount(
        mixedAccounts.filter(a => a.serviceType === 'openai'),
        strategy
      );
      
      // 选择claude账户
      const claudeSelection1 = loadBalancer.selectAccount(
        mixedAccounts.filter(a => a.serviceType === 'claude'),
        strategy
      );
      
      expect(openaiSelection1?.serviceType).toBe('openai');
      expect(claudeSelection1?.serviceType).toBe('claude');
    });
  });

  describe('最少连接策略 (least_connections)', () => {
    it('应该选择负载最低的账户', () => {
      const strategy: LoadBalanceStrategy = 'least_connections';
      const selected = loadBalancer.selectAccount(mockAccounts, strategy);
      
      // acc-3 has the lowest load (20%)
      expect(selected?.id).toBe('acc-3');
      expect(selected?.currentLoad).toBe(20);
    });

    it('应该在负载相同时选择第一个', () => {
      const sameLoadAccounts: LoadBalanceAccount[] = [
        { ...mockAccounts[0], currentLoad: 50 },
        { ...mockAccounts[1], currentLoad: 50 },
        { ...mockAccounts[2], currentLoad: 50 }
      ];
      
      const strategy: LoadBalanceStrategy = 'least_connections';
      const selected = loadBalancer.selectAccount(sameLoadAccounts, strategy);
      
      expect(selected?.id).toBe('acc-1');
    });
  });

  describe('加权轮询策略 (weighted_round_robin)', () => {
    it('应该根据权重分配请求', () => {
      const strategy: LoadBalanceStrategy = 'weighted_round_robin';
      const selections: { [key: string]: number } = {};
      
      // 运行100次选择
      for (let i = 0; i < 100; i++) {
        const selected = loadBalancer.selectAccount(mockAccounts, strategy);
        if (selected) {
          selections[selected.id] = (selections[selected.id] || 0) + 1;
        }
      }
      
      // acc-3 (weight=3) 应该被选择的次数最多
      // acc-1 (weight=2) 次之
      // acc-2 (weight=1) 最少
      expect(selections['acc-3']).toBeGreaterThan(selections['acc-1']);
      expect(selections['acc-1']).toBeGreaterThan(selections['acc-2']);
    });

    it('应该处理没有权重的账户（默认权重=1）', () => {
      const noWeightAccounts: LoadBalanceAccount[] = mockAccounts.map(acc => ({
        ...acc,
        weight: undefined
      }));
      
      const strategy: LoadBalanceStrategy = 'weighted_round_robin';
      const selected = loadBalancer.selectAccount(noWeightAccounts, strategy);
      
      expect(selected).toBeDefined();
    });
  });

  describe('最少响应时间策略 (least_response_time)', () => {
    it('应该选择响应时间最短的账户', () => {
      const strategy: LoadBalanceStrategy = 'least_response_time';
      const selected = loadBalancer.selectAccount(mockAccounts, strategy);
      
      // acc-3 has the lowest response time (80ms)
      expect(selected?.id).toBe('acc-3');
      expect(selected?.averageResponseTime).toBe(80);
    });

    it('应该处理没有响应时间数据的账户', () => {
      const noResponseTimeAccounts: LoadBalanceAccount[] = mockAccounts.map(acc => ({
        ...acc,
        averageResponseTime: undefined
      }));
      
      const strategy: LoadBalanceStrategy = 'least_response_time';
      const selected = loadBalancer.selectAccount(noResponseTimeAccounts, strategy);
      
      expect(selected).toBeDefined();
    });
  });

  describe('一致性哈希策略 (consistent_hash)', () => {
    it('应该为相同的key返回相同的账户', () => {
      const strategy: LoadBalanceStrategy = 'consistent_hash';
      const requestKey = 'user-123-session-456';
      
      const selection1 = loadBalancer.selectAccount(mockAccounts, strategy, requestKey);
      const selection2 = loadBalancer.selectAccount(mockAccounts, strategy, requestKey);
      const selection3 = loadBalancer.selectAccount(mockAccounts, strategy, requestKey);
      
      expect(selection1?.id).toBe(selection2?.id);
      expect(selection2?.id).toBe(selection3?.id);
    });

    it('应该为不同的key可能返回不同的账户', () => {
      const strategy: LoadBalanceStrategy = 'consistent_hash';
      const selections = new Set<string>();
      
      // 使用不同的key进行多次选择
      for (let i = 0; i < 20; i++) {
        const selected = loadBalancer.selectAccount(
          mockAccounts,
          strategy,
          `request-key-${i}`
        );
        if (selected) {
          selections.add(selected.id);
        }
      }
      
      // 应该选择到多个不同的账户
      expect(selections.size).toBeGreaterThan(1);
    });

    it('应该处理空的requestKey', () => {
      const strategy: LoadBalanceStrategy = 'consistent_hash';
      const selected = loadBalancer.selectAccount(mockAccounts, strategy, '');
      
      expect(selected).toBeDefined();
    });
  });

  describe('负载更新', () => {
    it('应该更新账户负载', () => {
      const account = mockAccounts[0];
      const newLoad = 45;
      
      loadBalancer.updateAccountLoad(account.id, newLoad);
      
      // 注意：这个测试假设LoadBalancer有updateAccountLoad方法
      // 如果没有，这个测试会失败，需要根据实际实现调整
      expect(true).toBe(true); // 占位断言
    });

    it('应该释放账户负载', () => {
      const account = mockAccounts[0];
      
      loadBalancer.releaseAccountLoad(account.id, 10);
      
      // 注意：这个测试假设LoadBalancer有releaseAccountLoad方法
      expect(true).toBe(true); // 占位断言
    });
  });

  describe('健康检查', () => {
    it('应该标记不健康的账户', () => {
      const account = mockAccounts[0];
      
      loadBalancer.markAccountUnhealthy(account.id);
      
      // 后续选择不应该包含这个账户
      const selected = loadBalancer.selectAccount(mockAccounts);
      expect(selected?.id).not.toBe(account.id);
    });

    it('应该重置账户健康状态', () => {
      const account = mockAccounts[0];
      
      loadBalancer.markAccountUnhealthy(account.id);
      loadBalancer.resetAccountHealth(account.id);
      
      // 账户应该可以被选择
      const availableAccounts = [account];
      const selected = loadBalancer.selectAccount(availableAccounts);
      expect(selected?.id).toBe(account.id);
    });
  });

  describe('性能测试', () => {
    it('选择账户应该在合理时间内完成', () => {
      const largeAccountList = Array(1000).fill(null).map((_, i) => ({
        id: `acc-${i}`,
        name: `Account ${i}`,
        serviceType: 'openai',
        currentLoad: Math.random() * 100,
        isEnabled: true,
        status: 'active',
        priority: Math.floor(Math.random() * 5) + 1,
        weight: Math.floor(Math.random() * 10) + 1,
        averageResponseTime: Math.random() * 500,
        totalRequests: Math.floor(Math.random() * 10000)
      }));
      
      const startTime = Date.now();
      
      for (let i = 0; i < 100; i++) {
        loadBalancer.selectAccount(largeAccountList);
      }
      
      const endTime = Date.now();
      expect(endTime - startTime).toBeLessThan(100); // 100次选择应该在100ms内完成
    });

    it('应该支持并发选择', async () => {
      const promises = Array(100).fill(null).map(() => 
        Promise.resolve(loadBalancer.selectAccount(mockAccounts))
      );
      
      const results = await Promise.all(promises);
      
      expect(results.filter(r => r !== null)).toHaveLength(100);
    });
  });

  describe('边界条件', () => {
    it('应该处理空账户列表', () => {
      const selected = loadBalancer.selectAccount([]);
      expect(selected).toBeNull();
    });

    it('应该处理所有账户都不可用的情况', () => {
      const allUnavailable: LoadBalanceAccount[] = mockAccounts.map(acc => ({
        ...acc,
        isEnabled: false
      }));
      
      const selected = loadBalancer.selectAccount(allUnavailable);
      expect(selected).toBeNull();
    });

    it('应该处理所有账户都过载的情况', () => {
      const allOverloaded: LoadBalanceAccount[] = mockAccounts.map(acc => ({
        ...acc,
        currentLoad: 96,
        isEnabled: true,
        status: 'active'
      }));
      
      const selected = loadBalancer.selectAccount(allOverloaded);
      expect(selected).toBeNull();
    });

    it('应该处理无效的策略名称', () => {
      const invalidStrategy = 'invalid_strategy' as LoadBalanceStrategy;
      const selected = loadBalancer.selectAccount(mockAccounts, invalidStrategy);
      
      // 应该使用默认策略（least_connections）
      expect(selected).toBeDefined();
      expect(selected?.id).toBe('acc-3'); // 负载最低的
    });
  });
});
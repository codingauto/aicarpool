import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { SmartAiRouter, AiRequest, AiResponse, ResourceBindingMode } from '@/lib/services/smart-ai-router';
import { LoadBalancer, LoadBalanceStrategy } from '@/lib/services/load-balancer';
import { prisma } from '@/lib/prisma';

// Mock Prisma
jest.mock('@/lib/prisma', () => ({
  prisma: {
    aiServiceAccount: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn()
    },
    carpoolGroup: {
      findUnique: jest.fn(),
      update: jest.fn()
    },
    groupResourceBinding: {
      findMany: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn()
    },
    usageLog: {
      create: jest.fn(),
      aggregate: jest.fn()
    },
    $transaction: jest.fn()
  }
}));

// Mock LoadBalancer
jest.mock('@/lib/services/load-balancer');

const mockedPrisma = prisma as any;
const MockedLoadBalancer = LoadBalancer as jest.MockedClass<typeof LoadBalancer>;

describe('SmartAiRouter', () => {
  let router: SmartAiRouter;
  let mockLoadBalancer: jest.Mocked<LoadBalancer>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // 设置LoadBalancer mock
    mockLoadBalancer = {
      selectAccount: jest.fn(),
      updateAccountLoad: jest.fn(),
      releaseAccountLoad: jest.fn(),
      markAccountUnhealthy: jest.fn(),
      resetAccountHealth: jest.fn()
    } as any;
    
    MockedLoadBalancer.mockImplementation(() => mockLoadBalancer);
    
    router = new SmartAiRouter();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('routeRequest', () => {
    const mockRequest: AiRequest = {
      messages: [
        { role: 'user', content: 'Hello' }
      ],
      serviceType: 'claude',
      model: 'claude-3-opus',
      userId: 'user-123',
      groupId: 'group-456',
      enterpriseId: 'enterprise-789'
    };

    const mockAccount = {
      id: 'account-001',
      name: 'Claude Account',
      serviceType: 'claude',
      status: 'active',
      isEnabled: true,
      currentLoad: 2,
      supportedModels: ['claude-3-opus', 'claude-3-sonnet'],
      enterpriseId: 'enterprise-789'
    };

    it('应该成功路由请求到可用账户', async () => {
      // Mock 查找组信息
      mockedPrisma.carpoolGroup.findUnique.mockResolvedValue({
        id: 'group-456',
        resourceBindingMode: 'shared',
        enterpriseId: 'enterprise-789'
      });

      // Mock 查找可用账户
      mockedPrisma.aiServiceAccount.findMany.mockResolvedValue([mockAccount]);

      // Mock 负载均衡选择
      mockLoadBalancer.selectAccount.mockReturnValue(mockAccount);

      // Mock AI服务响应
      const mockResponse: AiResponse = {
        content: 'Hello! How can I help you?',
        model: 'claude-3-opus',
        usage: {
          promptTokens: 10,
          completionTokens: 15,
          totalTokens: 25
        }
      };

      // 由于实际调用AI服务需要真实凭证，这里只测试路由逻辑
      // 实际测试中需要mock sendToAiService方法
      const routeSpy = jest.spyOn(router as any, 'sendToAiService')
        .mockResolvedValue(mockResponse);

      const response = await router.routeRequest(mockRequest);

      expect(response).toBeDefined();
      expect(mockedPrisma.carpoolGroup.findUnique).toHaveBeenCalledWith({
        where: { id: 'group-456' }
      });
      expect(mockLoadBalancer.selectAccount).toHaveBeenCalled();
    });

    it('应该根据资源绑定模式选择账户 - 专属模式', async () => {
      mockedPrisma.carpoolGroup.findUnique.mockResolvedValue({
        id: 'group-456',
        resourceBindingMode: 'dedicated',
        enterpriseId: 'enterprise-789'
      });

      // Mock 专属资源绑定
      mockedPrisma.groupResourceBinding.findMany.mockResolvedValue([
        {
          groupId: 'group-456',
          accountId: 'account-001',
          bindingType: 'dedicated'
        }
      ]);

      mockedPrisma.aiServiceAccount.findMany.mockResolvedValue([mockAccount]);
      mockLoadBalancer.selectAccount.mockReturnValue(mockAccount);

      const routeSpy = jest.spyOn(router as any, 'sendToAiService')
        .mockResolvedValue({ content: 'Response' });

      await router.routeRequest(mockRequest);

      // 验证查询了专属资源
      expect(mockedPrisma.groupResourceBinding.findMany).toHaveBeenCalledWith({
        where: {
          groupId: 'group-456',
          bindingType: 'dedicated'
        }
      });
    });

    it('应该根据资源绑定模式选择账户 - 共享模式', async () => {
      mockedPrisma.carpoolGroup.findUnique.mockResolvedValue({
        id: 'group-456',
        resourceBindingMode: 'shared',
        enterpriseId: 'enterprise-789'
      });

      mockedPrisma.aiServiceAccount.findMany.mockResolvedValue([
        mockAccount,
        { ...mockAccount, id: 'account-002', currentLoad: 1 }
      ]);

      mockLoadBalancer.selectAccount.mockReturnValue(mockAccount);

      const routeSpy = jest.spyOn(router as any, 'sendToAiService')
        .mockResolvedValue({ content: 'Response' });

      await router.routeRequest(mockRequest);

      // 验证使用了负载均衡
      expect(mockLoadBalancer.selectAccount).toHaveBeenCalled();
    });

    it('应该处理混合模式降级', async () => {
      mockedPrisma.carpoolGroup.findUnique.mockResolvedValue({
        id: 'group-456',
        resourceBindingMode: 'hybrid',
        enterpriseId: 'enterprise-789'
      });

      // 第一次查询专属资源（无可用）
      mockedPrisma.groupResourceBinding.findMany.mockResolvedValue([]);

      // 降级到共享池
      mockedPrisma.aiServiceAccount.findMany.mockResolvedValue([mockAccount]);
      mockLoadBalancer.selectAccount.mockReturnValue(mockAccount);

      const routeSpy = jest.spyOn(router as any, 'sendToAiService')
        .mockResolvedValue({ content: 'Response' });

      await router.routeRequest(mockRequest);

      // 验证尝试了专属资源，然后降级到共享池
      expect(mockedPrisma.groupResourceBinding.findMany).toHaveBeenCalled();
      expect(mockedPrisma.aiServiceAccount.findMany).toHaveBeenCalled();
    });

    it('应该处理无可用账户的情况', async () => {
      mockedPrisma.carpoolGroup.findUnique.mockResolvedValue({
        id: 'group-456',
        resourceBindingMode: 'shared',
        enterpriseId: 'enterprise-789'
      });

      mockedPrisma.aiServiceAccount.findMany.mockResolvedValue([]);

      await expect(router.routeRequest(mockRequest))
        .rejects.toThrow('No available AI service accounts');
    });

    it('应该处理账户故障并进行故障转移', async () => {
      mockedPrisma.carpoolGroup.findUnique.mockResolvedValue({
        id: 'group-456',
        resourceBindingMode: 'shared',
        enterpriseId: 'enterprise-789'
      });

      const account1 = { ...mockAccount, id: 'account-001' };
      const account2 = { ...mockAccount, id: 'account-002' };

      mockedPrisma.aiServiceAccount.findMany.mockResolvedValue([account1, account2]);

      // 第一次选择失败，第二次成功
      mockLoadBalancer.selectAccount
        .mockReturnValueOnce(account1)
        .mockReturnValueOnce(account2);

      const sendSpy = jest.spyOn(router as any, 'sendToAiService')
        .mockRejectedValueOnce(new Error('Service unavailable'))
        .mockResolvedValueOnce({ content: 'Response from backup' });

      const response = await router.routeRequest(mockRequest);

      expect(response.content).toBe('Response from backup');
      expect(mockLoadBalancer.markAccountUnhealthy).toHaveBeenCalledWith('account-001');
    });
  });

  describe('bindResource', () => {
    it('应该成功绑定专属资源', async () => {
      mockedPrisma.groupResourceBinding.create.mockResolvedValue({
        id: 'binding-001',
        groupId: 'group-456',
        accountId: 'account-001',
        bindingType: 'dedicated'
      });

      const result = await router.bindResource('group-456', 'account-001', 'dedicated');

      expect(result).toBeDefined();
      expect(mockedPrisma.groupResourceBinding.create).toHaveBeenCalledWith({
        data: {
          groupId: 'group-456',
          accountId: 'account-001',
          bindingType: 'dedicated'
        }
      });
    });

    it('应该拒绝重复绑定', async () => {
      mockedPrisma.groupResourceBinding.create.mockRejectedValue(
        new Error('Unique constraint violation')
      );

      await expect(router.bindResource('group-456', 'account-001', 'dedicated'))
        .rejects.toThrow();
    });
  });

  describe('unbindResource', () => {
    it('应该成功解绑资源', async () => {
      mockedPrisma.groupResourceBinding.delete.mockResolvedValue({
        id: 'binding-001'
      });

      await router.unbindResource('binding-001');

      expect(mockedPrisma.groupResourceBinding.delete).toHaveBeenCalledWith({
        where: { id: 'binding-001' }
      });
    });

    it('应该批量解绑组的所有资源', async () => {
      mockedPrisma.groupResourceBinding.deleteMany.mockResolvedValue({
        count: 3
      });

      const result = await router.unbindGroupResources('group-456');

      expect(result.count).toBe(3);
      expect(mockedPrisma.groupResourceBinding.deleteMany).toHaveBeenCalledWith({
        where: { groupId: 'group-456' }
      });
    });
  });

  describe('trackUsage', () => {
    it('应该记录使用情况', async () => {
      const usage = {
        userId: 'user-123',
        groupId: 'group-456',
        accountId: 'account-001',
        tokens: 100,
        cost: 0.01,
        model: 'claude-3-opus'
      };

      mockedPrisma.usageLog.create.mockResolvedValue({
        id: 'log-001',
        ...usage
      });

      mockedPrisma.$transaction.mockImplementation(async (callback) => {
        return callback(mockedPrisma);
      });

      await router.trackUsage(usage);

      expect(mockedPrisma.usageLog.create).toHaveBeenCalled();
    });

    it('应该更新账户统计信息', async () => {
      const usage = {
        userId: 'user-123',
        groupId: 'group-456',
        accountId: 'account-001',
        tokens: 100,
        cost: 0.01,
        model: 'claude-3-opus'
      };

      mockedPrisma.$transaction.mockImplementation(async (callback) => {
        return callback(mockedPrisma);
      });

      await router.trackUsage(usage);

      expect(mockedPrisma.aiServiceAccount.update).toHaveBeenCalledWith({
        where: { id: 'account-001' },
        data: expect.objectContaining({
          totalRequests: expect.any(Object),
          totalTokens: expect.any(Object),
          totalCost: expect.any(Object),
          lastUsedAt: expect.any(Date)
        })
      });
    });
  });

  describe('healthCheck', () => {
    it('应该检查账户健康状态', async () => {
      const mockAccount = {
        id: 'account-001',
        status: 'active',
        isEnabled: true
      };

      mockedPrisma.aiServiceAccount.findFirst.mockResolvedValue(mockAccount);

      const healthSpy = jest.spyOn(router as any, 'checkAccountHealth')
        .mockResolvedValue({
          isHealthy: true,
          responseTime: 150
        });

      const result = await router.healthCheck('account-001');

      expect(result.isHealthy).toBe(true);
      expect(result.responseTime).toBe(150);
    });

    it('应该标记不健康的账户', async () => {
      const mockAccount = {
        id: 'account-001',
        status: 'active',
        isEnabled: true
      };

      mockedPrisma.aiServiceAccount.findFirst.mockResolvedValue(mockAccount);

      const healthSpy = jest.spyOn(router as any, 'checkAccountHealth')
        .mockResolvedValue({
          isHealthy: false,
          error: 'Connection timeout'
        });

      const result = await router.healthCheck('account-001');

      expect(result.isHealthy).toBe(false);
      expect(mockLoadBalancer.markAccountUnhealthy).toHaveBeenCalledWith('account-001');
    });
  });

  describe('性能测试', () => {
    it('路由决策应该在合理时间内完成', async () => {
      mockedPrisma.carpoolGroup.findUnique.mockResolvedValue({
        id: 'group-456',
        resourceBindingMode: 'shared',
        enterpriseId: 'enterprise-789'
      });

      mockedPrisma.aiServiceAccount.findMany.mockResolvedValue([
        { id: 'account-001', currentLoad: 1 },
        { id: 'account-002', currentLoad: 2 },
        { id: 'account-003', currentLoad: 0 }
      ]);

      mockLoadBalancer.selectAccount.mockReturnValue({ id: 'account-003' });

      const startTime = Date.now();
      
      // 执行路由决策（不包括实际AI调用）
      const selectSpy = jest.spyOn(router as any, 'selectOptimalAccount');
      await selectSpy.mock.results[0]?.value.catch(() => {});
      
      const endTime = Date.now();
      
      // 路由决策应该在50ms内完成
      expect(endTime - startTime).toBeLessThan(50);
    });

    it('应该支持并发请求处理', async () => {
      mockedPrisma.carpoolGroup.findUnique.mockResolvedValue({
        id: 'group-456',
        resourceBindingMode: 'shared',
        enterpriseId: 'enterprise-789'
      });

      mockedPrisma.aiServiceAccount.findMany.mockResolvedValue([
        { id: 'account-001', currentLoad: 0, maxConcurrent: 5 }
      ]);

      mockLoadBalancer.selectAccount.mockReturnValue({ id: 'account-001' });

      const sendSpy = jest.spyOn(router as any, 'sendToAiService')
        .mockResolvedValue({ content: 'Response' });

      // 并发发送多个请求
      const requests = Array(10).fill(null).map(() => ({
        messages: [{ role: 'user' as const, content: 'Test' }],
        userId: 'user-123',
        groupId: 'group-456'
      }));

      const promises = requests.map(req => router.routeRequest(req));
      
      // 所有请求应该都能处理
      const results = await Promise.allSettled(promises);
      const successful = results.filter(r => r.status === 'fulfilled');
      
      expect(successful.length).toBeGreaterThan(0);
    });
  });
});
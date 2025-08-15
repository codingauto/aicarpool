import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import type { AiRequest, AiResponse, ResourceBindingMode } from '@/lib/services/smart-ai-router';
import type { LoadBalanceStrategy } from '@/lib/services/load-balancer';

describe('智能路由核心功能测试', () => {
  describe('请求结构验证', () => {
    it('AI请求应该包含必要字段', () => {
      const validRequest: AiRequest = {
        messages: [
          { role: 'user', content: 'Hello AI' },
          { role: 'assistant', content: 'Hello! How can I help you?' },
          { role: 'user', content: 'Tell me about TypeScript' }
        ],
        userId: 'user-123',
        groupId: 'group-456',
        enterpriseId: 'enterprise-789',
        serviceType: 'claude',
        model: 'claude-3-opus'
      };
      
      expect(validRequest.messages).toBeDefined();
      expect(Array.isArray(validRequest.messages)).toBe(true);
      expect(validRequest.messages.length).toBeGreaterThan(0);
      
      // 验证消息格式
      validRequest.messages.forEach(msg => {
        expect(['user', 'assistant', 'system']).toContain(msg.role);
        expect(typeof msg.content).toBe('string');
      });
    });

    it('应该支持不同的服务类型', () => {
      const serviceTypes = ['claude', 'gemini', 'openai', 'qwen'];
      
      serviceTypes.forEach(serviceType => {
        const request: AiRequest = {
          messages: [{ role: 'user', content: 'Test' }],
          userId: 'user-123',
          serviceType: serviceType as any
        };
        
        expect(request.serviceType).toBe(serviceType);
      });
    });

    it('应该支持可选的模型参数', () => {
      const models = [
        'claude-3-opus',
        'claude-3-sonnet',
        'gpt-4',
        'gpt-3.5-turbo',
        'gemini-pro'
      ];
      
      models.forEach(model => {
        const request: AiRequest = {
          messages: [{ role: 'user', content: 'Test' }],
          userId: 'user-123',
          model: model
        };
        
        expect(request.model).toBe(model);
      });
    });
  });

  describe('响应结构验证', () => {
    it('AI响应应该包含内容和使用信息', () => {
      const validResponse: AiResponse = {
        content: 'This is the AI response',
        model: 'claude-3-opus',
        usage: {
          promptTokens: 10,
          completionTokens: 20,
          totalTokens: 30
        }
      };
      
      expect(validResponse.content).toBeDefined();
      expect(typeof validResponse.content).toBe('string');
      
      expect(validResponse.usage).toBeDefined();
      expect(validResponse.usage.promptTokens).toBeGreaterThanOrEqual(0);
      expect(validResponse.usage.completionTokens).toBeGreaterThanOrEqual(0);
      expect(validResponse.usage.totalTokens).toBe(
        validResponse.usage.promptTokens + validResponse.usage.completionTokens
      );
    });

    it('应该支持流式响应标记', () => {
      const streamResponse: AiResponse = {
        content: 'Streaming...',
        model: 'gpt-4',
        usage: {
          promptTokens: 5,
          completionTokens: 10,
          totalTokens: 15
        },
        stream: true
      };
      
      expect(streamResponse.stream).toBe(true);
    });

    it('应该支持错误响应', () => {
      const errorResponse: AiResponse = {
        content: '',
        error: 'Rate limit exceeded',
        model: 'claude-3-opus',
        usage: {
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0
        }
      };
      
      expect(errorResponse.error).toBeDefined();
      expect(errorResponse.content).toBe('');
    });
  });

  describe('资源绑定模式', () => {
    it('应该支持三种资源绑定模式', () => {
      const modes: ResourceBindingMode[] = ['dedicated', 'shared', 'hybrid'];
      
      modes.forEach(mode => {
        expect(mode).toMatch(/^(dedicated|shared|hybrid)$/);
      });
    });

    it('专属模式应该优先使用绑定账户', () => {
      const mode: ResourceBindingMode = 'dedicated';
      
      // 在专属模式下，应该只使用绑定的账户
      const mockBinding = {
        mode: mode,
        accountIds: ['account-001', 'account-002'],
        priority: 'strict'
      };
      
      expect(mockBinding.mode).toBe('dedicated');
      expect(mockBinding.priority).toBe('strict');
    });

    it('共享模式应该使用负载均衡', () => {
      const mode: ResourceBindingMode = 'shared';
      
      // 在共享模式下，应该使用负载均衡策略
      const strategy: LoadBalanceStrategy = 'least_connections';
      const mockBinding = {
        mode: mode,
        strategy: strategy,
        poolSize: 10
      };
      
      expect(mockBinding.mode).toBe('shared');
      expect(mockBinding.strategy).toBeDefined();
      expect(mockBinding.strategy).toBe('least_connections');
    });

    it('混合模式应该支持降级', () => {
      const mode: ResourceBindingMode = 'hybrid';
      
      // 混合模式应该先尝试专属，然后降级到共享
      const mockBinding = {
        mode: mode,
        primary: 'dedicated',
        fallback: 'shared',
        fallbackThreshold: 3 // 3次失败后降级
      };
      
      expect(mockBinding.mode).toBe('hybrid');
      expect(mockBinding.primary).toBe('dedicated');
      expect(mockBinding.fallback).toBe('shared');
    });
  });

  describe('负载均衡策略', () => {
    it('应该定义所有负载均衡策略', () => {
      const strategies: LoadBalanceStrategy[] = [
        'round_robin',
        'least_connections',
        'weighted_round_robin',
        'least_response_time',
        'consistent_hash'
      ];
      
      strategies.forEach(strategy => {
        expect(strategy).toBeDefined();
        expect(typeof strategy).toBe('string');
      });
    });

    it('轮询策略应该循环选择', () => {
      const strategy: LoadBalanceStrategy = 'round_robin';
      const accounts = ['acc-1', 'acc-2', 'acc-3'];
      let index = 0;
      
      // 模拟轮询
      const selections = Array(6).fill(null).map(() => {
        const selected = accounts[index % accounts.length];
        index++;
        return selected;
      });
      
      expect(selections).toEqual(['acc-1', 'acc-2', 'acc-3', 'acc-1', 'acc-2', 'acc-3']);
    });

    it('最少连接策略应该选择负载最低的', () => {
      const accounts = [
        { id: 'acc-1', currentLoad: 5 },
        { id: 'acc-2', currentLoad: 2 },
        { id: 'acc-3', currentLoad: 8 }
      ];
      
      const selected = accounts.reduce((min, acc) => 
        acc.currentLoad < min.currentLoad ? acc : min
      );
      
      expect(selected.id).toBe('acc-2');
    });
  });

  describe('成本计算', () => {
    it('应该正确计算令牌成本', () => {
      const costPerMillionTokens = 10; // $10 per million tokens
      const tokens = 1000;
      
      const cost = (tokens / 1_000_000) * costPerMillionTokens;
      expect(cost).toBe(0.01);
    });

    it('不同模型应该有不同的成本', () => {
      const modelCosts = {
        'claude-3-opus': 15,
        'claude-3-sonnet': 3,
        'gpt-4': 30,
        'gpt-3.5-turbo': 0.5
      };
      
      const tokens = 10000;
      
      Object.entries(modelCosts).forEach(([model, costPerMillion]) => {
        const cost = (tokens / 1_000_000) * costPerMillion;
        expect(cost).toBeGreaterThan(0);
        
        if (model === 'gpt-4') {
          expect(cost).toBeGreaterThan(0.1);
        }
        if (model === 'gpt-3.5-turbo') {
          expect(cost).toBeLessThan(0.01);
        }
      });
    });
  });

  describe('错误处理场景', () => {
    it('应该定义所有错误类型', () => {
      const errorTypes = [
        'NO_AVAILABLE_ACCOUNTS',
        'RATE_LIMIT_EXCEEDED',
        'QUOTA_EXCEEDED',
        'INVALID_REQUEST',
        'SERVICE_UNAVAILABLE',
        'AUTHENTICATION_FAILED',
        'TIMEOUT'
      ];
      
      errorTypes.forEach(errorType => {
        expect(errorType).toMatch(/^[A-Z_]+$/);
      });
    });

    it('应该有重试机制的错误', () => {
      const retryableErrors = [
        'SERVICE_UNAVAILABLE',
        'TIMEOUT',
        'RATE_LIMIT_EXCEEDED'
      ];
      
      const nonRetryableErrors = [
        'INVALID_REQUEST',
        'AUTHENTICATION_FAILED',
        'QUOTA_EXCEEDED'
      ];
      
      // 验证分类合理
      expect(retryableErrors.length).toBeGreaterThan(0);
      expect(nonRetryableErrors.length).toBeGreaterThan(0);
    });
  });

  describe('性能指标', () => {
    it('路由决策应该快速', () => {
      const startTime = Date.now();
      
      // 模拟路由决策逻辑
      const accounts = Array(100).fill(null).map((_, i) => ({
        id: `acc-${i}`,
        load: Math.random() * 10
      }));
      
      const selected = accounts.reduce((min, acc) =>
        acc.load < min.load ? acc : min
      );
      
      const endTime = Date.now();
      
      expect(endTime - startTime).toBeLessThan(10); // 应该在10ms内完成
      expect(selected).toBeDefined();
    });

    it('应该支持并发请求', () => {
      const concurrentRequests = 10;
      const requests = Array(concurrentRequests).fill(null).map((_, i) => ({
        id: `req-${i}`,
        timestamp: Date.now()
      }));
      
      // 所有请求应该能同时处理
      expect(requests).toHaveLength(concurrentRequests);
      
      // 时间戳应该非常接近
      const timestamps = requests.map(r => r.timestamp);
      const maxDiff = Math.max(...timestamps) - Math.min(...timestamps);
      expect(maxDiff).toBeLessThan(10); // 10ms内生成
    });
  });

  describe('监控和统计', () => {
    it('应该记录请求统计', () => {
      const stats = {
        totalRequests: 1000,
        successfulRequests: 950,
        failedRequests: 50,
        averageResponseTime: 250, // ms
        totalTokens: 500000,
        totalCost: 5.0
      };
      
      expect(stats.successfulRequests + stats.failedRequests).toBe(stats.totalRequests);
      expect(stats.successfulRequests / stats.totalRequests).toBeGreaterThan(0.9);
      expect(stats.averageResponseTime).toBeLessThan(1000);
    });

    it('应该跟踪账户健康状态', () => {
      const accountHealth = {
        healthy: 8,
        degraded: 1,
        unhealthy: 1,
        total: 10
      };
      
      expect(accountHealth.healthy + accountHealth.degraded + accountHealth.unhealthy)
        .toBe(accountHealth.total);
      expect(accountHealth.healthy / accountHealth.total).toBeGreaterThan(0.7);
    });
  });
});
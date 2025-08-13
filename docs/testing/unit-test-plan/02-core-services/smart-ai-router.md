# SmartAiRouter 测试计划

## 📋 模块概述

**文件路径**: `src/lib/services/smart-ai-router.ts`

**功能描述**: 
SmartAiRouter 是系统的核心路由器，负责智能分配AI请求到不同的服务账户。支持三种资源绑定模式（专属、共享、混合），实现负载均衡、故障转移和使用量统计。

**重要性**: 🔴 **极高** - 核心业务逻辑，直接影响服务可用性和性能

## 🎯 测试范围

### 核心功能模块

| 模块 | 优先级 | 关键方法 |
|------|--------|----------|
| 请求路由 | 高 | routeRequest(), selectAccount() |
| 负载均衡 | 高 | balanceLoad(), getOptimalAccount() |
| 故障转移 | 高 | handleFailover(), retryWithBackoff() |
| 资源绑定 | 高 | bindResource(), unbindResource() |
| 使用统计 | 中 | trackUsage(), calculateCost() |
| 健康检查 | 中 | healthCheck(), updateAccountStatus() |
| 配额管理 | 中 | checkQuota(), updateQuota() |

## 📝 详细测试用例

### 1. 请求路由测试

```typescript
describe('SmartAiRouter - 请求路由', () => {
  describe('routeRequest', () => {
    it('应该根据模型选择正确的账户', async () => {
      // 准备: 设置支持不同模型的账户
      // 输入: 请求GPT-4模型
      // 期望: 路由到支持GPT-4的账户
    });

    it('应该遵循资源绑定模式 - 专属模式', async () => {
      // 准备: 组绑定专属账户
      // 输入: 组成员的请求
      // 期望: 只使用专属账户
    });

    it('应该遵循资源绑定模式 - 共享模式', async () => {
      // 准备: 组使用共享池
      // 输入: 组成员的请求
      // 期望: 从共享池选择
    });

    it('应该遵循资源绑定模式 - 混合模式', async () => {
      // 准备: 组有专属+共享
      // 输入: 高优先级请求
      // 期望: 优先使用专属，降级到共享
    });

    it('应该处理无可用账户的情况', async () => {
      // 准备: 所有账户不可用
      // 输入: 新请求
      // 期望: 返回合适的错误
    });
  });

  describe('selectAccount - 账户选择策略', () => {
    it('应该选择负载最低的账户', async () => {
      // 准备: 多个账户不同负载
      // 期望: 选择负载最低的
    });

    it('应该考虑账户成本', async () => {
      // 准备: 相同负载不同成本
      // 期望: 选择成本最低的
    });

    it('应该避免选择错误率高的账户', async () => {
      // 准备: 账户有错误历史
      // 期望: 降低选择权重
    });

    it('应该支持优先级队列', async () => {
      // 准备: VIP用户请求
      // 期望: 优先分配好账户
    });
  });
});
```

### 2. 负载均衡测试

```typescript
describe('负载均衡', () => {
  describe('balanceLoad', () => {
    it('应该均匀分配请求', async () => {
      // 准备: 3个相同的账户
      // 输入: 300个请求
      // 期望: 每个账户约100个
    });

    it('应该支持加权轮询', async () => {
      // 准备: 账户权重 2:1:1
      // 输入: 400个请求
      // 期望: 分配比例 200:100:100
    });

    it('应该动态调整权重', async () => {
      // 准备: 账户性能变化
      // 期望: 权重自动调整
    });

    it('应该处理账户动态上下线', async () => {
      // 动作: 运行中移除账户
      // 期望: 平滑迁移流量
    });
  });

  describe('并发控制', () => {
    it('应该限制单账户并发数', async () => {
      // 准备: 设置并发限制10
      // 输入: 20个并发请求
      // 期望: 最多10个同时处理
    });

    it('应该排队超出的请求', async () => {
      // 准备: 并发已满
      // 输入: 新请求
      // 期望: 进入队列等待
    });
  });
});
```

### 3. 故障转移测试

```typescript
describe('故障转移', () => {
  describe('handleFailover', () => {
    it('应该自动切换失败的账户', async () => {
      // 准备: 主账户请求失败
      // 期望: 自动使用备用账户
    });

    it('应该实施指数退避重试', async () => {
      // 准备: 连续失败
      // 期望: 重试间隔递增
    });

    it('应该记录失败并降级账户', async () => {
      // 准备: 账户多次失败
      // 期望: 标记为不健康
    });

    it('应该支持断路器模式', async () => {
      // 准备: 失败率超过阈值
      // 期望: 熔断该账户
    });
  });

  describe('错误恢复', () => {
    it('应该自动恢复健康账户', async () => {
      // 准备: 账户从错误恢复
      // 期望: 重新加入路由
    });

    it('应该保存请求上下文用于重试', async () => {
      // 准备: 请求失败
      // 期望: 重试时保持原始参数
    });
  });
});
```

### 4. 使用统计测试

```typescript
describe('使用统计', () => {
  describe('trackUsage', () => {
    it('应该准确记录令牌使用量', async () => {
      // 输入: 完成的请求
      // 期望: 记录输入输出令牌
    });

    it('应该计算正确的成本', async () => {
      // 准备: 不同价格的模型
      // 期望: 成本计算准确
    });

    it('应该聚合组级别统计', async () => {
      // 准备: 组内多个用户
      // 期望: 正确聚合数据
    });

    it('应该支持实时统计查询', async () => {
      // 期望: 毫秒级返回统计
    });
  });
});
```

## 🔧 Mock策略

### AI服务客户端Mock

```typescript
class MockAiServiceClient {
  async sendRequest(request) {
    return {
      id: 'mock-response-id',
      choices: [{ message: { content: 'Mock response' } }],
      usage: { prompt_tokens: 10, completion_tokens: 20 }
    };
  }
  
  async healthCheck() {
    return { isHealthy: true, responseTime: 100 };
  }
}
```

### 数据库Mock

```typescript
const mockPrisma = {
  aiServiceAccount: {
    findMany: jest.fn(),
    update: jest.fn()
  },
  groupAccountBinding: {
    findFirst: jest.fn(),
    create: jest.fn()
  },
  usageStat: {
    create: jest.fn(),
    aggregate: jest.fn()
  }
};
```

## 🔍 边界条件和异常处理

### 极限场景
- 1000个并发请求
- 账户全部失败
- 网络分区
- 请求超时
- 超大payload (>1MB)

### 资源限制
- 内存使用 < 500MB
- CPU使用 < 80%
- 请求队列上限 10000

### 错误场景
```typescript
describe('异常处理', () => {
  it('应该处理账户凭证过期', async () => {
    // 期望: 通知管理员
  });

  it('应该处理API限流', async () => {
    // 期望: 智能退避
  });

  it('应该处理部分成功', async () => {
    // 期望: 返回部分结果
  });
});
```

## ⚡ 性能基准

| 操作 | 目标延迟 | 并发数 |
|------|---------|--------|
| 路由决策 | < 5ms | 1000 |
| 账户选择 | < 10ms | 500 |
| 故障转移 | < 100ms | 100 |
| 统计查询 | < 50ms | 200 |

## ✅ 验收标准

### 功能验收
- [ ] 三种绑定模式正确实现
- [ ] 负载均衡算法有效
- [ ] 故障转移机制可靠
- [ ] 统计数据准确

### 性能验收
- [ ] 99%请求延迟 < 100ms
- [ ] 支持1000 QPS
- [ ] 故障恢复时间 < 30s

### 可靠性验收
- [ ] 99.9%可用性
- [ ] 零数据丢失
- [ ] 优雅降级

## 📚 测试数据准备

```typescript
export const mockAccounts = [
  {
    id: 'acc-1',
    serviceType: 'OPENAI',
    status: 'active',
    currentLoad: 0.3,
    costPerToken: 0.00002,
    supportedModels: ['gpt-4', 'gpt-3.5-turbo']
  },
  {
    id: 'acc-2',
    serviceType: 'CLAUDE',
    status: 'active',
    currentLoad: 0.5,
    costPerToken: 0.00003,
    supportedModels: ['claude-3-opus', 'claude-3-sonnet']
  }
];

export const mockRequests = [
  {
    model: 'gpt-4',
    messages: [{ role: 'user', content: 'Hello' }],
    userId: 'user-123',
    groupId: 'group-456'
  }
];
```

## 🚀 实施步骤

| 阶段 | 任务 | 预计工时 |
|------|------|---------|
| Day 1-2 | 路由逻辑测试 | 8h |
| Day 3 | 负载均衡测试 | 6h |
| Day 4 | 故障转移测试 | 6h |
| Day 5 | 性能和压力测试 | 4h |
| Day 6 | 集成测试 | 4h |

---

*创建日期: 2025-01-12*
*负责人: 核心服务测试小组*
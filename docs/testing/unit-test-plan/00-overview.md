# AiCarpool 单元测试计划总览

## 📋 项目概述

AiCarpool 是一个企业级 AI 资源管理平台，提供智能路由、负载均衡、权限管理等核心功能。本测试计划旨在建立完整的单元测试体系，确保代码质量和系统稳定性。

## 🎯 测试目标

1. **覆盖率目标**
   - 总体代码覆盖率：80%以上
   - 核心模块覆盖率：95%以上
   - 关键路径覆盖率：100%

2. **质量目标**
   - 零关键缺陷
   - 所有测试执行时间 < 60秒
   - 测试可维护性高

3. **业务目标**
   - 保障核心业务逻辑正确性
   - 减少生产环境故障率
   - 提高开发效率

## 🏗 测试架构

### 测试技术栈
- **测试框架**: Jest 30.x
- **React测试**: @testing-library/react
- **API测试**: Supertest
- **Mock工具**: jest-mock-extended, MSW
- **覆盖率工具**: Jest Coverage

### 测试分层
```
┌─────────────────────────────────────┐
│         E2E Tests (10%)             │
├─────────────────────────────────────┤
│     Integration Tests (30%)         │
├─────────────────────────────────────┤
│       Unit Tests (60%)              │
└─────────────────────────────────────┘
```

## 📊 模块优先级矩阵

| 模块分类 | 优先级 | 覆盖率要求 | 测试重点 |
|---------|--------|-----------|---------|
| 认证与安全 | 🔴 高 | 95% | JWT、权限验证、API密钥 |
| 核心服务 | 🔴 高 | 95% | AI路由、负载均衡、限流 |
| 数据处理 | 🟡 中 | 85% | 验证、缓存、队列 |
| React组件 | 🟡 中 | 80% | 关键UI组件、表单 |
| 自定义Hooks | 🟡 中 | 85% | 业务逻辑Hooks |
| API路由 | 🟢 低 | 75% | 端点验证、错误处理 |

## 📅 实施计划

### 第一阶段：基础设施（已完成）
- ✅ 测试环境搭建
- ✅ Jest配置
- ✅ 测试工具函数
- ✅ Mock策略制定

### 第二阶段：认证与安全（第1周）
- [ ] JWT工具测试
- [ ] 认证中间件测试
- [ ] 权限管理测试
- [ ] API密钥验证测试

### 第三阶段：核心服务（第2周）
- [ ] SmartAiRouter测试
- [ ] LoadBalancer测试
- [ ] RateLimiter测试
- [ ] AccountPoolManager测试

### 第四阶段：数据处理（第3周）
- [ ] 输入验证器测试
- [ ] 缓存服务测试
- [ ] 队列处理器测试
- [ ] 数据转换工具测试

### 第五阶段：UI组件（第4周）
- [ ] 认证组件测试
- [ ] 仪表板组件测试
- [ ] 表单组件测试
- [ ] 权限守卫测试

### 第六阶段：集成测试（第5周）
- [ ] Hooks测试
- [ ] API路由测试
- [ ] 端到端流程测试
- [ ] 性能测试

## 📁 测试文件组织

```
src/
├── __tests__/
│   ├── unit/
│   │   ├── lib/
│   │   │   ├── auth/           # 认证相关测试
│   │   │   ├── services/       # 服务层测试
│   │   │   ├── rate-limit/     # 限流测试
│   │   │   └── utils/          # 工具函数测试
│   │   ├── components/
│   │   │   ├── auth/           # 认证组件测试
│   │   │   ├── dashboard/      # 仪表板组件测试
│   │   │   └── enterprise/     # 企业组件测试
│   │   └── hooks/              # 自定义Hooks测试
│   ├── integration/            # 集成测试
│   └── e2e/                   # 端到端测试
```

## 🔍 测试标准

### 命名规范
```typescript
describe('ModuleName', () => {
  describe('functionName', () => {
    it('should perform expected behavior when condition is met', () => {
      // Test implementation
    });
  });
});
```

### 测试结构（AAA模式）
```typescript
it('should validate user credentials', () => {
  // Arrange
  const credentials = { email: 'test@example.com', password: 'Test123!' };
  
  // Act
  const result = validateCredentials(credentials);
  
  // Assert
  expect(result.isValid).toBe(true);
});
```

### Mock原则
1. 最小化Mock - 只Mock必要的依赖
2. 真实性 - Mock行为应接近真实实现
3. 隔离性 - 每个测试独立，不相互影响
4. 可维护性 - Mock易于理解和修改

## 📈 覆盖率标准

### 覆盖率指标
- **语句覆盖率(Statements)**: 80%
- **分支覆盖率(Branches)**: 75%
- **函数覆盖率(Functions)**: 85%
- **行覆盖率(Lines)**: 80%

### 核心模块特殊要求
```javascript
// jest.config.js
coverageThreshold: {
  './src/lib/auth/**': {
    branches: 95,
    functions: 95,
    lines: 95,
    statements: 95
  },
  './src/lib/services/smart-ai-router.ts': {
    branches: 90,
    functions: 95,
    lines: 90,
    statements: 90
  }
}
```

## 🚀 快速开始

### 运行测试
```bash
# 运行所有测试
npm test

# 运行特定模块测试
npm test -- auth

# 运行覆盖率报告
npm run test:coverage

# 监听模式
npm run test:watch
```

### 查看覆盖率报告
```bash
# HTML报告
open coverage/lcov-report/index.html

# 终端报告
npm run test:coverage -- --coverageReporters=text
```

## 📋 检查清单

### 测试编写检查
- [ ] 测试名称清晰描述行为
- [ ] 遵循AAA模式
- [ ] 包含正常和异常场景
- [ ] 测试独立可重复
- [ ] Mock最小化且合理

### 代码质量检查
- [ ] 无硬编码测试数据
- [ ] 使用测试工厂函数
- [ ] 清理副作用
- [ ] 异步测试正确处理
- [ ] 错误信息有意义

## 📚 相关文档

- [测试环境搭建](../01-testing-setup.md)
- [单元测试指南](../02-unit-testing.md)
- [集成测试指南](../03-integration-testing.md)
- [测试问题排查](../troubleshooting.md)

## 🎯 下一步行动

1. 查看各模块详细测试计划
2. 从高优先级模块开始实施
3. 定期更新进度跟踪文档
4. 持续优化测试策略

---

*最后更新: 2025-01-12*
*负责人: AI测试团队*
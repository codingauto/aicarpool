# AiCarpool 测试系统文档

## 📋 概述

AiCarpool项目采用全面的测试策略，包括单元测试、集成测试和端到端测试。本文档介绍测试系统的架构、使用方法和最佳实践。

## 🏗️ 测试架构

```
src/
├── __tests__/
│   ├── unit/           # 单元测试
│   │   ├── lib/
│   │   │   ├── auth/   # 认证相关测试
│   │   │   ├── permission/ # 权限管理测试
│   │   │   └── services/   # 服务层测试
│   │   └── setup/      # 测试设置
│   ├── integration/    # 集成测试（计划中）
│   └── e2e/           # 端到端测试（计划中）
├── test-utils/        # 测试工具
│   ├── factories/     # 测试数据工厂
│   ├── helpers/       # 辅助函数
│   └── mocks/        # Mock对象
```

## 🚀 快速开始

### 1. 环境准备

```bash
# 验证测试环境
node scripts/verify-test-env.js

# 安装依赖
npm install
```

### 2. 运行测试

```bash
# 运行所有测试
npm run test

# 监视模式
npm run test:watch

# 生成覆盖率报告
npm run test:coverage

# 运行特定测试文件
npm run test -- jwt-core.test.ts

# 运行特定目录的测试
npm run test -- src/__tests__/unit/lib/auth
```

### 3. 生成测试报告

```bash
# 运行测试总结脚本
node scripts/test-summary.js

# 生成覆盖率报告
npm run test:coverage
open coverage/lcov-report/index.html
```

## 📊 当前测试状态

### 测试统计（2025-01-13）

| 指标 | 数值 | 状态 |
|------|------|------|
| **总测试用例** | 163 | 📈 |
| **通过用例** | 114 | ✅ |
| **失败用例** | 49 | ⚠️ |
| **通过率** | 70% | 🔄 |
| **测试套件** | 8 | 📁 |

### 核心模块覆盖

| 模块 | 测试文件 | 通过率 | 状态 |
|------|---------|--------|------|
| JWT核心 | `jwt-core.test.ts` | 100% | ✅ |
| 权限核心 | `permission-core.test.ts` | 100% | ✅ |
| 路由核心 | `router-core.test.ts` | 85.7% | 🔄 |

## 🛠️ 测试工具

### 1. 测试数据工厂

```typescript
// 使用JWT测试数据工厂
import { JWTTestFactory } from '@/test-utils/factories/jwt-factory';

const payload = JWTTestFactory.createPayload();
const token = JWTTestFactory.createValidToken();
```

### 2. Mock工厂

```typescript
// 使用Prisma Mock工厂
import { createPrismaMockWithScenarios } from '@/test-utils/mocks/prisma-mock-factory';

const { mock, scenarios } = createPrismaMockWithScenarios();
scenarios.setupAuthScenario('user-123');
```

### 3. 测试辅助函数

```typescript
// 使用测试辅助工具
import { setupTestEnv, measurePerformance, waitFor } from '@/test-utils/helpers/test-helpers';

setupTestEnv({ JWT_SECRET: 'test-secret' });
const time = await measurePerformance(async () => {
  // 测试代码
});
```

## 📝 编写测试指南

### 1. 单元测试结构

```typescript
import { describe, it, expect, beforeEach, jest } from '@jest/globals';

describe('模块名称', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('功能组', () => {
    it('应该执行某个行为', () => {
      // Arrange - 准备数据
      const input = { /* ... */ };
      
      // Act - 执行操作
      const result = functionUnderTest(input);
      
      // Assert - 验证结果
      expect(result).toBe(expectedValue);
    });
  });
});
```

### 2. 异步测试

```typescript
it('应该处理异步操作', async () => {
  const result = await asyncFunction();
  expect(result).toBeDefined();
});

it('应该拒绝无效输入', async () => {
  await expect(asyncFunction('invalid'))
    .rejects.toThrow('Error message');
});
```

### 3. Mock使用

```typescript
// Mock外部依赖
jest.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: jest.fn()
    }
  }
}));

// 在测试中使用
import { prisma } from '@/lib/prisma';
const mockedPrisma = prisma as any;

it('测试用例', () => {
  mockedPrisma.user.findUnique.mockResolvedValue({ id: '123' });
  // 测试代码
});
```

## 🔧 配置文件

### jest.config.js

主要的Jest配置文件，定义了：
- 测试环境
- 模块路径映射
- 覆盖率阈值
- 测试设置文件

### .env.test

测试环境变量配置，包括：
- 数据库连接
- JWT密钥
- Redis配置
- 日志级别

### tsconfig.test.json

TypeScript测试配置，扩展主配置并添加测试特定设置。

## 🚨 CI/CD 集成

### GitHub Actions

项目配置了自动化测试流水线：

1. **测试流水线** (`.github/workflows/test.yml`)
   - 多版本Node.js测试
   - 数据库和Redis服务
   - 覆盖率报告
   - 测试结果上传

2. **覆盖率徽章** (`.github/workflows/coverage.yml`)
   - 自动生成覆盖率徽章
   - 更新README徽章

### 触发条件

- Push到main/develop分支
- Pull Request
- 手动触发

## 📈 测试覆盖率目标

### 当前覆盖率

```
语句覆盖: ~0.67%
分支覆盖: ~0.4%
函数覆盖: ~0.65%
行覆盖: ~0.66%
```

### Q1 2025目标

```
语句覆盖: 80%
分支覆盖: 75%
函数覆盖: 85%
行覆盖: 80%
```

## 🎯 最佳实践

### 1. 测试命名

- 使用描述性的测试名称
- 遵循 "应该..." 模式
- 包含预期行为

### 2. 测试隔离

- 每个测试应该独立运行
- 使用beforeEach/afterEach清理状态
- 避免测试间依赖

### 3. Mock策略

- 只Mock外部依赖
- 保持Mock简单
- 使用工厂模式创建测试数据

### 4. 性能考虑

- 避免不必要的异步操作
- 使用`jest.useFakeTimers()`处理时间
- 批量运行相关测试

## 📚 相关文档

- [测试环境搭建](./01-testing-setup.md)
- [单元测试指南](./02-unit-testing.md)
- [测试计划](./unit-test-plan/00-overview.md)
- [测试进度跟踪](./unit-test-plan/progress-tracker.md)
- [最终测试报告](./final-test-report.md)

## 🐛 故障排除

### 常见问题

1. **测试失败：Mock类型不匹配**
   - 确保Mock结构与实际依赖一致
   - 使用TypeScript类型检查

2. **测试超时**
   - 检查异步操作是否正确await
   - 增加jest.setTimeout()

3. **覆盖率不准确**
   - 清理coverage目录后重新运行
   - 确保所有源文件都被包含

### 调试技巧

```bash
# 运行单个测试并显示详细信息
npm run test -- --verbose jwt-core.test.ts

# 调试模式
node --inspect-brk node_modules/.bin/jest --runInBand

# 查看覆盖率详情
npm run test:coverage -- --collectCoverageFrom='src/lib/auth/**'
```

## 🤝 贡献指南

1. 新功能必须包含测试
2. 修复bug应该添加回归测试
3. 保持测试通过率>70%
4. 遵循现有测试模式

## 📞 支持

如有问题或建议，请：
1. 查看[测试文档](./README.md)
2. 提交Issue到项目仓库
3. 联系测试团队

---

*最后更新: 2025-01-13*  
*维护者: AI测试团队*
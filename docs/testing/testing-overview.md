# AiCarpool 测试指南总览

## 📚 文档导航

本测试指南分为多个阶段，您可以按照项目需求逐步实施：

| 阶段 | 文档 | 描述 | 优先级 |
|------|------|------|--------|
| 1 | [环境搭建](./01-testing-setup.md) | 测试环境配置和工具安装 | 🔴 必需 |
| 2 | [单元测试](./02-unit-testing.md) | 函数和组件的独立测试 | 🔴 必需 |
| 3 | [集成测试](./03-integration-testing.md) | API和模块集成测试 | 🟡 重要 |
| 4 | [E2E测试](./04-e2e-testing.md) | 端到端用户流程测试 | 🟡 重要 |
| 5 | [性能测试](./05-performance-testing.md) | 负载和压力测试 | 🟢 可选 |
| 6 | [CI/CD集成](./06-ci-cd-integration.md) | 自动化测试流程 | 🟡 重要 |
| - | [故障排查](./troubleshooting.md) | 常见问题和解决方案 | 📖 参考 |

## 🎯 测试策略

### 测试金字塔

```
        /\
       /E2E\      <- 端到端测试 (10%)
      /------\       用户完整流程、关键业务场景
     /集成测试\    <- API和模块集成 (30%)
    /----------\     API端点、数据库操作、服务交互
   /  单元测试   \  <- 函数和组件 (60%)
  /--------------\   工具函数、React组件、业务逻辑
```

### 测试目标

- ✅ **代码覆盖率**: 80%+ (关键路径100%)
- ⚡ **执行速度**: 单元测试 < 1分钟
- 🔄 **持续集成**: 每次提交自动运行
- 📊 **质量门禁**: 测试失败阻止合并

## 🚀 快速开始

### 1. 安装基础依赖

```bash
# 安装所有测试依赖
npm install --save-dev \
  jest @types/jest \
  @testing-library/react \
  @testing-library/jest-dom \
  @testing-library/user-event \
  supertest @types/supertest
```

### 2. 运行测试

```bash
# 运行所有测试
npm test

# 监听模式（开发时使用）
npm run test:watch

# 生成覆盖率报告
npm run test:coverage

# 运行特定类型测试
npm run test:unit        # 仅单元测试
npm run test:integration # 仅集成测试
npm run test:e2e        # 仅E2E测试
```

### 3. 查看测试报告

```bash
# 打开覆盖率报告
open coverage/lcov-report/index.html

# 查看测试结果
cat test-results/results.json
```

## 📋 实施路线图

### 第一阶段：基础建设（1-2周）
- [x] 搭建测试环境
- [ ] 配置Jest和测试工具
- [ ] 创建测试数据库
- [ ] 编写第一个测试

### 第二阶段：核心测试（2-3周）
- [ ] 认证模块单元测试
- [ ] 权限系统单元测试
- [ ] API路由集成测试
- [ ] 数据库操作测试

### 第三阶段：UI测试（2-3周）
- [ ] React组件测试
- [ ] 表单交互测试
- [ ] 用户流程E2E测试
- [ ] 跨浏览器测试

### 第四阶段：自动化（1-2周）
- [ ] CI/CD集成
- [ ] 自动化测试报告
- [ ] 性能基准测试
- [ ] 质量门禁设置

## 🏆 最佳实践

### Do's ✅
- 每个功能都有对应的测试
- 测试名称清晰描述预期行为
- 保持测试独立和幂等
- 使用AAA模式（Arrange-Act-Assert）
- 优先测试关键业务逻辑

### Don'ts ❌
- 不要测试实现细节
- 避免过度Mock
- 不要忽略边界条件
- 避免测试之间的依赖
- 不要跳过失败的测试

## 📊 测试指标

### 覆盖率要求

| 模块 | 行覆盖率 | 分支覆盖率 | 函数覆盖率 |
|------|---------|-----------|-----------|
| 核心业务 | 90% | 85% | 90% |
| API路由 | 80% | 75% | 85% |
| UI组件 | 70% | 65% | 75% |
| 工具函数 | 95% | 90% | 100% |

### 性能基准

| 测试类型 | 目标时间 | 最大时间 |
|---------|---------|---------|
| 单元测试套件 | < 30s | 60s |
| 集成测试套件 | < 2min | 5min |
| E2E测试套件 | < 5min | 10min |
| 全部测试 | < 8min | 15min |

## 🔧 工具链

### 核心工具
- **Jest**: JavaScript测试框架
- **React Testing Library**: React组件测试
- **Supertest**: HTTP测试
- **Playwright**: E2E测试
- **k6**: 性能测试

### 辅助工具
- **MSW**: API Mock
- **Faker.js**: 测试数据生成
- **Codecov**: 覆盖率报告
- **Jest-Extended**: 额外的匹配器

## 💡 快速提示

### 运行单个测试文件
```bash
npm test -- auth.test.ts
```

### 调试测试
```bash
node --inspect-brk ./node_modules/.bin/jest --runInBand
```

### 更新快照
```bash
npm test -- -u
```

### 只运行失败的测试
```bash
npm test -- --onlyFailures
```

## 📚 学习资源

- [Jest 官方文档](https://jestjs.io/)
- [Testing Library 文档](https://testing-library.com/)
- [Playwright 指南](https://playwright.dev/)
- [JavaScript测试最佳实践](https://github.com/goldbergyoni/javascript-testing-best-practices)

## 🤝 贡献指南

1. 新功能必须包含测试
2. 修复Bug需要添加回归测试
3. 保持测试覆盖率不降低
4. 遵循既定的测试模式
5. 及时更新测试文档

---

> 💡 **提示**: 建议从阶段1开始，逐步推进。优先完成核心模块的单元测试，再扩展到集成测试和E2E测试。

---

*最后更新: 2024-12-10*
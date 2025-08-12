# AiCarpool 测试指南

## 📋 目录

- [概述](#概述)
- [快速开始](#快速开始)
- [环境搭建](#环境搭建)
- [测试类型](#测试类型)
- [编写测试](#编写测试)
- [测试示例](#测试示例)
- [CI/CD集成](#cicd集成)
- [测试覆盖率](#测试覆盖率)
- [故障排查](#故障排查)

---

## 概述

AiCarpool 采用全面的测试策略，确保代码质量和系统稳定性。我们遵循测试金字塔原则，从底层到顶层包括：

```
        /\
       /E2E\      <- 端到端测试 (10%)
      /------\
     /集成测试\    <- API和模块集成 (30%)
    /----------\
   /  单元测试   \  <- 函数和组件 (60%)
  /--------------\
```

### 测试目标

- **代码覆盖率**: 整体 80%+，关键路径 100%
- **执行速度**: 单元测试 < 1分钟，全部测试 < 5分钟
- **可维护性**: 清晰的测试结构，易于理解和修改
- **自动化**: CI/CD 管道中自动执行

---

## 快速开始

```bash
# 安装测试依赖
npm install --save-dev jest @testing-library/react @testing-library/jest-dom
npm install --save-dev @testing-library/user-event supertest
npm install --save-dev @types/jest @types/supertest

# 运行所有测试
npm test

# 运行测试并监听文件变化
npm run test:watch

# 生成覆盖率报告
npm run test:coverage

# 运行特定类型的测试
npm run test:unit
npm run test:integration
npm run test:e2e
```

---

## 环境搭建

### 1. Jest 配置

创建 `jest.config.js`:

```javascript
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: [
    '**/__tests__/**/*.+(ts|tsx|js)',
    '**/?(*.)+(spec|test).+(ts|tsx|js)'
  ],
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', {
      tsconfig: {
        jsx: 'react'
      }
    }]
  },
  collectCoverageFrom: [
    'src/**/*.{js,jsx,ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/*.stories.tsx',
    '!src/**/index.ts'
  ],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 80,
      statements: 80
    }
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy'
  },
  setupFilesAfterEnv: ['<rootDir>/src/test-utils/setup.ts'],
  testPathIgnorePatterns: ['/node_modules/', '/.next/'],
  moduleDirectories: ['node_modules', 'src'],
  globals: {
    'ts-jest': {
      isolatedModules: true
    }
  }
};
```

### 2. 测试环境设置

创建 `src/test-utils/setup.ts`:

```typescript
import '@testing-library/jest-dom';
import { loadEnvConfig } from '@next/env';

// 加载测试环境变量
loadEnvConfig(process.cwd());

// Mock Prisma Client
jest.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    enterprise: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
    },
    // 添加其他模型的 mock
  }
}));

// Mock Redis
jest.mock('@/lib/redis', () => ({
  redisClient: {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    expire: jest.fn(),
  }
}));

// 全局测试工具
global.beforeEach(() => {
  jest.clearAllMocks();
});
```

### 3. 测试数据库配置

创建 `.env.test`:

```env
DATABASE_URL="mysql://test_user:test_password@localhost:3306/aicarpool_test"
REDIS_URL="redis://localhost:6379/1"
JWT_SECRET="test-secret-key"
NODE_ENV="test"
```

数据库迁移脚本:

```bash
# 创建测试数据库
npx prisma migrate dev --name init --skip-seed

# 重置测试数据库
npx prisma migrate reset --force --skip-seed
```

---

## 测试类型

### 单元测试 (Unit Tests)

针对独立的函数、类和组件进行测试。

**测试范围**:
- 工具函数 (`src/lib/utils.ts`)
- 认证逻辑 (`src/lib/auth.ts`)
- React组件 (`src/components/`)
- 自定义Hooks (`src/hooks/`)

**命名规范**: `*.test.ts` 或 `*.spec.ts`

### 集成测试 (Integration Tests)

测试多个模块之间的交互。

**测试范围**:
- API路由 (`src/app/api/`)
- 数据库操作
- 第三方服务集成

**命名规范**: `*.integration.test.ts`

### 端到端测试 (E2E Tests)

模拟真实用户操作，测试完整的业务流程。

**测试范围**:
- 用户注册/登录流程
- 企业管理流程
- AI账号配置流程

**工具选择**: Playwright

```bash
# 安装 Playwright
npm install --save-dev @playwright/test

# 初始化 Playwright
npx playwright install
```

### 性能测试

使用 k6 进行性能测试：

```javascript
// k6-tests/load-test.js
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '2m', target: 100 }, // 逐步增加到100个用户
    { duration: '5m', target: 100 }, // 保持100个用户
    { duration: '2m', target: 0 },   // 逐步减少到0
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95%的请求应在500ms内完成
  },
};

export default function () {
  const res = http.get('http://localhost:4000/api/health');
  check(res, {
    'status is 200': (r) => r.status === 200,
    'response time < 500ms': (r) => r.timings.duration < 500,
  });
  sleep(1);
}
```

---

## 编写测试

### 最佳实践

1. **AAA模式** (Arrange-Act-Assert)
```typescript
test('should authenticate user with valid credentials', async () => {
  // Arrange - 准备测试数据
  const credentials = { email: 'test@example.com', password: 'password123' };
  
  // Act - 执行操作
  const result = await authService.login(credentials);
  
  // Assert - 验证结果
  expect(result.success).toBe(true);
  expect(result.token).toBeDefined();
});
```

2. **描述性测试名称**
```typescript
describe('AuthService', () => {
  describe('login', () => {
    it('should return token when credentials are valid', () => {});
    it('should throw error when email is invalid', () => {});
    it('should lock account after 5 failed attempts', () => {});
  });
});
```

3. **测试隔离**
```typescript
beforeEach(() => {
  // 每个测试前重置状态
  jest.clearAllMocks();
  // 重置数据库
  return resetTestDatabase();
});

afterEach(() => {
  // 清理测试产生的副作用
  return cleanupTestData();
});
```

### Mock 策略

```typescript
// src/__mocks__/ai-service.ts
export const mockAiService = {
  chat: jest.fn().mockResolvedValue({
    success: true,
    response: 'Mocked AI response',
    tokens: 100,
  }),
  
  validateAccount: jest.fn().mockResolvedValue({
    isValid: true,
    status: 'active',
  }),
};

// 在测试中使用
jest.mock('@/lib/ai-service', () => ({
  aiService: mockAiService,
}));
```

---

## 测试示例

### 1. API路由测试

```typescript
// src/app/api/auth/login/__tests__/route.test.ts
import { POST } from '../route';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

describe('POST /api/auth/login', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should login user with valid credentials', async () => {
    // Mock数据库查询
    const mockUser = {
      id: 'user-1',
      email: 'test@example.com',
      password: await bcrypt.hash('password123', 10),
      name: 'Test User',
    };
    
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

    // 创建请求
    const request = new Request('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'test@example.com',
        password: 'password123',
      }),
    });

    // 执行请求
    const response = await POST(request);
    const data = await response.json();

    // 验证响应
    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.token).toBeDefined();
    expect(data.data.user.email).toBe('test@example.com');
  });

  it('should reject invalid credentials', async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

    const request = new Request('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'wrong@example.com',
        password: 'wrongpassword',
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.success).toBe(false);
    expect(data.message).toContain('Invalid credentials');
  });
});
```

### 2. React组件测试

```typescript
// src/components/auth/__tests__/login-form.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LoginForm } from '../login-form';
import { useRouter } from 'next/navigation';

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}));

describe('LoginForm', () => {
  const mockPush = jest.fn();
  
  beforeEach(() => {
    (useRouter as jest.Mock).mockReturnValue({
      push: mockPush,
    });
  });

  it('should render login form', () => {
    render(<LoginForm />);
    
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /login/i })).toBeInTheDocument();
  });

  it('should validate email format', async () => {
    const user = userEvent.setup();
    render(<LoginForm />);
    
    const emailInput = screen.getByLabelText(/email/i);
    const submitButton = screen.getByRole('button', { name: /login/i });
    
    await user.type(emailInput, 'invalid-email');
    await user.click(submitButton);
    
    expect(screen.getByText(/invalid email format/i)).toBeInTheDocument();
  });

  it('should submit form with valid data', async () => {
    const user = userEvent.setup();
    render(<LoginForm />);
    
    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const submitButton = screen.getByRole('button', { name: /login/i });
    
    await user.type(emailInput, 'test@example.com');
    await user.type(passwordInput, 'password123');
    await user.click(submitButton);
    
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/dashboard');
    });
  });
});
```

### 3. 服务层测试

```typescript
// src/lib/services/__tests__/ai-account-service.test.ts
import { AiAccountService } from '../ai-account-service';
import { prisma } from '@/lib/prisma';

describe('AiAccountService', () => {
  let service: AiAccountService;

  beforeEach(() => {
    service = new AiAccountService();
    jest.clearAllMocks();
  });

  describe('createAccount', () => {
    it('should create AI account with valid data', async () => {
      const accountData = {
        name: 'Test Account',
        platform: 'claude',
        authType: 'oauth',
        enterpriseId: 'enterprise-1',
      };

      const mockAccount = {
        id: 'account-1',
        ...accountData,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (prisma.aiServiceAccount.create as jest.Mock).mockResolvedValue(mockAccount);

      const result = await service.createAccount(accountData);

      expect(result).toEqual(mockAccount);
      expect(prisma.aiServiceAccount.create).toHaveBeenCalledWith({
        data: expect.objectContaining(accountData),
      });
    });

    it('should validate required fields', async () => {
      const invalidData = {
        name: '',
        platform: 'invalid',
      };

      await expect(service.createAccount(invalidData as any))
        .rejects
        .toThrow('Invalid account data');
    });
  });

  describe('rotateAccounts', () => {
    it('should select least used account', async () => {
      const mockAccounts = [
        { id: 'acc-1', currentLoad: 50, priority: 1 },
        { id: 'acc-2', currentLoad: 20, priority: 1 },
        { id: 'acc-3', currentLoad: 80, priority: 1 },
      ];

      (prisma.aiServiceAccount.findMany as jest.Mock).mockResolvedValue(mockAccounts);

      const selected = await service.selectAccount('group-1');

      expect(selected.id).toBe('acc-2'); // 最低负载的账号
    });
  });
});
```

### 4. E2E测试示例

```typescript
// tests/e2e/auth.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Authentication Flow', () => {
  test('should complete login flow', async ({ page }) => {
    // 访问登录页
    await page.goto('/auth/login');
    
    // 填写登录表单
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'password123');
    
    // 提交表单
    await page.click('button[type="submit"]');
    
    // 等待跳转到仪表板
    await page.waitForURL('/dashboard');
    
    // 验证登录成功
    await expect(page.locator('h1')).toContainText('Dashboard');
    await expect(page.locator('[data-testid="user-menu"]')).toContainText('test@example.com');
  });

  test('should handle login errors', async ({ page }) => {
    await page.goto('/auth/login');
    
    await page.fill('input[name="email"]', 'wrong@example.com');
    await page.fill('input[name="password"]', 'wrongpassword');
    await page.click('button[type="submit"]');
    
    // 验证错误消息
    await expect(page.locator('.error-message')).toContainText('Invalid credentials');
  });
});
```

---

## CI/CD集成

### GitHub Actions配置

创建 `.github/workflows/test.yml`:

```yaml
name: Test Suite

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

jobs:
  test:
    runs-on: ubuntu-latest
    
    services:
      mysql:
        image: mysql:8
        env:
          MYSQL_ROOT_PASSWORD: root
          MYSQL_DATABASE: aicarpool_test
        ports:
          - 3306:3306
        options: >-
          --health-cmd="mysqladmin ping"
          --health-interval=10s
          --health-timeout=5s
          --health-retries=5
      
      redis:
        image: redis:7
        ports:
          - 6379:6379
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Setup test database
        env:
          DATABASE_URL: mysql://root:root@localhost:3306/aicarpool_test
        run: |
          npx prisma generate
          npx prisma migrate deploy
      
      - name: Run unit tests
        run: npm run test:unit
      
      - name: Run integration tests
        env:
          DATABASE_URL: mysql://root:root@localhost:3306/aicarpool_test
          REDIS_URL: redis://localhost:6379
        run: npm run test:integration
      
      - name: Generate coverage report
        run: npm run test:coverage
      
      - name: Upload coverage to Codecov
        uses: codecov/codecov-action@v3
        with:
          file: ./coverage/lcov.info
          fail_ci_if_error: true
      
      - name: Run E2E tests
        run: |
          npm run build
          npm run start &
          npx wait-on http://localhost:3000
          npm run test:e2e
      
      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: test-results
          path: |
            coverage/
            test-results/
            playwright-report/
```

---

## 测试覆盖率

### 覆盖率目标

```javascript
// jest.config.js
coverageThreshold: {
  global: {
    branches: 70,    // 分支覆盖率
    functions: 70,   // 函数覆盖率
    lines: 80,       // 行覆盖率
    statements: 80   // 语句覆盖率
  },
  // 关键模块的特殊要求
  './src/lib/auth.ts': {
    branches: 100,
    functions: 100,
    lines: 100,
    statements: 100
  },
  './src/lib/enterprise/permission-manager.ts': {
    branches: 90,
    functions: 90,
    lines: 90,
    statements: 90
  }
}
```

### 生成覆盖率报告

```bash
# 生成HTML报告
npm run test:coverage

# 查看报告
open coverage/lcov-report/index.html
```

### 覆盖率徽章

在 README.md 中添加:

```markdown
[![Coverage Status](https://codecov.io/gh/yourusername/aicarpool/branch/main/graph/badge.svg)](https://codecov.io/gh/yourusername/aicarpool)
```

---

## 故障排查

### 常见问题

#### 1. 测试数据库连接失败

**问题**: `Error: Can't reach database server`

**解决方案**:
```bash
# 确保MySQL服务运行中
docker-compose up -d mysql

# 检查环境变量
echo $DATABASE_URL

# 手动测试连接
mysql -h localhost -u root -p aicarpool_test
```

#### 2. Mock数据不生效

**问题**: 实际调用了真实的服务而不是mock

**解决方案**:
```typescript
// 确保在导入被测试模块之前设置mock
jest.mock('@/lib/prisma'); // 必须在最顶部

import { myFunction } from '../myModule'; // 在mock之后导入
```

#### 3. 异步测试超时

**问题**: `Timeout - Async callback was not invoked within 5000ms`

**解决方案**:
```typescript
// 增加超时时间
test('long running test', async () => {
  // 测试代码
}, 10000); // 10秒超时

// 或在jest.config.js中全局设置
testTimeout: 10000
```

#### 4. React组件测试找不到元素

**问题**: `Unable to find element with text`

**解决方案**:
```typescript
// 使用正确的查询方法
import { screen, waitFor } from '@testing-library/react';

// 对于异步渲染的元素
await waitFor(() => {
  expect(screen.getByText('Loading...')).toBeInTheDocument();
});

// 使用data-testid
<button data-testid="submit-button">Submit</button>
screen.getByTestId('submit-button');
```

### 调试技巧

1. **使用调试器**
```json
// .vscode/launch.json
{
  "type": "node",
  "request": "launch",
  "name": "Jest Debug",
  "program": "${workspaceFolder}/node_modules/.bin/jest",
  "args": ["--runInBand", "${file}"],
  "console": "integratedTerminal",
  "internalConsoleOptions": "neverOpen"
}
```

2. **打印调试信息**
```typescript
import { screen, debug } from '@testing-library/react';

// 打印整个DOM
debug();

// 打印特定元素
debug(screen.getByRole('button'));
```

3. **运行单个测试**
```bash
# 运行单个文件
npm test -- auth.test.ts

# 运行匹配的测试
npm test -- --testNamePattern="should login"

# 只运行失败的测试
npm test -- --onlyFailures
```

---

## 持续改进

### 测试质量检查清单

- [ ] 测试是否独立运行？
- [ ] 测试名称是否清晰描述了预期行为？
- [ ] 是否测试了边界条件？
- [ ] 是否测试了错误处理？
- [ ] Mock是否最小化？
- [ ] 测试是否快速执行？
- [ ] 测试失败时信息是否有帮助？

### 测试文档维护

定期更新测试文档:
- 新增测试模式和最佳实践
- 记录解决的问题和方案
- 更新依赖版本和配置
- 收集团队反馈并改进流程

---

## 参考资源

- [Jest 官方文档](https://jestjs.io/docs/getting-started)
- [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/)
- [Playwright 文档](https://playwright.dev/docs/intro)
- [k6 性能测试](https://k6.io/docs/)
- [测试最佳实践](https://github.com/goldbergyoni/javascript-testing-best-practices)

---

## 更新日志

- **2024-12-10**: 初始版本，包含基础测试策略和示例
- **待更新**: 添加更多高级测试场景和性能优化技巧

---

*本文档由 AiCarpool 团队维护，如有问题请提交 Issue 或 PR。*
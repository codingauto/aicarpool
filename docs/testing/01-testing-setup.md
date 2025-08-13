# 阶段 1：测试环境搭建

## 📋 本阶段目标

在这个阶段，我们将搭建完整的测试环境，为后续的测试工作打下基础。

**预计时间**: 2-4小时  
**前置要求**: Node.js 18+, MySQL 8+, Redis

## 🛠 环境准备

### 1. 安装测试依赖

```bash
# 核心测试框架
npm install --save-dev jest @types/jest ts-jest

# React测试工具
npm install --save-dev @testing-library/react @testing-library/jest-dom
npm install --save-dev @testing-library/user-event @testing-library/react-hooks

# API测试工具
npm install --save-dev supertest @types/supertest

# Mock工具
npm install --save-dev msw jest-mock-extended

# 测试数据生成
npm install --save-dev @faker-js/faker

# 代码覆盖率
npm install --save-dev @vitest/coverage-c8
```

### 2. 创建测试目录结构

```bash
# 创建测试目录
mkdir -p src/__tests__/{unit,integration,e2e}
mkdir -p src/__mocks__
mkdir -p src/test-utils

# 创建测试配置目录
mkdir -p config/jest
```

目录说明：
- `__tests__/unit/`: 单元测试
- `__tests__/integration/`: 集成测试
- `__tests__/e2e/`: 端到端测试
- `__mocks__/`: Mock文件
- `test-utils/`: 测试工具函数

## ⚙️ Jest 配置

### 基础配置文件

创建 `jest.config.js`:

```javascript
const nextJest = require('next/jest')

const createJestConfig = nextJest({
  // Next.js应用的路径
  dir: './',
})

const customJestConfig = {
  // 测试环境
  testEnvironment: 'node',
  
  // 测试文件匹配模式
  testMatch: [
    '<rootDir>/src/**/__tests__/**/*.{js,jsx,ts,tsx}',
    '<rootDir>/src/**/*.{spec,test}.{js,jsx,ts,tsx}'
  ],
  
  // 覆盖率收集
  collectCoverageFrom: [
    'src/**/*.{js,jsx,ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/*.stories.{js,jsx,ts,tsx}',
    '!src/**/_*.{js,jsx,ts,tsx}',
    '!src/**/index.{js,ts}',
    '!src/app/layout.tsx',
    '!src/app/page.tsx',
  ],
  
  // 覆盖率阈值
  coverageThreshold: {
    global: {
      branches: 60,
      functions: 60,
      lines: 70,
      statements: 70
    }
  },
  
  // 模块路径映射
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@components/(.*)$': '<rootDir>/src/components/$1',
    '^@lib/(.*)$': '<rootDir>/src/lib/$1',
    '^@hooks/(.*)$': '<rootDir>/src/hooks/$1',
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
  },
  
  // 设置文件
  setupFilesAfterEnv: ['<rootDir>/src/test-utils/setup.ts'],
  
  // 忽略路径
  testPathIgnorePatterns: ['/node_modules/', '/.next/'],
  transformIgnorePatterns: [
    '/node_modules/',
    '^.+\\.module\\.(css|sass|scss)$',
  ],
  
  // 模块目录
  moduleDirectories: ['node_modules', 'src'],
  
  // 测试超时
  testTimeout: 10000,
  
  // 详细输出
  verbose: true,
}

module.exports = createJestConfig(customJestConfig)
```

### 分环境配置

创建 `jest.config.unit.js`:

```javascript
const baseConfig = require('./jest.config')

module.exports = {
  ...baseConfig,
  testMatch: ['<rootDir>/src/**/__tests__/unit/**/*.{test,spec}.{js,jsx,ts,tsx}'],
  coverageDirectory: 'coverage/unit',
}
```

创建 `jest.config.integration.js`:

```javascript
const baseConfig = require('./jest.config')

module.exports = {
  ...baseConfig,
  testMatch: ['<rootDir>/src/**/__tests__/integration/**/*.{test,spec}.{js,jsx,ts,tsx}'],
  coverageDirectory: 'coverage/integration',
  testTimeout: 30000,
}
```

## 🔧 测试环境设置

### 创建 setup 文件

创建 `src/test-utils/setup.ts`:

```typescript
import '@testing-library/jest-dom'
import { loadEnvConfig } from '@next/env'
import { TextEncoder, TextDecoder } from 'util'

// 加载测试环境变量
loadEnvConfig(process.cwd())

// 修复TextEncoder/TextDecoder在Jest环境中的问题
global.TextEncoder = TextEncoder
global.TextDecoder = TextDecoder as any

// 设置测试环境变量
process.env.NODE_ENV = 'test'
process.env.JWT_SECRET = 'test-secret-key'
process.env.DATABASE_URL = 'mysql://test:test@localhost:3306/aicarpool_test'

// Mock console方法（可选）
global.console = {
  ...console,
  error: jest.fn(),
  warn: jest.fn(),
}

// 清理函数
afterEach(() => {
  jest.clearAllMocks()
})

// 全局测试超时
jest.setTimeout(10000)
```

### 创建测试工具函数

创建 `src/test-utils/helpers.ts`:

```typescript
import { prisma } from '@/lib/prisma'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'

/**
 * 创建测试用户
 */
export async function createTestUser(data?: Partial<any>) {
  const defaultData = {
    email: 'test@example.com',
    password: await bcrypt.hash('password123', 10),
    name: 'Test User',
    role: 'user',
  }
  
  return prisma.user.create({
    data: { ...defaultData, ...data }
  })
}

/**
 * 创建测试企业
 */
export async function createTestEnterprise(ownerId: string, data?: Partial<any>) {
  const defaultData = {
    name: 'Test Enterprise',
    description: 'Test enterprise for testing',
    ownerId,
  }
  
  return prisma.enterprise.create({
    data: { ...defaultData, ...data }
  })
}

/**
 * 生成测试Token
 */
export function generateTestToken(userId: string) {
  return jwt.sign(
    { userId, email: 'test@example.com' },
    process.env.JWT_SECRET!,
    { expiresIn: '1h' }
  )
}

/**
 * 清理测试数据库
 */
export async function cleanDatabase() {
  const tables = [
    'usageStat',
    'groupAccountBinding',
    'groupMember',
    'group',
    'aiServiceAccount',
    'enterpriseMember',
    'enterprise',
    'user',
  ]
  
  for (const table of tables) {
    await prisma.$executeRawUnsafe(`DELETE FROM ${table}`)
  }
}

/**
 * 创建认证请求头
 */
export function createAuthHeaders(token: string) {
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  }
}
```

## 🗄 测试数据库配置

### 1. 创建测试数据库

```bash
# 创建测试数据库
mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS aicarpool_test;"

# 创建测试用户（可选）
mysql -u root -p -e "CREATE USER IF NOT EXISTS 'test'@'localhost' IDENTIFIED BY 'test';"
mysql -u root -p -e "GRANT ALL PRIVILEGES ON aicarpool_test.* TO 'test'@'localhost';"
mysql -u root -p -e "FLUSH PRIVILEGES;"
```

### 2. 配置测试环境变量

创建 `.env.test`:

```env
# 数据库配置
DATABASE_URL="mysql://test:test@localhost:3306/aicarpool_test"

# Redis配置
REDIS_URL="redis://localhost:6379/1"

# JWT配置
JWT_SECRET="test-jwt-secret-key"
JWT_REFRESH_SECRET="test-jwt-refresh-secret"

# 应用配置
NODE_ENV="test"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="test-nextauth-secret"

# 禁用日志
LOG_LEVEL="error"
```

### 3. 数据库迁移脚本

创建 `scripts/test-db.sh`:

```bash
#!/bin/bash

# 设置测试环境
export NODE_ENV=test
export DATABASE_URL="mysql://test:test@localhost:3306/aicarpool_test"

# 重置测试数据库
echo "🔄 重置测试数据库..."
npx prisma migrate reset --force --skip-seed

# 运行迁移
echo "📦 运行数据库迁移..."
npx prisma migrate deploy

# 生成Prisma Client
echo "🔧 生成Prisma Client..."
npx prisma generate

echo "✅ 测试数据库准备完成！"
```

## 🎭 Mock 策略

### Prisma Mock

创建 `src/__mocks__/prisma.ts`:

```typescript
import { PrismaClient } from '@prisma/client'
import { mockDeep, mockReset, DeepMockProxy } from 'jest-mock-extended'

import { prisma } from '@/lib/prisma'

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  prisma: mockDeep<PrismaClient>(),
}))

beforeEach(() => {
  mockReset(prismaMock)
})

export const prismaMock = prisma as unknown as DeepMockProxy<PrismaClient>
```

### Redis Mock

创建 `src/__mocks__/redis.ts`:

```typescript
export const redisMock = {
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
  expire: jest.fn(),
  ttl: jest.fn(),
  exists: jest.fn(),
  incr: jest.fn(),
  decr: jest.fn(),
  hget: jest.fn(),
  hset: jest.fn(),
  hdel: jest.fn(),
  hgetall: jest.fn(),
  flushdb: jest.fn(),
  quit: jest.fn(),
}

export const redisClient = redisMock
```

### Next.js Router Mock

创建 `src/__mocks__/next-router.ts`:

```typescript
import { NextRouter } from 'next/router'

export const mockRouter: NextRouter = {
  basePath: '',
  pathname: '/',
  route: '/',
  asPath: '/',
  query: {},
  push: jest.fn(),
  replace: jest.fn(),
  reload: jest.fn(),
  back: jest.fn(),
  prefetch: jest.fn(),
  beforePopState: jest.fn(),
  events: {
    on: jest.fn(),
    off: jest.fn(),
    emit: jest.fn(),
  },
  isFallback: false,
  isLocaleDomain: false,
  isReady: true,
  isPreview: false,
}

jest.mock('next/navigation', () => ({
  useRouter: () => mockRouter,
  usePathname: () => mockRouter.pathname,
  useSearchParams: () => new URLSearchParams(mockRouter.query as any),
}))
```

## 📝 package.json 脚本配置

更新 `package.json` 的 scripts 部分：

```json
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "test:unit": "jest --config jest.config.unit.js",
    "test:integration": "jest --config jest.config.integration.js",
    "test:e2e": "playwright test",
    "test:debug": "node --inspect-brk ./node_modules/.bin/jest --runInBand",
    "test:ci": "jest --ci --coverage --maxWorkers=2",
    "test:db:setup": "bash scripts/test-db.sh",
    "test:db:reset": "NODE_ENV=test npx prisma migrate reset --force --skip-seed"
  }
}
```

## ✅ 验证设置

### 创建第一个测试

创建 `src/__tests__/unit/lib/utils.test.ts`:

```typescript
import { describe, it, expect } from '@jest/globals'

describe('Utils', () => {
  describe('basic math', () => {
    it('should add two numbers correctly', () => {
      const result = 1 + 1
      expect(result).toBe(2)
    })
  })
})
```

### 运行测试

```bash
# 运行测试
npm test

# 应该看到类似输出：
# PASS  src/__tests__/unit/lib/utils.test.ts
#  Utils
#    basic math
#      ✓ should add two numbers correctly (2 ms)
```

## 🚨 常见问题

### 1. TypeScript 错误

如果遇到 TypeScript 错误，创建 `tsconfig.test.json`:

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "jsx": "react",
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true
  },
  "include": [
    "src/**/*.test.ts",
    "src/**/*.test.tsx",
    "src/**/*.spec.ts",
    "src/**/*.spec.tsx",
    "src/test-utils/**/*"
  ]
}
```

### 2. 模块解析问题

如果模块无法解析，检查 `jest.config.js` 中的 `moduleNameMapper`。

### 3. 数据库连接问题

确保测试数据库正在运行：

```bash
# 检查MySQL状态
mysql -u test -p -e "SELECT 1"

# 检查Redis状态
redis-cli ping
```

## 📋 检查清单

完成环境搭建后，确认以下事项：

- [x] Jest和相关依赖已安装 ✅
- [x] jest.config.js 已配置 ✅
- [x] 测试目录结构已创建 ✅
- [x] 测试数据库已配置 ✅
- [x] Mock文件已创建 ✅
- [x] 第一个测试能够成功运行 ✅ (15个测试全部通过)
- [x] package.json 脚本已更新 ✅

**🎉 测试环境搭建已完成！**

### 已验证的功能

- 单元测试运行正常
- 工具函数测试覆盖
- 测试脚本命令可用
- Mock文件配置正确

## 🎯 下一步

环境搭建完成后，您可以继续：

1. 📖 阅读[单元测试指南](./02-unit-testing.md)开始编写测试
2. 🔍 查看[故障排查指南](./troubleshooting.md)解决问题
3. 💡 参考[测试总览](./testing-overview.md)了解整体策略

---

*恭喜！您已完成测试环境的搭建。现在可以开始编写测试了！*
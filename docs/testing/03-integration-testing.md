# 阶段 3：集成测试指南

## 📋 本阶段目标

学习如何测试 API 端点、数据库操作、服务间交互等集成场景，确保各模块协同工作正常。

**预计时间**: 1-2周  
**前置要求**: 完成[单元测试](./02-unit-testing.md)

## 🎯 集成测试概述

集成测试验证多个组件协同工作的正确性：

- API 路由的完整请求/响应流程
- 数据库的 CRUD 操作
- 认证和授权流程
- 第三方服务集成
- 缓存机制

## 🌐 API 路由测试

### 基础 API 测试设置

创建 `src/__tests__/integration/api/setup.ts`:

```typescript
import { createMocks } from 'node-mocks-http'
import { prisma } from '@/lib/prisma'
import jwt from 'jsonwebtoken'

// 测试数据库事务
export async function withTransaction(fn: () => Promise<void>) {
  await prisma.$transaction(async (tx) => {
    await fn()
    throw new Error('Rollback transaction')
  }).catch(e => {
    if (e.message !== 'Rollback transaction') throw e
  })
}

// 创建模拟请求
export function createMockRequest(options: any = {}) {
  const { req, res } = createMocks(options)
  return { req: new Request(req), res }
}

// 生成测试Token
export function generateTestToken(userId: string, role: string = 'user') {
  return jwt.sign(
    { userId, role },
    process.env.JWT_SECRET!,
    { expiresIn: '1h' }
  )
}

// 清理测试数据
export async function cleanupTestData(prefix: string) {
  await prisma.user.deleteMany({
    where: { email: { contains: prefix } }
  })
}
```

### 认证 API 测试

创建 `src/__tests__/integration/api/auth/login.test.ts`:

```typescript
import { POST } from '@/app/api/auth/login/route'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { cleanupTestData } from '../setup'

describe('POST /api/auth/login', () => {
  const testEmail = 'test.login@example.com'
  
  beforeAll(async () => {
    // 创建测试用户
    await prisma.user.create({
      data: {
        email: testEmail,
        password: await bcrypt.hash('Test123!', 10),
        name: 'Test User',
        role: 'user',
      }
    })
  })
  
  afterAll(async () => {
    await cleanupTestData('test.login')
  })
  
  it('should login with valid credentials', async () => {
    const request = new Request('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail,
        password: 'Test123!'
      })
    })
    
    const response = await POST(request)
    const data = await response.json()
    
    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.data.token).toBeDefined()
    expect(data.data.refreshToken).toBeDefined()
    expect(data.data.user.email).toBe(testEmail)
  })
  
  it('should reject invalid password', async () => {
    const request = new Request('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail,
        password: 'WrongPassword'
      })
    })
    
    const response = await POST(request)
    const data = await response.json()
    
    expect(response.status).toBe(401)
    expect(data.success).toBe(false)
    expect(data.message).toContain('Invalid')
  })
  
  it('should handle rate limiting', async () => {
    const request = new Request('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'X-Forwarded-For': '192.168.1.100'
      },
      body: JSON.stringify({
        email: testEmail,
        password: 'WrongPassword'
      })
    })
    
    // 多次失败尝试
    for (let i = 0; i < 5; i++) {
      await POST(request)
    }
    
    // 第6次应该被限制
    const response = await POST(request)
    const data = await response.json()
    
    expect(response.status).toBe(429)
    expect(data.message).toContain('Too many attempts')
  })
})
```

### 企业管理 API 测试

创建 `src/__tests__/integration/api/enterprises/crud.test.ts`:

```typescript
import { GET, POST, PATCH, DELETE } from '@/app/api/enterprises/[enterpriseId]/route'
import { prisma } from '@/lib/prisma'
import { generateTestToken, cleanupTestData } from '../setup'

describe('Enterprise API', () => {
  let userId: string
  let token: string
  let enterpriseId: string
  
  beforeAll(async () => {
    // 创建测试用户
    const user = await prisma.user.create({
      data: {
        email: 'test.enterprise@example.com',
        password: 'hashed',
        name: 'Enterprise Owner',
        role: 'user',
      }
    })
    
    userId = user.id
    token = generateTestToken(userId)
  })
  
  afterAll(async () => {
    if (enterpriseId) {
      await prisma.enterprise.delete({ where: { id: enterpriseId } })
    }
    await cleanupTestData('test.enterprise')
  })
  
  describe('POST /api/enterprises', () => {
    it('should create enterprise', async () => {
      const request = new Request('http://localhost:3000/api/enterprises', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: 'Test Enterprise',
          description: 'Test enterprise for integration testing',
        })
      })
      
      const response = await POST(request)
      const data = await response.json()
      
      expect(response.status).toBe(201)
      expect(data.success).toBe(true)
      expect(data.data.name).toBe('Test Enterprise')
      expect(data.data.ownerId).toBe(userId)
      
      enterpriseId = data.data.id
    })
    
    it('should require authentication', async () => {
      const request = new Request('http://localhost:3000/api/enterprises', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Unauthorized Enterprise',
        })
      })
      
      const response = await POST(request)
      expect(response.status).toBe(401)
    })
  })
  
  describe('GET /api/enterprises/[id]', () => {
    it('should get enterprise details', async () => {
      const request = new Request(
        `http://localhost:3000/api/enterprises/${enterpriseId}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      )
      
      const response = await GET(request, { params: { enterpriseId } })
      const data = await response.json()
      
      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.id).toBe(enterpriseId)
      expect(data.data.members).toBeDefined()
      expect(data.data.groups).toBeDefined()
    })
    
    it('should enforce access control', async () => {
      // 创建另一个用户
      const otherUser = await prisma.user.create({
        data: {
          email: 'other.user@example.com',
          password: 'hashed',
          name: 'Other User',
        }
      })
      
      const otherToken = generateTestToken(otherUser.id)
      
      const request = new Request(
        `http://localhost:3000/api/enterprises/${enterpriseId}`,
        {
          headers: {
            'Authorization': `Bearer ${otherToken}`
          }
        }
      )
      
      const response = await GET(request, { params: { enterpriseId } })
      expect(response.status).toBe(403)
      
      // 清理
      await prisma.user.delete({ where: { id: otherUser.id } })
    })
  })
})
```

## 🗄 数据库测试

### 事务测试

创建 `src/__tests__/integration/db/transactions.test.ts`:

```typescript
import { prisma } from '@/lib/prisma'
import { createEnterpriseWithDefaults } from '@/lib/services/enterprise-service'

describe('Database Transactions', () => {
  it('should rollback on error', async () => {
    const userEmail = 'test.transaction@example.com'
    
    try {
      await prisma.$transaction(async (tx) => {
        // 创建用户
        const user = await tx.user.create({
          data: {
            email: userEmail,
            password: 'hashed',
            name: 'Transaction Test',
          }
        })
        
        // 创建企业
        await tx.enterprise.create({
          data: {
            name: 'Transaction Enterprise',
            ownerId: user.id,
          }
        })
        
        // 模拟错误
        throw new Error('Simulated error')
      })
    } catch (error) {
      // 事务应该回滚
    }
    
    // 验证数据未被创建
    const user = await prisma.user.findUnique({
      where: { email: userEmail }
    })
    
    expect(user).toBeNull()
  })
  
  it('should handle concurrent updates', async () => {
    // 创建测试账号
    const account = await prisma.aiServiceAccount.create({
      data: {
        name: 'Concurrent Test',
        platform: 'claude',
        enterpriseId: 'test-enterprise',
        currentLoad: 0,
      }
    })
    
    // 并发更新
    const updates = Array(10).fill(null).map(() =>
      prisma.aiServiceAccount.update({
        where: { id: account.id },
        data: { currentLoad: { increment: 1 } }
      })
    )
    
    await Promise.all(updates)
    
    // 验证最终值
    const updated = await prisma.aiServiceAccount.findUnique({
      where: { id: account.id }
    })
    
    expect(updated?.currentLoad).toBe(10)
    
    // 清理
    await prisma.aiServiceAccount.delete({ where: { id: account.id } })
  })
})
```

### 查询性能测试

创建 `src/__tests__/integration/db/performance.test.ts`:

```typescript
import { prisma } from '@/lib/prisma'
import { performance } from 'perf_hooks'

describe('Database Performance', () => {
  it('should use indexes efficiently', async () => {
    const start = performance.now()
    
    // 复杂查询，应该使用索引
    const results = await prisma.aiServiceAccount.findMany({
      where: {
        enterpriseId: 'test-enterprise',
        platform: 'claude',
        isEnabled: true,
        status: 'active',
      },
      include: {
        groupBindings: {
          include: {
            group: true
          }
        }
      },
      take: 10
    })
    
    const duration = performance.now() - start
    
    // 查询应该在100ms内完成
    expect(duration).toBeLessThan(100)
  })
  
  it('should handle pagination efficiently', async () => {
    const pageSize = 20
    const page = 1
    
    const start = performance.now()
    
    const [items, total] = await prisma.$transaction([
      prisma.user.findMany({
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' }
      }),
      prisma.user.count()
    ])
    
    const duration = performance.now() - start
    
    expect(duration).toBeLessThan(50)
    expect(items.length).toBeLessThanOrEqual(pageSize)
  })
})
```

## 🔄 服务集成测试

### AI 服务适配器测试

创建 `src/__tests__/integration/services/ai-adapter.test.ts`:

```typescript
import { ClaudeAdapter } from '@/lib/ai-platforms/adapters/claude-adapter'
import { GeminiAdapter } from '@/lib/ai-platforms/adapters/gemini-adapter'
import nock from 'nock'

describe('AI Service Adapters', () => {
  describe('ClaudeAdapter', () => {
    let adapter: ClaudeAdapter
    
    beforeEach(() => {
      adapter = new ClaudeAdapter({
        apiKey: 'test-api-key',
        apiUrl: 'https://api.claude.ai',
      })
    })
    
    afterEach(() => {
      nock.cleanAll()
    })
    
    it('should send chat request correctly', async () => {
      // Mock API response
      nock('https://api.claude.ai')
        .post('/v1/messages')
        .reply(200, {
          id: 'msg-123',
          content: [{ text: 'Hello! How can I help?' }],
          usage: { input_tokens: 10, output_tokens: 20 }
        })
      
      const response = await adapter.chat({
        messages: [
          { role: 'user', content: 'Hello' }
        ],
        model: 'claude-3-opus',
      })
      
      expect(response.success).toBe(true)
      expect(response.data?.content).toContain('Hello')
      expect(response.data?.usage.totalTokens).toBe(30)
    })
    
    it('should handle API errors', async () => {
      nock('https://api.claude.ai')
        .post('/v1/messages')
        .reply(429, {
          error: { message: 'Rate limit exceeded' }
        })
      
      const response = await adapter.chat({
        messages: [{ role: 'user', content: 'Hello' }],
        model: 'claude-3-opus',
      })
      
      expect(response.success).toBe(false)
      expect(response.error).toContain('Rate limit')
    })
    
    it('should retry on transient errors', async () => {
      let attempts = 0
      
      nock('https://api.claude.ai')
        .post('/v1/messages')
        .times(2)
        .reply(() => {
          attempts++
          if (attempts === 1) {
            return [503, { error: 'Service unavailable' }]
          }
          return [200, {
            id: 'msg-123',
            content: [{ text: 'Success after retry' }]
          }]
        })
      
      const response = await adapter.chat({
        messages: [{ role: 'user', content: 'Hello' }],
        model: 'claude-3-opus',
      })
      
      expect(response.success).toBe(true)
      expect(attempts).toBe(2)
    })
  })
})
```

### 缓存集成测试

创建 `src/__tests__/integration/services/cache.test.ts`:

```typescript
import { CacheService } from '@/lib/cache/cache-service'
import { redisClient } from '@/lib/redis'

describe('Cache Service', () => {
  let cacheService: CacheService
  
  beforeAll(() => {
    cacheService = new CacheService(redisClient)
  })
  
  afterEach(async () => {
    await redisClient.flushdb()
  })
  
  it('should cache and retrieve data', async () => {
    const key = 'test:user:123'
    const data = { id: '123', name: 'Test User' }
    
    // 设置缓存
    await cacheService.set(key, data, 60)
    
    // 获取缓存
    const cached = await cacheService.get(key)
    
    expect(cached).toEqual(data)
  })
  
  it('should expire cache after TTL', async () => {
    const key = 'test:expire'
    const data = { value: 'test' }
    
    // 设置1秒过期
    await cacheService.set(key, data, 1)
    
    // 立即获取应该成功
    let cached = await cacheService.get(key)
    expect(cached).toEqual(data)
    
    // 等待过期
    await new Promise(resolve => setTimeout(resolve, 1100))
    
    // 应该返回null
    cached = await cacheService.get(key)
    expect(cached).toBeNull()
  })
  
  it('should handle cache stampede', async () => {
    const key = 'test:stampede'
    let computeCount = 0
    
    const compute = async () => {
      computeCount++
      await new Promise(resolve => setTimeout(resolve, 100))
      return { value: 'computed' }
    }
    
    // 并发请求
    const requests = Array(10).fill(null).map(() =>
      cacheService.getOrCompute(key, compute, 60)
    )
    
    const results = await Promise.all(requests)
    
    // 所有请求应该得到相同结果
    results.forEach(result => {
      expect(result).toEqual({ value: 'computed' })
    })
    
    // compute 应该只执行一次
    expect(computeCount).toBe(1)
  })
})
```

## 🔐 认证授权流程测试

创建 `src/__tests__/integration/auth/flow.test.ts`:

```typescript
import { authService } from '@/lib/api/auth-service'
import { prisma } from '@/lib/prisma'

describe('Authentication Flow', () => {
  const testEmail = 'test.flow@example.com'
  let userId: string
  let accessToken: string
  let refreshToken: string
  
  it('should complete full auth flow', async () => {
    // 1. 注册
    const registerResult = await authService.register({
      email: testEmail,
      password: 'Test123!',
      name: 'Flow Test',
    })
    
    expect(registerResult.success).toBe(true)
    userId = registerResult.data.user.id
    
    // 2. 登录
    const loginResult = await authService.login({
      email: testEmail,
      password: 'Test123!',
    })
    
    expect(loginResult.success).toBe(true)
    accessToken = loginResult.data.token
    refreshToken = loginResult.data.refreshToken
    
    // 3. 获取当前用户
    const user = await authService.getCurrentUser(accessToken)
    expect(user.email).toBe(testEmail)
    
    // 4. 刷新Token
    const refreshResult = await authService.refreshToken(refreshToken)
    expect(refreshResult.success).toBe(true)
    expect(refreshResult.data.token).not.toBe(accessToken)
    
    // 5. 修改密码
    const changePasswordResult = await authService.changePassword(
      refreshResult.data.token,
      'Test123!',
      'NewTest123!'
    )
    expect(changePasswordResult.success).toBe(true)
    
    // 6. 使用新密码登录
    const newLoginResult = await authService.login({
      email: testEmail,
      password: 'NewTest123!',
    })
    expect(newLoginResult.success).toBe(true)
    
    // 清理
    await prisma.user.delete({ where: { id: userId } })
  })
})
```

## 📊 测试数据管理

### Seed 脚本

创建 `src/__tests__/integration/seed.ts`:

```typescript
import { prisma } from '@/lib/prisma'
import { faker } from '@faker-js/faker'
import bcrypt from 'bcryptjs'

export async function seedTestData() {
  // 创建测试用户
  const users = await Promise.all(
    Array(5).fill(null).map(async () => {
      return prisma.user.create({
        data: {
          email: faker.internet.email(),
          password: await bcrypt.hash('Test123!', 10),
          name: faker.person.fullName(),
          role: faker.helpers.arrayElement(['user', 'admin']),
        }
      })
    })
  )
  
  // 创建测试企业
  const enterprises = await Promise.all(
    users.slice(0, 2).map(user => {
      return prisma.enterprise.create({
        data: {
          name: faker.company.name(),
          description: faker.lorem.paragraph(),
          ownerId: user.id,
        }
      })
    })
  )
  
  // 创建AI账号
  for (const enterprise of enterprises) {
    await Promise.all(
      Array(3).fill(null).map(() => {
        return prisma.aiServiceAccount.create({
          data: {
            name: faker.lorem.words(2),
            platform: faker.helpers.arrayElement(['claude', 'gemini', 'openai']),
            enterpriseId: enterprise.id,
            authType: 'api_key',
            isEnabled: true,
            status: 'active',
          }
        })
      })
    )
  }
  
  return { users, enterprises }
}

export async function clearTestData() {
  await prisma.$transaction([
    prisma.usageStat.deleteMany(),
    prisma.groupAccountBinding.deleteMany(),
    prisma.groupMember.deleteMany(),
    prisma.group.deleteMany(),
    prisma.aiServiceAccount.deleteMany(),
    prisma.enterpriseMember.deleteMany(),
    prisma.enterprise.deleteMany(),
    prisma.user.deleteMany(),
  ])
}
```

## 📋 检查清单

完成集成测试后确认：

- [ ] API端点测试完成
- [ ] 数据库操作测试完成
- [ ] 服务集成测试完成
- [ ] 认证流程测试完成
- [ ] 测试数据管理就绪
- [ ] 所有测试可独立运行

## 🎯 下一步

1. 📖 阅读[E2E测试指南](./04-e2e-testing.md)
2. 📊 了解[性能测试](./05-performance-testing.md)
3. 🔧 配置[CI/CD集成](./06-ci-cd-integration.md)

---

*集成测试确保各模块协同工作。保持测试独立性，避免测试间依赖！*
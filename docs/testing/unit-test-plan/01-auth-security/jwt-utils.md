# JWT工具函数测试计划

## 📋 模块概述

**文件路径**: `src/lib/auth/jwt-utils.ts`

**功能描述**: 
JWT工具模块负责处理所有JWT令牌相关操作，包括生成、验证、刷新和解码。这是系统认证的核心组件，直接影响用户身份验证和会话管理。

**重要性**: 🔴 **极高** - 安全关键模块，任何缺陷可能导致认证绕过或未授权访问

## 🎯 测试范围

### 需要测试的函数

| 函数名 | 优先级 | 功能描述 |
|--------|--------|----------|
| `generateToken()` | 高 | 生成JWT访问令牌 |
| `verifyToken()` | 高 | 验证JWT令牌有效性 |
| `decodeToken()` | 中 | 解码JWT令牌（不验证） |
| `generateTokenPair()` | 高 | 生成访问/刷新令牌对 |
| `refreshAccessToken()` | 高 | 使用刷新令牌获取新访问令牌 |
| `verifyRefreshToken()` | 高 | 验证刷新令牌 |
| `revokeToken()` | 中 | 撤销令牌（黑名单） |
| `extractUserId()` | 低 | 从令牌提取用户ID |

## 📝 详细测试用例

### 1. generateToken() 测试

```typescript
describe('generateToken', () => {
  // 正常场景
  it('应该生成有效的JWT令牌', () => {
    // 输入: 用户payload
    // 期望: 返回符合JWT格式的字符串
  });

  it('应该包含所有必要的payload字段', () => {
    // 输入: 完整的用户信息
    // 期望: 令牌包含userId, email, role, enterpriseId
  });

  it('应该设置正确的过期时间', () => {
    // 输入: 自定义过期时间
    // 期望: 令牌在指定时间后过期
  });

  // 边界条件
  it('应该处理空payload', () => {
    // 输入: 空对象
    // 期望: 抛出错误或返回基础令牌
  });

  it('应该处理超长payload', () => {
    // 输入: 大量数据
    // 期望: 正常生成或限制大小
  });

  // 安全测试
  it('不应该在令牌中包含敏感信息', () => {
    // 输入: 包含密码的payload
    // 期望: 过滤敏感字段
  });
});
```

### 2. verifyToken() 测试

```typescript
describe('verifyToken', () => {
  // 正常场景
  it('应该成功验证有效令牌', () => {
    // 输入: 刚生成的有效令牌
    // 期望: 返回解码的payload
  });

  it('应该拒绝过期令牌', () => {
    // 输入: 过期的令牌
    // 期望: 返回null或抛出错误
  });

  it('应该拒绝篡改的令牌', () => {
    // 输入: 修改过的令牌
    // 期望: 验证失败
  });

  // 错误处理
  it('应该处理无效的令牌格式', () => {
    // 输入: 格式错误的字符串
    // 期望: 返回null，不崩溃
  });

  it('应该处理错误的签名', () => {
    // 输入: 使用错误密钥签名的令牌
    // 期望: 验证失败
  });

  // 性能测试
  it('应该在合理时间内验证令牌', () => {
    // 输入: 1000个令牌
    // 期望: < 100ms完成
  });
});
```

### 3. generateTokenPair() 测试

```typescript
describe('generateTokenPair', () => {
  it('应该生成访问和刷新令牌', () => {
    // 期望: 返回包含两个令牌的对象
  });

  it('刷新令牌应该比访问令牌有效期长', () => {
    // 期望: refreshToken过期时间 > accessToken过期时间
  });

  it('两个令牌应该包含相同的用户信息', () => {
    // 期望: 解码后userId一致
  });
});
```

### 4. refreshAccessToken() 测试

```typescript
describe('refreshAccessToken', () => {
  it('应该使用有效刷新令牌生成新访问令牌', () => {
    // 输入: 有效的refreshToken
    // 期望: 返回新的accessToken
  });

  it('应该保持用户信息不变', () => {
    // 期望: 新令牌包含相同的userId和role
  });

  it('应该更新令牌的签发时间', () => {
    // 期望: iat字段更新
  });

  it('应该拒绝已撤销的刷新令牌', () => {
    // 输入: 黑名单中的令牌
    // 期望: 拒绝刷新
  });
});
```

## 🔧 Mock策略

### 需要Mock的依赖

1. **环境变量**
   ```typescript
   process.env.JWT_SECRET = 'test-secret';
   process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
   ```

2. **Prisma客户端**
   ```typescript
   jest.mock('@/lib/prisma', () => ({
     prisma: {
       user: {
         findUnique: jest.fn(),
         update: jest.fn()
       },
       tokenBlacklist: {
         create: jest.fn(),
         findFirst: jest.fn()
       }
     }
   }));
   ```

3. **Redis客户端**
   ```typescript
   jest.mock('@/lib/redis', () => ({
     redisClient: {
       set: jest.fn(),
       get: jest.fn(),
       del: jest.fn(),
       expire: jest.fn()
     }
   }));
   ```

## 🔍 边界条件和错误处理

### 边界条件测试

1. **时间边界**
   - 令牌刚好过期的瞬间
   - 令牌即将过期（< 1分钟）
   - 系统时间被修改的情况

2. **数据边界**
   - 空字符串输入
   - 超长字符串（> 8KB）
   - 特殊字符和Unicode

3. **并发边界**
   - 同时验证多个令牌
   - 令牌刷新竞态条件

### 错误场景

```typescript
describe('错误处理', () => {
  it('应该优雅处理密钥丢失', () => {
    // 删除JWT_SECRET
    // 期望: 明确的错误信息
  });

  it('应该处理base64解码错误', () => {
    // 输入: 格式错误的base64
    // 期望: 返回null，记录错误
  });

  it('应该处理JSON解析错误', () => {
    // 输入: 无效的JSON payload
    // 期望: 安全失败
  });
});
```

## ⚡ 性能测试

```typescript
describe('性能测试', () => {
  it('生成令牌应该 < 10ms', async () => {
    const start = Date.now();
    generateToken(payload);
    expect(Date.now() - start).toBeLessThan(10);
  });

  it('验证令牌应该 < 5ms', async () => {
    const token = generateToken(payload);
    const start = Date.now();
    verifyToken(token);
    expect(Date.now() - start).toBeLessThan(5);
  });

  it('应该能处理高并发', async () => {
    const promises = Array(1000).fill(null).map(() => 
      generateToken(payload)
    );
    const results = await Promise.all(promises);
    expect(results).toHaveLength(1000);
  });
});
```

## ✅ 验收标准

### 覆盖率要求
- 语句覆盖率: ≥ 95%
- 分支覆盖率: ≥ 90%
- 函数覆盖率: 100%
- 行覆盖率: ≥ 95%

### 质量标准
- 所有测试必须独立运行
- 测试执行时间 < 500ms
- 无硬编码的密钥或令牌
- 包含正常、异常、边界场景

### 安全要求
- 测试不能泄露真实密钥
- 必须测试令牌篡改场景
- 验证过期时间处理
- 测试撤销机制

## 📚 测试数据准备

```typescript
// test-data/jwt-test-data.ts
export const testUsers = {
  normal: {
    userId: 'user-123',
    email: 'test@example.com',
    role: 'user',
    enterpriseId: 'ent-456'
  },
  admin: {
    userId: 'admin-789',
    email: 'admin@example.com',
    role: 'admin',
    enterpriseId: 'ent-456'
  }
};

export const testTokens = {
  valid: 'eyJhbGciOiJIUzI1NiIs...',
  expired: 'eyJhbGciOiJIUzI1NiIs...',
  invalid: 'invalid.token.string',
  tampered: 'eyJhbGciOiJIUzI1NiIs...'
};
```

## 🚀 实施步骤

1. **第1天**: 编写基础测试结构和Mock设置
2. **第2天**: 实现generateToken和verifyToken测试
3. **第3天**: 实现令牌对和刷新逻辑测试
4. **第4天**: 添加边界条件和错误处理测试
5. **第5天**: 性能测试和优化

## 📈 风险和缓解

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| 密钥泄露 | 高 | 使用环境变量，不硬编码 |
| 时间依赖 | 中 | 使用jest.useFakeTimers() |
| 并发问题 | 中 | 添加并发测试场景 |
| Mock复杂度 | 低 | 创建可重用的Mock工具 |

---

*创建日期: 2025-01-12*
*负责人: 认证测试小组*
*下次评审: 2025-01-19*
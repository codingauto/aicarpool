# 阶段 2：单元测试指南

## 📋 本阶段目标

学习如何为 AiCarpool 项目编写高质量的单元测试，覆盖工具函数、React组件、自定义Hooks等核心模块。

**预计时间**: 1-2周  
**前置要求**: 完成[环境搭建](./01-testing-setup.md)

## 🎯 单元测试原则

### 什么是好的单元测试？

1. **快速** - 毫秒级执行
2. **独立** - 不依赖外部资源
3. **可重复** - 结果一致
4. **自验证** - 明确的通过/失败
5. **及时** - 与代码同步编写

### AAA 模式

```typescript
test('描述性的测试名称', () => {
  // Arrange - 准备数据
  const input = { /* ... */ }
  
  // Act - 执行操作
  const result = functionUnderTest(input)
  
  // Assert - 验证结果
  expect(result).toBe(expectedValue)
})
```

## 🔨 工具函数测试

### 示例：认证工具测试

创建 `src/__tests__/unit/lib/auth.test.ts`:

```typescript
import { describe, it, expect, beforeEach, jest } from '@jest/globals'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { 
  hashPassword, 
  verifyPassword, 
  generateToken, 
  verifyToken 
} from '@/lib/auth'

describe('Auth Utils', () => {
  describe('hashPassword', () => {
    it('should hash password correctly', async () => {
      const password = 'Test123!'
      const hashed = await hashPassword(password)
      
      expect(hashed).not.toBe(password)
      expect(hashed).toHaveLength(60) // bcrypt hash length
    })
    
    it('should generate different hashes for same password', async () => {
      const password = 'Test123!'
      const hash1 = await hashPassword(password)
      const hash2 = await hashPassword(password)
      
      expect(hash1).not.toBe(hash2)
    })
  })
  
  describe('verifyPassword', () => {
    it('should verify correct password', async () => {
      const password = 'Test123!'
      const hashed = await bcrypt.hash(password, 10)
      
      const isValid = await verifyPassword(password, hashed)
      expect(isValid).toBe(true)
    })
    
    it('should reject incorrect password', async () => {
      const password = 'Test123!'
      const wrongPassword = 'Wrong123!'
      const hashed = await bcrypt.hash(password, 10)
      
      const isValid = await verifyPassword(wrongPassword, hashed)
      expect(isValid).toBe(false)
    })
  })
  
  describe('generateToken', () => {
    it('should generate valid JWT token', () => {
      const userId = 'user-123'
      const token = generateToken(userId)
      
      expect(token).toBeDefined()
      expect(token.split('.')).toHaveLength(3) // JWT structure
    })
    
    it('should include user ID in payload', () => {
      const userId = 'user-123'
      const token = generateToken(userId)
      
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any
      expect(decoded.userId).toBe(userId)
    })
  })
  
  describe('verifyToken', () => {
    it('should verify valid token', async () => {
      const userId = 'user-123'
      const token = jwt.sign(
        { userId },
        process.env.JWT_SECRET!,
        { expiresIn: '1h' }
      )
      
      const decoded = await verifyToken(token)
      expect(decoded.userId).toBe(userId)
    })
    
    it('should reject expired token', async () => {
      const token = jwt.sign(
        { userId: 'user-123' },
        process.env.JWT_SECRET!,
        { expiresIn: '-1h' } // Already expired
      )
      
      await expect(verifyToken(token)).rejects.toThrow('Token expired')
    })
    
    it('should reject invalid token', async () => {
      const invalidToken = 'invalid.token.here'
      
      await expect(verifyToken(invalidToken)).rejects.toThrow()
    })
  })
})
```

### 示例：验证工具测试

创建 `src/__tests__/unit/lib/validators.test.ts`:

```typescript
import { describe, it, expect } from '@jest/globals'
import { 
  validateEmail, 
  validatePassword, 
  validatePhoneNumber,
  sanitizeInput 
} from '@/lib/validators'

describe('Validators', () => {
  describe('validateEmail', () => {
    it.each([
      ['valid@example.com', true],
      ['user.name@company.co.uk', true],
      ['invalid', false],
      ['@example.com', false],
      ['user@', false],
      ['', false],
    ])('validateEmail(%s) should return %s', (email, expected) => {
      expect(validateEmail(email)).toBe(expected)
    })
  })
  
  describe('validatePassword', () => {
    it('should accept valid password', () => {
      const result = validatePassword('Test123!@#')
      expect(result.isValid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })
    
    it('should reject short password', () => {
      const result = validatePassword('Test1!')
      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Password must be at least 8 characters')
    })
    
    it('should require special character', () => {
      const result = validatePassword('Test1234')
      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Password must contain special character')
    })
  })
  
  describe('sanitizeInput', () => {
    it('should remove HTML tags', () => {
      const input = '<script>alert("xss")</script>Hello'
      const sanitized = sanitizeInput(input)
      expect(sanitized).toBe('Hello')
    })
    
    it('should trim whitespace', () => {
      const input = '  hello world  '
      const sanitized = sanitizeInput(input)
      expect(sanitized).toBe('hello world')
    })
  })
})
```

## ⚛️ React 组件测试

### 示例：表单组件测试

创建 `src/__tests__/unit/components/auth/LoginForm.test.tsx`:

```typescript
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LoginForm } from '@/components/auth/login-form'
import { useRouter } from 'next/navigation'
import { authService } from '@/lib/api/auth-service'

// Mock dependencies
jest.mock('next/navigation')
jest.mock('@/lib/api/auth-service')

describe('LoginForm', () => {
  const mockPush = jest.fn()
  const mockLogin = authService.login as jest.MockedFunction<typeof authService.login>
  
  beforeEach(() => {
    jest.clearAllMocks()
    ;(useRouter as jest.Mock).mockReturnValue({
      push: mockPush,
    })
  })
  
  it('should render login form elements', () => {
    render(<LoginForm />)
    
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /login/i })).toBeInTheDocument()
    expect(screen.getByText(/forgot password/i)).toBeInTheDocument()
  })
  
  it('should show validation errors for empty fields', async () => {
    const user = userEvent.setup()
    render(<LoginForm />)
    
    const submitButton = screen.getByRole('button', { name: /login/i })
    await user.click(submitButton)
    
    expect(screen.getByText(/email is required/i)).toBeInTheDocument()
    expect(screen.getByText(/password is required/i)).toBeInTheDocument()
  })
  
  it('should validate email format', async () => {
    const user = userEvent.setup()
    render(<LoginForm />)
    
    const emailInput = screen.getByLabelText(/email/i)
    await user.type(emailInput, 'invalid-email')
    await user.tab() // Trigger blur event
    
    expect(screen.getByText(/invalid email format/i)).toBeInTheDocument()
  })
  
  it('should submit form with valid credentials', async () => {
    const user = userEvent.setup()
    mockLogin.mockResolvedValueOnce({
      success: true,
      data: { token: 'test-token', user: { id: '1', email: 'test@example.com' } }
    })
    
    render(<LoginForm />)
    
    // Fill form
    await user.type(screen.getByLabelText(/email/i), 'test@example.com')
    await user.type(screen.getByLabelText(/password/i), 'Password123!')
    
    // Submit
    await user.click(screen.getByRole('button', { name: /login/i }))
    
    // Verify API call
    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'Password123!'
      })
    })
    
    // Verify redirect
    expect(mockPush).toHaveBeenCalledWith('/dashboard')
  })
  
  it('should display error message on login failure', async () => {
    const user = userEvent.setup()
    mockLogin.mockRejectedValueOnce(new Error('Invalid credentials'))
    
    render(<LoginForm />)
    
    await user.type(screen.getByLabelText(/email/i), 'test@example.com')
    await user.type(screen.getByLabelText(/password/i), 'WrongPassword')
    await user.click(screen.getByRole('button', { name: /login/i }))
    
    await waitFor(() => {
      expect(screen.getByText(/invalid credentials/i)).toBeInTheDocument()
    })
  })
  
  it('should disable submit button while loading', async () => {
    const user = userEvent.setup()
    mockLogin.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 1000)))
    
    render(<LoginForm />)
    
    await user.type(screen.getByLabelText(/email/i), 'test@example.com')
    await user.type(screen.getByLabelText(/password/i), 'Password123!')
    
    const submitButton = screen.getByRole('button', { name: /login/i })
    await user.click(submitButton)
    
    expect(submitButton).toBeDisabled()
    expect(screen.getByText(/logging in/i)).toBeInTheDocument()
  })
})
```

### 示例：数据展示组件测试

创建 `src/__tests__/unit/components/dashboard/StatsCard.test.tsx`:

```typescript
import { render, screen } from '@testing-library/react'
import { StatsCard } from '@/components/dashboard/stats-card'

describe('StatsCard', () => {
  const defaultProps = {
    title: 'Total Users',
    value: 1234,
    icon: 'users',
    trend: 12.5,
  }
  
  it('should render title and value', () => {
    render(<StatsCard {...defaultProps} />)
    
    expect(screen.getByText('Total Users')).toBeInTheDocument()
    expect(screen.getByText('1,234')).toBeInTheDocument() // Formatted number
  })
  
  it('should show positive trend', () => {
    render(<StatsCard {...defaultProps} />)
    
    const trend = screen.getByText(/12.5%/)
    expect(trend).toBeInTheDocument()
    expect(trend).toHaveClass('text-green-600')
  })
  
  it('should show negative trend', () => {
    render(<StatsCard {...defaultProps} trend={-5.3} />)
    
    const trend = screen.getByText(/5.3%/)
    expect(trend).toHaveClass('text-red-600')
  })
  
  it('should handle loading state', () => {
    render(<StatsCard {...defaultProps} isLoading />)
    
    expect(screen.getByTestId('skeleton-loader')).toBeInTheDocument()
    expect(screen.queryByText('1,234')).not.toBeInTheDocument()
  })
  
  it('should format large numbers', () => {
    render(<StatsCard {...defaultProps} value={1234567} />)
    
    expect(screen.getByText('1.2M')).toBeInTheDocument()
  })
  
  it('should handle custom formatting', () => {
    const formatter = (value: number) => `$${value.toFixed(2)}`
    render(<StatsCard {...defaultProps} value={1234.5} formatter={formatter} />)
    
    expect(screen.getByText('$1234.50')).toBeInTheDocument()
  })
})
```

## 🪝 自定义 Hooks 测试

### 示例：useAuth Hook 测试

创建 `src/__tests__/unit/hooks/useAuth.test.ts`:

```typescript
import { renderHook, act, waitFor } from '@testing-library/react'
import { useAuth } from '@/hooks/useAuth'
import { authService } from '@/lib/api/auth-service'

jest.mock('@/lib/api/auth-service')

describe('useAuth', () => {
  const mockAuthService = authService as jest.Mocked<typeof authService>
  
  beforeEach(() => {
    jest.clearAllMocks()
    localStorage.clear()
  })
  
  it('should initialize with loading state', () => {
    const { result } = renderHook(() => useAuth())
    
    expect(result.current.isLoading).toBe(true)
    expect(result.current.user).toBeNull()
    expect(result.current.isAuthenticated).toBe(false)
  })
  
  it('should load user from token', async () => {
    const mockUser = { id: '1', email: 'test@example.com', name: 'Test User' }
    localStorage.setItem('token', 'valid-token')
    mockAuthService.getCurrentUser.mockResolvedValueOnce(mockUser)
    
    const { result } = renderHook(() => useAuth())
    
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })
    
    expect(result.current.user).toEqual(mockUser)
    expect(result.current.isAuthenticated).toBe(true)
  })
  
  it('should handle login', async () => {
    const mockUser = { id: '1', email: 'test@example.com', name: 'Test User' }
    mockAuthService.login.mockResolvedValueOnce({
      success: true,
      data: { token: 'new-token', user: mockUser }
    })
    
    const { result } = renderHook(() => useAuth())
    
    await act(async () => {
      await result.current.login('test@example.com', 'password')
    })
    
    expect(result.current.user).toEqual(mockUser)
    expect(result.current.isAuthenticated).toBe(true)
    expect(localStorage.getItem('token')).toBe('new-token')
  })
  
  it('should handle logout', async () => {
    localStorage.setItem('token', 'valid-token')
    const { result } = renderHook(() => useAuth())
    
    await act(async () => {
      result.current.logout()
    })
    
    expect(result.current.user).toBeNull()
    expect(result.current.isAuthenticated).toBe(false)
    expect(localStorage.getItem('token')).toBeNull()
  })
  
  it('should handle authentication errors', async () => {
    mockAuthService.login.mockRejectedValueOnce(new Error('Invalid credentials'))
    
    const { result } = renderHook(() => useAuth())
    
    await act(async () => {
      try {
        await result.current.login('test@example.com', 'wrong-password')
      } catch (error) {
        expect(error.message).toBe('Invalid credentials')
      }
    })
    
    expect(result.current.user).toBeNull()
    expect(result.current.isAuthenticated).toBe(false)
  })
})
```

### 示例：useDebounce Hook 测试

创建 `src/__tests__/unit/hooks/useDebounce.test.ts`:

```typescript
import { renderHook, act } from '@testing-library/react'
import { useDebounce } from '@/hooks/useDebounce'

describe('useDebounce', () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })
  
  afterEach(() => {
    jest.useRealTimers()
  })
  
  it('should return initial value immediately', () => {
    const { result } = renderHook(() => useDebounce('initial', 500))
    
    expect(result.current).toBe('initial')
  })
  
  it('should debounce value changes', () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { value: 'initial', delay: 500 } }
    )
    
    // Change value
    rerender({ value: 'updated', delay: 500 })
    
    // Value should not change immediately
    expect(result.current).toBe('initial')
    
    // Fast forward time
    act(() => {
      jest.advanceTimersByTime(500)
    })
    
    // Value should be updated
    expect(result.current).toBe('updated')
  })
  
  it('should cancel previous timeout on rapid changes', () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { value: 'initial', delay: 500 } }
    )
    
    // Rapid changes
    rerender({ value: 'first', delay: 500 })
    act(() => jest.advanceTimersByTime(200))
    
    rerender({ value: 'second', delay: 500 })
    act(() => jest.advanceTimersByTime(200))
    
    rerender({ value: 'third', delay: 500 })
    act(() => jest.advanceTimersByTime(500))
    
    // Only the last value should be set
    expect(result.current).toBe('third')
  })
})
```

## 🧪 测试覆盖率

### 运行覆盖率报告

```bash
# 生成覆盖率报告
npm run test:coverage

# 仅单元测试覆盖率
npm run test:unit -- --coverage
```

### 覆盖率配置

在 `jest.config.js` 中设置阈值：

```javascript
coverageThreshold: {
  global: {
    branches: 80,
    functions: 80,
    lines: 80,
    statements: 80
  },
  // 特定文件的严格要求
  './src/lib/auth.ts': {
    branches: 100,
    functions: 100,
    lines: 100,
    statements: 100
  }
}
```

### 查看覆盖率报告

```bash
# HTML 报告
open coverage/lcov-report/index.html

# 终端摘要
cat coverage/coverage-summary.json | jq
```

## 📝 最佳实践

### 1. 测试命名规范

```typescript
describe('ComponentName', () => {
  describe('methodName', () => {
    it('should do something when condition is met', () => {
      // Test implementation
    })
  })
})
```

### 2. 测试数据工厂

创建 `src/test-utils/factories.ts`:

```typescript
import { faker } from '@faker-js/faker'

export const createUser = (overrides = {}) => ({
  id: faker.string.uuid(),
  email: faker.internet.email(),
  name: faker.person.fullName(),
  role: 'user',
  createdAt: faker.date.past(),
  ...overrides
})

export const createEnterprise = (overrides = {}) => ({
  id: faker.string.uuid(),
  name: faker.company.name(),
  description: faker.lorem.paragraph(),
  ownerId: faker.string.uuid(),
  ...overrides
})
```

### 3. 自定义匹配器

创建 `src/test-utils/matchers.ts`:

```typescript
expect.extend({
  toBeValidEmail(received: string) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    const pass = emailRegex.test(received)
    
    return {
      pass,
      message: () => 
        pass 
          ? `Expected ${received} not to be a valid email`
          : `Expected ${received} to be a valid email`
    }
  }
})

// 使用
expect('test@example.com').toBeValidEmail()
```

## 🚨 常见陷阱

### 1. 异步测试

```typescript
// ❌ 错误
it('should fetch data', () => {
  fetchData().then(data => {
    expect(data).toBeDefined()
  })
})

// ✅ 正确
it('should fetch data', async () => {
  const data = await fetchData()
  expect(data).toBeDefined()
})
```

### 2. 清理副作用

```typescript
describe('Timer tests', () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })
  
  afterEach(() => {
    jest.clearAllTimers()
    jest.useRealTimers()
  })
  
  // Tests...
})
```

### 3. Mock 重置

```typescript
beforeEach(() => {
  jest.clearAllMocks() // 清除 mock 调用历史
  jest.resetAllMocks() // 重置 mock 实现
  jest.restoreAllMocks() // 恢复原始实现
})
```

## 📋 检查清单

完成单元测试阶段后，确认：

- [ ] 核心工具函数已测试
- [ ] 关键组件已测试
- [ ] 自定义Hooks已测试
- [ ] 测试覆盖率达到目标
- [ ] 所有测试都能通过
- [ ] 测试运行速度快（< 1分钟）

## 🎯 下一步

完成单元测试后，继续：

1. 📖 阅读[集成测试指南](./03-integration-testing.md)
2. 🔍 查看[E2E测试指南](./04-e2e-testing.md)
3. 📊 了解[性能测试](./05-performance-testing.md)

---

*单元测试是质量保证的基础。保持高覆盖率，确保代码可靠性！*
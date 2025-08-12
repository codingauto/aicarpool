# 测试故障排查指南

## 🔍 快速诊断

遇到测试问题时，按以下顺序检查：

1. **环境问题** → 检查依赖和配置
2. **代码问题** → 检查最近的更改
3. **测试问题** → 检查测试代码本身
4. **系统问题** → 检查系统资源和网络

## 🚨 常见问题和解决方案

### 1. Jest 配置问题

#### 问题：Cannot find module '@/...'

**症状**：
```
Cannot find module '@/lib/utils' from 'src/components/Example.tsx'
```

**解决方案**：

检查 `jest.config.js` 中的路径映射：

```javascript
moduleNameMapper: {
  '^@/(.*)$': '<rootDir>/src/$1',
  '^@components/(.*)$': '<rootDir>/src/components/$1',
  '^@lib/(.*)$': '<rootDir>/src/lib/$1',
}
```

确保 `tsconfig.json` 中的路径一致：

```json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./src/*"],
      "@components/*": ["./src/components/*"],
      "@lib/*": ["./src/lib/*"]
    }
  }
}
```

#### 问题：SyntaxError: Cannot use import statement outside a module

**解决方案**：

确保 TypeScript 文件被正确转换：

```javascript
// jest.config.js
transform: {
  '^.+\\.(ts|tsx)$': ['ts-jest', {
    tsconfig: {
      jsx: 'react',
      esModuleInterop: true
    }
  }]
}
```

### 2. 数据库连接问题

#### 问题：Can't connect to MySQL server

**症状**：
```
Error: Can't connect to MySQL server on 'localhost' (111)
```

**检查步骤**：

1. 确认 MySQL 服务运行中：
```bash
# macOS
brew services list | grep mysql

# Linux
systemctl status mysql

# Docker
docker ps | grep mysql
```

2. 验证连接参数：
```bash
mysql -h localhost -u root -p
```

3. 检查测试数据库：
```bash
mysql -u root -p -e "SHOW DATABASES;" | grep test
```

4. 重置测试数据库：
```bash
# 删除并重建
mysql -u root -p -e "DROP DATABASE IF EXISTS aicarpool_test;"
mysql -u root -p -e "CREATE DATABASE aicarpool_test;"

# 运行迁移
NODE_ENV=test npx prisma migrate deploy
```

#### 问题：Prisma Client 版本不匹配

**症状**：
```
Error: @prisma/client did not initialize yet
```

**解决方案**：

```bash
# 重新生成 Prisma Client
npx prisma generate

# 清理缓存
rm -rf node_modules/.prisma
npm install
```

### 3. React Testing Library 问题

#### 问题：Unable to find element

**症状**：
```
Unable to find an element with the text: Submit
```

**调试技巧**：

```typescript
// 打印当前DOM
import { screen, debug } from '@testing-library/react'

test('debug example', () => {
  render(<Component />)
  
  // 打印整个DOM
  debug()
  
  // 打印特定元素
  debug(screen.getByRole('button'))
  
  // 使用 logRoles 查看可用的角色
  const { container } = render(<Component />)
  logRoles(container)
})
```

**使用正确的查询**：

```typescript
// 优先级（从高到低）
// 1. getByRole
screen.getByRole('button', { name: /submit/i })

// 2. getByLabelText
screen.getByLabelText(/email/i)

// 3. getByPlaceholderText
screen.getByPlaceholderText(/enter email/i)

// 4. getByText
screen.getByText(/welcome/i)

// 5. getByTestId (最后选择)
screen.getByTestId('submit-button')
```

#### 问题：异步元素未找到

**解决方案**：

```typescript
// 使用 waitFor
import { waitFor } from '@testing-library/react'

await waitFor(() => {
  expect(screen.getByText('Loading complete')).toBeInTheDocument()
})

// 使用 findBy (自带等待)
const element = await screen.findByText('Async content')

// 设置超时
const element = await screen.findByText('Slow loading', {}, { timeout: 5000 })
```

### 4. Mock 相关问题

#### 问题：Mock 函数未被调用

**检查顺序**：

```typescript
// ❌ 错误：在import之后mock
import { myFunction } from './myModule'
jest.mock('./myModule')

// ✅ 正确：在import之前mock
jest.mock('./myModule')
import { myFunction } from './myModule'
```

**手动 mock**：

```typescript
// __mocks__/myModule.ts
export const myFunction = jest.fn()

// 测试文件
jest.mock('./myModule')
import { myFunction } from './myModule'

beforeEach(() => {
  (myFunction as jest.Mock).mockClear()
})
```

#### 问题：异步 Mock 处理

```typescript
// Mock Promise
mockFunction.mockResolvedValue(data)  // 成功
mockFunction.mockRejectedValue(error) // 失败

// Mock 多次调用
mockFunction
  .mockResolvedValueOnce(data1)
  .mockResolvedValueOnce(data2)
  .mockRejectedValueOnce(error)

// Mock 实现
mockFunction.mockImplementation(async (arg) => {
  if (arg === 'special') {
    return specialData
  }
  return defaultData
})
```

### 5. 性能问题

#### 问题：测试运行缓慢

**优化策略**：

1. **并行运行**：
```json
// package.json
{
  "scripts": {
    "test": "jest --maxWorkers=50%"
  }
}
```

2. **使用测试过滤**：
```bash
# 只运行更改的文件
jest -o

# 运行特定测试
jest --testNamePattern="should login"

# 运行特定文件
jest auth.test.ts
```

3. **优化 beforeEach**：
```typescript
// ❌ 慢：每个测试都创建
beforeEach(() => {
  createLargeDataSet()
})

// ✅ 快：共享不变的数据
beforeAll(() => {
  createLargeDataSet()
})

beforeEach(() => {
  resetMutableState()
})
```

4. **禁用不必要的功能**：
```javascript
// jest.config.js
{
  // 测试时禁用覆盖率
  collectCoverage: false,
  
  // 减少快照
  snapshotSerializers: [],
  
  // 禁用源映射
  globals: {
    'ts-jest': {
      tsconfig: {
        sourceMap: false
      }
    }
  }
}
```

### 6. CI/CD 问题

#### 问题：CI 环境测试失败但本地通过

**检查清单**：

1. **环境变量**：
```yaml
# .github/workflows/test.yml
env:
  NODE_ENV: test
  DATABASE_URL: ${{ secrets.DATABASE_URL }}
  JWT_SECRET: test-secret
```

2. **时区问题**：
```typescript
// 使用 UTC 时间
const date = new Date('2024-01-01T00:00:00Z')

// 或mock Date
beforeAll(() => {
  jest.useFakeTimers()
  jest.setSystemTime(new Date('2024-01-01'))
})
```

3. **文件系统差异**：
```typescript
// 使用跨平台路径
import path from 'path'
const filePath = path.join(__dirname, 'data', 'test.json')
```

4. **并发问题**：
```typescript
// 使用唯一标识
const testId = `test-${Date.now()}-${Math.random()}`
const testEmail = `user-${testId}@example.com`
```

### 7. Playwright/E2E 问题

#### 问题：元素不可交互

**症状**：
```
Element is not visible or not an interactive element
```

**解决方案**：

```typescript
// 等待元素可见
await page.waitForSelector('button', { state: 'visible' })

// 滚动到元素
await page.locator('button').scrollIntoViewIfNeeded()

// 强制点击
await page.click('button', { force: true })

// 等待网络空闲
await page.waitForLoadState('networkidle')
```

#### 问题：超时错误

```typescript
// 增加全局超时
test.setTimeout(60000)

// 特定操作超时
await page.click('button', { timeout: 30000 })

// 自定义等待
await page.waitForFunction(
  () => document.querySelector('.loaded'),
  { timeout: 30000 }
)
```

### 8. 内存泄漏

#### 症状：
```
FATAL ERROR: Reached heap limit Allocation failed
```

**解决方案**：

1. **增加内存限制**：
```json
// package.json
{
  "scripts": {
    "test": "NODE_OPTIONS='--max-old-space-size=4096' jest"
  }
}
```

2. **清理测试**：
```typescript
afterEach(() => {
  jest.clearAllMocks()
  jest.clearAllTimers()
})

afterAll(async () => {
  await prisma.$disconnect()
  await redisClient.quit()
})
```

3. **检测泄漏**：
```bash
# 运行内存泄漏检测
jest --detectLeaks
```

## 🛠️ 调试技巧

### VS Code 调试配置

创建 `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Jest Debug Current File",
      "program": "${workspaceFolder}/node_modules/.bin/jest",
      "args": [
        "--runInBand",
        "--no-coverage",
        "${relativeFile}"
      ],
      "console": "integratedTerminal",
      "internalConsoleOptions": "neverOpen",
      "windows": {
        "program": "${workspaceFolder}/node_modules/jest/bin/jest"
      }
    },
    {
      "type": "node",
      "request": "launch",
      "name": "Jest Debug All",
      "program": "${workspaceFolder}/node_modules/.bin/jest",
      "args": ["--runInBand", "--no-coverage"],
      "console": "integratedTerminal",
      "internalConsoleOptions": "neverOpen"
    }
  ]
}
```

### 使用 Chrome DevTools

```bash
# 启动调试模式
node --inspect-brk ./node_modules/.bin/jest --runInBand

# 打开 Chrome
chrome://inspect

# 点击 "inspect" 链接
```

### 日志调试

```typescript
// 临时增加日志
console.log('Current state:', JSON.stringify(state, null, 2))

// 使用 debug 库
import debug from 'debug'
const log = debug('test:auth')
log('Login attempt with:', { email })

// 运行时启用
DEBUG=test:* npm test
```

## 📝 最佳实践检查清单

### 测试编写

- [ ] 测试名称清晰描述行为
- [ ] 使用 AAA 模式（Arrange-Act-Assert）
- [ ] 避免测试实现细节
- [ ] 保持测试独立
- [ ] 清理副作用

### 测试维护

- [ ] 定期运行所有测试
- [ ] 保持测试与代码同步
- [ ] 重构测试代码
- [ ] 更新过时的快照
- [ ] 监控测试性能

### CI/CD

- [ ] 所有分支运行测试
- [ ] PR必须通过测试
- [ ] 监控测试稳定性
- [ ] 定期更新依赖
- [ ] 备份测试数据

## 🔗 有用的资源

### 文档

- [Jest 故障排查](https://jestjs.io/docs/troubleshooting)
- [Testing Library 常见错误](https://testing-library.com/docs/dom-testing-library/api-queries#common-mistakes)
- [Playwright 调试指南](https://playwright.dev/docs/debug)

### 工具

- [Jest VSCode 扩展](https://marketplace.visualstudio.com/items?itemName=Orta.vscode-jest)
- [Testing Playground](https://testing-playground.com/)
- [Regex101](https://regex101.com/) - 测试正则表达式

### 社区

- [Stack Overflow - Jest标签](https://stackoverflow.com/questions/tagged/jest)
- [Testing Library Discord](https://discord.gg/testing-library)
- [GitHub Discussions](https://github.com/facebook/jest/discussions)

## 🆘 获取帮助

如果以上方案都无法解决问题：

1. **收集信息**：
   - 错误消息完整截图
   - 相关代码片段
   - 配置文件
   - 环境信息（Node版本、操作系统等）

2. **最小复现**：
   创建最小可复现示例

3. **寻求帮助**：
   - 团队内部 Slack 频道
   - GitHub Issues
   - Stack Overflow

---

*记住：大多数测试问题都有人遇到过。耐心调试，总能找到解决方案！*
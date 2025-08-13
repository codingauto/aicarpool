# 阶段 4：端到端测试指南

## 📋 本阶段目标

通过模拟真实用户操作，测试完整的业务流程，确保应用在真实环境中正常工作。

**预计时间**: 1-2周  
**前置要求**: 完成[集成测试](./03-integration-testing.md)

## 🎭 Playwright 设置

### 安装和配置

```bash
# 安装 Playwright
npm install --save-dev @playwright/test

# 安装浏览器
npx playwright install

# 安装系统依赖（可选）
npx playwright install-deps
```

### 配置文件

创建 `playwright.config.ts`:

```typescript
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  // 测试目录
  testDir: './e2e',
  
  // 测试匹配模式
  testMatch: '**/*.spec.ts',
  
  // 并行执行
  fullyParallel: true,
  
  // 失败时重试
  retries: process.env.CI ? 2 : 0,
  
  // 并行工作进程数
  workers: process.env.CI ? 1 : undefined,
  
  // 报告配置
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['json', { outputFile: 'test-results/e2e-results.json' }],
    ['junit', { outputFile: 'test-results/e2e-junit.xml' }],
  ],
  
  // 全局配置
  use: {
    // 基础URL
    baseURL: process.env.BASE_URL || 'http://localhost:4000',
    
    // 追踪失败的测试
    trace: 'on-first-retry',
    
    // 截图
    screenshot: 'only-on-failure',
    
    // 视频
    video: 'retain-on-failure',
    
    // 动作超时
    actionTimeout: 10000,
    
    // 导航超时
    navigationTimeout: 30000,
  },
  
  // 项目配置（不同浏览器）
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'mobile-safari',
      use: { ...devices['iPhone 12'] },
    },
  ],
  
  // 开发服务器
  webServer: {
    command: 'npm run dev',
    port: 4000,
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
})
```

## 🔧 测试工具和助手

### Page Object Model

创建 `e2e/pages/base-page.ts`:

```typescript
import { Page, Locator } from '@playwright/test'

export abstract class BasePage {
  constructor(protected page: Page) {}
  
  async goto(path: string = '') {
    await this.page.goto(path)
    await this.waitForLoad()
  }
  
  async waitForLoad() {
    await this.page.waitForLoadState('networkidle')
  }
  
  async takeScreenshot(name: string) {
    await this.page.screenshot({ 
      path: `screenshots/${name}.png`,
      fullPage: true 
    })
  }
  
  async fillForm(data: Record<string, string>) {
    for (const [field, value] of Object.entries(data)) {
      await this.page.fill(`[name="${field}"]`, value)
    }
  }
  
  async submitForm() {
    await this.page.click('button[type="submit"]')
  }
  
  async waitForToast(message: string) {
    await this.page.waitForSelector(`text="${message}"`)
  }
  
  async dismissToast() {
    await this.page.click('.toast-close')
  }
}
```

创建 `e2e/pages/login-page.ts`:

```typescript
import { Page } from '@playwright/test'
import { BasePage } from './base-page'

export class LoginPage extends BasePage {
  // 页面元素
  readonly emailInput = this.page.locator('input[name="email"]')
  readonly passwordInput = this.page.locator('input[name="password"]')
  readonly submitButton = this.page.locator('button[type="submit"]')
  readonly errorMessage = this.page.locator('.error-message')
  readonly forgotPasswordLink = this.page.locator('text=Forgot password')
  
  async goto() {
    await super.goto('/auth/login')
  }
  
  async login(email: string, password: string) {
    await this.emailInput.fill(email)
    await this.passwordInput.fill(password)
    await this.submitButton.click()
  }
  
  async expectError(message: string) {
    await this.errorMessage.waitFor()
    const text = await this.errorMessage.textContent()
    return text?.includes(message)
  }
  
  async isLoggedIn() {
    // 检查是否跳转到dashboard
    await this.page.waitForURL('**/dashboard')
    return this.page.url().includes('/dashboard')
  }
}
```

创建 `e2e/pages/dashboard-page.ts`:

```typescript
import { Page } from '@playwright/test'
import { BasePage } from './base-page'

export class DashboardPage extends BasePage {
  readonly userMenu = this.page.locator('[data-testid="user-menu"]')
  readonly logoutButton = this.page.locator('text=Logout')
  readonly statsCards = this.page.locator('[data-testid="stats-card"]')
  readonly createButton = this.page.locator('button:has-text("Create")')
  
  async goto() {
    await super.goto('/dashboard')
  }
  
  async getUserEmail() {
    await this.userMenu.click()
    const email = await this.page.locator('.user-email').textContent()
    await this.page.keyboard.press('Escape')
    return email
  }
  
  async logout() {
    await this.userMenu.click()
    await this.logoutButton.click()
    await this.page.waitForURL('**/login')
  }
  
  async getStatsCount() {
    return this.statsCards.count()
  }
  
  async createNewItem(type: string) {
    await this.createButton.click()
    await this.page.click(`text="${type}"`)
  }
}
```

### 测试数据工厂

创建 `e2e/fixtures/test-data.ts`:

```typescript
import { faker } from '@faker-js/faker'

export const testUsers = {
  admin: {
    email: 'admin@test.com',
    password: 'Admin123!',
    name: 'Test Admin',
    role: 'admin'
  },
  user: {
    email: 'user@test.com',
    password: 'User123!',
    name: 'Test User',
    role: 'user'
  }
}

export function generateUser() {
  return {
    email: faker.internet.email(),
    password: 'Test123!@#',
    name: faker.person.fullName(),
  }
}

export function generateEnterprise() {
  return {
    name: faker.company.name(),
    description: faker.lorem.paragraph(),
  }
}

export function generateAiAccount() {
  return {
    name: `${faker.word.adjective()} AI Account`,
    platform: faker.helpers.arrayElement(['claude', 'gemini', 'openai']),
    apiKey: faker.string.alphanumeric(32),
  }
}
```

## 🎬 核心流程测试

### 用户认证流程

创建 `e2e/tests/auth.spec.ts`:

```typescript
import { test, expect } from '@playwright/test'
import { LoginPage } from '../pages/login-page'
import { DashboardPage } from '../pages/dashboard-page'
import { testUsers } from '../fixtures/test-data'

test.describe('Authentication', () => {
  let loginPage: LoginPage
  let dashboardPage: DashboardPage
  
  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page)
    dashboardPage = new DashboardPage(page)
  })
  
  test('successful login flow', async ({ page }) => {
    // 访问登录页
    await loginPage.goto()
    
    // 验证页面元素
    await expect(page).toHaveTitle(/Login/)
    await expect(loginPage.emailInput).toBeVisible()
    await expect(loginPage.passwordInput).toBeVisible()
    
    // 执行登录
    await loginPage.login(testUsers.user.email, testUsers.user.password)
    
    // 验证登录成功
    await expect(page).toHaveURL(/.*dashboard/)
    await expect(dashboardPage.userMenu).toBeVisible()
    
    // 验证用户信息
    const email = await dashboardPage.getUserEmail()
    expect(email).toBe(testUsers.user.email)
  })
  
  test('login with invalid credentials', async ({ page }) => {
    await loginPage.goto()
    await loginPage.login('wrong@email.com', 'wrongpassword')
    
    // 验证错误消息
    await expect(loginPage.errorMessage).toBeVisible()
    await expect(loginPage.errorMessage).toContainText('Invalid credentials')
    
    // 应该仍在登录页
    await expect(page).toHaveURL(/.*login/)
  })
  
  test('logout flow', async ({ page }) => {
    // 先登录
    await loginPage.goto()
    await loginPage.login(testUsers.user.email, testUsers.user.password)
    await page.waitForURL(/.*dashboard/)
    
    // 执行登出
    await dashboardPage.logout()
    
    // 验证跳转到登录页
    await expect(page).toHaveURL(/.*login/)
    
    // 尝试访问受保护页面
    await page.goto('/dashboard')
    await expect(page).toHaveURL(/.*login/)
  })
  
  test('session persistence', async ({ context, page }) => {
    // 登录
    await loginPage.goto()
    await loginPage.login(testUsers.user.email, testUsers.user.password)
    await page.waitForURL(/.*dashboard/)
    
    // 打开新标签页
    const newPage = await context.newPage()
    const newDashboard = new DashboardPage(newPage)
    
    // 应该保持登录状态
    await newDashboard.goto()
    await expect(newPage).toHaveURL(/.*dashboard/)
    await expect(newDashboard.userMenu).toBeVisible()
    
    await newPage.close()
  })
})
```

### 企业管理流程

创建 `e2e/tests/enterprise.spec.ts`:

```typescript
import { test, expect } from '@playwright/test'
import { generateEnterprise, testUsers } from '../fixtures/test-data'

test.describe('Enterprise Management', () => {
  // 在所有测试前登录
  test.beforeEach(async ({ page }) => {
    await page.goto('/auth/login')
    await page.fill('input[name="email"]', testUsers.admin.email)
    await page.fill('input[name="password"]', testUsers.admin.password)
    await page.click('button[type="submit"]')
    await page.waitForURL(/.*dashboard/)
  })
  
  test('create new enterprise', async ({ page }) => {
    const enterprise = generateEnterprise()
    
    // 导航到企业页面
    await page.click('text=Enterprises')
    await page.waitForSelector('h1:has-text("Enterprise Management")')
    
    // 点击创建按钮
    await page.click('button:has-text("Create Enterprise")')
    
    // 填写表单
    await page.fill('input[name="name"]', enterprise.name)
    await page.fill('textarea[name="description"]', enterprise.description)
    
    // 选择计划
    await page.click('input[value="professional"]')
    
    // 提交
    await page.click('button:has-text("Create")')
    
    // 验证创建成功
    await expect(page.locator('.toast-success')).toContainText('created successfully')
    await expect(page.locator(`text=${enterprise.name}`)).toBeVisible()
  })
  
  test('manage enterprise members', async ({ page }) => {
    // 进入企业详情
    await page.click('text=Enterprises')
    await page.click('.enterprise-card:first-child')
    
    // 切换到成员标签
    await page.click('text=Members')
    
    // 邀请新成员
    await page.click('button:has-text("Invite Member")')
    await page.fill('input[name="email"]', 'newmember@test.com')
    await page.selectOption('select[name="role"]', 'member')
    await page.click('button:has-text("Send Invitation")')
    
    // 验证邀请发送
    await expect(page.locator('.toast-success')).toContainText('Invitation sent')
    await expect(page.locator('text=newmember@test.com')).toBeVisible()
    await expect(page.locator('text=Pending')).toBeVisible()
  })
  
  test('configure AI accounts', async ({ page }) => {
    // 进入企业AI账号管理
    await page.click('text=Enterprises')
    await page.click('.enterprise-card:first-child')
    await page.click('text=AI Accounts')
    
    // 添加Claude账号
    await page.click('button:has-text("Add Account")')
    await page.selectOption('select[name="platform"]', 'claude')
    await page.fill('input[name="name"]', 'Production Claude')
    await page.fill('input[name="apiKey"]', 'sk-test-key-123')
    
    // 配置限制
    await page.fill('input[name="dailyLimit"]', '10000')
    await page.fill('input[name="monthlyBudget"]', '500')
    
    // 保存
    await page.click('button:has-text("Save")')
    
    // 验证添加成功
    await expect(page.locator('text=Production Claude')).toBeVisible()
    await expect(page.locator('.account-status-active')).toBeVisible()
  })
})
```

### 拼车组流程

创建 `e2e/tests/carpool-group.spec.ts`:

```typescript
import { test, expect } from '@playwright/test'

test.describe('Carpool Group', () => {
  test.beforeEach(async ({ page }) => {
    // 登录
    await page.goto('/auth/login')
    await page.fill('input[name="email"]', 'user@test.com')
    await page.fill('input[name="password"]', 'User123!')
    await page.click('button[type="submit"]')
    await page.waitForURL(/.*dashboard/)
  })
  
  test('create and manage carpool group', async ({ page }) => {
    // 创建拼车组
    await page.click('text=Carpool Groups')
    await page.click('button:has-text("Create Group")')
    
    // 填写基本信息
    await page.fill('input[name="name"]', 'Dev Team Group')
    await page.fill('textarea[name="description"]', 'Group for development team')
    await page.fill('input[name="maxMembers"]', '10')
    
    // 下一步：选择AI服务
    await page.click('button:has-text("Next")')
    await page.check('input[value="claude"]')
    await page.check('input[value="gemini"]')
    
    // 下一步：配置账号
    await page.click('button:has-text("Next")')
    await page.selectOption('select[name="claudeAccount"]', { index: 1 })
    
    // 创建
    await page.click('button:has-text("Create Group")')
    
    // 验证创建成功
    await expect(page).toHaveURL(/.*groups\/[a-z0-9-]+/)
    await expect(page.locator('h1')).toContainText('Dev Team Group')
  })
  
  test('invite members to group', async ({ page }) => {
    // 进入拼车组
    await page.click('text=Carpool Groups')
    await page.click('.group-card:first-child')
    
    // 生成邀请链接
    await page.click('text=Invite Members')
    await page.click('button:has-text("Generate Link")')
    
    // 复制邀请链接
    const inviteLink = await page.locator('.invite-link input').inputValue()
    expect(inviteLink).toContain('/join/')
    
    // 设置链接过期时间
    await page.selectOption('select[name="expiry"]', '7days')
    await page.click('button:has-text("Update")')
    
    // 验证更新成功
    await expect(page.locator('.toast-success')).toContainText('updated')
  })
  
  test('monitor group usage', async ({ page }) => {
    // 进入拼车组
    await page.click('text=Carpool Groups')
    await page.click('.group-card:first-child')
    
    // 切换到使用统计
    await page.click('text=Usage Stats')
    
    // 验证统计显示
    await expect(page.locator('.usage-chart')).toBeVisible()
    await expect(page.locator('text=Total Requests')).toBeVisible()
    await expect(page.locator('text=Total Cost')).toBeVisible()
    
    // 切换时间范围
    await page.selectOption('select[name="timeRange"]', '30days')
    await page.waitForResponse(/.*usage-stats/)
    
    // 导出报告
    await page.click('button:has-text("Export Report")')
    const download = await page.waitForEvent('download')
    expect(download.suggestedFilename()).toContain('usage-report')
  })
})
```

## 🔍 可访问性测试

创建 `e2e/tests/accessibility.spec.ts`:

```typescript
import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

test.describe('Accessibility', () => {
  test('login page should be accessible', async ({ page }) => {
    await page.goto('/auth/login')
    
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze()
    
    expect(accessibilityScanResults.violations).toEqual([])
  })
  
  test('dashboard should be accessible', async ({ page }) => {
    // 先登录
    await page.goto('/auth/login')
    await page.fill('input[name="email"]', 'user@test.com')
    await page.fill('input[name="password"]', 'User123!')
    await page.click('button[type="submit"]')
    await page.waitForURL(/.*dashboard/)
    
    const accessibilityScanResults = await new AxeBuilder({ page })
      .exclude('.third-party-widget') // 排除第三方组件
      .analyze()
    
    expect(accessibilityScanResults.violations).toEqual([])
  })
  
  test('keyboard navigation', async ({ page }) => {
    await page.goto('/auth/login')
    
    // Tab到第一个输入框
    await page.keyboard.press('Tab')
    const focusedElement1 = await page.evaluate(() => document.activeElement?.tagName)
    expect(focusedElement1).toBe('INPUT')
    
    // Tab到第二个输入框
    await page.keyboard.press('Tab')
    const focusedElement2 = await page.evaluate(() => document.activeElement?.name)
    expect(focusedElement2).toBe('password')
    
    // Tab到提交按钮
    await page.keyboard.press('Tab')
    const focusedElement3 = await page.evaluate(() => document.activeElement?.tagName)
    expect(focusedElement3).toBe('BUTTON')
    
    // Enter提交
    await page.keyboard.press('Enter')
  })
})
```

## 📱 移动端测试

创建 `e2e/tests/mobile.spec.ts`:

```typescript
import { test, expect, devices } from '@playwright/test'

test.use({ ...devices['iPhone 12'] })

test.describe('Mobile Experience', () => {
  test('responsive navigation', async ({ page }) => {
    await page.goto('/')
    
    // 验证汉堡菜单
    await expect(page.locator('.mobile-menu-button')).toBeVisible()
    
    // 打开菜单
    await page.click('.mobile-menu-button')
    await expect(page.locator('.mobile-menu')).toBeVisible()
    
    // 导航项应该垂直排列
    const menuItems = await page.locator('.mobile-menu-item').all()
    expect(menuItems.length).toBeGreaterThan(0)
  })
  
  test('touch interactions', async ({ page }) => {
    await page.goto('/dashboard')
    
    // 模拟滑动
    await page.locator('.swipeable-card').swipe('left')
    await expect(page.locator('.card-actions')).toBeVisible()
    
    // 模拟长按
    await page.locator('.long-press-item').tap({ delay: 1000 })
    await expect(page.locator('.context-menu')).toBeVisible()
  })
  
  test('mobile forms', async ({ page }) => {
    await page.goto('/auth/login')
    
    // 输入框应该有正确的类型
    const emailType = await page.locator('input[name="email"]').getAttribute('type')
    expect(emailType).toBe('email')
    
    // 自动完成应该正确设置
    const autocomplete = await page.locator('input[name="password"]').getAttribute('autocomplete')
    expect(autocomplete).toBe('current-password')
  })
})
```

## 🎯 性能测试

创建 `e2e/tests/performance.spec.ts`:

```typescript
import { test, expect } from '@playwright/test'

test.describe('Performance', () => {
  test('page load metrics', async ({ page }) => {
    await page.goto('/')
    
    const metrics = await page.evaluate(() => {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming
      return {
        domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
        loadComplete: navigation.loadEventEnd - navigation.loadEventStart,
        firstPaint: performance.getEntriesByName('first-paint')[0]?.startTime || 0,
        firstContentfulPaint: performance.getEntriesByName('first-contentful-paint')[0]?.startTime || 0,
      }
    })
    
    // 性能阈值
    expect(metrics.domContentLoaded).toBeLessThan(1000)
    expect(metrics.loadComplete).toBeLessThan(3000)
    expect(metrics.firstContentfulPaint).toBeLessThan(1500)
  })
  
  test('api response times', async ({ page }) => {
    await page.goto('/dashboard')
    
    // 监听API请求
    const responseTime = await page.evaluate(async () => {
      const start = performance.now()
      await fetch('/api/user/profile')
      return performance.now() - start
    })
    
    expect(responseTime).toBeLessThan(500)
  })
  
  test('memory leaks', async ({ page }) => {
    await page.goto('/dashboard')
    
    // 初始内存
    const initialMemory = await page.evaluate(() => {
      return (performance as any).memory?.usedJSHeapSize || 0
    })
    
    // 执行一些操作
    for (let i = 0; i < 10; i++) {
      await page.click('button:has-text("Refresh")')
      await page.waitForTimeout(100)
    }
    
    // 最终内存
    const finalMemory = await page.evaluate(() => {
      return (performance as any).memory?.usedJSHeapSize || 0
    })
    
    // 内存增长不应超过50%
    const memoryGrowth = (finalMemory - initialMemory) / initialMemory
    expect(memoryGrowth).toBeLessThan(0.5)
  })
})
```

## 🔧 运行和调试

### 运行测试

```bash
# 运行所有E2E测试
npx playwright test

# 运行特定文件
npx playwright test e2e/tests/auth.spec.ts

# 运行特定项目（浏览器）
npx playwright test --project=chromium

# 调试模式
npx playwright test --debug

# UI模式
npx playwright test --ui

# 生成测试代码
npx playwright codegen http://localhost:4000
```

### 查看报告

```bash
# 打开HTML报告
npx playwright show-report

# 查看追踪文件
npx playwright show-trace trace.zip
```

## 📋 检查清单

- [ ] Playwright已配置
- [ ] Page Object Model已实现
- [ ] 核心用户流程已测试
- [ ] 移动端体验已测试
- [ ] 可访问性已验证
- [ ] 性能指标已检查

## 🎯 下一步

1. 📊 [性能测试指南](./05-performance-testing.md)
2. 🔧 [CI/CD集成](./06-ci-cd-integration.md)
3. 🐛 [故障排查](./troubleshooting.md)

---

*E2E测试模拟真实用户，确保应用在实际使用中正常工作！*
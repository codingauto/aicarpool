# Prisma 数据库管理 - 完整方案

## 🎯 问题分析

当前项目使用 `npx prisma db push` 方式，这种方式的问题：
- ❌ 不生成迁移历史文件
- ❌ 其他开发者无法追踪数据库变更
- ❌ 生产环境部署风险大

## 🚀 推荐方案：使用 Prisma 迁移

### 方案一：切换到迁移模式（推荐）

#### 1. 更新 ai_service_accounts 表结构

**步骤 1：修改 schema.prisma**
```prisma
model AiServiceAccount {
  id                     String                @id @default(cuid())
  enterpriseId           String
  name                   String
  description            String?
  serviceType            ServiceType
  accountType            String                @default("shared")
  authType               AuthType
  encryptedCredentials   String                @db.Text
  
  // OAuth 认证字段
  oauthAccessToken       String?               @db.Text
  oauthRefreshToken      String?               @db.Text
  oauthExpiresAt         DateTime?
  oauthScopes            String?
  
  // 手动 Token 字段 - 新增
  manualAccessToken      String?               @db.Text
  manualRefreshToken     String?               @db.Text
  
  // 平台特定配置 - 新增
  priority               Int                   @default(50)
  geminiProjectId        String?
  geminiLocation         String?               @default("us-central1")
  
  // Claude Console 配置 - 新增
  claudeConsoleApiUrl           String?
  claudeConsoleApiKey           String?         @db.Text
  claudeConsoleUserAgent        String?
  claudeConsoleRateLimitDuration Int?          @default(60)
  claudeConsoleSupportedModels  Json?
  
  // 代理配置 - 新增
  proxyEnabled           Boolean               @default(false)
  proxyType              String?
  proxyHost              String?
  proxyPort              Int?
  proxyAuthEnabled       Boolean               @default(false)
  proxyUsername          String?
  proxyPassword          String?
  
  // 状态管理 - 新增
  validationStatus       String                @default("pending") // pending, valid, invalid, expired
  validationMessage      String?               @db.Text
  createdBy              String?
  
  // 现有字段保持不变
  apiEndpoint            String?
  supportedModels        Json
  currentModel           String?
  dailyLimit             Int                   @default(10000)
  costPerToken           Decimal               @default(0.00001000) @db.Decimal(10, 8)
  isEnabled              Boolean               @default(true)
  status                 String                @default("active")
  currentLoad            Int                   @default(0)
  totalRequests          BigInt                @default(0)
  totalTokens            BigInt                @default(0)
  totalCost              Decimal               @default(0.0000) @db.Decimal(12, 4)
  lastUsedAt             DateTime?
  errorMessage           String?
  createdAt              DateTime              @default(now())
  updatedAt              DateTime              @updatedAt
  ownerType              String                @default("enterprise")
  maxConcurrentGroups    Int                   @default(1)
  platformConfig         Json?
  region                 String?
  endpointUrl            String?
  modelVersion           String?
  rateLimitConfig        Json?
  headerConfig           Json?
  timeout                Int?                  @default(30000)
  
  // 关联关系
  healthChecks         AccountHealthCheck[]
  enterprise           Enterprise            @relation(fields: [enterpriseId], references: [id], onDelete: Cascade)
  groupBindings        GroupAccountBinding[]
  groupAiServices      GroupAiService[]
  usageStats           UsageStat[]

  // 索引优化
  @@index([enterpriseId])
  @@index([serviceType])
  @@index([status])
  @@index([accountType])
  @@index([ownerType])
  @@index([validationStatus])  // 新增
  @@index([priority])          // 新增
  @@index([enterpriseId, serviceType, status])  // 复合索引
  @@map("ai_service_accounts")
}
```

**步骤 2：生成迁移文件**
```bash
cd /Users/jason/FreelanceWork/aip/aicarpool

# 生成迁移文件
npx prisma migrate dev --name add_ai_account_fields
```

**步骤 3：应用迁移**
```bash
# 迁移已经自动应用，再生成客户端
npx prisma generate
```

#### 2. 更新 package.json 脚本

添加新的数据库管理脚本：
```json
{
  "scripts": {
    // 现有脚本...
    "db:migrate": "npx prisma migrate dev",
    "db:migrate:deploy": "npx prisma migrate deploy",
    "db:migrate:reset": "npx prisma migrate reset",
    "db:migrate:status": "npx prisma migrate status",
    "db:studio": "npx prisma studio",
    
    // 更新现有脚本
    "quick-install": "npm run db:migrate:reset && npm run db:init && echo '🎉 快速安装完成！访问 http://localhost:4000'",
    "db:init": "npx prisma generate && npm run db:create-admin && npx tsx scripts/init-admin-permissions.ts"
  }
}
```

#### 3. 创建部署脚本

创建 `scripts/setup-database.sh`：
```bash
#!/bin/bash
echo "🚀 初始化数据库..."

# 检查数据库连接
echo "📡 检查数据库连接..."
npx prisma db pull --force || {
    echo "❌ 数据库连接失败，请检查 DATABASE_URL"
    exit 1
}

# 应用迁移
echo "📦 应用数据库迁移..."
npx prisma migrate deploy

# 生成客户端
echo "🔧 生成 Prisma 客户端..."
npx prisma generate

# 创建管理员账户
echo "👤 创建管理员账户..."
npm run db:create-admin

# 初始化权限
echo "🔐 初始化权限..."
npx tsx scripts/init-admin-permissions.ts

echo "✅ 数据库初始化完成！"
```

## 📋 新用户使用流程

### 对于新的开发者

#### 1. 克隆项目后
```bash
git clone <项目地址>
cd aicarpool
npm install
```

#### 2. 配置环境变量
```bash
cp .env.example .env
# 编辑 .env 文件，设置 DATABASE_URL
```

#### 3. 初始化数据库
```bash
# 使用新的脚本
npm run quick-install

# 或手动执行
npx prisma migrate deploy  # 应用所有迁移
npx prisma generate        # 生成客户端
npm run db:create-admin     # 创建管理员
```

#### 4. 启动项目
```bash
npm run dev
```

### 对于生产环境部署

#### 1. 部署时执行
```bash
# 应用迁移（不会重置数据）
npx prisma migrate deploy

# 生成客户端
npx prisma generate
```

#### 2. 首次部署额外执行
```bash
# 创建管理员（仅首次）
npm run db:create-admin
```

## 🔄 方案二：保持现有 db push 方式

如果您想保持现有方式，需要确保 schema.prisma 是最新的：

#### 1. 更新 schema.prisma（同上面的内容）

#### 2. 更新初始化脚本
```json
{
  "scripts": {
    "quick-install": "npm run db:reset && npm run db:init && echo '🎉 快速安装完成！'",
    "db:reset": "npx prisma db push --force-reset",
    "db:update": "npx prisma db push",
    "db:init": "npx prisma generate && npm run db:create-admin && npx tsx scripts/init-admin-permissions.ts"
  }
}
```

#### 3. 新用户使用
```bash
git clone <项目>
cd aicarpool
npm install
cp .env.example .env  # 配置数据库连接
npm run quick-install  # 一键初始化
npm run dev
```

## 💡 对比两种方案

| 特性 | 迁移方案 | db push 方案 |
|------|---------|-------------|
| 版本控制 | ✅ 有迁移历史 | ❌ 无历史记录 |
| 生产安全 | ✅ 安全渐进 | ⚠️ 需要重置 |
| 团队协作 | ✅ 易于同步 | ⚠️ 可能冲突 |
| 数据保护 | ✅ 不丢失数据 | ❌ 可能丢失 |
| 设置复杂度 | ⚠️ 稍复杂 | ✅ 简单 |

## 🎯 最终推荐

**强烈建议使用方案一（迁移模式）**，因为：

1. **数据安全**：现有数据不会丢失
2. **团队协作**：其他开发者能准确复现数据库结构
3. **生产就绪**：部署到生产环境更安全
4. **版本控制**：每次数据库变更都有记录

## 🚀 立即执行

想要切换到迁移模式吗？我可以帮您执行：

```bash
# 1. 修改 schema.prisma（我已经提供了完整内容）
# 2. 生成迁移
cd /Users/jason/FreelanceWork/aip/aicarpool
npx prisma migrate dev --name add_ai_account_fields

# 3. 验证
npx prisma migrate status
```

这样您的项目就能确保所有使用者都获得一致的数据库结构了！

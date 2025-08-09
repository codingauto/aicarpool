# AI账户管理 - 简化表结构设计

## 核心表：ai_service_accounts（优化版）

基于前端 `page.tsx` 的具体需求，设计一个完整的AI账户表结构，**不包含组管理概念**。

### 完整表结构

```sql
CREATE TABLE ai_service_accounts (
  -- 基础标识
  id VARCHAR(255) PRIMARY KEY COMMENT '账户唯一标识',
  enterprise_id VARCHAR(255) NOT NULL COMMENT '所属企业ID',
  
  -- 基本信息（对应前端BasicInfoForm）
  name VARCHAR(255) NOT NULL COMMENT '账户名称',
  description TEXT COMMENT '账户描述',
  account_type ENUM('shared', 'dedicated') DEFAULT 'shared' COMMENT '账户类型：共享/专属',
  priority INT DEFAULT 50 COMMENT '账户优先级 (1-100)',
  
  -- 平台信息（对应前端PlatformSelector）
  platform ENUM('claude', 'gemini', 'claude_console') NOT NULL COMMENT '平台类型',
  auth_type ENUM('oauth', 'manual', 'api_key') NOT NULL COMMENT '认证类型',
  
  -- OAuth认证信息（对应前端OAuthFlow）
  oauth_access_token TEXT COMMENT 'OAuth访问令牌（加密存储）',
  oauth_refresh_token TEXT COMMENT 'OAuth刷新令牌（加密存储）',
  oauth_expires_at TIMESTAMP COMMENT 'OAuth令牌过期时间',
  oauth_scopes TEXT COMMENT 'OAuth授权范围',
  
  -- 手动Token信息（对应前端ManualTokenInput）
  manual_access_token TEXT COMMENT '手动输入的访问令牌（加密存储）',
  manual_refresh_token TEXT COMMENT '手动输入的刷新令牌（加密存储）',
  
  -- Claude Console特定配置（对应前端ClaudeConsoleConfig）
  claude_console_api_url VARCHAR(500) COMMENT 'Claude Console API URL',
  claude_console_api_key TEXT COMMENT 'Claude Console API Key（加密存储）',
  claude_console_user_agent VARCHAR(255) COMMENT 'Claude Console用户代理',
  claude_console_rate_limit_duration INT DEFAULT 60 COMMENT 'Claude Console速率限制时长(秒)',
  claude_console_supported_models JSON COMMENT 'Claude Console支持的模型列表',
  
  -- Gemini特定配置
  gemini_project_id VARCHAR(255) COMMENT 'Google Cloud项目ID',
  gemini_location VARCHAR(100) DEFAULT 'us-central1' COMMENT 'Gemini服务区域',
  
  -- 代理配置（对应前端ProxyConfigComponent）
  proxy_enabled BOOLEAN DEFAULT FALSE COMMENT '是否启用代理',
  proxy_type ENUM('socks5', 'http', 'https') COMMENT '代理类型',
  proxy_host VARCHAR(255) COMMENT '代理主机',
  proxy_port INT COMMENT '代理端口',
  proxy_auth_enabled BOOLEAN DEFAULT FALSE COMMENT '代理是否需要认证',
  proxy_username VARCHAR(255) COMMENT '代理用户名',
  proxy_password TEXT COMMENT '代理密码（加密存储）',
  
  -- 状态和统计
  is_enabled BOOLEAN DEFAULT TRUE COMMENT '是否启用',
  status ENUM('active', 'inactive', 'error', 'validating') DEFAULT 'active' COMMENT '账户状态',
  validation_status ENUM('pending', 'valid', 'invalid', 'expired') DEFAULT 'pending' COMMENT '验证状态',
  validation_message TEXT COMMENT '验证状态说明',
  error_message TEXT COMMENT '错误信息',
  
  -- 使用统计
  total_requests BIGINT DEFAULT 0 COMMENT '总请求数',
  total_tokens BIGINT DEFAULT 0 COMMENT '总Token数',
  total_cost DECIMAL(12, 4) DEFAULT 0 COMMENT '总费用',
  current_load INT DEFAULT 0 COMMENT '当前负载',
  last_used_at TIMESTAMP COMMENT '最后使用时间',
  
  -- 限制配置
  daily_limit INT DEFAULT 10000 COMMENT '日请求限制',
  cost_per_token DECIMAL(10, 8) DEFAULT 0.00001 COMMENT '每Token费用',
  timeout_ms INT DEFAULT 30000 COMMENT '请求超时时间(ms)',
  
  -- 审计字段
  created_by VARCHAR(255) NOT NULL COMMENT '创建者用户ID',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  
  -- 索引
  INDEX idx_enterprise_platform (enterprise_id, platform),
  INDEX idx_status (status, is_enabled),
  INDEX idx_validation (validation_status),
  INDEX idx_last_used (last_used_at),
  INDEX idx_priority (priority DESC),
  INDEX idx_created (created_at),
  
  -- 外键约束
  FOREIGN KEY (enterprise_id) REFERENCES enterprises(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id)
) COMMENT='AI服务账户表';
```

## 字段映射表

| 前端表单字段 | 数据库字段 | 类型 | 说明 |
|-------------|-----------|------|------|
| `form.name` | `name` | VARCHAR(255) | 账户名称 |
| `form.description` | `description` | TEXT | 账户描述 |
| `form.platform` | `platform` | ENUM | claude/gemini/claude_console |
| `form.addType` | `auth_type` | ENUM | oauth/manual |
| `form.accountType` | `account_type` | ENUM | shared/dedicated |
| `form.priority` | `priority` | INT | 优先级 |
| `form.projectId` | `gemini_project_id` | VARCHAR(255) | Gemini项目ID |
| `form.accessToken` | `manual_access_token` | TEXT | 手动访问令牌 |
| `form.refreshToken` | `manual_refresh_token` | TEXT | 手动刷新令牌 |
| `form.apiUrl` | `claude_console_api_url` | VARCHAR(500) | Claude Console API URL |
| `form.apiKey` | `claude_console_api_key` | TEXT | Claude Console API Key |
| `form.userAgent` | `claude_console_user_agent` | VARCHAR(255) | 用户代理 |
| `form.rateLimitDuration` | `claude_console_rate_limit_duration` | INT | 速率限制时长 |
| `form.supportedModels` | `claude_console_supported_models` | JSON | 支持的模型 |
| `form.proxy.enabled` | `proxy_enabled` | BOOLEAN | 代理启用状态 |
| `form.proxy.type` | `proxy_type` | ENUM | 代理类型 |
| `form.proxy.host` | `proxy_host` | VARCHAR(255) | 代理主机 |
| `form.proxy.port` | `proxy_port` | INT | 代理端口 |
| `form.proxy.username` | `proxy_username` | VARCHAR(255) | 代理用户名 |
| `form.proxy.password` | `proxy_password` | TEXT | 代理密码 |

## OAuth数据存储映射

### Claude OAuth数据
```javascript
// 前端创建账户时的数据格式
data.claudeAiOauth = {
  accessToken: form.accessToken,
  refreshToken: form.refreshToken,
  expiresAt: Date.now() + expiresInMs,
  scopes: ['user:inference']
};

// 对应数据库字段
oauth_access_token = encrypt(claudeAiOauth.accessToken)
oauth_refresh_token = encrypt(claudeAiOauth.refreshToken)
oauth_expires_at = FROM_UNIXTIME(claudeAiOauth.expiresAt/1000)
oauth_scopes = JSON_ARRAY('user:inference')
```

### Gemini OAuth数据
```javascript
// 前端创建账户时的数据格式
data.geminiOauth = {
  access_token: form.accessToken,
  refresh_token: form.refreshToken,
  scope: 'https://www.googleapis.com/auth/cloud-platform',
  token_type: 'Bearer',
  expiry_date: Date.now() + expiresInMs
};

// 对应数据库字段
oauth_access_token = encrypt(geminiOauth.access_token)
oauth_refresh_token = encrypt(geminiOauth.refresh_token) 
oauth_expires_at = FROM_UNIXTIME(geminiOauth.expiry_date/1000)
oauth_scopes = 'https://www.googleapis.com/auth/cloud-platform'
```

## 常用查询示例

### 1. 获取企业的所有可用账户
```sql
SELECT 
  id, name, platform, auth_type, account_type, priority,
  status, validation_status, last_used_at, current_load
FROM ai_service_accounts 
WHERE enterprise_id = ? 
  AND is_enabled = TRUE 
  AND status = 'active'
ORDER BY priority DESC, current_load ASC;
```

### 2. 获取特定平台的账户
```sql
SELECT * FROM ai_service_accounts 
WHERE enterprise_id = ? 
  AND platform = ?
  AND is_enabled = TRUE 
  AND validation_status = 'valid'
ORDER BY priority DESC;
```

### 3. 账户使用统计
```sql
SELECT 
  platform,
  COUNT(*) as total_accounts,
  SUM(total_requests) as total_requests,
  SUM(total_tokens) as total_tokens,
  SUM(total_cost) as total_cost,
  AVG(current_load) as avg_load
FROM ai_service_accounts 
WHERE enterprise_id = ?
  AND is_enabled = TRUE
GROUP BY platform;
```

### 4. 需要刷新Token的账户
```sql
SELECT id, name, platform, oauth_expires_at
FROM ai_service_accounts 
WHERE auth_type = 'oauth'
  AND oauth_expires_at IS NOT NULL
  AND oauth_expires_at <= DATE_ADD(NOW(), INTERVAL 5 MINUTE)
  AND is_enabled = TRUE;
```

## 数据安全

### 加密字段列表
以下字段需要在应用层进行加密/解密：
- `oauth_access_token`
- `oauth_refresh_token` 
- `manual_access_token`
- `manual_refresh_token`
- `claude_console_api_key`
- `proxy_password`

### 加密实现建议
```javascript
// 加密示例（Node.js）
const crypto = require('crypto');
const algorithm = 'aes-256-gcm';
const secretKey = process.env.ENCRYPTION_KEY; // 32字节密钥

function encrypt(text) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipher(algorithm, secretKey, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const tag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted}`;
}

function decrypt(encryptedData) {
  const [ivHex, tagHex, encrypted] = encryptedData.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const tag = Buffer.from(tagHex, 'hex');
  const decipher = crypto.createDecipher(algorithm, secretKey, iv);
  decipher.setAuthTag(tag);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}
```

## Prisma Schema 更新建议

```prisma
model AiServiceAccount {
  id                    String    @id @default(cuid())
  enterpriseId          String
  
  // 基本信息
  name                  String
  description           String?
  accountType           String    @default("shared") // shared, dedicated
  priority              Int       @default(50)
  
  // 平台信息
  platform              String    // claude, gemini, claude_console
  authType              String    // oauth, manual, api_key
  
  // OAuth认证
  oauthAccessToken      String?   @db.Text
  oauthRefreshToken     String?   @db.Text
  oauthExpiresAt        DateTime?
  oauthScopes           String?
  
  // 手动Token
  manualAccessToken     String?   @db.Text
  manualRefreshToken    String?   @db.Text
  
  // Claude Console配置
  claudeConsoleApiUrl           String?
  claudeConsoleApiKey           String?   @db.Text
  claudeConsoleUserAgent        String?
  claudeConsoleRateLimitDuration Int?     @default(60)
  claudeConsoleSupportedModels  Json?
  
  // Gemini配置
  geminiProjectId       String?
  geminiLocation        String?   @default("us-central1")
  
  // 代理配置
  proxyEnabled          Boolean   @default(false)
  proxyType             String?   // socks5, http, https
  proxyHost             String?
  proxyPort             Int?
  proxyAuthEnabled      Boolean   @default(false)
  proxyUsername         String?
  proxyPassword         String?   @db.Text
  
  // 状态
  isEnabled             Boolean   @default(true)
  status                String    @default("active") // active, inactive, error, validating
  validationStatus      String    @default("pending") // pending, valid, invalid, expired
  validationMessage     String?   @db.Text
  errorMessage          String?   @db.Text
  
  // 统计
  totalRequests         BigInt    @default(0)
  totalTokens           BigInt    @default(0)
  totalCost             Decimal   @default(0) @db.Decimal(12, 4)
  currentLoad           Int       @default(0)
  lastUsedAt            DateTime?
  
  // 限制
  dailyLimit            Int       @default(10000)
  costPerToken          Decimal   @default(0.00001) @db.Decimal(10, 8)
  timeoutMs             Int       @default(30000)
  
  // 审计
  createdBy             String
  createdAt             DateTime  @default(now())
  updatedAt             DateTime  @updatedAt
  
  // 关联
  enterprise            Enterprise @relation(fields: [enterpriseId], references: [id], onDelete: Cascade)
  creator               User       @relation(fields: [createdBy], references: [id])
  
  // 索引
  @@index([enterpriseId, platform])
  @@index([status, isEnabled])
  @@index([validationStatus])
  @@index([lastUsedAt])
  @@index([priority])
  
  @@map("ai_service_accounts")
}
```

这个设计完全对应前端的所有功能，移除了组管理的复杂性，专注于单个账户的完整管理。

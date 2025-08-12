# API 文档

## 基础信息

- **基础URL**: `http://localhost:4000/api` (开发环境) 
- **认证方式**: Bearer Token (JWT)
- **响应格式**: JSON

## 认证

所有API请求（除登录、注册外）都需要在Header中携带认证token：

```http
Authorization: Bearer <your-token>
```

Token会自动刷新，客户端无需手动处理过期问题。

## 核心接口

### 认证相关

#### 登录
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password"
}

Response:
{
  "success": true,
  "data": {
    "user": { ... },
    "tokens": {
      "accessToken": "...",
      "refreshToken": "...",
      "expiresIn": 900
    }
  }
}
```

#### 注册
```http
POST /api/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password",
  "name": "User Name"
}
```

#### 刷新Token
```http
POST /api/auth/refresh
Content-Type: application/json

{
  "refreshToken": "your-refresh-token"
}
```

#### 获取当前用户
```http
GET /api/auth/me
```

### 企业管理

#### 获取企业列表
```http
GET /api/enterprises
```

#### 创建企业
```http
POST /api/enterprises
Content-Type: application/json

{
  "name": "企业名称",
  "description": "企业描述"
}
```

#### 获取企业详情
```http
GET /api/enterprises/[enterpriseId]
```

#### 更新企业信息
```http
PUT /api/enterprises/[enterpriseId]
Content-Type: application/json

{
  "name": "新名称",
  "description": "新描述"
}
```

### 拼车组管理

#### 获取拼车组列表
```http
GET /api/groups
```

#### 创建拼车组
```http
POST /api/groups
Content-Type: application/json

{
  "name": "组名称",
  "description": "组描述",
  "enterpriseId": "企业ID(可选)"
}
```

#### 获取拼车组详情
```http
GET /api/groups/[groupId]
```

#### 邀请成员
```http
POST /api/groups/[groupId]/invite
Content-Type: application/json

{
  "email": "member@example.com",
  "role": "member"
}
```

### AI账号管理

#### 获取企业AI账号列表
```http
GET /api/enterprises/[enterpriseId]/ai-accounts
```

#### 添加AI账号
```http
POST /api/enterprises/[enterpriseId]/ai-accounts
Content-Type: application/json

{
  "name": "账号名称",
  "platform": "claude|gemini|qwen|zhipu",
  "authType": "oauth|api_key",
  "credentials": { ... }
}
```

#### 测试AI账号
```http
POST /api/enterprises/[enterpriseId]/ai-accounts/[accountId]/test
```

### API Key管理

#### 获取API Key列表
```http
GET /api/groups/[groupId]/api-keys
```

#### 创建API Key
```http
POST /api/groups/[groupId]/api-keys
Content-Type: application/json

{
  "name": "Key名称",
  "userId": "用户ID",
  "quotaLimit": 1000000,
  "expiresAt": "2025-12-31T23:59:59Z"
}
```

#### 删除API Key
```http
DELETE /api/groups/[groupId]/api-keys/[keyId]
```

### AI代理接口

#### 聊天完成（兼容OpenAI格式）
```http
POST /api/ai-proxy/chat
Content-Type: application/json
Authorization: Bearer <api-key>

{
  "model": "claude-3-opus",
  "messages": [
    {
      "role": "user",
      "content": "Hello"
    }
  ],
  "stream": false
}
```

### 统计与监控

#### 获取使用统计
```http
GET /api/groups/[groupId]/usage-stats?
  startDate=2025-01-01&
  endDate=2025-01-31
```

#### 获取系统健康状态
```http
GET /api/health
```

#### 获取性能指标
```http
GET /api/metrics
```

## 错误处理

### 错误响应格式
```json
{
  "success": false,
  "error": "错误描述",
  "code": "ERROR_CODE",
  "details": { ... }
}
```

### 常见错误码

| 状态码 | 错误码 | 说明 |
|-------|--------|------|
| 400 | BAD_REQUEST | 请求参数错误 |
| 401 | UNAUTHORIZED | 未认证或token过期 |
| 403 | FORBIDDEN | 无权限访问 |
| 404 | NOT_FOUND | 资源不存在 |
| 429 | RATE_LIMITED | 请求频率超限 |
| 500 | INTERNAL_ERROR | 服务器内部错误 |

## WebSocket接口

### 实时监控
```javascript
const ws = new WebSocket('ws://localhost:4000/ws/monitor');

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  // 处理实时数据
};
```

## SDK使用示例

### JavaScript/TypeScript
```typescript
import { apiClient } from '@/lib/api/api-client';

// 获取用户信息
const user = await apiClient.get('/api/auth/me');

// 创建拼车组
const group = await apiClient.post('/api/groups', {
  name: '新组',
  description: '描述'
});
```

### cURL示例
```bash
# 登录获取token
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@aicarpool.com","password":"admin123456"}'

# 使用token调用API
curl http://localhost:4000/api/groups \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## 限流策略

- 默认限制: 100请求/分钟
- AI代理接口: 60请求/分钟
- 认证接口: 10请求/分钟

超出限制会返回429状态码，响应头包含：
- `X-RateLimit-Limit`: 限制数量
- `X-RateLimit-Remaining`: 剩余请求数
- `X-RateLimit-Reset`: 重置时间

## 更多信息

详细的API使用说明和示例代码，请参考：
- [认证系统文档](./token-refresh-system.md)
- [架构文档](./aicarpool-current-architecture.md)
- [业务流程文档](./aicarpool-core-business-flow.md)
# Claude Code 代理服务体系设计

## 项目概述

基于现有的 aicarpool 和 claude-relay-service 项目，设计两套独立的 Claude Code 代理服务体系，满足不同规模和部署需求。

## 体系1：边缘节点分布式服务（基于 aicarpool）

### 架构设计

```
用户 Claude Code CLI → 边缘节点集群 → Claude API
                    ↓
                 本地SQLite存储
                    ↑
                中央管理服务（可选）
```

### 核心特性

1. **分布式部署**
   - 多地域边缘节点部署
   - 就近服务，降低延迟
   - 自动负载均衡和故障转移

2. **Claude Code 专用优化**
   - 专门的 Claude Code CLI 认证
   - 支持 Claude Code 特有的 headers 和参数
   - 完整的工具调用和文件操作支持

3. **本地化存储**
   - SQLite 本地数据库
   - 用户配置和使用统计本地存储
   - 节点间配置同步（可选）

### 技术实现

#### 1. 扩展 AiProxyService

```typescript
// src/services/ClaudeCodeProxyService.ts
export class ClaudeCodeProxyService extends AiProxyService {
  private claudeCodeConfig: ClaudeCodeConfig;
  
  constructor(edgeClient: EdgeClient) {
    super(edgeClient);
    this.claudeCodeConfig = {
      supportedVersions: ['1.0.57', '1.0.58', '1.0.59'],
      defaultHeaders: {
        'x-stainless-lang': 'js',
        'x-stainless-package-version': '0.55.1',
        'anthropic-dangerous-direct-browser-access': 'true',
        'x-app': 'cli'
      },
      systemPrompt: 'You are Claude Code, Anthropic\'s official CLI for Claude.'
    };
  }

  /**
   * 验证 Claude Code CLI 请求
   */
  validateClaudeCodeRequest(request: ProxyRequest): boolean {
    const userAgent = request.headers?.['user-agent'] || '';
    return /claude-cli\/\d+\.\d+\.\d+/.test(userAgent);
  }

  /**
   * 处理 Claude Code 专用请求
   */
  async handleClaudeCodeRequest(request: ProxyRequest): Promise<ProxyResponse> {
    // 验证 Claude Code 身份
    if (!this.validateClaudeCodeRequest(request)) {
      throw new Error('Invalid Claude Code request');
    }

    // 注入 Claude Code 系统提示词
    if (!this.hasClaudeCodeSystemPrompt(request.messages)) {
      request.messages = this.injectClaudeCodeSystemPrompt(request.messages);
    }

    // 添加 Claude Code 特定 headers
    request.headers = {
      ...this.claudeCodeConfig.defaultHeaders,
      ...request.headers
    };

    return this.handleProxyRequest(request);
  }

  private hasClaudeCodeSystemPrompt(messages: any[]): boolean {
    return messages.some(msg => 
      msg.role === 'system' && 
      msg.content?.includes('You are Claude Code')
    );
  }

  private injectClaudeCodeSystemPrompt(messages: any[]): any[] {
    const systemPrompt = {
      role: 'system',
      content: this.claudeCodeConfig.systemPrompt
    };
    
    return [systemPrompt, ...messages.filter(msg => msg.role !== 'system')];
  }
}
```

#### 2. 用户认证和配额管理

```typescript
// src/services/ClaudeCodeAuthService.ts
export class ClaudeCodeAuthService {
  private db: Database;
  
  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.initializeSchema();
  }

  /**
   * 初始化数据库架构
   */
  private initializeSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS claude_code_users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        api_key TEXT UNIQUE NOT NULL,
        user_id TEXT UNIQUE NOT NULL,
        quota_daily INTEGER DEFAULT 10000,
        quota_monthly INTEGER DEFAULT 300000,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_used_at DATETIME,
        status TEXT DEFAULT 'active'
      );

      CREATE TABLE IF NOT EXISTS usage_stats (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        date TEXT NOT NULL,
        input_tokens INTEGER DEFAULT 0,
        output_tokens INTEGER DEFAULT 0,
        requests_count INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, date)
      );

      CREATE INDEX IF NOT EXISTS idx_usage_user_date ON usage_stats(user_id, date);
    `);
  }

  /**
   * 验证 API Key
   */
  async validateApiKey(apiKey: string): Promise<UserInfo | null> {
    const user = this.db.prepare(`
      SELECT * FROM claude_code_users 
      WHERE api_key = ? AND status = 'active'
    `).get(apiKey);

    if (!user) return null;

    // 检查配额
    const today = new Date().toISOString().split('T')[0];
    const usage = await this.getUsageStats(user.user_id, today);
    
    if (usage.input_tokens + usage.output_tokens >= user.quota_daily) {
      throw new Error('Daily quota exceeded');
    }

    return user;
  }

  /**
   * 记录使用统计
   */
  async recordUsage(userId: string, inputTokens: number, outputTokens: number): Promise<void> {
    const today = new Date().toISOString().split('T')[0];
    
    this.db.prepare(`
      INSERT INTO usage_stats (user_id, date, input_tokens, output_tokens, requests_count)
      VALUES (?, ?, ?, ?, 1)
      ON CONFLICT(user_id, date) DO UPDATE SET
        input_tokens = input_tokens + ?,
        output_tokens = output_tokens + ?,
        requests_count = requests_count + 1
    `).run(userId, today, inputTokens, outputTokens, inputTokens, outputTokens);
  }
}
```

#### 3. 节点配置和发现

```typescript
// src/services/NodeDiscoveryService.ts
export class NodeDiscoveryService {
  private nodes: Map<string, EdgeNodeInfo> = new Map();
  private currentNode: EdgeNodeInfo;

  constructor(private config: EdgeNodeConfig) {
    this.currentNode = {
      id: this.generateNodeId(),
      endpoint: config.node.endpoint,
      location: config.node.location,
      capabilities: ['claude-code-proxy'],
      healthScore: 100,
      lastHeartbeat: new Date()
    };
  }

  /**
   * 注册当前节点
   */
  async registerNode(): Promise<void> {
    // 向中央服务注册节点信息
    const response = await this.sendRegistration();
    
    if (response.success) {
      console.log(`节点已注册: ${this.currentNode.id}`);
      this.startHeartbeat();
    }
  }

  /**
   * 发现可用节点
   */
  async discoverNodes(): Promise<EdgeNodeInfo[]> {
    try {
      const response = await this.fetchNodeList();
      return response.nodes.filter(node => 
        node.capabilities.includes('claude-code-proxy') &&
        node.healthScore > 80
      );
    } catch (error) {
      console.error('节点发现失败:', error);
      return [];
    }
  }

  /**
   * 选择最佳节点
   */
  selectBestNode(nodes: EdgeNodeInfo[], userLocation?: string): EdgeNodeInfo {
    if (nodes.length === 0) return this.currentNode;

    // 基于地理位置和健康评分选择最佳节点
    const scored = nodes.map(node => ({
      node,
      score: this.calculateNodeScore(node, userLocation)
    }));

    scored.sort((a, b) => b.score - a.score);
    return scored[0].node;
  }

  private calculateNodeScore(node: EdgeNodeInfo, userLocation?: string): number {
    let score = node.healthScore;
    
    // 地理位置加权
    if (userLocation && node.location === userLocation) {
      score += 20;
    }
    
    // 延迟加权（如果有延迟数据）
    if (node.averageLatency) {
      score -= Math.min(node.averageLatency / 10, 30);
    }
    
    return Math.max(0, score);
  }
}
```

### 部署方案

#### 1. Docker 容器化

```dockerfile
# Dockerfile.edge-node
FROM node:18-alpine

WORKDIR /app

# 安装依赖
COPY package*.json ./
RUN npm ci --only=production

# 复制源码
COPY . .
RUN npm run build

# 创建数据目录
RUN mkdir -p /app/data /app/logs

# 暴露端口
EXPOSE 3000

# 启动服务
CMD ["npm", "start"]
```

#### 2. 配置管理

```yaml
# config/edge-node.yml
node:
  name: "claude-code-edge-01"
  location: "us-west-1"
  endpoint: "https://edge-01.example.com"
  capabilities:
    - "claude-code-proxy"
    - "file-operations"
    - "tool-calling"

centralServer:
  url: "https://central.example.com"
  wsUrl: "wss://central.example.com/ws"
  timeout: 30000

claudeCode:
  supportedVersions:
    - "1.0.57"
    - "1.0.58" 
    - "1.0.59"
  defaultQuota:
    daily: 10000
    monthly: 300000
  features:
    - "chat"
    - "tools"
    - "files"
    - "memory"

storage:
  type: "sqlite"
  path: "/app/data/edge.db"
  backupInterval: 3600000
```

#### 3. 监控和日志

```typescript
// src/services/ClaudeCodeMetricsService.ts
export class ClaudeCodeMetricsService extends MetricsService {
  /**
   * 记录 Claude Code 特定指标
   */
  async recordClaudeCodeMetrics(metrics: ClaudeCodeMetrics): Promise<void> {
    await this.recordMetric({
      type: 'claude_code_request',
      timestamp: new Date(),
      data: {
        version: metrics.clientVersion,
        requestType: metrics.requestType,
        tokensUsed: metrics.tokensUsed,
        responseTime: metrics.responseTime,
        success: metrics.success,
        tools: metrics.toolsUsed,
        files: metrics.filesAccessed
      }
    });
  }

  /**
   * 生成 Claude Code 使用报告
   */
  async generateClaudeCodeReport(timeRange: string): Promise<ClaudeCodeReport> {
    const metrics = await this.getMetrics('claude_code_request', timeRange);
    
    return {
      totalRequests: metrics.length,
      successRate: this.calculateSuccessRate(metrics),
      averageResponseTime: this.calculateAverageResponseTime(metrics),
      topTools: this.getTopTools(metrics),
      versionDistribution: this.getVersionDistribution(metrics),
      tokenUsage: this.calculateTokenUsage(metrics)
    };
  }
}
```

### 优势特点

1. **高可用性**: 多节点分布式架构，单点故障不影响整体服务
2. **低延迟**: 边缘节点就近服务，减少网络延迟
3. **可扩展**: 水平扩展，根据负载自动增减节点
4. **本地化**: 数据本地存储，符合数据主权要求
5. **专业化**: 专门针对 Claude Code CLI 优化

### 适用场景

- 企业级大规模部署
- 多地域服务需求
- 对延迟敏感的应用
- 需要高可用性的生产环境
- 有数据本地化要求的组织

## 部署指南

### 环境要求

- Node.js 18+ / TypeScript 5+
- 数据库：PostgreSQL 13+ 或 SQLite 3+
- Redis 6+ (可选，用于集群同步)
- 操作系统：Linux/macOS/Windows
- 内存：最少 2GB，推荐 4GB+
- 磁盘：最少 10GB 可用空间

### 快速部署

#### 1. 克隆和安装

```bash
# 克隆项目
git clone <repository-url>
cd aicarpool

# 安装依赖
npm install

# 构建 edge-client
cd edge-client
npm install
npm run build
```

#### 2. 配置设置

```bash
# 复制配置模板
cp edge-client/config/default.json edge-client/config/production.json

# 生成密钥对
cd edge-client
npm run generate-keys
```

#### 3. 配置文件示例

```json
{
  "node": {
    "name": "claude-code-edge-01",
    "location": "us-west-1",
    "endpoint": "https://your-domain.com",
    "capabilities": {
      "cpu": { "cores": 4, "frequency": "2.4GHz" },
      "memory": { "total": "8GB", "available": "6GB" },
      "network": { "bandwidth": "1Gbps", "latency": 10 },
      "maxConnections": 1000
    }
  },
  "server": {
    "port": 8080,
    "host": "0.0.0.0",
    "requestTimeout": 120000
  },
  "claudeCode": {
    "enabled": true,
    "supportedVersions": ["1.0.55", "1.0.56", "1.0.57", "1.0.58", "1.0.59"],
    "quotaLimits": {
      "daily": 50000,
      "monthly": 1500000
    },
    "features": {
      "tools": true,
      "files": true,
      "streaming": true,
      "memory": true
    }
  }
}
```

#### 4. 启动服务

```bash
# 开发模式
npm run dev

# 生产模式
npm start

# 使用 PM2 (推荐)
npm install -g pm2
pm2 start ecosystem.config.js
```

### Docker 部署

#### 1. 构建镜像

```dockerfile
FROM node:18-alpine

WORKDIR /app

# 安装依赖
COPY package*.json ./
COPY edge-client/package*.json ./edge-client/
RUN npm ci --only=production && \
    cd edge-client && npm ci --only=production

# 复制源码并构建
COPY . .
RUN cd edge-client && npm run build

# 创建数据目录
RUN mkdir -p /app/data /app/logs /app/certs

# 暴露端口
EXPOSE 8080

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD curl -f http://localhost:8080/health || exit 1

# 启动命令
CMD ["npm", "start"]
```

#### 2. Docker Compose 配置

```yaml
version: '3.8'

services:
  claude-code-proxy:
    build: .
    ports:
      - "8080:8080"
    environment:
      - NODE_ENV=production
      - LOG_LEVEL=info
    volumes:
      - ./data:/app/data
      - ./logs:/app/logs
      - ./certs:/app/certs
      - ./config:/app/edge-client/config
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8080/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 60s

  # 可选：Redis 用于集群同步
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    restart: unless-stopped

volumes:
  redis_data:
```

#### 3. 启动服务

```bash
# 构建并启动
docker-compose up -d

# 查看日志
docker-compose logs -f claude-code-proxy

# 停止服务
docker-compose down
```

### Kubernetes 部署

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: claude-code-proxy
  labels:
    app: claude-code-proxy
spec:
  replicas: 3
  selector:
    matchLabels:
      app: claude-code-proxy
  template:
    metadata:
      labels:
        app: claude-code-proxy
    spec:
      containers:
      - name: claude-code-proxy
        image: your-registry/claude-code-proxy:latest
        ports:
        - containerPort: 8080
        env:
        - name: NODE_ENV
          value: "production"
        - name: LOG_LEVEL
          value: "info"
        resources:
          requests:
            memory: "512Mi"
            cpu: "250m"
          limits:
            memory: "2Gi"
            cpu: "1000m"
        livenessProbe:
          httpGet:
            path: /health
            port: 8080
          initialDelaySeconds: 60
          periodSeconds: 30
        readinessProbe:
          httpGet:
            path: /health
            port: 8080
          initialDelaySeconds: 10
          periodSeconds: 10
        volumeMounts:
        - name: config
          mountPath: /app/edge-client/config
        - name: data
          mountPath: /app/data
      volumes:
      - name: config
        configMap:
          name: claude-code-proxy-config
      - name: data
        persistentVolumeClaim:
          claimName: claude-code-proxy-data

---
apiVersion: v1
kind: Service
metadata:
  name: claude-code-proxy
spec:
  selector:
    app: claude-code-proxy
  ports:
    - protocol: TCP
      port: 80
      targetPort: 8080
  type: LoadBalancer
```

### 使用方法

#### Claude Code CLI 配置

```bash
# 设置代理端点
export ANTHROPIC_API_URL="http://your-proxy-domain/v1"

# 或者在 Claude Code 配置文件中设置
echo '{"api_url": "http://your-proxy-domain/v1"}' > ~/.config/claude-code/config.json
```

#### API 使用示例

```bash
# 发送消息
curl -X POST http://your-proxy-domain/v1/messages \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -H "User-Agent: claude-cli/1.0.57 (external, cli)" \
  -d '{
    "model": "claude-3-5-sonnet-20241022",
    "max_tokens": 4096,
    "messages": [
      {"role": "user", "content": "Hello, Claude!"}
    ]
  }'

# 获取用户信息
curl -X GET http://your-proxy-domain/v1/user \
  -H "X-API-Key: your-api-key" \
  -H "User-Agent: claude-cli/1.0.57 (external, cli)"

# 获取使用统计
curl -X GET http://your-proxy-domain/v1/usage \
  -H "X-API-Key: your-api-key" \
  -H "User-Agent: claude-cli/1.0.57 (external, cli)"
```

### 监控和维护

#### 1. 健康检查

```bash
# 检查服务状态
curl http://your-proxy-domain/health

# 预期响应
{
  "status": "healthy",
  "service": "aicarpool-edge-client",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "uptime": 3600,
  "node_id": "edge_node_123",
  "connected": true
}
```

#### 2. 日志监控

```bash
# 查看实时日志
tail -f logs/edge-client.log

# 使用 journalctl (systemd)
journalctl -f -u claude-code-proxy

# Docker 日志
docker-compose logs -f claude-code-proxy
```

#### 3. 性能监控

- CPU 使用率应保持在 70% 以下
- 内存使用率应保持在 80% 以下
- 响应时间应保持在 2 秒以下
- 成功率应保持在 99% 以上

#### 4. 告警配置

```yaml
# Prometheus 告警规则示例
groups:
- name: claude-code-proxy
  rules:
  - alert: HighErrorRate
    expr: (rate(http_requests_total{status=~"5.."}[5m]) / rate(http_requests_total[5m])) > 0.01
    for: 2m
    labels:
      severity: warning
    annotations:
      summary: "High error rate detected"
      
  - alert: HighResponseTime
    expr: histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m])) > 2
    for: 5m
    labels:
      severity: warning
    annotations:
      summary: "High response time detected"
```

### 故障排除

#### 常见问题

1. **连接中央服务器失败**
   ```bash
   # 检查网络连接
   ping central-server.com
   telnet central-server.com 443
   
   # 检查证书
   openssl s_client -connect central-server.com:443
   ```

2. **API Key 认证失败**
   ```bash
   # 检查 API Key 格式
   echo $API_KEY | wc -c  # 应该大于 20
   
   # 检查 User-Agent
   curl -I -H "User-Agent: claude-cli/1.0.57 (external, cli)" http://your-proxy-domain/health
   ```

3. **配额超限**
   ```bash
   # 查看用户配额
   curl -H "X-API-Key: your-api-key" http://your-proxy-domain/v1/user
   
   # 重置配额（管理员）
   curl -X POST http://your-proxy-domain/admin/reset-quota
   ```

#### 性能优化

1. **调整 Node.js 参数**
   ```bash
   # 增加内存限制
   export NODE_OPTIONS="--max-old-space-size=4096"
   
   # 启用 HTTP/2
   export NODE_OPTIONS="--experimental-http-parser"
   ```

2. **数据库优化**
   ```sql
   -- 添加索引
   CREATE INDEX idx_usage_timestamp ON usage_stats(timestamp);
   CREATE INDEX idx_usage_user_id ON usage_stats(user_id);
   
   -- 清理旧数据
   DELETE FROM usage_stats WHERE timestamp < NOW() - INTERVAL '30 days';
   ```

3. **缓存优化**
   ```bash
   # Redis 配置优化
   redis-cli CONFIG SET maxmemory 1gb
   redis-cli CONFIG SET maxmemory-policy allkeys-lru
   ```

### 安全注意事项

1. **API Key 管理**
   - 使用强随机生成器生成 API Key
   - 定期轮换 API Key
   - 实施 API Key 作用域限制

2. **网络安全**
   - 启用 HTTPS
   - 配置防火墙规则
   - 使用 VPN 或专线连接

3. **访问控制**
   - 实施 IP 白名单
   - 配置速率限制
   - 启用审计日志

4. **数据保护**
   - 加密敏感数据
   - 定期备份数据
   - 实施数据保留策略

### 更新和维护

#### 1. 滚动更新

```bash
# 拉取最新代码
git pull origin main

# 安装依赖
npm install
cd edge-client && npm install

# 构建
npm run build

# 重启服务
pm2 reload claude-code-proxy
```

#### 2. 数据库迁移

```bash
# 备份数据库
pg_dump claude_code_proxy > backup_$(date +%Y%m%d).sql

# 运行迁移
npm run migrate

# 验证数据完整性
npm run verify-data
```

#### 3. 配置更新

```bash
# 备份当前配置
cp config/production.json config/production.json.backup

# 更新配置
vim config/production.json

# 验证配置
npm run validate-config

# 重载配置
pm2 reload claude-code-proxy
```

# AI Carpool 边缘节点客户端

## 项目简介

AI Carpool 边缘节点客户端是一个轻量级的 Node.js 服务，用于在分布式环境中提供 AI 服务代理和负载均衡功能。它作为边缘计算节点，将 AI 服务请求就近处理，提高响应速度并减少中央服务器负载。

## 主要功能

- **节点注册与认证**: 自动向中央服务器注册并获取认证凭据
- **心跳监控**: 定期上报节点状态和性能指标
- **配置同步**: 从中央服务器同步配置并实时更新
- **健康监控**: 监控系统资源使用情况并上报健康状态
- **AI 服务代理**: 代理 AI 服务请求并进行负载均衡
- **安全通信**: 基于 RSA 密钥对的安全通信机制
- **优雅关闭**: 支持优雅关闭和重启

## 系统要求

- Node.js >= 18.0.0
- npm >= 8.0.0
- 支持的操作系统: Linux, macOS, Windows
- 内存: 至少 512MB RAM
- 存储: 至少 1GB 可用空间

## 快速开始

### 1. 安装依赖

```bash
cd edge-client
npm install
```

### 2. 配置环境变量

复制环境变量模板：

```bash
cp .env.example .env
```

编辑 `.env` 文件，配置必要的环境变量：

```bash
# 节点基本信息
NODE_NAME=your-edge-node-name
NODE_LOCATION=Beijing
NODE_ENDPOINT=https://your-domain.com:8080

# 中央服务器
CENTRAL_SERVER_URL=https://aicarpool.example.com
CENTRAL_SERVER_WS_URL=wss://aicarpool.example.com/ws

# 服务器配置
PORT=8080
HOST=0.0.0.0
```

### 3. 生成密钥对（可选）

边缘客户端会在首次启动时自动生成密钥对，或者你可以手动生成：

```bash
mkdir -p certs
openssl genrsa -out certs/node-private-key.pem 2048
openssl rsa -in certs/node-private-key.pem -pubout -out certs/node-public-key.pem
```

### 4. 启动服务

开发模式：

```bash
npm run dev
```

生产模式：

```bash
npm run build
npm start
```

使用 PM2 管理：

```bash
npm run pm2:start
```

## 目录结构

```
edge-client/
├── src/                    # 源代码
│   ├── core/              # 核心模块
│   │   ├── EdgeClient.ts  # 边缘客户端主类
│   │   ├── HeartbeatManager.ts    # 心跳管理器
│   │   ├── ConfigManager.ts       # 配置管理器
│   │   └── HealthMonitor.ts       # 健康监控器
│   ├── services/          # 业务服务
│   ├── middleware/        # 中间件
│   ├── utils/             # 工具函数
│   ├── types/             # 类型定义
│   └── index.ts           # 主入口文件
├── config/                # 配置文件
│   ├── default.json       # 默认配置
│   ├── development.json   # 开发环境配置
│   ├── production.json    # 生产环境配置
│   └── edge-node.template.json    # 配置模板
├── certs/                 # 证书和密钥文件
├── logs/                  # 日志文件
└── scripts/               # 脚本文件
```

## 配置说明

### 环境变量

| 变量名 | 描述 | 默认值 |
|--------|------|--------|
| `NODE_NAME` | 节点名称 | `edge-node-001` |
| `NODE_LOCATION` | 节点地理位置 | `Beijing` |
| `NODE_ENDPOINT` | 节点对外端点 | `https://localhost:8080` |
| `CENTRAL_SERVER_URL` | 中央服务器地址 | `https://aicarpool.example.com` |
| `PORT` | 服务端口 | `8080` |
| `LOG_LEVEL` | 日志级别 | `info` |
| `DEBUG` | 调试模式 | `false` |

### 配置文件

配置文件采用分层结构，支持不同环境的配置：

- `default.json`: 基础配置
- `development.json`: 开发环境特定配置
- `production.json`: 生产环境特定配置

配置优先级：环境变量 > 环境配置文件 > 默认配置文件

## API 接口

### 健康检查

```http
GET /health
```

返回节点健康状态信息。

### 节点信息

```http
GET /info
```

返回节点基本信息和状态。

### 指标查询

```http
GET /metrics
```

返回节点性能指标数据。

## 部署指南

### Docker 部署

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY dist/ ./dist/
COPY config/ ./config/

EXPOSE 8080

CMD ["npm", "start"]
```

### PM2 部署

使用提供的 `ecosystem.config.js` 配置文件：

```bash
npm run build
npm run pm2:start
```

### 系统服务

创建 systemd 服务文件：

```ini
[Unit]
Description=AI Carpool Edge Client
After=network.target

[Service]
Type=simple
User=edgenode
WorkingDirectory=/opt/edge-client
ExecStart=/usr/bin/node dist/index.js
Restart=always
RestartSec=5
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

## 监控和日志

### 日志文件

日志文件位于 `logs/` 目录下：

- `app.log`: 应用日志
- `error.log`: 错误日志
- `pm2-*.log`: PM2 进程日志

### 监控指标

边缘客户端会自动收集以下指标：

- CPU 使用率
- 内存使用率
- 网络流量
- 连接数
- 请求响应时间
- 错误率

### 健康检查

系统会定期执行健康检查，监控：

- 系统资源使用情况
- 网络连接状态
- 服务可用性
- 磁盘空间

## 故障排除

### 常见问题

1. **节点无法注册**
   - 检查中央服务器地址是否正确
   - 确认网络连接正常
   - 检查密钥文件是否存在

2. **WebSocket 连接失败**
   - 检查 WebSocket URL 配置
   - 确认防火墙设置
   - 检查 SSL 证书配置

3. **性能指标异常**
   - 检查系统资源使用情况
   - 查看错误日志
   - 重启服务

### 调试模式

启用调试模式获取详细日志：

```bash
DEBUG=true npm run dev
```

## 开发指南

### 开发环境设置

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 运行测试
npm test

# 代码检查
npm run lint
```

### 代码结构

- 使用 TypeScript 进行类型安全的开发
- 采用事件驱动架构
- 模块化设计，易于扩展
- 完善的错误处理机制

### 贡献指南

1. Fork 项目
2. 创建特性分支
3. 提交变更
4. 推送到分支
5. 创建 Pull Request

## 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。

## 支持

如有问题或需要支持，请：

1. 查看文档和常见问题
2. 创建 GitHub Issue
3. 联系项目维护者

## 版本历史

### v1.0.0
- 初始版本发布
- 支持节点注册和认证
- 实现心跳监控和健康检查
- 支持配置同步
- 提供基础的 AI 服务代理功能
# AiCarpool - AI服务共享平台

<div align="center">

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Next.js](https://img.shields.io/badge/Next.js-15.4+-blue.svg)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5+-blue.svg)](https://www.typescriptlang.org/)
[![MySQL](https://img.shields.io/badge/MySQL-8+-orange.svg)](https://www.mysql.com/)
[![Redis](https://img.shields.io/badge/Redis-7+-red.svg)](https://redis.io/)

**🚗 企业级AI服务共享管理平台 - 让AI服务更高效、更经济**

[快速开始](#-快速开始) • [核心功能](#-核心功能) • [系统架构](#-系统架构) • [部署指南](#-部署指南) • [API文档](docs/api.md)

</div>

---

## 📌 项目简介

AiCarpool 是一个成熟稳定的AI服务共享管理平台，通过智能的资源池化和分配机制，帮助团队和企业高效管理和共享各类AI服务资源。支持Claude、Gemini、通义千问等主流AI服务，提供完整的权限管理、成本控制和使用监控功能。

### 为什么选择 AiCarpool？

- **💰 成本优化** - 通过资源共享和智能分配，降低AI服务使用成本
- **🔄 高可用性** - 多账号轮换、故障转移，确保服务稳定性
- **🎯 灵活管理** - 支持企业级和拼车组两种模式，适应不同规模团队
- **📊 完整监控** - 实时统计、成本分析、性能监控一应俱全
- **🔐 安全可靠** - JWT认证、RBAC权限、细粒度访问控制

---

## 🚀 快速开始

### 🐳 Docker 一键部署（推荐）

最快速的部署方式，2-5分钟完成：

```bash
# 自动安装并启动所有服务
curl -fsSL https://raw.githubusercontent.com/codingauto/aicarpool/main/scripts/docker-deploy.sh | bash
```

访问 `http://localhost:4000`，使用默认管理员账号登录：
- 邮箱：`admin@aicarpool.com`  
- 密码：`admin123456`

> ⚠️ 首次登录后请立即修改密码

### 传统部署

```bash
# 1. 克隆项目
git clone https://github.com/codingauto/aicarpool.git
cd aicarpool

# 2. 安装依赖
npm install

# 3. 配置环境变量
cp .env.example .env.local
# 编辑 .env.local 配置数据库等信息

# 4. 初始化数据库
npm run quick-install

# 5. 启动服务
npm run dev
```

详细部署文档请参考 [部署指南](#-部署指南)

---

## ✨ 核心功能

### 🏢 组织管理

**企业模式** - 适合中大型团队
- 多级部门架构管理
- AI账号池智能分配
- 统一预算控制
- 集中权限管理

**拼车组模式** - 适合小团队
- 独立拼车组管理
- 专属AI账号绑定
- 成员费用均摊
- 简单权限控制

### 🤖 AI服务集成

支持主流AI服务，统一接入管理：

- **Claude系列**
  - Claude Code OAuth认证
  - Claude Console原生API
  - 多种中转服务支持
- **Gemini系列** - 完整API支持
- **国产AI服务** - 通义千问、智谱GLM、Kimi等
- **其他CLI工具** - Cursor、AmpCode、Auggie等

### 🔐 认证与权限

- **JWT Token自动刷新** - 7天内无需重新登录，token过期自动刷新
- **RBAC权限体系** - 系统、企业、部门、成员多级权限
- **API Key管理** - 细粒度配额控制，支持多种CLI工具
- **访问控制** - 基于角色的功能访问限制

### 📊 监控与分析

- **实时监控** - API调用、token使用、成本消耗实时追踪
- **统计分析** - 多维度数据分析，使用趋势图表
- **预算管理** - 企业、部门、个人多级预算控制
- **告警通知** - 配额预警、服务异常自动告警

### ⚡ 性能优化

- **Redis缓存** - API Key、配额、账号池多级缓存
- **异步处理** - 消息队列处理统计数据，API无阻塞响应
- **智能路由** - 负载均衡、健康检查、故障自动转移
- **批量优化** - 数据库查询优化，批量写入

---

## 🏗 系统架构

```
客户端 → API网关 → 认证中间件 → 智能路由器 → AI服务
                        ↓
                    权限管理 → 资源管理 → 统计监控
                        ↓
                  MySQL + Redis
```

详细架构说明请参考 [架构文档](docs/aicarpool-current-architecture.md)

---

## 📋 技术栈

- **前端**: Next.js 15 + React 19 + TypeScript + Tailwind CSS
- **后端**: Next.js API Routes + Prisma ORM  
- **数据库**: MySQL 8.0 + Redis 7
- **认证**: JWT + 自动刷新机制
- **容器**: Docker + Docker Compose
- **UI组件**: shadcn/ui + Radix UI

---

## 🔧 部署指南

### 环境要求

- Node.js 18+ / Docker
- MySQL 8.0+
- Redis 7+
- 2核4G内存（最低配置）

### Docker Compose 部署

```yaml
# docker-compose.yml 示例
version: '3.8'
services:
  aicarpool:
    image: wutongci/aicarpool:latest
    ports:
      - "4000:4000"
    environment:
      - DATABASE_URL=mysql://user:pass@mysql:3306/aicarpool
      - REDIS_URL=redis://redis:6379
      - NEXTAUTH_SECRET=your-secret-key
    depends_on:
      - mysql
      - redis
```

### 生产环境配置

```bash
# .env.production
NODE_ENV=production
DATABASE_URL=mysql://user:password@localhost:3306/aicarpool
REDIS_URL=redis://localhost:6379
NEXTAUTH_SECRET=your-32-chars-secret-key
NEXTAUTH_URL=https://your-domain.com
```

更多部署选项请参考完整[部署文档](docs/deployment.md)

---

## 📝 开发指南

### 本地开发

```bash
# 开发服务器
npm run dev

# 类型检查
npm run typecheck

# 代码检查
npm run lint

# 构建生产版本
npm run build
```

### 项目结构

```
aicarpool/
├── src/
│   ├── app/          # Next.js页面和API路由
│   ├── components/   # React组件
│   ├── lib/          # 工具库和配置
│   │   ├── api/      # API客户端和认证服务
│   │   ├── auth/     # JWT和认证工具
│   │   └── prisma.ts # 数据库连接
│   └── contexts/     # React Context
├── prisma/           # 数据库模型和迁移
└── public/           # 静态资源
```

---

## 🐛 常见问题

### Token刷新相关

系统已实现自动token刷新，用户无需手动处理。如需测试，访问 `/test-auth` 页面。

### 数据库连接问题

```bash
# 检查MySQL服务
systemctl status mysql
mysql -u root -p -e "SHOW DATABASES;"

# 重置数据库
npm run db:reset
npm run db:init
```

### 更多问题

请查看 [故障排除文档](docs/troubleshooting.md) 或提交 [Issue](https://github.com/codingauto/aicarpool/issues)

---

## 📄 许可证

本项目采用 [MIT许可证](LICENSE)

---

## 🤝 贡献

欢迎提交 Pull Request 或 Issue！

请确保：
- 遵循现有代码风格
- 添加必要的测试
- 更新相关文档

---

## 📮 联系我们

- GitHub: [https://github.com/codingauto/aicarpool](https://github.com/codingauto/aicarpool)
- Issues: [https://github.com/codingauto/aicarpool/issues](https://github.com/codingauto/aicarpool/issues)

---

<div align="center">

**如果这个项目对你有帮助，请给个 ⭐ Star 支持一下！**

</div>
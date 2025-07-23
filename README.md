# AiCarpool 拼车服务平台

<div align="center">

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Next.js](https://img.shields.io/badge/Next.js-15.4+-blue.svg)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5+-blue.svg)](https://www.typescriptlang.org/)
[![MySQL](https://img.shields.io/badge/MySQL-8+-orange.svg)](https://www.mysql.com/)

**🚗 企业级AI服务拼车管理平台，支持多AI服务聚合、智能路由、成本分摊** 

</div>

---

## 🚀 核心功能

### 🎯 拼车组管理
- ✅ **组织管理**: 创建和管理多个拼车组，支持不同业务场景
- ✅ **成员权限**: 细粒度角色权限（组长、管理员、成员）
- ✅ **邀请系统**: 邮件邀请链接，快速加入拼车组
- ✅ **使用统计**: 每个组的详细使用情况和成本分析

### 🤖 多AI服务支持
- ✅ **服务聚合**: 支持Claude、GPT、通义千问等主流AI服务
- ✅ **智能路由**: 基于可用性、成本、性能的智能请求分发
- ✅ **负载均衡**: 多账户轮换，避免单账户过载
- ✅ **故障转移**: 自动检测服务异常并切换到备用服务

### 📊 配额与监控
- ✅ **精细配额**: 按用户、按组、按服务的多维度配额控制
- ✅ **实时监控**: 使用量、成本、性能指标实时监控
- ✅ **告警通知**: 配额预警、服务异常等智能告警
- ✅ **数据分析**: 使用趋势、成本分析、性能报告

### 🌐 代理与部署
- ✅ **代理管理**: 支持HTTP/SOCKS5代理，确保服务可达性
- ✅ **多部署模式**: 集中化、分布式、混合部署架构
- ✅ **边缘节点**: 分布式边缘节点，就近处理请求
- ✅ **IP管理**: 静态IP代理配置，稳定访问海外服务

---

## 📋 技术栈

- **前端**: Next.js 15 + React 19 + TypeScript + Tailwind CSS
- **后端**: Next.js API Routes + Prisma ORM
- **数据库**: MySQL + Redis
- **认证**: JWT + NextAuth.js
- **邮件**: React Email + Nodemailer
- **UI组件**: shadcn/ui + Radix UI

---

## 🛠️ 本地开发

### 环境要求
- Node.js 18+
- MySQL 8.0+
- Redis 6+

### 快速开始

```bash
# 1. 克隆项目
git clone https://github.com/codingauto/aicarpool.git
cd aicarpool

# 2. 安装依赖
npm install

# 3. 配置环境变量
cp .env.example .env.local
# 编辑 .env.local 配置数据库连接

# 4. 初始化数据库
npx prisma migrate dev
npx prisma db seed

# 5. 启动开发服务器
npm run dev
```

### 开发命令

```bash
npm run dev          # 启动开发服务器
npm run build        # 构建生产版本
npm run start        # 启动生产服务器
npm run lint         # 代码检查
npm run typecheck    # TypeScript类型检查

# 数据库相关
npx prisma generate       # 生成Prisma客户端
npx prisma migrate dev     # 创建开发迁移
npx prisma studio         # 打开数据库管理界面
```

---

## 🎮 使用指南

### 1. 访问管理界面
浏览器访问：`http://localhost:3000`

### 2. 配置AI服务
1. 进入「AI服务管理」页面
2. 添加AI服务（Claude、GPT等）
3. 配置API密钥和代理设置
4. 测试连接

### 3. 创建拼车组
1. 进入「拼车组管理」页面
2. 创建新的拼车组
3. 设置成员权限和配额
4. 邀请成员加入

### 4. 选择部署模式
根据团队规模选择合适的部署模式：
- **集中化模式**: 适合小团队（<10人）
- **分布式模式**: 适合大团队（>20人）
- **混合模式**: 灵活配置，平衡性能和成本

---

## 🌟 主要API接口

### 认证接口
```http
POST /api/auth/login      # 用户登录
POST /api/auth/register   # 用户注册
GET  /api/auth/me         # 获取用户信息
```

### 拼车组管理
```http
GET    /api/groups        # 获取拼车组列表
POST   /api/groups        # 创建拼车组
GET    /api/groups/[id]   # 获取拼车组详情
PUT    /api/groups/[id]   # 更新拼车组
POST   /api/groups/[id]/invite  # 邀请成员
```

### AI服务接口
```http
POST /api/chat/completions  # 聊天补全
GET  /api/models           # 获取模型列表
GET  /api/usage            # 使用统计
```

---

## 📈 项目结构

```
aicarpool/
├── src/
│   ├── app/                 # Next.js页面和API路由
│   ├── components/          # React组件
│   │   ├── ui/             # 基础UI组件
│   │   ├── layout/         # 布局组件
│   │   └── groups/         # 拼车组相关组件
│   ├── lib/                # 工具库和配置
│   ├── hooks/              # 自定义Hook
│   └── types/              # TypeScript类型定义
├── prisma/                 # 数据库schema和迁移
├── public/                 # 静态资源
└── docs/                   # 项目文档
```

---

## 🔧 部署指南

### Docker部署（推荐）

```bash
# 1. 构建镜像
docker build -t aicarpool .

# 2. 运行容器
docker run -d \
  --name aicarpool \
  -p 3000:3000 \
  -e DATABASE_URL="mysql://user:password@host:3306/aicarpool" \
  -e REDIS_URL="redis://host:6379" \
  aicarpool
```

### 生产环境配置
1. 配置反向代理（Nginx/Caddy）
2. 设置SSL证书
3. 配置环境变量
4. 数据库备份策略
5. 监控和日志收集

---

## 🐛 故障排除

### 常见问题

**数据库连接失败**
```bash
# 检查MySQL服务
systemctl status mysql
mysql -u root -p -e "SHOW DATABASES;"
```

**Redis连接失败**
```bash
# 检查Redis服务
systemctl status redis
redis-cli ping
```

**构建失败**
```bash
# 清除缓存重新安装
rm -rf node_modules package-lock.json
npm install
```

---

## 📄 许可证

本项目采用 [MIT许可证](LICENSE)。

---

<div align="center">

**如果这个项目对你有帮助，请给个⭐Star支持一下！**

</div>
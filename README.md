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

### 一键安装（推荐）

**通用安装脚本（自动检测系统）：**
```bash
curl -fsSL https://raw.githubusercontent.com/codingauto/aicarpool/main/scripts/install.sh | bash
```

**Ubuntu/Debian 系统：**
```bash
curl -fsSL https://raw.githubusercontent.com/codingauto/aicarpool/main/scripts/deploy-ubuntu.sh | bash
```

**CentOS/RHEL 系统：**
```bash
curl -fsSL https://raw.githubusercontent.com/codingauto/aicarpool/main/scripts/deploy-centos.sh | bash
```

### 手动安装

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

### 环境要求

**硬件要求（最低配置）：**
- **CPU**: 2核心
- **内存**: 4GB（建议8GB）
- **硬盘**: 50GB可用空间
- **网络**: 稳定的网络连接

**技术栈：**
- **Node.js** 18+
- **MySQL** 8.0+
- **Redis** 6+
- **Docker** (可选)

### 手动部署

#### 第一步：环境准备

**Ubuntu/Debian用户：**
```bash
# 安装Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# 安装MySQL
sudo apt update
sudo apt install mysql-server
sudo systemctl start mysql
sudo systemctl enable mysql

# 安装Redis
sudo apt install redis-server
sudo systemctl start redis-server
sudo systemctl enable redis-server
```

**CentOS/RHEL用户：**
```bash
# 安装Node.js
curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
sudo yum install -y nodejs

# 安装MySQL
sudo yum install mysql-server
sudo systemctl start mysqld
sudo systemctl enable mysqld

# 安装Redis
sudo yum install redis
sudo systemctl start redis
sudo systemctl enable redis
```

#### 第二步：下载和配置

```bash
# 下载项目
git clone https://github.com/codingauto/aicarpool.git
cd aicarpool

# 安装依赖
npm install

# 复制环境配置文件
cp .env.example .env.local
```

#### 第三步：配置环境变量

编辑 `.env.local` 文件：
```bash
# 数据库配置
DATABASE_URL="mysql://username:password@localhost:3306/aicarpool"

# Redis配置
REDIS_URL="redis://localhost:6379"

# JWT密钥（随机生成32字符以上）
NEXTAUTH_SECRET="your_random_secret_key_here"

# 应用配置
NEXTAUTH_URL="http://localhost:3000"
NODE_ENV="production"

# 邮件配置（可选）
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="587"
SMTP_USER="your_email@gmail.com"
SMTP_PASSWORD="your_app_password"

# AI服务配置（根据需要配置）
CLAUDE_API_KEY="your_claude_api_key"
OPENAI_API_KEY="your_openai_api_key"
```

#### 第四步：数据库初始化

```bash
# 创建数据库
mysql -u root -p -e "CREATE DATABASE aicarpool;"

# 生成Prisma客户端
npx prisma generate

# 运行数据库迁移
npx prisma migrate deploy

# 初始化种子数据
npm run seed
```

#### 第五步：构建和启动

```bash
# 构建项目
npm run build

# 启动生产服务器
npm start

# 或使用PM2管理进程（推荐）
npm install -g pm2
pm2 start npm --name "aicarpool" -- start
pm2 save
pm2 startup
```

### Docker部署（推荐）

#### 使用Docker Compose（最简单）

创建 `docker-compose.yml` 文件：
```yaml
version: '3.8'
services:
  aicarpool:
    build: .
    container_name: aicarpool-app
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=mysql://aicarpool:password@mysql:3306/aicarpool
      - REDIS_URL=redis://redis:6379
      - NEXTAUTH_SECRET=your_random_secret_key_here
      - NEXTAUTH_URL=http://localhost:3000
      - NODE_ENV=production
    depends_on:
      - mysql
      - redis
    volumes:
      - ./logs:/app/logs

  mysql:
    image: mysql:8.0
    container_name: aicarpool-mysql
    restart: unless-stopped
    environment:
      - MYSQL_ROOT_PASSWORD=rootpassword
      - MYSQL_DATABASE=aicarpool
      - MYSQL_USER=aicarpool
      - MYSQL_PASSWORD=password
    volumes:
      - mysql_data:/var/lib/mysql
    ports:
      - "3306:3306"

  redis:
    image: redis:7-alpine
    container_name: aicarpool-redis
    restart: unless-stopped
    volumes:
      - redis_data:/data
    ports:
      - "6379:6379"

  # 可选：添加nginx反向代理
  nginx:
    image: nginx:alpine
    container_name: aicarpool-nginx
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/ssl
    depends_on:
      - aicarpool

volumes:
  mysql_data:
  redis_data:
```

#### 启动服务

```bash
# 启动所有服务
docker-compose up -d

# 查看服务状态
docker-compose ps

# 查看日志
docker-compose logs -f aicarpool

# 进入容器执行数据库迁移
docker-compose exec aicarpool npx prisma migrate deploy
```

### 生产环境配置

#### 1. 反向代理配置（Nginx）

创建 `nginx.conf` 文件：
```nginx
events {
    worker_connections 1024;
}

http {
    upstream aicarpool {
        server aicarpool:3000;
    }

    server {
        listen 80;
        server_name your-domain.com;
        
        # 重定向到HTTPS
        return 301 https://$server_name$request_uri;
    }

    server {
        listen 443 ssl http2;
        server_name your-domain.com;
        
        # SSL配置
        ssl_certificate /etc/ssl/your-domain.crt;
        ssl_certificate_key /etc/ssl/your-domain.key;
        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_ciphers HIGH:!aNULL:!MD5;
        
        # 安全头
        add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
        add_header X-Frame-Options "DENY" always;
        add_header X-Content-Type-Options "nosniff" always;
        
        location / {
            proxy_pass http://aicarpool;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_cache_bypass $http_upgrade;
            
            # 支持长连接
            proxy_read_timeout 300s;
            proxy_connect_timeout 75s;
        }
    }
}
```

#### 2. SSL证书配置

**使用Let's Encrypt（免费）：**
```bash
# 安装certbot
sudo apt install certbot python3-certbot-nginx

# 申请证书
sudo certbot --nginx -d your-domain.com

# 自动续期
sudo crontab -e
# 添加：0 12 * * * /usr/bin/certbot renew --quiet
```

#### 3. 监控和日志

**使用PM2监控：**
```bash
# 安装PM2
npm install -g pm2

# 创建PM2配置文件 ecosystem.config.js
module.exports = {
  apps: [{
    name: 'aicarpool',
    script: 'npm',
    args: 'start',
    cwd: '/path/to/aicarpool',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    log_file: './logs/combined.log',
    out_file: './logs/out.log',
    error_file: './logs/error.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    max_memory_restart: '1G'
  }]
};

# 启动应用
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

#### 4. 数据库备份策略

```bash
# 创建备份脚本 backup.sh
#!/bin/bash
DATE=$(date +"%Y%m%d_%H%M%S")
BACKUP_DIR="/backup/mysql"
mkdir -p $BACKUP_DIR

# 备份数据库
mysqldump -u aicarpool -p aicarpool > $BACKUP_DIR/aicarpool_$DATE.sql

# 保留最近30天的备份
find $BACKUP_DIR -name "aicarpool_*.sql" -mtime +30 -delete

# 添加到crontab每日备份
# 0 2 * * * /path/to/backup.sh
```

### 脚本管理

**升级应用：**
```bash
# 进入应用目录
cd /opt/aicarpool

# 拉取最新代码
git pull origin main

# 安装新依赖
npm install

# 运行数据库迁移
npx prisma migrate deploy

# 重新构建
npm run build

# 重启服务
pm2 restart aicarpool
```

**完全卸载：**
```bash
# 下载并运行卸载脚本
curl -fsSL https://raw.githubusercontent.com/codingauto/aicarpool/main/scripts/uninstall.sh | bash

# 或本地运行
bash /opt/aicarpool/scripts/uninstall.sh
```

**一键更新（推荐）：**
```bash
# 使用更新脚本（自动备份配置、更新代码、重启服务）
bash /opt/aicarpool/scripts/update.sh

# 或者从网络下载最新的更新脚本
curl -fsSL https://raw.githubusercontent.com/codingauto/aicarpool/main/scripts/update.sh | bash
```

**服务管理：**
```bash
# 查看服务状态
pm2 status

# 查看应用日志
pm2 logs aicarpool

# 重启应用
pm2 restart aicarpool

# 停止应用
pm2 stop aicarpool

# 查看资源使用
pm2 monit

# 查看当前版本
cd /opt/aicarpool && git log --oneline -5
```

**Git相关操作：**
```bash
# 查看当前版本信息
bash /opt/aicarpool/scripts/update.sh --version

# 检查是否有新版本
cd /opt/aicarpool
git fetch origin
git log --oneline HEAD..origin/main

# 手动更新代码（不推荐，建议使用update.sh）
cd /opt/aicarpool
git stash  # 备份本地修改
git pull origin main  # 更新代码
npm install  # 更新依赖
npm run build  # 重新构建
pm2 restart aicarpool  # 重启服务
```

---

## 🐛 故障排除

### 常见问题

**数据库连接失败**
```bash
# 检查MySQL服务
systemctl status mysql  # Ubuntu/Debian
systemctl status mysqld # CentOS/RHEL
mysql -u root -p -e "SHOW DATABASES;"
```

**Redis连接失败**
```bash
# 检查Redis服务
systemctl status redis-server  # Ubuntu/Debian
systemctl status redis         # CentOS/RHEL
redis-cli ping
```

**Git相关问题**
```bash
# Git克隆失败（网络问题）
# 配置代理（如果需要）
git config --global http.proxy http://proxy-server:port
git config --global https.proxy https://proxy-server:port

# 清除代理配置
git config --global --unset http.proxy
git config --global --unset https.proxy

# 检查Git配置
git config --global --list
```

**更新失败**
```bash
# 重置本地修改
cd /opt/aicarpool
git stash  # 或者 git reset --hard HEAD
git pull origin main

# 强制更新到最新版本
git fetch origin
git reset --hard origin/main
```

**构建失败**
```bash
# 清除缓存重新安装
cd /opt/aicarpool
rm -rf node_modules package-lock.json .next
npm install
npm run build
```

**服务启动失败**
```bash
# 检查端口占用
ss -tlnp | grep 3000
# 或者
netstat -tlnp | grep 3000

# 检查PM2状态
pm2 status
pm2 logs aicarpool

# 重启服务
pm2 delete aicarpool
bash /opt/aicarpool/scripts/update.sh
```

---

## 📄 许可证

本项目采用 [MIT许可证](LICENSE)。

---

<div align="center">

**如果这个项目对你有帮助，请给个⭐Star支持一下！**

</div>
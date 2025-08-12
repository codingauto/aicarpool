# 部署指南

## 快速部署

### 🐳 Docker 部署（推荐）

#### 一键部署脚本
```bash
curl -fsSL https://raw.githubusercontent.com/codingauto/aicarpool/main/scripts/docker-deploy.sh | bash
```

#### Docker Compose 手动部署
```bash
# 1. 下载配置文件
curl -O https://raw.githubusercontent.com/codingauto/aicarpool/main/docker-compose.yml
curl -O https://raw.githubusercontent.com/codingauto/aicarpool/main/.env.docker.example
mv .env.docker.example .env

# 2. 编辑环境变量
nano .env

# 3. 启动服务
docker-compose up -d

# 4. 查看状态
docker-compose ps
docker-compose logs -f aicarpool
```

## 传统部署

### Ubuntu/Debian
```bash
# 使用自动部署脚本
curl -fsSL https://raw.githubusercontent.com/codingauto/aicarpool/main/scripts/deploy-ubuntu.sh | bash

# 或使用快速模式（避免迁移冲突）
curl -fsSL https://raw.githubusercontent.com/codingauto/aicarpool/main/scripts/install.sh | QUICK_MODE=true bash
```

### CentOS/RHEL
```bash
# 使用自动部署脚本
curl -fsSL https://raw.githubusercontent.com/codingauto/aicarpool/main/scripts/deploy-centos.sh | bash

# 或使用快速模式
curl -fsSL https://raw.githubusercontent.com/codingauto/aicarpool/main/scripts/install.sh | QUICK_MODE=true bash
```

### 手动部署步骤

1. **安装依赖**
```bash
# Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# MySQL 8.0
sudo apt install mysql-server
sudo systemctl start mysql
sudo systemctl enable mysql

# Redis 7
sudo apt install redis-server
sudo systemctl start redis-server
sudo systemctl enable redis-server
```

2. **克隆项目**
```bash
git clone https://github.com/codingauto/aicarpool.git
cd aicarpool
npm install
```

3. **配置环境**
```bash
cp .env.example .env.local
nano .env.local
```

4. **初始化数据库**
```bash
# 创建数据库
mysql -u root -p -e "CREATE DATABASE aicarpool;"

# 初始化schema和数据
npm run quick-install
```

5. **启动服务**
```bash
# 开发环境
npm run dev

# 生产环境
npm run build
npm start

# 使用PM2管理（推荐）
npm install -g pm2
pm2 start npm --name aicarpool -- start
pm2 save
pm2 startup
```

## 生产环境配置

### 环境变量
```bash
# .env.production
NODE_ENV=production
DATABASE_URL=mysql://aicarpool:password@localhost:3306/aicarpool
REDIS_URL=redis://localhost:6379
NEXTAUTH_SECRET=your-super-secure-32-chars-minimum-secret
NEXTAUTH_URL=https://your-domain.com

# 邮件服务（可选）
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password

# AI服务配置（根据需要）
CLAUDE_API_KEY=your-claude-api-key
OPENAI_API_KEY=your-openai-api-key
```

### Nginx 反向代理
```nginx
server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;
    
    ssl_certificate /etc/ssl/your-domain.crt;
    ssl_certificate_key /etc/ssl/your-domain.key;
    
    location / {
        proxy_pass http://localhost:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### SSL 证书

使用 Let's Encrypt 免费证书：
```bash
# 安装 certbot
sudo apt install certbot python3-certbot-nginx

# 申请证书
sudo certbot --nginx -d your-domain.com

# 自动续期
sudo crontab -e
# 添加: 0 12 * * * /usr/bin/certbot renew --quiet
```

## 数据库备份

### 自动备份脚本
```bash
#!/bin/bash
# backup.sh
DATE=$(date +"%Y%m%d_%H%M%S")
BACKUP_DIR="/backup/mysql"
mkdir -p $BACKUP_DIR

# 备份数据库
mysqldump -u aicarpool -p aicarpool > $BACKUP_DIR/aicarpool_$DATE.sql

# 保留最近30天的备份
find $BACKUP_DIR -name "aicarpool_*.sql" -mtime +30 -delete
```

### 设置定时任务
```bash
# 每天凌晨2点执行备份
crontab -e
0 2 * * * /path/to/backup.sh
```

## 监控配置

### PM2 监控
```javascript
// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'aicarpool',
    script: 'npm',
    args: 'start',
    env: {
      NODE_ENV: 'production',
      PORT: 4000
    },
    max_memory_restart: '1G',
    error_file: './logs/error.log',
    out_file: './logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    merge_logs: true
  }]
};
```

### 健康检查
```bash
# 添加到监控系统
curl http://localhost:4000/api/health

# 预期响应
{
  "status": "healthy",
  "version": "0.26.0",
  "services": {
    "database": "connected",
    "redis": "connected"
  }
}
```

## 更新部署

### 使用更新脚本
```bash
bash /opt/aicarpool/scripts/update.sh
```

### 手动更新
```bash
cd /opt/aicarpool
git pull origin main
npm install
npm run build
pm2 restart aicarpool
```

## 故障恢复

### 数据库恢复
```bash
mysql -u root -p aicarpool < backup.sql
```

### 服务重启
```bash
pm2 restart aicarpool
# 或
systemctl restart aicarpool
```

### 清理缓存
```bash
redis-cli FLUSHDB
```

## Docker 管理

### 常用命令
```bash
# 查看日志
docker-compose logs -f --tail=100 aicarpool

# 重启服务
docker-compose restart aicarpool

# 更新镜像
docker-compose pull
docker-compose up -d

# 进入容器
docker-compose exec aicarpool sh

# 备份数据
docker-compose exec mysql mysqldump -u root -p aicarpool > backup.sql
```

### 资源限制
```yaml
# docker-compose.yml
services:
  aicarpool:
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 2G
        reservations:
          cpus: '1'
          memory: 1G
```

## 性能优化

### 数据库优化
```sql
-- 添加索引
ALTER TABLE ApiKey ADD INDEX idx_key (key);
ALTER TABLE UsageStat ADD INDEX idx_group_date (groupId, requestTime);

-- 查询优化
SET GLOBAL query_cache_size = 268435456;
SET GLOBAL query_cache_type = 1;
```

### Redis 配置
```conf
# /etc/redis/redis.conf
maxmemory 2gb
maxmemory-policy allkeys-lru
save 900 1
save 300 10
save 60 10000
```

### Node.js 优化
```bash
# 使用集群模式
pm2 start app.js -i max

# 设置环境变量
export NODE_OPTIONS="--max-old-space-size=2048"
```

## 安全建议

1. **使用强密码**
   - 数据库密码至少16位
   - JWT Secret至少32位
   - 定期更换密码

2. **限制访问**
   - 配置防火墙规则
   - 使用IP白名单
   - 启用rate limiting

3. **定期更新**
   - 及时更新依赖包
   - 关注安全公告
   - 定期安全扫描

4. **数据加密**
   - 使用HTTPS
   - 加密敏感数据
   - 安全存储API密钥

## 支持

遇到问题请查看：
- [故障排除文档](./troubleshooting.md)
- [GitHub Issues](https://github.com/codingauto/aicarpool/issues)
- [社区讨论](https://github.com/codingauto/aicarpool/discussions)
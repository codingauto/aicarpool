# 故障排除指南

## 常见问题

### 安装问题

#### npm install 失败
```bash
# 清理缓存重试
rm -rf node_modules package-lock.json
npm cache clean --force
npm install

# 使用淘宝镜像（国内用户）
npm config set registry https://registry.npmmirror.com
npm install
```

#### 数据库连接失败
```bash
# 检查MySQL服务状态
systemctl status mysql  # Ubuntu/Debian
systemctl status mysqld # CentOS/RHEL

# 测试连接
mysql -u root -p -e "SHOW DATABASES;"

# 检查端口
netstat -tlnp | grep 3306

# 常见错误：Access denied
# 解决：检查.env中的数据库用户名和密码
# 创建新用户
mysql -u root -p
CREATE USER 'aicarpool'@'localhost' IDENTIFIED BY 'your_password';
GRANT ALL PRIVILEGES ON aicarpool.* TO 'aicarpool'@'localhost';
FLUSH PRIVILEGES;
```

#### Redis连接失败
```bash
# 检查Redis服务
systemctl status redis-server  # Ubuntu/Debian
systemctl status redis         # CentOS/RHEL

# 测试连接
redis-cli ping
# 预期输出: PONG

# 检查端口
netstat -tlnp | grep 6379

# 如果Redis需要密码
redis-cli -a your_password ping
```

### 运行时问题

#### 端口被占用
```bash
# 查找占用端口的进程
lsof -i :4000
# 或
netstat -tlnp | grep 4000

# 终止进程
kill -9 <PID>

# 修改端口（.env文件）
PORT=3001
```

#### Token相关错误

**问题：JWT Token验证失败**
```bash
# 检查环境变量
echo $NEXTAUTH_SECRET

# 确保SECRET至少32位
openssl rand -base64 32

# 清除浏览器缓存和localStorage
# 开发者工具 -> Application -> Clear Storage
```

**问题：Token自动刷新不工作**
```bash
# 检查refresh token是否存在
# 浏览器控制台执行
localStorage.getItem('refreshToken')

# 检查API响应
# Network标签查看/api/auth/refresh请求
```

#### 构建错误

**TypeScript错误**
```bash
# 清理并重新构建
rm -rf .next
npm run typecheck
npm run build

# 跳过类型检查（临时方案）
SKIP_TYPE_CHECK=true npm run build
```

**内存不足**
```bash
# 增加Node.js内存限制
export NODE_OPTIONS="--max-old-space-size=4096"
npm run build

# 或在package.json中
"scripts": {
  "build": "NODE_OPTIONS='--max-old-space-size=4096' next build"
}
```

### Docker相关问题

#### 镜像构建失败
```bash
# 清理Docker缓存
docker system prune -a

# 使用国内镜像源
# Dockerfile中添加
RUN npm config set registry https://registry.npmmirror.com

# 分步构建调试
docker build --target deps -t test:deps .
docker build --target builder -t test:builder .
```

#### 容器无法启动
```bash
# 查看容器日志
docker-compose logs aicarpool

# 进入容器调试
docker-compose run --rm aicarpool sh

# 检查环境变量
docker-compose exec aicarpool env

# 重新创建容器
docker-compose down
docker-compose up -d --force-recreate
```

### 性能问题

#### 响应缓慢
```bash
# 检查数据库慢查询
mysql -u root -p
SHOW PROCESSLIST;
SHOW VARIABLES LIKE 'slow_query_log';

# 开启慢查询日志
SET GLOBAL slow_query_log = 'ON';
SET GLOBAL long_query_time = 2;

# 检查Redis性能
redis-cli --latency
redis-cli --stat

# 检查Node.js进程
pm2 monit
pm2 status
```

#### 内存泄漏
```bash
# 使用PM2监控内存
pm2 monit

# 设置内存限制自动重启
pm2 start app.js --max-memory-restart 1G

# 生成heap snapshot
node --inspect app.js
# Chrome DevTools -> Memory -> Take snapshot
```

### 数据问题

#### 数据库迁移失败
```bash
# 重置数据库（注意：会删除所有数据）
npm run db:reset
npm run db:init

# 手动修复
npx prisma db push --force-reset
npx prisma generate

# 检查迁移状态
npx prisma migrate status
```

#### 数据不一致
```bash
# 清理Redis缓存
redis-cli FLUSHDB

# 重建索引
mysql -u root -p aicarpool
ANALYZE TABLE ApiKey;
OPTIMIZE TABLE UsageStat;

# 检查数据完整性
SELECT COUNT(*) FROM User;
SELECT COUNT(*) FROM CarpoolGroup;
SELECT COUNT(*) FROM ApiKey WHERE status = 'active';
```

### 认证授权问题

#### 无法登录
```bash
# 重置管理员密码
npm run db:create-admin

# 直接更新数据库
mysql -u root -p aicarpool
UPDATE User SET password = '$2b$10$...' WHERE email = 'admin@aicarpool.com';

# 生成密码hash（Node.js控制台）
const bcrypt = require('bcryptjs');
bcrypt.hash('new_password', 10).then(console.log);
```

#### 权限错误
```bash
# 检查用户角色
mysql -u root -p aicarpool
SELECT u.email, ue.role FROM User u 
JOIN UserEnterprise ue ON u.id = ue.userId 
WHERE u.email = 'user@example.com';

# 授予管理员权限
UPDATE UserEnterprise SET role = 'admin' 
WHERE userId = 'user_id' AND enterpriseId = 'enterprise_id';
```

### 日志分析

#### 查看应用日志
```bash
# PM2日志
pm2 logs aicarpool --lines 100

# Docker日志
docker-compose logs -f --tail=100 aicarpool

# 系统日志
journalctl -u aicarpool -n 100
```

#### 日志级别设置
```bash
# .env文件
LOG_LEVEL=debug  # error, warn, info, debug

# 代码中
console.log = process.env.LOG_LEVEL === 'debug' ? console.log : () => {};
```

### 紧急恢复

#### 数据恢复
```bash
# 从备份恢复
mysql -u root -p aicarpool < backup_20250812.sql

# 导出当前数据（预防措施）
mysqldump -u root -p aicarpool > emergency_backup.sql
```

#### 服务恢复
```bash
# 快速重启所有服务
pm2 restart all

# Docker环境
docker-compose restart

# 系统服务
systemctl restart nginx
systemctl restart mysql
systemctl restart redis
```

#### 回滚版本
```bash
# Git回滚
cd /opt/aicarpool
git log --oneline -10  # 查看历史
git checkout <commit-hash>
npm install
npm run build
pm2 restart aicarpool

# Docker回滚
docker-compose down
docker pull wutongci/aicarpool:previous-version
docker-compose up -d
```

## 获取帮助

如果以上方法无法解决问题：

1. **查看详细日志**
   - 应用日志：`pm2 logs`
   - 数据库日志：`/var/log/mysql/error.log`
   - 系统日志：`journalctl -xe`

2. **收集诊断信息**
   ```bash
   node -v
   npm -v
   mysql --version
   redis-server --version
   cat package.json | grep version
   ```

3. **提交Issue**
   - [GitHub Issues](https://github.com/codingauto/aicarpool/issues)
   - 包含错误信息、日志、环境信息

4. **社区支持**
   - [GitHub Discussions](https://github.com/codingauto/aicarpool/discussions)
   - 搜索已有问题和解决方案
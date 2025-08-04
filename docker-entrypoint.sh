#!/bin/sh
set -e

echo "🚀 AiCarpool Enterprise Platform 启动中..."

# Function to log messages with timestamp
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

# Function to check environment variables
check_env_var() {
    local var_name="$1"
    local var_value="$2"
    local is_required="$3"
    
    if [ -z "$var_value" ]; then
        if [ "$is_required" = "true" ]; then
            log "❌ 错误: $var_name 环境变量未设置"
            return 1
        else
            log "⚠️  警告: $var_name 环境变量未设置"
        fi
    else
        log "✅ $var_name: [已设置]"
    fi
}

# Check critical environment variables
log "📋 检查环境变量..."

check_env_var "DATABASE_URL" "$DATABASE_URL" "true" || {
    log "   请设置 DATABASE_URL 环境变量"
    log "   例如: DATABASE_URL=\"mysql://user:password@mysql:3306/aicarpool\""
    exit 1
}

check_env_var "NEXTAUTH_SECRET" "$NEXTAUTH_SECRET" "true" || {
    log "   请设置 NEXTAUTH_SECRET 环境变量"
    log "   例如: NEXTAUTH_SECRET=\"your-random-secret-key-at-least-32-chars\""
    exit 1
}

check_env_var "NEXTAUTH_URL" "$NEXTAUTH_URL" "false"
check_env_var "REDIS_URL" "$REDIS_URL" "false"

# Set default values if not provided
export NEXTAUTH_URL="${NEXTAUTH_URL:-http://localhost:4000}"
export REDIS_URL="${REDIS_URL:-redis://redis:6379}"
export NODE_ENV="${NODE_ENV:-production}"
export PORT="${PORT:-4000}"

log "✅ 环境变量检查完成"
log "   DATABASE_URL: [已配置]"
log "   NEXTAUTH_SECRET: [已配置]"
log "   NEXTAUTH_URL: $NEXTAUTH_URL"
log "   REDIS_URL: $REDIS_URL"
log "   NODE_ENV: $NODE_ENV"
log "   PORT: $PORT"

# Wait for database to be ready
log "🔍 等待数据库连接..."
max_attempts=30
attempt=1

while [ $attempt -le $max_attempts ]; do
    # Extract database connection details from DATABASE_URL
    # Format: mysql://username:password@host:port/database
    if echo "$DATABASE_URL" | grep -q "mysql://"; then
        db_host=$(echo "$DATABASE_URL" | sed 's/.*@\([^:]*\):.*/\1/')
        db_port=$(echo "$DATABASE_URL" | sed 's/.*:\([0-9]*\)\/.*/\1/')
        
        if [ -z "$db_port" ]; then
            db_port=3306
        fi
        
        log "   尝试连接到 $db_host:$db_port (尝试 $attempt/$max_attempts)"
        
        if nc -z "$db_host" "$db_port" 2>/dev/null; then
            log "✅ 数据库连接成功"
            break
        fi
    else
        log "⚠️  无法解析数据库连接信息，跳过数据库等待"
        break
    fi
    
    if [ $attempt -eq $max_attempts ]; then
        log "❌ 数据库连接失败，已达到最大重试次数"
        exit 1
    fi
    
    sleep 2
    attempt=$((attempt + 1))
done

# Database initialization
log "📊 数据库初始化..."

# Check if we should use quick mode
if [ "$QUICK_MODE" = "true" ]; then
    log "⚡ 使用快速模式初始化数据库"
    npx prisma db push --force-reset --accept-data-loss
    log "👤 创建管理员账号..."
    npm run db:create-admin || log "⚠️  管理员账号创建可能已存在"
    if [ -f "./scripts/init-admin-permissions.ts" ]; then
        npx tsx scripts/init-admin-permissions.ts || log "⚠️  权限初始化可能已完成"
    fi
else
    log "🔄 使用标准模式数据库迁移"
    npx prisma migrate deploy
    log "👤 创建管理员账号..."
    npm run db:create-admin || log "⚠️  管理员账号创建可能已存在"
fi

log "✅ 数据库初始化完成"

# Create log directory if it doesn't exist
mkdir -p /app/logs

# Redis connection check (optional)
if [ -n "$REDIS_URL" ]; then
    log "🔍 检查Redis连接..."
    redis_host=$(echo "$REDIS_URL" | sed 's/redis:\/\/\([^:]*\):.*/\1/')
    redis_port=$(echo "$REDIS_URL" | sed 's/.*:\([0-9]*\).*/\1/' | grep -o '[0-9]*')
    
    if [ -z "$redis_port" ]; then
        redis_port=6379
    fi
    
    if nc -z "$redis_host" "$redis_port" 2>/dev/null; then
        log "✅ Redis连接正常"
    else
        log "⚠️  Redis连接失败，应用将在无缓存模式下运行"
    fi
fi

# Display startup information
log "🌟 AiCarpool企业级AI服务拼车平台"
log "   版本: 0.9.0"
log "   访问地址: $NEXTAUTH_URL"
log "   端口: $PORT"
log "   模式: $NODE_ENV"

# Final check - ensure the server.js file exists
if [ ! -f "server.js" ]; then
    log "❌ 错误: server.js 文件不存在"
    log "   请确保 Next.js standalone 构建正确完成"
    exit 1
fi

log "🚀 启动应用服务器..."

# Execute the main command
exec "$@"
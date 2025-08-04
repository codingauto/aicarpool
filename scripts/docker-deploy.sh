#!/bin/bash

# AiCarpool Docker 一键部署脚本
# 支持从 Docker Hub 快速部署到生产环境

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 日志函数
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_step() {
    echo -e "${BLUE}[STEP]${NC} $1"
}

# 显示欢迎信息
show_welcome() {
    echo -e "${GREEN}"
    cat << 'EOF'
    ___    _ ______                           _ 
   / _ \  (_) ___/__ _ ____ ___   ___   ___  | |
  / /_\ \/ / (__/ _ `/ __/ _ \ / _ \ / _ \ | |
 / __ \/ / (__/ (_ / / / /_/ // ___/ (_) |/ /
/_/ |_/_/\___/\__,_/_/  \____//_/    \___//_/ 
                                             
AiCarpool Docker 一键部署脚本 v0.9.0
企业级AI服务拼车管理平台
EOF
    echo -e "${NC}"
    echo -e "${BLUE}Docker Hub:${NC} https://hub.docker.com/r/codingauto/aicarpool"
    echo -e "${BLUE}GitHub:${NC} https://github.com/codingauto/aicarpool"
    echo ""
}

# 检查系统要求
check_requirements() {
    log_step "检查系统要求..."
    
    # 检查Docker
    if ! command -v docker &> /dev/null; then
        log_error "Docker 未安装，请先安装 Docker"
        echo "安装指南: https://docs.docker.com/get-docker/"
        exit 1
    fi
    
    # 检查Docker Compose
    if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
        log_error "Docker Compose 未安装，请先安装 Docker Compose"
        echo "安装指南: https://docs.docker.com/compose/install/"
        exit 1
    fi
    
    # 检查Docker服务状态
    if ! docker info &> /dev/null; then
        log_error "Docker 服务未运行，请启动 Docker 服务"
        exit 1
    fi
    
    log_info "系统要求检查通过"
}

# 生成环境配置
generate_env() {
    log_step "生成环境配置文件..."
    
    if [[ -f .env ]]; then
        log_warn "检测到已存在的 .env 文件"
        read -p "是否要覆盖现有配置？[y/N] " -n 1 -r
        echo ""
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            log_info "保持现有配置"
            return
        fi
    fi
    
    # 生成随机密钥
    NEXTAUTH_SECRET=$(openssl rand -base64 32)
    MYSQL_ROOT_PASSWORD=$(openssl rand -base64 16)
    DB_PASSWORD=$(openssl rand -base64 16)
    
    # 创建 .env 文件
    cat > .env << EOF
# AiCarpool Docker Environment Configuration
# Generated on $(date)

# Authentication & Security
NEXTAUTH_SECRET=$NEXTAUTH_SECRET
NEXTAUTH_URL=http://localhost:4000

# Database Configuration
MYSQL_ROOT_PASSWORD=$MYSQL_ROOT_PASSWORD
DB_PASSWORD=$DB_PASSWORD

# Application Configuration
APP_PORT=4000
QUICK_MODE=true
NODE_ENV=production

# Timezone
TIMEZONE=Asia/Shanghai

# Optional: Monitoring Ports
REDIS_WEB_PORT=8081
PMA_PORT=8080
PROMETHEUS_PORT=9090
GRAFANA_PORT=3001
GRAFANA_ADMIN_PASSWORD=admin123

# Email Configuration (Optional - Configure if needed)
# SMTP_HOST=smtp.gmail.com
# SMTP_PORT=587
# SMTP_USER=your-email@gmail.com
# SMTP_PASSWORD=your-email-app-password

# AI Service Configuration (Optional - Configure if needed)
# CLAUDE_API_KEY=your-claude-api-key
# OPENAI_API_KEY=your-openai-api-key
EOF
    
    log_info "环境配置文件已生成: .env"
    log_info "数据库 root 密码: $MYSQL_ROOT_PASSWORD"
    log_info "应用数据库密码: $DB_PASSWORD"
}

# 下载 Docker Compose 文件
download_compose() {
    log_step "下载 Docker Compose 配置文件..."
    
    if [[ ! -f docker-compose.yml ]]; then
        log_info "下载最新的 docker-compose.yml..."
        curl -fsSL https://raw.githubusercontent.com/codingauto/aicarpool/main/docker-compose.yml -o docker-compose.yml
        
        if [[ ! -f docker-compose.yml ]]; then
            log_error "下载 docker-compose.yml 失败"
            exit 1
        fi
    else
        log_info "检测到已存在的 docker-compose.yml"
    fi
}

# 拉取 Docker 镜像
pull_images() {
    log_step "拉取 Docker 镜像..."
    
    log_info "拉取 AiCarpool 应用镜像..."
    docker pull wutongci/aicarpool:latest
    
    log_info "拉取依赖服务镜像..."
    docker pull mysql:8.0
    docker pull redis:7-alpine
    
    log_info "镜像拉取完成"
}

# 启动服务
start_services() {
    log_step "启动服务..."
    
    # 停止现有服务（如果存在）
    if docker-compose ps | grep -q "Up"; then
        log_info "停止现有服务..."
        docker-compose down
    fi
    
    # 启动核心服务
    log_info "启动 AiCarpool 服务..."
    docker-compose up -d aicarpool mysql redis
    
    # 等待服务启动
    log_info "等待服务启动完成..."
    sleep 30
    
    # 检查服务状态
    if docker-compose ps | grep -q "aicarpool.*Up"; then
        log_info "✅ AiCarpool 服务启动成功"
    else
        log_error "❌ AiCarpool 服务启动失败"
        docker-compose logs aicarpool
        exit 1
    fi
}

# 显示部署信息
show_info() {
    log_step "部署完成！"
    
    echo -e "\n${GREEN}=== AiCarpool 部署信息 ===${NC}"
    echo -e "${BLUE}应用地址:${NC} http://localhost:4000"
    echo -e "${BLUE}默认管理员:${NC} admin@aicarpool.com"
    echo -e "${BLUE}默认密码:${NC} admin123456"
    
    echo -e "\n${GREEN}=== 服务状态 ===${NC}"
    docker-compose ps
    
    echo -e "\n${GREEN}=== 管理工具 ===${NC}"
    echo -e "${BLUE}phpMyAdmin:${NC} http://localhost:8080 (如果启用)"
    echo -e "${BLUE}Redis Commander:${NC} http://localhost:8081 (如果启用)"
    echo -e "${BLUE}Grafana:${NC} http://localhost:3001 (如果启用)"
    
    echo -e "\n${GREEN}=== 常用命令 ===${NC}"
    echo -e "${BLUE}查看日志:${NC} docker-compose logs -f aicarpool"
    echo -e "${BLUE}重启服务:${NC} docker-compose restart aicarpool"
    echo -e "${BLUE}停止服务:${NC} docker-compose down"
    echo -e "${BLUE}启用监控:${NC} docker-compose --profile monitoring up -d"
    
    echo -e "\n${GREEN}=== 重要提示 ===${NC}"
    echo -e "${YELLOW}1. 首次登录后请立即修改管理员密码${NC}"
    echo -e "${YELLOW}2. 生产环境建议配置 SSL 证书${NC}"
    echo -e "${YELLOW}3. 定期备份数据库数据${NC}"
    echo -e "${YELLOW}4. 监控服务资源使用情况${NC}"
    
    echo -e "\n${GREEN}部署成功！访问 http://localhost:4000 开始使用${NC}"
}

# 主函数
main() {
    show_welcome
    check_requirements
    
    # 创建部署目录
    DEPLOY_DIR="${HOME}/aicarpool-docker"
    mkdir -p "$DEPLOY_DIR"
    cd "$DEPLOY_DIR"
    
    log_info "部署目录: $DEPLOY_DIR"
    
    generate_env
    download_compose
    pull_images
    start_services
    show_info
}

# 错误处理
trap 'log_error "部署过程中发生错误"; exit 1' ERR

# 运行主函数
main "$@"
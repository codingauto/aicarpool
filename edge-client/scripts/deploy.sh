#!/bin/bash

# AI Carpool 边缘节点客户端部署脚本

set -e

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 配置变量
DEPLOY_USER=${DEPLOY_USER:-"edgenode"}
DEPLOY_PATH=${DEPLOY_PATH:-"/opt/edge-client"}
SERVICE_NAME=${SERVICE_NAME:-"aicarpool-edge"}
BACKUP_DIR="/tmp/edge-client-backup-$(date +%Y%m%d-%H%M%S)"

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

log_debug() {
    echo -e "${BLUE}[DEBUG]${NC} $1"
}

# 检查是否为 root 用户
check_root() {
    if [ "$EUID" -ne 0 ]; then
        log_error "请使用 root 权限运行此脚本"
        exit 1
    fi
}

# 检查系统环境
check_system() {
    log_info "检查系统环境..."
    
    # 检查操作系统
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        log_info "操作系统: $NAME $VERSION"
    else
        log_warn "无法识别操作系统版本"
    fi
    
    # 检查 systemd
    if ! command -v systemctl &> /dev/null; then
        log_error "系统不支持 systemd"
        exit 1
    fi
}

# 创建部署用户
create_user() {
    if id "$DEPLOY_USER" &>/dev/null; then
        log_info "用户 $DEPLOY_USER 已存在"
    else
        log_info "创建部署用户: $DEPLOY_USER"
        useradd -r -m -s /bin/bash "$DEPLOY_USER"
    fi
}

# 创建部署目录
create_deploy_directory() {
    log_info "创建部署目录: $DEPLOY_PATH"
    
    mkdir -p "$DEPLOY_PATH"
    chown "$DEPLOY_USER:$DEPLOY_USER" "$DEPLOY_PATH"
    chmod 755 "$DEPLOY_PATH"
}

# 备份现有部署
backup_existing() {
    if [ -d "$DEPLOY_PATH" ] && [ "$(ls -A $DEPLOY_PATH)" ]; then
        log_info "备份现有部署到: $BACKUP_DIR"
        mkdir -p "$BACKUP_DIR"
        cp -r "$DEPLOY_PATH"/* "$BACKUP_DIR"/ || true
    fi
}

# 停止现有服务
stop_service() {
    if systemctl is-active --quiet "$SERVICE_NAME"; then
        log_info "停止现有服务: $SERVICE_NAME"
        systemctl stop "$SERVICE_NAME"
    fi
    
    # 如果使用 PM2，也停止 PM2 进程
    if command -v pm2 &> /dev/null; then
        sudo -u "$DEPLOY_USER" pm2 stop "$SERVICE_NAME" 2>/dev/null || true
        sudo -u "$DEPLOY_USER" pm2 delete "$SERVICE_NAME" 2>/dev/null || true
    fi
}

# 部署应用文件
deploy_files() {
    log_info "部署应用文件..."
    
    # 检查构建产物
    if [ ! -d "dist" ]; then
        log_error "构建产物不存在，请先运行 npm run build"
        exit 1
    fi
    
    # 复制文件
    cp -r dist/ "$DEPLOY_PATH/"
    cp -r config/ "$DEPLOY_PATH/"
    cp package*.json "$DEPLOY_PATH/"
    cp ecosystem.config.js "$DEPLOY_PATH/" 2>/dev/null || true
    
    # 创建必要的目录
    mkdir -p "$DEPLOY_PATH/logs"
    mkdir -p "$DEPLOY_PATH/certs"
    
    # 复制环境配置文件
    if [ -f ".env.production" ]; then
        cp .env.production "$DEPLOY_PATH/.env"
    elif [ -f ".env" ]; then
        cp .env "$DEPLOY_PATH/"
    fi
    
    # 设置权限
    chown -R "$DEPLOY_USER:$DEPLOY_USER" "$DEPLOY_PATH"
    chmod -R 755 "$DEPLOY_PATH"
    chmod 700 "$DEPLOY_PATH/certs" 2>/dev/null || true
}

# 安装生产依赖
install_production_deps() {
    log_info "安装生产环境依赖..."
    
    cd "$DEPLOY_PATH"
    sudo -u "$DEPLOY_USER" npm ci --only=production
}

# 创建 systemd 服务文件
create_systemd_service() {
    log_info "创建 systemd 服务文件..."
    
    cat > "/etc/systemd/system/$SERVICE_NAME.service" << EOF
[Unit]
Description=AI Carpool Edge Client
Documentation=https://github.com/yourusername/aicarpool
After=network.target

[Service]
Type=simple
User=$DEPLOY_USER
Group=$DEPLOY_USER
WorkingDirectory=$DEPLOY_PATH
ExecStart=/usr/bin/node dist/index.js
ExecReload=/bin/kill -HUP \$MAINPID
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal
SyslogIdentifier=$SERVICE_NAME
KillMode=mixed
KillSignal=SIGTERM
TimeoutStopSec=30

# 环境变量
Environment=NODE_ENV=production
Environment=PORT=8080

# 安全设置
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=$DEPLOY_PATH/logs $DEPLOY_PATH/certs
CapabilityBoundingSet=CAP_NET_BIND_SERVICE

[Install]
WantedBy=multi-user.target
EOF

    systemctl daemon-reload
}

# 配置日志轮转
setup_log_rotation() {
    log_info "配置日志轮转..."
    
    cat > "/etc/logrotate.d/$SERVICE_NAME" << EOF
$DEPLOY_PATH/logs/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    sharedscripts
    postrotate
        systemctl reload $SERVICE_NAME > /dev/null 2>&1 || true
    endscript
}
EOF
}

# 配置防火墙
setup_firewall() {
    local port=${PORT:-8080}
    
    if command -v ufw &> /dev/null; then
        log_info "配置 UFW 防火墙规则..."
        ufw allow "$port/tcp" comment "AI Carpool Edge Client"
    elif command -v firewall-cmd &> /dev/null; then
        log_info "配置 firewalld 防火墙规则..."
        firewall-cmd --permanent --add-port="$port/tcp"
        firewall-cmd --reload
    else
        log_warn "未检测到防火墙，请手动开放端口 $port"
    fi
}

# 启动服务
start_service() {
    log_info "启动服务: $SERVICE_NAME"
    
    systemctl enable "$SERVICE_NAME"
    systemctl start "$SERVICE_NAME"
    
    # 等待服务启动
    sleep 5
    
    if systemctl is-active --quiet "$SERVICE_NAME"; then
        log_info "服务启动成功"
    else
        log_error "服务启动失败"
        systemctl status "$SERVICE_NAME"
        exit 1
    fi
}

# 健康检查
health_check() {
    log_info "执行健康检查..."
    
    local port=${PORT:-8080}
    local max_attempts=10
    local attempt=0
    
    while [ $attempt -lt $max_attempts ]; do
        if curl -f -s "http://localhost:$port/health" > /dev/null 2>&1; then
            log_info "健康检查通过"
            return 0
        fi
        
        attempt=$((attempt + 1))
        log_debug "健康检查尝试 $attempt/$max_attempts..."
        sleep 3
    done
    
    log_error "健康检查失败"
    return 1
}

# 显示部署信息
show_deploy_info() {
    local port=${PORT:-8080}
    
    log_info "部署完成！"
    echo
    echo "服务信息:"
    echo "  服务名称: $SERVICE_NAME"
    echo "  部署路径: $DEPLOY_PATH"
    echo "  运行用户: $DEPLOY_USER"
    echo "  服务端口: $port"
    echo
    echo "管理命令:"
    echo "  启动服务: systemctl start $SERVICE_NAME"
    echo "  停止服务: systemctl stop $SERVICE_NAME"
    echo "  重启服务: systemctl restart $SERVICE_NAME"
    echo "  查看状态: systemctl status $SERVICE_NAME"
    echo "  查看日志: journalctl -u $SERVICE_NAME -f"
    echo
    echo "健康检查: curl http://localhost:$port/health"
}

# 清理函数
cleanup() {
    if [ -d "$BACKUP_DIR" ] && [ -z "$(ls -A $BACKUP_DIR)" ]; then
        rm -rf "$BACKUP_DIR"
    fi
}

# 回滚函数
rollback() {
    if [ -d "$BACKUP_DIR" ] && [ "$(ls -A $BACKUP_DIR)" ]; then
        log_info "回滚到备份版本..."
        
        systemctl stop "$SERVICE_NAME" || true
        rm -rf "$DEPLOY_PATH"/*
        cp -r "$BACKUP_DIR"/* "$DEPLOY_PATH"/
        chown -R "$DEPLOY_USER:$DEPLOY_USER" "$DEPLOY_PATH"
        systemctl start "$SERVICE_NAME"
        
        log_info "回滚完成"
    else
        log_error "没有可用的备份进行回滚"
    fi
}

# 主函数
main() {
    echo "======================================="
    echo "AI Carpool 边缘节点客户端部署脚本"
    echo "======================================="
    echo
    
    # 解析命令行参数
    while [[ $# -gt 0 ]]; do
        case $1 in
            --rollback)
                rollback
                exit 0
                ;;
            --user)
                DEPLOY_USER="$2"
                shift 2
                ;;
            --path)
                DEPLOY_PATH="$2"
                shift 2
                ;;
            --service)
                SERVICE_NAME="$2"
                shift 2
                ;;
            *)
                log_error "未知参数: $1"
                exit 1
                ;;
        esac
    done
    
    check_root
    check_system
    create_user
    create_deploy_directory
    backup_existing
    stop_service
    deploy_files
    install_production_deps
    create_systemd_service
    setup_log_rotation
    setup_firewall
    start_service
    
    if health_check; then
        show_deploy_info
        cleanup
    else
        log_error "部署验证失败，考虑回滚"
        exit 1
    fi
}

# 错误处理
trap 'log_error "部署过程中发生错误"; exit 1' ERR

# 显示帮助信息
if [[ "${1:-}" == "--help" ]] || [[ "${1:-}" == "-h" ]]; then
    echo "AI Carpool 边缘节点客户端部署脚本"
    echo
    echo "用法: $0 [选项]"
    echo
    echo "选项:"
    echo "  --user USER      指定部署用户 (默认: edgenode)"
    echo "  --path PATH      指定部署路径 (默认: /opt/edge-client)"
    echo "  --service NAME   指定服务名称 (默认: aicarpool-edge)"
    echo "  --rollback       回滚到上一个版本"
    echo "  --help, -h       显示此帮助信息"
    echo
    exit 0
fi

# 执行主函数
main "$@"
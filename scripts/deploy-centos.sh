#!/bin/bash

# AiCarpool CentOS/RHEL 一键部署脚本
# 支持 CentOS 8+, RHEL 8+, Rocky Linux 8+, AlmaLinux 8+
# 使用方法: curl -fsSL https://raw.githubusercontent.com/codingauto/aicarpool/main/scripts/deploy-centos.sh | bash

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

# 检查是否为root用户
check_root() {
    if [[ $EUID -eq 0 ]]; then
        log_error "请不要使用root用户运行此脚本！"
        log_info "建议创建普通用户: useradd -m aicarpool && usermod -aG wheel aicarpool"
        exit 1
    fi
}

# 检查系统版本
check_system() {
    log_step "检查系统环境..."
    
    if [[ ! -f /etc/os-release ]]; then
        log_error "无法检测系统版本"
        exit 1
    fi
    
    . /etc/os-release
    
    case $ID in
        centos|rhel)
            if [[ ${VERSION_ID%%.*} -lt 8 ]]; then
                log_error "系统版本过低，需要CentOS/RHEL 8或更高版本"
                exit 1
            fi
            PACKAGE_MANAGER="dnf"
            ;;
        rocky|almalinux)
            if [[ ${VERSION_ID%%.*} -lt 8 ]]; then
                log_error "系统版本过低，需要Rocky Linux/AlmaLinux 8或更高版本"
                exit 1
            fi
            PACKAGE_MANAGER="dnf"
            ;;
        fedora)
            PACKAGE_MANAGER="dnf"
            ;;
        *)
            log_error "不支持的系统: $ID"
            log_info "请使用CentOS 8+, RHEL 8+, Rocky Linux 8+或AlmaLinux 8+"
            exit 1
            ;;
    esac
    
    log_info "检测到系统: $PRETTY_NAME"
}

# 更新系统
update_system() {
    log_step "更新系统包..."
    sudo $PACKAGE_MANAGER update -y
    sudo $PACKAGE_MANAGER install -y curl wget git gcc gcc-c++ make python3 python3-pip openssl-devel bc
    
    # 启用EPEL仓库
    if [[ "$ID" == "centos" || "$ID" == "rhel" ]]; then
        sudo $PACKAGE_MANAGER install -y epel-release
    fi
}

# 验证Git安装
verify_git() {
    log_step "验证Git安装..."
    
    # 检查git是否安装
    if ! command -v git &> /dev/null; then
        log_error "Git安装失败"
        exit 1
    fi
    
    # 检查git版本
    GIT_VERSION=$(git --version | grep -oE '[0-9]+\.[0-9]+' | head -1)
    if [[ $(echo "$GIT_VERSION >= 2.0" | bc -l) -eq 0 ]]; then
        log_warn "Git版本较低: $GIT_VERSION，建议升级到2.0+"
    fi
    
    log_info "Git安装成功，版本: $(git --version)"
}

# 检查GitHub连接
check_github_access() {
    log_step "检查GitHub连接..."
    
    if ! curl -s --connect-timeout 10 https://api.github.com/repos/codingauto/aicarpool >/dev/null; then
        log_warn "无法直接访问GitHub，可能需要配置代理"
        log_info "如果在国内环境，建议配置Git代理或使用镜像源"
        
        # 提供代理配置提示
        echo -e "${YELLOW}如需配置Git代理，可运行:${NC}"
        echo "git config --global http.proxy http://proxy-server:port"
        echo "git config --global https.proxy https://proxy-server:port"
        echo ""
        
        read -p "是否继续安装？可能会因网络问题失败 [y/N] " -n 1 -r
        echo ""
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            log_info "安装已取消"
            exit 0
        fi
    else
        log_info "GitHub连接正常"
    fi
}

# 安装Node.js
install_nodejs() {
    log_step "安装Node.js 18..."
    
    # 检查是否已安装
    if command -v node &> /dev/null; then
        NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
        if [[ $NODE_VERSION -ge 18 ]]; then
            log_info "Node.js已安装，版本: $(node -v)"
            return
        fi
    fi
    
    # 安装Node.js 18
    curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
    sudo $PACKAGE_MANAGER install -y nodejs
    
    # 验证安装
    if ! command -v node &> /dev/null; then
        log_error "Node.js安装失败"
        exit 1
    fi
    
    log_info "Node.js安装成功，版本: $(node -v)"
    log_info "npm版本: $(npm -v)"
}

# 安装MySQL
install_mysql() {
    log_step "安装MySQL 8.0..."
    
    # 检查是否已安装
    if systemctl is-active --quiet mysqld; then
        log_info "MySQL已安装并运行"
        return
    fi
    
    # 生成MySQL root密码
    if [[ -z "$MYSQL_ROOT_PASSWORD" ]]; then
        MYSQL_ROOT_PASSWORD=$(openssl rand -base64 32)
        log_info "生成MySQL root密码: $MYSQL_ROOT_PASSWORD"
        echo "MYSQL_ROOT_PASSWORD=$MYSQL_ROOT_PASSWORD" >> ~/.aicarpool_env
    fi
    
    # 安装MySQL仓库
    if [[ ! -f /etc/yum.repos.d/mysql-community.repo ]]; then
        sudo $PACKAGE_MANAGER install -y https://dev.mysql.com/get/mysql80-community-release-el8-1.noarch.rpm || true
    fi
    
    # 禁用默认MySQL模块（CentOS 8+）
    if command -v dnf &> /dev/null; then
        sudo dnf module disable mysql -y || true
    fi
    
    # 安装MySQL
    sudo $PACKAGE_MANAGER install -y mysql-community-server mysql-community-client
    
    # 启动MySQL
    sudo systemctl start mysqld
    sudo systemctl enable mysqld
    
    # 获取临时密码
    TEMP_PASSWORD=$(sudo grep 'temporary password' /var/log/mysqld.log | tail -1 | awk '{print $NF}')
    
    # 重置root密码
    mysql --connect-expired-password -u root -p"$TEMP_PASSWORD" << EOF
ALTER USER 'root'@'localhost' IDENTIFIED BY '$MYSQL_ROOT_PASSWORD';
DELETE FROM mysql.user WHERE User='';
DROP DATABASE IF EXISTS test;
DELETE FROM mysql.db WHERE Db='test' OR Db='test\\_%';
FLUSH PRIVILEGES;
EOF
    
    log_info "MySQL安装完成"
}

# 安装Redis
install_redis() {
    log_step "安装Redis..."
    
    if systemctl is-active --quiet redis; then
        log_info "Redis已安装并运行"
        return
    fi
    
    sudo $PACKAGE_MANAGER install -y redis
    
    # 配置Redis
    sudo sed -i 's/^supervised no/supervised systemd/' /etc/redis.conf || sudo sed -i 's/^supervised no/supervised systemd/' /etc/redis/redis.conf
    
    # 启动Redis
    sudo systemctl start redis
    sudo systemctl enable redis
    
    # 测试Redis
    if redis-cli ping | grep -q PONG; then
        log_info "Redis安装成功"
    else
        log_error "Redis安装失败"
        exit 1
    fi
}

# 安装PM2
install_pm2() {
    log_step "安装PM2进程管理器..."
    
    if command -v pm2 &> /dev/null; then
        log_info "PM2已安装"
        return
    fi
    
    sudo npm install -g pm2
    
    # 设置PM2开机自启
    sudo pm2 startup
    
    log_info "PM2安装完成"
}

# 创建应用用户和目录
setup_app() {
    log_step "设置应用环境..."
    
    # 创建应用目录
    APP_DIR="/opt/aicarpool"
    if [[ ! -d "$APP_DIR" ]]; then
        sudo mkdir -p "$APP_DIR"
        sudo chown $USER:$USER "$APP_DIR"
    fi
    
    # 克隆或更新代码
    if [[ ! -d "$APP_DIR/.git" ]]; then
        log_info "克隆项目代码..."
        
        # 尝试克隆，如果失败提供备选方案
        if ! git clone https://github.com/codingauto/aicarpool.git "$APP_DIR"; then
            log_error "Git克隆失败，可能是网络问题"
            log_info "请检查网络连接或配置Git代理后重试"
            exit 1
        fi
        
        log_info "代码克隆完成"
    else
        log_info "检测到现有代码，更新到最新版本..."
        cd "$APP_DIR"
        
        # 检查是否有本地修改
        if ! git diff --quiet || ! git diff --cached --quiet; then
            log_warn "检测到本地修改，将暂存后更新"
            git stash push -m "Auto stash before update $(date)"
        fi
        
        # 获取最新代码
        if ! git fetch origin; then
            log_error "获取远程更新失败，请检查网络连接"
            exit 1
        fi
        
        # 检查是否需要更新
        LOCAL_COMMIT=$(git rev-parse HEAD)
        REMOTE_COMMIT=$(git rev-parse origin/main)
        
        if [[ "$LOCAL_COMMIT" != "$REMOTE_COMMIT" ]]; then
            log_info "发现新版本，正在更新..."
            if ! git reset --hard origin/main; then
                log_error "代码更新失败"
                exit 1
            fi
            log_info "代码更新完成"
        else
            log_info "已是最新版本"
        fi
    fi
    
    cd "$APP_DIR"
    
    # 安装依赖
    log_info "安装项目依赖..."
    if ! npm install; then
        log_error "依赖安装失败"
        exit 1
    fi
    
    log_info "应用代码部署完成"
}

# 配置数据库
setup_database() {
    log_step "配置数据库..."
    
    # 生成数据库密码
    if [[ -z "$DB_PASSWORD" ]]; then
        DB_PASSWORD=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-25)
        echo "DB_PASSWORD=$DB_PASSWORD" >> ~/.aicarpool_env
    fi
    
    # 创建数据库和用户
    mysql -u root -p"$MYSQL_ROOT_PASSWORD" << EOF
CREATE DATABASE IF NOT EXISTS aicarpool CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'aicarpool'@'localhost' IDENTIFIED BY '$DB_PASSWORD';
GRANT ALL PRIVILEGES ON aicarpool.* TO 'aicarpool'@'localhost';
FLUSH PRIVILEGES;
EOF
    
    log_info "数据库配置完成"
}

# 配置环境变量
setup_env() {
    log_step "配置应用环境变量..."
    
    cd "$APP_DIR"
    
    # 生成JWT密钥
    JWT_SECRET=$(openssl rand -base64 64)
    NEXTAUTH_SECRET=$(openssl rand -base64 32)
    
    # 创建.env.local文件
    cat > .env.local << EOF
# 数据库配置
DATABASE_URL="mysql://aicarpool:$DB_PASSWORD@localhost:3306/aicarpool"

# Redis配置
REDIS_URL="redis://localhost:6379"

# JWT配置
NEXTAUTH_SECRET="$NEXTAUTH_SECRET"
NEXTAUTH_URL="http://localhost:3000"

# 应用配置
NODE_ENV="production"
PORT=3000

# 邮件配置（需要手动配置）
# SMTP_HOST=""
# SMTP_PORT="587"
# SMTP_USER=""
# SMTP_PASSWORD=""

# AI服务配置（需要手动配置）
# CLAUDE_API_KEY=""
# OPENAI_API_KEY=""
EOF
    
    # 保存密钥信息
    cat >> ~/.aicarpool_env << EOF
JWT_SECRET=$JWT_SECRET
NEXTAUTH_SECRET=$NEXTAUTH_SECRET
EOF
    
    log_info "环境变量配置完成"
}

# 初始化数据库
init_database() {
    log_step "初始化数据库..."
    
    cd "$APP_DIR"
    
    # 生成Prisma客户端
    npx prisma generate
    
    # 运行数据库迁移
    npx prisma migrate deploy
    
    # 初始化种子数据
    if [[ -f "scripts/seed-ai-services.js" ]]; then
        npm run seed 2>/dev/null || node scripts/seed-ai-services.js
    fi
    
    log_info "数据库初始化完成"
}

# 构建应用
build_app() {
    log_step "构建应用..."
    
    cd "$APP_DIR"
    npm run build
    
    log_info "应用构建完成"
}

# 配置防火墙
setup_firewall() {
    log_step "配置防火墙..."
    
    if systemctl is-active --quiet firewalld; then
        sudo firewall-cmd --permanent --add-port=22/tcp
        sudo firewall-cmd --permanent --add-port=3000/tcp
        sudo firewall-cmd --permanent --add-port=80/tcp
        sudo firewall-cmd --permanent --add-port=443/tcp
        sudo firewall-cmd --reload
        log_info "防火墙配置完成"
    else
        log_warn "防火墙未启用"
    fi
}

# 配置SELinux
setup_selinux() {
    log_step "配置SELinux..."
    
    if command -v getenforce &> /dev/null && [[ "$(getenforce)" != "Disabled" ]]; then
        # 允许网络连接
        sudo setsebool -P httpd_can_network_connect 1
        sudo setsebool -P httpd_can_network_relay 1
        
        # 允许端口绑定
        sudo semanage port -a -t http_port_t -p tcp 3000 || true
        
        log_info "SELinux配置完成"
    else
        log_info "SELinux未启用或已禁用"
    fi
}

# 启动服务
start_service() {
    log_step "启动AiCarpool服务..."
    
    cd "$APP_DIR"
    
    # 创建PM2配置文件
    cat > ecosystem.config.js << EOF
module.exports = {
  apps: [{
    name: 'aicarpool',
    script: 'npm',
    args: 'start',
    cwd: '$APP_DIR',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    log_file: '$APP_DIR/logs/combined.log',
    out_file: '$APP_DIR/logs/out.log',
    error_file: '$APP_DIR/logs/error.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    max_memory_restart: '1G',
    instances: 1,
    exec_mode: 'fork'
  }]
};
EOF
    
    # 创建日志目录
    mkdir -p logs
    
    # 启动应用
    pm2 start ecosystem.config.js
    pm2 save
    
    # 等待服务启动
    sleep 10
    
    # 检查服务状态
    if pm2 list | grep -q "aicarpool.*online"; then
        log_info "AiCarpool服务启动成功"
    else
        log_error "AiCarpool服务启动失败"
        pm2 logs aicarpool --lines 20
        exit 1
    fi
}

# 显示部署信息
show_info() {
    log_step "部署完成！"
    
    echo -e "\n${GREEN}=== AiCarpool 部署信息 ===${NC}"
    echo -e "${BLUE}应用地址:${NC} http://$(hostname -I | awk '{print $1}'):3000"
    echo -e "${BLUE}应用目录:${NC} $APP_DIR"
    echo -e "${BLUE}日志目录:${NC} $APP_DIR/logs"
    echo -e "${BLUE}配置文件:${NC} $APP_DIR/.env.local"
    
    echo -e "\n${GREEN}=== 数据库信息 ===${NC}"
    echo -e "${BLUE}MySQL Root密码:${NC} $MYSQL_ROOT_PASSWORD"
    echo -e "${BLUE}应用数据库:${NC} aicarpool"
    echo -e "${BLUE}数据库用户:${NC} aicarpool"
    echo -e "${BLUE}数据库密码:${NC} $DB_PASSWORD"
    
    echo -e "\n${GREEN}=== 常用命令 ===${NC}"
    echo -e "${BLUE}查看服务状态:${NC} pm2 status"
    echo -e "${BLUE}查看应用日志:${NC} pm2 logs aicarpool"
    echo -e "${BLUE}重启应用:${NC} pm2 restart aicarpool"
    echo -e "${BLUE}查看MySQL状态:${NC} systemctl status mysqld"
    echo -e "${BLUE}查看Redis状态:${NC} systemctl status redis"
    
    echo -e "\n${GREEN}=== 重要提示 ===${NC}"
    echo -e "${YELLOW}1. 密钥信息已保存到: ~/.aicarpool_env${NC}"
    echo -e "${YELLOW}2. 请手动配置邮件和AI服务密钥${NC}"
    echo -e "${YELLOW}3. 建议配置SSL证书和域名${NC}"
    echo -e "${YELLOW}4. 生产环境建议使用Nginx反向代理${NC}"
    echo -e "${YELLOW}5. 检查防火墙和SELinux设置${NC}"
    
    echo -e "\n${GREEN}部署成功！访问 http://$(hostname -I | awk '{print $1}'):3000 开始使用${NC}"
}

# 主函数
main() {
    echo -e "${GREEN}"
    echo "=================================="
    echo "  AiCarpool CentOS 一键部署脚本"
    echo "=================================="
    echo -e "${NC}"
    
    check_root
    check_system
    update_system
    verify_git
    check_github_access
    install_nodejs
    install_mysql
    install_redis
    install_pm2
    setup_app
    setup_database
    setup_env
    init_database
    build_app
    setup_firewall
    setup_selinux
    start_service
    show_info
}

# 错误处理
trap 'log_error "部署过程中发生错误，请检查日志"; exit 1' ERR

# 运行主函数
main "$@"
#!/bin/bash

# AiCarpool 通用安装脚本
# 自动检测系统类型并调用对应的部署脚本
# 使用方法: curl -fsSL https://raw.githubusercontent.com/codingauto/aicarpool/main/scripts/install.sh | bash

set -e

# 环境变量说明
# DOCKER_MODE=true         - 强制使用Docker部署模式
# DOCKER_MODE=false        - 强制使用传统部署模式
# QUICK_MODE=true          - 使用快速部署模式，避免迁移冲突
# FORCE_ROOT=true          - 强制允许root用户运行，跳过确认
# SKIP_NETWORK_CHECK=true  - 跳过GitHub网络连接检查

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
                                             
AiCarpool - 企业级AI服务拼车管理平台一键安装脚本
EOF
    echo -e "${NC}"
    echo -e "${BLUE}支持系统:${NC} Ubuntu 18.04+, Debian 10+, CentOS 8+, RHEL 8+, Rocky Linux 8+, AlmaLinux 8+"
    echo -e "${BLUE}GitHub:${NC} https://github.com/codingauto/aicarpool"
    echo ""
}

# 检测系统类型
detect_system() {
    log_step "检测系统类型..."
    
    if [[ ! -f /etc/os-release ]]; then
        log_error "无法检测系统版本，/etc/os-release 文件不存在"
        exit 1
    fi
    
    . /etc/os-release
    
    case $ID in
        ubuntu|debian)
            SYSTEM_TYPE="ubuntu"
            SCRIPT_NAME="deploy-ubuntu.sh"
            log_info "检测到基于Debian的系统: $PRETTY_NAME"
            ;;
        centos|rhel|rocky|almalinux|fedora)
            SYSTEM_TYPE="centos"
            SCRIPT_NAME="deploy-centos.sh"
            log_info "检测到基于RedHat的系统: $PRETTY_NAME"
            ;;
        *)
            log_error "不支持的系统: $ID ($PRETTY_NAME)"
            echo ""
            echo "支持的系统列表:"
            echo "- Ubuntu 18.04+"
            echo "- Debian 10+"
            echo "- CentOS 8+"
            echo "- RHEL 8+"
            echo "- Rocky Linux 8+"
            echo "- AlmaLinux 8+"
            echo "- Fedora"
            exit 1
            ;;
    esac
}

# 检查网络连接
check_network() {
    log_step "检查网络连接..."
    
    if ! curl -s --connect-timeout 10 https://github.com >/dev/null; then
        log_error "无法连接到GitHub，请检查网络连接"
        exit 1
    fi
    
    log_info "网络连接正常"
}

# 检查是否为root用户
check_root() {
    if [[ $EUID -eq 0 ]]; then
        log_warn "当前以root用户身份运行此脚本"
        log_warn "建议使用普通用户运行以提高安全性"
        case $SYSTEM_TYPE in
            ubuntu)
                log_info "建议创建普通用户: adduser aicarpool && usermod -aG sudo aicarpool"
                ;;
            centos)
                log_info "建议创建普通用户: useradd -m aicarpool && usermod -aG wheel aicarpool"
                ;;
        esac
        echo ""
        read -p "确认要以root用户继续安装吗？[y/N] " -n 1 -r
        echo ""
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            log_info "安装已取消"
            exit 0
        fi
        log_info "继续以root用户安装..."
    fi
}

# 检查系统要求
check_requirements() {
    log_step "检查系统要求..."
    
    # 检查内存
    MEMORY_GB=$(free -g | awk '/^Mem:/{print $2}')
    if [[ $MEMORY_GB -lt 2 ]]; then
        log_warn "内存不足2GB，建议至少4GB内存以获得更好性能"
    fi
    
    # 检查磁盘空间
    DISK_GB=$(df / | awk 'NR==2{print int($4/1024/1024)}')
    if [[ $DISK_GB -lt 10 ]]; then
        log_error "磁盘空间不足，至少需要10GB可用空间"
        exit 1
    fi
    
    # 检查sudo权限（仅当非root用户时）
    if [[ $EUID -ne 0 ]] && ! sudo -n true 2>/dev/null; then
        log_error "当前用户没有sudo权限，请确保用户在sudo组中"
        exit 1
    fi
    
    log_info "系统要求检查通过"
}

# 下载并执行部署脚本
download_and_run() {
    log_step "下载部署脚本..."
    
    SCRIPT_URL="https://raw.githubusercontent.com/codingauto/aicarpool/main/scripts/$SCRIPT_NAME"
    TEMP_SCRIPT="/tmp/$SCRIPT_NAME"
    
    # 下载脚本
    if ! curl -fsSL "$SCRIPT_URL" -o "$TEMP_SCRIPT"; then
        log_error "下载部署脚本失败"
        exit 1
    fi
    
    # 验证脚本
    if [[ ! -s "$TEMP_SCRIPT" ]]; then
        log_error "下载的脚本文件为空"
        exit 1
    fi
    
    # 添加执行权限
    chmod +x "$TEMP_SCRIPT"
    
    log_info "部署脚本下载完成，开始执行..."
    echo ""
    
    # 执行部署脚本
    bash "$TEMP_SCRIPT"
    
    # 清理临时文件
    rm -f "$TEMP_SCRIPT"
}

# 检查Docker是否可用
check_docker() {
    if command -v docker &> /dev/null && command -v docker-compose &> /dev/null; then
        if docker info &> /dev/null; then
            return 0
        fi
    fi
    return 1
}

# Docker部署模式
docker_deploy() {
    log_step "检测到Docker环境，使用Docker部署模式"
    
    # 下载Docker部署脚本
    DOCKER_SCRIPT_URL="https://raw.githubusercontent.com/codingauto/aicarpool/main/scripts/docker-deploy.sh"
    TEMP_DOCKER_SCRIPT="/tmp/docker-deploy.sh"
    
    log_info "下载Docker部署脚本..."
    if ! curl -fsSL "$DOCKER_SCRIPT_URL" -o "$TEMP_DOCKER_SCRIPT"; then
        log_error "下载Docker部署脚本失败"
        return 1
    fi
    
    chmod +x "$TEMP_DOCKER_SCRIPT"
    
    log_info "启动Docker部署..."
    bash "$TEMP_DOCKER_SCRIPT"
    
    # 清理临时文件
    rm -f "$TEMP_DOCKER_SCRIPT"
    
    exit 0
}

# 显示安装前确认
show_confirmation() {
    echo -e "${YELLOW}"
    echo "=================================="
    echo "           安装确认"
    echo "=================================="
    echo -e "${NC}"
    echo -e "${BLUE}系统类型:${NC} $PRETTY_NAME"
    
    # 检查部署模式
    if [[ "$DOCKER_MODE" == "true" ]] || (check_docker && [[ "$DOCKER_MODE" != "false" ]]); then
        echo -e "${BLUE}部署模式:${NC} Docker (推荐)"
        echo -e "${BLUE}部署位置:${NC} ~/aicarpool-docker"
        echo -e "${BLUE}服务端口:${NC} 4000"
        echo ""
        echo -e "${YELLOW}此脚本将会部署以下服务:${NC}"
        echo "- AiCarpool 应用程序 (Docker镜像)"
        echo "- MySQL 8.0 (Docker容器)"
        echo "- Redis 7 (Docker容器)"
        echo "- 可选监控服务 (phpMyAdmin, Grafana等)"
        echo ""
        echo -e "${YELLOW}Docker模式优势:${NC}"
        echo "- 更快的部署速度 (2-5分钟)"
        echo "- 环境隔离，避免系统污染"
        echo "- 易于升级和管理"
        echo "- 支持一键卸载"
    else
        echo -e "${BLUE}部署脚本:${NC} $SCRIPT_NAME"
        echo -e "${BLUE}安装位置:${NC} /opt/aicarpool"
        echo -e "${BLUE}服务端口:${NC} 4000"
        echo ""
        echo -e "${YELLOW}此脚本将会安装以下组件:${NC}"
        echo "- Node.js 22+"
        echo "- MySQL 8.0+"
        echo "- Redis 7+"
        echo "- PM2 进程管理器"
        echo "- AiCarpool 应用程序"
        echo ""
        echo -e "${YELLOW}安装模式:${NC}"
        if [[ "$QUICK_MODE" == "true" ]]; then
            echo "- 快速模式：使用最新数据库schema，避免迁移冲突"
        else
            echo "- 标准模式：使用数据库迁移（可能遇到迁移冲突）"
        fi
    fi
    echo ""
    echo -e "${YELLOW}注意事项:${NC}"
    echo "- 安装过程需要sudo权限"
    echo "- 安装时间约5-15分钟（取决于网络速度和模式）"
    echo "- 会自动生成数据库密码等敏感信息"
    echo "- 安装后需要手动配置AI服务密钥"
    echo ""
    
    read -p "确认开始安装？[y/N] " -n 1 -r
    echo ""
    
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log_info "安装已取消"
        exit 0
    fi
}

# 主函数
main() {
    show_welcome
    detect_system
    check_root
    check_network
    check_requirements
    show_confirmation
    
    # 检查是否使用Docker部署
    if [[ "$DOCKER_MODE" == "true" ]] || (check_docker && [[ "$DOCKER_MODE" != "false" ]]); then
        docker_deploy
    else
        download_and_run
    fi
}

# 错误处理
trap 'log_error "安装过程中发生错误"; exit 1' ERR

# 运行主函数
main "$@"
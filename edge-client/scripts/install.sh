#!/bin/bash

# AI Carpool 边缘节点客户端安装脚本

set -e

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
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

# 检查系统要求
check_requirements() {
    log_info "检查系统要求..."
    
    # 检查 Node.js
    if ! command -v node &> /dev/null; then
        log_error "Node.js 未安装。请先安装 Node.js >= 18.0.0"
        exit 1
    fi
    
    NODE_VERSION=$(node -v | cut -d'v' -f2)
    REQUIRED_VERSION="18.0.0"
    
    if ! printf '%s\n%s\n' "$REQUIRED_VERSION" "$NODE_VERSION" | sort -V -C; then
        log_error "Node.js 版本过低。当前版本: $NODE_VERSION，要求版本: >= $REQUIRED_VERSION"
        exit 1
    fi
    
    log_info "Node.js 版本检查通过: $NODE_VERSION"
    
    # 检查 npm
    if ! command -v npm &> /dev/null; then
        log_error "npm 未安装"
        exit 1
    fi
    
    NPM_VERSION=$(npm -v)
    log_info "npm 版本: $NPM_VERSION"
}

# 安装依赖
install_dependencies() {
    log_info "安装项目依赖..."
    
    if [ -f "package-lock.json" ]; then
        npm ci
    else
        npm install
    fi
    
    log_info "依赖安装完成"
}

# 创建必要的目录
create_directories() {
    log_info "创建必要的目录..."
    
    mkdir -p logs
    mkdir -p certs
    
    # 创建 .gitkeep 文件
    touch logs/.gitkeep
    touch certs/.gitkeep
    
    log_info "目录创建完成"
}

# 配置环境变量
setup_environment() {
    log_info "配置环境变量..."
    
    if [ ! -f ".env" ]; then
        if [ -f ".env.example" ]; then
            cp .env.example .env
            log_info "已创建 .env 文件，请根据需要修改配置"
        else
            log_warn ".env.example 文件不存在"
        fi
    else
        log_warn ".env 文件已存在，跳过创建"
    fi
}

# 生成密钥对
generate_keys() {
    log_info "检查密钥对..."
    
    PRIVATE_KEY_PATH="certs/node-private-key.pem"
    PUBLIC_KEY_PATH="certs/node-public-key.pem"
    
    if [ ! -f "$PRIVATE_KEY_PATH" ] || [ ! -f "$PUBLIC_KEY_PATH" ]; then
        log_info "生成 RSA 密钥对..."
        
        if command -v openssl &> /dev/null; then
            openssl genrsa -out "$PRIVATE_KEY_PATH" 2048
            openssl rsa -in "$PRIVATE_KEY_PATH" -pubout -out "$PUBLIC_KEY_PATH"
            
            # 设置适当的权限
            chmod 600 "$PRIVATE_KEY_PATH"
            chmod 644 "$PUBLIC_KEY_PATH"
            
            log_info "密钥对生成完成"
        else
            log_warn "OpenSSL 未安装，将在运行时自动生成密钥对"
        fi
    else
        log_info "密钥对已存在"
    fi
}

# 构建项目
build_project() {
    log_info "构建项目..."
    
    npm run build
    
    log_info "项目构建完成"
}

# 安装 PM2（可选）
install_pm2() {
    if command -v pm2 &> /dev/null; then
        log_info "PM2 已安装"
        return
    fi
    
    read -p "是否安装 PM2 进程管理器? (y/N): " -n 1 -r
    echo
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        log_info "安装 PM2..."
        npm install -g pm2
        log_info "PM2 安装完成"
    fi
}

# 验证安装
verify_installation() {
    log_info "验证安装..."
    
    # 检查构建产物
    if [ ! -d "dist" ]; then
        log_error "构建失败，dist 目录不存在"
        exit 1
    fi
    
    if [ ! -f "dist/index.js" ]; then
        log_error "构建失败，主入口文件不存在"
        exit 1
    fi
    
    log_info "安装验证通过"
}

# 显示安装后信息
show_post_install_info() {
    log_info "安装完成！"
    echo
    echo "下一步操作："
    echo "1. 编辑 .env 文件配置节点信息"
    echo "2. 运行开发服务器: npm run dev"
    echo "3. 构建生产版本: npm run build && npm start"
    echo "4. 使用 PM2 管理: npm run pm2:start"
    echo
    echo "更多信息请查看 README.md 文件"
}

# 主函数
main() {
    echo "====================================="
    echo "AI Carpool 边缘节点客户端安装程序"
    echo "====================================="
    echo
    
    check_requirements
    install_dependencies
    create_directories
    setup_environment
    generate_keys
    build_project
    install_pm2
    verify_installation
    show_post_install_info
}

# 错误处理
trap 'log_error "安装过程中发生错误，请检查输出信息"; exit 1' ERR

# 执行主函数
main "$@"
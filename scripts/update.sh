#!/bin/bash

# AiCarpool 更新脚本
# 用于更新已部署的AiCarpool应用到最新版本
# 使用方法: bash /opt/aicarpool/scripts/update.sh

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

# 显示更新信息
show_update_info() {
    echo -e "${GREEN}"
    cat << 'EOF'
╔══════════════════════════════════════════════════════════════╗
║                    AiCarpool 更新脚本                        ║
║                                                              ║
║  此脚本将更新AiCarpool应用到最新版本                          ║
║  包括代码更新、依赖安装、数据库迁移、服务重启                  ║
╚══════════════════════════════════════════════════════════════╝
EOF
    echo -e "${NC}"
}

# 检查应用是否存在
check_app_exists() {
    log_step "检查应用状态..."
    
    APP_DIR="/opt/aicarpool"
    
    if [[ ! -d "$APP_DIR" ]]; then
        log_error "AiCarpool应用未找到，请先安装应用"
        log_info "安装命令: curl -fsSL https://raw.githubusercontent.com/codingauto/aicarpool/main/scripts/install.sh | bash"
        exit 1
    fi
    
    if [[ ! -d "$APP_DIR/.git" ]]; then
        log_error "应用目录不是Git仓库，无法更新"
        log_info "建议重新安装应用以获得完整的Git支持"
        exit 1
    fi
    
    log_info "找到AiCarpool应用: $APP_DIR"
}

# 检查GitHub连接
check_github_connection() {
    log_step "检查GitHub连接..."
    
    if ! curl -s --connect-timeout 10 https://api.github.com/repos/codingauto/aicarpool >/dev/null; then
        log_warn "无法连接GitHub，可能影响更新"
        log_info "如果在国内环境，建议配置Git代理："
        echo "git config --global http.proxy http://proxy-server:port"
        echo "git config --global https.proxy https://proxy-server:port"
        echo ""
        
        read -p "是否继续尝试更新？[y/N] " -n 1 -r
        echo ""
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            log_info "更新已取消"
            exit 0
        fi
    else
        log_info "GitHub连接正常"
    fi
}

# 备份配置文件
backup_config() {
    log_step "备份配置文件..."
    
    cd "$APP_DIR"
    
    BACKUP_DIR="$HOME/aicarpool_backups"
    BACKUP_TIME=$(date +"%Y%m%d_%H%M%S")
    
    mkdir -p "$BACKUP_DIR"
    
    # 备份环境配置
    if [[ -f ".env.local" ]]; then
        cp .env.local "$BACKUP_DIR/.env.local_$BACKUP_TIME"
        log_info "配置文件已备份: $BACKUP_DIR/.env.local_$BACKUP_TIME"
    fi
    
    # 备份可能的自定义配置
    for config_file in "config.js" "ecosystem.config.js" ".env"; do
        if [[ -f "$config_file" ]]; then
            cp "$config_file" "$BACKUP_DIR/${config_file}_$BACKUP_TIME"
            log_info "配置文件已备份: $BACKUP_DIR/${config_file}_$BACKUP_TIME"
        fi
    done
    
    # 记录当前版本信息
    cat > "$BACKUP_DIR/version_info_$BACKUP_TIME.txt" << EOF
备份时间: $(date)
分支: $(git rev-parse --abbrev-ref HEAD)
提交: $(git rev-parse HEAD)
提交信息: $(git log -1 --pretty=format:"%s")
提交时间: $(git log -1 --pretty=format:"%cd")
EOF
    
    log_info "版本信息已保存: $BACKUP_DIR/version_info_$BACKUP_TIME.txt"
}

# 停止应用服务
stop_service() {
    log_step "停止应用服务..."
    
    if command -v pm2 &> /dev/null; then
        if pm2 list | grep -q "aicarpool.*online"; then
            pm2 stop aicarpool
            log_info "PM2服务已停止"
        else
            log_info "应用服务未运行"
        fi
    else
        log_warn "PM2未安装，跳过服务停止"
    fi
}

# 更新代码
update_code() {
    log_step "更新应用代码..."
    
    cd "$APP_DIR"
    
    # 保存本地修改（如果有）
    if ! git diff --quiet || ! git diff --cached --quiet; then
        log_warn "检测到本地修改，将暂存后更新"
        git stash push -m "Auto stash before update $(date)"
    fi
    
    # 获取远程更新
    log_info "获取远程更新..."
    if ! git fetch origin; then
        log_error "获取远程更新失败，请检查网络连接"
        exit 1
    fi
    
    # 检查是否有更新
    LOCAL_COMMIT=$(git rev-parse HEAD)
    REMOTE_COMMIT=$(git rev-parse origin/main)
    
    if [[ "$LOCAL_COMMIT" == "$REMOTE_COMMIT" ]]; then
        log_info "已是最新版本，无需更新代码"
        return 0
    fi
    
    log_info "发现新版本，开始更新..."
    log_info "当前版本: ${LOCAL_COMMIT:0:8}"
    log_info "目标版本: ${REMOTE_COMMIT:0:8}"
    
    # 显示更新日志
    echo -e "\n${BLUE}=== 更新日志 ===${NC}"
    git log --oneline --graph $LOCAL_COMMIT..$REMOTE_COMMIT | head -10
    echo ""
    
    # 强制更新到最新版本
    if ! git reset --hard origin/main; then
        log_error "代码更新失败"
        exit 1
    fi
    
    log_info "代码更新完成"
}

# 更新依赖
update_dependencies() {
    log_step "检查和更新项目依赖..."
    
    cd "$APP_DIR"
    
    # 检查package.json是否有变化
    if git diff HEAD~1 --name-only 2>/dev/null | grep -q "package.json\|package-lock.json"; then
        log_info "检测到依赖变化，更新依赖包..."
        if ! npm install; then
            log_error "依赖更新失败"
            exit 1
        fi
        log_info "依赖更新完成"
    else
        log_info "依赖未变化，跳过更新"
    fi
}

# 运行数据库迁移
run_migrations() {
    log_step "检查和运行数据库迁移..."
    
    cd "$APP_DIR"
    
    # 检查是否有新的迁移
    if git diff HEAD~1 --name-only 2>/dev/null | grep -q "prisma/"; then
        log_info "检测到数据库结构变化，运行迁移..."
        
        # 生成Prisma客户端
        if ! npx prisma generate; then
            log_error "Prisma客户端生成失败"
            exit 1
        fi
        
        # 运行迁移
        if ! npx prisma migrate deploy; then
            log_error "数据库迁移失败"
            exit 1
        fi
        
        log_info "数据库迁移完成"
    else
        log_info "数据库结构未变化，跳过迁移"
    fi
}

# 重新构建应用
rebuild_app() {
    log_step "重新构建应用..."
    
    cd "$APP_DIR"
    
    # 清理旧的构建文件
    if [[ -d ".next" ]]; then
        rm -rf .next
    fi
    
    # 重新构建
    if ! npm run build; then
        log_error "应用构建失败"
        exit 1
    fi
    
    log_info "应用构建完成"
}

# 启动服务
start_service() {
    log_step "启动应用服务..."
    
    cd "$APP_DIR"
    
    if command -v pm2 &> /dev/null; then
        # 检查PM2配置文件
        if [[ -f "ecosystem.config.js" ]]; then
            pm2 start ecosystem.config.js
        else
            # 如果没有配置文件，使用简单启动
            pm2 start npm --name "aicarpool" -- start
        fi
        
        pm2 save
        
        # 等待服务启动
        sleep 5
        
        # 检查服务状态
        if pm2 list | grep -q "aicarpool.*online"; then
            log_info "应用服务启动成功"
        else
            log_error "应用服务启动失败"
            log_info "查看日志: pm2 logs aicarpool"
            exit 1
        fi
    else
        log_warn "PM2未安装，请手动启动应用: npm start"
    fi
}

# 验证更新
verify_update() {
    log_step "验证更新结果..."
    
    cd "$APP_DIR"
    
    # 检查当前版本
    CURRENT_COMMIT=$(git rev-parse HEAD)
    log_info "当前版本: ${CURRENT_COMMIT:0:8}"
    
    # 检查服务状态
    if command -v pm2 &> /dev/null && pm2 list | grep -q "aicarpool.*online"; then
        log_info "✓ 应用服务运行正常"
    else
        log_warn "⚠ 应用服务状态异常，请检查"
    fi
    
    # 检查端口是否可访问（如果有nc命令）
    if command -v nc &> /dev/null; then
        if nc -z localhost 3000 2>/dev/null; then
            log_info "✓ 应用端口3000可访问"
        else
            log_warn "⚠ 应用端口3000无法访问，可能需要等待启动完成"
        fi
    fi
}

# 显示更新结果
show_result() {
    log_step "更新完成！"
    
    cd "$APP_DIR"
    
    echo -e "\n${GREEN}=== 更新完成 ===${NC}"
    echo -e "${BLUE}当前版本:${NC} $(git rev-parse --short HEAD)"
    echo -e "${BLUE}分支:${NC} $(git rev-parse --abbrev-ref HEAD)"
    echo -e "${BLUE}最后提交:${NC} $(git log -1 --pretty=format:"%s")"
    echo -e "${BLUE}提交时间:${NC} $(git log -1 --pretty=format:"%cd" --date=format:'%Y-%m-%d %H:%M:%S')"
    
    echo -e "\n${GREEN}=== 访问信息 ===${NC}"
    echo -e "${BLUE}应用地址:${NC} http://localhost:3000"
    if command -v hostname &> /dev/null; then
        echo -e "${BLUE}外网地址:${NC} http://$(hostname -I | awk '{print $1}'):3000"
    fi
    echo -e "${BLUE}应用目录:${NC} $APP_DIR"
    echo -e "${BLUE}日志查看:${NC} pm2 logs aicarpool"
    
    if [[ -d "$HOME/aicarpool_backups" ]]; then
        echo -e "\n${GREEN}=== 备份信息 ===${NC}"
        echo -e "${BLUE}备份目录:${NC} $HOME/aicarpool_backups"
        echo "最近的备份文件:"
        ls -lt "$HOME/aicarpool_backups" 2>/dev/null | head -3 | tail -n +2
    fi
    
    echo -e "\n${GREEN}更新成功完成！${NC}"
}

# 显示帮助信息
show_help() {
    echo "AiCarpool 更新脚本"
    echo ""
    echo "用法:"
    echo "  $0           # 更新到最新版本"
    echo "  $0 --help    # 显示帮助信息"
    echo "  $0 --version # 显示当前版本信息"
    echo ""
    echo "功能:"
    echo "  - 自动备份配置文件"
    echo "  - 更新代码到最新版本"
    echo "  - 更新依赖包"
    echo "  - 运行数据库迁移"
    echo "  - 重新构建应用"
    echo "  - 重启服务"
    echo ""
    echo "注意:"
    echo "  - 请确保有足够的磁盘空间"
    echo "  - 更新过程中服务会短暂停止"
    echo "  - 配置文件会自动备份到 ~/aicarpool_backups"
}

# 显示版本信息
show_version() {
    APP_DIR="/opt/aicarpool"
    
    if [[ -d "$APP_DIR/.git" ]]; then
        cd "$APP_DIR"
        echo "当前版本信息:"
        echo "提交: $(git rev-parse HEAD)"
        echo "分支: $(git rev-parse --abbrev-ref HEAD)"
        echo "最后提交: $(git log -1 --pretty=format:"%s")"
        echo "提交时间: $(git log -1 --pretty=format:"%cd")"
    else
        echo "未找到版本信息"
    fi
}

# 主函数
main() {
    # 检查命令行参数
    case "${1:-}" in
        --help|-h)
            show_help
            ;;
        --version|-v)
            show_version
            ;;
        *)
            show_update_info
            check_app_exists
            check_github_connection
            backup_config
            stop_service
            update_code
            update_dependencies
            run_migrations
            rebuild_app
            start_service
            verify_update
            show_result
            ;;
    esac
}

# 错误处理
trap 'log_error "更新过程中发生错误，请检查上面的错误信息"; exit 1' ERR

# 运行主函数
main "$@"
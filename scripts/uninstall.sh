#!/bin/bash

# AiCarpool 卸载脚本
# 完全移除AiCarpool及其相关组件
# 使用方法: bash scripts/uninstall.sh

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

# 显示警告信息
show_warning() {
    echo -e "${RED}"
    cat << 'EOF'
⚠️  警告：AiCarpool 卸载脚本
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
此脚本将完全删除 AiCarpool 及其相关数据！

将要删除的内容：
• AiCarpool 应用程序 (/opt/aicarpool)
• 数据库 (aicarpool数据库)
• PM2 进程
• 应用日志文件
• 配置文件

将要保留的内容：
• MySQL 服务器 (但会删除aicarpool数据库)
• Redis 服务器
• Node.js
• PM2 (但会删除aicarpool进程)

注意：此操作不可逆！请确保已备份重要数据！
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EOF
    echo -e "${NC}"
}

# 确认卸载
confirm_uninstall() {
    echo -e "${YELLOW}请仔细确认以下信息：${NC}"
    echo -e "${BLUE}应用目录:${NC} /opt/aicarpool"
    echo -e "${BLUE}数据库:${NC} aicarpool"
    echo -e "${BLUE}PM2进程:${NC} aicarpool"
    echo ""
    
    read -p "确定要卸载 AiCarpool 吗？输入 'yes' 确认: " -r
    echo ""
    
    if [[ ! $REPLY == "yes" ]]; then
        log_info "卸载已取消"
        exit 0
    fi
    
    echo -e "${RED}最后确认：所有数据将被永久删除！${NC}"
    read -p "请再次输入 'DELETE' 来确认删除所有数据: " -r
    echo ""
    
    if [[ ! $REPLY == "DELETE" ]]; then
        log_info "卸载已取消"
        exit 0
    fi
}

# 停止PM2进程
stop_pm2_process() {
    log_step "停止 PM2 进程..."
    
    if command -v pm2 &> /dev/null; then
        # 停止aicarpool进程
        pm2 delete aicarpool 2>/dev/null || log_warn "PM2中没有找到aicarpool进程"
        
        # 保存PM2配置
        pm2 save 2>/dev/null || true
        
        log_info "PM2进程已停止"
    else
        log_warn "PM2未安装，跳过进程停止"
    fi
}

# 备份数据库（可选）
backup_database() {
    log_step "是否备份数据库？"
    
    read -p "是否要备份aicarpool数据库？[y/N] " -n 1 -r
    echo ""
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        BACKUP_FILE="aicarpool_backup_$(date +%Y%m%d_%H%M%S).sql"
        
        # 检查配置文件中的数据库信息
        if [[ -f "/opt/aicarpool/.env.local" ]]; then
            DB_URL=$(grep "DATABASE_URL" /opt/aicarpool/.env.local | cut -d'"' -f2)
            if [[ $DB_URL =~ mysql://([^:]+):([^@]+)@([^:]+):([^/]+)/(.+) ]]; then
                DB_USER="${BASH_REMATCH[1]}"
                DB_PASS="${BASH_REMATCH[2]}"
                DB_HOST="${BASH_REMATCH[3]}"
                DB_PORT="${BASH_REMATCH[4]}"
                DB_NAME="${BASH_REMATCH[5]}"
                
                log_info "正在备份数据库到 $BACKUP_FILE ..."
                mysqldump -h"$DB_HOST" -P"$DB_PORT" -u"$DB_USER" -p"$DB_PASS" "$DB_NAME" > "$BACKUP_FILE" 2>/dev/null || {
                    log_warn "数据库备份失败，可能是密码错误或数据库不存在"
                }
                
                if [[ -f "$BACKUP_FILE" && -s "$BACKUP_FILE" ]]; then
                    log_info "数据库备份完成: $BACKUP_FILE"
                else
                    log_warn "数据库备份失败或文件为空"
                fi
            else
                log_warn "无法解析数据库URL，跳过备份"
            fi
        else
            log_warn "未找到配置文件，跳过数据库备份"
        fi
    fi
}

# 删除数据库
remove_database() {
    log_step "删除应用数据库..."
    
    if [[ -f "/opt/aicarpool/.env.local" ]]; then
        DB_URL=$(grep "DATABASE_URL" /opt/aicarpool/.env.local | cut -d'"' -f2)
        if [[ $DB_URL =~ mysql://([^:]+):([^@]+)@([^:]+):([^/]+)/(.+) ]]; then
            DB_USER="${BASH_REMATCH[1]}"
            DB_PASS="${BASH_REMATCH[2]}"
            DB_HOST="${BASH_REMATCH[3]}"
            DB_PORT="${BASH_REMATCH[4]}"
            DB_NAME="${BASH_REMATCH[5]}"
            
            # 删除数据库和用户
            mysql -h"$DB_HOST" -P"$DB_PORT" -u"$DB_USER" -p"$DB_PASS" << EOF 2>/dev/null || true
DROP DATABASE IF EXISTS $DB_NAME;
EOF
            
            # 尝试用root删除用户（如果有权限）
            read -p "请输入MySQL root密码（用于删除数据库用户，可跳过）: " -s ROOT_PASS
            echo ""
            
            if [[ -n "$ROOT_PASS" ]]; then
                mysql -u root -p"$ROOT_PASS" << EOF 2>/dev/null || log_warn "无法删除数据库用户，可能权限不足"
DROP USER IF EXISTS '$DB_USER'@'localhost';
FLUSH PRIVILEGES;
EOF
                log_info "数据库和用户已删除"
            else
                log_warn "跳过数据库用户删除"
            fi
        fi
    else
        log_warn "未找到配置文件，跳过数据库删除"
    fi
}

# 删除应用文件
remove_application() {
    log_step "删除应用文件..."
    
    APP_DIR="/opt/aicarpool"
    
    if [[ -d "$APP_DIR" ]]; then
        # 删除应用目录
        sudo rm -rf "$APP_DIR"
        log_info "应用目录已删除: $APP_DIR"
    else
        log_warn "应用目录不存在: $APP_DIR"
    fi
    
    # 删除用户目录下的配置文件
    if [[ -f ~/.aicarpool_env ]]; then
        rm -f ~/.aicarpool_env
        log_info "用户配置文件已删除: ~/.aicarpool_env"
    fi
}

# 清理防火墙规则
cleanup_firewall() {
    log_step "清理防火墙规则..."
    
    # Ubuntu/Debian (ufw)
    if command -v ufw &> /dev/null; then
        sudo ufw delete allow 3000/tcp 2>/dev/null || true
        log_info "UFW防火墙规则已清理"
    fi
    
    # CentOS/RHEL (firewalld)
    if systemctl is-active --quiet firewalld 2>/dev/null; then
        sudo firewall-cmd --permanent --remove-port=3000/tcp 2>/dev/null || true
        sudo firewall-cmd --reload 2>/dev/null || true
        log_info "Firewalld防火墙规则已清理"
    fi
}

# 清理系统服务
cleanup_services() {
    log_step "清理系统服务..."
    
    # 清理可能的systemd服务文件
    if [[ -f "/etc/systemd/system/aicarpool.service" ]]; then
        sudo systemctl stop aicarpool 2>/dev/null || true
        sudo systemctl disable aicarpool 2>/dev/null || true
        sudo rm -f /etc/systemd/system/aicarpool.service
        sudo systemctl daemon-reload
        log_info "Systemd服务已清理"
    fi
}

# 显示卸载结果
show_result() {
    log_step "卸载完成！"
    
    echo -e "\n${GREEN}=== 卸载完成 ===${NC}"
    echo -e "${BLUE}已删除:${NC}"
    echo "✓ AiCarpool应用程序"
    echo "✓ 应用数据库"
    echo "✓ PM2进程"
    echo "✓ 配置文件"
    echo "✓ 防火墙规则"
    
    echo -e "\n${YELLOW}保留的组件:${NC}"
    echo "• MySQL服务器"
    echo "• Redis服务器"  
    echo "• Node.js"
    echo "• PM2进程管理器"
    echo "• 系统包管理器安装的其他软件"
    
    if [[ -f "aicarpool_backup_"*.sql ]]; then
        echo -e "\n${GREEN}数据库备份文件:${NC}"
        ls -la aicarpool_backup_*.sql 2>/dev/null || true
    fi
    
    echo -e "\n${GREEN}AiCarpool已完全卸载！${NC}"
    echo -e "${BLUE}如需重新安装，请访问: https://github.com/codingauto/aicarpool${NC}"
}

# 主函数
main() {
    echo -e "${GREEN}"
    echo "=================================="
    echo "     AiCarpool 卸载脚本"
    echo "=================================="
    echo -e "${NC}"
    
    show_warning
    confirm_uninstall
    backup_database
    stop_pm2_process
    remove_database
    remove_application
    cleanup_firewall
    cleanup_services
    show_result
}

# 错误处理
trap 'log_error "卸载过程中发生错误"; exit 1' ERR

# 运行主函数
main "$@"
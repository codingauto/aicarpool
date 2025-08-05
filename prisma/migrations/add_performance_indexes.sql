-- v2.7 高并发优化 - 数据库索引优化
-- 这些索引是为了优化API Key验证和SmartAiRouter的查询性能

-- ================================
-- API Key 相关索引优化
-- ================================

-- API Key查询优化 - 主要用于验证中间件
CREATE INDEX IF NOT EXISTS idx_api_keys_key_status_expires 
ON api_keys(key, status, expires_at) 
WHERE status = 'active';

-- API Key按组查询优化
CREATE INDEX IF NOT EXISTS idx_api_keys_group_status 
ON api_keys(group_id, status) 
WHERE status IN ('active', 'inactive');

-- API Key用户关联查询优化
CREATE INDEX IF NOT EXISTS idx_api_keys_user_status 
ON api_keys(user_id, status, created_at DESC);

-- ================================
-- 使用统计相关索引优化
-- ================================

-- 每日使用量查询优化 - 用于配额检查
CREATE INDEX IF NOT EXISTS idx_usage_stats_daily_quota 
ON usage_stats(group_id, request_time) 
WHERE request_time >= CURRENT_DATE;

-- 速率限制查询优化 - 用于时间窗口查询
CREATE INDEX IF NOT EXISTS idx_usage_stats_rate_limit 
ON usage_stats(group_id, request_time, total_tokens) 
WHERE request_time >= NOW() - INTERVAL '1 hour';

-- 月度预算查询优化
CREATE INDEX IF NOT EXISTS idx_usage_stats_monthly_budget 
ON usage_stats(group_id, request_time, cost) 
WHERE request_time >= DATE_TRUNC('month', CURRENT_DATE);

-- API Key使用统计查询优化（元数据JSON查询）
CREATE INDEX IF NOT EXISTS idx_usage_stats_api_key_metadata 
ON usage_stats USING GIN ((metadata->>'apiKeyId')) 
WHERE metadata ? 'apiKeyId';

-- 用户使用统计查询优化
CREATE INDEX IF NOT EXISTS idx_usage_stats_user_time 
ON usage_stats(user_id, request_time DESC, cost);

-- ================================
-- 拼车组相关索引优化
-- ================================

-- 拼车组成员查询优化
CREATE INDEX IF NOT EXISTS idx_group_members_user_group_status 
ON group_members(user_id, group_id, status) 
WHERE status = 'active';

-- 拼车组状态查询优化
CREATE INDEX IF NOT EXISTS idx_groups_status_created 
ON groups(status, created_at DESC) 
WHERE status = 'active';

-- 资源绑定查询优化
CREATE INDEX IF NOT EXISTS idx_group_resource_binding_group 
ON group_resource_bindings(group_id, binding_mode);

-- ================================
-- AI服务账号相关索引优化
-- ================================

-- 账号健康状态查询优化 - 用于SmartAiRouter
CREATE INDEX IF NOT EXISTS idx_ai_accounts_service_health 
ON ai_service_accounts(service_type, is_enabled, status, current_load) 
WHERE is_enabled = true AND status = 'active';

-- 账号类型和负载查询优化
CREATE INDEX IF NOT EXISTS idx_ai_accounts_type_load 
ON ai_service_accounts(account_type, service_type, current_load, last_used_at DESC) 
WHERE is_enabled = true;

-- 账号使用统计查询优化
CREATE INDEX IF NOT EXISTS idx_ai_accounts_usage_stats 
ON ai_service_accounts(service_type, total_requests DESC, total_cost DESC);

-- ================================
-- 账号健康检查相关索引优化
-- ================================

-- 健康检查历史查询优化
CREATE INDEX IF NOT EXISTS idx_account_health_checks_recent 
ON account_health_checks(account_id, checked_at DESC) 
WHERE checked_at >= NOW() - INTERVAL '24 hours';

-- 健康状态统计查询优化
CREATE INDEX IF NOT EXISTS idx_account_health_checks_status 
ON account_health_checks(account_id, is_healthy, checked_at DESC);

-- ================================
-- 账号绑定相关索引优化
-- ================================

-- 专属账号绑定查询优化
CREATE INDEX IF NOT EXISTS idx_group_account_bindings_group 
ON group_account_bindings(group_id, account_id);

-- 共享池绑定查询优化
CREATE INDEX IF NOT EXISTS idx_group_pool_bindings_group 
ON group_pool_bindings(group_id, pool_id);

-- 账号池中的账号查询优化
CREATE INDEX IF NOT EXISTS idx_pool_account_bindings_pool 
ON pool_account_bindings(pool_id, account_id, priority);

-- ================================
-- 复合索引优化（针对复杂查询）
-- ================================

-- API Key验证的完整查询路径优化
CREATE INDEX IF NOT EXISTS idx_api_keys_validation_path 
ON api_keys(key, status, expires_at, group_id, user_id) 
WHERE status = 'active';

-- 使用统计的完整聚合查询优化
CREATE INDEX IF NOT EXISTS idx_usage_stats_aggregation 
ON usage_stats(group_id, request_time, total_tokens, cost, user_id) 
WHERE request_time >= CURRENT_DATE - INTERVAL '7 days';

-- SmartAiRouter账号选择的完整查询优化
CREATE INDEX IF NOT EXISTS idx_smart_router_account_selection 
ON ai_service_accounts(service_type, is_enabled, status, current_load, priority, last_used_at) 
WHERE is_enabled = true AND status = 'active';

-- ================================
-- 部分索引优化（条件索引）
-- ================================

-- 只索引活跃的API Keys
CREATE INDEX IF NOT EXISTS idx_api_keys_active_only 
ON api_keys(group_id, created_at DESC) 
WHERE status = 'active' AND (expires_at IS NULL OR expires_at > NOW());

-- 只索引最近的使用统计
CREATE INDEX IF NOT EXISTS idx_usage_stats_recent_only 
ON usage_stats(group_id, service_type, request_time DESC) 
WHERE request_time >= NOW() - INTERVAL '30 days';

-- 只索引健康的账号
CREATE INDEX IF NOT EXISTS idx_ai_accounts_healthy_only 
ON ai_service_accounts(service_type, current_load, total_requests) 
WHERE is_enabled = true AND status = 'active' AND current_load < 90;

-- ================================
-- JSON字段索引优化（PostgreSQL特定）
-- ================================

-- API Key元数据索引
CREATE INDEX IF NOT EXISTS idx_api_keys_metadata_gin 
ON api_keys USING GIN (metadata) 
WHERE metadata IS NOT NULL;

-- 使用统计元数据索引
CREATE INDEX IF NOT EXISTS idx_usage_stats_metadata_gin 
ON usage_stats USING GIN (metadata) 
WHERE metadata IS NOT NULL;

-- 资源绑定配置索引
CREATE INDEX IF NOT EXISTS idx_group_resource_binding_config_gin 
ON group_resource_bindings USING GIN (binding_config) 
WHERE binding_config IS NOT NULL;

-- ================================
-- 覆盖索引优化（包含所需字段）
-- ================================

-- API Key验证覆盖索引 - 避免回表查询
CREATE INDEX IF NOT EXISTS idx_api_keys_validation_covering 
ON api_keys(key, status, expires_at) 
INCLUDE (id, group_id, user_id, quota_limit, quota_used, metadata)
WHERE status = 'active';

-- 使用统计聚合覆盖索引
CREATE INDEX IF NOT EXISTS idx_usage_stats_aggregation_covering 
ON usage_stats(group_id, request_time) 
INCLUDE (total_tokens, cost, user_id, service_type)
WHERE request_time >= CURRENT_DATE - INTERVAL '1 day';

-- 账号选择覆盖索引
CREATE INDEX IF NOT EXISTS idx_ai_accounts_selection_covering 
ON ai_service_accounts(service_type, is_enabled, status) 
INCLUDE (id, name, current_load, total_requests, last_used_at)
WHERE is_enabled = true AND status = 'active';

-- ================================
-- 统计信息更新命令
-- ================================

-- 更新表统计信息以优化查询计划
ANALYZE api_keys;
ANALYZE usage_stats;
ANALYZE ai_service_accounts;
ANALYZE group_members;
ANALYZE groups;
ANALYZE group_resource_bindings;
ANALYZE account_health_checks;

-- ================================
-- 索引使用情况监控查询（用于调试和优化）
-- ================================

-- 查看索引使用情况的SQL（供调试使用）
/*
-- 查看索引使用统计
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_tup_read,
    idx_tup_fetch,
    idx_scan
FROM pg_stat_user_indexes 
WHERE tablename IN ('api_keys', 'usage_stats', 'ai_service_accounts')
ORDER BY idx_scan DESC;

-- 查看未使用的索引
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_scan,
    pg_size_pretty(pg_relation_size(indexrelid)) as size
FROM pg_stat_user_indexes 
WHERE idx_scan = 0 
    AND tablename IN ('api_keys', 'usage_stats', 'ai_service_accounts')
ORDER BY pg_relation_size(indexrelid) DESC;

-- 查看表的查询性能
SELECT 
    schemaname,
    tablename,
    seq_scan,
    seq_tup_read,
    idx_scan,
    idx_tup_fetch,
    n_tup_ins,
    n_tup_upd,
    n_tup_del
FROM pg_stat_user_tables 
WHERE tablename IN ('api_keys', 'usage_stats', 'ai_service_accounts')
ORDER BY seq_scan DESC;
*/
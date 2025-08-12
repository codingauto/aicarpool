-- 添加Claude Console API模式和中转服务配置字段
-- Migration: add_claude_console_api_mode

-- 添加API模式字段
ALTER TABLE `ai_service_accounts` 
ADD COLUMN `claudeConsoleApiMode` VARCHAR(191) DEFAULT 'proxy' 
AFTER `manualRefreshToken`;

-- 添加中转服务类型字段
ALTER TABLE `ai_service_accounts` 
ADD COLUMN `claudeConsoleProxyService` VARCHAR(191) DEFAULT 'tongyi-qianwen-3' 
AFTER `claudeConsoleApiMode`;

-- 为现有的Claude Console账户设置默认值
UPDATE `ai_service_accounts` 
SET 
  `claudeConsoleApiMode` = 'proxy',
  `claudeConsoleProxyService` = 'tongyi-qianwen-3'
WHERE `platform` = 'claude_console' 
  AND `claudeConsoleApiMode` IS NULL;

-- 添加注释
ALTER TABLE `ai_service_accounts` 
MODIFY COLUMN `claudeConsoleApiMode` VARCHAR(191) DEFAULT 'proxy' 
COMMENT 'Claude Console API模式：native=原生API, proxy=中转服务';

ALTER TABLE `ai_service_accounts` 
MODIFY COLUMN `claudeConsoleProxyService` VARCHAR(191) DEFAULT 'tongyi-qianwen-3' 
COMMENT 'Claude Console中转服务类型：kimi-k2, tongyi-qianwen-3, zhipu-glm-4.5, custom';

-- 更新模型列表字段的注释
ALTER TABLE `ai_service_accounts` 
MODIFY COLUMN `claudeConsoleSupportedModels` JSON 
COMMENT 'Claude Console支持的模型列表（仅在原生API模式下使用）';

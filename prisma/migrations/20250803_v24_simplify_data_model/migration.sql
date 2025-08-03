-- Migration: AiCarpool v2.4 数据模型简化
-- 删除复杂的账号池管理，简化为直接账号绑定

-- 1. 删除账号池相关表（保持数据完整性）
DROP TABLE IF EXISTS `group_pool_bindings`;
DROP TABLE IF EXISTS `account_pool_bindings`;
DROP TABLE IF EXISTS `account_pools`;

-- 2. 简化GroupAccountBinding表，移除复杂字段
ALTER TABLE `group_account_bindings` 
DROP COLUMN IF EXISTS `weight`,
DROP COLUMN IF EXISTS `priority`;

-- 3. 为GroupAccountBinding添加v2.4简化字段
ALTER TABLE `group_account_bindings`
ADD COLUMN `binding_type` VARCHAR(191) NOT NULL DEFAULT 'exclusive' COMMENT '绑定类型: exclusive(专属)',
ADD COLUMN `daily_limit` INT DEFAULT NULL COMMENT '日使用限制',
ADD COLUMN `monthly_budget` DECIMAL(10,2) DEFAULT NULL COMMENT '月预算限制',
ADD COLUMN `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3);

-- 4. 确保一个拼车组只能绑定一个账号（在拼车组模式下）
-- 为Group表添加组织类型和绑定模式字段
ALTER TABLE `groups`
ADD COLUMN `organization_type` VARCHAR(191) DEFAULT 'carpool_group' COMMENT '组织类型: carpool_group, enterprise_group',
ADD COLUMN `binding_mode` VARCHAR(191) DEFAULT 'exclusive' COMMENT '绑定模式: exclusive(专属), shared(共享)';

-- 5. 为AiServiceAccount添加简化字段
ALTER TABLE `ai_service_accounts`
ADD COLUMN `owner_type` VARCHAR(191) DEFAULT 'enterprise' COMMENT '所有者类型: enterprise, carpool_group',
ADD COLUMN `max_concurrent_groups` INT DEFAULT 1 COMMENT '最大并发绑定组数（拼车模式为1）';

-- 6. 清理不需要的索引和约束
-- 移除poolBindings相关字段引用
ALTER TABLE `groups` DROP FOREIGN KEY IF EXISTS `groups_ibfk_pool`;
ALTER TABLE `groups` DROP COLUMN IF EXISTS `pool_bindings`;

-- 7. 添加新的约束确保数据完整性
-- 在拼车组模式下，确保一对一绑定
ALTER TABLE `group_account_bindings`
ADD CONSTRAINT `chk_carpool_exclusive_binding` 
CHECK (
  `binding_type` = 'exclusive' 
  OR `binding_type` = 'shared'
);

-- 8. 创建视图简化查询
CREATE OR REPLACE VIEW `carpool_group_bindings` AS
SELECT 
  gab.id,
  gab.group_id,
  gab.account_id,
  gab.binding_type,
  gab.daily_limit,
  gab.monthly_budget,
  gab.is_active,
  gab.created_at,
  gab.updated_at,
  g.name as group_name,
  g.organization_type,
  g.binding_mode,
  a.name as account_name,
  a.service_type,
  a.owner_type
FROM `group_account_bindings` gab
JOIN `groups` g ON gab.group_id = g.id
JOIN `ai_service_accounts` a ON gab.account_id = a.id
WHERE g.organization_type = 'carpool_group';
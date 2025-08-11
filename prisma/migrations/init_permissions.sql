-- =====================================================
-- AiCarpool v2.5 权限系统初始化脚本
-- 创建时间：2025-08-11
-- 功能：初始化权限数据和创建权限视图
-- =====================================================

-- 1. 创建权限审计日志表（用于追踪权限变更）
CREATE TABLE IF NOT EXISTS permission_audit_logs (
  id VARCHAR(30) PRIMARY KEY,
  user_id VARCHAR(30) NOT NULL,
  target_user_id VARCHAR(30),
  action VARCHAR(50) NOT NULL,
  resource_type VARCHAR(50),
  resource_id VARCHAR(30),
  old_value JSON,
  new_value JSON,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_id (user_id),
  INDEX idx_target_user (target_user_id),
  INDEX idx_action (action),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. 创建权限缓存表（提高权限查询性能）
CREATE TABLE IF NOT EXISTS permission_cache (
  id VARCHAR(30) PRIMARY KEY,
  user_id VARCHAR(30) NOT NULL,
  enterprise_id VARCHAR(30),
  permissions JSON NOT NULL,
  expires_at DATETIME NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_user_enterprise (user_id, enterprise_id),
  INDEX idx_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. 创建用户权限视图（简化权限查询）
CREATE OR REPLACE VIEW user_permissions_view AS
SELECT 
  uer.user_id,
  uer.enterprise_id,
  uer.scope,
  uer.resource_id,
  uer.role,
  CASE uer.role
    WHEN 'system_admin' THEN JSON_ARRAY(
      'system.admin', 'enterprise.manage', 'enterprise.view',
      'group.create', 'group.manage', 'group.view',
      'ai.manage', 'ai.use', 
      'user.manage', 'user.invite'
    )
    WHEN 'enterprise_owner' THEN JSON_ARRAY(
      'enterprise.manage', 'enterprise.view',
      'group.create', 'group.manage', 'group.view',
      'ai.manage', 'ai.use',
      'user.invite', 'user.manage'
    )
    WHEN 'enterprise_admin' THEN JSON_ARRAY(
      'enterprise.view',
      'group.create', 'group.manage', 'group.view',
      'user.invite'
    )
    WHEN 'group_owner' THEN JSON_ARRAY(
      'group.manage', 'group.view',
      'ai.use',
      'user.invite'
    )
    WHEN 'group_member' THEN JSON_ARRAY(
      'group.view',
      'ai.use'
    )
    WHEN 'viewer' THEN JSON_ARRAY(
      'enterprise.view',
      'group.view'
    )
    ELSE JSON_ARRAY()
  END as permissions,
  uer.is_active,
  uer.created_at
FROM user_enterprise_roles uer
WHERE uer.is_active = 1;

-- 4. 创建企业成员权限汇总视图
CREATE OR REPLACE VIEW enterprise_members_summary AS
SELECT 
  e.id as enterprise_id,
  e.name as enterprise_name,
  u.id as user_id,
  u.name as user_name,
  u.email as user_email,
  ue.role,
  ue.joined_at,
  ue.is_active,
  COALESCE(
    (SELECT JSON_ARRAYAGG(uer.role)
     FROM user_enterprise_roles uer
     WHERE uer.user_id = u.id 
       AND uer.enterprise_id = e.id
       AND uer.is_active = 1),
    JSON_ARRAY()
  ) as roles,
  COALESCE(
    (SELECT COUNT(*)
     FROM group_members gm
     JOIN `groups` g ON gm.group_id = g.id
     WHERE gm.user_id = u.id 
       AND g.enterprise_id = e.id
       AND gm.status = 'active'),
    0
  ) as group_count
FROM enterprises e
JOIN user_enterprises ue ON e.id = ue.enterprise_id
JOIN users u ON ue.user_id = u.id
WHERE ue.is_active = 1;

-- 5. 初始化系统管理员账号（如果不存在）
INSERT IGNORE INTO users (
  id, email, name, password, role, status, email_verified, created_at, updated_at
) VALUES (
  'system_admin_001',
  'admin@aicarpool.com',
  '系统管理员',
  '$2a$10$YourHashedPasswordHere', -- 需要替换为实际的加密密码
  'admin',
  'active',
  1,
  NOW(),
  NOW()
);

-- 6. 为系统管理员分配全局权限
INSERT IGNORE INTO user_enterprise_roles (
  id, user_id, enterprise_id, role, scope, is_active, created_at, updated_at
) VALUES (
  'role_system_admin_001',
  'system_admin_001',
  NULL,
  'system_admin',
  'global',
  1,
  NOW(),
  NOW()
);

-- 7. 创建存储过程：分配用户角色
DELIMITER $$
CREATE PROCEDURE IF NOT EXISTS assign_user_role(
  IN p_assigner_id VARCHAR(30),
  IN p_target_user_id VARCHAR(30),
  IN p_enterprise_id VARCHAR(30),
  IN p_role VARCHAR(50),
  IN p_scope VARCHAR(20)
)
BEGIN
  DECLARE v_role_id VARCHAR(30);
  
  -- 生成新的角色ID
  SET v_role_id = CONCAT('role_', UUID());
  
  -- 插入新角色
  INSERT INTO user_enterprise_roles (
    id, user_id, enterprise_id, role, scope, is_active, created_at, updated_at
  ) VALUES (
    v_role_id, p_target_user_id, p_enterprise_id, p_role, p_scope, 1, NOW(), NOW()
  )
  ON DUPLICATE KEY UPDATE
    role = p_role,
    updated_at = NOW();
  
  -- 记录审计日志
  INSERT INTO permission_audit_logs (
    id, user_id, target_user_id, action, resource_type, resource_id, new_value, created_at
  ) VALUES (
    CONCAT('audit_', UUID()),
    p_assigner_id,
    p_target_user_id,
    'ASSIGN_ROLE',
    'enterprise',
    p_enterprise_id,
    JSON_OBJECT('role', p_role, 'scope', p_scope),
    NOW()
  );
END$$
DELIMITER ;

-- 8. 创建存储过程：检查用户权限
DELIMITER $$
CREATE FUNCTION IF NOT EXISTS check_user_permission(
  p_user_id VARCHAR(30),
  p_permission VARCHAR(100),
  p_enterprise_id VARCHAR(30)
) RETURNS BOOLEAN
READS SQL DATA
DETERMINISTIC
BEGIN
  DECLARE v_has_permission BOOLEAN DEFAULT FALSE;
  
  SELECT COUNT(*) > 0 INTO v_has_permission
  FROM user_permissions_view
  WHERE user_id = p_user_id
    AND (enterprise_id = p_enterprise_id OR scope = 'global')
    AND JSON_CONTAINS(permissions, JSON_QUOTE(p_permission))
    AND is_active = 1;
  
  RETURN v_has_permission;
END$$
DELIMITER ;

-- 9. 创建索引优化查询性能
ALTER TABLE user_enterprise_roles ADD INDEX idx_user_role (user_id, role);
ALTER TABLE user_enterprise_roles ADD INDEX idx_enterprise_role (enterprise_id, role);
ALTER TABLE user_enterprises ADD INDEX idx_user_active (user_id, is_active);

-- 10. 插入示例权限数据（开发环境）
-- 注意：生产环境应该注释掉这部分
INSERT IGNORE INTO user_enterprise_roles (id, user_id, enterprise_id, role, scope, is_active)
SELECT 
  CONCAT('role_', UUID()),
  ue.user_id,
  ue.enterprise_id,
  ue.role,
  'enterprise',
  1
FROM user_enterprises ue
WHERE ue.is_active = 1
  AND NOT EXISTS (
    SELECT 1 FROM user_enterprise_roles uer
    WHERE uer.user_id = ue.user_id 
      AND uer.enterprise_id = ue.enterprise_id
  );

-- 11. 创建定时清理过期缓存的事件（需要启用事件调度器）
DELIMITER $$
CREATE EVENT IF NOT EXISTS clean_expired_permission_cache
ON SCHEDULE EVERY 1 HOUR
DO
BEGIN
  DELETE FROM permission_cache WHERE expires_at < NOW();
END$$
DELIMITER ;

-- 12. 输出初始化完成信息
SELECT 'Permission system initialization completed successfully!' as message;
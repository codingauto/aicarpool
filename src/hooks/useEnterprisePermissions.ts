/**
 * 企业级权限管理 React Hook
 * 
 * 提供：
 * - 权限状态管理
 * - 权限检查函数
 * - 自动权限验证
 * - 权限缓存
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useUser } from '@/contexts/UserContext';

export interface UserPermissions {
  // 拼车组权限
  canViewGroups: boolean;
  canCreateGroups: boolean;
  canManageGroups: boolean;
  canDeleteGroups: boolean;
  
  // 成员权限
  canViewMembers: boolean;
  canInviteMembers: boolean;
  canManageMembers: boolean;
  canRemoveMembers: boolean;
  
  // 资源权限
  canViewResources: boolean;
  canConfigureResources: boolean;
  canManageApiKeys: boolean;
  
  // 企业权限
  canViewAnalytics: boolean;
  canManageEnterprise: boolean;
  canManageBilling: boolean;
  
  // 拼车组特定权限
  groupPermissions: Record<string, {
    canView: boolean;
    canEdit: boolean;
    canManage: boolean;
    roleInGroup: string;
  }>;
}

export interface EnterpriseContext {
  enterpriseId: string | null;
  enterpriseName: string | null;
  userRoles: Array<{
    roleId: string;
    roleName: string;
    displayName: string;
    scope: string;
  }>;
}

const PERMISSIONS_CACHE_KEY = 'user_permissions_cache';
const CACHE_DURATION = 5 * 60 * 1000; // 5分钟

export function useEnterprisePermissions(groupId?: string) {
  const { user } = useUser();
  const [permissions, setPermissions] = useState<UserPermissions | null>(null);
  const [enterpriseContext, setEnterpriseContext] = useState<EnterpriseContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 从缓存加载权限
  const loadCachedPermissions = useCallback(() => {
    try {
      const cached = localStorage.getItem(PERMISSIONS_CACHE_KEY);
      if (cached) {
        const { data, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp < CACHE_DURATION) {
          setPermissions(data.permissions);
          setEnterpriseContext(data.enterpriseContext);
          return true;
        }
      }
    } catch (error) {
      console.warn('读取权限缓存失败:', error);
    }
    return false;
  }, []);

  // 保存权限到缓存
  const cachePermissions = useCallback((perms: UserPermissions, context: EnterpriseContext) => {
    try {
      const cacheData = {
        data: { permissions: perms, enterpriseContext: context },
        timestamp: Date.now()
      };
      localStorage.setItem(PERMISSIONS_CACHE_KEY, JSON.stringify(cacheData));
    } catch (error) {
      console.warn('保存权限缓存失败:', error);
    }
  }, []);

  // 获取用户权限
  const fetchPermissions = useCallback(async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // 首先尝试从缓存加载
      if (loadCachedPermissions()) {
        setLoading(false);
        return;
      }

      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('用户未登录');
      }

      const response = await fetch('/api/user/permissions', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('获取权限失败');
      }

      const data = await response.json();
      
      if (data.success) {
        const userPermissions: UserPermissions = {
          // 解析后端返回的权限数据
          canViewGroups: data.data.permissions.includes('group.view'),
          canCreateGroups: data.data.permissions.includes('group.create'),
          canManageGroups: data.data.permissions.includes('group.manage'),
          canDeleteGroups: data.data.permissions.includes('group.delete'),
          
          canViewMembers: data.data.permissions.includes('member.view'),
          canInviteMembers: data.data.permissions.includes('member.invite'),
          canManageMembers: data.data.permissions.includes('member.manage'),
          canRemoveMembers: data.data.permissions.includes('member.remove'),
          
          canViewResources: data.data.permissions.includes('resource.view'),
          canConfigureResources: data.data.permissions.includes('resource.configure'),
          canManageApiKeys: data.data.permissions.includes('apikey.manage'),
          
          canViewAnalytics: data.data.permissions.includes('analytics.view'),
          canManageEnterprise: data.data.permissions.includes('enterprise.manage'),
          canManageBilling: data.data.permissions.includes('billing.manage'),
          
          groupPermissions: data.data.groupPermissions || {}
        };

        const context: EnterpriseContext = {
          enterpriseId: data.data.enterpriseId,
          enterpriseName: data.data.enterpriseName,
          userRoles: data.data.roles || []
        };

        setPermissions(userPermissions);
        setEnterpriseContext(context);
        cachePermissions(userPermissions, context);
      } else {
        throw new Error(data.message || '获取权限失败');
      }

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '获取权限失败';
      setError(errorMessage);
      console.error('获取用户权限失败:', err);
    } finally {
      setLoading(false);
    }
  }, [user?.id, user?.token, loadCachedPermissions, cachePermissions]);

  // 检查特定权限
  const hasPermission = useCallback((permission: keyof UserPermissions): boolean => {
    if (!permissions) return false;
    return Boolean(permissions[permission]);
  }, [permissions]);

  // 检查拼车组权限
  const hasGroupPermission = useCallback((groupId: string, action: 'view' | 'edit' | 'manage'): boolean => {
    if (!permissions?.groupPermissions[groupId]) return false;
    
    const groupPerms = permissions.groupPermissions[groupId];
    switch (action) {
      case 'view':
        return groupPerms.canView;
      case 'edit':
        return groupPerms.canEdit;
      case 'manage':
        return groupPerms.canManage;
      default:
        return false;
    }
  }, [permissions]);

  // 检查企业级权限
  const hasEnterprisePermission = useCallback((action: string): boolean => {
    if (!enterpriseContext?.userRoles) return false;
    
    // 检查是否有企业管理员角色
    return enterpriseContext.userRoles.some(role => 
      role.roleName === 'enterprise_admin' || 
      role.roleName === 'super_admin'
    );
  }, [enterpriseContext]);

  // 刷新权限
  const refreshPermissions = useCallback(() => {
    localStorage.removeItem(PERMISSIONS_CACHE_KEY);
    fetchPermissions();
  }, [fetchPermissions]);

  // 权限验证函数
  const requirePermission = useCallback((permission: keyof UserPermissions, errorMessage?: string) => {
    if (!hasPermission(permission)) {
      throw new Error(errorMessage || `缺少权限: ${permission}`);
    }
  }, [hasPermission]);

  // 当前拼车组的权限摘要
  const currentGroupPermissions = useMemo(() => {
    if (!groupId || !permissions?.groupPermissions[groupId]) {
      return {
        canView: false,
        canEdit: false,
        canManage: false,
        roleInGroup: 'none'
      };
    }
    return permissions.groupPermissions[groupId];
  }, [groupId, permissions]);

  // 权限级别分析
  const permissionLevel = useMemo(() => {
    if (!permissions) return 'none';
    
    if (permissions.canManageEnterprise) return 'enterprise_admin';
    if (permissions.canManageGroups) return 'group_admin';
    if (permissions.canViewGroups) return 'member';
    return 'guest';
  }, [permissions]);

  // 是否为企业成员
  const isEnterpriseMember = useMemo(() => {
    return Boolean(enterpriseContext?.enterpriseId);
  }, [enterpriseContext]);

  // 初始化时获取权限
  useEffect(() => {
    fetchPermissions();
  }, [fetchPermissions]);

  return {
    // 状态
    permissions,
    enterpriseContext,
    loading,
    error,
    
    // 权限检查函数
    hasPermission,
    hasGroupPermission,
    hasEnterprisePermission,
    requirePermission,
    
    // 当前拼车组权限
    currentGroupPermissions,
    
    // 元信息
    permissionLevel,
    isEnterpriseMember,
    
    // 操作
    refreshPermissions
  };
}

// 权限检查的便捷 Hook
export function usePermissionGuard(requiredPermission: keyof UserPermissions) {
  const { hasPermission, loading, error } = useEnterprisePermissions();
  
  const hasRequiredPermission = hasPermission(requiredPermission);
  
  return {
    hasPermission: hasRequiredPermission,
    loading,
    error,
    canRender: !loading && hasRequiredPermission
  };
}

// 拼车组权限守卫 Hook
export function useGroupPermissionGuard(groupId: string, requiredAction: 'view' | 'edit' | 'manage') {
  const { hasGroupPermission, loading, error, currentGroupPermissions } = useEnterprisePermissions(groupId);
  
  const hasRequiredPermission = hasGroupPermission(groupId, requiredAction);
  
  return {
    hasPermission: hasRequiredPermission,
    roleInGroup: currentGroupPermissions.roleInGroup,
    loading,
    error,
    canRender: !loading && hasRequiredPermission
  };
}
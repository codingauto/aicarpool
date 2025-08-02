/**
 * 权限守卫组件 - 基于权限条件渲染内容
 * 
 * 支持：
 * - 通用权限检查
 * - 拼车组权限检查
 * - 企业权限检查
 * - 加载状态处理
 * - 错误回退显示
 */

'use client';

import React from 'react';
import { useEnterprisePermissions, usePermissionGuard, useGroupPermissionGuard, UserPermissions } from '@/hooks/useEnterprisePermissions';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Lock, AlertTriangle } from 'lucide-react';

interface BasePermissionGuardProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  showError?: boolean;
  loadingComponent?: React.ReactNode;
}

interface GeneralPermissionGuardProps extends BasePermissionGuardProps {
  requiredPermission: keyof UserPermissions;
  groupId?: never;
  action?: never;
}

interface GroupPermissionGuardProps extends BasePermissionGuardProps {
  requiredPermission?: never;
  groupId: string;
  action: 'view' | 'edit' | 'manage';
}

type PermissionGuardProps = GeneralPermissionGuardProps | GroupPermissionGuardProps;

/**
 * 主权限守卫组件
 */
export function PermissionGuard(props: PermissionGuardProps) {
  const {
    children,
    fallback,
    showError = true,
    loadingComponent,
    requiredPermission,
    groupId,
    action
  } = props;

  // 根据props类型选择合适的hook
  if (groupId && action) {
    return (
      <GroupPermissionGuardImpl
        groupId={groupId}
        action={action}
        fallback={fallback}
        showError={showError}
        loadingComponent={loadingComponent}
      >
        {children}
      </GroupPermissionGuardImpl>
    );
  }

  if (requiredPermission) {
    return (
      <GeneralPermissionGuardImpl
        requiredPermission={requiredPermission}
        fallback={fallback}
        showError={showError}
        loadingComponent={loadingComponent}
      >
        {children}
      </GeneralPermissionGuardImpl>
    );
  }

  // 无有效权限配置，直接渲染
  return <>{children}</>;
}

/**
 * 通用权限守卫实现
 */
function GeneralPermissionGuardImpl({
  requiredPermission,
  children,
  fallback,
  showError,
  loadingComponent
}: {
  requiredPermission: keyof UserPermissions;
  children: React.ReactNode;
  fallback?: React.ReactNode;
  showError?: boolean;
  loadingComponent?: React.ReactNode;
}) {
  const { hasPermission, loading, error, canRender } = usePermissionGuard(requiredPermission);

  if (loading) {
    return loadingComponent || <PermissionLoadingSkeleton />;
  }

  if (error && showError) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          权限验证失败: {error}
        </AlertDescription>
      </Alert>
    );
  }

  if (!canRender) {
    return fallback || <PermissionDeniedFallback permission={requiredPermission} />;
  }

  return <>{children}</>;
}

/**
 * 拼车组权限守卫实现
 */
function GroupPermissionGuardImpl({
  groupId,
  action,
  children,
  fallback,
  showError,
  loadingComponent
}: {
  groupId: string;
  action: 'view' | 'edit' | 'manage';
  children: React.ReactNode;
  fallback?: React.ReactNode;
  showError?: boolean;
  loadingComponent?: React.ReactNode;
}) {
  const { hasPermission, roleInGroup, loading, error, canRender } = useGroupPermissionGuard(groupId, action);

  if (loading) {
    return loadingComponent || <PermissionLoadingSkeleton />;
  }

  if (error && showError) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          拼车组权限验证失败: {error}
        </AlertDescription>
      </Alert>
    );
  }

  if (!canRender) {
    return fallback || <GroupPermissionDeniedFallback action={action} roleInGroup={roleInGroup} />;
  }

  return <>{children}</>;
}

/**
 * 权限拒绝时的默认回退组件
 */
function PermissionDeniedFallback({ permission }: { permission: string }) {
  return (
    <div className="flex items-center justify-center p-4 bg-gray-50 rounded-lg border border-gray-200">
      <div className="text-center">
        <Lock className="w-8 h-8 text-gray-400 mx-auto mb-2" />
        <p className="text-sm text-gray-600">您没有权限访问此功能</p>
        <p className="text-xs text-gray-500 mt-1">需要权限: {permission}</p>
      </div>
    </div>
  );
}

/**
 * 拼车组权限拒绝时的回退组件
 */
function GroupPermissionDeniedFallback({ 
  action, 
  roleInGroup 
}: { 
  action: string; 
  roleInGroup: string;
}) {
  const actionNames = {
    view: '查看',
    edit: '编辑',
    manage: '管理'
  };

  return (
    <div className="flex items-center justify-center p-4 bg-gray-50 rounded-lg border border-gray-200">
      <div className="text-center">
        <Lock className="w-8 h-8 text-gray-400 mx-auto mb-2" />
        <p className="text-sm text-gray-600">您没有权限{actionNames[action as keyof typeof actionNames]}此拼车组</p>
        <p className="text-xs text-gray-500 mt-1">当前角色: {roleInGroup}</p>
      </div>
    </div>
  );
}

/**
 * 权限加载时的骨架屏
 */
function PermissionLoadingSkeleton() {
  return (
    <div className="space-y-2">
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-4 w-1/2" />
    </div>
  );
}

/**
 * 快捷权限守卫组件
 */

// 管理员权限守卫
export function AdminGuard({ children, fallback }: { children: React.ReactNode; fallback?: React.ReactNode }) {
  return (
    <PermissionGuard requiredPermission="canManageGroups" fallback={fallback}>
      {children}
    </PermissionGuard>
  );
}

// 企业权限守卫
export function EnterpriseGuard({ children, fallback }: { children: React.ReactNode; fallback?: React.ReactNode }) {
  return (
    <PermissionGuard requiredPermission="canManageEnterprise" fallback={fallback}>
      {children}
    </PermissionGuard>
  );
}

// 拼车组管理权限守卫
export function GroupManagerGuard({ 
  groupId, 
  children, 
  fallback 
}: { 
  groupId: string; 
  children: React.ReactNode; 
  fallback?: React.ReactNode;
}) {
  return (
    <PermissionGuard groupId={groupId} action="manage" fallback={fallback}>
      {children}
    </PermissionGuard>
  );
}

// 拼车组编辑权限守卫
export function GroupEditorGuard({ 
  groupId, 
  children, 
  fallback 
}: { 
  groupId: string; 
  children: React.ReactNode; 
  fallback?: React.ReactNode;
}) {
  return (
    <PermissionGuard groupId={groupId} action="edit" fallback={fallback}>
      {children}
    </PermissionGuard>
  );
}

/**
 * 权限检查Hook - 可用于组件内部逻辑判断
 */
export function usePermissionCheck() {
  const { hasPermission, hasGroupPermission, permissionLevel, isEnterpriseMember } = useEnterprisePermissions();

  return {
    hasPermission,
    hasGroupPermission,
    permissionLevel,
    isEnterpriseMember,
    
    // 便捷检查函数
    isAdmin: () => hasPermission('canManageGroups'),
    isEnterpriseAdmin: () => hasPermission('canManageEnterprise'),
    canCreateGroups: () => hasPermission('canCreateGroups'),
    canManageMembers: () => hasPermission('canManageMembers'),
    canViewAnalytics: () => hasPermission('canViewAnalytics'),
    
    // 拼车组便捷检查
    canManageGroup: (groupId: string) => hasGroupPermission(groupId, 'manage'),
    canEditGroup: (groupId: string) => hasGroupPermission(groupId, 'edit'),
    canViewGroup: (groupId: string) => hasGroupPermission(groupId, 'view')
  };
}
'use client';

import React from 'react';
import { useEnterpriseContext, EnterpriseRole } from '@/contexts/enterprise-context';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, Lock } from 'lucide-react';

interface EnterpriseGateProps {
  requiredRoles?: EnterpriseRole[];
  requiredPermissions?: string[];
  fallback?: React.ReactNode;
  children: React.ReactNode;
  showError?: boolean;
}

export function EnterpriseGate({ 
  requiredRoles = [], 
  requiredPermissions = [], 
  fallback, 
  children,
  showError = true 
}: EnterpriseGateProps) {
  const { canAccess, loading, error, userRole } = useEnterpriseContext();
  
  // 显示加载状态
  if (loading) {
    return (
      <div className="flex items-center justify-center p-4">
        <div className="text-sm text-gray-500">验证权限中...</div>
      </div>
    );
  }
  
  // 显示错误状态
  if (error) {
    return fallback || (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }
  
  // 检查权限
  const hasAccess = canAccess(requiredRoles, requiredPermissions);
  
  if (!hasAccess) {
    if (fallback) {
      return <>{fallback}</>;
    }
    
    if (!showError) {
      return null;
    }
    
    return (
      <Alert variant="destructive" className="m-4">
        <Lock className="h-4 w-4" />
        <AlertDescription>
          您没有足够的权限访问此功能。当前角色: {userRole}
          {requiredRoles.length > 0 && (
            <div className="mt-2 text-sm">
              需要角色: {requiredRoles.join(', ')}
            </div>
          )}
          {requiredPermissions.length > 0 && (
            <div className="mt-1 text-sm">
              需要权限: {requiredPermissions.join(', ')}
            </div>
          )}
        </AlertDescription>
      </Alert>
    );
  }
  
  return <>{children}</>;
}

// 权限按钮组件
interface PermissionButtonProps {
  requiredRoles?: EnterpriseRole[];
  requiredPermissions?: string[];
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
  onClick?: () => void;
  fallback?: React.ReactNode;
}

export function PermissionButton({
  requiredRoles = [],
  requiredPermissions = [],
  children,
  className = '',
  disabled = false,
  onClick,
  fallback
}: PermissionButtonProps) {
  const { canAccess } = useEnterpriseContext();
  
  const hasAccess = canAccess(requiredRoles, requiredPermissions);
  
  if (!hasAccess) {
    return fallback ? <>{fallback}</> : null;
  }
  
  return (
    <button
      className={className}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

// 权限链接组件
interface PermissionLinkProps {
  requiredRoles?: EnterpriseRole[];
  requiredPermissions?: string[];
  children: React.ReactNode;
  href?: string;
  className?: string;
  fallback?: React.ReactNode;
}

export function PermissionLink({
  requiredRoles = [],
  requiredPermissions = [],
  children,
  href,
  className = '',
  fallback
}: PermissionLinkProps) {
  const { canAccess } = useEnterpriseContext();
  
  const hasAccess = canAccess(requiredRoles, requiredPermissions);
  
  if (!hasAccess) {
    return fallback ? <>{fallback}</> : null;
  }
  
  return (
    <a href={href} className={className}>
      {children}
    </a>
  );
}

// 角色徽章组件
export function RoleBadge() {
  const { userRole } = useEnterpriseContext();
  
  if (!userRole) return null;
  
  const roleConfig = {
    owner: { label: '所有者', className: 'bg-yellow-100 text-yellow-800' },
    admin: { label: '管理员', className: 'bg-blue-100 text-blue-800' },
    member: { label: '成员', className: 'bg-green-100 text-green-800' },
    viewer: { label: '查看者', className: 'bg-gray-100 text-gray-800' }
  };
  
  const config = roleConfig[userRole];
  
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.className}`}>
      {config.label}
    </span>
  );
}

// 企业信息显示组件
export function EnterpriseInfo() {
  const { currentEnterprise, userRole } = useEnterpriseContext();
  
  if (!currentEnterprise) return null;
  
  return (
    <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
      <div className="flex-1">
        <h3 className="font-medium text-gray-900">{currentEnterprise.name}</h3>
        <p className="text-sm text-gray-600">
          {currentEnterprise.memberCount} 成员 · {currentEnterprise.groupCount} 拼车组
        </p>
      </div>
      <RoleBadge />
    </div>
  );
}
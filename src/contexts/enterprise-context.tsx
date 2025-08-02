'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation';

export type EnterpriseRole = 'owner' | 'admin' | 'member' | 'viewer';

export interface Permission {
  id: string;
  name: string;
  description: string;
}

export interface Enterprise {
  id: string;
  name: string;
  planType: string;
  memberCount: number;
  groupCount: number;
  createdAt: string;
}

export interface EnterpriseContextState {
  // 当前企业信息
  currentEnterprise: Enterprise | null;
  
  // 用户在当前企业的角色
  userRole: EnterpriseRole | null;
  
  // 用户权限列表
  permissions: Permission[];
  
  // 加载状态
  loading: boolean;
  
  // 错误信息
  error: string | null;
  
  // 操作方法
  switchEnterprise: (enterpriseId: string) => Promise<void>;
  refreshPermissions: () => Promise<void>;
  clearContext: () => void;
  
  // 权限检查方法
  hasRole: (role: EnterpriseRole) => boolean;
  hasPermission: (permissionName: string) => boolean;
  canAccess: (requiredRoles: EnterpriseRole[], requiredPermissions?: string[]) => boolean;
}

const EnterpriseContext = createContext<EnterpriseContextState | null>(null);

interface EnterpriseProviderProps {
  children: ReactNode;
  enterpriseId?: string;
}

export function EnterpriseProvider({ children, enterpriseId }: EnterpriseProviderProps) {
  const router = useRouter();
  const [currentEnterprise, setCurrentEnterprise] = useState<Enterprise | null>(null);
  const [userRole, setUserRole] = useState<EnterpriseRole | null>(null);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 获取企业信息和用户权限
  const loadEnterpriseContext = async (entId: string) => {
    try {
      setLoading(true);
      setError(null);
      
      const token = localStorage.getItem('token');
      if (!token) {
        router.push('/');
        return;
      }

      // 获取企业信息
      const enterpriseResponse = await fetch(`/api/enterprises/${entId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!enterpriseResponse.ok) {
        if (enterpriseResponse.status === 401) {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          router.push('/');
          return;
        }
        if (enterpriseResponse.status === 403) {
          setError('您没有权限访问此企业');
          return;
        }
        throw new Error('获取企业信息失败');
      }

      const enterpriseData = await enterpriseResponse.json();
      
      if (enterpriseData.success && enterpriseData.data) {
        const enterprise = enterpriseData.data;
        
        setCurrentEnterprise({
          id: enterprise.id,
          name: enterprise.name,
          planType: enterprise.planType,
          memberCount: enterprise._count?.userEnterprises || 0,
          groupCount: enterprise._count?.groups || 0,
          createdAt: enterprise.createdAt
        });
        
        setUserRole(enterprise.userRole || 'member');
        
        // 根据角色设置默认权限
        const rolePermissions = getRolePermissions(enterprise.userRole || 'member');
        setPermissions(rolePermissions);
        
      } else {
        setError('获取企业信息失败');
      }
    } catch (error) {
      console.error('加载企业上下文失败:', error);
      setError('加载企业上下文失败');
    } finally {
      setLoading(false);
    }
  };

  // 根据角色获取权限
  const getRolePermissions = (role: EnterpriseRole): Permission[] => {
    const permissions: Record<EnterpriseRole, Permission[]> = {
      owner: [
        { id: 'enterprise.manage', name: '企业管理', description: '管理企业设置和配置' },
        { id: 'enterprise.delete', name: '删除企业', description: '删除企业' },
        { id: 'groups.create', name: '创建拼车组', description: '创建新的拼车组' },
        { id: 'groups.manage', name: '管理拼车组', description: '管理所有拼车组' },
        { id: 'groups.delete', name: '删除拼车组', description: '删除拼车组' },
        { id: 'members.invite', name: '邀请成员', description: '邀请新成员加入企业' },
        { id: 'members.manage', name: '管理成员', description: '管理企业成员' },
        { id: 'resources.manage', name: '管理资源', description: '管理AI资源和账号池' },
        { id: 'budget.manage', name: '管理预算', description: '管理企业预算和成本分配' },
        { id: 'analytics.view', name: '查看分析', description: '查看使用统计和分析' }
      ],
      admin: [
        { id: 'groups.create', name: '创建拼车组', description: '创建新的拼车组' },
        { id: 'groups.manage', name: '管理拼车组', description: '管理拼车组' },
        { id: 'members.invite', name: '邀请成员', description: '邀请新成员加入企业' },
        { id: 'members.manage', name: '管理成员', description: '管理企业成员' },
        { id: 'resources.manage', name: '管理资源', description: '管理AI资源和账号池' },
        { id: 'analytics.view', name: '查看分析', description: '查看使用统计和分析' }
      ],
      member: [
        { id: 'groups.view', name: '查看拼车组', description: '查看拼车组信息' },
        { id: 'resources.use', name: '使用资源', description: '使用分配的AI资源' },
        { id: 'analytics.view.own', name: '查看个人分析', description: '查看个人使用统计' }
      ],
      viewer: [
        { id: 'groups.view', name: '查看拼车组', description: '查看拼车组信息' },
        { id: 'analytics.view.own', name: '查看个人分析', description: '查看个人使用统计' }
      ]
    };
    
    return permissions[role] || [];
  };

  // 切换企业
  const switchEnterprise = async (newEnterpriseId: string) => {
    try {
      // 更新访问时间
      const token = localStorage.getItem('token');
      await fetch('/api/user/enterprises/access', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ enterpriseId: newEnterpriseId })
      });
      
      // 重新加载企业上下文
      await loadEnterpriseContext(newEnterpriseId);
      
      // 跳转到新企业的控制面板
      router.push(`/enterprise/${newEnterpriseId}/dashboard`);
    } catch (error) {
      console.error('切换企业失败:', error);
      setError('切换企业失败');
    }
  };

  // 刷新权限
  const refreshPermissions = async () => {
    if (currentEnterprise) {
      await loadEnterpriseContext(currentEnterprise.id);
    }
  };

  // 清理上下文
  const clearContext = () => {
    setCurrentEnterprise(null);
    setUserRole(null);
    setPermissions([]);
    setError(null);
  };

  // 权限检查方法
  const hasRole = (role: EnterpriseRole): boolean => {
    if (!userRole) return false;
    
    // 角色层次: owner > admin > member > viewer
    const roleHierarchy: Record<EnterpriseRole, number> = {
      owner: 4,
      admin: 3,
      member: 2,
      viewer: 1
    };
    
    return roleHierarchy[userRole] >= roleHierarchy[role];
  };

  const hasPermission = (permissionName: string): boolean => {
    return permissions.some(p => p.id === permissionName);
  };

  const canAccess = (requiredRoles: EnterpriseRole[], requiredPermissions: string[] = []): boolean => {
    const hasRequiredRole = requiredRoles.some(role => hasRole(role));
    const hasRequiredPermissions = requiredPermissions.every(permission => hasPermission(permission));
    
    return hasRequiredRole && hasRequiredPermissions;
  };

  // 当enterpriseId变化时重新加载上下文
  useEffect(() => {
    if (enterpriseId) {
      loadEnterpriseContext(enterpriseId);
    } else {
      clearContext();
      setLoading(false);
    }
  }, [enterpriseId]);

  const contextValue: EnterpriseContextState = {
    currentEnterprise,
    userRole,
    permissions,
    loading,
    error,
    switchEnterprise,
    refreshPermissions,
    clearContext,
    hasRole,
    hasPermission,
    canAccess
  };

  return (
    <EnterpriseContext.Provider value={contextValue}>
      {children}
    </EnterpriseContext.Provider>
  );
}

// Hook for using the enterprise context
export function useEnterpriseContext(): EnterpriseContextState {
  const context = useContext(EnterpriseContext);
  if (!context) {
    throw new Error('useEnterpriseContext must be used within an EnterpriseProvider');
  }
  return context;
}

// HOC for protecting routes with role requirements
export function withEnterpriseRole<P extends object>(
  Component: React.ComponentType<P>,
  requiredRoles: EnterpriseRole[],
  requiredPermissions: string[] = []
) {
  return function ProtectedComponent(props: P) {
    const { canAccess, loading, error } = useEnterpriseContext();
    
    if (loading) {
      return (
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-gray-500">加载中...</div>
        </div>
      );
    }
    
    if (error) {
      return (
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-red-500">{error}</div>
        </div>
      );
    }
    
    if (!canAccess(requiredRoles, requiredPermissions)) {
      return (
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">访问被拒绝</h1>
            <p className="text-gray-600">您没有足够的权限访问此页面。</p>
          </div>
        </div>
      );
    }
    
    return <Component {...props} />;
  };
}
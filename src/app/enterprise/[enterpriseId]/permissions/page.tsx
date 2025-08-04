'use client';

/**
 * 企业专属权限管理页面
 * 
 * 功能：
 * - 用户权限管理
 * - 角色分配
 * - 权限级别设置
 * - 部门权限管理
 */

import React, { useState, useEffect, use } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Shield,
  Users,
  UserCheck,
  UserX,
  Crown,
  Key,
  Eye,
  Edit,
  Plus,
  Search,
  Filter,
  MoreHorizontal,
  Check,
  X,
  AlertTriangle,
  ChevronLeft,
  Building2
} from 'lucide-react';
import { UserDetailsDialog } from '@/components/user-details-dialog';
import { RoleManagementDialog } from '@/components/role-management-dialog';
import { BatchUserManagementDialog } from '@/components/batch-user-management-dialog';
import { useRouter } from 'next/navigation';
import { useEnterpriseContext } from '@/contexts/enterprise-context';

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  permissions: string[];
  department?: string;
  status: 'active' | 'inactive' | 'pending';
  lastAccess?: string;
}

interface Role {
  id: string;
  name: string;
  displayName: string;
  description: string;
  permissions: string[];
  userCount: number;
  isBuiltIn: boolean;
}

interface Permission {
  id: string;
  name: string;
  category: string;
  description: string;
  level: 'read' | 'write' | 'admin';
}

interface PermissionsData {
  enterprise: {
    id: string;
    name: string;
  };
  users: User[];
  currentUser: {
    id: string;
    role: string;
    permissions: string[];
  };
  availableRoles: Array<{
    key: string;
    name: string;
    permissions: string[];
  }>;
  availablePermissions: string[];
}

export default function EnterprisePermissionsPage({ params }: { params: Promise<{ enterpriseId: string }> }) {
  const { enterpriseId } = use(params);
  const router = useRouter();
  const { currentEnterprise, hasRole } = useEnterpriseContext();
  const [permissionsData, setPermissionsData] = useState<PermissionsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [showRoleDialog, setShowRoleDialog] = useState(false);
  const [showRoleManagementDialog, setShowRoleManagementDialog] = useState(false);
  const [showBatchManagementDialog, setShowBatchManagementDialog] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showUserDetailsDialog, setShowUserDetailsDialog] = useState(false);

  useEffect(() => {
    // 开发模式下直接加载数据，生产环境下检查角色
    if (process.env.NODE_ENV === 'development' || hasRole('owner') || hasRole('admin')) {
      fetchPermissionsData();
    }
  }, [enterpriseId, hasRole]);

  // 权限检查（开发模式下跳过）
  if (process.env.NODE_ENV !== 'development' && !hasRole('owner') && !hasRole('admin')) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center py-12">
          <Shield className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">访问受限</h3>
          <p className="text-gray-600">您没有权限访问权限管理页面</p>
        </div>
      </div>
    );
  }

  const fetchPermissionsData = async () => {
    try {
      const headers: HeadersInit = {
        'Content-Type': 'application/json'
      };

      // 生产环境下添加认证头
      if (process.env.NODE_ENV !== 'development') {
        const token = localStorage.getItem('token');
        if (token) {
          headers.Authorization = `Bearer ${token}`;
        }
      }

      const response = await fetch(`/api/enterprises/${enterpriseId}/permissions`, {
        headers
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setPermissionsData(data.data);
        } else {
          setError(data.message || '获取权限数据失败');
        }
      } else {
        setError('获取权限数据失败');
      }
    } catch (error) {
      console.error('获取权限数据失败:', error);
      setError('获取权限数据失败');
    } finally {
      setLoading(false);
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'owner':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'admin':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'member':
        return 'bg-green-100 text-green-800 border-green-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'owner':
        return <Crown className="w-4 h-4" />;
      case 'admin':
        return <Shield className="w-4 h-4" />;
      case 'member':
        return <UserCheck className="w-4 h-4" />;
      default:
        return <Users className="w-4 h-4" />;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <Check className="w-4 h-4 text-green-500" />;
      case 'inactive':
        return <X className="w-4 h-4 text-red-500" />;
      case 'pending':
        return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      default:
        return <Users className="w-4 h-4 text-gray-500" />;
    }
  };

  const filteredUsers = permissionsData?.users.filter(user => {
    const matchesSearch = user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         user.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = roleFilter === 'all' || user.role === roleFilter;
    return matchesSearch && matchesRole;
  }) || [];

  const handleUserUpdate = async (userId: string, updates: {
    role?: string;
    permissions?: string[];
    status?: string;
  }) => {
    try {
      const headers: HeadersInit = {
        'Content-Type': 'application/json'
      };

      // 生产环境下添加认证头
      if (process.env.NODE_ENV !== 'development') {
        const token = localStorage.getItem('token');
        if (token) {
          headers.Authorization = `Bearer ${token}`;
        }
      }

      const response = await fetch(`/api/enterprises/${enterpriseId}/permissions`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          action: 'update_user',
          targetUserId: userId,
          role: updates.role,
          status: updates.status,
          permissions: updates.permissions,
          scope: 'enterprise'
        })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          // 重新获取数据
          await fetchPermissionsData();
          return true;
        }
      }
      return false;
    } catch (error) {
      console.error('更新用户失败:', error);
      return false;
    }
  };

  const handleViewUserDetails = (user: User) => {
    setSelectedUser(user);
    setShowUserDetailsDialog(true);
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-32 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error || !permissionsData) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center py-12">
          <Shield className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">权限数据加载失败</h3>
          <p className="text-gray-600 mb-4">{error || '暂无权限数据'}</p>
          <Button onClick={fetchPermissionsData}>重试</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-6xl mx-auto">
        {/* 面包屑和标题 */}
        <div className="flex items-center gap-4 mb-6">
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => router.push(`/enterprise/${enterpriseId}/dashboard`)}
          >
            <ChevronLeft className="w-4 h-4 mr-2" />
            返回企业控制面板
          </Button>
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Building2 className="w-4 h-4" />
            <span>{currentEnterprise?.name || '未知企业'}</span>
            <span>/</span>
            <span>权限管理</span>
          </div>
        </div>

        <div className="space-y-6">
        {/* 页面标题 */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Shield className="w-6 h-6 text-blue-600" />
              权限管理
            </h1>
            <p className="text-gray-600 mt-1">
              管理企业用户权限和角色分配
            </p>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline"
              onClick={() => setShowBatchManagementDialog(true)}
            >
              <Users className="w-4 h-4 mr-2" />
              批量管理
            </Button>
            <Button 
              variant="outline"
              onClick={() => setShowRoleManagementDialog(true)}
            >
              <Key className="w-4 h-4 mr-2" />
              管理角色
            </Button>
          </div>
        </div>

        {/* 权限概览统计 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">总用户数</p>
                  <p className="text-2xl font-bold text-gray-900">{permissionsData.users.length}</p>
                </div>
                <Users className="w-8 h-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">活跃用户</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {permissionsData.users.filter(u => u.status === 'active').length}
                  </p>
                </div>
                <UserCheck className="w-8 h-8 text-green-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">角色数量</p>
                  <p className="text-2xl font-bold text-gray-900">{permissionsData.availableRoles?.length || 0}</p>
                </div>
                <Key className="w-8 h-8 text-purple-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">部门数量</p>
                  <p className="text-2xl font-bold text-gray-900">0</p>
                </div>
                <Shield className="w-8 h-8 text-orange-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 详细信息标签页 */}
        <Tabs defaultValue="users" className="space-y-4">
          <TabsList>
            <TabsTrigger value="users">用户管理</TabsTrigger>
            <TabsTrigger value="roles">角色管理</TabsTrigger>
            <TabsTrigger value="permissions">权限管理</TabsTrigger>
            <TabsTrigger value="departments">部门权限</TabsTrigger>
          </TabsList>

          <TabsContent value="users">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>用户管理</CardTitle>
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                      <Input
                        placeholder="搜索用户..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10 w-64"
                      />
                    </div>
                    <Select value={roleFilter} onValueChange={setRoleFilter}>
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">所有角色</SelectItem>
                        <SelectItem value="owner">拥有者</SelectItem>
                        <SelectItem value="admin">管理员</SelectItem>
                        <SelectItem value="member">成员</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {filteredUsers.map((user) => (
                    <div key={user.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center space-x-4">
                        {getStatusIcon(user.status)}
                        <div>
                          <h4 className="font-medium text-gray-900">{user.name}</h4>
                          <p className="text-sm text-gray-600">{user.email}</p>
                          {user.department && (
                            <p className="text-xs text-gray-500">部门: {user.department}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center space-x-3">
                        <Badge className={`flex items-center gap-1 ${getRoleColor(user.role)}`}>
                          {getRoleIcon(user.role)}
                          {user.role}
                        </Badge>
                        <div className="text-right text-sm text-gray-500">
                          {user.lastAccess && (
                            <p>最后访问: {new Date(user.lastAccess).toLocaleDateString('zh-CN')}</p>
                          )}
                          <p>{user.permissions.length} 个权限</p>
                        </div>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => handleViewUserDetails(user)}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="roles">
            <Card>
              <CardHeader>
                <CardTitle>角色管理</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {permissionsData.availableRoles?.map((role) => (
                    <div key={role.key} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center space-x-3">
                        <Key className="w-5 h-5 text-blue-500" />
                        <div>
                          <h4 className="font-medium text-gray-900">{role.name}</h4>
                          <p className="text-sm text-gray-600">{role.key}</p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-3">
                        <Badge variant="secondary">系统角色</Badge>
                        <div className="text-right text-sm text-gray-500">
                          <p>{role.permissions.length} 个权限</p>
                        </div>
                        <Button variant="ghost" size="sm">
                          <Edit className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="permissions">
            <Card>
              <CardHeader>
                <CardTitle>权限列表</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {permissionsData.availablePermissions?.map((permission) => (
                    <div key={permission} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center space-x-3">
                        <Shield className="w-5 h-5 text-purple-500" />
                        <div>
                          <h4 className="font-medium text-gray-900">{permission}</h4>
                          <p className="text-sm text-gray-600">
                            {permission.includes('system') ? '系统级权限' :
                             permission.includes('enterprise') ? '企业级权限' :
                             permission.includes('group') ? '拼车组权限' :
                             permission.includes('ai') ? 'AI服务权限' :
                             permission.includes('user') ? '用户管理权限' : '其他权限'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-3">
                        <Badge 
                          variant={permission.includes('admin') || permission.includes('manage') ? 'destructive' : 
                                  permission.includes('create') || permission.includes('invite') ? 'default' : 'secondary'}
                        >
                          {permission.includes('admin') || permission.includes('manage') ? '管理' :
                           permission.includes('create') || permission.includes('invite') ? '创建' : '查看'}
                        </Badge>
                      </div>
                    </div>
                  )) || (
                    <div className="text-center py-8 text-gray-500">
                      <Shield className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                      <p>暂无权限数据</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="departments">
            <Card>
              <CardHeader>
                <CardTitle>部门权限</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8 text-gray-500">
                  <Users className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                  <p>暂无部门数据</p>
                  <p className="text-sm mt-2">部门权限管理功能正在开发中</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* 用户详情对话框 */}
        <UserDetailsDialog
          open={showUserDetailsDialog}
          onOpenChange={setShowUserDetailsDialog}
          user={selectedUser}
          availableRoles={permissionsData?.availableRoles || []}
          availablePermissions={permissionsData?.availablePermissions || []}
          onUpdateUser={handleUserUpdate}
        />

        
        {/* 角色管理对话框 */}
        <RoleManagementDialog
          open={showRoleManagementDialog}
          onOpenChange={setShowRoleManagementDialog}
          availableRoles={permissionsData?.availableRoles || []}
          users={permissionsData?.users || []}
          availablePermissions={permissionsData?.availablePermissions || []}
          onCreateRole={async (role) => {
            try {
              const headers: HeadersInit = {
                'Content-Type': 'application/json'
              };
              
              if (process.env.NODE_ENV !== 'development') {
                const token = localStorage.getItem('token');
                if (token) {
                  headers.Authorization = `Bearer ${token}`;
                }
              }
              
              const response = await fetch(`/api/enterprises/${enterpriseId}/roles`, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                  action: 'create',
                  roleKey: role.key,
                  roleName: role.name,
                  permissions: role.permissions
                })
              });
              
              if (response.ok) {
                await fetchPermissionsData();
                return true;
              }
              return false;
            } catch (error) {
              console.error('创建角色失败:', error);
              return false;
            }
          }}
          onUpdateRole={async (roleKey, updates) => {
            try {
              const headers: HeadersInit = {
                'Content-Type': 'application/json'
              };
              
              if (process.env.NODE_ENV !== 'development') {
                const token = localStorage.getItem('token');
                if (token) {
                  headers.Authorization = `Bearer ${token}`;
                }
              }
              
              const response = await fetch(`/api/enterprises/${enterpriseId}/roles`, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                  action: 'update',
                  roleKey,
                  permissions: updates.permissions
                })
              });
              
              if (response.ok) {
                await fetchPermissionsData();
                return true;
              }
              return false;
            } catch (error) {
              console.error('更新角色失败:', error);
              return false;
            }
          }}
          onDeleteRole={async (roleKey) => {
            try {
              const headers: HeadersInit = {
                'Content-Type': 'application/json'
              };
              
              if (process.env.NODE_ENV !== 'development') {
                const token = localStorage.getItem('token');
                if (token) {
                  headers.Authorization = `Bearer ${token}`;
                }
              }
              
              const response = await fetch(`/api/enterprises/${enterpriseId}/roles`, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                  action: 'delete',
                  roleKey
                })
              });
              
              if (response.ok) {
                await fetchPermissionsData();
                return true;
              }
              return false;
            } catch (error) {
              console.error('删除角色失败:', error);
              return false;
            }
          }}
        />
        
        {/* 批量用户管理对话框 */}
        <BatchUserManagementDialog
          open={showBatchManagementDialog}
          onOpenChange={setShowBatchManagementDialog}
          users={permissionsData?.users || []}
          availableRoles={permissionsData?.availableRoles || []}
          availablePermissions={permissionsData?.availablePermissions || []}
          onBatchUpdate={async (userIds, updates) => {
            try {
              const headers: HeadersInit = {
                'Content-Type': 'application/json'
              };
              
              if (process.env.NODE_ENV !== 'development') {
                const token = localStorage.getItem('token');
                if (token) {
                  headers.Authorization = `Bearer ${token}`;
                }
              }
              
              const response = await fetch(`/api/enterprises/${enterpriseId}/permissions`, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                  action: 'batch_update',
                  userIds,
                  role: updates.role,
                  status: updates.status,
                  permissions: updates.permissions,
                  scope: 'enterprise'
                })
              });
              
              if (response.ok) {
                await fetchPermissionsData();
                return true;
              }
              return false;
            } catch (error) {
              console.error('批量更新用户失败:', error);
              return false;
            }
          }}
          onBatchDelete={async (userIds) => {
            try {
              const headers: HeadersInit = {
                'Content-Type': 'application/json'
              };
              
              if (process.env.NODE_ENV !== 'development') {
                const token = localStorage.getItem('token');
                if (token) {
                  headers.Authorization = `Bearer ${token}`;
                }
              }
              
              const response = await fetch(`/api/enterprises/${enterpriseId}/permissions`, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                  action: 'batch_delete',
                  userIds,
                  scope: 'enterprise'
                })
              });
              
              if (response.ok) {
                await fetchPermissionsData();
                return true;
              }
              return false;
            } catch (error) {
              console.error('批量删除用户失败:', error);
              return false;
            }
          }}
        />
        </div>
      </div>
    </div>
  );
}
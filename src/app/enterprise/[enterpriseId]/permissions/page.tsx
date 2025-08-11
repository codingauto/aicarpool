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
import { useToast } from '@/components/ui/toast';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Shield,
  Users,
  UserCheck,
  UserX,
  UserPlus,
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
import { DepartmentManagementDialog } from '@/components/department-management-dialog';
import { PermissionAssignmentDialog } from '@/components/permission-assignment-dialog';
import { PermissionUsersDialog } from '@/components/permission-users-dialog';
import { PermissionAssignUserDialog } from '@/components/permission-assign-user-dialog';
import { useRouter } from 'next/navigation';
import { useEnterpriseContext } from '@/contexts/enterprise-context';

interface Department {
  id: string;
  name: string;
  description?: string;
  parentId?: string | null;
  parent?: Department;
  children?: Department[];
  leaderId?: string;
  leader?: User;
  memberCount?: number;
  enterpriseId: string;
  _count?: {
    children: number;
    groups: number;
  };
  groups?: any[];
}

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

// 权限详细信息映射
const PERMISSION_DETAILS: Record<string, { name: string; description: string; category: string; level: string }> = {
  'system.admin': {
    name: '系统管理员',
    description: '拥有系统的完全控制权，可以管理所有企业和用户',
    category: '系统级',
    level: 'admin'
  },
  'enterprise.manage': {
    name: '企业管理',
    description: '管理企业设置、配置和基本信息',
    category: '企业级',
    level: 'manage'
  },
  'enterprise.view': {
    name: '企业查看',
    description: '查看企业信息和统计数据',
    category: '企业级',
    level: 'view'
  },
  'group.create': {
    name: '创建拼车组',
    description: '创建新的拼车组并设置规则',
    category: '拼车组',
    level: 'create'
  },
  'group.manage': {
    name: '管理拼车组',
    description: '管理拼车组成员、规则和设置',
    category: '拼车组',
    level: 'manage'
  },
  'group.view': {
    name: '查看拼车组',
    description: '查看拼车组信息和成员列表',
    category: '拼车组',
    level: 'view'
  },
  'ai.use': {
    name: '使用AI服务',
    description: '使用AI功能进行路线规划和优化',
    category: 'AI服务',
    level: 'use'
  },
  'ai.manage': {
    name: '管理AI服务',
    description: '配置AI服务账号和参数',
    category: 'AI服务',
    level: 'manage'
  },
  'user.invite': {
    name: '邀请用户',
    description: '邀请新用户加入企业或拼车组',
    category: '用户管理',
    level: 'create'
  },
  'user.manage': {
    name: '管理用户',
    description: '管理用户账号、权限和状态',
    category: '用户管理',
    level: 'manage'
  }
};

export default function EnterprisePermissionsPage({ params }: { params: Promise<{ enterpriseId: string }> }) {
  const { enterpriseId } = use(params);
  const router = useRouter();
  const { currentEnterprise, hasRole } = useEnterpriseContext();
  const { addToast } = useToast();
  
  // Toast 辅助函数
  const toast = {
    success: (title: string, description?: string) => {
      addToast({ type: 'success', title, description });
    },
    error: (title: string, description?: string) => {
      addToast({ type: 'error', title, description });
    },
    warning: (title: string, description?: string) => {
      addToast({ type: 'warning', title, description });
    },
    info: (title: string, description?: string) => {
      addToast({ type: 'info', title, description });
    }
  };
  
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
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loadingDepartments, setLoadingDepartments] = useState(false);
  const [showDepartmentDialog, setShowDepartmentDialog] = useState(false);
  const [selectedDepartment, setSelectedDepartment] = useState<Department | null>(null);
  const [showPermissionDialog, setShowPermissionDialog] = useState(false);
  const [selectedPermissionUser, setSelectedPermissionUser] = useState<User | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [departmentToDelete, setDepartmentToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showPermissionUsersDialog, setShowPermissionUsersDialog] = useState(false);
  const [selectedPermissionForView, setSelectedPermissionForView] = useState<{ key: string; name: string } | null>(null);
  const [selectedPermissionForAssign, setSelectedPermissionForAssign] = useState<{ key: string; name: string } | null>(null);
  const [showPermissionAssignUserDialog, setShowPermissionAssignUserDialog] = useState(false);

  useEffect(() => {
    // 直接尝试加载数据（API会处理权限验证）
    fetchPermissionsData();
  }, [enterpriseId]);

  // 权限检查 - 暂时禁用，让API处理权限
  // if (!hasRole('owner') && !hasRole('admin')) {
  //   return (
  //     <div className="container mx-auto px-4 py-8">
  //       <div className="text-center py-12">
  //         <Shield className="w-12 h-12 text-gray-400 mx-auto mb-4" />
  //         <h3 className="text-lg font-medium text-gray-900 mb-2">访问受限</h3>
  //         <p className="text-gray-600">您没有权限访问权限管理页面</p>
  //       </div>
  //     </div>
  //   );
  // }

  const fetchPermissionsData = async () => {
    try {
      const headers: HeadersInit = {
        'Content-Type': 'application/json'
      };

      // 尝试添加认证头（如果有token的话）
      const token = localStorage.getItem('token');
      if (token) {
        headers.Authorization = `Bearer ${token}`;
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

  const fetchDepartments = async () => {
    setLoadingDepartments(true);
    try {
      const headers: HeadersInit = {
        'Content-Type': 'application/json'
      };

      // 尝试添加认证头（如果有token的话）
      const token = localStorage.getItem('token');
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      const response = await fetch(`/api/enterprises/${enterpriseId}/departments`, {
        headers
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setDepartments(data.data.departments || []);
        }
      }
    } catch (error) {
      console.error('获取部门数据失败:', error);
    } finally {
      setLoadingDepartments(false);
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

  const handleCreateDepartment = () => {
    setSelectedDepartment(null);
    setShowDepartmentDialog(true);
  };

  const handleEditDepartment = (dept: Department) => {
    setSelectedDepartment(dept);
    setShowDepartmentDialog(true);
  };

  const handleSaveDepartment = async (departmentData: Partial<Department>) => {
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

      const method = departmentData.id ? 'PUT' : 'POST';
      const url = departmentData.id 
        ? `/api/enterprises/${enterpriseId}/departments?departmentId=${departmentData.id}`
        : `/api/enterprises/${enterpriseId}/departments`;

      const response = await fetch(url, {
        method,
        headers,
        body: JSON.stringify({
          name: departmentData.name,
          description: departmentData.description,
          parentId: departmentData.parentId,
          leaderId: departmentData.leaderId,
        })
      });

      if (response.ok) {
        await fetchDepartments();
        return true;
      }
      return false;
    } catch (error) {
      console.error('保存部门失败:', error);
      return false;
    }
  };

  const handleAssignPermissionToUsers = async (permission: string, userIds: string[]) => {
    try {
      toast.info('正在分配权限...', '请稍候');
      
      const headers: HeadersInit = {
        'Content-Type': 'application/json'
      };
      
      const token = localStorage.getItem('token');
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      // 批量为用户分配权限
      const promises = userIds.map(userId => {
        const user = permissionsData?.users.find(u => u.id === userId);
        if (!user) return Promise.resolve(false);
        
        const newPermissions = [...user.permissions, permission];
        
        return fetch(`/api/enterprises/${enterpriseId}/permissions`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            action: 'update_user',
            targetUserId: userId,
            permissions: newPermissions,
            scope: 'enterprise'
          })
        }).then(res => res.ok);
      });

      const results = await Promise.all(promises);
      const successCount = results.filter(r => r).length;
      
      if (successCount > 0) {
        await fetchPermissionsData();
        toast.success(
          '权限分配成功',
          `已为 ${successCount} 个用户分配权限`
        );
        return true;
      }
      
      toast.error('权限分配失败', '请检查设置并重试');
      return false;
    } catch (error) {
      console.error('分配权限失败:', error);
      toast.error('权限分配失败', '网络错误，请稍后重试');
      return false;
    }
  };

  const handlePermissionAssignment = async (permissions: string[]) => {
    if (!selectedPermissionUser) return false;
    
    try {
      const headers: HeadersInit = {
        'Content-Type': 'application/json'
      };
      
      const token = localStorage.getItem('token');
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      const response = await fetch(`/api/enterprises/${enterpriseId}/permissions`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          action: 'update_user',
          targetUserId: selectedPermissionUser.id,
          permissions,
          scope: 'enterprise'
        })
      });

      if (response.ok) {
        await fetchPermissionsData();
        return true;
      }
      return false;
    } catch (error) {
      console.error('分配权限失败:', error);
      return false;
    }
  };

  const handleDeleteDepartment = async (departmentId: string) => {
    setIsDeleting(true);
    try {
      toast.info('正在删除部门...', '请稍候');
      
      const headers: HeadersInit = {
        'Content-Type': 'application/json'
      };
      
      if (process.env.NODE_ENV !== 'development') {
        const token = localStorage.getItem('token');
        if (token) {
          headers.Authorization = `Bearer ${token}`;
        }
      }

      const response = await fetch(
        `/api/enterprises/${enterpriseId}/departments?departmentId=${departmentId}`,
        {
          method: 'DELETE',
          headers
        }
      );

      if (response.ok) {
        await fetchDepartments();
        toast.success('部门删除成功');
        setShowDeleteConfirm(false);
        setDepartmentToDelete(null);
        return true;
      }
      toast.error('删除部门失败', '该部门可能存在子部门或成员');
      return false;
    } catch (error) {
      console.error('删除部门失败:', error);
      toast.error('删除部门失败', '网络错误，请稍后重试');
      return false;
    } finally {
      setIsDeleting(false);
    }
  };

  const renderDepartmentTree = (depts: Department[], level: number = 0): JSX.Element[] => {
    return depts.map((dept) => (
      <div key={dept.id} style={{ marginLeft: `${level * 20}px` }}>
        <div className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50">
          <div className="flex items-center space-x-3">
            <Building2 className="w-5 h-5 text-blue-500" />
            <div>
              <h4 className="font-medium text-gray-900">{dept.name}</h4>
              {dept.description && (
                <p className="text-sm text-gray-600">{dept.description}</p>
              )}
              <div className="flex items-center gap-4 mt-1">
                {dept._count && (
                  <>
                    <span className="text-xs text-gray-500">
                      {dept._count.children || 0} 个子部门
                    </span>
                    <span className="text-xs text-gray-500">
                      {dept._count.groups || 0} 个拼车组
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => handleEditDepartment(dept)}
            >
              <Edit className="w-4 h-4" />
            </Button>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => {
                const newDept: Department = {
                  id: '',
                  name: '',
                  parentId: dept.id,
                  enterpriseId
                };
                setSelectedDepartment(null);
                setFormData({ ...newDept, parentId: dept.id });
                setShowDepartmentDialog(true);
              }}
            >
              <Plus className="w-4 h-4" />
            </Button>
          </div>
        </div>
        {dept.children && dept.children.length > 0 && (
          <div className="mt-2">
            {renderDepartmentTree(dept.children, level + 1)}
          </div>
        )}
      </div>
    ));
  };

  const [formData, setFormData] = useState<Partial<Department>>({});

  const handleUserUpdate = async (userId: string, updates: {
    role?: string;
    permissions?: string[];
    status?: string;
  }) => {
    try {
      const headers: HeadersInit = {
        'Content-Type': 'application/json'
      };

      // 尝试添加认证头（如果有token的话）
      const token = localStorage.getItem('token');
      if (token) {
        headers.Authorization = `Bearer ${token}`;
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
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => {
                            setSelectedPermissionUser(user);
                            setShowPermissionDialog(true);
                          }}
                        >
                          <Key className="w-4 h-4" />
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
                <div className="flex items-center justify-between">
                  <CardTitle>权限列表</CardTitle>
                  <Button
                    size="sm"
                    onClick={() => {
                      // 打开一个通用的权限管理对话框
                      setSelectedPermissionUser({
                        id: 'batch-assign',
                        name: '批量分配',
                        email: '',
                        role: 'member',
                        permissions: [],
                        status: 'active'
                      });
                      setShowPermissionDialog(true);
                    }}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    分配权限
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4 overflow-x-auto">
                  {permissionsData.availablePermissions?.map((permission) => {
                    const details = PERMISSION_DETAILS[permission] || {
                      name: permission,
                      description: '系统权限',
                      category: '其他',
                      level: 'view'
                    };
                    
                    return (
                      <div key={permission} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors">
                        <div className="flex items-start space-x-3 flex-grow min-w-0">
                          <Shield className="w-5 h-5 text-purple-500 mt-1 flex-shrink-0" />
                          <div className="flex-grow min-w-0">
                            <h4 className="font-medium text-gray-900">{details.name}</h4>
                            <p className="text-sm text-gray-600 mb-1">{details.description}</p>
                            <div className="flex items-center gap-2 flex-wrap">
                              <code className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">{permission}</code>
                              <Badge variant="outline" className="text-xs">
                                {details.category}
                              </Badge>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 mt-3 sm:mt-0 ml-8 sm:ml-4 flex-shrink-0">
                          <Badge 
                            variant={details.level === 'admin' ? 'destructive' : 
                                    details.level === 'manage' ? 'default' : 
                                    details.level === 'create' ? 'default' : 
                                    details.level === 'use' ? 'outline' : 'secondary'}
                            className={`min-w-[60px] justify-center whitespace-nowrap ${
                              details.level === 'admin' ? 'bg-red-100 text-red-800 border-red-200' :
                              details.level === 'manage' ? 'bg-orange-100 text-orange-800 border-orange-200' :
                              details.level === 'create' ? 'bg-blue-100 text-blue-800 border-blue-200' :
                              details.level === 'use' ? 'bg-green-100 text-green-800 border-green-200' :
                              'bg-gray-100 text-gray-800 border-gray-200'
                            }`}
                          >
                            {details.level === 'admin' ? '系统级' :
                             details.level === 'manage' ? '管理' :
                             details.level === 'create' ? '创建' : 
                             details.level === 'use' ? '使用' : '查看'}
                          </Badge>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedPermissionForView({ key: permission, name: details.name });
                              setShowPermissionUsersDialog(true);
                            }}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedPermissionForAssign({ key: permission, name: details.name });
                              setShowPermissionAssignUserDialog(true);
                            }}
                          >
                            <UserPlus className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  }) || (
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
                <div className="flex items-center justify-between">
                  <CardTitle>部门权限</CardTitle>
                  <Button 
                    size="sm" 
                    onClick={() => {
                      if (departments.length === 0) {
                        fetchDepartments();
                      }
                      handleCreateDepartment();
                    }}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    新建部门
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {loadingDepartments ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                    <p className="mt-2 text-gray-500">加载部门数据...</p>
                  </div>
                ) : departments.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <Building2 className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                    <p>暂无部门数据</p>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="mt-4"
                      onClick={fetchDepartments}
                    >
                      加载部门数据
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {renderDepartmentTree(departments)}
                  </div>
                )}
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

        {/* 部门管理对话框 */}
        <DepartmentManagementDialog
          open={showDepartmentDialog}
          onOpenChange={setShowDepartmentDialog}
          department={selectedDepartment}
          departments={departments}
          users={permissionsData?.users || []}
          enterpriseId={enterpriseId}
          onSave={handleSaveDepartment}
          onDelete={handleDeleteDepartment}
        />

        {/* 权限分配对话框 */}
        {selectedPermissionUser && (
          <PermissionAssignmentDialog
            open={showPermissionDialog}
            onOpenChange={setShowPermissionDialog}
            userId={selectedPermissionUser.id}
            userName={selectedPermissionUser.name}
            currentPermissions={selectedPermissionUser.permissions}
            availablePermissions={permissionsData?.availablePermissions || []}
            onSave={handlePermissionAssignment}
          />
        )}

        {/* 权限用户查看对话框 */}
        {selectedPermissionForView && (
          <PermissionUsersDialog
            open={showPermissionUsersDialog}
            onOpenChange={setShowPermissionUsersDialog}
            permission={selectedPermissionForView.key}
            permissionName={selectedPermissionForView.name}
            users={permissionsData?.users || []}
            onManageUser={(user) => {
              setSelectedUser(user);
              setShowUserDetailsDialog(true);
              setShowPermissionUsersDialog(false);
            }}
          />
        )}

        {/* 权限分配给用户对话框 */}
        {selectedPermissionForAssign && (
          <PermissionAssignUserDialog
            open={showPermissionAssignUserDialog}
            onOpenChange={setShowPermissionAssignUserDialog}
            permission={selectedPermissionForAssign.key}
            permissionName={selectedPermissionForAssign.name}
            users={permissionsData?.users || []}
            onAssign={(userIds) => handleAssignPermissionToUsers(selectedPermissionForAssign.key, userIds)}
          />
        )}

        {/* 删除部门确认对话框 */}
        <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>确认删除部门</AlertDialogTitle>
              <AlertDialogDescription>
                您确定要删除这个部门吗？此操作无法撤销。
                如果部门下有子部门或成员，删除将会失败。
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isDeleting}>取消</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (departmentToDelete) {
                    handleDeleteDepartment(departmentToDelete);
                  }
                }}
                disabled={isDeleting}
                className="bg-red-600 hover:bg-red-700"
              >
                {isDeleting ? (
                  <span className="flex items-center gap-2">
                    <LoadingSpinner size="sm" />
                    删除中...
                  </span>
                ) : (
                  '确认删除'
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        </div>
      </div>
    </div>
  );
}
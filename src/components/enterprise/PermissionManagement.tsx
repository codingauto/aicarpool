'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Shield,
  Users,
  Key,
  Plus,
  Edit,
  Trash2,
  AlertCircle,
  CheckCircle,
  Clock,
  Building2,
  UserPlus
} from 'lucide-react';

interface Permission {
  id: string;
  name: string;
  resource: string;
  action: string;
  description?: string;
}

interface Role {
  id: string;
  name: string;
  description?: string;
  level: 'enterprise' | 'department' | 'group' | 'user';
  permissions: Permission[];
  isBuiltIn: boolean;
  enterpriseId?: string;
}

interface UserPermission {
  userId: string;
  enterpriseId?: string;
  departmentId?: string;
  groupId?: string;
  roleId: string;
  role: Role;
  grantedBy: string;
  grantedAt: string;
  expiresAt?: string;
  isActive: boolean;
}

interface UserRole {
  roleId: string;
  roleName: string;
  roleLevel: string;
  scope: {
    enterprise?: string;
    department?: string;
    group?: string;
  };
  grantedBy: string;
  grantedAt: string;
  expiresAt?: string;
  isActive: boolean;
}

interface PermissionManagementProps {
  enterpriseId: string;
  isAdmin: boolean;
}

export function PermissionManagement({ enterpriseId, isAdmin }: PermissionManagementProps) {
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [selectedUser, setSelectedUser] = useState<string>('');
  const [userRoles, setUserRoles] = useState<UserRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [assignRoleDialogOpen, setAssignRoleDialogOpen] = useState(false);

  // 分配角色表单状态
  const [roleAssignment, setRoleAssignment] = useState({
    userId: '',
    roleId: '',
    departmentId: '',
    groupId: '',
    expiresAt: ''
  });

  const fetchPermissions = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/enterprises/${enterpriseId}/permissions`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();
      if (data.success) {
        setPermissions(data.data.permissions || []);
        setRoles(data.data.roles || []);
      } else {
        setError(data.error || '获取权限数据失败');
      }
    } catch (error) {
      console.error('获取权限数据失败:', error);
      setError('获取权限数据失败');
    } finally {
      setLoading(false);
    }
  };

  const fetchUserRoles = async (userId: string) => {
    if (!userId) return;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/enterprises/${enterpriseId}/users/${userId}/roles`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();
      if (data.success) {
        setUserRoles(data.data.effectiveRoles || []);
      } else {
        setError(data.error || '获取用户角色失败');
      }
    } catch (error) {
      console.error('获取用户角色失败:', error);
      setError('获取用户角色失败');
    }
  };

  const handleAssignRole = async () => {
    if (!roleAssignment.userId || !roleAssignment.roleId || !isAdmin) return;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/enterprises/${enterpriseId}/users/${roleAssignment.userId}/roles`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          roleId: roleAssignment.roleId,
          departmentId: roleAssignment.departmentId || undefined,
          groupId: roleAssignment.groupId || undefined,
          expiresAt: roleAssignment.expiresAt || undefined
        }),
      });

      const data = await response.json();
      if (data.success) {
        await fetchUserRoles(roleAssignment.userId);
        setAssignRoleDialogOpen(false);
        setRoleAssignment({
          userId: '',
          roleId: '',
          departmentId: '',
          groupId: '',
          expiresAt: ''
        });
        alert('角色分配成功');
      } else {
        alert(data.error || '角色分配失败');
      }
    } catch (error) {
      console.error('角色分配失败:', error);
      alert('角色分配失败');
    }
  };

  const handleRevokeRole = async (userId: string, roleId: string, departmentId?: string, groupId?: string) => {
    if (!isAdmin) return;

    if (!confirm('确定要撤销该角色吗？')) return;

    try {
      const token = localStorage.getItem('token');
      const params = new URLSearchParams({
        roleId,
        ...(departmentId && { departmentId }),
        ...(groupId && { groupId })
      });

      const response = await fetch(`/api/enterprises/${enterpriseId}/users/${userId}/roles?${params}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();
      if (data.success) {
        await fetchUserRoles(userId);
        alert('角色撤销成功');
      } else {
        alert(data.error || '角色撤销失败');
      }
    } catch (error) {
      console.error('角色撤销失败:', error);
      alert('角色撤销失败');
    }
  };

  const getRoleLevelBadge = (level: string) => {
    const levelColors = {
      'enterprise': 'bg-purple-500',
      'department': 'bg-blue-500',
      'group': 'bg-green-500',
      'user': 'bg-gray-500'
    };

    const levelNames = {
      'enterprise': '企业级',
      'department': '部门级',
      'group': '组级',
      'user': '用户级'
    };

    return (
      <Badge className={`${levelColors[level as keyof typeof levelColors]} text-white`}>
        {levelNames[level as keyof typeof levelNames]}
      </Badge>
    );
  };

  const getPermissionIcon = (resource: string) => {
    const iconMap: Record<string, any> = {
      'enterprise': Building2,
      'department': Building2,
      'group': Users,
      'user': Users,
      'account_pool': Shield,
      'budget': Shield,
      'monitoring': Shield,
      'ai_service': Key
    };

    const Icon = iconMap[resource] || Shield;
    return <Icon className="w-4 h-4" />;
  };

  useEffect(() => {
    fetchPermissions();
  }, [enterpriseId]);

  useEffect(() => {
    if (selectedUser) {
      fetchUserRoles(selectedUser);
    }
  }, [selectedUser]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="text-center py-8">
          <div className="text-gray-500">加载权限管理数据...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 头部 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">权限管理</h2>
          <p className="text-gray-600">管理企业用户角色和权限分配</p>
        </div>
        {isAdmin && (
          <Dialog open={assignRoleDialogOpen} onOpenChange={setAssignRoleDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <UserPlus className="w-4 h-4 mr-2" />
                分配角色
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>分配用户角色</DialogTitle>
                <DialogDescription>
                  为用户分配适当的角色和权限
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>用户ID</Label>
                  <Input
                    value={roleAssignment.userId}
                    onChange={(e) => setRoleAssignment(prev => ({ ...prev, userId: e.target.value }))}
                    placeholder="输入用户ID"
                  />
                </div>
                <div className="space-y-2">
                  <Label>角色</Label>
                  <Select 
                    value={roleAssignment.roleId} 
                    onValueChange={(value) => setRoleAssignment(prev => ({ ...prev, roleId: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="选择角色" />
                    </SelectTrigger>
                    <SelectContent>
                      {roles.map(role => (
                        <SelectItem key={role.id} value={role.id}>
                          {role.name} ({role.level})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>部门ID（可选）</Label>
                    <Input
                      value={roleAssignment.departmentId}
                      onChange={(e) => setRoleAssignment(prev => ({ ...prev, departmentId: e.target.value }))}
                      placeholder="部门ID"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>组ID（可选）</Label>
                    <Input
                      value={roleAssignment.groupId}
                      onChange={(e) => setRoleAssignment(prev => ({ ...prev, groupId: e.target.value }))}
                      placeholder="组ID"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>过期时间（可选）</Label>
                  <Input
                    type="datetime-local"
                    value={roleAssignment.expiresAt}
                    onChange={(e) => setRoleAssignment(prev => ({ ...prev, expiresAt: e.target.value }))}
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setAssignRoleDialogOpen(false)}>
                    取消
                  </Button>
                  <Button onClick={handleAssignRole} disabled={!roleAssignment.userId || !roleAssignment.roleId}>
                    分配
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="roles" className="space-y-6">
        <TabsList>
          <TabsTrigger value="roles">角色管理</TabsTrigger>
          <TabsTrigger value="permissions">权限列表</TabsTrigger>
          <TabsTrigger value="users">用户权限</TabsTrigger>
        </TabsList>

        <TabsContent value="roles" className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {roles.map((role) => (
              <Card key={role.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{role.name}</CardTitle>
                    {getRoleLevelBadge(role.level)}
                  </div>
                  {role.description && (
                    <CardDescription>{role.description}</CardDescription>
                  )}
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-gray-500" />
                    <span className="text-sm">{role.permissions.length} 个权限</span>
                    {role.isBuiltIn && (
                      <Badge variant="outline" className="text-xs">内置</Badge>
                    )}
                  </div>
                  
                  <div className="space-y-2">
                    <div className="text-sm font-medium text-gray-700">权限列表</div>
                    <div className="space-y-1 max-h-32 overflow-y-auto">
                      {role.permissions.map((permission) => (
                        <div key={permission.id} className="flex items-center gap-2 text-xs">
                          {getPermissionIcon(permission.resource)}
                          <span>{permission.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {isAdmin && !role.isBuiltIn && (
                    <div className="flex gap-2 pt-2">
                      <Button variant="outline" size="sm" className="flex-1">
                        <Edit className="w-4 h-4 mr-1" />
                        编辑
                      </Button>
                      <Button variant="outline" size="sm" className="flex-1">
                        <Trash2 className="w-4 h-4 mr-1" />
                        删除
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="permissions">
          <Card>
            <CardHeader>
              <CardTitle>系统权限列表</CardTitle>
              <CardDescription>
                系统中所有可用的权限项目
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {Object.entries(
                  permissions.reduce((groups, permission) => {
                    const resource = permission.resource;
                    if (!groups[resource]) {
                      groups[resource] = [];
                    }
                    groups[resource].push(permission);
                    return groups;
                  }, {} as Record<string, Permission[]>)
                ).map(([resource, perms]) => (
                  <div key={resource} className="border rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-3">
                      {getPermissionIcon(resource)}
                      <h3 className="font-medium capitalize">{resource.replace('_', ' ')}</h3>
                      <Badge variant="secondary">{perms.length} 个权限</Badge>
                    </div>
                    <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
                      {perms.map((permission) => (
                        <div key={permission.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                          <div>
                            <div className="font-medium text-sm">{permission.name}</div>
                            <div className="text-xs text-gray-600">{permission.action}</div>
                          </div>
                          <Badge variant="outline" className="text-xs">
                            {permission.action}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="users">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>用户权限查询</CardTitle>
                <CardDescription>
                  查看和管理特定用户的角色权限
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-4">
                  <div className="flex-1">
                    <Label>用户ID</Label>
                    <Input
                      value={selectedUser}
                      onChange={(e) => setSelectedUser(e.target.value)}
                      placeholder="输入用户ID"
                    />
                  </div>
                  <div className="flex items-end">
                    <Button onClick={() => fetchUserRoles(selectedUser)} disabled={!selectedUser}>
                      查询
                    </Button>
                  </div>
                </div>

                {selectedUser && userRoles.length > 0 && (
                  <div className="space-y-3">
                    <h4 className="font-medium">用户角色列表</h4>
                    {userRoles.map((userRole, index) => (
                      <Card key={index} className="border-l-4 border-l-blue-500">
                        <CardContent className="pt-4">
                          <div className="flex items-center justify-between">
                            <div className="space-y-2">
                              <div className="flex items-center gap-3">
                                <h5 className="font-medium">{userRole.roleName}</h5>
                                {getRoleLevelBadge(userRole.roleLevel)}
                                {userRole.isActive ? (
                                  <Badge variant="default">
                                    <CheckCircle className="w-3 h-3 mr-1" />
                                    活跃
                                  </Badge>
                                ) : (
                                  <Badge variant="secondary">
                                    <Clock className="w-3 h-3 mr-1" />
                                    已停用
                                  </Badge>
                                )}
                              </div>
                              <div className="text-sm text-gray-600">
                                <div>授权范围: {
                                  userRole.scope.group ? '组级' :
                                  userRole.scope.department ? '部门级' :
                                  userRole.scope.enterprise ? '企业级' : '全局'
                                }</div>
                                <div>授权时间: {new Date(userRole.grantedAt).toLocaleString()}</div>
                                {userRole.expiresAt && (
                                  <div>过期时间: {new Date(userRole.expiresAt).toLocaleString()}</div>
                                )}
                              </div>
                            </div>
                            {isAdmin && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleRevokeRole(
                                  selectedUser,
                                  userRole.roleId,
                                  userRole.scope.department,
                                  userRole.scope.group
                                )}
                              >
                                <Trash2 className="w-4 h-4 mr-1" />
                                撤销
                              </Button>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}

                {selectedUser && userRoles.length === 0 && (
                  <div className="text-center py-8">
                    <Users className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                    <p className="text-gray-600">该用户暂无分配的角色</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
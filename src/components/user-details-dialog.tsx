'use client';

/**
 * 用户详情对话框组件
 * 
 * 功能：
 * - 查看用户基本信息
 * - 编辑用户角色
 * - 管理用户权限
 * - 查看用户活动记录
 */

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { 
  User,
  Mail,
  Shield,
  Key,
  Clock,
  Edit,
  Save,
  X,
  Check,
  Crown,
  UserCheck,
  Users,
  AlertTriangle,
  Building2,
  Calendar
} from 'lucide-react';

interface UserDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
    permissions: string[];
    department?: string;
    status: 'active' | 'inactive' | 'pending';
    lastAccess?: string;
    joinedAt?: string;
  } | null;
  availableRoles: Array<{
    key: string;
    name: string;
    permissions: string[];
  }>;
  availablePermissions: string[];
  onUpdateUser: (userId: string, updates: {
    role?: string;
    permissions?: string[];
    status?: string;
  }) => Promise<boolean>;
}

export function UserDetailsDialog({
  open,
  onOpenChange,
  user,
  availableRoles,
  availablePermissions,
  onUpdateUser
}: UserDetailsDialogProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [selectedRole, setSelectedRole] = useState('');
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [selectedStatus, setSelectedStatus] = useState('');
  const [saving, setSaving] = useState(false);
  const [showAdvancedPermissions, setShowAdvancedPermissions] = useState(false);
  const [permissionConflicts, setPermissionConflicts] = useState<string[]>([]);

  useEffect(() => {
    if (user) {
      setSelectedRole(user.role);
      setSelectedPermissions(user.permissions || []);
      setSelectedStatus(user.status);
    }
  }, [user]);

  // 检测权限冲突
  useEffect(() => {
    const currentRoleObj = availableRoles.find(role => role.key === selectedRole);
    const rolePermissions = currentRoleObj?.permissions || [];
    const conflicts = selectedPermissions.filter(permission => 
      !rolePermissions.includes(permission)
    );
    setPermissionConflicts(conflicts);
  }, [selectedRole, selectedPermissions, availableRoles]);

  if (!user) return null;

  const handleSave = async () => {
    if (!user) return;
    
    setSaving(true);
    try {
      const updates: any = {};
      
      if (selectedRole !== user.role) {
        updates.role = selectedRole;
      }
      
      if (JSON.stringify(selectedPermissions) !== JSON.stringify(user.permissions)) {
        updates.permissions = selectedPermissions;
      }
      
      if (selectedStatus !== user.status) {
        updates.status = selectedStatus;
      }

      if (Object.keys(updates).length > 0) {
        const success = await onUpdateUser(user.id, updates);
        if (success) {
          setIsEditing(false);
        }
      } else {
        setIsEditing(false);
      }
    } catch (error) {
      console.error('保存用户信息失败:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setSelectedRole(user.role);
    setSelectedPermissions(user.permissions || []);
    setSelectedStatus(user.status);
    setIsEditing(false);
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'text-green-600 bg-green-50 border-green-200';
      case 'inactive':
        return 'text-red-600 bg-red-50 border-red-200';
      case 'pending':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <Check className="w-4 h-4" />;
      case 'inactive':
        return <X className="w-4 h-4" />;
      case 'pending':
        return <AlertTriangle className="w-4 h-4" />;
      default:
        return <Users className="w-4 h-4" />;
    }
  };

  const categorizePermissions = (permissions: string[]) => {
    const categories: Record<string, string[]> = {
      system: [],
      enterprise: [],
      group: [],
      ai: [],
      user: [],
      other: []
    };

    permissions.forEach(permission => {
      if (permission.includes('system')) {
        categories.system.push(permission);
      } else if (permission.includes('enterprise')) {
        categories.enterprise.push(permission);
      } else if (permission.includes('group')) {
        categories.group.push(permission);
      } else if (permission.includes('ai')) {
        categories.ai.push(permission);
      } else if (permission.includes('user')) {
        categories.user.push(permission);
      } else {
        categories.other.push(permission);
      }
    });

    return categories;
  };

  const permissionCategories = categorizePermissions(availablePermissions);
  const currentRole = availableRoles.find(role => role.key === selectedRole);
  const rolePermissions = currentRole?.permissions || [];
  const inheritedPermissions = selectedPermissions.filter(p => rolePermissions.includes(p));
  const customPermissions = selectedPermissions.filter(p => !rolePermissions.includes(p));

  const getPermissionSource = (permission: string) => {
    if (rolePermissions.includes(permission)) {
      return 'role';
    }
    return 'direct';
  };

  const applyPermissionTemplate = (template: 'minimal' | 'standard' | 'advanced') => {
    if (!isEditing) return;
    
    const templatePermissions: Record<string, string[]> = {
      minimal: ['ai.use', 'group.view'],
      standard: ['ai.use', 'group.view', 'group.create', 'user.invite'],
      advanced: ['ai.use', 'group.view', 'group.create', 'group.manage', 'user.invite', 'enterprise.view']
    };
    
    const basePermissions = currentRole?.permissions || [];
    const additionalPermissions = templatePermissions[template] || [];
    const combinedPermissions = [...new Set([...basePermissions, ...additionalPermissions])];
    
    setSelectedPermissions(combinedPermissions.filter(p => availablePermissions.includes(p)));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="w-5 h-5" />
            用户详情
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* 用户基本信息 */}
          <div className="flex items-start gap-4 p-4 bg-gray-50 rounded-lg">
            <Avatar className="w-16 h-16">
              <AvatarFallback className="bg-blue-100 text-blue-600 text-lg font-medium">
                {user.name.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">{user.name}</h3>
                  <div className="flex items-center gap-2 text-gray-600 mt-1">
                    <Mail className="w-4 h-4" />
                    <span>{user.email}</span>
                  </div>
                  {user.department && (
                    <div className="flex items-center gap-2 text-gray-600 mt-1">
                      <Building2 className="w-4 h-4" />
                      <span>{user.department}</span>
                    </div>
                  )}
                </div>
                <div className="text-right">
                  <Badge className={`flex items-center gap-1 ${getStatusColor(selectedStatus)}`}>
                    {getStatusIcon(selectedStatus)}
                    {selectedStatus === 'active' ? '活跃' : 
                     selectedStatus === 'inactive' ? '停用' : '待激活'}
                  </Badge>
                  <div className="text-sm text-gray-500 mt-2">
                    {user.lastAccess && (
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        <span>最后登录: {new Date(user.lastAccess).toLocaleDateString('zh-CN')}</span>
                      </div>
                    )}
                    {user.joinedAt && (
                      <div className="flex items-center gap-1 mt-1">
                        <Calendar className="w-3 h-3" />
                        <span>加入时间: {new Date(user.joinedAt).toLocaleDateString('zh-CN')}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 操作按钮 */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Badge className="flex items-center gap-1">
                {getRoleIcon(selectedRole)}
                {currentRole?.name || selectedRole}
              </Badge>
              <span className="text-sm text-gray-500">
                {user.permissions?.length || 0} 个权限
              </span>
            </div>
            <div className="flex gap-2">
              {!isEditing ? (
                <Button onClick={() => setIsEditing(true)} variant="outline">
                  <Edit className="w-4 h-4 mr-2" />
                  编辑
                </Button>
              ) : (
                <div className="flex gap-2">
                  <Button onClick={handleCancel} variant="outline" disabled={saving}>
                    <X className="w-4 h-4 mr-2" />
                    取消
                  </Button>
                  <Button onClick={handleSave} disabled={saving}>
                    <Save className="w-4 h-4 mr-2" />
                    {saving ? '保存中...' : '保存'}
                  </Button>
                </div>
              )}
            </div>
          </div>

          <Separator />

          {/* 详细信息标签页 */}
          <Tabs defaultValue="role" className="space-y-4">
            <TabsList>
              <TabsTrigger value="role">角色管理</TabsTrigger>
              <TabsTrigger value="permissions">权限详情</TabsTrigger>
              <TabsTrigger value="activity">活动记录</TabsTrigger>
            </TabsList>

            <TabsContent value="role" className="space-y-4">
              <div className="space-y-4">
                <div>
                  <Label htmlFor="role">用户角色</Label>
                  <Select 
                    value={selectedRole} 
                    onValueChange={setSelectedRole}
                    disabled={!isEditing}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {availableRoles.map((role) => (
                        <SelectItem key={role.key} value={role.key}>
                          <div className="flex items-center gap-2">
                            {getRoleIcon(role.key)}
                            <span>{role.name}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="status">账户状态</Label>
                  <Select 
                    value={selectedStatus} 
                    onValueChange={setSelectedStatus}
                    disabled={!isEditing}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">
                        <div className="flex items-center gap-2">
                          <Check className="w-4 h-4 text-green-500" />
                          <span>活跃</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="inactive">
                        <div className="flex items-center gap-2">
                          <X className="w-4 h-4 text-red-500" />
                          <span>停用</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="pending">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4 text-yellow-500" />
                          <span>待激活</span>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {currentRole && (
                  <div className="p-4 bg-blue-50 rounded-lg">
                    <h4 className="font-medium text-blue-900 mb-2">角色说明</h4>
                    <p className="text-sm text-blue-700 mb-3">
                      {currentRole.key === 'owner' ? '拥有企业的完全控制权限，可以管理所有资源和用户' :
                       currentRole.key === 'admin' ? '管理员权限，可以管理企业资源和大部分用户操作' :
                       currentRole.key === 'member' ? '基础成员权限，可以使用企业资源但管理权限有限' :
                       '自定义角色权限'}
                    </p>
                    <div className="text-sm text-blue-600">
                      <span className="font-medium">包含权限:</span>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {currentRole.permissions.slice(0, 5).map(permission => (
                          <Badge key={permission} variant="secondary" className="text-xs">
                            {permission}
                          </Badge>
                        ))}
                        {currentRole.permissions.length > 5 && (
                          <Badge variant="secondary" className="text-xs">
                            +{currentRole.permissions.length - 5} 更多
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="permissions" className="space-y-4">
              <div className="space-y-6">
                {/* 权限管理工具栏 */}
                {isEditing && (
                  <div className="p-4 bg-gray-50 rounded-lg space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium text-gray-900">权限管理工具</h4>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowAdvancedPermissions(!showAdvancedPermissions)}
                      >
                        {showAdvancedPermissions ? '简化视图' : '高级视图'}
                      </Button>
                    </div>
                    
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => applyPermissionTemplate('minimal')}
                      >
                        最小权限
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => applyPermissionTemplate('standard')}
                      >
                        标准权限
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => applyPermissionTemplate('advanced')}
                      >
                        高级权限
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedPermissions(rolePermissions)}
                      >
                        重置为角色权限
                      </Button>
                    </div>
                    
                    {permissionConflicts.length > 0 && (
                      <div className="flex items-start gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded">
                        <AlertTriangle className="w-4 h-4 text-yellow-500 mt-0.5" />
                        <div>
                          <p className="text-sm font-medium text-yellow-800">权限冲突检测</p>
                          <p className="text-xs text-yellow-700 mt-1">
                            发现 {permissionConflicts.length} 个权限不在当前角色范围内：
                            {permissionConflicts.slice(0, 3).join(', ')}
                            {permissionConflicts.length > 3 && ` 等${permissionConflicts.length}个`}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                )}
                
                {/* 权限统计 */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center p-3 bg-blue-50 rounded">
                    <p className="text-lg font-semibold text-blue-600">{inheritedPermissions.length}</p>
                    <p className="text-xs text-blue-600">角色权限</p>
                  </div>
                  <div className="text-center p-3 bg-green-50 rounded">
                    <p className="text-lg font-semibold text-green-600">{customPermissions.length}</p>
                    <p className="text-xs text-green-600">自定义权限</p>
                  </div>
                  <div className="text-center p-3 bg-purple-50 rounded">
                    <p className="text-lg font-semibold text-purple-600">{selectedPermissions.length}</p>
                    <p className="text-xs text-purple-600">总权限数</p>
                  </div>
                </div>
                {Object.entries(permissionCategories).map(([category, permissions]) => {
                  if (permissions.length === 0) return null;
                  
                  const categoryNames: Record<string, string> = {
                    system: '系统级权限',
                    enterprise: '企业级权限',
                    group: '拼车组权限',
                    ai: 'AI服务权限',
                    user: '用户管理权限',
                    other: '其他权限'
                  };

                  return (
                    <div key={category} className="space-y-3">
                      <h4 className="font-medium text-gray-900 flex items-center gap-2">
                        <Key className="w-4 h-4" />
                        {categoryNames[category]}
                      </h4>
                      <div className="grid grid-cols-1 gap-2">
                        {permissions.map(permission => {
                          const isInherited = rolePermissions.includes(permission);
                          const isSelected = selectedPermissions.includes(permission);
                          const isConflict = permissionConflicts.includes(permission);
                          
                          return (
                            <div key={permission} className={`flex items-center space-x-3 p-3 border rounded transition-colors ${
                              isConflict ? 'border-yellow-300 bg-yellow-50' : 
                              isInherited ? 'border-blue-300 bg-blue-50' : 
                              'border-gray-200'
                            }`}>
                              <Checkbox
                                id={permission}
                                checked={isSelected}
                                onCheckedChange={(checked) => {
                                  if (!isEditing) return;
                                  if (checked) {
                                    setSelectedPermissions([...selectedPermissions, permission]);
                                  } else {
                                    setSelectedPermissions(selectedPermissions.filter(p => p !== permission));
                                  }
                                }}
                                disabled={!isEditing || (isInherited && !showAdvancedPermissions)}
                              />
                              <div className="flex-1">
                                <Label 
                                  htmlFor={permission} 
                                  className="text-sm cursor-pointer font-medium"
                                >
                                  {permission}
                                </Label>
                                {showAdvancedPermissions && (
                                  <p className="text-xs text-gray-500 mt-1">
                                    来源: {isInherited ? `角色 (${selectedRole})` : '直接分配'}
                                    {isConflict && ' • 权限冲突'}
                                  </p>
                                )}
                              </div>
                              <div className="flex gap-1">
                                <Badge 
                                  variant={permission.includes('admin') || permission.includes('manage') ? 'destructive' : 
                                          permission.includes('create') || permission.includes('invite') ? 'default' : 'secondary'}
                                  className="text-xs"
                                >
                                  {permission.includes('admin') || permission.includes('manage') ? '管理' :
                                   permission.includes('create') || permission.includes('invite') ? '创建' : '查看'}
                                </Badge>
                                {isInherited && (
                                  <Badge variant="outline" className="text-xs text-blue-600">
                                    角色
                                  </Badge>
                                )}
                                {isConflict && (
                                  <Badge variant="outline" className="text-xs text-yellow-600">
                                    冲突
                                  </Badge>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </TabsContent>

            <TabsContent value="activity" className="space-y-4">
              <div className="text-center py-8 text-gray-500">
                <Clock className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                <p>活动记录功能开发中...</p>
                <p className="text-sm mt-2">将显示用户的登录记录、权限变更历史等信息</p>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}
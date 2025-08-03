'use client';

/**
 * 批量用户管理对话框组件
 * 
 * 功能：
 * - 批量选择用户
 * - 批量分配角色
 * - 批量修改权限
 * - 批量启用/禁用用户
 * - 批量删除用户
 */

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { 
  Users,
  Shield,
  Crown,
  UserCheck,
  UserX,
  Trash2,
  Edit,
  Check,
  X,
  AlertTriangle,
  Settings,
  Key,
  Activity
} from 'lucide-react';

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

interface BatchUserManagementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  users: User[];
  availableRoles: Array<{
    key: string;
    name: string;
    permissions: string[];
  }>;
  availablePermissions: string[];
  onBatchUpdate: (userIds: string[], updates: {
    role?: string;
    permissions?: string[];
    status?: string;
  }) => Promise<boolean>;
  onBatchDelete: (userIds: string[]) => Promise<boolean>;
}

export function BatchUserManagementDialog({
  open,
  onOpenChange,
  users,
  availableRoles,
  availablePermissions,
  onBatchUpdate,
  onBatchDelete
}: BatchUserManagementDialogProps) {
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [batchRole, setBatchRole] = useState<string>('');
  const [batchPermissions, setBatchPermissions] = useState<string[]>([]);
  const [batchStatus, setBatchStatus] = useState<string>('');
  const [processing, setProcessing] = useState(false);

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedUsers(users.map(user => user.id));
    } else {
      setSelectedUsers([]);
    }
  };

  const handleSelectUser = (userId: string, checked: boolean) => {
    if (checked) {
      setSelectedUsers([...selectedUsers, userId]);
    } else {
      setSelectedUsers(selectedUsers.filter(id => id !== userId));
    }
  };

  const handleBatchRoleUpdate = async () => {
    if (!batchRole || selectedUsers.length === 0) return;
    
    setProcessing(true);
    try {
      const success = await onBatchUpdate(selectedUsers, { role: batchRole });
      if (success) {
        setSelectedUsers([]);
        setBatchRole('');
      }
    } catch (error) {
      console.error('批量角色更新失败:', error);
    } finally {
      setProcessing(false);
    }
  };

  const handleBatchPermissionUpdate = async () => {
    if (batchPermissions.length === 0 || selectedUsers.length === 0) return;
    
    setProcessing(true);
    try {
      const success = await onBatchUpdate(selectedUsers, { permissions: batchPermissions });
      if (success) {
        setSelectedUsers([]);
        setBatchPermissions([]);
      }
    } catch (error) {
      console.error('批量权限更新失败:', error);
    } finally {
      setProcessing(false);
    }
  };

  const handleBatchStatusUpdate = async () => {
    if (!batchStatus || selectedUsers.length === 0) return;
    
    setProcessing(true);
    try {
      const success = await onBatchUpdate(selectedUsers, { status: batchStatus });
      if (success) {
        setSelectedUsers([]);
        setBatchStatus('');
      }
    } catch (error) {
      console.error('批量状态更新失败:', error);
    } finally {
      setProcessing(false);
    }
  };

  const handleBatchDelete = async () => {
    if (selectedUsers.length === 0) return;
    
    const activeUsers = selectedUsers.filter(id => {
      const user = users.find(u => u.id === id);
      return user?.status === 'active';
    });

    if (activeUsers.length > 0) {
      if (!confirm(`确定要删除 ${selectedUsers.length} 个用户吗？其中包含 ${activeUsers.length} 个活跃用户。此操作无法撤销。`)) {
        return;
      }
    } else {
      if (!confirm(`确定要删除 ${selectedUsers.length} 个用户吗？此操作无法撤销。`)) {
        return;
      }
    }
    
    setProcessing(true);
    try {
      const success = await onBatchDelete(selectedUsers);
      if (success) {
        setSelectedUsers([]);
      }
    } catch (error) {
      console.error('批量删除失败:', error);
    } finally {
      setProcessing(false);
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

  const selectedUsersData = users.filter(user => selectedUsers.includes(user.id));
  const roleDistribution = selectedUsersData.reduce((acc, user) => {
    acc[user.role] = (acc[user.role] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const statusDistribution = selectedUsersData.reduce((acc, user) => {
    acc[user.status] = (acc[user.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            批量用户管理
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* 选择统计 */}
          <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={selectedUsers.length === users.length}
                  onCheckedChange={handleSelectAll}
                />
                <span className="font-medium">选择全部</span>
              </div>
              <div className="text-sm text-blue-700">
                已选择 {selectedUsers.length} / {users.length} 个用户
              </div>
            </div>
            {selectedUsers.length > 0 && (
              <div className="flex items-center gap-2">
                {Object.entries(roleDistribution).map(([role, count]) => (
                  <Badge key={role} variant="secondary" className="text-xs">
                    {getRoleIcon(role)}
                    <span className="ml-1">{role}: {count}</span>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* 用户列表 */}
          <div className="border rounded-lg">
            <div className="max-h-64 overflow-y-auto">
              <div className="space-y-1 p-2">
                {users.map((user) => (
                  <div 
                    key={user.id} 
                    className={`flex items-center justify-between p-3 rounded border transition-colors ${
                      selectedUsers.includes(user.id) ? 'bg-blue-50 border-blue-200' : 'hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Checkbox
                        checked={selectedUsers.includes(user.id)}
                        onCheckedChange={(checked) => handleSelectUser(user.id, checked as boolean)}
                      />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{user.name}</span>
                          <Badge className={`flex items-center gap-1 text-xs ${getStatusColor(user.status)}`}>
                            {getStatusIcon(user.status)}
                            {user.status === 'active' ? '活跃' : 
                             user.status === 'inactive' ? '停用' : '待激活'}
                          </Badge>
                        </div>
                        <div className="text-sm text-gray-600">{user.email}</div>
                        {user.department && (
                          <div className="text-xs text-gray-500">部门: {user.department}</div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="flex items-center gap-1">
                        {getRoleIcon(user.role)}
                        {user.role}
                      </Badge>
                      <span className="text-xs text-gray-500">
                        {user.permissions.length} 个权限
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 批量操作标签页 */}
          {selectedUsers.length > 0 && (
            <Tabs defaultValue="role" className="space-y-4">
              <TabsList>
                <TabsTrigger value="role">角色管理</TabsTrigger>
                <TabsTrigger value="permissions">权限管理</TabsTrigger>
                <TabsTrigger value="status">状态管理</TabsTrigger>
                <TabsTrigger value="delete">删除用户</TabsTrigger>
              </TabsList>

              <TabsContent value="role" className="space-y-4">
                <div className="p-4 border rounded-lg">
                  <h3 className="font-medium mb-3 flex items-center gap-2">
                    <Shield className="w-4 h-4" />
                    批量分配角色
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium">选择角色</label>
                      <Select value={batchRole} onValueChange={setBatchRole}>
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder="选择要分配的角色" />
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
                    <div className="flex justify-end">
                      <Button 
                        onClick={handleBatchRoleUpdate}
                        disabled={!batchRole || processing}
                      >
                        <Edit className="w-4 h-4 mr-2" />
                        {processing ? '处理中...' : `更新 ${selectedUsers.length} 个用户角色`}
                      </Button>
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="permissions" className="space-y-4">
                <div className="p-4 border rounded-lg">
                  <h3 className="font-medium mb-3 flex items-center gap-2">
                    <Key className="w-4 h-4" />
                    批量分配权限
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium">选择权限 (将覆盖用户当前权限)</label>
                      <div className="mt-2 max-h-32 overflow-y-auto border rounded p-2">
                        <div className="space-y-2">
                          {availablePermissions.map(permission => (
                            <div key={permission} className="flex items-center space-x-2">
                              <Checkbox
                                checked={batchPermissions.includes(permission)}
                                onCheckedChange={(checked) => {
                                  if (checked) {
                                    setBatchPermissions([...batchPermissions, permission]);
                                  } else {
                                    setBatchPermissions(batchPermissions.filter(p => p !== permission));
                                  }
                                }}
                              />
                              <label className="text-sm">{permission}</label>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="flex justify-end">
                      <Button 
                        onClick={handleBatchPermissionUpdate}
                        disabled={batchPermissions.length === 0 || processing}
                      >
                        <Key className="w-4 h-4 mr-2" />
                        {processing ? '处理中...' : `更新 ${selectedUsers.length} 个用户权限`}
                      </Button>
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="status" className="space-y-4">
                <div className="p-4 border rounded-lg">
                  <h3 className="font-medium mb-3 flex items-center gap-2">
                    <Activity className="w-4 h-4" />
                    批量状态管理
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium">选择状态</label>
                      <Select value={batchStatus} onValueChange={setBatchStatus}>
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder="选择要设置的状态" />
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
                    <div className="flex justify-end">
                      <Button 
                        onClick={handleBatchStatusUpdate}
                        disabled={!batchStatus || processing}
                      >
                        <Settings className="w-4 h-4 mr-2" />
                        {processing ? '处理中...' : `更新 ${selectedUsers.length} 个用户状态`}
                      </Button>
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="delete" className="space-y-4">
                <div className="p-4 border rounded-lg border-red-200 bg-red-50">
                  <h3 className="font-medium mb-3 flex items-center gap-2 text-red-800">
                    <Trash2 className="w-4 h-4" />
                    批量删除用户
                  </h3>
                  <div className="space-y-4">
                    <div className="text-sm text-red-700">
                      <p>⚠️ 警告：此操作将永久删除选中的用户账户，无法撤销。</p>
                      <p className="mt-1">影响范围：</p>
                      <ul className="mt-1 ml-4 list-disc">
                        <li>用户账户将被完全删除</li>
                        <li>用户的所有权限和角色分配将被移除</li>
                        <li>用户的历史记录将被保留（匿名化）</li>
                      </ul>
                    </div>
                    
                    {Object.keys(statusDistribution).length > 0 && (
                      <div className="text-sm">
                        <p className="font-medium text-red-800">删除统计：</p>
                        <div className="mt-1">
                          {Object.entries(statusDistribution).map(([status, count]) => (
                            <span key={status} className="mr-3">
                              {status === 'active' ? '活跃用户' : 
                               status === 'inactive' ? '停用用户' : '待激活用户'}: {count}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="flex justify-end">
                      <Button 
                        onClick={handleBatchDelete}
                        disabled={processing}
                        variant="destructive"
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        {processing ? '删除中...' : `删除 ${selectedUsers.length} 个用户`}
                      </Button>
                    </div>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
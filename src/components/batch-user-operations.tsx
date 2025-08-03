'use client';

/**
 * 批量用户操作组件
 * 
 * 功能：
 * - 批量角色分配
 * - 批量权限修改
 * - 批量用户状态管理
 * - 批量导入/导出用户
 */

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { 
  Users,
  UserCheck,
  UserX,
  Download,
  Upload,
  Settings,
  Save,
  X,
  CheckCircle,
  AlertTriangle,
  FileText,
  Crown,
  Shield,
  Key
} from 'lucide-react';

interface BatchUserOperationsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedUsers: Array<{
    id: string;
    name: string;
    email: string;
    role: string;
    permissions: string[];
    status: 'active' | 'inactive' | 'pending';
  }>;
  availableRoles: Array<{
    key: string;
    name: string;
    permissions: string[];
  }>;
  availablePermissions: string[];
  onBatchUpdate: (updates: {
    userIds: string[];
    action: 'role' | 'permissions' | 'status' | 'export' | 'import';
    data: any;
  }) => Promise<boolean>;
}

export function BatchUserOperations({
  open,
  onOpenChange,
  selectedUsers,
  availableRoles,
  availablePermissions,
  onBatchUpdate
}: BatchUserOperationsProps) {
  const [selectedAction, setSelectedAction] = useState<'role' | 'permissions' | 'status' | 'export' | 'import'>('role');
  const [newRole, setNewRole] = useState('');
  const [newStatus, setNewStatus] = useState<'active' | 'inactive' | 'pending'>('active');
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [permissionMode, setPermissionMode] = useState<'add' | 'remove' | 'replace'>('add');
  const [processing, setProcessing] = useState(false);
  const [importData, setImportData] = useState('');

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
        return 'text-green-600 bg-green-50';
      case 'inactive':
        return 'text-red-600 bg-red-50';
      case 'pending':
        return 'text-yellow-600 bg-yellow-50';
      default:
        return 'text-gray-600 bg-gray-50';
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

  const handleBatchOperation = async () => {
    if (selectedUsers.length === 0) return;

    setProcessing(true);
    try {
      const userIds = selectedUsers.map(user => user.id);
      let data: any = {};

      switch (selectedAction) {
        case 'role':
          if (!newRole) return;
          data = { role: newRole };
          break;
        case 'status':
          data = { status: newStatus };
          break;
        case 'permissions':
          data = { 
            permissions: selectedPermissions,
            mode: permissionMode
          };
          break;
        case 'export':
          data = { format: 'csv' };
          break;
        case 'import':
          data = { importData };
          break;
      }

      const success = await onBatchUpdate({
        userIds,
        action: selectedAction,
        data
      });

      if (success && selectedAction !== 'export') {
        onOpenChange(false);
      }
    } catch (error) {
      console.error('批量操作失败:', error);
    } finally {
      setProcessing(false);
    }
  };

  const generatePreview = () => {
    const preview = [];
    for (const user of selectedUsers) {
      const changes = [];
      
      if (selectedAction === 'role' && newRole && user.role !== newRole) {
        changes.push(`角色: ${user.role} → ${newRole}`);
      }
      
      if (selectedAction === 'status' && user.status !== newStatus) {
        changes.push(`状态: ${user.status} → ${newStatus}`);
      }
      
      if (selectedAction === 'permissions' && selectedPermissions.length > 0) {
        const currentPermissions = user.permissions || [];
        let newPermissions = [...currentPermissions];
        
        switch (permissionMode) {
          case 'add':
            selectedPermissions.forEach(p => {
              if (!newPermissions.includes(p)) {
                newPermissions.push(p);
              }
            });
            break;
          case 'remove':
            newPermissions = newPermissions.filter(p => !selectedPermissions.includes(p));
            break;
          case 'replace':
            newPermissions = [...selectedPermissions];
            break;
        }
        
        const added = newPermissions.filter(p => !currentPermissions.includes(p));
        const removed = currentPermissions.filter(p => !newPermissions.includes(p));
        
        if (added.length > 0) {
          changes.push(`新增权限: ${added.slice(0, 3).join(', ')}${added.length > 3 ? `等${added.length}个` : ''}`);
        }
        if (removed.length > 0) {
          changes.push(`移除权限: ${removed.slice(0, 3).join(', ')}${removed.length > 3 ? `等${removed.length}个` : ''}`);
        }
      }
      
      if (changes.length > 0) {
        preview.push({
          user,
          changes
        });
      }
    }
    
    return preview;
  };

  const permissionCategories = categorizePermissions(availablePermissions);
  const preview = generatePreview();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            批量用户操作 ({selectedUsers.length} 个用户)
          </DialogTitle>
        </DialogHeader>

        <Tabs value={selectedAction} onValueChange={(value) => setSelectedAction(value as any)} className="space-y-4">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="role">角色分配</TabsTrigger>
            <TabsTrigger value="permissions">权限管理</TabsTrigger>
            <TabsTrigger value="status">状态管理</TabsTrigger>
            <TabsTrigger value="export">导出数据</TabsTrigger>
            <TabsTrigger value="import">导入用户</TabsTrigger>
          </TabsList>

          <TabsContent value="role" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>批量角色分配</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="role-select">目标角色</Label>
                  <Select value={newRole} onValueChange={setNewRole}>
                    <SelectTrigger>
                      <SelectValue placeholder="选择角色" />
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

                {newRole && (
                  <div className="p-3 bg-blue-50 rounded-lg">
                    <h4 className="font-medium text-blue-900 mb-2">角色权限预览</h4>
                    <div className="flex flex-wrap gap-1">
                      {availableRoles.find(r => r.key === newRole)?.permissions.slice(0, 6).map(permission => (
                        <Badge key={permission} variant="secondary" className="text-xs">
                          {permission}
                        </Badge>
                      ))}
                      {(availableRoles.find(r => r.key === newRole)?.permissions.length || 0) > 6 && (
                        <Badge variant="secondary" className="text-xs">
                          +{(availableRoles.find(r => r.key === newRole)?.permissions.length || 0) - 6} 更多
                        </Badge>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="permissions" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>批量权限管理</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>操作模式</Label>
                  <Select value={permissionMode} onValueChange={(value) => setPermissionMode(value as any)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="add">添加权限</SelectItem>
                      <SelectItem value="remove">移除权限</SelectItem>
                      <SelectItem value="replace">替换权限</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-3">
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
                      <div key={category}>
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-medium text-gray-900">{categoryNames[category]}</h4>
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-xs h-6 px-2"
                              onClick={() => {
                                const newPermissions = selectedPermissions.filter(p => !permissions.includes(p));
                                setSelectedPermissions([...newPermissions, ...permissions]);
                              }}
                            >
                              全选
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-xs h-6 px-2"
                              onClick={() => {
                                setSelectedPermissions(selectedPermissions.filter(p => !permissions.includes(p)));
                              }}
                            >
                              取消
                            </Button>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          {permissions.map(permission => (
                            <div key={permission} className="flex items-center space-x-2">
                              <Checkbox
                                checked={selectedPermissions.includes(permission)}
                                onCheckedChange={(checked) => {
                                  if (checked) {
                                    setSelectedPermissions([...selectedPermissions, permission]);
                                  } else {
                                    setSelectedPermissions(selectedPermissions.filter(p => p !== permission));
                                  }
                                }}
                              />
                              <Label className="text-sm">{permission}</Label>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="status" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>批量状态管理</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>目标状态</Label>
                  <Select value={newStatus} onValueChange={(value) => setNewStatus(value as any)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">
                        <div className="flex items-center gap-2">
                          <CheckCircle className="w-4 h-4 text-green-500" />
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

                <div className={`p-3 rounded-lg ${getStatusColor(newStatus)}`}>
                  <h4 className="font-medium mb-2">状态说明</h4>
                  <p className="text-sm">
                    {newStatus === 'active' ? '用户将能够正常访问系统和使用分配的权限' :
                     newStatus === 'inactive' ? '用户将被禁止访问系统，但账户信息保留' :
                     '用户需要完成激活流程才能访问系统'}
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="export" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>导出用户数据</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-sm text-gray-600">
                  <p>将导出以下用户的完整信息：</p>
                  <ul className="list-disc list-inside mt-2 space-y-1">
                    <li>基本信息（姓名、邮箱、状态）</li>
                    <li>角色分配</li>
                    <li>权限列表</li>
                    <li>加入时间和最后访问时间</li>
                  </ul>
                </div>
                <div className="p-3 bg-green-50 rounded-lg">
                  <p className="text-sm text-green-700">
                    点击执行将下载包含 {selectedUsers.length} 个用户数据的CSV文件
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="import" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>批量导入用户</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="import-data">CSV数据</Label>
                  <Textarea
                    id="import-data"
                    placeholder="邮箱,姓名,角色,部门&#10;user1@example.com,张三,member,技术部&#10;user2@example.com,李四,admin,管理部"
                    value={importData}
                    onChange={(e) => setImportData(e.target.value)}
                    rows={6}
                  />
                </div>
                <div className="text-sm text-gray-600">
                  <p className="font-medium mb-2">CSV格式说明：</p>
                  <ul className="list-disc list-inside space-y-1">
                    <li>第一行为标题行：邮箱,姓名,角色,部门</li>
                    <li>角色必须是系统中已存在的角色</li>
                    <li>部门为可选字段</li>
                    <li>导入的用户初始状态为"待激活"</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* 操作预览 */}
        {preview.length > 0 && selectedAction !== 'export' && selectedAction !== 'import' && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">操作预览</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-32 overflow-y-auto">
                {preview.map(({ user, changes }) => (
                  <div key={user.id} className="text-sm border-l-2 border-blue-200 pl-3">
                    <div className="font-medium">{user.name}</div>
                    <div className="text-gray-600">
                      {changes.map((change, index) => (
                        <div key={index}>• {change}</div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={processing}>
            取消
          </Button>
          <Button 
            onClick={handleBatchOperation} 
            disabled={processing || (selectedAction === 'role' && !newRole) || (selectedAction === 'permissions' && selectedPermissions.length === 0) || (selectedAction === 'import' && !importData.trim())}
          >
            <Save className="w-4 h-4 mr-2" />
            {processing ? '处理中...' : 
             selectedAction === 'export' ? '导出' :
             selectedAction === 'import' ? '导入' :
             '执行操作'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
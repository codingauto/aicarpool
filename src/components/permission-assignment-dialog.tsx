'use client';

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import {
  Shield,
  AlertCircle,
  User,
  Key,
  Building2,
  Users,
  Car,
  Sparkles,
  Settings,
  Lock,
  Unlock,
} from 'lucide-react';

interface Permission {
  key: string;
  name: string;
  description: string;
  category: 'system' | 'enterprise' | 'group' | 'user' | 'ai';
  level: 'admin' | 'manage' | 'create' | 'view';
}

interface PermissionAssignmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  userName: string;
  currentPermissions: string[];
  availablePermissions: string[];
  onSave: (permissions: string[]) => Promise<boolean>;
}

const PERMISSION_DEFINITIONS: Permission[] = [
  // 系统权限
  { key: 'system.admin', name: '系统管理', description: '完全的系统管理权限', category: 'system', level: 'admin' },
  { key: 'system.view', name: '系统查看', description: '查看系统信息', category: 'system', level: 'view' },
  
  // 企业权限
  { key: 'enterprise.manage', name: '企业管理', description: '管理企业设置和配置', category: 'enterprise', level: 'manage' },
  { key: 'enterprise.view', name: '企业查看', description: '查看企业信息', category: 'enterprise', level: 'view' },
  { key: 'enterprise.billing', name: '计费管理', description: '管理企业计费和订阅', category: 'enterprise', level: 'manage' },
  
  // 拼车组权限
  { key: 'group.manage', name: '拼车组管理', description: '管理所有拼车组', category: 'group', level: 'manage' },
  { key: 'group.create', name: '创建拼车组', description: '创建新的拼车组', category: 'group', level: 'create' },
  { key: 'group.view', name: '查看拼车组', description: '查看拼车组信息', category: 'group', level: 'view' },
  { key: 'group.join', name: '加入拼车组', description: '加入拼车组', category: 'group', level: 'create' },
  
  // 用户权限
  { key: 'user.manage', name: '用户管理', description: '管理所有用户', category: 'user', level: 'manage' },
  { key: 'user.invite', name: '邀请用户', description: '邀请新用户加入', category: 'user', level: 'create' },
  { key: 'user.view', name: '查看用户', description: '查看用户信息', category: 'user', level: 'view' },
  { key: 'user.remove', name: '移除用户', description: '移除用户', category: 'user', level: 'admin' },
  
  // AI 权限
  { key: 'ai.manage', name: 'AI服务管理', description: '管理AI服务配置', category: 'ai', level: 'manage' },
  { key: 'ai.use', name: '使用AI服务', description: '使用AI功能', category: 'ai', level: 'view' },
  { key: 'ai.advanced', name: '高级AI功能', description: '使用高级AI功能', category: 'ai', level: 'create' },
];

export function PermissionAssignmentDialog({
  open,
  onOpenChange,
  userId,
  userName,
  currentPermissions,
  availablePermissions,
  onSave,
}: PermissionAssignmentDialogProps) {
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    setSelectedPermissions(currentPermissions);
    setHasChanges(false);
    setError('');
  }, [currentPermissions, open]);

  const handleTogglePermission = (permission: string) => {
    setSelectedPermissions(prev => {
      const newPermissions = prev.includes(permission)
        ? prev.filter(p => p !== permission)
        : [...prev, permission];
      
      setHasChanges(
        JSON.stringify(newPermissions.sort()) !== JSON.stringify(currentPermissions.sort())
      );
      
      return newPermissions;
    });
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'system':
        return <Settings className="w-4 h-4" />;
      case 'enterprise':
        return <Building2 className="w-4 h-4" />;
      case 'group':
        return <Car className="w-4 h-4" />;
      case 'user':
        return <Users className="w-4 h-4" />;
      case 'ai':
        return <Sparkles className="w-4 h-4" />;
      default:
        return <Shield className="w-4 h-4" />;
    }
  };

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'admin':
        return 'bg-red-100 text-red-800';
      case 'manage':
        return 'bg-orange-100 text-orange-800';
      case 'create':
        return 'bg-blue-100 text-blue-800';
      case 'view':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const groupedPermissions = PERMISSION_DEFINITIONS.reduce((acc, perm) => {
    if (!acc[perm.category]) {
      acc[perm.category] = [];
    }
    acc[perm.category].push(perm);
    return acc;
  }, {} as Record<string, Permission[]>);

  const handleSubmit = async () => {
    if (!hasChanges) {
      onOpenChange(false);
      return;
    }

    setLoading(true);
    setError('');

    try {
      const success = await onSave(selectedPermissions);
      if (success) {
        onOpenChange(false);
      } else {
        setError('保存权限失败，请重试');
      }
    } catch (err) {
      setError('保存权限失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectAll = (category: string) => {
    const categoryPermissions = groupedPermissions[category].map(p => p.key);
    const allSelected = categoryPermissions.every(p => selectedPermissions.includes(p));
    
    if (allSelected) {
      setSelectedPermissions(prev => prev.filter(p => !categoryPermissions.includes(p)));
    } else {
      setSelectedPermissions(prev => [...new Set([...prev, ...categoryPermissions])]);
    }
    
    setHasChanges(true);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Key className="w-5 h-5" />
            权限分配 - {userName}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {hasChanges && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                您已修改权限设置，请保存更改
              </AlertDescription>
            </Alert>
          )}

          <ScrollArea className="h-[400px] pr-4">
            <div className="space-y-6">
              {Object.entries(groupedPermissions).map(([category, permissions]) => (
                <div key={category} className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      {getCategoryIcon(category)}
                      <span className="capitalize">{category} 权限</span>
                      <Badge variant="secondary" className="ml-2">
                        {permissions.filter(p => selectedPermissions.includes(p.key)).length}/
                        {permissions.length}
                      </Badge>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleSelectAll(category)}
                    >
                      {permissions.every(p => selectedPermissions.includes(p.key))
                        ? '取消全选'
                        : '全选'}
                    </Button>
                  </div>

                  <div className="space-y-2 pl-6">
                    {permissions.map(permission => {
                      const isSelected = selectedPermissions.includes(permission.key);
                      const isAvailable = availablePermissions.includes(permission.key);
                      
                      return (
                        <div
                          key={permission.key}
                          className={`flex items-center space-x-3 p-2 rounded-lg border ${
                            isSelected ? 'bg-blue-50 border-blue-200' : 'hover:bg-gray-50'
                          } ${!isAvailable ? 'opacity-50' : ''}`}
                        >
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => handleTogglePermission(permission.key)}
                            disabled={!isAvailable || loading}
                          />
                          
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              {isSelected ? (
                                <Unlock className="w-3 h-3 text-green-600" />
                              ) : (
                                <Lock className="w-3 h-3 text-gray-400" />
                              )}
                              <span className="font-medium text-sm">{permission.name}</span>
                              <Badge className={`text-xs ${getLevelColor(permission.level)}`}>
                                {permission.level}
                              </Badge>
                            </div>
                            <p className="text-xs text-gray-500 mt-1">{permission.description}</p>
                            <code className="text-xs text-gray-400">{permission.key}</code>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>

          <div className="flex items-center justify-between text-sm text-gray-500">
            <span>已选择 {selectedPermissions.length} 个权限</span>
            <span>共 {PERMISSION_DEFINITIONS.length} 个可用权限</span>
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            取消
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={loading || !hasChanges}
          >
            {loading ? '保存中...' : '保存权限'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
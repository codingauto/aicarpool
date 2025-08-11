'use client';

import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Shield,
  Users,
  Key,
  CheckCircle,
  Info,
  Calendar,
  User,
  Mail,
} from 'lucide-react';

interface RoleViewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  role: {
    key: string;
    name: string;
    permissions: string[];
    description?: string;
    isSystem?: boolean;
    userCount?: number;
    createdAt?: string;
  } | null;
  users?: Array<{
    id: string;
    name: string;
    email: string;
    joinedAt?: string;
  }>;
  permissionDetails?: Record<string, {
    name: string;
    description: string;
    category: string;
  }>;
}

export function RoleViewDialog({
  open,
  onOpenChange,
  role,
  users = [],
  permissionDetails = {},
}: RoleViewDialogProps) {
  if (!role) return null;

  // 按类别分组权限
  const groupedPermissions = role.permissions.reduce((acc, perm) => {
    const detail = permissionDetails[perm] || {
      name: perm,
      description: '系统权限',
      category: '其他'
    };
    
    if (!acc[detail.category]) {
      acc[detail.category] = [];
    }
    acc[detail.category].push({ key: perm, ...detail });
    return acc;
  }, {} as Record<string, Array<any>>);

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case '系统级':
        return <Shield className="w-4 h-4 text-red-500" />;
      case '企业级':
        return <Shield className="w-4 h-4 text-blue-500" />;
      case '拼车组':
        return <Users className="w-4 h-4 text-green-500" />;
      case '用户管理':
        return <User className="w-4 h-4 text-purple-500" />;
      case 'AI服务':
        return <Key className="w-4 h-4 text-orange-500" />;
      default:
        return <Info className="w-4 h-4 text-gray-500" />;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5" />
            角色详情 - {role.name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* 基本信息 */}
          <div className="bg-gray-50 rounded-lg p-4 space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium text-gray-900">{role.name}</h3>
                <p className="text-sm text-gray-600 mt-1">
                  {role.description || '系统内置角色'}
                </p>
              </div>
              <Badge variant={role.isSystem ? 'secondary' : 'default'}>
                {role.isSystem ? '系统角色' : '自定义角色'}
              </Badge>
            </div>
            <div className="flex items-center gap-4 text-sm text-gray-500">
              <span>角色标识: <code className="bg-white px-2 py-1 rounded">{role.key}</code></span>
              {role.userCount !== undefined && (
                <span className="flex items-center gap-1">
                  <Users className="w-3 h-3" />
                  {role.userCount} 个用户
                </span>
              )}
              {role.createdAt && (
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  创建于 {new Date(role.createdAt).toLocaleDateString('zh-CN')}
                </span>
              )}
            </div>
          </div>

          <Tabs defaultValue="permissions" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="permissions">权限列表 ({role.permissions.length})</TabsTrigger>
              <TabsTrigger value="users">使用用户 ({users.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="permissions" className="mt-4">
              <ScrollArea className="h-[400px] pr-4">
                <div className="space-y-4">
                  {Object.entries(groupedPermissions).map(([category, perms]) => (
                    <div key={category} className="space-y-2">
                      <div className="flex items-center gap-2 font-medium text-sm text-gray-700">
                        {getCategoryIcon(category)}
                        <span>{category}</span>
                        <Badge variant="outline" className="text-xs">
                          {perms.length} 个权限
                        </Badge>
                      </div>
                      <div className="pl-6 space-y-1">
                        {perms.map((perm) => (
                          <div
                            key={perm.key}
                            className="flex items-start gap-2 p-2 rounded hover:bg-gray-50"
                          >
                            <CheckCircle className="w-4 h-4 text-green-500 mt-0.5" />
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-sm">{perm.name}</span>
                                <code className="text-xs bg-gray-100 px-2 py-0.5 rounded">
                                  {perm.key}
                                </code>
                              </div>
                              <p className="text-xs text-gray-600 mt-0.5">
                                {perm.description}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="users" className="mt-4">
              <ScrollArea className="h-[400px] pr-4">
                {users.length === 0 ? (
                  <div className="text-center py-8">
                    <Users className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500">暂无用户使用此角色</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {users.map((user) => (
                      <div
                        key={user.id}
                        className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                            <User className="w-4 h-4 text-blue-600" />
                          </div>
                          <div>
                            <p className="font-medium text-sm">{user.name}</p>
                            <div className="flex items-center gap-1 text-xs text-gray-600">
                              <Mail className="w-3 h-3" />
                              <span>{user.email}</span>
                            </div>
                          </div>
                        </div>
                        {user.joinedAt && (
                          <span className="text-xs text-gray-500">
                            加入于 {new Date(user.joinedAt).toLocaleDateString('zh-CN')}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}
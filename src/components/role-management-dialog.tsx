'use client';

/**
 * 角色管理对话框组件
 * 
 * 功能：
 * - 查看系统所有角色
 * - 查看角色权限详情
 * - 管理角色分配
 * - 统计角色使用情况
 */

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { 
  Key,
  Shield,
  Crown,
  UserCheck,
  Users,
  Search,
  Eye,
  Edit3,
  AlertCircle,
  CheckCircle
} from 'lucide-react';

interface RoleManagementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  availableRoles: Array<{
    key: string;
    name: string;
    permissions: string[];
  }>;
  users: Array<{
    id: string;
    name: string;
    email: string;
    role: string;
    permissions: string[];
  }>;
  availablePermissions: string[];
  onCreateRole?: (role: {
    key: string;
    name: string;
    permissions: string[];
  }) => Promise<boolean>;
  onUpdateRole?: (roleKey: string, updates: {
    permissions: string[];
  }) => Promise<boolean>;
  onDeleteRole?: (roleKey: string) => Promise<boolean>;
}

export function RoleManagementDialog({
  open,
  onOpenChange,
  availableRoles,
  users,
  availablePermissions,
  onCreateRole,
  onUpdateRole,
  onDeleteRole
}: RoleManagementDialogProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRole, setSelectedRole] = useState<string | null>(null);

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'owner':
        return <Crown className="w-5 h-5 text-purple-500" />;
      case 'admin':
        return <Shield className="w-5 h-5 text-blue-500" />;
      case 'member':
        return <UserCheck className="w-5 h-5 text-green-500" />;
      default:
        return <Users className="w-5 h-5 text-gray-500" />;
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

  const getRoleDescription = (roleKey: string) => {
    switch (roleKey) {
      case 'owner':
        return '企业拥有者，拥有最高级别的权限，可以管理企业的所有方面';
      case 'admin':
        return '企业管理员，可以管理用户、资源和大部分企业功能';
      case 'member':
        return '企业成员，可以使用基本的企业服务和功能';
      default:
        return '自定义角色';
    }
  };

  const getUsersByRole = (roleKey: string) => {
    return users.filter(user => user.role === roleKey);
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

  const filteredRoles = availableRoles.filter(role =>
    role.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    role.key.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const selectedRoleData = selectedRole ? availableRoles.find(r => r.key === selectedRole) : null;
  const selectedRoleUsers = selectedRole ? getUsersByRole(selectedRole) : [];
  const selectedRolePermissions = selectedRoleData ? categorizePermissions(selectedRoleData.permissions) : {};

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] w-[1400px] max-h-[90vh] h-[850px] overflow-hidden flex flex-col">
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Key className="w-6 h-6 text-blue-600" />
            角色管理
          </DialogTitle>
          <p className="text-sm text-gray-600 mt-1">
            管理系统角色和权限分配
          </p>
        </DialogHeader>

        <Tabs defaultValue="overview" className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="grid grid-cols-3 w-full">
            <TabsTrigger value="overview">角色概览</TabsTrigger>
            <TabsTrigger value="details">角色详情</TabsTrigger>
            <TabsTrigger value="assignment">分配统计</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="flex-1 flex flex-col overflow-hidden">
            <div className="flex items-center gap-4 mb-4 shrink-0">
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <Input
                  placeholder="搜索角色..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <div className="text-sm text-gray-600">
                共 {availableRoles.length} 个角色
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 pb-4">
              {filteredRoles.map((role) => {
                const userCount = getUsersByRole(role.key).length;
                return (
                  <Card key={role.key} className="cursor-pointer hover:shadow-md transition-shadow min-h-[300px] w-full flex flex-col">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-4 w-full">
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          {getRoleIcon(role.key)}
                          <CardTitle className="text-lg leading-tight">{role.name}</CardTitle>
                        </div>
                        <Badge className={`${getRoleColor(role.key)} shrink-0 whitespace-nowrap text-xs px-2 py-1`}>
                          {role.key}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4 flex-1 flex flex-col justify-between">
                      <div className="space-y-3">
                        <div className="text-sm text-gray-600 leading-relaxed">
                          {getRoleDescription(role.key)}
                        </div>
                      
                        <div className="space-y-2 text-sm">
                          <div className="flex items-center justify-between">
                            <span className="text-gray-500">用户数量:</span>
                            <span className="font-medium">{userCount} 个用户</span>
                          </div>
                          
                          <div className="flex items-center justify-between">
                            <span className="text-gray-500">权限数量:</span>
                            <span className="font-medium">{role.permissions.length} 个权限</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex gap-2 pt-3">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="flex-1"
                          onClick={() => setSelectedRole(role.key)}
                        >
                          <Eye className="w-4 h-4 mr-1" />
                          查看详情
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          disabled
                        >
                          <Edit3 className="w-4 h-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="details" className="flex-1 flex flex-col overflow-hidden">
            {selectedRole && selectedRoleData ? (
              <div className="flex-1 flex flex-col overflow-hidden">
                {/* 角色信息头部 */}
                <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg mb-4 shrink-0">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    {getRoleIcon(selectedRole)}
                    <div className="min-w-0 flex-1">
                      <h3 className="text-lg font-semibold truncate">{selectedRoleData.name}</h3>
                      <p className="text-sm text-gray-600 truncate">{getRoleDescription(selectedRole)}</p>
                    </div>
                  </div>
                  <div className="shrink-0">
                    <Badge className={getRoleColor(selectedRole)}>
                      {selectedRole}
                    </Badge>
                  </div>
                </div>

                {/* 详情内容区域 */}
                <div className="flex-1 overflow-y-auto">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pb-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Users className="w-5 h-5" />
                        用户分配 ({selectedRoleUsers.length})
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {selectedRoleUsers.length > 0 ? (
                        selectedRoleUsers.map((user) => (
                          <div key={user.id} className="flex items-center justify-between p-3 border rounded">
                            <div>
                              <p className="font-medium">{user.name}</p>
                              <p className="text-sm text-gray-600">{user.email}</p>
                            </div>
                            <CheckCircle className="w-4 h-4 text-green-500" />
                          </div>
                        ))
                      ) : (
                        <div className="text-center py-6 text-gray-500">
                          <Users className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                          <p>暂无用户分配此角色</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Key className="w-5 h-5" />
                        权限详情 ({selectedRoleData.permissions.length})
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {Object.entries(selectedRolePermissions).map(([category, permissions]) => {
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
                          <div key={category} className="space-y-2">
                            <h4 className="font-medium text-gray-900 text-sm">
                              {categoryNames[category]} ({permissions.length})
                            </h4>
                            <div className="space-y-1">
                              {permissions.map(permission => (
                                <div key={permission} className="flex items-center gap-2 text-sm">
                                  <CheckCircle className="w-3 h-3 text-green-500" />
                                  <span className="text-gray-700">{permission}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </CardContent>
                  </Card>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <Key className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">选择角色查看详情</h3>
                  <p className="text-gray-600">在角色概览中点击"查看详情"按钮来查看角色的详细信息</p>
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="assignment" className="flex-1 flex flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pb-4">
              {availableRoles.map((role) => {
                const userCount = getUsersByRole(role.key).length;
                const percentage = users.length > 0 ? Math.round((userCount / users.length) * 100) : 0;
                
                return (
                  <Card key={role.key}>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          {getRoleIcon(role.key)}
                          <CardTitle className="text-base whitespace-nowrap">{role.name}</CardTitle>
                        </div>
                        <Badge variant="secondary" className="shrink-0">
                          {userCount} 用户
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span>分配比例</span>
                          <span className="font-medium">{percentage}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                        <div className="text-xs text-gray-600">
                          {userCount} / {users.length} 用户
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
              </div>

              <div className="mt-6 p-4 bg-blue-50 rounded-lg">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-blue-500 mt-0.5" />
                <div>
                  <h4 className="font-medium text-blue-900">角色分配建议</h4>
                  <ul className="text-sm text-blue-700 mt-2 space-y-1">
                    <li>• 建议限制 owner 角色的分配，通常一个企业只需要1-2个拥有者</li>
                    <li>• admin 角色应该分配给需要管理权限的核心团队成员</li>
                    <li>• 大部分用户应该分配 member 角色，满足日常使用需求</li>
                    <li>• 定期审查角色分配，确保权限最小化原则</li>
                  </ul>
                </div>
              </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
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
import { Button } from '@/components/ui/button';
import {
  User,
  Mail,
  Shield,
  Clock,
  UserCheck,
  UserX,
  AlertTriangle,
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

interface PermissionUsersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  permission: string;
  permissionName: string;
  users: User[];
  onManageUser?: (user: User) => void;
}

export function PermissionUsersDialog({
  open,
  onOpenChange,
  permission,
  permissionName,
  users,
  onManageUser,
}: PermissionUsersDialogProps) {
  const getRoleColor = (role: string) => {
    switch (role) {
      case 'owner':
        return 'bg-purple-100 text-purple-800';
      case 'admin':
        return 'bg-blue-100 text-blue-800';
      case 'member':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <UserCheck className="w-4 h-4 text-green-500" />;
      case 'inactive':
        return <UserX className="w-4 h-4 text-red-500" />;
      case 'pending':
        return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      default:
        return <User className="w-4 h-4 text-gray-500" />;
    }
  };

  const usersWithPermission = users.filter(u => 
    u.permissions.includes(permission)
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5" />
            拥有"{permissionName}"权限的用户
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center justify-between text-sm text-gray-600">
            <span>权限代码：<code className="bg-gray-100 px-2 py-1 rounded">{permission}</code></span>
            <span>共 {usersWithPermission.length} 个用户</span>
          </div>

          {usersWithPermission.length === 0 ? (
            <div className="text-center py-8">
              <User className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">暂无用户拥有此权限</p>
            </div>
          ) : (
            <ScrollArea className="h-[400px] pr-4">
              <div className="space-y-3">
                {usersWithPermission.map((user) => (
                  <div
                    key={user.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50"
                  >
                    <div className="flex items-center space-x-4">
                      {getStatusIcon(user.status)}
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium text-gray-900">{user.name}</h4>
                          <Badge className={`text-xs ${getRoleColor(user.role)}`}>
                            {user.role}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-gray-600 mt-1">
                          <Mail className="w-3 h-3" />
                          <span>{user.email}</span>
                        </div>
                        {user.department && (
                          <p className="text-xs text-gray-500 mt-1">
                            部门: {user.department}
                          </p>
                        )}
                        {user.lastAccess && (
                          <div className="flex items-center gap-1 text-xs text-gray-500 mt-1">
                            <Clock className="w-3 h-3" />
                            最后访问: {new Date(user.lastAccess).toLocaleDateString('zh-CN')}
                          </div>
                        )}
                      </div>
                    </div>
                    {onManageUser && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onManageUser(user)}
                      >
                        管理
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
'use client';

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  UserPlus,
  Search,
  User,
  Mail,
  Shield,
  Check,
} from 'lucide-react';

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  permissions: string[];
  status: 'active' | 'inactive' | 'pending';
}

interface PermissionAssignUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  permission: string;
  permissionName: string;
  users: User[];
  onAssign: (userIds: string[]) => Promise<boolean>;
}

export function PermissionAssignUserDialog({
  open,
  onOpenChange,
  permission,
  permissionName,
  users,
  onAssign,
}: PermissionAssignUserDialogProps) {
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);

  // 过滤出没有此权限的用户
  const usersWithoutPermission = users.filter(u => 
    !u.permissions.includes(permission) && u.status === 'active'
  );

  // 搜索过滤
  const filteredUsers = usersWithoutPermission.filter(user =>
    user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleToggleUser = (userId: string) => {
    setSelectedUsers(prev =>
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const handleSelectAll = () => {
    if (selectedUsers.length === filteredUsers.length) {
      setSelectedUsers([]);
    } else {
      setSelectedUsers(filteredUsers.map(u => u.id));
    }
  };

  const handleSubmit = async () => {
    if (selectedUsers.length === 0) {
      onOpenChange(false);
      return;
    }

    setLoading(true);
    try {
      const success = await onAssign(selectedUsers);
      if (success) {
        setSelectedUsers([]);
        setSearchTerm('');
        onOpenChange(false);
      }
    } finally {
      setLoading(false);
    }
  };

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="w-5 h-5" />
            分配权限给用户
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-blue-600" />
              <span className="font-medium text-sm">权限：{permissionName}</span>
            </div>
            <code className="text-xs text-gray-600 mt-1 block">{permission}</code>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <Input
                  placeholder="搜索用户..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleSelectAll}
                className="ml-2"
              >
                {selectedUsers.length === filteredUsers.length && filteredUsers.length > 0
                  ? '取消全选'
                  : '全选'}
              </Button>
            </div>

            {filteredUsers.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <User className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p>没有可分配的用户</p>
                <p className="text-xs mt-1">所有活跃用户都已拥有此权限</p>
              </div>
            ) : (
              <ScrollArea className="h-[300px] border rounded-lg p-2">
                <div className="space-y-2">
                  {filteredUsers.map((user) => (
                    <div
                      key={user.id}
                      className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer hover:bg-gray-50 ${
                        selectedUsers.includes(user.id) ? 'bg-blue-50 border-blue-200' : ''
                      }`}
                      onClick={() => handleToggleUser(user.id)}
                    >
                      <div className="flex items-center space-x-3">
                        <Checkbox
                          checked={selectedUsers.includes(user.id)}
                          onCheckedChange={() => handleToggleUser(user.id)}
                        />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">{user.name}</span>
                            <Badge className={`text-xs ${getRoleColor(user.role)}`}>
                              {user.role}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-1 text-xs text-gray-600">
                            <Mail className="w-3 h-3" />
                            <span>{user.email}</span>
                          </div>
                        </div>
                      </div>
                      {selectedUsers.includes(user.id) && (
                        <Check className="w-4 h-4 text-blue-600" />
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>

          <div className="text-sm text-gray-600">
            已选择 {selectedUsers.length} 个用户
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            取消
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={loading || selectedUsers.length === 0}
          >
            {loading ? '分配中...' : `分配权限 (${selectedUsers.length})`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
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
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Building2, Users, AlertCircle, UserPlus, UserMinus } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  department?: string;
}

interface Department {
  id: string;
  name: string;
  description?: string;
}

interface BatchDepartmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  users: User[];
  departments: Department[];
  onBatchAssign: (userIds: string[], departmentId: string, action: 'add' | 'remove') => Promise<boolean>;
}

export function BatchDepartmentDialog({
  open,
  onOpenChange,
  users,
  departments,
  onBatchAssign,
}: BatchDepartmentDialogProps) {
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [selectedDepartment, setSelectedDepartment] = useState<string>('');
  const [action, setAction] = useState<'add' | 'remove'>('add');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleToggleUser = (userId: string) => {
    setSelectedUsers(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const handleSelectAll = () => {
    if (selectedUsers.length === users.length) {
      setSelectedUsers([]);
    } else {
      setSelectedUsers(users.map(u => u.id));
    }
  };

  const handleSubmit = async () => {
    if (selectedUsers.length === 0) {
      setError('请至少选择一个用户');
      return;
    }

    if (!selectedDepartment) {
      setError('请选择一个部门');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const success = await onBatchAssign(selectedUsers, selectedDepartment, action);
      if (success) {
        setSelectedUsers([]);
        setSelectedDepartment('');
        onOpenChange(false);
      } else {
        setError('操作失败，请重试');
      }
    } catch (err) {
      setError('操作失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            批量管理部门成员
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div>
            <label className="text-sm font-medium mb-2 block">操作类型</label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={action === 'add' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setAction('add')}
                className="flex-1"
              >
                <UserPlus className="w-4 h-4 mr-2" />
                添加到部门
              </Button>
              <Button
                type="button"
                variant={action === 'remove' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setAction('remove')}
                className="flex-1"
              >
                <UserMinus className="w-4 h-4 mr-2" />
                从部门移除
              </Button>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">选择部门</label>
            <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
              <SelectTrigger>
                <SelectValue placeholder="请选择部门" />
              </SelectTrigger>
              <SelectContent>
                {departments.map(dept => (
                  <SelectItem key={dept.id} value={dept.id}>
                    <div className="flex items-center gap-2">
                      <Building2 className="w-4 h-4" />
                      {dept.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium">
                选择用户 ({selectedUsers.length}/{users.length})
              </label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleSelectAll}
              >
                {selectedUsers.length === users.length ? '取消全选' : '全选'}
              </Button>
            </div>
            
            <ScrollArea className="h-[300px] border rounded-lg p-2">
              <div className="space-y-2">
                {users.map(user => (
                  <div
                    key={user.id}
                    className="flex items-center space-x-3 p-2 rounded hover:bg-gray-50"
                  >
                    <Checkbox
                      checked={selectedUsers.includes(user.id)}
                      onCheckedChange={() => handleToggleUser(user.id)}
                    />
                    <div className="flex-1">
                      <div className="font-medium">{user.name}</div>
                      <div className="text-sm text-gray-500">{user.email}</div>
                      {user.department && (
                        <div className="text-xs text-gray-400">
                          当前部门：{user.department}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
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
            disabled={loading || selectedUsers.length === 0 || !selectedDepartment}
          >
            {loading ? '处理中...' : action === 'add' ? '添加到部门' : '从部门移除'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
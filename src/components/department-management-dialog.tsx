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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Building2, AlertCircle } from 'lucide-react';

interface Department {
  id: string;
  name: string;
  description?: string;
  parentId?: string | null;
  leaderId?: string;
}

interface User {
  id: string;
  name: string;
  email: string;
}

interface DepartmentManagementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  department?: Department | null;
  departments: Department[];
  users: User[];
  enterpriseId: string;
  onSave: (department: Partial<Department>) => Promise<boolean>;
  onDelete?: (departmentId: string) => Promise<boolean>;
}

export function DepartmentManagementDialog({
  open,
  onOpenChange,
  department,
  departments,
  users,
  enterpriseId,
  onSave,
  onDelete,
}: DepartmentManagementDialogProps) {
  const [formData, setFormData] = useState<Partial<Department>>({
    name: '',
    description: '',
    parentId: null,
    leaderId: undefined,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (department) {
      setFormData({
        name: department.name,
        description: department.description || '',
        parentId: department.parentId,
        leaderId: department.leaderId,
      });
    } else {
      setFormData({
        name: '',
        description: '',
        parentId: null,
        leaderId: undefined,
      });
    }
    setError('');
  }, [department, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name?.trim()) {
      setError('部门名称不能为空');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const success = await onSave({
        ...formData,
        id: department?.id,
      });

      if (success) {
        onOpenChange(false);
        setFormData({
          name: '',
          description: '',
          parentId: null,
          leaderId: undefined,
        });
      } else {
        setError('保存失败，请重试');
      }
    } catch (err) {
      setError('保存失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!department?.id || !onDelete) return;

    if (!confirm('确定要删除这个部门吗？此操作不可恢复。')) {
      return;
    }

    setLoading(true);
    setError('');

    try {
      const success = await onDelete(department.id);
      if (success) {
        onOpenChange(false);
      } else {
        setError('删除失败，请确保部门下没有子部门或成员');
      }
    } catch (err) {
      setError('删除失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  // 获取可选的父部门（排除自己及子部门）
  const getAvailableParents = () => {
    if (!department) return departments;
    
    // 递归获取所有子部门ID
    const getChildIds = (deptId: string): string[] => {
      const children = departments.filter(d => d.parentId === deptId);
      const childIds = children.map(c => c.id);
      children.forEach(child => {
        childIds.push(...getChildIds(child.id));
      });
      return childIds;
    };

    const excludeIds = [department.id, ...getChildIds(department.id)];
    return departments.filter(d => !excludeIds.includes(d.id));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="w-5 h-5" />
            {department ? '编辑部门' : '创建部门'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div>
              <Label htmlFor="name">部门名称 *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="请输入部门名称"
                disabled={loading}
                required
              />
            </div>

            <div>
              <Label htmlFor="description">部门描述</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="请输入部门描述"
                disabled={loading}
                rows={3}
              />
            </div>

            <div>
              <Label htmlFor="parentId">上级部门</Label>
              <Select
                value={formData.parentId || 'none'}
                onValueChange={(value) => 
                  setFormData({ ...formData, parentId: value === 'none' ? null : value })
                }
                disabled={loading}
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择上级部门" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">无（顶级部门）</SelectItem>
                  {getAvailableParents().map((dept) => (
                    <SelectItem key={dept.id} value={dept.id}>
                      {dept.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="leaderId">部门负责人</Label>
              <Select
                value={formData.leaderId || 'none'}
                onValueChange={(value) => 
                  setFormData({ ...formData, leaderId: value === 'none' ? undefined : value })
                }
                disabled={loading}
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择部门负责人" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">暂不指定</SelectItem>
                  {users.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.name} ({user.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="mt-6">
            {department && onDelete && (
              <Button
                type="button"
                variant="destructive"
                onClick={handleDelete}
                disabled={loading}
                className="mr-auto"
              >
                删除部门
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              取消
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? '保存中...' : '保存'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/components/ui/toast';
import {
  Plus,
  Shield,
  AlertCircle,
  CheckCircle,
  Search,
} from 'lucide-react';

interface Permission {
  key: string;
  name: string;
  description: string;
  category: string;
}

interface RoleCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  availablePermissions: Permission[];
  onCreateRole: (role: {
    key: string;
    name: string;
    description: string;
    permissions: string[];
  }) => Promise<boolean>;
}

export function RoleCreateDialog({
  open,
  onOpenChange,
  availablePermissions,
  onCreateRole,
}: RoleCreateDialogProps) {
  const { addToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState({
    key: '',
    name: '',
    description: '',
    permissions: [] as string[],
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  // 按类别分组权限
  const groupedPermissions = availablePermissions.reduce((acc, perm) => {
    if (!acc[perm.category]) {
      acc[perm.category] = [];
    }
    acc[perm.category].push(perm);
    return acc;
  }, {} as Record<string, Permission[]>);

  // 搜索过滤
  const filteredGroups = Object.entries(groupedPermissions).reduce((acc, [category, perms]) => {
    const filtered = perms.filter(p => 
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.key.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.description.toLowerCase().includes(searchTerm.toLowerCase())
    );
    if (filtered.length > 0) {
      acc[category] = filtered;
    }
    return acc;
  }, {} as Record<string, Permission[]>);

  const handleTogglePermission = (permKey: string) => {
    setFormData(prev => ({
      ...prev,
      permissions: prev.permissions.includes(permKey)
        ? prev.permissions.filter(p => p !== permKey)
        : [...prev.permissions, permKey]
    }));
  };

  const handleSelectAll = (category: string) => {
    const categoryPerms = groupedPermissions[category].map(p => p.key);
    const allSelected = categoryPerms.every(p => formData.permissions.includes(p));
    
    if (allSelected) {
      setFormData(prev => ({
        ...prev,
        permissions: prev.permissions.filter(p => !categoryPerms.includes(p))
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        permissions: [...new Set([...prev.permissions, ...categoryPerms])]
      }));
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.key.trim()) {
      newErrors.key = '请输入角色标识';
    } else if (!/^[a-z][a-z0-9_]*$/.test(formData.key)) {
      newErrors.key = '角色标识只能包含小写字母、数字和下划线，且以字母开头';
    }
    
    if (!formData.name.trim()) {
      newErrors.name = '请输入角色名称';
    }
    
    if (formData.permissions.length === 0) {
      newErrors.permissions = '请至少选择一个权限';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;
    
    setLoading(true);
    try {
      const success = await onCreateRole(formData);
      if (success) {
        addToast({
          type: 'success',
          title: '创建成功',
          description: `角色 "${formData.name}" 已创建`
        });
        // 重置表单
        setFormData({
          key: '',
          name: '',
          description: '',
          permissions: [],
        });
        setErrors({});
        setSearchTerm('');
        onOpenChange(false);
      } else {
        addToast({
          type: 'error',
          title: '创建失败',
          description: '请检查输入并重试'
        });
      }
    } catch (error) {
      addToast({
        type: 'error',
        title: '创建失败',
        description: '网络错误，请稍后重试'
      });
    } finally {
      setLoading(false);
    }
  };

  const getCategoryIcon = (category: string) => {
    return <Shield className="w-4 h-4 text-blue-500" />;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="w-5 h-5" />
            创建新角色
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* 基本信息 */}
          <div className="space-y-3">
            <div>
              <Label htmlFor="role-key">角色标识 *</Label>
              <Input
                id="role-key"
                placeholder="例如: custom_manager"
                value={formData.key}
                onChange={(e) => setFormData(prev => ({ ...prev, key: e.target.value }))}
                className={errors.key ? 'border-red-500' : ''}
              />
              {errors.key && (
                <p className="text-xs text-red-500 mt-1">{errors.key}</p>
              )}
              <p className="text-xs text-gray-500 mt-1">
                用于系统识别，创建后不可修改
              </p>
            </div>

            <div>
              <Label htmlFor="role-name">角色名称 *</Label>
              <Input
                id="role-name"
                placeholder="例如: 自定义管理员"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                className={errors.name ? 'border-red-500' : ''}
              />
              {errors.name && (
                <p className="text-xs text-red-500 mt-1">{errors.name}</p>
              )}
            </div>

            <div>
              <Label htmlFor="role-desc">角色描述</Label>
              <Textarea
                id="role-desc"
                placeholder="描述这个角色的职责和用途..."
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                rows={2}
              />
            </div>
          </div>

          {/* 权限选择 */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>权限配置 *</Label>
              <span className="text-sm text-gray-500">
                已选择 {formData.permissions.length} 个权限
              </span>
            </div>
            
            {errors.permissions && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{errors.permissions}</AlertDescription>
              </Alert>
            )}

            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <Input
                placeholder="搜索权限..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            <ScrollArea className="h-[250px] border rounded-lg p-3">
              <div className="space-y-4">
                {Object.entries(filteredGroups).map(([category, perms]) => (
                  <div key={category} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 font-medium text-sm">
                        {getCategoryIcon(category)}
                        <span>{category}</span>
                        <Badge variant="outline" className="text-xs">
                          {perms.filter(p => formData.permissions.includes(p.key)).length}/{perms.length}
                        </Badge>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleSelectAll(category)}
                      >
                        {perms.every(p => formData.permissions.includes(p.key)) ? '取消全选' : '全选'}
                      </Button>
                    </div>
                    
                    <div className="pl-6 space-y-1">
                      {perms.map((perm) => (
                        <div
                          key={perm.key}
                          className={`flex items-start gap-2 p-2 rounded hover:bg-gray-50 cursor-pointer ${
                            formData.permissions.includes(perm.key) ? 'bg-blue-50' : ''
                          }`}
                          onClick={() => handleTogglePermission(perm.key)}
                        >
                          <Checkbox
                            checked={formData.permissions.includes(perm.key)}
                            onCheckedChange={() => handleTogglePermission(perm.key)}
                          />
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
            disabled={loading}
          >
            {loading ? '创建中...' : '创建角色'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
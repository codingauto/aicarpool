'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Plus, 
  Building2, 
  Users, 
  ChevronRight, 
  ChevronDown,
  AlertCircle, 
  Edit,
  Trash2,
  DollarSign
} from 'lucide-react';

interface Department {
  id: string;
  name: string;
  description?: string;
  budgetLimit?: number;
  parentId?: string;
  parent?: {
    id: string;
    name: string;
  };
  children: Department[];
  groups: Array<{
    id: string;
    name: string;
    description?: string;
    maxMembers: number;
    status: string;
  }>;
  _count: {
    children: number;
    groups: number;
  };
}

interface Enterprise {
  id: string;
  name: string;
  planType: string;
}

interface OrganizationData {
  enterprise: Enterprise;
  departments: Department[];
  totalCount: number;
}

interface OrganizationStructureProps {
  enterpriseId: string;
  isAdmin: boolean;
}

export function OrganizationStructure({ enterpriseId, isAdmin }: OrganizationStructureProps) {
  const [organizationData, setOrganizationData] = useState<OrganizationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedDepartments, setExpandedDepartments] = useState<Set<string>>(new Set());
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editingDepartment, setEditingDepartment] = useState<Department | null>(null);

  // 新建/编辑部门表单状态
  const [departmentForm, setDepartmentForm] = useState({
    name: '',
    description: '',
    parentId: null as string | null,
    budgetLimit: ''
  });

  const fetchOrganizationData = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/enterprises/${enterpriseId}/departments`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();
      if (data.success) {
        setOrganizationData(data.data);
      } else {
        setError(data.error || '获取组织架构失败');
      }
    } catch (error) {
      console.error('获取组织架构失败:', error);
      setError('获取组织架构失败');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateDepartment = async () => {
    if (!isAdmin) return;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/enterprises/${enterpriseId}/departments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: departmentForm.name,
          description: departmentForm.description || undefined,
          parentId: departmentForm.parentId || undefined,
          budgetLimit: departmentForm.budgetLimit ? parseFloat(departmentForm.budgetLimit) : undefined
        }),
      });

      const data = await response.json();
      if (data.success) {
        await fetchOrganizationData();
        setCreateDialogOpen(false);
        resetForm();
        alert('部门创建成功');
      } else {
        alert(data.error || '创建部门失败');
      }
    } catch (error) {
      console.error('创建部门失败:', error);
      alert('创建部门失败');
    }
  };

  const handleUpdateDepartment = async () => {
    if (!isAdmin || !editingDepartment) return;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/enterprises/${enterpriseId}/departments?departmentId=${editingDepartment.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: departmentForm.name,
          description: departmentForm.description || undefined,
          parentId: departmentForm.parentId || undefined,
          budgetLimit: departmentForm.budgetLimit ? parseFloat(departmentForm.budgetLimit) : undefined
        }),
      });

      const data = await response.json();
      if (data.success) {
        await fetchOrganizationData();
        setEditingDepartment(null);
        resetForm();
        alert('部门更新成功');
      } else {
        alert(data.error || '更新部门失败');
      }
    } catch (error) {
      console.error('更新部门失败:', error);
      alert('更新部门失败');
    }
  };

  const handleDeleteDepartment = async (department: Department) => {
    if (!isAdmin) return;

    if (!confirm(`确定要删除部门"${department.name}"吗？`)) return;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/enterprises/${enterpriseId}/departments?departmentId=${department.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();
      if (data.success) {
        await fetchOrganizationData();
        alert('部门删除成功');
      } else {
        alert(data.error || '删除部门失败');
      }
    } catch (error) {
      console.error('删除部门失败:', error);
      alert('删除部门失败');
    }
  };

  const resetForm = () => {
    setDepartmentForm({
      name: '',
      description: '',
      parentId: null,
      budgetLimit: ''
    });
  };

  const openEditDialog = (department: Department) => {
    setEditingDepartment(department);
    setDepartmentForm({
      name: department.name,
      description: department.description || '',
      parentId: department.parentId,
      budgetLimit: department.budgetLimit?.toString() || ''
    });
  };

  const toggleDepartmentExpanded = (departmentId: string) => {
    const newExpanded = new Set(expandedDepartments);
    if (newExpanded.has(departmentId)) {
      newExpanded.delete(departmentId);
    } else {
      newExpanded.add(departmentId);
    }
    setExpandedDepartments(newExpanded);
  };

  const renderDepartment = (department: Department, level: number = 0) => {
    const hasChildren = department.children.length > 0;
    const isExpanded = expandedDepartments.has(department.id);

    return (
      <div key={department.id} className="space-y-2">
        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3" style={{ marginLeft: `${level * 24}px` }}>
                {hasChildren && (
                  <button
                    onClick={() => toggleDepartmentExpanded(department.id)}
                    className="p-1 hover:bg-gray-100 rounded"
                  >
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4" />
                    ) : (
                      <ChevronRight className="w-4 h-4" />
                    )}
                  </button>
                )}
                {!hasChildren && <div className="w-6" />}
                
                <Building2 className="w-5 h-5 text-blue-500" />
                <div>
                  <h3 className="font-medium">{department.name}</h3>
                  {department.description && (
                    <p className="text-sm text-gray-600">{department.description}</p>
                  )}
                </div>
              </div>

              <div className="flex items-center space-x-4">
                <div className="flex items-center gap-4 text-sm text-gray-600">
                  <div className="flex items-center gap-1">
                    <Users className="w-4 h-4" />
                    <span>{department._count.groups} 个组</span>
                  </div>
                  {department.budgetLimit && (
                    <div className="flex items-center gap-1">
                      <DollarSign className="w-4 h-4" />
                      <span>¥{department.budgetLimit.toLocaleString()}</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <Badge variant="outline">
                    {department._count.children} 子部门
                  </Badge>
                  
                  {isAdmin && (
                    <div className="flex gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openEditDialog(department)}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteDepartment(department)}
                        disabled={department._count.children > 0 || department._count.groups > 0}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* 显示关联的拼车组 */}
            {department.groups.length > 0 && (
              <div className="mt-4 pl-8">
                <div className="text-sm font-medium text-gray-700 mb-2">拼车组</div>
                <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
                  {department.groups.map(group => (
                    <div key={group.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                      <div>
                        <div className="font-medium text-sm">{group.name}</div>
                        <div className="text-xs text-gray-600">{group.maxMembers} 人上限</div>
                      </div>
                      <Badge variant={group.status === 'active' ? 'default' : 'secondary'}>
                        {group.status === 'active' ? '活跃' : '停用'}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 递归渲染子部门 */}
        {hasChildren && isExpanded && (
          <div className="space-y-2">
            {department.children.map(child => renderDepartment(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  const getAllDepartments = (departments: Department[]): Department[] => {
    const result: Department[] = [];
    const traverse = (depts: Department[]) => {
      depts.forEach(dept => {
        result.push(dept);
        if (dept.children.length > 0) {
          traverse(dept.children);
        }
      });
    };
    traverse(departments);
    return result;
  };

  useEffect(() => {
    fetchOrganizationData();
  }, [enterpriseId]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="text-center py-8">
          <div className="text-gray-500">加载中...</div>
        </div>
      </div>
    );
  }

  if (!organizationData) {
    return (
      <div className="space-y-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>加载企业组织架构失败</AlertDescription>
        </Alert>
      </div>
    );
  }

  const allDepartments = getAllDepartments(organizationData.departments);

  return (
    <div className="space-y-6">
      {/* 头部 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">组织架构</h2>
          <p className="text-gray-600">
            {organizationData.enterprise.name} - 管理企业部门和团队结构
          </p>
        </div>
        {isAdmin && (
          <Button onClick={() => setCreateDialogOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            创建部门
          </Button>
        )}
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* 统计信息 */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">总部门数</p>
                <p className="text-2xl font-bold">{organizationData.totalCount}</p>
              </div>
              <Building2 className="w-8 h-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">拼车组总数</p>
                <p className="text-2xl font-bold">
                  {allDepartments.reduce((sum, dept) => sum + dept._count.groups, 0)}
                </p>
              </div>
              <Users className="w-8 h-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">企业版本</p>
                <p className="text-2xl font-bold capitalize">{organizationData.enterprise.planType}</p>
              </div>
              <Badge className="text-lg px-3 py-1">
                {organizationData.enterprise.planType}
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 部门列表 */}
      <div className="space-y-4">
        {organizationData.departments.length > 0 ? (
          organizationData.departments.map(department => renderDepartment(department))
        ) : (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-8">
                <Building2 className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                <h3 className="text-lg font-medium mb-2">暂无部门</h3>
                <p className="text-gray-600 mb-4">
                  创建部门来组织和管理您的团队结构
                </p>
                {isAdmin && (
                  <Button onClick={() => setCreateDialogOpen(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    创建第一个部门
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* 创建/编辑部门对话框 */}
      <Dialog 
        open={createDialogOpen || !!editingDepartment} 
        onOpenChange={(open) => {
          if (!open) {
            setCreateDialogOpen(false);
            setEditingDepartment(null);
            resetForm();
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingDepartment ? '编辑部门' : '创建新部门'}
            </DialogTitle>
            <DialogDescription>
              {editingDepartment ? '修改部门信息' : '配置新部门的基本信息'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>部门名称</Label>
              <Input
                value={departmentForm.name}
                onChange={(e) => setDepartmentForm(prev => ({ ...prev, name: e.target.value }))}
                placeholder="输入部门名称"
              />
            </div>
            
            <div className="space-y-2">
              <Label>描述</Label>
              <Input
                value={departmentForm.description}
                onChange={(e) => setDepartmentForm(prev => ({ ...prev, description: e.target.value }))}
                placeholder="部门职能描述"
              />
            </div>

            <div className="space-y-2">
              <Label>上级部门</Label>
              <Select 
                value={departmentForm.parentId || 'none'} 
                onValueChange={(value) => setDepartmentForm(prev => ({ ...prev, parentId: value === 'none' ? null : value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择上级部门（可选）" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">无上级部门</SelectItem>
                  {allDepartments
                    .filter(dept => dept.id !== editingDepartment?.id) // 排除自己
                    .map(dept => (
                      <SelectItem key={dept.id} value={dept.id}>
                        {dept.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>预算限额（可选）</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={departmentForm.budgetLimit}
                onChange={(e) => setDepartmentForm(prev => ({ ...prev, budgetLimit: e.target.value }))}
                placeholder="输入预算限额"
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button 
                variant="outline" 
                onClick={() => {
                  setCreateDialogOpen(false);
                  setEditingDepartment(null);
                  resetForm();
                }}
              >
                取消
              </Button>
              <Button 
                onClick={editingDepartment ? handleUpdateDepartment : handleCreateDepartment}
                disabled={!departmentForm.name}
              >
                {editingDepartment ? '更新' : '创建'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
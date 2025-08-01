'use client';

import { useState, useEffect } from 'react';
import { EnterpriseDashboard } from '@/components/enterprise/EnterpriseDashboard';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Building2, Plus, AlertCircle, Edit, Trash2 } from 'lucide-react';

interface Enterprise {
  id: string;
  name: string;
  planType: string;
  departmentCount?: number;
  poolCount?: number;
  createdAt?: string;
}

export default function EnterprisePage() {
  const [enterprises, setEnterprises] = useState<Enterprise[]>([]);
  const [selectedEnterprise, setSelectedEnterprise] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editingEnterprise, setEditingEnterprise] = useState<Enterprise | null>(null);

  // 新建/编辑企业表单状态
  const [enterpriseForm, setEnterpriseForm] = useState({
    name: '',
    planType: 'basic',
    settings: {}
  });

  useEffect(() => {
    fetchEnterprises();
  }, []);

  const fetchEnterprises = async () => {
    try {
      const token = localStorage.getItem('token');
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      
      // 检查用户是否是管理员
      setIsAdmin(user.role === 'admin' || user.role === 'enterprise_admin');

      if (!token) {
        setError('请先登录');
        return;
      }

      // 从API获取企业列表
      const response = await fetch('/api/enterprises', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();
      
      if (data.success && data.data) {
        const enterpriseList = data.data.map((ent: any) => ({
          id: ent.id,
          name: ent.name,
          planType: ent.planType,
          departmentCount: ent._count?.departments || 0,
          poolCount: ent._count?.accountPools || 0,
          createdAt: ent.createdAt
        }));
        
        setEnterprises(enterpriseList);
        
        // 如果只有一个企业，自动选择
        if (enterpriseList.length === 1) {
          setSelectedEnterprise(enterpriseList[0].id);
        }
      } else {
        // 如果API返回失败，显示提示而不是硬编码数据
        setError(data.error || '获取企业列表失败');
        setEnterprises([]);
      }

    } catch (error) {
      console.error('获取企业列表失败:', error);
      setError('获取企业列表失败，请检查网络连接');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateEnterprise = async () => {
    if (!isAdmin) return;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/enterprises', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(enterpriseForm),
      });

      const data = await response.json();
      if (data.success) {
        await fetchEnterprises();
        setCreateDialogOpen(false);
        resetForm();
        alert('企业创建成功');
      } else {
        alert(data.error || '创建企业失败');
      }
    } catch (error) {
      console.error('创建企业失败:', error);
      alert('创建企业失败');
    }
  };

  const handleUpdateEnterprise = async () => {
    if (!isAdmin || !editingEnterprise) return;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/enterprises/${editingEnterprise.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(enterpriseForm),
      });

      const data = await response.json();
      if (data.success) {
        await fetchEnterprises();
        setEditingEnterprise(null);
        resetForm();
        alert('企业更新成功');
      } else {
        alert(data.error || '更新企业失败');
      }
    } catch (error) {
      console.error('更新企业失败:', error);
      alert('更新企业失败');
    }
  };

  const handleDeleteEnterprise = async (enterprise: Enterprise) => {
    if (!isAdmin) return;

    if (!confirm(`确定要删除企业"${enterprise.name}"吗？`)) return;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/enterprises/${enterprise.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();
      if (data.success) {
        await fetchEnterprises();
        alert('企业删除成功');
      } else {
        alert(data.error || '删除企业失败');
      }
    } catch (error) {
      console.error('删除企业失败:', error);
      alert('删除企业失败');
    }
  };

  const resetForm = () => {
    setEnterpriseForm({
      name: '',
      planType: 'basic',
      settings: {}
    });
  };

  const openEditDialog = (enterprise: Enterprise) => {
    setEditingEnterprise(enterprise);
    setEnterpriseForm({
      name: enterprise.name,
      planType: enterprise.planType,
      settings: {}
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-500">加载企业信息...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    );
  }

  // 如果用户已选择企业，显示企业控制面板
  if (selectedEnterprise) {
    return (
      <div className="container mx-auto px-4 py-8">
        <EnterpriseDashboard 
          enterpriseId={selectedEnterprise} 
          isAdmin={isAdmin} 
        />
      </div>
    );
  }

  // 显示企业选择界面
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="text-center flex-1">
            <h1 className="text-3xl font-bold mb-4">企业管理中心</h1>
            <p className="text-gray-600">选择要管理的企业以访问企业级功能</p>
          </div>
          {isAdmin && (
            <Button onClick={() => setCreateDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              创建企业
            </Button>
          )}
        </div>

        {enterprises.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-12">
                <Building2 className="w-16 h-16 mx-auto text-gray-400 mb-4" />
                <h3 className="text-xl font-medium mb-2">暂无企业</h3>
                <p className="text-gray-600 mb-6">
                  {isAdmin 
                    ? '开始创建您的第一个企业组织'
                    : '您还没有加入任何企业，请联系管理员添加您到企业中'
                  }
                </p>
                {isAdmin ? (
                  <Button onClick={() => setCreateDialogOpen(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    创建企业
                  </Button>
                ) : (
                  <div className="text-sm text-gray-500">
                    需要管理员权限才能创建企业
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 md:grid-cols-2">
            {enterprises.map((enterprise) => (
              <Card 
                key={enterprise.id} 
                className="hover:shadow-lg transition-shadow cursor-pointer"
                onClick={() => setSelectedEnterprise(enterprise.id)}
              >
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-3">
                      <Building2 className="w-6 h-6 text-blue-500" />
                      {enterprise.name}
                    </CardTitle>
                    <div className={`px-3 py-1 rounded-full text-xs font-medium ${
                      enterprise.planType === 'enterprise' 
                        ? 'bg-purple-100 text-purple-800'
                        : 'bg-blue-100 text-blue-800'
                    }`}>
                      {enterprise.planType === 'enterprise' ? '企业版' : '专业版'}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <CardDescription>
                    点击进入企业管理控制面板，管理组织架构、账号池、预算和权限等
                  </CardDescription>
                  
                  <div className="space-y-3">
                    {/* 统计信息 */}
                    <div className="flex gap-4 text-sm text-gray-600">
                      <span>部门: {enterprise.departmentCount || 0}</span>
                      <span>账号池: {enterprise.poolCount || 0}</span>
                    </div>
                    
                    <div className="flex items-center justify-between pt-2">
                      <div className="text-sm text-gray-500">
                        ID: {enterprise.id}
                      </div>
                      <div className="flex items-center gap-2">
                        {isAdmin && (
                          <>
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                openEditDialog(enterprise);
                              }}
                            >
                              <Edit className="w-4 h-4 mr-1" />
                              编辑
                            </Button>
                            <Button 
                              variant="destructive" 
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteEnterprise(enterprise);
                              }}
                              disabled={enterprise.departmentCount! > 0 || enterprise.poolCount! > 0}
                            >
                              <Trash2 className="w-4 h-4 mr-1" />
                              删除
                            </Button>
                          </>
                        )}
                        <Button variant="outline" size="sm">
                          进入管理
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {enterprises.length > 0 && (
          <div className="mt-8 text-center">
            <p className="text-sm text-gray-600">
              需要帮助？查看 <a href="/tutorial" className="text-blue-600 hover:underline">使用教程</a> 
              了解如何使用企业级功能
            </p>
          </div>
        )}

        {/* 创建/编辑企业对话框 */}
        <Dialog 
          open={createDialogOpen || !!editingEnterprise} 
          onOpenChange={(open) => {
            if (!open) {
              setCreateDialogOpen(false);
              setEditingEnterprise(null);
              resetForm();
            }
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingEnterprise ? '编辑企业' : '创建新企业'}
              </DialogTitle>
              <DialogDescription>
                {editingEnterprise ? '修改企业基本信息' : '创建一个新的企业组织'}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>企业名称</Label>
                <Input
                  value={enterpriseForm.name}
                  onChange={(e) => setEnterpriseForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="输入企业名称"
                />
              </div>
              
              <div className="space-y-2">
                <Label>企业版本</Label>
                <Select 
                  value={enterpriseForm.planType} 
                  onValueChange={(value) => setEnterpriseForm(prev => ({ ...prev, planType: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="basic">基础版</SelectItem>
                    <SelectItem value="enterprise">企业版</SelectItem>
                    <SelectItem value="custom">定制版</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex justify-end gap-2">
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setCreateDialogOpen(false);
                    setEditingEnterprise(null);
                    resetForm();
                  }}
                >
                  取消
                </Button>
                <Button 
                  onClick={editingEnterprise ? handleUpdateEnterprise : handleCreateEnterprise}
                  disabled={!enterpriseForm.name}
                >
                  {editingEnterprise ? '更新' : '创建'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { 
  Users, 
  Plus, 
  AlertCircle, 
  Edit, 
  Trash2, 
  Settings,
  ChevronLeft,
  Building2,
  DollarSign,
  Activity
} from 'lucide-react';

interface Group {
  id: string;
  name: string;
  description: string | null;
  maxMembers: number;
  status: string;
  enterpriseId: string | null;
  memberCount: number;
  resourceBinding?: {
    bindingMode: string;
    dailyTokenLimit: number;
    monthlyBudget: number | null;
  };
  usageStats?: {
    totalRequests: number;
    totalTokens: number;
    totalCost: number;
  };
  createdAt: string;
}

interface Enterprise {
  id: string;
  name: string;
  planType: string;
}

interface PageProps {
  params: Promise<{ enterpriseId: string }>;
}

export default function EnterpriseGroupsPage({ params }: PageProps) {
  const router = useRouter();
  const [groups, setGroups] = useState<Group[]>([]);
  const [enterprise, setEnterprise] = useState<Enterprise | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState<string | null>(null);
  const [enterpriseId, setEnterpriseId] = useState<string>('');

  useEffect(() => {
    params.then(resolvedParams => {
      setEnterpriseId(resolvedParams.enterpriseId);
      fetchEnterpriseAndGroups(resolvedParams.enterpriseId);
    });
  }, []);

  const fetchEnterpriseAndGroups = async (entId: string) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setError('请先登录');
        return;
      }

      // 获取企业信息
      const enterpriseResponse = await fetch(`/api/enterprises/${entId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!enterpriseResponse.ok) {
        if (enterpriseResponse.status === 404) {
          setError('企业不存在');
        } else if (enterpriseResponse.status === 403) {
          setError('您没有权限访问此企业');
        } else {
          setError('获取企业信息失败');
        }
        return;
      }

      const enterpriseData = await enterpriseResponse.json();
      if (enterpriseData.success) {
        setEnterprise(enterpriseData.data);
      }

      // 获取企业下的拼车组
      const groupsResponse = await fetch(`/api/enterprises/${entId}/groups`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (groupsResponse.ok) {
        const groupsData = await groupsResponse.json();
        if (groupsData.success) {
          setGroups(groupsData.data || []);
        } else {
          setError(groupsData.error || '获取拼车组列表失败');
        }
      } else {
        // API路由可能还不存在，先显示空列表
        setGroups([]);
      }

    } catch (error) {
      console.error('获取数据失败:', error);
      setError('获取数据失败，请检查网络连接');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteGroup = async (groupId: string) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/groups/${groupId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();
      if (data.success) {
        await fetchEnterpriseAndGroups(enterpriseId);
        setDeleteDialogOpen(null);
        alert('拼车组删除成功');
      } else {
        alert(data.error || '删除拼车组失败');
      }
    } catch (error) {
      console.error('删除拼车组失败:', error);
      alert('删除拼车组失败');
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge variant="default" className="bg-green-100 text-green-800">活跃</Badge>;
      case 'inactive':
        return <Badge variant="secondary">停用</Badge>;
      case 'archived':
        return <Badge variant="outline">已归档</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getBindingModeBadge = (mode?: string) => {
    if (!mode) return null;
    
    const config = {
      dedicated: { label: '专属', className: 'bg-purple-100 text-purple-800' },
      shared: { label: '共享', className: 'bg-blue-100 text-blue-800' },
      hybrid: { label: '混合', className: 'bg-orange-100 text-orange-800' }
    }[mode] || { label: mode, className: 'bg-gray-100 text-gray-800' };

    return <Badge className={config.className}>{config.label}</Badge>;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-500">加载企业拼车组...</div>
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

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-6xl mx-auto">
        {/* 面包屑和标题 */}
        <div className="flex items-center gap-4 mb-6">
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => router.push('/enterprise')}
          >
            <ChevronLeft className="w-4 h-4 mr-2" />
            返回企业管理
          </Button>
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Building2 className="w-4 h-4" />
            <span>{enterprise?.name || '未知企业'}</span>
            <span>/</span>
            <span>拼车组管理</span>
          </div>
        </div>

        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-2">拼车组管理</h1>
            <p className="text-gray-600">
              管理企业下的拼车组，配置资源绑定和使用配额
            </p>
          </div>
          <Button 
            onClick={() => router.push(`/enterprise/${enterpriseId}/groups/create`)}
          >
            <Plus className="w-4 h-4 mr-2" />
            创建拼车组
          </Button>
        </div>

        {/* 统计概览 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Users className="w-8 h-8 text-blue-500" />
                <div>
                  <p className="text-sm text-gray-600">总拼车组数</p>
                  <p className="text-2xl font-bold">{groups.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Activity className="w-8 h-8 text-green-500" />
                <div>
                  <p className="text-sm text-gray-600">活跃拼车组</p>
                  <p className="text-2xl font-bold">
                    {groups.filter(g => g.status === 'active').length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <DollarSign className="w-8 h-8 text-orange-500" />
                <div>
                  <p className="text-sm text-gray-600">总成员数</p>
                  <p className="text-2xl font-bold">
                    {groups.reduce((sum, g) => sum + (g.memberCount || 0), 0)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {groups.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-12">
                <Users className="w-16 h-16 mx-auto text-gray-400 mb-4" />
                <h3 className="text-xl font-medium mb-2">暂无拼车组</h3>
                <p className="text-gray-600 mb-6">
                  这个企业下还没有创建任何拼车组，开始创建您的第一个拼车组
                </p>
                <Button 
                  onClick={() => router.push(`/enterprise/${enterpriseId}/groups/create`)}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  创建拼车组
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6">
            {groups.map((group) => (
              <Card key={group.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <CardTitle className="flex items-center gap-3">
                        <Users className="w-6 h-6 text-blue-500" />
                        {group.name}
                      </CardTitle>
                      {getStatusBadge(group.status)}
                      {getBindingModeBadge(group.resourceBinding?.bindingMode)}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => router.push(`/enterprise/${enterpriseId}/groups/${group.id}`)}
                      >
                        <Settings className="w-4 h-4 mr-1" />
                        配置
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => router.push(`/groups/${group.id}`)}
                      >
                        查看详情
                      </Button>
                      <Button 
                        variant="destructive" 
                        size="sm"
                        onClick={() => setDeleteDialogOpen(group.id)}
                      >
                        <Trash2 className="w-4 h-4 mr-1" />
                        删除
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <CardDescription>
                    {group.description || '暂无描述'}
                  </CardDescription>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600">成员数:</span>
                      <span className="ml-2 font-medium">
                        {group.memberCount || 0} / {group.maxMembers}
                      </span>
                    </div>
                    
                    <div>
                      <span className="text-gray-600">日用量限制:</span>
                      <span className="ml-2 font-medium">
                        {group.resourceBinding?.dailyTokenLimit?.toLocaleString() || '--'} tokens
                      </span>
                    </div>
                    
                    <div>
                      <span className="text-gray-600">月预算:</span>
                      <span className="ml-2 font-medium">
                        ${group.resourceBinding?.monthlyBudget || '--'}
                      </span>
                    </div>
                    
                    <div>
                      <span className="text-gray-600">创建时间:</span>
                      <span className="ml-2 font-medium">
                        {new Date(group.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  {group.usageStats && (
                    <div className="border-t pt-4">
                      <h4 className="font-medium mb-2">使用统计</h4>
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <span className="text-gray-600">总请求:</span>
                          <span className="ml-2 font-medium">{group.usageStats.totalRequests}</span>
                        </div>
                        <div>
                          <span className="text-gray-600">总Token:</span>
                          <span className="ml-2 font-medium">{group.usageStats.totalTokens?.toLocaleString()}</span>
                        </div>
                        <div>
                          <span className="text-gray-600">总成本:</span>
                          <span className="ml-2 font-medium">${group.usageStats.totalCost?.toFixed(2)}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* 删除确认对话框 */}
        <Dialog 
          open={!!deleteDialogOpen} 
          onOpenChange={(open) => !open && setDeleteDialogOpen(null)}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>确认删除拼车组</DialogTitle>
              <DialogDescription>
                此操作不可逆，删除后所有相关数据将无法恢复。确定要删除这个拼车组吗？
              </DialogDescription>
            </DialogHeader>
            <div className="flex justify-end gap-2 mt-4">
              <Button 
                variant="outline" 
                onClick={() => setDeleteDialogOpen(null)}
              >
                取消
              </Button>
              <Button 
                variant="destructive" 
                onClick={() => deleteDialogOpen && handleDeleteGroup(deleteDialogOpen)}
              >
                确认删除
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
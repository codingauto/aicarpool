'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { 
  ChevronLeft, 
  Building2, 
  Users, 
  Settings, 
  DollarSign,
  AlertCircle,
  Edit,
  Activity,
  Database,
  TrendingUp,
  Shield,
  Save
} from 'lucide-react';

interface Group {
  id: string;
  name: string;
  description: string | null;
  maxMembers: number;
  status: string;
  enterpriseId: string | null;
  memberCount: number;
  createdAt: string;
  resourceBinding?: GroupResourceBinding;
  members?: GroupMember[];
  usageStats?: UsageStat[];
}

interface GroupResourceBinding {
  id: string;
  bindingMode: string;
  bindingConfig: any;
  dailyTokenLimit: number;
  monthlyBudget: number | null;
  priorityLevel: string;
  warningThreshold: number;
  alertThreshold: number;
}

interface GroupMember {
  id: string;
  userId: string;
  role: string;
  joinedAt: string;
  user: {
    name: string;
    email: string;
  };
}

interface UsageStat {
  id: string;
  serviceType: string;
  totalTokens: number;
  cost: number;
  requestTime: string;
}

interface Enterprise {
  id: string;
  name: string;
  planType: string;
}

interface AiServiceAccount {
  id: string;
  name: string;
  serviceType: string;
  accountType: string;
  isEnabled: boolean;
  status: string;
}

interface PageProps {
  params: Promise<{ enterpriseId: string; groupId: string }>;
}

export default function EnterpriseGroupDetailPage({ params }: PageProps) {
  const router = useRouter();
  const [group, setGroup] = useState<Group | null>(null);
  const [enterprise, setEnterprise] = useState<Enterprise | null>(null);
  const [availableAccounts, setAvailableAccounts] = useState<AiServiceAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [enterpriseId, setEnterpriseId] = useState<string>('');
  const [groupId, setGroupId] = useState<string>('');

  // 编辑表单状态
  const [editForm, setEditForm] = useState({
    name: '',
    description: '',
    maxMembers: 5,
    bindingMode: 'shared' as 'dedicated' | 'shared' | 'hybrid',
    dailyTokenLimit: 10000,
    monthlyBudget: 100,
    priorityLevel: 'medium' as 'high' | 'medium' | 'low',
    warningThreshold: 80,
    alertThreshold: 95
  });

  useEffect(() => {
    params.then(resolvedParams => {
      setEnterpriseId(resolvedParams.enterpriseId);
      setGroupId(resolvedParams.groupId);
      fetchData(resolvedParams.enterpriseId, resolvedParams.groupId);
    });
  }, []);

  const fetchData = async (entId: string, grpId: string) => {
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

      if (enterpriseResponse.ok) {
        const enterpriseData = await enterpriseResponse.json();
        if (enterpriseData.success) {
          setEnterprise(enterpriseData.data);
        }
      }

      // 获取拼车组详情
      const groupResponse = await fetch(`/api/groups/${grpId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!groupResponse.ok) {
        setError('获取拼车组信息失败');
        return;
      }

      const groupData = await groupResponse.json();
      if (groupData.success) {
        const groupInfo = groupData.data;
        setGroup(groupInfo);
        
        // 初始化编辑表单
        setEditForm({
          name: groupInfo.name,
          description: groupInfo.description || '',
          maxMembers: groupInfo.maxMembers,
          bindingMode: groupInfo.resourceBinding?.bindingMode || 'shared',
          dailyTokenLimit: groupInfo.resourceBinding?.dailyTokenLimit || 10000,
          monthlyBudget: groupInfo.resourceBinding?.monthlyBudget || 100,
          priorityLevel: groupInfo.resourceBinding?.priorityLevel || 'medium',
          warningThreshold: groupInfo.resourceBinding?.warningThreshold || 80,
          alertThreshold: groupInfo.resourceBinding?.alertThreshold || 95
        });
      } else {
        setError(groupData.error || '获取拼车组信息失败');
      }

      // 获取可用的AI账号
      const accountsResponse = await fetch(`/api/enterprises/${entId}/ai-accounts`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (accountsResponse.ok) {
        const accountsData = await accountsResponse.json();
        if (accountsData.success) {
          setAvailableAccounts(accountsData.data || []);
        }
      }

    } catch (error) {
      console.error('获取数据失败:', error);
      setError('获取数据失败，请检查网络连接');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveChanges = async () => {
    setSaving(true);
    try {
      const token = localStorage.getItem('token');

      // 更新基本信息
      const groupUpdateResponse = await fetch(`/api/groups/${groupId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: editForm.name,
          description: editForm.description || null,
          maxMembers: editForm.maxMembers
        })
      });

      if (!groupUpdateResponse.ok) {
        throw new Error('更新拼车组基本信息失败');
      }

      // 更新资源绑定配置
      const bindingResponse = await fetch(`/api/groups/${groupId}/resource-binding`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          bindingMode: editForm.bindingMode,
          bindingConfig: {}, // 简化版本，实际应根据模式配置
          dailyTokenLimit: editForm.dailyTokenLimit,
          monthlyBudget: editForm.monthlyBudget,
          priorityLevel: editForm.priorityLevel,
          warningThreshold: editForm.warningThreshold,
          alertThreshold: editForm.alertThreshold
        })
      });

      if (!bindingResponse.ok) {
        console.warn('更新资源绑定配置失败');
      }

      // 重新获取数据
      await fetchData(enterpriseId, groupId);
      setEditDialogOpen(false);
      alert('保存成功');

    } catch (error) {
      console.error('保存失败:', error);
      alert(error instanceof Error ? error.message : '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-100 text-green-800">活跃</Badge>;
      case 'inactive':
        return <Badge variant="secondary">停用</Badge>;
      case 'archived':
        return <Badge variant="outline">已归档</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getBindingModeBadge = (mode: string) => {
    const config = {
      dedicated: { label: '专属', className: 'bg-purple-100 text-purple-800' },
      shared: { label: '共享', className: 'bg-blue-100 text-blue-800' },
      hybrid: { label: '混合', className: 'bg-orange-100 text-orange-800' }
    }[mode] || { label: mode, className: 'bg-gray-100 text-gray-800' };

    return <Badge className={config.className}>{config.label}</Badge>;
  };

  const getPriorityBadge = (priority: string) => {
    const config = {
      high: { label: '高', className: 'bg-red-100 text-red-800' },
      medium: { label: '中', className: 'bg-yellow-100 text-yellow-800' },
      low: { label: '低', className: 'bg-gray-100 text-gray-800' }
    }[priority] || { label: priority, className: 'bg-gray-100 text-gray-800' };

    return <Badge className={config.className}>{config.label}</Badge>;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-500">加载拼车组详情...</div>
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

  if (!group) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>拼车组不存在</AlertDescription>
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
            onClick={() => router.push(`/enterprise/${enterpriseId}/groups`)}
          >
            <ChevronLeft className="w-4 h-4 mr-2" />
            返回拼车组列表
          </Button>
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Building2 className="w-4 h-4" />
            <span>{enterprise?.name || '未知企业'}</span>
            <span>/</span>
            <span>拼车组管理</span>
            <span>/</span>
            <span>{group.name}</span>
          </div>
        </div>

        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <div>
              <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
                <Users className="w-8 h-8 text-blue-500" />
                {group.name}
              </h1>
              <p className="text-gray-600">
                {group.description || '暂无描述'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {getStatusBadge(group.status)}
              {group.resourceBinding && getBindingModeBadge(group.resourceBinding.bindingMode)}
              {group.resourceBinding && getPriorityBadge(group.resourceBinding.priorityLevel)}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              variant="outline"
              onClick={() => setEditDialogOpen(true)}
            >
              <Edit className="w-4 h-4 mr-2" />
              编辑配置
            </Button>
            <Button 
              onClick={() => router.push(`/groups/${group.id}`)}
            >
              查看用户视角
            </Button>
          </div>
        </div>

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList>
            <TabsTrigger value="overview" className="flex items-center gap-2">
              <Activity className="w-4 h-4" />
              概览
            </TabsTrigger>
            <TabsTrigger value="resources" className="flex items-center gap-2">
              <Database className="w-4 h-4" />
              资源配置
            </TabsTrigger>
            <TabsTrigger value="members" className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              成员管理
            </TabsTrigger>
            <TabsTrigger value="usage" className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              使用统计
            </TabsTrigger>
            <TabsTrigger value="permissions" className="flex items-center gap-2">
              <Shield className="w-4 h-4" />
              权限设置
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="w-5 h-5" />
                    成员信息
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span>当前成员:</span>
                      <span className="font-medium">{group.memberCount || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>最大成员:</span>
                      <span className="font-medium">{group.maxMembers}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>使用率:</span>
                      <span className="font-medium">
                        {((group.memberCount || 0) / group.maxMembers * 100).toFixed(1)}%
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Settings className="w-5 h-5" />
                    资源配置
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span>绑定模式:</span>
                      <span>{group.resourceBinding?.bindingMode || '未配置'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>日限制:</span>
                      <span>{group.resourceBinding?.dailyTokenLimit?.toLocaleString() || '--'} tokens</span>
                    </div>
                    <div className="flex justify-between">
                      <span>月预算:</span>
                      <span>${group.resourceBinding?.monthlyBudget || '--'}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <DollarSign className="w-5 h-5" />
                    使用统计
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span>总请求:</span>
                      <span className="font-medium">
                        {group.usageStats?.length || 0}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>总成本:</span>
                      <span className="font-medium">
                        ${group.usageStats?.reduce((sum, stat) => sum + stat.cost, 0).toFixed(2) || '0.00'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>创建时间:</span>
                      <span className="font-medium">
                        {new Date(group.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="resources">
            <Card>
              <CardHeader>
                <CardTitle>资源绑定配置</CardTitle>
                <CardDescription>
                  配置拼车组如何使用企业的AI资源
                </CardDescription>
              </CardHeader>
              <CardContent>
                {group.resourceBinding ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>绑定模式</Label>
                        <p className="text-sm text-gray-600 mt-1">
                          {getBindingModeBadge(group.resourceBinding.bindingMode)}
                        </p>
                      </div>
                      <div>
                        <Label>优先级</Label>
                        <p className="text-sm text-gray-600 mt-1">
                          {getPriorityBadge(group.resourceBinding.priorityLevel)}
                        </p>
                      </div>
                    </div>
                    
                    <Separator />
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>日Token限制</Label>
                        <p className="text-lg font-medium">
                          {group.resourceBinding.dailyTokenLimit.toLocaleString()} tokens
                        </p>
                      </div>
                      <div>
                        <Label>月预算</Label>
                        <p className="text-lg font-medium">
                          ${group.resourceBinding.monthlyBudget}
                        </p>
                      </div>
                    </div>
                    
                    <Separator />
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>预警阈值</Label>
                        <p className="text-lg font-medium">
                          {group.resourceBinding.warningThreshold}%
                        </p>
                      </div>
                      <div>
                        <Label>告警阈值</Label>
                        <p className="text-lg font-medium">
                          {group.resourceBinding.alertThreshold}%
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      此拼车组尚未配置资源绑定，点击"编辑配置"按钮进行设置。
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="members">
            <Card>
              <CardHeader>
                <CardTitle>成员管理</CardTitle>
                <CardDescription>
                  管理拼车组成员和权限
                </CardDescription>
              </CardHeader>
              <CardContent>
                {group.members && group.members.length > 0 ? (
                  <div className="space-y-4">
                    {group.members.map((member) => (
                      <div key={member.id} className="flex items-center justify-between p-4 border rounded-lg">
                        <div>
                          <p className="font-medium">{member.user.name}</p>
                          <p className="text-sm text-gray-600">{member.user.email}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={member.role === 'admin' ? 'default' : 'secondary'}>
                            {member.role === 'admin' ? '管理员' : '成员'}
                          </Badge>
                          <p className="text-sm text-gray-600">
                            {new Date(member.joinedAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <Alert>
                    <Users className="h-4 w-4" />
                    <AlertDescription>
                      此拼车组暂无成员
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="usage">
            <Card>
              <CardHeader>
                <CardTitle>使用统计</CardTitle>
                <CardDescription>
                  查看拼车组的AI服务使用情况
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Alert>
                  <TrendingUp className="h-4 w-4" />
                  <AlertDescription>
                    使用统计功能正在开发中，将显示详细的使用报表和趋势分析。
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="permissions">
            <Card>
              <CardHeader>
                <CardTitle>权限设置</CardTitle>
                <CardDescription>
                  配置拼车组的访问权限和安全设置
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Alert>
                  <Shield className="h-4 w-4" />
                  <AlertDescription>
                    权限设置功能正在开发中，将提供细粒度的权限控制。
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* 编辑配置对话框 */}
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>编辑拼车组配置</DialogTitle>
              <DialogDescription>
                修改拼车组的基本信息和资源配置
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>拼车组名称</Label>
                  <Input
                    value={editForm.name}
                    onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>最大成员数</Label>
                  <Input
                    type="number"
                    min="1"
                    max="50"
                    value={editForm.maxMembers}
                    onChange={(e) => setEditForm(prev => ({ ...prev, maxMembers: parseInt(e.target.value) || 5 }))}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>描述</Label>
                <Input
                  value={editForm.description}
                  onChange={(e) => setEditForm(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="拼车组描述"
                />
              </div>

              <Separator />

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>绑定模式</Label>
                  <Select 
                    value={editForm.bindingMode} 
                    onValueChange={(value: 'dedicated' | 'shared' | 'hybrid') => 
                      setEditForm(prev => ({ ...prev, bindingMode: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="dedicated">专属模式</SelectItem>
                      <SelectItem value="shared">共享模式</SelectItem>
                      <SelectItem value="hybrid">混合模式</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>优先级</Label>
                  <Select 
                    value={editForm.priorityLevel} 
                    onValueChange={(value: 'high' | 'medium' | 'low') => 
                      setEditForm(prev => ({ ...prev, priorityLevel: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="high">高优先级</SelectItem>
                      <SelectItem value="medium">中优先级</SelectItem>
                      <SelectItem value="low">低优先级</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>日Token限制</Label>
                  <Input
                    type="number"
                    min="1000"
                    value={editForm.dailyTokenLimit}
                    onChange={(e) => setEditForm(prev => ({ ...prev, dailyTokenLimit: parseInt(e.target.value) || 10000 }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>月预算（美元）</Label>
                  <Input
                    type="number"
                    min="10"
                    value={editForm.monthlyBudget}
                    onChange={(e) => setEditForm(prev => ({ ...prev, monthlyBudget: parseInt(e.target.value) || 100 }))}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>预警阈值（%）</Label>
                  <Input
                    type="number"
                    min="50"
                    max="100"
                    value={editForm.warningThreshold}
                    onChange={(e) => setEditForm(prev => ({ ...prev, warningThreshold: parseInt(e.target.value) || 80 }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>告警阈值（%）</Label>
                  <Input
                    type="number"
                    min="50"
                    max="100"
                    value={editForm.alertThreshold}
                    onChange={(e) => setEditForm(prev => ({ ...prev, alertThreshold: parseInt(e.target.value) || 95 }))}
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <Button 
                variant="outline" 
                onClick={() => setEditDialogOpen(false)}
                disabled={saving}
              >
                取消
              </Button>
              <Button 
                onClick={handleSaveChanges}
                disabled={saving || !editForm.name.trim()}
              >
                <Save className="w-4 h-4 mr-2" />
                {saving ? '保存中...' : '保存更改'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
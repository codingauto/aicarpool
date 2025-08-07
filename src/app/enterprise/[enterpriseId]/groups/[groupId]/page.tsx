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
  Save,
  Link,
  Unlink,
  AlertTriangle,
  Plus,
  Key
} from 'lucide-react';
import AccountSelector from '@/components/account/AccountSelector';
import { MemberManagement } from '@/components/groups/MemberManagement';
import { ApiKeyManagement } from '@/components/groups/ApiKeyManagement';

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
  // 当前绑定的AI账号信息
  boundAccountId?: string;
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
    id: string;
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
  description?: string;
  serviceType: string;
  accountType: string;
  isEnabled: boolean;
  status: string;
  currentLoad?: number;
  supportedModels?: string[];
  currentModel?: string;
  createdAt?: string;
  lastUsedAt?: string;
  // 绑定状态
  isBound?: boolean;
  boundToGroupId?: string;
  boundToGroupName?: string;
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
  const [accountSelectionOpen, setAccountSelectionOpen] = useState(false);
  const [unbindConfirmOpen, setUnbindConfirmOpen] = useState(false);
  const [enterpriseId, setEnterpriseId] = useState<string>('');
  const [groupId, setGroupId] = useState<string>('');
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [bindingAccount, setBindingAccount] = useState(false);
  const [unbindingAccount, setUnbindingAccount] = useState(false);
  
  // 用户和权限状态
  const [currentUser, setCurrentUser] = useState<{ id: string; name: string; email: string } | null>(null);
  const [canManageMembers, setCanManageMembers] = useState(false);
  
  const [activeTab, setActiveTab] = useState('overview');

  // 编辑表单状态
  const [editForm, setEditForm] = useState({
    name: '',
    description: '',
    maxMembers: 5,
    bindingMode: 'dedicated' as 'dedicated', // 只支持专属模式
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

  // 当group和currentUser都加载完成后，更新权限状态
  useEffect(() => {
    if (group && currentUser) {
      const userMember = group.members?.find(m => m.user.id === currentUser.id);
      setCanManageMembers(userMember?.role === 'admin' || userMember?.role === 'owner');
    }
  }, [group, currentUser]);

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

      // 获取可用的AI账号（包含绑定状态）
      await fetchAvailableAccounts(entId);
      
      // 获取当前用户信息
      await fetchCurrentUser();

    } catch (error) {
      console.error('获取数据失败:', error);
      setError('获取数据失败，请检查网络连接');
    } finally {
      setLoading(false);
    }
  };

  const fetchCurrentUser = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/auth/me', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const userData = await response.json();
        if (userData.success) {
          setCurrentUser(userData.data);
        }
      }
    } catch (error) {
      console.error('获取用户信息失败:', error);
    }
  };

  const fetchAvailableAccounts = async (entId: string) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/enterprises/${entId}/ai-accounts/available`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const accountsData = await response.json();
        if (accountsData.success) {
          // 处理API返回的数据格式
          const accounts = accountsData.data.accounts || [];
          setAvailableAccounts(accounts);
          console.log('获取到AI账号:', accounts.length, '个');
        } else {
          console.error('获取可用账号失败:', accountsData.message);
        }
      } else {
        console.error('API请求失败:', response.status, response.statusText);
      }
    } catch (error) {
      console.error('获取可用账号失败:', error);
    }
  };

  const handleBindAccount = async () => {
    if (!selectedAccountId) return;
    
    setBindingAccount(true);
    try {
      const token = localStorage.getItem('token');
      
      // 1. 检查是否存在资源绑定配置（基于当前group数据）
      const hasResourceBinding = !!group?.resourceBinding;
      
      // 2. 创建或更新资源绑定配置
      const resourceBindingResponse = await fetch(`/api/groups/${groupId}/resource-binding`, {
        method: hasResourceBinding ? 'PUT' : 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          bindingMode: 'dedicated',
          dailyTokenLimit: group?.resourceBinding?.dailyTokenLimit || 50000,
          monthlyBudget: group?.resourceBinding?.monthlyBudget || 200,
          priorityLevel: group?.resourceBinding?.priorityLevel || 'medium',
          warningThreshold: group?.resourceBinding?.warningThreshold || 80,
          alertThreshold: group?.resourceBinding?.alertThreshold || 95,
          config: {
            dedicatedAccounts: [selectedAccountId]
          }
        })
      });

      const resourceData = await resourceBindingResponse.json();
      if (!resourceData.success) {
        throw new Error(resourceData.error || '资源绑定配置失败');
      }

      // 2. 刷新数据
      await fetchData(enterpriseId, groupId);
      await fetchAvailableAccounts(enterpriseId);
      setAccountSelectionOpen(false);
      setSelectedAccountId('');
      alert('账号绑定成功！');
      
    } catch (error) {
      console.error('绑定账号失败:', error);
      alert(error instanceof Error ? error.message : '绑定账号失败');
    } finally {
      setBindingAccount(false);
    }
  };

  const handleUnbindAccount = async () => {
    setUnbindingAccount(true);
    try {
      const token = localStorage.getItem('token');
      
      // 1. 通过将专用账号配置设为空数组来解绑账号
      const resourceBindingResponse = await fetch(`/api/groups/${groupId}/resource-binding`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          bindingMode: 'dedicated',
          dailyTokenLimit: group?.resourceBinding?.dailyTokenLimit || 50000,
          monthlyBudget: group?.resourceBinding?.monthlyBudget || 200,
          priorityLevel: group?.resourceBinding?.priorityLevel || 'medium',
          warningThreshold: group?.resourceBinding?.warningThreshold || 80,
          alertThreshold: group?.resourceBinding?.alertThreshold || 95,
          config: {
            dedicatedAccounts: [] // 清空专用账号配置
          }
        })
      });

      const resourceData = await resourceBindingResponse.json();
      if (resourceData.success) {
        await fetchData(enterpriseId, groupId);
        await fetchAvailableAccounts(enterpriseId);
        setUnbindConfirmOpen(false);
        alert('账号解绑成功！');
      } else {
        alert(resourceData.error || '解绑账号失败');
      }
    } catch (error) {
      console.error('解绑账号失败:', error);
      alert('解绑账号失败');
    } finally {
      setUnbindingAccount(false);
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

  const getServiceTypeIcon = (serviceType: string) => {
    switch (serviceType.toLowerCase()) {
      case 'claude':
        return '🤖';
      case 'openai':
      case 'gpt':
        return '🧠';
      case 'gemini':
        return '💎';
      default:
        return '🔮';
    }
  };

  const getAccountStatusBadge = (status: string, isEnabled: boolean) => {
    if (!isEnabled) {
      return <Badge variant="secondary" className="text-gray-600">已禁用</Badge>;
    }
    
    switch (status) {
      case 'healthy':
        return <Badge className="bg-green-100 text-green-800">健康</Badge>;
      case 'warning':
        return <Badge className="bg-yellow-100 text-yellow-800">警告</Badge>;
      case 'error':
        return <Badge className="bg-red-100 text-red-800">错误</Badge>;
      case 'maintenance':
        return <Badge variant="outline">维护中</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };


  const getBoundAccount = () => {
    if (!group || !group.resourceBinding) return null;
    
    // 从资源绑定配置中获取专用账号ID
    const dedicatedAccounts = group.resourceBinding.bindingConfig?.dedicatedAccounts || [];
    if (dedicatedAccounts.length === 0) return null;
    
    // 在可用账号列表中查找对应的账号信息
    const boundAccountId = dedicatedAccounts[0]; // 专属模式通常只有一个账号
    return availableAccounts.find(account => account.id === boundAccountId);
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
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
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
            <TabsTrigger value="api-keys" className="flex items-center gap-2">
              <Key className="w-4 h-4" />
              API密钥
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
            <div className="space-y-6">
              {/* AI账号绑定卡片 */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Link className="w-5 h-5" />
                        AI账号绑定
                      </CardTitle>
                      <CardDescription>
                        拼车组专属AI账号绑定（一对一绑定）
                      </CardDescription>
                    </div>
                    {!getBoundAccount() && (
                      <Button onClick={() => setAccountSelectionOpen(true)}>
                        <Plus className="w-4 h-4 mr-2" />
                        绑定账号
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {getBoundAccount() ? (
                    <div className="border rounded-lg p-4 bg-blue-50">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className="text-2xl">
                            {getServiceTypeIcon(getBoundAccount()!.serviceType)}
                          </div>
                          <div>
                            <h4 className="font-medium text-lg">{getBoundAccount()!.name}</h4>
                            <p className="text-sm text-gray-600 mt-1">
                              {getBoundAccount()!.description || '暂无描述'}
                            </p>
                            <div className="flex items-center gap-2 mt-2">
                              {getAccountStatusBadge(getBoundAccount()!.status, getBoundAccount()!.isEnabled)}
                              <Badge variant="outline">
                                {getBoundAccount()!.serviceType.toUpperCase()}
                              </Badge>
                              {getBoundAccount()!.currentModel && (
                                <Badge variant="secondary">
                                  {getBoundAccount()!.currentModel}
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button variant="outline" size="sm">
                            <Settings className="w-4 h-4 mr-1" />
                            详情
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => setUnbindConfirmOpen(true)}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <Unlink className="w-4 h-4 mr-1" />
                            解绑
                          </Button>
                        </div>
                      </div>
                      
                      {/* 账号负载和性能指标 */}
                      {getBoundAccount()!.currentLoad !== undefined && (
                        <div className="mt-4 grid grid-cols-3 gap-4">
                          <div className="text-center">
                            <div className="text-sm text-gray-600">当前负载</div>
                            <div className="text-lg font-semibold text-blue-600">
                              {getBoundAccount()!.currentLoad}%
                            </div>
                          </div>
                          <div className="text-center">
                            <div className="text-sm text-gray-600">绑定时间</div>
                            <div className="text-sm font-medium">
                              {group.createdAt ? new Date(group.createdAt).toLocaleDateString() : '--'}
                            </div>
                          </div>
                          <div className="text-center">
                            <div className="text-sm text-gray-600">最后使用</div>
                            <div className="text-sm font-medium">
                              {getBoundAccount()!.lastUsedAt ? new Date(getBoundAccount()!.lastUsedAt!).toLocaleDateString() : '--'}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <Alert>
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>
                        此拼车组尚未绑定AI账号。请点击"绑定账号"按钮选择一个专属AI账号。
                      </AlertDescription>
                    </Alert>
                  )}
                </CardContent>
              </Card>

              {/* 资源配置卡片 */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Settings className="w-5 h-5" />
                    资源配置
                  </CardTitle>
                  <CardDescription>
                    配置拼车组的资源使用限制和告警阈值
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {group.resourceBinding ? (
                    <div className="space-y-6">
                      <div className="grid grid-cols-2 gap-6">
                        <div>
                          <Label className="text-sm font-medium text-gray-700">绑定模式</Label>
                          <div className="mt-1">
                            {getBindingModeBadge(group.resourceBinding.bindingMode)}
                          </div>
                          <p className="text-xs text-gray-500 mt-1">专属模式确保资源独享</p>
                        </div>
                        <div>
                          <Label className="text-sm font-medium text-gray-700">优先级</Label>
                          <div className="mt-1">
                            {getPriorityBadge(group.resourceBinding.priorityLevel)}
                          </div>
                          <p className="text-xs text-gray-500 mt-1">影响资源调度优先级</p>
                        </div>
                      </div>
                      
                      <Separator />
                      
                      <div className="grid grid-cols-2 gap-6">
                        <div>
                          <Label className="text-sm font-medium text-gray-700">日Token限制</Label>
                          <p className="text-2xl font-bold text-blue-600 mt-1">
                            {group.resourceBinding.dailyTokenLimit.toLocaleString()}
                          </p>
                          <p className="text-xs text-gray-500">tokens/天</p>
                        </div>
                        <div>
                          <Label className="text-sm font-medium text-gray-700">月预算</Label>
                          <p className="text-2xl font-bold text-green-600 mt-1">
                            ${group.resourceBinding.monthlyBudget || '--'}
                          </p>
                          <p className="text-xs text-gray-500">美元/月</p>
                        </div>
                      </div>
                      
                      <Separator />
                      
                      <div className="grid grid-cols-2 gap-6">
                        <div>
                          <Label className="text-sm font-medium text-gray-700">预警阈值</Label>
                          <p className="text-2xl font-bold text-yellow-600 mt-1">
                            {group.resourceBinding.warningThreshold}%
                          </p>
                          <p className="text-xs text-gray-500">发送预警通知</p>
                        </div>
                        <div>
                          <Label className="text-sm font-medium text-gray-700">告警阈值</Label>
                          <p className="text-2xl font-bold text-red-600 mt-1">
                            {group.resourceBinding.alertThreshold}%
                          </p>
                          <p className="text-xs text-gray-500">限制使用访问</p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <Alert>
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        此拼车组尚未配置资源限制。点击"编辑配置"按钮进行设置。
                      </AlertDescription>
                    </Alert>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="members">
            <MemberManagement
              groupId={groupId}
              groupName={group?.name || ''}
              enterpriseId={enterpriseId}
              members={group?.members?.map(m => ({
                ...m,
                status: 'active' // 添加缺少的status字段
              })) || []}
              currentUserId={currentUser?.id}
              canManageMembers={canManageMembers}
              onInviteClick={() => router.push(`/enterprise/${enterpriseId}/org-structure`)}
              onMembersChanged={() => {
                fetchData(enterpriseId, groupId);
              }}
            />
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

          <TabsContent value="api-keys">
            <ApiKeyManagement
              groupId={groupId}
              canManageApiKeys={canManageMembers}
              members={group?.members || []}
              currentUserId={currentUser?.id}
            />
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
                  <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-md">
                    <Database className="w-4 h-4 text-blue-600" />
                    <span className="text-sm font-medium text-blue-800">专属模式</span>
                    <Badge className="bg-blue-100 text-blue-800 text-xs">推荐</Badge>
                  </div>
                  <p className="text-xs text-gray-500">
                    一对一绑定，确保资源独享和公平性
                  </p>
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

        {/* AI账号选择对话框 */}
        <Dialog open={accountSelectionOpen} onOpenChange={setAccountSelectionOpen}>
          <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Link className="w-5 h-5" />
                选择AI账号进行绑定
              </DialogTitle>
              <DialogDescription>
                为此拼车组选择一个专属AI账号。每个账号只能绑定一个拼车组。
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <AccountSelector
                accounts={availableAccounts}
                selectedAccountIds={selectedAccountId ? [selectedAccountId] : []}
                onSelectionChange={(accountIds) => {
                  setSelectedAccountId(accountIds[0] || '');
                }}
                mode="single"
                bindingMode="dedicated"
                enterpriseId={enterpriseId}
                excludeGroupId={group?.id}
              />
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <Button 
                variant="outline" 
                onClick={() => {
                  setAccountSelectionOpen(false);
                  setSelectedAccountId('');
                }}
                disabled={bindingAccount}
              >
                取消
              </Button>
              <Button 
                onClick={handleBindAccount}
                disabled={!selectedAccountId || bindingAccount}
              >
                <Link className="w-4 h-4 mr-2" />
                {bindingAccount ? '绑定中...' : '确认绑定'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* 解绑确认对话框 */}
        <Dialog open={unbindConfirmOpen} onOpenChange={setUnbindConfirmOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Unlink className="w-5 h-5 text-red-600" />
                确认解绑AI账号
              </DialogTitle>
              <DialogDescription>
                您确定要解绑当前的AI账号吗？解绑后拼车组将无法使用AI服务，直到重新绑定账号。
              </DialogDescription>
            </DialogHeader>
            {getBoundAccount() && (
              <div className="my-4 p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <span className="text-lg">{getServiceTypeIcon(getBoundAccount()!.serviceType)}</span>
                  <div>
                    <p className="font-medium">{getBoundAccount()!.name}</p>
                    <p className="text-sm text-gray-600">
                      {getBoundAccount()!.serviceType.toUpperCase()}
                    </p>
                  </div>
                </div>
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button 
                variant="outline" 
                onClick={() => setUnbindConfirmOpen(false)}
                disabled={unbindingAccount}
              >
                取消
              </Button>
              <Button 
                variant="destructive"
                onClick={handleUnbindAccount}
                disabled={unbindingAccount}
              >
                <Unlink className="w-4 h-4 mr-2" />
                {unbindingAccount ? '解绑中...' : '确认解绑'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

      </div>
    </div>
  );
}
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import AccountSelector from '@/components/account/AccountSelector';
import { 
  ChevronLeft, 
  Building2, 
  Users, 
  Settings, 
  DollarSign,
  AlertCircle,
  Info
} from 'lucide-react';

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
  params: Promise<{ enterpriseId: string }>;
}

export default function CreateEnterpriseGroupPage({ params }: PageProps) {
  const router = useRouter();
  const [enterprise, setEnterprise] = useState<Enterprise | null>(null);
  const [availableAccounts, setAvailableAccounts] = useState<AiServiceAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [enterpriseId, setEnterpriseId] = useState<string>('');

  // 表单状态
  const [form, setForm] = useState({
    name: '',
    description: '',
    maxMembers: 5,
    // 资源绑定配置
    enableResourceBinding: false,
    bindingMode: 'shared' as 'dedicated' | 'shared' | 'hybrid',
    // 专属模式配置
    dedicatedAccounts: [] as string[],
    // 共享模式配置
    sharedPoolConfig: {
      serviceTypes: ['claude', 'gemini', 'openai'] as string[],
      maxUsagePercent: 80,
      priority: 'medium' as 'high' | 'medium' | 'low'
    },
    // 混合模式配置
    hybridConfig: {
      primaryAccounts: [] as string[],
      fallbackPools: ['claude', 'gemini'] as string[]
    },
    // 配额配置
    dailyTokenLimit: 10000,
    monthlyBudget: 100,
    priorityLevel: 'medium' as 'high' | 'medium' | 'low',
    warningThreshold: 80,
    alertThreshold: 95
  });

  useEffect(() => {
    params.then(resolvedParams => {
      setEnterpriseId(resolvedParams.enterpriseId);
      fetchEnterpriseData(resolvedParams.enterpriseId);
    });
  }, []);

  const fetchEnterpriseData = async (entId: string) => {
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
        setError('获取企业信息失败');
        return;
      }

      const enterpriseData = await enterpriseResponse.json();
      if (enterpriseData.success) {
        setEnterprise(enterpriseData.data);
      }

      // 获取可用的AI账号
      const accountsResponse = await fetch(`/api/enterprises/${entId}/ai-accounts/available`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (accountsResponse.ok) {
        const accountsData = await accountsResponse.json();
        if (accountsData.success) {
          // 只显示未绑定的账号
          const availableAccountsList = accountsData.data?.accounts?.filter((account: any) => !account.isBound) || [];
          setAvailableAccounts(availableAccountsList);
        }
      }

    } catch (error) {
      console.error('获取企业数据失败:', error);
      setError('获取企业数据失败，请检查网络连接');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      alert('请输入拼车组名称');
      return;
    }

    // 验证专属模式必须选择账号
    if (form.enableResourceBinding && form.bindingMode === 'dedicated' && form.dedicatedAccounts.length === 0) {
      alert('专属模式需要选择一个AI账号');
      return;
    }

    setSubmitting(true);
    try {
      const token = localStorage.getItem('token');
      
      // 首先创建拼车组
      const groupData = {
        name: form.name.trim(),
        description: form.description.trim() || null,
        maxMembers: form.maxMembers,
        enterpriseId: enterpriseId
      };

      const groupResponse = await fetch(`/api/enterprises/${enterpriseId}/groups`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(groupData)
      });

      const groupResult = await groupResponse.json();
      if (!groupResult.success) {
        throw new Error(groupResult.error || '创建拼车组失败');
      }

      const groupId = groupResult.data.id;

      // 如果启用了资源绑定，创建资源绑定配置
      if (form.enableResourceBinding) {
        let bindingConfig: any = {};
        
        switch (form.bindingMode) {
          case 'dedicated':
            bindingConfig = {
              dedicatedAccounts: form.dedicatedAccounts,
              accounts: form.dedicatedAccounts.map((accountId, index) => ({
                accountId,
                priority: index + 1
              }))
            };
            break;
          case 'shared':
            bindingConfig = {
              poolConfig: form.sharedPoolConfig.serviceTypes.map(serviceType => ({
                serviceType,
                maxUsagePercent: form.sharedPoolConfig.maxUsagePercent,
                priority: form.sharedPoolConfig.priority === 'high' ? 1 : 
                         form.sharedPoolConfig.priority === 'medium' ? 2 : 3
              }))
            };
            break;
          case 'hybrid':
            bindingConfig = {
              primaryAccounts: form.hybridConfig.primaryAccounts,
              fallbackPools: form.hybridConfig.fallbackPools.map((serviceType, index) => ({
                serviceType,
                priority: index + 1
              }))
            };
            break;
        }

        const bindingData = {
          bindingMode: form.bindingMode,
          bindingConfig,
          dailyTokenLimit: form.dailyTokenLimit,
          monthlyBudget: form.monthlyBudget,
          priorityLevel: form.priorityLevel,
          warningThreshold: form.warningThreshold,
          alertThreshold: form.alertThreshold
        };

        const bindingResponse = await fetch(`/api/groups/${groupId}/resource-binding`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(bindingData)
        });

        if (!bindingResponse.ok) {
          console.warn('资源绑定配置失败，但拼车组已创建成功');
        }
      }

      // 创建成功，跳转到企业拼车组列表
      router.push(`/enterprise/${enterpriseId}/groups`);
      
    } catch (error) {
      console.error('创建拼车组失败:', error);
      alert(error instanceof Error ? error.message : '创建拼车组失败');
    } finally {
      setSubmitting(false);
    }
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

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
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
            <span>创建拼车组</span>
          </div>
        </div>

        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">创建拼车组</h1>
          <p className="text-gray-600">
            为企业创建新的拼车组，配置资源绑定和使用配额
          </p>
        </div>

        <Tabs defaultValue="basic" className="space-y-6">
          <TabsList>
            <TabsTrigger value="basic" className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              基本信息
            </TabsTrigger>
            <TabsTrigger value="resources" className="flex items-center gap-2">
              <Settings className="w-4 h-4" />
              资源配置
            </TabsTrigger>
            <TabsTrigger value="quotas" className="flex items-center gap-2">
              <DollarSign className="w-4 h-4" />
              配额管理
            </TabsTrigger>
          </TabsList>

          <TabsContent value="basic">
            <Card>
              <CardHeader>
                <CardTitle>基本信息</CardTitle>
                <CardDescription>
                  设置拼车组的基本信息和成员限制
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label>拼车组名称 *</Label>
                    <Input
                      value={form.name}
                      onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="输入拼车组名称"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label>最大成员数</Label>
                    <Input
                      type="number"
                      min="1"
                      max="50"
                      value={form.maxMembers}
                      onChange={(e) => setForm(prev => ({ ...prev, maxMembers: parseInt(e.target.value) || 5 }))}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>拼车组描述</Label>
                  <Textarea
                    value={form.description}
                    onChange={(e) => setForm(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="描述拼车组的用途和目标（可选）"
                    rows={3}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="resources">
            <Card>
              <CardHeader>
                <CardTitle>资源绑定配置</CardTitle>
                <CardDescription>
                  配置拼车组如何使用企业的AI资源
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label>启用资源绑定</Label>
                    <p className="text-sm text-gray-600">
                      为拼车组配置专门的AI资源使用策略
                    </p>
                  </div>
                  <Switch
                    checked={form.enableResourceBinding}
                    onCheckedChange={(checked) => setForm(prev => ({ ...prev, enableResourceBinding: checked }))}
                  />
                </div>

                {form.enableResourceBinding && (
                  <>
                    <Separator />
                    
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label>绑定模式</Label>
                        <Select 
                          value={form.bindingMode} 
                          onValueChange={(value: 'dedicated' | 'shared' | 'hybrid') => 
                            setForm(prev => ({ ...prev, bindingMode: value }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="dedicated">专属模式 - 独占特定账号</SelectItem>
                            <SelectItem value="shared">共享模式 - 使用共享账号池</SelectItem>
                            <SelectItem value="hybrid">混合模式 - 专属+共享备用</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {form.bindingMode === 'dedicated' && (
                        <>
                          <Alert>
                            <Info className="h-4 w-4" />
                            <AlertDescription>
                              专属模式：拼车组将独占选定的AI账号，享有最佳性能和可预测性。
                              需要企业有足够的专用账号资源。
                            </AlertDescription>
                          </Alert>
                          
                          <div className="mt-4">
                            <AccountSelector
                              accounts={availableAccounts}
                              selectedAccountIds={form.dedicatedAccounts}
                              onSelectionChange={(accountIds) => {
                                setForm(prev => ({ ...prev, dedicatedAccounts: accountIds }));
                              }}
                              mode="single"
                              bindingMode="dedicated"
                              enterpriseId={enterpriseId}
                            />
                          </div>
                        </>
                      )}

                      {form.bindingMode === 'shared' && (
                        <Alert>
                          <Info className="h-4 w-4" />
                          <AlertDescription>
                            共享模式：拼车组将使用企业的共享AI账号池，成本较低但可能需要排队。
                            适合非关键业务或开发测试用途。
                          </AlertDescription>
                        </Alert>
                      )}

                      {form.bindingMode === 'hybrid' && (
                        <Alert>
                          <Info className="h-4 w-4" />
                          <AlertDescription>
                            混合模式：优先使用专属账号，不可用时自动切换到共享池。
                            平衡了性能和成本，适合重要业务场景。
                          </AlertDescription>
                        </Alert>
                      )}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="quotas">
            <Card>
              <CardHeader>
                <CardTitle>配额管理</CardTitle>
                <CardDescription>
                  设置拼车组的使用限制和预算控制
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label>日Token限制</Label>
                    <Input
                      type="number"
                      min="1000"
                      step="1000"
                      value={form.dailyTokenLimit}
                      onChange={(e) => setForm(prev => ({ ...prev, dailyTokenLimit: parseInt(e.target.value) || 10000 }))}
                    />
                    <p className="text-sm text-gray-600">每日最大使用Token数量</p>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>月预算（美元）</Label>
                    <Input
                      type="number"
                      min="10"
                      step="10"
                      value={form.monthlyBudget}
                      onChange={(e) => setForm(prev => ({ ...prev, monthlyBudget: parseInt(e.target.value) || 100 }))}
                    />
                    <p className="text-sm text-gray-600">每月最大支出限额</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>优先级</Label>
                  <Select 
                    value={form.priorityLevel} 
                    onValueChange={(value: 'high' | 'medium' | 'low') => 
                      setForm(prev => ({ ...prev, priorityLevel: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="high">高优先级 - 关键业务</SelectItem>
                      <SelectItem value="medium">中优先级 - 常规业务</SelectItem>
                      <SelectItem value="low">低优先级 - 测试开发</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Separator />

                <div>
                  <h4 className="font-medium mb-4">预警设置</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label>预警阈值（%）</Label>
                      <Input
                        type="number"
                        min="50"
                        max="95"
                        value={form.warningThreshold}
                        onChange={(e) => setForm(prev => ({ ...prev, warningThreshold: parseInt(e.target.value) || 80 }))}
                      />
                      <p className="text-sm text-gray-600">达到此使用量时发送预警</p>
                    </div>
                    
                    <div className="space-y-2">
                      <Label>告警阈值（%）</Label>
                      <Input
                        type="number"
                        min="80"
                        max="100"
                        value={form.alertThreshold}
                        onChange={(e) => setForm(prev => ({ ...prev, alertThreshold: parseInt(e.target.value) || 95 }))}
                      />
                      <p className="text-sm text-gray-600">达到此使用量时发送严重告警</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end gap-4 mt-8">
          <Button 
            variant="outline" 
            onClick={() => router.push(`/enterprise/${enterpriseId}/groups`)}
            disabled={submitting}
          >
            取消
          </Button>
          <Button 
            onClick={handleSubmit}
            disabled={
              submitting || 
              !form.name.trim() || 
              (form.enableResourceBinding && form.bindingMode === 'dedicated' && form.dedicatedAccounts.length === 0)
            }
          >
            {submitting ? '创建中...' : '创建拼车组'}
          </Button>
        </div>
      </div>
    </div>
  );
}
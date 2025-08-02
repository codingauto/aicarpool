'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Loader2, ArrowLeft, Save, Settings, Database, BarChart3, AlertCircle, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import { GroupManagerGuard } from '@/components/auth/PermissionGuard';
import { useEnterprisePermissions } from '@/hooks/useEnterprisePermissions';

interface ResourceBinding {
  id?: string;
  bindingMode: 'dedicated' | 'shared' | 'hybrid';
  dailyTokenLimit: number;
  monthlyBudget?: number;
  priorityLevel: 'low' | 'medium' | 'high' | 'critical';
  isActive: boolean;
  config: {
    dedicatedAccounts?: string[];
    sharedPoolAccess?: boolean;
    hybridRatio?: number;
    autoFailover?: boolean;
    costOptimization?: boolean;
  };
}

interface AiServiceAccount {
  id: string;
  name: string;
  serviceType: string;
  status: string;
  dailyQuota: number;
  monthlyBudget: number;
  usageToday: {
    tokens: number;
    cost: number;
    requests: number;
  };
}

export default function ResourceConfigPage() {
  const params = useParams();
  const router = useRouter();
  const groupId = params.groupId as string;

  const [resourceBinding, setResourceBinding] = useState<ResourceBinding | null>(null);
  const [availableAccounts, setAvailableAccounts] = useState<AiServiceAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('overview');

  const { hasGroupPermission } = useEnterprisePermissions(groupId);
  const canManage = hasGroupPermission(groupId, 'manage');

  // 绑定模式配置表单
  const [formData, setFormData] = useState<ResourceBinding>({
    bindingMode: 'shared',
    dailyTokenLimit: 100000,
    monthlyBudget: 500,
    priorityLevel: 'medium',
    isActive: true,
    config: {
      sharedPoolAccess: true,
      autoFailover: true,
      costOptimization: true,
      hybridRatio: 50
    }
  });

  const fetchResourceConfig = async () => {
    try {
      const token = localStorage.getItem('token');
      const [bindingResponse, accountsResponse] = await Promise.all([
        fetch(`/api/groups/${groupId}/resource-binding`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch(`/api/groups/${groupId}/ai-accounts`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
      ]);

      let bindingData = { success: false, data: null };
      let accountsData = { success: false, data: [] };

      // 安全地解析JSON响应
      try {
        if (bindingResponse.ok) {
          const bindingText = await bindingResponse.text();
          if (bindingText.trim()) {
            bindingData = JSON.parse(bindingText);
          }
        }
      } catch (error) {
        console.warn('解析资源绑定响应失败:', error);
      }

      try {
        if (accountsResponse.ok) {
          const accountsText = await accountsResponse.text();
          if (accountsText.trim()) {
            accountsData = JSON.parse(accountsText);
          }
        }
      } catch (error) {
        console.warn('解析AI账号响应失败:', error);
      }

      if (bindingData.success && bindingData.data) {
        setResourceBinding(bindingData.data);
        setFormData(bindingData.data);
      }

      if (accountsData.success) {
        setAvailableAccounts(accountsData.data || []);
      }

    } catch (error) {
      console.error('获取资源配置失败:', error);
      setError('获取资源配置失败');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveConfig = async () => {
    if (!canManage) {
      toast.error('您没有权限修改资源配置');
      return;
    }

    try {
      setSaving(true);
      const token = localStorage.getItem('token');
      
      const response = await fetch(`/api/groups/${groupId}/resource-binding`, {
        method: resourceBinding?.id ? 'PUT' : 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      const data = await response.json();
      
      if (data.success) {
        setResourceBinding(data.data);
        toast.success('资源配置保存成功');
      } else {
        throw new Error(data.message || '保存失败');
      }

    } catch (error) {
      console.error('保存资源配置失败:', error);
      toast.error('保存资源配置失败');
    } finally {
      setSaving(false);
    }
  };

  const getBindingModeInfo = (mode: string) => {
    switch (mode) {
      case 'dedicated':
        return {
          title: '专属模式',
          description: '为拼车组分配专用的AI服务账号，确保资源独享和性能稳定',
          color: 'bg-blue-100 text-blue-800 border-blue-300',
          icon: '🔒',
          features: ['资源独享', '性能保障', '数据隔离', '优先级最高']
        };
      case 'shared':
        return {
          title: '共享模式', 
          description: '使用企业共享资源池，成本效益高，适合一般使用场景',
          color: 'bg-green-100 text-green-800 border-green-300',
          icon: '🤝',
          features: ['成本最低', '资源弹性', '自动扩容', '适合轻度使用']
        };
      case 'hybrid':
        return {
          title: '混合模式',
          description: '结合专属和共享资源，在成本和性能之间取得平衡',
          color: 'bg-orange-100 text-orange-800 border-orange-300',
          icon: '⚡',
          features: ['成本均衡', '性能可控', '智能分配', '灵活调度']
        };
      default:
        return {
          title: '未配置',
          description: '',
          color: 'bg-gray-100 text-gray-800 border-gray-300',
          icon: '❓',
          features: []
        };
    }
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  };

  useEffect(() => {
    fetchResourceConfig();
  }, [groupId]);

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" onClick={() => router.back()}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            返回
          </Button>
          <div className="flex items-center gap-2">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>加载资源配置...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* 页面头部 */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => router.back()}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            返回拼车组
          </Button>
          <div>
            <h1 className="text-2xl font-bold">AI资源配置</h1>
            <p className="text-gray-600">配置拼车组的AI服务资源绑定模式和使用限制</p>
          </div>
        </div>
        
        <GroupManagerGuard groupId={groupId}>
          <Button 
            onClick={handleSaveConfig}
            disabled={saving}
            className="bg-blue-500 hover:bg-blue-600 text-white"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                保存中...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                保存配置
              </>
            )}
          </Button>
        </GroupManagerGuard>
      </div>

      {error && (
        <Alert className="mb-6" variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4" />
            配置概览
          </TabsTrigger>
          <TabsTrigger value="binding-mode" className="flex items-center gap-2">
            <Settings className="w-4 h-4" />
            绑定模式
          </TabsTrigger>
          <TabsTrigger value="accounts" className="flex items-center gap-2">
            <Database className="w-4 h-4" />
            账号管理
          </TabsTrigger>
        </TabsList>

        {/* 配置概览 */}
        <TabsContent value="overview" className="space-y-6">
          {/* 当前配置状态 */}
          <Card>
            <CardHeader>
              <CardTitle>当前配置状态</CardTitle>
              <CardDescription>查看当前资源绑定配置和使用情况</CardDescription>
            </CardHeader>
            <CardContent>
              {resourceBinding ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="text-center p-4 border rounded-lg">
                    <div className="text-sm text-gray-600 mb-1">绑定模式</div>
                    <Badge className={getBindingModeInfo(resourceBinding.bindingMode).color}>
                      {getBindingModeInfo(resourceBinding.bindingMode).title}
                    </Badge>
                  </div>
                  <div className="text-center p-4 border rounded-lg">
                    <div className="text-sm text-gray-600 mb-1">日Token限制</div>
                    <div className="text-xl font-bold">{formatNumber(resourceBinding.dailyTokenLimit)}</div>
                  </div>
                  <div className="text-center p-4 border rounded-lg">
                    <div className="text-sm text-gray-600 mb-1">月预算</div>
                    <div className="text-xl font-bold">
                      ${resourceBinding.monthlyBudget || '无限制'}
                    </div>
                  </div>
                  <div className="text-center p-4 border rounded-lg">
                    <div className="text-sm text-gray-600 mb-1">优先级</div>
                    <Badge variant={resourceBinding.priorityLevel === 'high' ? 'default' : 'secondary'}>
                      {resourceBinding.priorityLevel === 'high' ? '高' :
                       resourceBinding.priorityLevel === 'medium' ? '中' : '低'}
                    </Badge>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <AlertCircle className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                  <p>尚未配置资源绑定</p>
                  <p className="text-sm">请在"绑定模式"标签页中进行配置</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* 可用账号统计 */}
          <Card>
            <CardHeader>
              <CardTitle>可用AI服务账号</CardTitle>
              <CardDescription>企业级AI服务账号的使用统计</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {availableAccounts.map(account => (
                  <div key={account.id} className="border rounded-lg p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <div className="font-medium">{account.name}</div>
                        <div className="text-sm text-gray-500">{account.serviceType}</div>
                      </div>
                      <Badge variant={account.status === 'active' ? 'default' : 'secondary'}>
                        {account.status === 'active' ? '活跃' : '停用'}
                      </Badge>
                    </div>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span>今日使用:</span>
                        <span>{formatNumber(account.usageToday.tokens)} tokens</span>
                      </div>
                      <div className="flex justify-between">
                        <span>今日成本:</span>
                        <span>${account.usageToday.cost.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>请求次数:</span>
                        <span>{account.usageToday.requests}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              
              {availableAccounts.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <Database className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                  <p>暂无可用的AI服务账号</p>
                  <p className="text-sm">请联系企业管理员添加AI服务账号</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 绑定模式配置 */}
        <TabsContent value="binding-mode" className="space-y-6">
          {/* 绑定模式选择 */}
          <Card>
            <CardHeader>
              <CardTitle>选择绑定模式</CardTitle>
              <CardDescription>根据使用需求选择合适的资源绑定模式</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                {(['dedicated', 'shared', 'hybrid'] as const).map(mode => {
                  const info = getBindingModeInfo(mode);
                  const isSelected = formData.bindingMode === mode;
                  
                  return (
                    <div
                      key={mode}
                      className={`relative border-2 rounded-lg p-4 cursor-pointer transition-all ${
                        isSelected ? info.color : 'border-gray-200 hover:border-gray-300'
                      } ${!canManage ? 'cursor-not-allowed opacity-60' : ''}`}
                      onClick={() => canManage && setFormData(prev => ({ ...prev, bindingMode: mode }))}
                    >
                      {isSelected && (
                        <CheckCircle className="absolute top-2 right-2 w-5 h-5 text-green-600" />
                      )}
                      <div className="text-2xl mb-2">{info.icon}</div>
                      <h3 className="font-bold mb-2">{info.title}</h3>
                      <p className="text-sm text-gray-600 mb-3">{info.description}</p>
                      <div className="space-y-1">
                        {info.features.map((feature, index) => (
                          <div key={index} className="flex items-center gap-2 text-xs">
                            <div className="w-1 h-1 bg-current rounded-full"></div>
                            {feature}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* 配置参数 */}
          <Card>
            <CardHeader>
              <CardTitle>配置参数</CardTitle>
              <CardDescription>设置资源使用限制和优先级</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* 基础配置 */}
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="dailyTokenLimit">日Token限制</Label>
                    <Input
                      id="dailyTokenLimit"
                      type="number"
                      value={formData.dailyTokenLimit}
                      onChange={(e) => setFormData(prev => ({ 
                        ...prev, 
                        dailyTokenLimit: parseInt(e.target.value) || 0 
                      }))}
                      disabled={!canManage}
                      placeholder="100000"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="monthlyBudget">月预算限制 (美元)</Label>
                    <Input
                      id="monthlyBudget"
                      type="number"
                      value={formData.monthlyBudget || ''}
                      onChange={(e) => setFormData(prev => ({ 
                        ...prev, 
                        monthlyBudget: parseInt(e.target.value) || undefined 
                      }))}
                      disabled={!canManage}
                      placeholder="500"
                    />
                  </div>

                  <div>
                    <Label htmlFor="priorityLevel">优先级</Label>
                    <Select 
                      value={formData.priorityLevel} 
                      onValueChange={(value: any) => setFormData(prev => ({ ...prev, priorityLevel: value }))}
                      disabled={!canManage}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">低优先级</SelectItem>
                        <SelectItem value="medium">中优先级</SelectItem>
                        <SelectItem value="high">高优先级</SelectItem>
                        <SelectItem value="critical">关键优先级</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* 高级配置 */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="autoFailover">自动故障转移</Label>
                    <Switch
                      id="autoFailover"
                      checked={formData.config.autoFailover || false}
                      onCheckedChange={(checked) => setFormData(prev => ({
                        ...prev,
                        config: { ...prev.config, autoFailover: checked }
                      }))}
                      disabled={!canManage}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <Label htmlFor="costOptimization">成本优化</Label>
                    <Switch
                      id="costOptimization"
                      checked={formData.config.costOptimization || false}
                      onCheckedChange={(checked) => setFormData(prev => ({
                        ...prev,
                        config: { ...prev.config, costOptimization: checked }
                      }))}
                      disabled={!canManage}
                    />
                  </div>

                  {formData.bindingMode === 'hybrid' && (
                    <div>
                      <Label htmlFor="hybridRatio">混合比例 (专属资源比例 %)</Label>
                      <Input
                        id="hybridRatio"
                        type="number"
                        min="0"
                        max="100"
                        value={formData.config.hybridRatio || 50}
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          config: { ...prev.config, hybridRatio: parseInt(e.target.value) || 50 }
                        }))}
                        disabled={!canManage}
                      />
                    </div>
                  )}

                  <div className="flex items-center justify-between">
                    <Label htmlFor="isActive">启用配置</Label>
                    <Switch
                      id="isActive"
                      checked={formData.isActive}
                      onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isActive: checked }))}
                      disabled={!canManage}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 账号管理 */}
        <TabsContent value="accounts" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>AI服务账号</CardTitle>
              <CardDescription>管理绑定到此拼车组的AI服务账号</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-gray-500">
                <Database className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                <p>账号管理功能正在开发中...</p>
                <p className="text-sm">将支持账号绑定、解绑和使用统计查看</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
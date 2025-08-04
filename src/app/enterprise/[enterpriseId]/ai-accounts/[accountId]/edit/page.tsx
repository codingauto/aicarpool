'use client';

/**
 * 企业AI账号编辑页面
 * 
 * 功能：
 * - 编辑AI账号的基本信息
 * - 修改认证配置
 * - 更新模型配置和限制
 * - 修改代理设置
 */

import React, { useState, useEffect, use } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { ArrowLeft, Save, ChevronLeft, Building2, AlertTriangle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEnterpriseContext } from '@/contexts/enterprise-context';
import { toast } from 'sonner';

interface EditAccountForm {
  name: string;
  description: string;
  serviceType: string;
  accountType: string;
  authType: string;
  apiKey: string;
  apiSecret: string;
  apiEndpoint: string;
  supportedModels: string[];
  defaultModel: string;
  dailyLimit: number;
  costPerToken: number;
  proxyEnabled: boolean;
  proxyHost: string;
  proxyPort: string;
  proxyUsername: string;
  proxyPassword: string;
  isEnabled: boolean;
}

export default function EditAiAccountPage({ 
  params 
}: { 
  params: Promise<{ enterpriseId: string; accountId: string }> 
}) {
  const { enterpriseId, accountId } = use(params);
  const router = useRouter();
  const { currentEnterprise, hasRole } = useEnterpriseContext();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState<EditAccountForm>({
    name: '',
    description: '',
    serviceType: '',
    accountType: 'shared',
    authType: 'api_key',
    apiKey: '',
    apiSecret: '',
    apiEndpoint: '',
    supportedModels: [],
    defaultModel: '',
    dailyLimit: 10000,
    costPerToken: 0.00001,
    proxyEnabled: false,
    proxyHost: '',
    proxyPort: '',
    proxyUsername: '',
    proxyPassword: '',
    isEnabled: true
  });

  // 检查权限
  if (!(hasRole('owner') || hasRole('admin'))) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center py-12">
          <h3 className="text-lg font-medium text-gray-900 mb-2">权限不足</h3>
          <p className="text-gray-600 mb-4">您没有权限编辑AI账号</p>
          <Button onClick={() => router.back()}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            返回
          </Button>
        </div>
      </div>
    );
  }

  useEffect(() => {
    fetchAccountDetail();
  }, [enterpriseId, accountId]);

  const fetchAccountDetail = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/enterprises/${enterpriseId}/ai-accounts/${accountId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          const account = result.data.account;
          setForm({
            name: account.name || '',
            description: account.description || '',
            serviceType: account.serviceType || '',
            accountType: account.accountType || 'shared',
            authType: account.authType || 'api_key',
            apiKey: '••••••••', // 不显示真实的API Key
            apiSecret: '••••••••', // 不显示真实的API Secret
            apiEndpoint: account.apiEndpoint || '',
            supportedModels: account.supportedModels || [],
            defaultModel: account.currentModel || '',
            dailyLimit: account.dailyLimit || 10000,
            costPerToken: account.costPerToken || 0.00001,
            proxyEnabled: !!account.proxyConfig,
            proxyHost: account.proxyConfig?.host || '',
            proxyPort: account.proxyConfig?.port?.toString() || '',
            proxyUsername: account.proxyConfig?.username || '',
            proxyPassword: account.proxyConfig?.password ? '••••••••' : '',
            isEnabled: account.isEnabled !== false // 默认为true
          });
          setError('');
        } else {
          setError(result.message || '获取账号信息失败');
        }
      } else {
        setError('获取账号信息失败');
      }
    } catch (error) {
      console.error('获取账号信息失败:', error);
      setError('获取账号信息失败');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: keyof EditAccountForm, value: any) => {
    setForm(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!form.name || !form.serviceType) {
      setError('请填写必要字段');
      return;
    }

    try {
      setSaving(true);
      setError('');
      
      const token = localStorage.getItem('token');
      
      // 构建更新数据，只包含修改过的字段
      const updateData: any = {
        name: form.name,
        description: form.description,
        supportedModels: form.supportedModels,
        currentModel: form.defaultModel,
        dailyLimit: form.dailyLimit,
        costPerToken: form.costPerToken,
        isEnabled: form.isEnabled
      };

      // API端点
      if (form.apiEndpoint) {
        updateData.apiEndpoint = form.apiEndpoint;
      }

      // 只有当API Key不是掩码时才更新认证信息
      if (form.apiKey !== '••••••••') {
        updateData.credentials = {
          apiKey: form.apiKey,
          ...(form.apiSecret !== '••••••••' && form.apiSecret && { apiSecret: form.apiSecret })
        };
      }

      // 代理配置
      if (form.proxyEnabled && form.proxyHost && form.proxyPort) {
        updateData.proxyConfig = {
          type: 'http',
          host: form.proxyHost,
          port: parseInt(form.proxyPort),
          ...(form.proxyUsername && { username: form.proxyUsername }),
          ...(form.proxyPassword !== '••••••••' && form.proxyPassword && { password: form.proxyPassword })
        };
      } else if (!form.proxyEnabled) {
        updateData.proxyConfig = null;
      }

      const response = await fetch(`/api/enterprises/${enterpriseId}/ai-accounts/${accountId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updateData)
      });

      const result = await response.json();
      
      if (result.success) {
        toast.success('账号更新成功');
        router.push(`/enterprise/${enterpriseId}/ai-accounts/${accountId}`);
      } else {
        setError(result.message || '更新账号失败');
      }
    } catch (error) {
      console.error('更新账号失败:', error);
      setError('更新账号失败');
    } finally {
      setSaving(false);
    }
  };

  const getServiceModelOptions = (serviceType: string): string[] => {
    const modelOptions: Record<string, string[]> = {
      'claude': ['claude-3-sonnet', 'claude-3-haiku', 'claude-3-opus'],
      'openai': ['gpt-4', 'gpt-4-turbo', 'gpt-3.5-turbo'],
      'gemini': ['gemini-pro', 'gemini-pro-vision'],
      'qwen': ['qwen-turbo', 'qwen-plus', 'qwen-max'],
      'zhipu': ['glm-4', 'glm-3-turbo'],
      'kimi': ['moonshot-v1-8k', 'moonshot-v1-32k', 'moonshot-v1-128k']
    };
    return modelOptions[serviceType] || [];
  };

  const modelOptions = getServiceModelOptions(form.serviceType);

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-48 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error && loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center py-12">
          <AlertTriangle className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">加载失败</h3>
          <p className="text-gray-600 mb-4">{error}</p>
          <div className="space-x-4">
            <Button onClick={fetchAccountDetail}>重试</Button>
            <Button 
              variant="outline" 
              onClick={() => router.push(`/enterprise/${enterpriseId}/ai-accounts/${accountId}`)}
            >
              返回详情页
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        {/* 面包屑导航 */}
        <div className="flex items-center gap-4 mb-6">
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => router.push(`/enterprise/${enterpriseId}/ai-accounts/${accountId}`)}
          >
            <ChevronLeft className="w-4 h-4 mr-2" />
            返回账号详情
          </Button>
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Building2 className="w-4 h-4" />
            <span>{currentEnterprise?.name || '未知企业'}</span>
            <span>/</span>
            <span>AI账号管理</span>
            <span>/</span>
            <span>{form.name}</span>
            <span>/</span>
            <span>编辑</span>
          </div>
        </div>

        {/* 页面标题 */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">编辑AI账号</h1>
          <p className="text-gray-600 mt-2">修改AI服务账号的配置和设置</p>
        </div>

        {/* 编辑表单 */}
        <form onSubmit={handleSubmit} className="space-y-8">
          {/* 基本信息 */}
          <Card className="shadow-sm">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg font-semibold text-gray-900">基本信息</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <Label htmlFor="name" className="text-sm font-medium text-gray-700">
                    账号名称 <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="name"
                    value={form.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    placeholder="请输入账号名称"
                    className="h-10"
                    required
                  />
                </div>
                
                <div className="space-y-3">
                  <Label htmlFor="serviceType" className="text-sm font-medium text-gray-700">
                    AI服务类型 <span className="text-red-500">*</span>
                  </Label>
                  <Select 
                    value={form.serviceType} 
                    onValueChange={(value) => {
                      handleInputChange('serviceType', value);
                      handleInputChange('supportedModels', []);
                      handleInputChange('defaultModel', '');
                    }}
                    disabled // 通常不允许修改服务类型
                  >
                    <SelectTrigger className="h-10">
                      <SelectValue placeholder="请选择AI服务" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="claude">Claude</SelectItem>
                      <SelectItem value="openai">OpenAI</SelectItem>
                      <SelectItem value="gemini">Gemini</SelectItem>
                      <SelectItem value="qwen">通义千问</SelectItem>
                      <SelectItem value="zhipu">智谱AI</SelectItem>
                      <SelectItem value="kimi">Kimi</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="space-y-3">
                <Label htmlFor="description" className="text-sm font-medium text-gray-700">描述</Label>
                <Textarea
                  id="description"
                  value={form.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  placeholder="请输入账号描述（可选）"
                  rows={3}
                  className="resize-none"
                />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <Label htmlFor="accountType" className="text-sm font-medium text-gray-700">账号类型</Label>
                  <Select value={form.accountType} onValueChange={(value) => handleInputChange('accountType', value)}>
                    <SelectTrigger className="h-10">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="shared">共享账号</SelectItem>
                      <SelectItem value="dedicated">专用账号</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-3">
                  <Label className="text-sm font-medium text-gray-700">账号状态</Label>
                  <div className="flex items-center space-x-2">
                    <Switch
                      checked={form.isEnabled}
                      onCheckedChange={(checked) => handleInputChange('isEnabled', checked)}
                    />
                    <Label className="text-sm text-gray-700">
                      {form.isEnabled ? '启用' : '禁用'}
                    </Label>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 认证配置 */}
          <Card className="shadow-sm">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg font-semibold text-gray-900">认证配置</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3">
                <Label htmlFor="apiKey" className="text-sm font-medium text-gray-700">
                  API Key <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="apiKey"
                  type="password"
                  value={form.apiKey}
                  onChange={(e) => handleInputChange('apiKey', e.target.value)}
                  placeholder="保持不变请勿修改"
                  className="h-10"
                />
                <p className="text-xs text-gray-500">留空或不修改将保持原有配置</p>
              </div>
              
              {form.authType === 'api_key' && (
                <div className="space-y-3">
                  <Label htmlFor="apiSecret" className="text-sm font-medium text-gray-700">API Secret</Label>
                  <Input
                    id="apiSecret"
                    type="password"
                    value={form.apiSecret}
                    onChange={(e) => handleInputChange('apiSecret', e.target.value)}
                    placeholder="保持不变请勿修改"
                    className="h-10"
                  />
                </div>
              )}
              
              <div className="space-y-3">
                <Label htmlFor="apiEndpoint" className="text-sm font-medium text-gray-700">API端点</Label>
                <Input
                  id="apiEndpoint"
                  value={form.apiEndpoint}
                  onChange={(e) => handleInputChange('apiEndpoint', e.target.value)}
                  placeholder="自定义API端点（可选）"
                  className="h-10"
                />
              </div>
            </CardContent>
          </Card>

          {/* 模型配置 */}
          {form.serviceType && (
            <Card className="shadow-sm">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg font-semibold text-gray-900">模型配置</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-3">
                  <Label className="text-sm font-medium text-gray-700">支持的模型</Label>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {modelOptions.map((model) => (
                      <label key={model} className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-gray-50 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={form.supportedModels.includes(model)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              handleInputChange('supportedModels', [...form.supportedModels, model]);
                            } else {
                              handleInputChange('supportedModels', form.supportedModels.filter(m => m !== model));
                            }
                          }}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm font-medium text-gray-700">{model}</span>
                      </label>
                    ))}
                  </div>
                </div>
                
                {form.supportedModels.length > 0 && (
                  <div className="space-y-3">
                    <Label htmlFor="defaultModel" className="text-sm font-medium text-gray-700">默认模型</Label>
                    <Select value={form.defaultModel} onValueChange={(value) => handleInputChange('defaultModel', value)}>
                      <SelectTrigger className="h-10">
                        <SelectValue placeholder="请选择默认模型" />
                      </SelectTrigger>
                      <SelectContent>
                        {form.supportedModels.map((model) => (
                          <SelectItem key={model} value={model}>{model}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* 限制配置 */}
          <Card className="shadow-sm">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg font-semibold text-gray-900">限制配置</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <Label htmlFor="dailyLimit" className="text-sm font-medium text-gray-700">每日请求限制</Label>
                  <Input
                    id="dailyLimit"
                    type="number"
                    value={form.dailyLimit}
                    onChange={(e) => handleInputChange('dailyLimit', parseInt(e.target.value))}
                    min="1"
                    className="h-10"
                    placeholder="10000"
                  />
                </div>
                
                <div className="space-y-3">
                  <Label htmlFor="costPerToken" className="text-sm font-medium text-gray-700">每Token成本 (USD)</Label>
                  <Input
                    id="costPerToken"
                    type="number"
                    step="0.000001"
                    value={form.costPerToken}
                    onChange={(e) => handleInputChange('costPerToken', parseFloat(e.target.value))}
                    min="0"
                    className="h-10"
                    placeholder="0.00001"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 代理配置 */}
          <Card className="shadow-sm">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg font-semibold text-gray-900">代理配置</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center space-x-3">
                <Switch
                  checked={form.proxyEnabled}
                  onCheckedChange={(checked) => handleInputChange('proxyEnabled', checked)}
                />
                <Label className="text-sm font-medium text-gray-700">启用代理</Label>
              </div>
              
              {form.proxyEnabled && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-gray-200">
                  <div className="space-y-3">
                    <Label htmlFor="proxyHost" className="text-sm font-medium text-gray-700">代理主机</Label>
                    <Input
                      id="proxyHost"
                      value={form.proxyHost}
                      onChange={(e) => handleInputChange('proxyHost', e.target.value)}
                      placeholder="代理服务器地址"
                      className="h-10"
                    />
                  </div>
                  
                  <div className="space-y-3">
                    <Label htmlFor="proxyPort" className="text-sm font-medium text-gray-700">代理端口</Label>
                    <Input
                      id="proxyPort"
                      value={form.proxyPort}
                      onChange={(e) => handleInputChange('proxyPort', e.target.value)}
                      placeholder="端口号"
                      className="h-10"
                    />
                  </div>
                  
                  <div className="space-y-3">
                    <Label htmlFor="proxyUsername" className="text-sm font-medium text-gray-700">代理用户名</Label>
                    <Input
                      id="proxyUsername"
                      value={form.proxyUsername}
                      onChange={(e) => handleInputChange('proxyUsername', e.target.value)}
                      placeholder="用户名（可选）"
                      className="h-10"
                    />
                  </div>
                  
                  <div className="space-y-3">
                    <Label htmlFor="proxyPassword" className="text-sm font-medium text-gray-700">代理密码</Label>
                    <Input
                      id="proxyPassword"
                      type="password"
                      value={form.proxyPassword}
                      onChange={(e) => handleInputChange('proxyPassword', e.target.value)}
                      placeholder="密码（可选）"
                      className="h-10"
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* 错误信息 */}
          {error && (
            <Card className="border-red-200 bg-red-50">
              <CardContent className="pt-6">
                <div className="text-red-700 text-center font-medium">{error}</div>
              </CardContent>
            </Card>
          )}

          {/* 提交按钮 */}
          <div className="flex justify-end space-x-4 pt-6">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => router.push(`/enterprise/${enterpriseId}/ai-accounts/${accountId}`)}
              className="h-11 px-6"
            >
              取消
            </Button>
            <Button 
              type="submit" 
              disabled={saving}
              className="h-11 px-6"
            >
              {saving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  保存中...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  保存更改
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
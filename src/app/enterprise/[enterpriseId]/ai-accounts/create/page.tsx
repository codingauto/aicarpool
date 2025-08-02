'use client';

/**
 * 企业AI账号创建页面
 * 
 * 功能：
 * - 创建新的AI服务账号
 * - 配置账号参数和认证信息
 * - 设置模型和限制
 */

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { ArrowLeft, Save, ChevronLeft, Building2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEnterpriseContext } from '@/contexts/enterprise-context';

interface CreateAccountForm {
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
}

export default function CreateAiAccountPage({ params }: { params: Promise<{ enterpriseId: string }> }) {
  const { enterpriseId } = React.use(params);
  const router = useRouter();
  const { currentEnterprise, hasRole } = useEnterpriseContext();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState<CreateAccountForm>({
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
    proxyPassword: ''
  });

  // 检查权限
  if (!hasRole(['owner', 'admin'])) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center py-12">
          <h3 className="text-lg font-medium text-gray-900 mb-2">权限不足</h3>
          <p className="text-gray-600 mb-4">您没有权限创建AI账号</p>
          <Button onClick={() => router.back()}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            返回
          </Button>
        </div>
      </div>
    );
  }

  const handleInputChange = (field: keyof CreateAccountForm, value: any) => {
    setForm(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!form.name || !form.serviceType || !form.apiKey) {
      setError('请填写必要字段');
      return;
    }

    try {
      setLoading(true);
      setError('');
      
      const token = localStorage.getItem('token');
      const credentials = {
        apiKey: form.apiKey,
        ...(form.apiSecret && { apiSecret: form.apiSecret })
      };

      const proxyConfig = form.proxyEnabled ? {
        type: 'http',
        host: form.proxyHost,
        port: parseInt(form.proxyPort),
        ...(form.proxyUsername && { username: form.proxyUsername }),
        ...(form.proxyPassword && { password: form.proxyPassword })
      } : null;

      const response = await fetch(`/api/enterprises/${enterpriseId}/ai-accounts`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: form.name,
          description: form.description,
          serviceType: form.serviceType,
          accountType: form.accountType,
          authType: form.authType,
          credentials,
          apiEndpoint: form.apiEndpoint || undefined,
          proxyConfig,
          supportedModels: form.supportedModels,
          dailyLimit: form.dailyLimit,
          costPerToken: form.costPerToken
        })
      });

      const result = await response.json();
      
      if (result.success) {
        router.push(`/enterprise/${enterpriseId}/ai-accounts`);
      } else {
        setError(result.message || '创建账号失败');
      }
    } catch (error) {
      console.error('创建账号失败:', error);
      setError('创建账号失败');
    } finally {
      setLoading(false);
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

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        {/* 面包屑和标题 */}
        <div className="flex items-center gap-4 mb-6">
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => router.push(`/enterprise/${enterpriseId}/ai-accounts`)}
          >
            <ChevronLeft className="w-4 h-4 mr-2" />
            返回AI账号管理
          </Button>
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Building2 className="w-4 h-4" />
            <span>{currentEnterprise?.name || '未知企业'}</span>
            <span>/</span>
            <span>AI账号管理</span>
            <span>/</span>
            <span>创建账号</span>
          </div>
        </div>

        <div className="space-y-6">
        {/* 页面标题 */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">创建AI账号</h1>
            <p className="text-gray-600 mt-1">为企业添加新的AI服务账号</p>
          </div>
          
          <Button variant="outline" onClick={() => router.back()}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            返回
          </Button>
        </div>

        {/* 创建表单 */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* 基本信息 */}
          <Card>
            <CardHeader>
              <CardTitle>基本信息</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name">账号名称 *</Label>
                  <Input
                    id="name"
                    value={form.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    placeholder="输入账号名称"
                    required
                  />
                </div>
                
                <div>
                  <Label htmlFor="serviceType">AI服务类型 *</Label>
                  <Select value={form.serviceType} onValueChange={(value) => {
                    handleInputChange('serviceType', value);
                    handleInputChange('supportedModels', []);
                    handleInputChange('defaultModel', '');
                  }}>
                    <SelectTrigger>
                      <SelectValue placeholder="选择AI服务" />
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
              
              <div>
                <Label htmlFor="description">描述</Label>
                <Textarea
                  id="description"
                  value={form.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  placeholder="输入账号描述"
                  rows={3}
                />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="accountType">账号类型</Label>
                  <Select value={form.accountType} onValueChange={(value) => handleInputChange('accountType', value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="shared">共享账号</SelectItem>
                      <SelectItem value="dedicated">专用账号</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label htmlFor="authType">认证类型</Label>
                  <Select value={form.authType} onValueChange={(value) => handleInputChange('authType', value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="api_key">API Key</SelectItem>
                      <SelectItem value="oauth">OAuth</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 认证配置 */}
          <Card>
            <CardHeader>
              <CardTitle>认证配置</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="apiKey">API Key *</Label>
                <Input
                  id="apiKey"
                  type="password"
                  value={form.apiKey}
                  onChange={(e) => handleInputChange('apiKey', e.target.value)}
                  placeholder="输入API Key"
                  required
                />
              </div>
              
              {form.authType === 'api_key' && (
                <div>
                  <Label htmlFor="apiSecret">API Secret</Label>
                  <Input
                    id="apiSecret"
                    type="password"
                    value={form.apiSecret}
                    onChange={(e) => handleInputChange('apiSecret', e.target.value)}
                    placeholder="输入API Secret（如果需要）"
                  />
                </div>
              )}
              
              <div>
                <Label htmlFor="apiEndpoint">API端点</Label>
                <Input
                  id="apiEndpoint"
                  value={form.apiEndpoint}
                  onChange={(e) => handleInputChange('apiEndpoint', e.target.value)}
                  placeholder="自定义API端点（可选）"
                />
              </div>
            </CardContent>
          </Card>

          {/* 模型配置 */}
          {form.serviceType && (
            <Card>
              <CardHeader>
                <CardTitle>模型配置</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>支持的模型</Label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-2">
                    {modelOptions.map((model) => (
                      <label key={model} className="flex items-center space-x-2">
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
                        />
                        <span className="text-sm">{model}</span>
                      </label>
                    ))}
                  </div>
                </div>
                
                {form.supportedModels.length > 0 && (
                  <div>
                    <Label htmlFor="defaultModel">默认模型</Label>
                    <Select value={form.defaultModel} onValueChange={(value) => handleInputChange('defaultModel', value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="选择默认模型" />
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
          <Card>
            <CardHeader>
              <CardTitle>限制配置</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="dailyLimit">每日请求限制</Label>
                  <Input
                    id="dailyLimit"
                    type="number"
                    value={form.dailyLimit}
                    onChange={(e) => handleInputChange('dailyLimit', parseInt(e.target.value))}
                    min="1"
                  />
                </div>
                
                <div>
                  <Label htmlFor="costPerToken">每Token成本 (USD)</Label>
                  <Input
                    id="costPerToken"
                    type="number"
                    step="0.000001"
                    value={form.costPerToken}
                    onChange={(e) => handleInputChange('costPerToken', parseFloat(e.target.value))}
                    min="0"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 代理配置 */}
          <Card>
            <CardHeader>
              <CardTitle>代理配置</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center space-x-2">
                <Switch
                  checked={form.proxyEnabled}
                  onCheckedChange={(checked) => handleInputChange('proxyEnabled', checked)}
                />
                <Label>启用代理</Label>
              </div>
              
              {form.proxyEnabled && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="proxyHost">代理主机</Label>
                    <Input
                      id="proxyHost"
                      value={form.proxyHost}
                      onChange={(e) => handleInputChange('proxyHost', e.target.value)}
                      placeholder="代理服务器地址"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="proxyPort">代理端口</Label>
                    <Input
                      id="proxyPort"
                      value={form.proxyPort}
                      onChange={(e) => handleInputChange('proxyPort', e.target.value)}
                      placeholder="端口号"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="proxyUsername">代理用户名</Label>
                    <Input
                      id="proxyUsername"
                      value={form.proxyUsername}
                      onChange={(e) => handleInputChange('proxyUsername', e.target.value)}
                      placeholder="用户名（可选）"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="proxyPassword">代理密码</Label>
                    <Input
                      id="proxyPassword"
                      type="password"
                      value={form.proxyPassword}
                      onChange={(e) => handleInputChange('proxyPassword', e.target.value)}
                      placeholder="密码（可选）"
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* 错误信息 */}
          {error && (
            <Card>
              <CardContent className="pt-6">
                <div className="text-red-600 text-center">{error}</div>
              </CardContent>
            </Card>
          )}

          {/* 提交按钮 */}
          <div className="flex justify-end space-x-4">
            <Button type="button" variant="outline" onClick={() => router.back()}>
              取消
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  创建中...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  创建账号
                </>
              )}
            </Button>
          </div>
        </form>
        </div>
      </div>
    </div>
  );
}
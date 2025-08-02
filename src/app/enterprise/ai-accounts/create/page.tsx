'use client';

/**
 * 创建AI账号页面
 * 
 * 功能：
 * - AI账号基本信息配置
 * - 认证配置
 * - 代理配置
 * - 模型和限制配置
 */

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  ArrowLeft,
  Save,
  TestTube,
  AlertCircle,
  CheckCircle,
  Loader2
} from 'lucide-react';
import { useRouter } from 'next/navigation';

interface CreateAccountForm {
  name: string;
  description: string;
  serviceType: string;
  accountType: string;
  authType: 'api_key' | 'oauth';
  apiKey: string;
  apiSecret?: string;
  apiEndpoint?: string;
  proxyEnabled: boolean;
  proxyType?: string;
  proxyHost?: string;
  proxyPort?: string;
  proxyUsername?: string;
  proxyPassword?: string;
  supportedModels: string[];
  defaultModel?: string;
  dailyLimit: number;
  costPerToken: number;
}

const SERVICE_CONFIGS = {
  claude: {
    name: 'Claude',
    authTypes: ['api_key'],
    defaultEndpoint: 'https://api.anthropic.com/v1/messages',
    models: ['claude-3.5-sonnet', 'claude-3-opus', 'claude-3-haiku'],
    defaultCostPerToken: 0.000003
  },
  gemini: {
    name: 'Gemini',
    authTypes: ['api_key'],
    defaultEndpoint: 'https://generativelanguage.googleapis.com/v1beta/models',
    models: ['gemini-pro', 'gemini-pro-vision'],
    defaultCostPerToken: 0.000001
  },
  openai: {
    name: 'OpenAI',
    authTypes: ['api_key'],
    defaultEndpoint: 'https://api.openai.com/v1/chat/completions',
    models: ['gpt-4', 'gpt-4-turbo', 'gpt-3.5-turbo'],
    defaultCostPerToken: 0.00001
  },
  qwen: {
    name: '通义千问',
    authTypes: ['api_key'],
    defaultEndpoint: 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation',
    models: ['qwen-max', 'qwen-plus', 'qwen-turbo'],
    defaultCostPerToken: 0.000002
  }
};

export default function CreateAiAccountPage() {
  const router = useRouter();
  const [form, setForm] = useState<CreateAccountForm>({
    name: '',
    description: '',
    serviceType: '',
    accountType: 'shared',
    authType: 'api_key',
    apiKey: '',
    proxyEnabled: false,
    supportedModels: [],
    dailyLimit: 10000,
    costPerToken: 0.000001
  });
  
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const currentServiceConfig = form.serviceType ? SERVICE_CONFIGS[form.serviceType as keyof typeof SERVICE_CONFIGS] : null;

  const handleServiceTypeChange = (serviceType: string) => {
    const config = SERVICE_CONFIGS[serviceType as keyof typeof SERVICE_CONFIGS];
    setForm({
      ...form,
      serviceType,
      apiEndpoint: config.defaultEndpoint,
      supportedModels: [config.models[0]],
      defaultModel: config.models[0],
      costPerToken: config.defaultCostPerToken
    });
  };

  const handleModelToggle = (model: string, checked: boolean) => {
    if (checked) {
      setForm({
        ...form,
        supportedModels: [...form.supportedModels, model]
      });
    } else {
      setForm({
        ...form,
        supportedModels: form.supportedModels.filter(m => m !== model)
      });
    }
  };

  const handleTestConnection = async () => {
    if (!form.serviceType || !form.apiKey) {
      setTestResult({ success: false, message: '请先填写服务类型和API密钥' });
      return;
    }

    setTesting(true);
    setTestResult(null);

    try {
      // 模拟测试连接
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // 简单验证API密钥格式
      const isValidKey = form.apiKey.length > 10;
      
      if (isValidKey) {
        setTestResult({ success: true, message: '连接测试成功！' });
      } else {
        setTestResult({ success: false, message: 'API密钥格式不正确' });
      }
    } catch (error) {
      setTestResult({ success: false, message: '连接测试失败，请检查配置' });
    } finally {
      setTesting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!form.name || !form.serviceType || !form.apiKey) {
      alert('请填写必要信息');
      return;
    }

    setSaving(true);

    try {
      // 构建提交数据
      const submitData = {
        name: form.name,
        description: form.description,
        serviceType: form.serviceType,
        accountType: form.accountType,
        authType: form.authType,
        credentials: {
          apiKey: form.apiKey,
          ...(form.apiSecret && { apiSecret: form.apiSecret })
        },
        apiEndpoint: form.apiEndpoint,
        ...(form.proxyEnabled && {
          proxyConfig: {
            type: form.proxyType,
            host: form.proxyHost,
            port: form.proxyPort ? parseInt(form.proxyPort) : undefined,
            username: form.proxyUsername,
            password: form.proxyPassword
          }
        }),
        supportedModels: form.supportedModels,
        defaultModel: form.defaultModel,
        dailyLimit: form.dailyLimit,
        costPerToken: form.costPerToken
      };

      console.log('提交AI账号数据:', submitData);
      
      // 这里应该调用API创建账号
      // await createAiAccount(submitData);
      
      // 模拟API调用
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      router.push('/enterprise/ai-accounts');
    } catch (error) {
      console.error('创建AI账号失败:', error);
      alert('创建失败，请重试');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      {/* 页面标题 */}
      <div className="flex items-center space-x-4 mb-6">
        <Button variant="ghost" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          返回
        </Button>
        <div>
          <h1 className="text-3xl font-bold">创建AI账号</h1>
          <p className="text-gray-600 mt-1">添加新的AI服务账号到企业资源池</p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <Tabs defaultValue="basic" className="space-y-6">
          <TabsList>
            <TabsTrigger value="basic">基本信息</TabsTrigger>
            <TabsTrigger value="auth">认证配置</TabsTrigger>
            <TabsTrigger value="proxy">代理配置</TabsTrigger>
            <TabsTrigger value="models">模型配置</TabsTrigger>
          </TabsList>

          <TabsContent value="basic" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>基本信息</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">账号名称 *</Label>
                    <Input
                      id="name"
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      placeholder="输入账号名称"
                      required
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="serviceType">服务类型 *</Label>
                    <Select value={form.serviceType} onValueChange={handleServiceTypeChange} required>
                      <SelectTrigger>
                        <SelectValue placeholder="选择AI服务" />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(SERVICE_CONFIGS).map(([key, config]) => (
                          <SelectItem key={key} value={key}>
                            {config.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">描述</Label>
                  <Textarea
                    id="description"
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    placeholder="描述此账号的用途或特点"
                    rows={3}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="accountType">账号类型</Label>
                  <Select value={form.accountType} onValueChange={(value) => setForm({ ...form, accountType: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="shared">共享账号</SelectItem>
                      <SelectItem value="dedicated">专属账号</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-sm text-gray-500">
                    共享账号可被多个拼车组使用，专属账号只能绑定到特定拼车组
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="auth" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>认证配置</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="apiKey">API密钥 *</Label>
                  <Input
                    id="apiKey"
                    type="password"
                    value={form.apiKey}
                    onChange={(e) => setForm({ ...form, apiKey: e.target.value })}
                    placeholder="输入API密钥"
                    required
                  />
                </div>

                {form.serviceType && (
                  <div className="space-y-2">
                    <Label htmlFor="apiEndpoint">API端点</Label>
                    <Input
                      id="apiEndpoint"
                      value={form.apiEndpoint || ''}
                      onChange={(e) => setForm({ ...form, apiEndpoint: e.target.value })}
                      placeholder="自定义API端点（可选）"
                    />
                    <p className="text-sm text-gray-500">
                      留空使用默认端点：{currentServiceConfig?.defaultEndpoint}
                    </p>
                  </div>
                )}

                <div className="pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleTestConnection}
                    disabled={testing || !form.serviceType || !form.apiKey}
                  >
                    {testing ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <TestTube className="h-4 w-4 mr-2" />
                    )}
                    测试连接
                  </Button>

                  {testResult && (
                    <div className={`mt-3 p-3 rounded-lg flex items-center space-x-2 ${
                      testResult.success ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                    }`}>
                      {testResult.success ? (
                        <CheckCircle className="h-4 w-4" />
                      ) : (
                        <AlertCircle className="h-4 w-4" />
                      )}
                      <span>{testResult.message}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="proxy" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>代理配置</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="proxyEnabled"
                    checked={form.proxyEnabled}
                    onCheckedChange={(checked) => setForm({ ...form, proxyEnabled: !!checked })}
                  />
                  <Label htmlFor="proxyEnabled">启用代理</Label>
                </div>

                {form.proxyEnabled && (
                  <div className="space-y-4 pt-4 border-t">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="proxyType">代理类型</Label>
                        <Select value={form.proxyType} onValueChange={(value) => setForm({ ...form, proxyType: value })}>
                          <SelectTrigger>
                            <SelectValue placeholder="选择代理类型" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="http">HTTP</SelectItem>
                            <SelectItem value="https">HTTPS</SelectItem>
                            <SelectItem value="socks5">SOCKS5</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="proxyHost">代理地址</Label>
                        <Input
                          id="proxyHost"
                          value={form.proxyHost || ''}
                          onChange={(e) => setForm({ ...form, proxyHost: e.target.value })}
                          placeholder="代理服务器地址"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="proxyPort">端口</Label>
                        <Input
                          id="proxyPort"
                          type="number"
                          value={form.proxyPort || ''}
                          onChange={(e) => setForm({ ...form, proxyPort: e.target.value })}
                          placeholder="代理端口"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="proxyUsername">用户名</Label>
                        <Input
                          id="proxyUsername"
                          value={form.proxyUsername || ''}
                          onChange={(e) => setForm({ ...form, proxyUsername: e.target.value })}
                          placeholder="代理用户名（可选）"
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="proxyPassword">密码</Label>
                        <Input
                          id="proxyPassword"
                          type="password"
                          value={form.proxyPassword || ''}
                          onChange={(e) => setForm({ ...form, proxyPassword: e.target.value })}
                          placeholder="代理密码（可选）"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="models" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>模型配置</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {currentServiceConfig && (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>支持的模型</Label>
                      <div className="space-y-2">
                        {currentServiceConfig.models.map((model) => (
                          <div key={model} className="flex items-center space-x-2">
                            <Checkbox
                              id={model}
                              checked={form.supportedModels.includes(model)}
                              onCheckedChange={(checked) => handleModelToggle(model, !!checked)}
                            />
                            <Label htmlFor={model}>{model}</Label>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="defaultModel">默认模型</Label>
                      <Select value={form.defaultModel} onValueChange={(value) => setForm({ ...form, defaultModel: value })}>
                        <SelectTrigger>
                          <SelectValue placeholder="选择默认模型" />
                        </SelectTrigger>
                        <SelectContent>
                          {form.supportedModels.map((model) => (
                            <SelectItem key={model} value={model}>
                              {model}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="dailyLimit">日使用限制</Label>
                    <Input
                      id="dailyLimit"
                      type="number"
                      value={form.dailyLimit}
                      onChange={(e) => setForm({ ...form, dailyLimit: parseInt(e.target.value) || 0 })}
                      placeholder="每日最大token数"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="costPerToken">每Token成本</Label>
                    <Input
                      id="costPerToken"
                      type="number"
                      step="0.000001"
                      value={form.costPerToken}
                      onChange={(e) => setForm({ ...form, costPerToken: parseFloat(e.target.value) || 0 })}
                      placeholder="0.000001"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* 提交按钮 */}
        <div className="flex justify-end space-x-4 pt-6">
          <Button type="button" variant="outline" onClick={() => router.back()}>
            取消
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            创建账号
          </Button>
        </div>
      </form>
    </div>
  );
}
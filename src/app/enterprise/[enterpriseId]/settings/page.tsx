'use client';

/**
 * 企业专属设置页面
 * 
 * 功能：
 * - 企业基本信息设置
 * - 功能模块配置
 * - 安全设置管理
 * - 集成配置
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { 
  Settings,
  Building,
  Shield,
  Palette,
  Bell,
  Key,
  Globe,
  Save,
  RefreshCw,
  Info,
  AlertTriangle,
  CheckCircle,
  Lock,
  Unlock,
  Eye,
  EyeOff,
  Zap,
  Database,
  Mail,
  Smartphone
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEnterpriseContext } from '@/contexts/enterprise-context';
import { EnterpriseLayout } from '@/components/layout/enterprise-navigation';

interface EnterpriseSettings {
  basic: {
    name: string;
    description: string;
    planType: string;
    organizationType: string;
    uiTheme: string;
  };
  features: {
    aiResources: boolean;
    analytics: boolean;
    budgetManagement: boolean;
    permissions: boolean;
    organization: boolean;
    monitoring: boolean;
    alerts: boolean;
  };
  security: {
    passwordPolicy: {
      minLength: number;
      requireUppercase: boolean;
      requireNumbers: boolean;
      requireSymbols: boolean;
    };
    sessionTimeout: number;
    twoFactorAuth: boolean;
    ipWhitelist: string[];
  };
  integrations: {
    email: {
      enabled: boolean;
      provider: string;
      smtpHost?: string;
      smtpPort?: number;
      username?: string;
    };
    sms: {
      enabled: boolean;
      provider: string;
      apiKey?: string;
    };
    webhook: {
      enabled: boolean;
      urls: string[];
    };
  };
  notifications: {
    email: boolean;
    sms: boolean;
    inApp: boolean;
    budgetAlerts: boolean;
    systemAlerts: boolean;
  };
}

export default function EnterpriseSettingsPage({ params }: { params: Promise<{ enterpriseId: string }> }) {
  const { enterpriseId } = React.use(params);
  const router = useRouter();
  const { currentEnterprise, hasRole } = useEnterpriseContext();
  const [settings, setSettings] = useState<EnterpriseSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showApiKeys, setShowApiKeys] = useState(false);

  // 权限检查
  if (!hasRole(['owner', 'admin'])) {
    return (
      <EnterpriseLayout enterpriseId={enterpriseId}>
        <div className="p-6">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <Shield className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">访问受限</h3>
                <p className="text-gray-600">您没有权限访问企业设置页面</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </EnterpriseLayout>
    );
  }

  useEffect(() => {
    fetchSettings();
  }, [enterpriseId]);

  const fetchSettings = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/enterprises/${enterpriseId}/settings`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setSettings(data.data);
        } else {
          setError(data.message || '获取设置失败');
        }
      } else {
        setError('获取设置失败');
      }
    } catch (error) {
      console.error('获取设置失败:', error);
      setError('获取设置失败');
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    if (!settings) return;

    try {
      setSaving(true);
      setError('');
      setSuccess('');

      const token = localStorage.getItem('token');
      const response = await fetch(`/api/enterprises/${enterpriseId}/settings`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(settings)
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setSuccess('设置保存成功');
          setTimeout(() => setSuccess(''), 3000);
        } else {
          setError(data.message || '保存设置失败');
        }
      } else {
        setError('保存设置失败');
      }
    } catch (error) {
      console.error('保存设置失败:', error);
      setError('保存设置失败');
    } finally {
      setSaving(false);
    }
  };

  const updateSettings = (section: string, field: string, value: any) => {
    if (!settings) return;

    setSettings({
      ...settings,
      [section]: {
        ...settings[section as keyof EnterpriseSettings],
        [field]: value
      }
    });
  };

  const updateNestedSettings = (section: string, subsection: string, field: string, value: any) => {
    if (!settings) return;

    setSettings({
      ...settings,
      [section]: {
        ...settings[section as keyof EnterpriseSettings],
        [subsection]: {
          ...(settings[section as keyof EnterpriseSettings] as any)[subsection],
          [field]: value
        }
      }
    });
  };

  if (loading) {
    return (
      <EnterpriseLayout enterpriseId={enterpriseId}>
        <div className="p-6">
          <div className="flex items-center justify-center h-64">
            <div className="text-lg text-gray-600">加载设置...</div>
          </div>
        </div>
      </EnterpriseLayout>
    );
  }

  if (error && !settings) {
    return (
      <EnterpriseLayout enterpriseId={enterpriseId}>
        <div className="p-6">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <Settings className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">设置加载失败</h3>
                <p className="text-gray-600 mb-4">{error}</p>
                <Button onClick={fetchSettings}>重试</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </EnterpriseLayout>
    );
  }

  return (
    <EnterpriseLayout enterpriseId={enterpriseId}>
      <div className="p-6 space-y-6">
        {/* 页面标题 */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Settings className="w-6 h-6 text-blue-600" />
              企业设置
            </h1>
            <p className="text-gray-600 mt-1">
              配置企业基本信息、功能和安全设置
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={fetchSettings} disabled={loading}>
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              刷新
            </Button>
            <Button onClick={saveSettings} disabled={saving || !settings}>
              <Save className={`w-4 h-4 mr-2 ${saving ? 'animate-spin' : ''}`} />
              保存设置
            </Button>
          </div>
        </div>

        {/* 状态提示 */}
        {error && (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="pt-6">
              <div className="flex items-center space-x-2 text-red-600">
                <AlertTriangle className="w-4 h-4" />
                <span>{error}</span>
              </div>
            </CardContent>
          </Card>
        )}

        {success && (
          <Card className="border-green-200 bg-green-50">
            <CardContent className="pt-6">
              <div className="flex items-center space-x-2 text-green-600">
                <CheckCircle className="w-4 h-4" />
                <span>{success}</span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* 设置标签页 */}
        {settings && (
          <Tabs defaultValue="basic" className="space-y-4">
            <TabsList>
              <TabsTrigger value="basic">基本信息</TabsTrigger>
              <TabsTrigger value="features">功能配置</TabsTrigger>
              <TabsTrigger value="security">安全设置</TabsTrigger>
              <TabsTrigger value="integrations">集成配置</TabsTrigger>
              <TabsTrigger value="notifications">通知设置</TabsTrigger>
            </TabsList>

            <TabsContent value="basic">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Building className="w-5 h-5" />
                    基本信息
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="name">企业名称</Label>
                      <Input
                        id="name"
                        value={settings.basic.name}
                        onChange={(e) => updateSettings('basic', 'name', e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="planType">计划类型</Label>
                      <Select
                        value={settings.basic.planType}
                        onValueChange={(value) => updateSettings('basic', 'planType', value)}
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
                    <div className="space-y-2">
                      <Label htmlFor="organizationType">组织类型</Label>
                      <Select
                        value={settings.basic.organizationType}
                        onValueChange={(value) => updateSettings('basic', 'organizationType', value)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="enterprise">企业</SelectItem>
                          <SelectItem value="carpool_group">拼车组</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="uiTheme">界面主题</Label>
                      <Select
                        value={settings.basic.uiTheme}
                        onValueChange={(value) => updateSettings('basic', 'uiTheme', value)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="simple">简洁</SelectItem>
                          <SelectItem value="professional">专业</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description">企业描述</Label>
                    <Textarea
                      id="description"
                      value={settings.basic.description}
                      onChange={(e) => updateSettings('basic', 'description', e.target.value)}
                      rows={3}
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="features">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Zap className="w-5 h-5" />
                    功能模块配置
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {Object.entries(settings.features).map(([key, enabled]) => (
                      <div key={key} className="flex items-center justify-between p-4 border rounded-lg">
                        <div>
                          <h4 className="font-medium text-gray-900">
                            {key === 'aiResources' && 'AI资源管理'}
                            {key === 'analytics' && '数据分析'}
                            {key === 'budgetManagement' && '预算管理'}
                            {key === 'permissions' && '权限管理'}
                            {key === 'organization' && '组织架构'}
                            {key === 'monitoring' && '监控中心'}
                            {key === 'alerts' && '告警管理'}
                          </h4>
                          <p className="text-sm text-gray-600">
                            {key === 'aiResources' && '管理AI服务账号和资源配置'}
                            {key === 'analytics' && '查看使用统计和性能分析'}
                            {key === 'budgetManagement' && '预算分配和成本控制'}
                            {key === 'permissions' && '用户权限和角色管理'}
                            {key === 'organization' && '部门和组织结构管理'}
                            {key === 'monitoring' && '系统监控和性能指标'}
                            {key === 'alerts' && '告警规则和通知管理'}
                          </p>
                        </div>
                        <Switch
                          checked={enabled}
                          onCheckedChange={(checked) => updateSettings('features', key, checked)}
                        />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="security">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="w-5 h-5" />
                    安全设置
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-4">
                    <h4 className="font-medium text-gray-900">密码策略</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>最小长度</Label>
                        <Input
                          type="number"
                          value={settings.security.passwordPolicy.minLength}
                          onChange={(e) => updateNestedSettings('security', 'passwordPolicy', 'minLength', parseInt(e.target.value))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>会话超时 (分钟)</Label>
                        <Input
                          type="number"
                          value={settings.security.sessionTimeout}
                          onChange={(e) => updateSettings('security', 'sessionTimeout', parseInt(e.target.value))}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="flex items-center space-x-2">
                        <Switch
                          checked={settings.security.passwordPolicy.requireUppercase}
                          onCheckedChange={(checked) => updateNestedSettings('security', 'passwordPolicy', 'requireUppercase', checked)}
                        />
                        <Label>需要大写字母</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Switch
                          checked={settings.security.passwordPolicy.requireNumbers}
                          onCheckedChange={(checked) => updateNestedSettings('security', 'passwordPolicy', 'requireNumbers', checked)}
                        />
                        <Label>需要数字</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Switch
                          checked={settings.security.passwordPolicy.requireSymbols}
                          onCheckedChange={(checked) => updateNestedSettings('security', 'passwordPolicy', 'requireSymbols', checked)}
                        />
                        <Label>需要特殊字符</Label>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <h4 className="font-medium text-gray-900">双因素认证</h4>
                      <p className="text-sm text-gray-600">增强账户安全性</p>
                    </div>
                    <Switch
                      checked={settings.security.twoFactorAuth}
                      onCheckedChange={(checked) => updateSettings('security', 'twoFactorAuth', checked)}
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="integrations">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Globe className="w-5 h-5" />
                    集成配置
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium text-gray-900">邮件服务</h4>
                      <Switch
                        checked={settings.integrations.email.enabled}
                        onCheckedChange={(checked) => updateNestedSettings('integrations', 'email', 'enabled', checked)}
                      />
                    </div>
                    {settings.integrations.email.enabled && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-4 border-l-2 border-blue-200">
                        <div className="space-y-2">
                          <Label>SMTP 主机</Label>
                          <Input
                            value={settings.integrations.email.smtpHost || ''}
                            onChange={(e) => updateNestedSettings('integrations', 'email', 'smtpHost', e.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>SMTP 端口</Label>
                          <Input
                            type="number"
                            value={settings.integrations.email.smtpPort || ''}
                            onChange={(e) => updateNestedSettings('integrations', 'email', 'smtpPort', parseInt(e.target.value))}
                          />
                        </div>
                        <div className="space-y-2 md:col-span-2">
                          <Label>用户名</Label>
                          <Input
                            value={settings.integrations.email.username || ''}
                            onChange={(e) => updateNestedSettings('integrations', 'email', 'username', e.target.value)}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium text-gray-900">短信服务</h4>
                      <Switch
                        checked={settings.integrations.sms.enabled}
                        onCheckedChange={(checked) => updateNestedSettings('integrations', 'sms', 'enabled', checked)}
                      />
                    </div>
                    {settings.integrations.sms.enabled && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-4 border-l-2 border-green-200">
                        <div className="space-y-2">
                          <Label>服务提供商</Label>
                          <Select
                            value={settings.integrations.sms.provider}
                            onValueChange={(value) => updateNestedSettings('integrations', 'sms', 'provider', value)}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="aliyun">阿里云</SelectItem>
                              <SelectItem value="tencent">腾讯云</SelectItem>
                              <SelectItem value="huawei">华为云</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>API密钥</Label>
                          <div className="relative">
                            <Input
                              type={showApiKeys ? 'text' : 'password'}
                              value={settings.integrations.sms.apiKey || ''}
                              onChange={(e) => updateNestedSettings('integrations', 'sms', 'apiKey', e.target.value)}
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="absolute right-2 top-1/2 transform -translate-y-1/2"
                              onClick={() => setShowApiKeys(!showApiKeys)}
                            >
                              {showApiKeys ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium text-gray-900">Webhook</h4>
                      <Switch
                        checked={settings.integrations.webhook.enabled}
                        onCheckedChange={(checked) => updateNestedSettings('integrations', 'webhook', 'enabled', checked)}
                      />
                    </div>
                    {settings.integrations.webhook.enabled && (
                      <div className="pl-4 border-l-2 border-purple-200">
                        <div className="space-y-2">
                          <Label>Webhook URLs (每行一个)</Label>
                          <Textarea
                            value={settings.integrations.webhook.urls.join('\n')}
                            onChange={(e) => updateNestedSettings('integrations', 'webhook', 'urls', e.target.value.split('\n').filter(url => url.trim()))}
                            rows={3}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="notifications">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Bell className="w-5 h-5" />
                    通知设置
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {Object.entries(settings.notifications).map(([key, enabled]) => (
                      <div key={key} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex items-center space-x-3">
                          {key === 'email' && <Mail className="w-5 h-5 text-blue-500" />}
                          {key === 'sms' && <Smartphone className="w-5 h-5 text-green-500" />}
                          {key === 'inApp' && <Bell className="w-5 h-5 text-purple-500" />}
                          {key === 'budgetAlerts' && <AlertTriangle className="w-5 h-5 text-yellow-500" />}
                          {key === 'systemAlerts' && <Shield className="w-5 h-5 text-red-500" />}
                          <div>
                            <h4 className="font-medium text-gray-900">
                              {key === 'email' && '邮件通知'}
                              {key === 'sms' && '短信通知'}
                              {key === 'inApp' && '应用内通知'}
                              {key === 'budgetAlerts' && '预算告警'}
                              {key === 'systemAlerts' && '系统告警'}
                            </h4>
                            <p className="text-sm text-gray-600">
                              {key === 'email' && '通过邮件接收通知'}
                              {key === 'sms' && '通过短信接收通知'}
                              {key === 'inApp' && '在应用中显示通知'}
                              {key === 'budgetAlerts' && '预算超限和警告通知'}
                              {key === 'systemAlerts' && '系统故障和维护通知'}
                            </p>
                          </div>
                        </div>
                        <Switch
                          checked={enabled}
                          onCheckedChange={(checked) => updateSettings('notifications', key, checked)}
                        />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}
      </div>
    </EnterpriseLayout>
  );
}
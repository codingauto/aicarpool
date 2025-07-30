'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { UserCircle, X, AlertCircle, Key, Loader2 } from 'lucide-react';
import ProxyConfig, { ProxyConfigData } from './ProxyConfig';
import OAuthFlow from './OAuthFlow';

interface AiAccount {
  id: string;
  name: string;
  description?: string;
  serviceType: 'claude' | 'gemini' | 'ampcode';
  accountType: 'shared' | 'dedicated';
  authType: 'oauth' | 'api_key';
  projectId?: string;
  proxy?: any;
}

interface AiAccountFormProps {
  account?: AiAccount;
  serviceType?: 'claude' | 'gemini' | 'ampcode';
  groupId: string;
  onClose: () => void;
  onSuccess: (account?: AiAccount) => void;
}

interface FormData {
  serviceType: 'claude' | 'gemini' | 'ampcode';
  name: string;
  description: string;
  accountType: 'shared' | 'dedicated';
  authType: 'oauth' | 'api_key';
  projectId: string;
  accessToken: string;
  refreshToken: string;
  proxy: ProxyConfigData;
}

interface FormErrors {
  name: string;
  accessToken: string;
  projectId: string;
}

export default function AiAccountForm({ account, serviceType, groupId, onClose, onSuccess }: AiAccountFormProps) {
  const isEdit = !!account;
  const [oauthStep, setOauthStep] = useState(1);
  const [loading, setLoading] = useState(false);

  // 初始化表单数据
  const [formData, setFormData] = useState<FormData>({
    serviceType: account?.serviceType || serviceType || 'claude',
    name: account?.name || '',
    description: account?.description || '',
    accountType: account?.accountType || 'shared',
    authType: account?.authType || 'oauth',
    projectId: account?.projectId || '',
    accessToken: '',
    refreshToken: '',
    proxy: {
      enabled: false,
      type: 'socks5',
      host: '',
      port: '',
      username: '',
      password: '',
    }
  });

  // 表单验证错误
  const [errors, setErrors] = useState<FormErrors>({
    name: '',
    accessToken: '',
    projectId: ''
  });

  // 初始化代理配置
  useEffect(() => {
    if (account?.proxy) {
      setFormData(prev => ({
        ...prev,
        proxy: {
          enabled: !!(account.proxy.host && account.proxy.port),
          type: account.proxy.type || 'socks5',
          host: account.proxy.host || '',
          port: account.proxy.port?.toString() || '',
          username: account.proxy.username || '',
          password: account.proxy.password || ''
        }
      }));
    }
  }, [account]);

  // 更新表单数据
  const updateFormData = (updates: Partial<FormData>) => {
    setFormData(prev => ({ ...prev, ...updates }));
  };

  // 稳定的代理配置更新处理器
  const handleProxyChange = useCallback((proxy: ProxyConfigData) => {
    updateFormData({ proxy });
  }, []);

  // 清除错误
  const clearError = (field: keyof FormErrors) => {
    setErrors(prev => ({ ...prev, [field]: '' }));
  };

  // 验证表单
  const validateForm = (): boolean => {
    const newErrors: FormErrors = {
      name: '',
      accessToken: '',
      projectId: ''
    };

    if (!formData.name.trim()) {
      newErrors.name = '请填写账户名称';
    }

    if (formData.authType === 'api_key' && !formData.accessToken.trim()) {
      newErrors.accessToken = '请填写 Access Token';
    }

    // Gemini Google Cloud 项目ID检查
    if (formData.serviceType === 'gemini' && formData.projectId && 
        (!/^\d+$/.test(formData.projectId) || formData.projectId.length !== 12)) {
      newErrors.projectId = '项目编号应为12位纯数字';
    }

    setErrors(newErrors);
    return !Object.values(newErrors).some(error => error);
  };

  // 下一步（OAuth流程）
  const nextStep = async () => {
    clearError('name');
    
    if (!formData.name.trim()) {
      setErrors(prev => ({ ...prev, name: '请填写账户名称' }));
      return;
    }

    // Gemini项目编号确认
    if (formData.serviceType === 'gemini' && !formData.projectId.trim()) {
      const confirmed = window.confirm(
        '您尚未填写项目编号。\n\n如果您的Google账号绑定了Google Cloud或被识别为Workspace账号，需要提供项目编号。\n如果您使用的是普通个人账号，可以继续不填写。\n\n是否继续？'
      );
      if (!confirmed) return;
    }

    setOauthStep(2);
  };

  // 处理OAuth成功
  const handleOAuthSuccess = async (tokenInfo: any) => {
    setLoading(true);
    try {
      const payload = {
        serviceType: formData.serviceType,
        name: formData.name,
        description: formData.description,
        accountType: formData.accountType,
        authType: 'oauth',
        credentials: tokenInfo.tokens || tokenInfo,
        proxy: formData.proxy.enabled ? {
          type: formData.proxy.type,
          host: formData.proxy.host,
          port: parseInt(formData.proxy.port),
          username: formData.proxy.username || null,
          password: formData.proxy.password || null
        } : null
      };

      if (formData.serviceType === 'gemini' && formData.projectId) {
        payload.credentials.projectId = formData.projectId;
      }

      const response = await fetch(`/api/groups/${groupId}/ai-accounts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json();
      if (result.success) {
        onSuccess(result.data);
      } else {
        throw new Error(result.error || '创建账户失败');
      }
    } catch (error) {
      console.error('Create account error:', error);
      // TODO: 显示错误提示
    } finally {
      setLoading(false);
    }
  };

  // 创建账户（手动模式）
  const createAccount = async () => {
    if (!validateForm()) return;

    setLoading(true);
    try {
      const payload = {
        serviceType: formData.serviceType,
        name: formData.name,
        description: formData.description,
        accountType: formData.accountType,
        authType: formData.authType,
        credentials: {
          apiKey: formData.accessToken,
          ...(formData.refreshToken && { refreshToken: formData.refreshToken }),
          ...(formData.serviceType === 'gemini' && formData.projectId && { projectId: formData.projectId })
        },
        proxy: formData.proxy.enabled ? {
          type: formData.proxy.type,
          host: formData.proxy.host,
          port: parseInt(formData.proxy.port),
          username: formData.proxy.username || null,
          password: formData.proxy.password || null
        } : null
      };

      const response = await fetch(`/api/groups/${groupId}/ai-accounts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json();
      if (result.success) {
        onSuccess(result.data);
      } else {
        throw new Error(result.error || '创建账户失败');
      }
    } catch (error) {
      console.error('Create account error:', error);
      // TODO: 显示错误提示
    } finally {
      setLoading(false);
    }
  };

  // 更新账户
  const updateAccount = async () => {
    if (!validateForm()) return;
    if (!account) return;

    setLoading(true);
    try {
      const payload = {
        name: formData.name,
        description: formData.description,
        accountType: formData.accountType,
        ...(formData.accessToken && {
          credentials: {
            apiKey: formData.accessToken,
            ...(formData.refreshToken && { refreshToken: formData.refreshToken }),
            ...(formData.serviceType === 'gemini' && formData.projectId && { projectId: formData.projectId })
          }
        }),
        proxy: formData.proxy.enabled ? {
          type: formData.proxy.type,
          host: formData.proxy.host,
          port: parseInt(formData.proxy.port),
          username: formData.proxy.username || null,
          password: formData.proxy.password || null
        } : null
      };

      const response = await fetch(`/api/groups/${groupId}/ai-accounts/${account.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json();
      if (result.success) {
        onSuccess(result.data);
      } else {
        throw new Error(result.error || '更新账户失败');
      }
    } catch (error) {
      console.error('Update account error:', error);
      // TODO: 显示错误提示
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* 头部 */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-green-600 rounded-xl flex items-center justify-center">
              <UserCircle className="w-6 h-6 text-white" />
            </div>
            <h3 className="text-xl font-bold text-gray-900">
              {isEdit ? '编辑账户' : '添加账户'}
            </h3>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* 步骤指示器 */}
        {!isEdit && formData.authType === 'oauth' && (
          <div className="flex items-center justify-center py-4 border-b bg-gray-50 flex-shrink-0">
            <div className="flex items-center space-x-4">
              <div className="flex items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
                  oauthStep >= 1 ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-500'
                }`}>
                  1
                </div>
                <span className="ml-2 text-sm font-medium text-gray-700">基本信息</span>
              </div>
              <div className="w-8 h-0.5 bg-gray-300"></div>
              <div className="flex items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
                  oauthStep >= 2 ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-500'
                }`}>
                  2
                </div>
                <span className="ml-2 text-sm font-medium text-gray-700">授权认证</span>
              </div>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-6 min-h-0">
          {/* 步骤1: 基本信息 */}
          {(oauthStep === 1 && !isEdit) && (
            <div className="space-y-6">
              {/* 平台选择 */}
              {!isEdit && !serviceType && (
                <div className="space-y-3">
                  <Label className="text-sm font-semibold text-gray-700">平台</Label>
                  <RadioGroup
                    value={formData.serviceType}
                    onValueChange={(value) => updateFormData({ serviceType: value as 'claude' | 'gemini' | 'ampcode' })}
                    className="flex gap-6"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="claude" id="claude" />
                      <Label htmlFor="claude">Claude</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="gemini" id="gemini" />
                      <Label htmlFor="gemini">Gemini</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="ampcode" id="ampcode" />
                      <Label htmlFor="ampcode">AMPCode</Label>
                    </div>
                  </RadioGroup>
                </div>
              )}

              {/* 添加方式 */} 
              {!isEdit && (
                <div className="space-y-3">
                  <Label className="text-sm font-semibold text-gray-700">添加方式</Label>
                  <RadioGroup
                    value={formData.authType}
                    onValueChange={(value: 'oauth' | 'api_key') => updateFormData({ authType: value })}
                    className="flex gap-6"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="oauth" id="oauth" />
                      <Label htmlFor="oauth">OAuth 授权 (推荐)</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="api_key" id="api_key" />
                      <Label htmlFor="api_key">手动输入 Access Token</Label>
                    </div>
                  </RadioGroup>
                </div>
              )}

              {/* 账户名称 */}
              <div className="space-y-2">
                <Label className="text-sm font-semibold text-gray-700">账户名称</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => {
                    updateFormData({ name: e.target.value });
                    clearError('name');
                  }}
                  placeholder="为账户设置一个易识别的名称"
                  className={errors.name ? 'border-red-500' : ''}
                />
                {errors.name && (
                  <p className="text-red-500 text-xs flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    {errors.name}
                  </p>
                )}
              </div>

              {/* 描述 */}
              <div className="space-y-2">
                <Label className="text-sm font-semibold text-gray-700">描述 (可选)</Label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => updateFormData({ description: e.target.value })}
                  placeholder="账户用途说明..."
                  rows={3}
                  className="resize-none"
                />
              </div>

              {/* 账户类型 */}
              <div className="space-y-3">
                <Label className="text-sm font-semibold text-gray-700">账户类型</Label>
                <RadioGroup
                  value={formData.accountType}
                  onValueChange={(value: 'shared' | 'dedicated') => updateFormData({ accountType: value })}
                  className="flex gap-6"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="shared" id="shared" />
                    <Label htmlFor="shared">共享账户</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="dedicated" id="dedicated" />
                    <Label htmlFor="dedicated">专属账户</Label>
                  </div>
                </RadioGroup>
                <p className="text-xs text-gray-500">
                  共享账户：供所有API Key使用；专属账户：仅供特定API Key使用
                </p>
              </div>

              {/* Gemini 项目编号 */}
              {formData.serviceType === 'gemini' && (
                <div className="space-y-2">
                  <Label className="text-sm font-semibold text-gray-700">项目编号 (可选)</Label>
                  <Input
                    value={formData.projectId}
                    onChange={(e) => {
                      updateFormData({ projectId: e.target.value });
                      clearError('projectId');
                    }}
                    placeholder="例如：123456789012（纯数字）"
                    className={errors.projectId ? 'border-red-500' : ''}
                  />
                  {errors.projectId && (
                    <p className="text-red-500 text-xs flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      {errors.projectId}
                    </p>
                  )}
                  <Card className="bg-yellow-50 border-yellow-200">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 text-yellow-600 mt-0.5 flex-shrink-0" />
                        <div className="text-xs text-yellow-700">
                          <p className="font-medium mb-1">Google Cloud/Workspace 账号需要提供项目编号</p>
                          <p className="mb-2">某些 Google 账号（特别是绑定了 Google Cloud 的账号）会被识别为 Workspace 账号，需要提供额外的项目编号。</p>
                          <div className="bg-white p-2 rounded border border-yellow-300 mb-2">
                            <p className="font-medium mb-1">如何获取项目编号：</p>
                            <ol className="list-decimal list-inside space-y-1 text-xs">
                              <li>访问 Google Cloud Console</li>
                              <li>复制项目编号（Project Number），通常是12位纯数字</li>
                              <li className="text-red-600">⚠️ 注意：不要复制项目ID，要复制项目编号！</li>
                            </ol>
                          </div>
                          <p><strong>提示：</strong>如果您的账号是普通个人账号（未绑定 Google Cloud），请留空此字段。</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* 手动输入 Token */}
              {formData.authType === 'api_key' && (
                <Card className="bg-blue-50 border-blue-200">
                  <CardHeader className="pb-4">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center flex-shrink-0">
                        <Key className="w-4 h-4 text-white" />
                      </div>
                      <div>
                        <CardTitle className="text-base text-blue-900 mb-2">手动输入 Token</CardTitle>
                        <p className="text-sm text-blue-800 mb-2">
                          请输入有效的 {formData.serviceType === 'claude' ? 'Claude' : 
                                         formData.serviceType === 'gemini' ? 'Gemini' : 'AMPCode'} Access Token。
                          如果您有 Refresh Token，建议也一并填写以支持自动刷新。
                        </p>
                        <div className="bg-white/80 rounded-lg p-3 border border-blue-300">
                          <p className="text-sm text-blue-900 font-medium mb-1">获取 Access Token 的方法：</p>
                          <p className="text-xs text-blue-800">
                            {formData.serviceType === 'claude' && 
                              '请从已登录 Claude Code 的机器上获取 ~/.claude/.credentials.json 文件中的凭证，请勿使用 Claude 官网 API Keys 页面的密钥。'}
                            {formData.serviceType === 'gemini' && 
                              '请从已登录 Gemini CLI 的机器上获取 ~/.config/gemini/credentials.json 文件中的凭证。'}
                            {formData.serviceType === 'ampcode' && 
                              '请从已登录 AMPCode CLI 的机器上获取相应的凭证文件。'}
                          </p>
                        </div>
                        <p className="text-xs text-blue-600 mt-2">💡 如果未填写 Refresh Token，Token 过期后需要手动更新。</p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label className="text-sm font-semibold text-gray-700">Access Token *</Label>
                      <Textarea
                        value={formData.accessToken}
                        onChange={(e) => {
                          updateFormData({ accessToken: e.target.value });
                          clearError('accessToken');
                        }}
                        placeholder="请输入 Access Token..."
                        rows={4}
                        className={`resize-none font-mono text-xs ${errors.accessToken ? 'border-red-500' : ''}`}
                      />
                      {errors.accessToken && (
                        <p className="text-red-500 text-xs flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" />
                          {errors.accessToken}
                        </p>
                      )}
                    </div>
                    
                    <div className="space-y-2">
                      <Label className="text-sm font-semibold text-gray-700">Refresh Token (可选)</Label>
                      <Textarea
                        value={formData.refreshToken}
                        onChange={(e) => updateFormData({ refreshToken: e.target.value })}
                        placeholder="请输入 Refresh Token..."
                        rows={4}
                        className="resize-none font-mono text-xs"
                      />
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* 代理设置 */}
              <ProxyConfig
                groupId={groupId}
                value={formData.proxy}
                onChange={handleProxyChange}
              />

              {/* 操作按钮 */}
              <div className="flex gap-3 pt-4">
                <Button variant="outline" onClick={onClose} className="flex-1">
                  取消
                </Button>
                {formData.authType === 'oauth' ? (
                  <Button onClick={nextStep} className="flex-1">
                    下一步
                  </Button>
                ) : (
                  <Button onClick={createAccount} disabled={loading} className="flex-1">
                    {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    {loading ? '创建中...' : '创建'}
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* 步骤2: OAuth授权 */}
          {oauthStep === 2 && formData.authType === 'oauth' && !isEdit && (
            <OAuthFlow
              platform={formData.serviceType}
              proxy={formData.proxy}
              onSuccess={handleOAuthSuccess}
              onBack={() => setOauthStep(1)}
            />
          )}

          {/* 编辑模式 */}
          {isEdit && (
            <div className="space-y-6">
              {/* 账户名称 */}
              <div className="space-y-2">
                <Label className="text-sm font-semibold text-gray-700">账户名称</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => {
                    updateFormData({ name: e.target.value });
                    clearError('name');
                  }}
                  placeholder="为账户设置一个易识别的名称"
                  className={errors.name ? 'border-red-500' : ''}
                />
                {errors.name && (
                  <p className="text-red-500 text-xs flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    {errors.name}
                  </p>
                )}
              </div>

              {/* 描述 */}
              <div className="space-y-2">
                <Label className="text-sm font-semibold text-gray-700">描述 (可选)</Label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => updateFormData({ description: e.target.value })}
                  placeholder="账户用途说明..."
                  rows={3}
                  className="resize-none"
                />
              </div>

              {/* 账户类型 */}
              <div className="space-y-3">
                <Label className="text-sm font-semibold text-gray-700">账户类型</Label>
                <RadioGroup
                  value={formData.accountType}
                  onValueChange={(value: 'shared' | 'dedicated') => updateFormData({ accountType: value })}
                  className="flex gap-6"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="shared" id="edit-shared" />
                    <Label htmlFor="edit-shared">共享账户</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="dedicated" id="edit-dedicated" />
                    <Label htmlFor="edit-dedicated">专属账户</Label>
                  </div>
                </RadioGroup>
                <p className="text-xs text-gray-500">
                  共享账户：供所有API Key使用；专属账户：仅供特定API Key使用
                </p>
              </div>

              {/* Gemini 项目编号 */}
              {formData.serviceType === 'gemini' && (
                <div className="space-y-2">
                  <Label className="text-sm font-semibold text-gray-700">项目编号 (可选)</Label>
                  <Input
                    value={formData.projectId}
                    onChange={(e) => {
                      updateFormData({ projectId: e.target.value });
                      clearError('projectId');
                    }}
                    placeholder="例如：123456789012（纯数字）"
                    className={errors.projectId ? 'border-red-500' : ''}
                  />
                  {errors.projectId && (
                    <p className="text-red-500 text-xs flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      {errors.projectId}
                    </p>
                  )}
                  <p className="text-xs text-gray-500">
                    Google Cloud/Workspace 账号可能需要提供项目编号
                  </p>
                </div>
              )}

              {/* Token 更新 */}
              <Card className="bg-yellow-50 border-yellow-200">
                <CardHeader className="pb-4">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-yellow-500 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Key className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-base text-yellow-900 mb-2">更新 Token</CardTitle>
                      <p className="text-sm text-yellow-800 mb-2">可以更新 Access Token 和 Refresh Token。为了安全起见，不会显示当前的 Token 值。</p>
                      <p className="text-xs text-yellow-600">💡 留空表示不更新该字段。</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold text-gray-700">新的 Access Token</Label>
                    <Textarea
                      value={formData.accessToken}
                      onChange={(e) => updateFormData({ accessToken: e.target.value })}
                      placeholder="留空表示不更新..."
                      rows={4}
                      className="resize-none font-mono text-xs"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold text-gray-700">新的 Refresh Token</Label>
                    <Textarea
                      value={formData.refreshToken}
                      onChange={(e) => updateFormData({ refreshToken: e.target.value })}
                      placeholder="留空表示不更新..."
                      rows={4}
                      className="resize-none font-mono text-xs"
                    />
                  </div>
                </CardContent>
              </Card>

              {/* 代理设置 */}
              <ProxyConfig
                groupId={groupId}
                value={formData.proxy}
                onChange={handleProxyChange}
              />

              {/* 操作按钮 */}
              <div className="flex gap-3 pt-4">
                <Button variant="outline" onClick={onClose} className="flex-1">
                  取消
                </Button>
                <Button onClick={updateAccount} disabled={loading} className="flex-1">
                  {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  {loading ? '更新中...' : '更新'}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
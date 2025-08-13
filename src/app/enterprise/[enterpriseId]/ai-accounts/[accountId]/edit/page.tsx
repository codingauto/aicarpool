'use client';

/**
 * 企业AI账号编辑页面 - 优化版本
 * 
 * 功能：
 * - 支持多平台AI服务账号编辑 (Claude, Gemini, Claude Console, 通义千问, Cursor Agent, OpenAI Codex, AmpCode)
 * - 统一的组件化架构与新增页面保持一致
 * - 账户类型管理 (共享/专属)
 * - 代理配置支持
 * - OAuth和手动Token配置编辑
 * - 新平台API Key配置支持
 */

import React, { useState, useEffect, use } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronLeft, Building2, User, AlertTriangle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEnterpriseContext } from '@/contexts/enterprise-context';
import { toast } from 'sonner';

// 组件导入
import { PlatformSelector } from '@/components/ai-accounts/PlatformSelector';
import { BasicInfoForm } from '@/components/ai-accounts/BasicInfoForm';
import { ClaudeConsoleConfig } from '@/components/ai-accounts/ClaudeConsoleConfig';
import { ManualTokenInput } from '@/components/ai-accounts/ManualTokenInput';
import { ProxyConfigComponent } from '@/components/ai-accounts/ProxyConfigComponent';
import { ApiKeyConfig } from '@/components/ai-accounts/ApiKeyConfig';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';

// hooks 导入
import { useConfirm } from '@/hooks/useConfirm';

// 类型导入
import { AccountForm, FormErrors } from '@/types/ai-account';

export default function EditAiAccountPage({ 
  params 
}: { 
  params: Promise<{ enterpriseId: string; accountId: string }> 
}) {
  const { enterpriseId, accountId } = use(params);
  const router = useRouter();
  const { currentEnterprise, hasRole } = useEnterpriseContext();
  const { confirm, confirmState, handleConfirm, handleCancel, handleOpenChange } = useConfirm();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [originalData, setOriginalData] = useState<any>(null);

  // 表单数据 - 使用与新增页面相同的结构
  const [form, setForm] = useState<AccountForm>({
    platform: 'claude',
    addType: 'oauth',
    name: '',
    description: '',
    accountType: 'shared',
    projectId: '',
    accessToken: '',
    refreshToken: '',
    proxy: {
      enabled: false,
      type: 'socks5',
      host: '',
      port: '',
      username: '',
      password: ''
    },
    apiUrl: '',
    apiKey: '',
    priority: 50,
    supportedModels: '',
    userAgent: '',
    rateLimitDuration: 60
  });

  // 权限检查
  useEffect(() => {
    if (!hasRole('owner') && !hasRole('admin')) {
      router.push(`/enterprise/${enterpriseId}/dashboard`);
      return;
    }
  }, [hasRole, enterpriseId, router]);

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
          setOriginalData(account);
          
          // 根据不同平台设置表单数据
          let platform: 'claude' | 'gemini' | 'claude-console' | 'qwen' | 'cursor-agent' | 'codex' | 'ampcode' = 'claude';
          let addType: 'oauth' | 'manual' = 'oauth';
          
          // 平台检测逻辑
          if (account.claudeAiOauth) {
            platform = 'claude';
            addType = 'oauth';
          } else if (account.geminiOauth) {
            platform = 'gemini';
            addType = 'oauth';
          } else if (account.apiUrl && account.apiKey) {
            // 根据数据库中的平台字段来判断具体平台
            if (account.platform === 'claude_console') {
              platform = 'claude-console';
            } else if (account.platform === 'qwen') {
              platform = 'qwen';
            } else if (account.platform === 'cursor-agent') {
              platform = 'cursor-agent';
            } else if (account.platform === 'codex') {
              platform = 'codex';
            } else if (account.platform === 'ampcode') {
              platform = 'ampcode';
            } else {
              // 默认为claude-console以保持向后兼容
              platform = 'claude-console';
            }
            addType = 'manual';
          }

          setForm({
            platform,
            addType,
            name: account.name || '',
            description: account.description || '',
            accountType: account.accountType || 'shared',
            projectId: account.projectId || '',
            accessToken: account.claudeAiOauth?.accessToken ? '••••••••' : account.geminiOauth?.access_token ? '••••••••' : '',
            refreshToken: account.claudeAiOauth?.refreshToken ? '••••••••' : account.geminiOauth?.refresh_token ? '••••••••' : '',
            proxy: {
              enabled: !!account.proxy,
              type: account.proxy?.type || 'socks5',
              host: account.proxy?.host || '',
              port: account.proxy?.port?.toString() || '',
              username: account.proxy?.username || '',
              password: account.proxy?.password ? '••••••••' : ''
            },
            apiUrl: account.apiUrl || '',
            apiKey: account.apiKey ? '••••••••' : '',
            priority: account.priority || 50,
            supportedModels: account.supportedModels ? account.supportedModels.join('\n') : '',
            userAgent: account.userAgent || '',
            rateLimitDuration: account.rateLimitDuration || 60
          });
          setErrors({});
        } else {
          toast.error(result.message || '获取账号信息失败');
        }
      } else {
        toast.error('获取账号信息失败');
      }
    } catch (error) {
      console.error('获取账号信息失败:', error);
      toast.error('获取账号信息失败');
    } finally {
      setLoading(false);
    }
  };

  // 表单验证
  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};
    
    if (!form.name.trim()) {
      newErrors.name = '请填写账户名称';
    }

    if (['claude-console', 'qwen', 'cursor-agent', 'codex', 'ampcode'].includes(form.platform)) {
      if (!form.apiUrl?.trim()) {
        newErrors.apiUrl = '请填写 API URL';
      }
      if (!form.apiKey?.trim() || form.apiKey === '••••••••') {
        newErrors.apiKey = '请填写 API Key';
      }
    } else if (form.addType === 'manual' && (!form.accessToken?.trim() || form.accessToken === '••••••••')) {
      newErrors.accessToken = '请填写 Access Token';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // 辅助函数
  const updateForm = (updates: Partial<AccountForm>) => {
    setForm(prev => ({ ...prev, ...updates }));
  };

  // 更新账户
  const updateAccount = async () => {
    if (!validateForm()) return;

    try {
      setSaving(true);
      const token = localStorage.getItem('token');
      
      const data: any = {
        name: form.name,
        description: form.description,
        accountType: form.accountType,
        priority: form.priority,
        proxy: form.proxy.enabled ? form.proxy : null
      };

      if (form.platform === 'claude') {
        // 如果Token发生变化，更新Claude OAuth配置
        if (form.accessToken && form.accessToken !== '••••••••') {
          const expiresInMs = form.refreshToken && form.refreshToken !== '••••••••' ? (10 * 60 * 1000) : (365 * 24 * 60 * 60 * 1000);
          data.claudeAiOauth = {
            accessToken: form.accessToken,
            refreshToken: form.refreshToken && form.refreshToken !== '••••••••' ? form.refreshToken : (originalData?.claudeAiOauth?.refreshToken || ''),
            expiresAt: Date.now() + expiresInMs,
            scopes: ['user:inference']
          };
        }
        data.priority = form.priority;
      } else if (form.platform === 'gemini') {
        // 如果Token发生变化，更新Gemini OAuth配置
        if (form.accessToken && form.accessToken !== '••••••••') {
          const expiresInMs = form.refreshToken && form.refreshToken !== '••••••••' ? (10 * 60 * 1000) : (365 * 24 * 60 * 60 * 1000);
          data.geminiOauth = {
            access_token: form.accessToken,
            refresh_token: form.refreshToken && form.refreshToken !== '••••••••' ? form.refreshToken : (originalData?.geminiOauth?.refresh_token || ''),
            scope: 'https://www.googleapis.com/auth/cloud-platform',
            token_type: 'Bearer',
            expiry_date: Date.now() + expiresInMs
          };
        }
        if (form.projectId) {
          data.projectId = form.projectId;
        }
      } else if (['claude-console', 'qwen', 'cursor-agent', 'codex', 'ampcode'].includes(form.platform)) {
        // 新平台统一处理
        // 只有当API Key发生变化时才更新
        if (form.apiKey && form.apiKey !== '••••••••') {
          data.apiKey = form.apiKey;
        }
        if (form.apiUrl) {
          data.apiUrl = form.apiUrl;
        }
        data.priority = form.priority;
        data.supportedModels = form.supportedModels
          ? form.supportedModels.split('\n').filter(m => m.trim())
          : [];
        data.userAgent = form.userAgent || null;
        data.rateLimitDuration = form.rateLimitDuration;
      }

      const response = await fetch(`/api/enterprises/${enterpriseId}/ai-accounts/${accountId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          toast.success('账户更新成功');
          router.push(`/enterprise/${enterpriseId}/ai-resources`);
        } else {
          toast.error(result.message || '账户更新失败');
        }
      } else {
        toast.error('账户更新失败');
      }
    } catch (error) {
      console.error('账户更新失败:', error);
      toast.error('账户更新失败');
    } finally {
      setSaving(false);
    }
  };

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

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        {/* 面包屑和标题 */}
        <div className="flex items-center gap-4 mb-6">
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => router.push(`/enterprise/${enterpriseId}/ai-resources`)}
          >
            <ChevronLeft className="w-4 h-4 mr-2" />
            返回AI资源
          </Button>
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Building2 className="w-4 h-4" />
            <span>{currentEnterprise?.name || '未知企业'}</span>
            <span>/</span>
            <span>AI账户管理</span>
            <span>/</span>
            <span>编辑账户</span>
          </div>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
                <User className="w-5 h-5 text-white" />
              </div>
              <div>
                <CardTitle className="text-xl">编辑AI账户</CardTitle>
                <p className="text-gray-600 text-sm mt-1">修改企业AI服务账户配置</p>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* 平台选择 */}
            <PlatformSelector 
              platform={form.platform}
              onPlatformChange={(platform) => updateForm({ platform })}
            />

            {/* 基本信息表单 */}
            <BasicInfoForm
              form={form}
              errors={errors}
              platform={form.platform}
              onFormChange={updateForm}
            />

            {/* Claude Console 特定配置 */}
            {form.platform === 'claude-console' && (
              <ClaudeConsoleConfig
                form={form}
                errors={errors}
                onFormChange={updateForm}
              />
            )}

            {/* 新平台API配置 */}
            {['qwen', 'cursor-agent', 'codex', 'ampcode'].includes(form.platform) && (
              <ApiKeyConfig
                form={form}
                errors={errors}
                onFormChange={updateForm}
                platform={form.platform}
                platformName={
                  form.platform === 'qwen' ? '通义千问' :
                  form.platform === 'cursor-agent' ? 'Cursor Agent' :
                  form.platform === 'codex' ? 'OpenAI Codex' :
                  form.platform === 'ampcode' ? 'AmpCode' : ''
                }
              />
            )}

            {/* 手动输入 Token */}
            <ManualTokenInput
              platform={form.platform as 'claude' | 'gemini'}
              form={form}
              errors={errors}
              onFormChange={updateForm}
              show={form.addType === 'manual' && !['claude-console', 'qwen', 'cursor-agent', 'codex', 'ampcode'].includes(form.platform)}
            />

            {/* 代理设置 */}
            <ProxyConfigComponent
              proxy={form.proxy}
              onProxyChange={(proxy) => updateForm({ proxy })}
            />

            {/* 操作按钮 */}
            <div className="flex gap-3 pt-4">
              <Button 
                variant="outline" 
                onClick={() => router.push(`/enterprise/${enterpriseId}/ai-resources`)}
                className="flex-1"
              >
                取消
              </Button>
              <Button 
                onClick={updateAccount} 
                disabled={saving}
                className="flex-1"
              >
                {saving ? '保存中...' : '保存更改'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 确认弹窗 */}
      <ConfirmDialog
        open={confirmState.open}
        onOpenChange={handleOpenChange}
        title={confirmState.title}
        description={confirmState.description}
        confirmText={confirmState.confirmText}
        cancelText={confirmState.cancelText}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
        variant={confirmState.variant}
      />
    </div>
  );
}
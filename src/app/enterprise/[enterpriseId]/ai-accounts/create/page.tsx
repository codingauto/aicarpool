'use client';

/**
 * 企业AI账号创建页面 - 优化版本
 * 
 * 功能：
 * - 支持多平台AI服务账号创建 (Claude, Gemini, Claude Console)
 * - 分步骤创建流程 (基本信息 → OAuth认证)
 * - 账户类型管理 (共享/专属)
 * - 代理配置支持
 * - OAuth集成与手动Token输入
 */

import React, { useState, useEffect, use } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronLeft, Building2, User } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEnterpriseContext } from '@/contexts/enterprise-context';
import { toast } from 'sonner';

// 组件导入
import { PlatformSelector } from '@/components/ai-accounts/PlatformSelector';
import { AddTypeSelector } from '@/components/ai-accounts/AddTypeSelector';
import { BasicInfoForm } from '@/components/ai-accounts/BasicInfoForm';
import { ClaudeConsoleConfig } from '@/components/ai-accounts/ClaudeConsoleConfig';
import { ManualTokenInput } from '@/components/ai-accounts/ManualTokenInput';
import { ProxyConfigComponent } from '@/components/ai-accounts/ProxyConfigComponent';
import { OAuthFlow } from '@/components/ai-accounts/OAuthFlow';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';

// hooks 导入
import { useConfirm } from '@/hooks/useConfirm';

// 类型导入
import { AccountForm, FormErrors } from '@/types/ai-account';

export default function CreateAiAccountPage({ params }: { params: Promise<{ enterpriseId: string }> }) {
  const { enterpriseId } = use(params);
  const router = useRouter();
  const { currentEnterprise, hasRole } = useEnterpriseContext();
  const { confirm, confirmState, handleConfirm, handleCancel, handleOpenChange } = useConfirm();

  // 表单状态
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});

  // 表单数据
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

  // 表单验证
  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};
    
    if (!form.name.trim()) {
      newErrors.name = '请填写账户名称';
    }

    if (form.platform === 'claude-console') {
      if (!form.apiUrl?.trim()) {
        newErrors.apiUrl = '请填写 API URL';
      }
      if (!form.apiKey?.trim()) {
        newErrors.apiKey = '请填写 API Key';
      }
    } else if (form.addType === 'manual' && !form.accessToken?.trim()) {
      newErrors.accessToken = '请填写 Access Token';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // 创建账户
  const createAccount = async (oauthData?: any) => {
    if (!validateForm()) return;

    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      
      const data: any = {
        name: form.name,
        description: form.description,
        accountType: form.accountType,
        priority: form.priority,
        proxy: form.proxy.enabled ? form.proxy : null
      };

      if (form.platform === 'claude') {
        if (oauthData) {
          data.claudeAiOauth = oauthData;
        } else if (form.addType === 'manual') {
          const expiresInMs = form.refreshToken ? (10 * 60 * 1000) : (365 * 24 * 60 * 60 * 1000);
          data.claudeAiOauth = {
            accessToken: form.accessToken,
            refreshToken: form.refreshToken || '',
            expiresAt: Date.now() + expiresInMs,
            scopes: ['user:inference']
          };
        }
        data.priority = form.priority;
      } else if (form.platform === 'gemini') {
        if (oauthData) {
          data.geminiOauth = oauthData;
        } else if (form.addType === 'manual') {
          const expiresInMs = form.refreshToken ? (10 * 60 * 1000) : (365 * 24 * 60 * 60 * 1000);
          data.geminiOauth = {
            access_token: form.accessToken,
            refresh_token: form.refreshToken || '',
            scope: 'https://www.googleapis.com/auth/cloud-platform',
            token_type: 'Bearer',
            expiry_date: Date.now() + expiresInMs
          };
        }
        if (form.projectId) {
          data.projectId = form.projectId;
        }
      } else if (form.platform === 'claude-console') {
        data.apiUrl = form.apiUrl;
        data.apiKey = form.apiKey;
        data.priority = form.priority;
        data.supportedModels = form.supportedModels
          ? form.supportedModels.split('\n').filter(m => m.trim())
          : [];
        data.userAgent = form.userAgent || null;
        data.rateLimitDuration = form.rateLimitDuration;
      }

      const response = await fetch(`/api/enterprises/${enterpriseId}/ai-accounts`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          toast.success('账户创建成功');
          router.push(`/enterprise/${enterpriseId}/ai-resources`);
        } else {
          toast.error(result.message || '账户创建失败');
        }
      } else {
        toast.error('账户创建失败');
      }
    } catch (error) {
      console.error('账户创建失败:', error);
      toast.error('账户创建失败');
    } finally {
      setLoading(false);
    }
  };

  // 下一步
  const nextStep = async () => {
    if (!validateForm()) return;
    
    // 对于Gemini账户，检查项目 ID
    if (form.platform === 'gemini' && form.addType === 'oauth') {
      if (!form.projectId || form.projectId.trim() === '') {
        const confirmed = await confirm({
          title: 'localhost:4000 显示',
          description: '您未设置项目 ID，这可能导致某些 Google Cloud/Workspace 账号无法正常使用。\n\n如果您确定使用的是普通个人 Google 账号，可以继续。\n如果使用的是 Google Cloud/Workspace 账号，建议返回设置项目 ID。\n\n是否继续？',
          confirmText: '确定',
          cancelText: '取消'
        });
        
        if (!confirmed) {
          return;
        }
      }
    }
    
    setCurrentStep(2);
  };

  // 辅助函数
  const updateForm = (updates: Partial<AccountForm>) => {
    setForm(prev => ({ ...prev, ...updates }));
  };

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
            <span>创建账户</span>
          </div>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-green-600 rounded-lg flex items-center justify-center">
                <User className="w-5 h-5 text-white" />
              </div>
              <div>
                <CardTitle className="text-xl">添加AI账户</CardTitle>
                <p className="text-gray-600 text-sm mt-1">配置企业AI服务账户</p>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* 步骤指示器 */}
            {form.addType === 'oauth' && form.platform !== 'claude-console' && (
              <div className="flex items-center justify-center mb-8">
                <div className="flex items-center space-x-4">
                  <div className="flex items-center">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
                      currentStep >= 1 ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-500'
                    }`}>
                      1
                    </div>
                    <span className="ml-2 text-sm font-medium text-gray-700">基本信息</span>
                  </div>
                  <div className="w-8 h-0.5 bg-gray-300" />
                  <div className="flex items-center">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
                      currentStep >= 2 ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-500'
                    }`}>
                      2
                    </div>
                    <span className="ml-2 text-sm font-medium text-gray-700">授权认证</span>
                  </div>
                </div>
              </div>
            )}

            {/* 步骤1: 基本信息 */}
            {currentStep === 1 && (
              <div className="space-y-6">
                {/* 平台选择 */}
                <PlatformSelector 
                  platform={form.platform}
                  onPlatformChange={(platform) => updateForm({ platform })}
                />

                {/* 添加方式 */}
                <AddTypeSelector 
                  addType={form.addType}
                  onAddTypeChange={(addType) => updateForm({ addType })}
                  showSelector={form.platform !== 'claude-console'}
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

                {/* 手动输入 Token */}
                <ManualTokenInput
                  platform={form.platform as 'claude' | 'gemini'}
                  form={form}
                  errors={errors}
                  onFormChange={updateForm}
                  show={form.addType === 'manual' && form.platform !== 'claude-console'}
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
                  {form.addType === 'oauth' && form.platform !== 'claude-console' ? (
                    <Button 
                      onClick={nextStep} 
                      disabled={loading}
                      className="flex-1"
                    >
                      下一步
                    </Button>
                  ) : (
                    <Button 
                      onClick={() => createAccount()} 
                      disabled={loading}
                      className="flex-1"
                    >
                      {loading ? '创建中...' : '创建'}
                    </Button>
                  )}
                </div>
              </div>
            )}

            {/* 步骤2: OAuth认证 */}
            {currentStep === 2 && form.addType === 'oauth' && (
              <div className="space-y-6">
                <OAuthFlow
                  platform={form.platform as 'claude' | 'gemini'}
                  proxy={form.proxy}
                  enterpriseId={enterpriseId}
                  onComplete={createAccount}
                />

                {/* 操作按钮 */}
                <div className="flex gap-3 pt-4">
                  <Button 
                    variant="outline" 
                    onClick={() => setCurrentStep(1)}
                    className="flex-1"
                  >
                    上一步
                  </Button>
                </div>
              </div>
            )}
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

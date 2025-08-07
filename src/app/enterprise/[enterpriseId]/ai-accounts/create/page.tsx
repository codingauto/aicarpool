'use client';

/**
 * 企业API Key创建页面 - 复刻CreateApiKeyModal功能
 * 
 * 功能：
 * - 支持单个和批量创建API Key
 * - 标签管理功能
 * - 速率限制和费用限制配置
 * - 过期时间管理
 * - 服务权限和账号绑定
 * - 模型限制和客户端限制
 * - 完整的表单验证
 */

import React, { useState, use, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { ArrowLeft, Save, ChevronLeft, Building2, Plus, X, RefreshCw, Info } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEnterpriseContext } from '@/contexts/enterprise-context';
import { ApiKeySuccessDialog } from '@/components/ui/api-key-success-dialog';

interface CreateApiKeyForm {
  // 创建类型配置
  createType: 'single' | 'batch';
  batchCount: number;
  
  // 基本信息
  name: string;
  description: string;
  tags: string[];
  groupId: string; // 添加拼车组ID字段
  
  // 限制配置
  tokenLimit: string;
  rateLimitWindow: string;
  rateLimitRequests: string;
  concurrencyLimit: string;
  dailyCostLimit: string;
  
  // 过期设置
  expireDuration: string;
  customExpireDate: string;
  expiresAt: string | null;
  
  // 权限配置
  permissions: 'all' | 'claude' | 'gemini';
  claudeAccountId: string;
  geminiAccountId: string;
  
  // 高级限制
  enableModelRestriction: boolean;
  restrictedModels: string[];
  modelInput: string;
  enableClientRestriction: boolean;
  allowedClients: string[];
}

interface Account {
  id: string;
  name: string;
  status: 'active' | 'inactive';
  platform: string;
  accountType: 'dedicated' | 'shared';
  createdAt: string;
}

interface AccountGroup {
  id: string;
  name: string;
  platform: string;
  memberCount: number;
}

interface SupportedClient {
  id: string;
  name: string;
  description: string;
}

export default function CreateApiKeyPage({ params }: { params: Promise<{ enterpriseId: string }> }) {
  const { enterpriseId } = use(params);
  const router = useRouter();
  const { currentEnterprise, hasRole } = useEnterpriseContext();
  
  // 状态管理
  const [loading, setLoading] = useState(false);
  const [accountsLoading, setAccountsLoading] = useState(false);
  const [error, setError] = useState('');
  const [errors, setErrors] = useState<{ name?: string }>({});
  
  // 成功弹窗状态
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [createdApiKey, setCreatedApiKey] = useState<{
    name: string;
    key: string;
  } | null>(null);
  
  // 标签管理
  const [newTag, setNewTag] = useState('');
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  
  // 账号数据
  const [accounts, setAccounts] = useState<{
    claude: Account[];
    gemini: Account[];
    claudeGroups: AccountGroup[];
    geminiGroups: AccountGroup[];
  }>({
    claude: [],
    gemini: [],
    claudeGroups: [],
    geminiGroups: []
  });
  
  // 拼车组数据
  const [groups, setGroups] = useState<{
    id: string;
    name: string;
    description: string;
    memberCount: number;
    status: string;
  }[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(false);
  
  // 客户端配置
  const [supportedClients, setSupportedClients] = useState<SupportedClient[]>([]);
  
  // 表单数据
  const [form, setForm] = useState<CreateApiKeyForm>({
    createType: 'single',
    batchCount: 10,
    name: '',
    description: '',
    tags: [],
    groupId: '', // 添加拼车组ID字段
    tokenLimit: '',
    rateLimitWindow: '',
    rateLimitRequests: '',
    concurrencyLimit: '',
    dailyCostLimit: '',
    expireDuration: 'never',
    customExpireDate: '',
    expiresAt: null,
    permissions: 'all',
    claudeAccountId: 'shared',
    geminiAccountId: 'shared',
    enableModelRestriction: false,
    restrictedModels: [],
    modelInput: '',
    enableClientRestriction: false,
    allowedClients: []
  });

  // 检查权限 - 放在所有Hook之后
  const hasPermission = hasRole('owner') || hasRole('admin');

  // 刷新账号列表
  const refreshAccounts = useCallback(async () => {
    setAccountsLoading(true);
    try {
      const token = localStorage.getItem('token');
      const [claudeResponse, geminiResponse, groupsResponse] = await Promise.all([
        fetch(`/api/enterprises/${enterpriseId}/claude-accounts`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch(`/api/enterprises/${enterpriseId}/gemini-accounts`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch(`/api/enterprises/${enterpriseId}/account-groups`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
      ]);

      const claudeData = claudeResponse.ok ? await claudeResponse.json() : { data: [] };
      const geminiData = geminiResponse.ok ? await geminiResponse.json() : { data: [] };
      const groupsData = groupsResponse.ok ? await groupsResponse.json() : { data: [] };

      setAccounts({
        claude: claudeData.data || [],
        gemini: geminiData.data || [],
        claudeGroups: (groupsData.data || []).filter((g: AccountGroup) => g.platform === 'claude'),
        geminiGroups: (groupsData.data || []).filter((g: AccountGroup) => g.platform === 'gemini')
      });
    } catch (error) {
      console.error('刷新账号列表失败:', error);
    } finally {
      setAccountsLoading(false);
    }
  }, [enterpriseId]);

  // 加载拼车组列表
  const loadGroups = useCallback(async () => {
    setGroupsLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/enterprises/${enterpriseId}/groups`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setGroups(data.data || []);
        }
      }
    } catch (error) {
      console.error('加载拼车组列表失败:', error);
    } finally {
      setGroupsLoading(false);
    }
  }, [enterpriseId]);

  const loadInitialData = useCallback(async () => {
    try {
      // 加载支持的客户端
      const clientsResponse = await fetch(`/api/enterprises/${enterpriseId}/supported-clients`);
      if (clientsResponse.ok) {
        const clientsData = await clientsResponse.json();
        setSupportedClients(clientsData.data || []);
      }

      // 加载已存在的标签
      const tagsResponse = await fetch(`/api/enterprises/${enterpriseId}/api-keys/tags`);
      if (tagsResponse.ok) {
        const tagsData = await tagsResponse.json();
        setAvailableTags(tagsData.data || []);
      }

      // 加载拼车组数据
      await loadGroups();

      // 加载账号数据
      await refreshAccounts();
    } catch (error) {
      console.error('初始化数据加载失败:', error);
    }
  }, [enterpriseId, refreshAccounts, loadGroups]);

  // 组件初始化
  useEffect(() => {
    if (hasPermission) {
      loadInitialData();
    }
  }, [hasPermission, loadInitialData]);

  // 如果没有权限，显示权限不足页面
  if (!hasPermission) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center py-12">
          <h3 className="text-lg font-medium text-gray-900 mb-2">权限不足</h3>
          <p className="text-gray-600 mb-4">您没有权限创建API Key</p>
          <Button onClick={() => router.back()}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            返回
          </Button>
        </div>
      </div>
    );
  }

  // 表单输入处理
  const handleInputChange = (field: keyof CreateApiKeyForm, value: any) => {
    setForm(prev => ({
      ...prev,
      [field]: value
    }));
    // 清除相关错误
    if (field === 'name' && errors.name) {
      setErrors(prev => ({ ...prev, name: undefined }));
    }
  };

  // 标签管理
  const addTag = () => {
    if (newTag && newTag.trim()) {
      const tag = newTag.trim();
      if (!form.tags.includes(tag)) {
        handleInputChange('tags', [...form.tags, tag]);
      }
      setNewTag('');
    }
  };

  const removeTag = (index: number) => {
    const newTags = form.tags.filter((_, i) => i !== index);
    handleInputChange('tags', newTags);
  };

  const selectTag = (tag: string) => {
    if (!form.tags.includes(tag)) {
      handleInputChange('tags', [...form.tags, tag]);
    }
  };

  // 过期时间处理
  const updateExpireAt = () => {
    if (!form.expireDuration || form.expireDuration === 'never') {
      handleInputChange('expiresAt', null);
      return;
    }
    
    if (form.expireDuration === 'custom') {
      return;
    }
    
    const now = new Date();
    const match = form.expireDuration.match(/(\d+)([dhmy])/);
    
    if (match) {
      const [, value, unit] = match;
      const num = parseInt(value);
      
      switch (unit) {
        case 'd':
          now.setDate(now.getDate() + num);
          break;
        case 'h':
          now.setHours(now.getHours() + num);
          break;
        case 'm':
          now.setMonth(now.getMonth() + num);
          break;
        case 'y':
          now.setFullYear(now.getFullYear() + num);
          break;
      }
      
      handleInputChange('expiresAt', now.toISOString());
    }
  };

  const updateCustomExpireAt = () => {
    if (form.customExpireDate) {
      handleInputChange('expiresAt', new Date(form.customExpireDate).toISOString());
    }
  };

  // 模型限制管理
  const addRestrictedModel = () => {
    if (form.modelInput && !form.restrictedModels.includes(form.modelInput)) {
      handleInputChange('restrictedModels', [...form.restrictedModels, form.modelInput]);
      handleInputChange('modelInput', '');
    }
  };

  const removeRestrictedModel = (index: number) => {
    const newModels = form.restrictedModels.filter((_, i) => i !== index);
    handleInputChange('restrictedModels', newModels);
  };

  // 格式化过期日期
  const formatExpireDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // 计算最小日期时间
  const getMinDateTime = () => {
    const now = new Date();
    now.setMinutes(now.getMinutes() + 1);
    return now.toISOString().slice(0, 16);
  };

  // 获取未选择的标签
  const getUnselectedTags = () => {
    return availableTags.filter(tag => !form.tags.includes(tag));
  };

  // 表单提交
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // 验证表单
    setErrors({});
    
    if (!form.name || !form.name.trim()) {
      setErrors({ name: '请输入API Key名称' });
      return;
    }
    
    if (!form.groupId) {
      setError('请选择所属拼车组');
      return;
    }
    
    // 批量创建时验证数量
    if (form.createType === 'batch') {
      if (!form.batchCount || form.batchCount < 2 || form.batchCount > 500) {
        setError('批量创建数量必须在 2-500 之间');
        return;
      }
    }
    
    setLoading(true);
    
    try {
      const token = localStorage.getItem('token');
      
      // 准备提交的数据
      const baseData = {
        description: form.description || undefined,
        groupId: form.groupId, // 添加拼车组ID
        tokenLimit: form.tokenLimit !== '' ? parseInt(form.tokenLimit) : null,
        rateLimitWindow: form.rateLimitWindow !== '' ? parseInt(form.rateLimitWindow) : null,
        rateLimitRequests: form.rateLimitRequests !== '' ? parseInt(form.rateLimitRequests) : null,
        concurrencyLimit: form.concurrencyLimit !== '' ? parseInt(form.concurrencyLimit) : 0,
        dailyCostLimit: form.dailyCostLimit !== '' ? parseFloat(form.dailyCostLimit) : 0,
        expiresAt: form.expiresAt || undefined,
        permissions: form.permissions,
        tags: form.tags.length > 0 ? form.tags : undefined,
        enableModelRestriction: form.enableModelRestriction,
        restrictedModels: form.restrictedModels,
        enableClientRestriction: form.enableClientRestriction,
        allowedClients: form.allowedClients,
        claudeAccountId: form.claudeAccountId === 'shared' ? undefined : form.claudeAccountId,
        geminiAccountId: form.geminiAccountId === 'shared' ? undefined : form.geminiAccountId
      };

      const endpoint = form.createType === 'single' 
        ? `/api/enterprises/${enterpriseId}/api-keys`
        : `/api/enterprises/${enterpriseId}/api-keys/batch`;
      
      const data = form.createType === 'single' 
        ? { ...baseData, name: form.name }
        : { ...baseData, createType: 'batch', baseName: form.name, count: form.batchCount, groupId: form.groupId };

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      });

      const result = await response.json();
      
      // 调试信息
      console.log('API Key 创建响应:', result);
      console.log('result.data:', result.data);
      console.log('result.data 类型:', typeof result.data);
      if (result.data && typeof result.data === 'object') {
        console.log('result.data 的所有键:', Object.keys(result.data));
      }
      
      if (result.success) {
        if (form.createType === 'batch') {
          setError(''); // 清除错误，显示成功信息
          alert(`成功创建 ${result.data.length} 个 API Key`);
          router.push(`/enterprise/${enterpriseId}/ai-resources?tab=api-keys`);
        } else {
          // 单个创建时显示成功弹窗
          let apiKeyValue = '未知';
          
          // 尝试从不同的字段获取API Key
          if (result.data) {
            if (typeof result.data === 'string') {
              apiKeyValue = result.data;
            } else if (typeof result.data === 'object') {
              // 检查常见的API Key字段名
              apiKeyValue = result.data.apiKey?.key || 
                           result.data.key || 
                           result.data.apiKey || 
                           result.data.api_key || 
                           result.data.token || 
                           result.data.accessToken || 
                           result.data.access_token ||
                           result.data.id ||
                           '未知';
            }
          }
          
          console.log('提取的API Key值:', apiKeyValue);
          
          setCreatedApiKey({
            name: form.name,
            key: apiKeyValue
          });
          setShowSuccessDialog(true);
          setError(''); // 清除错误
        }
      } else {
        setError(result.message || '创建失败');
      }
    } catch (error) {
      console.error('创建失败:', error);
      setError('创建失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        {/* 面包屑导航 */}
        <div className="flex items-center gap-4 mb-6">
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => router.push(`/enterprise/${enterpriseId}/ai-resources?tab=api-keys`)}
          >
            <ChevronLeft className="w-4 h-4 mr-2" />
            返回API Key管理
          </Button>
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Building2 className="w-4 h-4" />
            <span>{currentEnterprise?.name || '未知企业'}</span>
            <span>/</span>
            <span>API Key管理</span>
            <span>/</span>
            <span>创建API Key</span>
          </div>
        </div>

        {/* 页面标题 */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">创建新的 API Key</h1>
          <p className="text-gray-600 mt-2">配置API Key的权限、限制和使用范围</p>
        </div>

        {/* 创建表单 */}
        <form onSubmit={handleSubmit} className="space-y-8">
          {/* 创建类型选择 */}
          <Card className="shadow-sm">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
                  <Info className="w-4 h-4 text-white" />
                </div>
                创建类型
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex gap-6">
                <label className="flex items-center cursor-pointer">
                  <input 
                    type="radio" 
                    value="single"
                    checked={form.createType === 'single'}
                    onChange={(e) => handleInputChange('createType', e.target.value)}
                    className="mr-2 text-blue-600"
                  />
                  <span className="text-sm text-gray-700 flex items-center">
                    <Save className="w-4 h-4 mr-1" />
                    单个创建
                  </span>
                </label>
                <label className="flex items-center cursor-pointer">
                  <input 
                    type="radio" 
                    value="batch"
                    checked={form.createType === 'batch'}
                    onChange={(e) => handleInputChange('createType', e.target.value)}
                    className="mr-2 text-blue-600"
                  />
                  <span className="text-sm text-gray-700 flex items-center">
                    <Plus className="w-4 h-4 mr-1" />
                    批量创建
                  </span>
                </label>
              </div>
              
              {form.createType === 'batch' && (
                <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="space-y-3">
                    <Label htmlFor="batchCount" className="text-sm font-medium text-gray-600">创建数量</Label>
                    <div className="flex items-center gap-2">
                      <Input 
                        id="batchCount"
                        type="number" 
                        min="2"
                        max="500"
                        value={form.batchCount}
                        onChange={(e) => handleInputChange('batchCount', parseInt(e.target.value))}
                        className="w-32"
                        placeholder="输入数量 (2-500)"
                      />
                      <span className="text-sm text-gray-500">最大支持 500 个</span>
                    </div>
                  </div>
                  <p className="text-sm text-amber-600 mt-3 flex items-start">
                    <Info className="w-4 h-4 mr-1 mt-0.5 flex-shrink-0" />
                    <span>批量创建时，每个 Key 的名称会自动添加序号后缀，例如：{form.name || 'MyKey'}_1, {form.name || 'MyKey'}_2 ...</span>
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* 基本信息 */}
          <Card className="shadow-sm">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg font-semibold text-gray-900">基本信息</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3">
                <Label htmlFor="name" className="text-sm font-medium text-gray-700">
                  名称 <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="name"
                  value={form.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  placeholder={form.createType === 'batch' ? '输入基础名称（将自动添加序号）' : '为您的 API Key 取一个名称'}
                  className={`h-10 ${errors.name ? 'border-red-500' : ''}`}
                  required
                />
                {errors.name && (
                  <p className="text-red-500 text-sm">{errors.name}</p>
                )}
              </div>
              
              <div className="space-y-3">
                <Label htmlFor="description" className="text-sm font-medium text-gray-700">备注 (可选)</Label>
                <Textarea
                  id="description"
                  value={form.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  placeholder="描述此 API Key 的用途..."
                  rows={3}
                  className="resize-none"
                />
              </div>
              
              <div className="space-y-3">
                <Label htmlFor="groupId" className="text-sm font-medium text-gray-700">
                  所属拼车组 <span className="text-red-500">*</span>
                </Label>
                <Select 
                  value={form.groupId} 
                  onValueChange={(value) => handleInputChange('groupId', value)}
                  disabled={groupsLoading}
                >
                  <SelectTrigger className="h-10">
                    <SelectValue placeholder={groupsLoading ? "加载中..." : "请选择拼车组"} />
                  </SelectTrigger>
                  <SelectContent>
                    {groups.map((group) => (
                      <SelectItem key={group.id} value={group.id}>
                        {group.name} ({group.memberCount} 成员)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {groups.length === 0 && !groupsLoading && (
                  <p className="text-sm text-amber-600">
                    ⚠️ 当前企业下没有拼车组，请先创建拼车组
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* 标签管理 */}
          <Card className="shadow-sm">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg font-semibold text-gray-900">标签</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* 已选择的标签 */}
              {form.tags.length > 0 && (
                <div>
                  <div className="text-sm font-medium text-gray-600 mb-2">
                    已选择的标签:
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {form.tags.map((tag, index) => (
                      <span
                        key={index}
                        className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-800 text-sm rounded-full"
                      >
                        {tag}
                        <button
                          type="button"
                          className="ml-1 hover:text-blue-900"
                          onClick={() => removeTag(index)}
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              )}
              
              {/* 可选择的已有标签 */}
              {getUnselectedTags().length > 0 && (
                <div>
                  <div className="text-sm font-medium text-gray-600 mb-2">
                    点击选择已有标签:
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {getUnselectedTags().map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        className="inline-flex items-center gap-1 px-3 py-1 bg-gray-100 text-gray-700 text-sm rounded-full hover:bg-blue-100 hover:text-blue-700 transition-colors"
                        onClick={() => selectTag(tag)}
                      >
                        <Plus className="w-3 h-3" />
                        {tag}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              
              {/* 创建新标签 */}
              <div>
                <div className="text-sm font-medium text-gray-600 mb-2">
                  创建新标签:
                </div>
                <div className="flex gap-2">
                  <Input 
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    className="flex-1"
                    placeholder="输入新标签名称"
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addTag();
                      }
                    }}
                  />
                  <Button
                    type="button"
                    className="px-4 py-2 bg-green-500 text-white hover:bg-green-600"
                    onClick={addTag}
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              
              <p className="text-sm text-gray-500">
                用于标记不同团队或用途，方便筛选管理
              </p>
            </CardContent>
          </Card>

          {/* 速率限制设置 */}
          <Card className="shadow-sm">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <div className="w-6 h-6 bg-blue-500 rounded flex items-center justify-center flex-shrink-0">
                  <RefreshCw className="w-4 h-4 text-white" />
                </div>
                速率限制设置 (可选)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="space-y-3">
                  <Label htmlFor="rateLimitWindow" className="text-sm font-medium text-gray-700">时间窗口 (分钟)</Label>
                  <Input 
                    id="rateLimitWindow"
                    type="number" 
                    min="1"
                    value={form.rateLimitWindow}
                    onChange={(e) => handleInputChange('rateLimitWindow', e.target.value)}
                    placeholder="无限制" 
                    className="h-10"
                  />
                  <p className="text-sm text-gray-500">时间段单位</p>
                </div>
              
                <div className="space-y-3">
                  <Label htmlFor="rateLimitRequests" className="text-sm font-medium text-gray-700">请求次数限制</Label>
                  <Input 
                    id="rateLimitRequests"
                    type="number" 
                    min="1"
                    value={form.rateLimitRequests}
                    onChange={(e) => handleInputChange('rateLimitRequests', e.target.value)}
                    placeholder="无限制" 
                    className="h-10"
                  />
                  <p className="text-sm text-gray-500">窗口内最大请求</p>
                </div>
              
                <div className="space-y-3">
                  <Label htmlFor="tokenLimit" className="text-sm font-medium text-gray-700">Token 限制</Label>
                  <Input 
                    id="tokenLimit"
                    type="number"
                    value={form.tokenLimit}
                    onChange={(e) => handleInputChange('tokenLimit', e.target.value)}
                    placeholder="无限制" 
                    className="h-10"
                  />
                  <p className="text-sm text-gray-500">窗口内最大Token</p>
                </div>
              </div>
            
              {/* 示例说明 */}
              <div className="bg-blue-100 rounded-lg p-4">
                <h5 className="text-sm font-semibold text-blue-800 mb-2">
                  💡 使用示例
                </h5>
                <div className="text-sm text-blue-700 space-y-1">
                  <div><strong>示例1:</strong> 时间窗口=60，请求次数=1000 → 每60分钟最多1000次请求</div>
                  <div><strong>示例2:</strong> 时间窗口=1，Token=10000 → 每分钟最多10,000个Token</div>
                  <div><strong>示例3:</strong> 窗口=30，请求=50，Token=100000 → 每30分钟50次请求且不超10万Token</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 费用和并发限制 */}
          <Card className="shadow-sm">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg font-semibold text-gray-900">费用和并发限制</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3">
                <Label htmlFor="dailyCostLimit" className="text-sm font-medium text-gray-700">每日费用限制 (美元)</Label>
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleInputChange('dailyCostLimit', '50')}
                    >
                      $50
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleInputChange('dailyCostLimit', '100')}
                    >
                      $100
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleInputChange('dailyCostLimit', '200')}
                    >
                      $200
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleInputChange('dailyCostLimit', '')}
                    >
                      自定义
                    </Button>
                  </div>
                  <Input 
                    id="dailyCostLimit"
                    type="number" 
                    min="0"
                    step="0.01"
                    value={form.dailyCostLimit}
                    onChange={(e) => handleInputChange('dailyCostLimit', e.target.value)}
                    placeholder="0 表示无限制" 
                    className="h-10"
                  />
                  <p className="text-sm text-gray-500">
                    设置此 API Key 每日的费用限制，超过限制将拒绝请求，0 或留空表示无限制
                  </p>
                </div>
              </div>
              
              <div className="space-y-3">
                <Label htmlFor="concurrencyLimit" className="text-sm font-medium text-gray-700">并发限制 (可选)</Label>
                <Input 
                  id="concurrencyLimit"
                  type="number" 
                  min="0"
                  value={form.concurrencyLimit}
                  onChange={(e) => handleInputChange('concurrencyLimit', e.target.value)}
                  placeholder="0 表示无限制" 
                  className="h-10"
                />
                <p className="text-sm text-gray-500">
                  设置此 API Key 可同时处理的最大请求数，0 或留空表示无限制
                </p>
              </div>
            </CardContent>
          </Card>

          {/* 有效期限 */}
          <Card className="shadow-sm">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg font-semibold text-gray-900">有效期限</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3">
                <Label htmlFor="expireDuration" className="text-sm font-medium text-gray-700">有效期限</Label>
                <Select value={form.expireDuration} onValueChange={(value) => {
                  handleInputChange('expireDuration', value);
                  setTimeout(updateExpireAt, 0);
                }}>
                  <SelectTrigger className="h-10">
                    <SelectValue placeholder="永不过期" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="never">永不过期</SelectItem>
                    <SelectItem value="1d">1 天</SelectItem>
                    <SelectItem value="7d">7 天</SelectItem>
                    <SelectItem value="30d">30 天</SelectItem>
                    <SelectItem value="90d">90 天</SelectItem>
                    <SelectItem value="180d">180 天</SelectItem>
                    <SelectItem value="365d">365 天</SelectItem>
                    <SelectItem value="custom">自定义日期</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              {form.expireDuration === 'custom' && (
                <div className="space-y-3">
                  <Label htmlFor="customExpireDate" className="text-sm font-medium text-gray-700">自定义过期时间</Label>
                  <Input 
                    id="customExpireDate"
                    type="datetime-local"
                    value={form.customExpireDate}
                    onChange={(e) => {
                      handleInputChange('customExpireDate', e.target.value);
                      setTimeout(updateCustomExpireAt, 0);
                    }}
                    min={getMinDateTime()}
                    className="h-10"
                  />
                </div>
              )}
              
              {form.expiresAt && (
                <p className="text-sm text-gray-500">
                  将于 {formatExpireDate(form.expiresAt)} 过期
                </p>
              )}
            </CardContent>
          </Card>

          {/* 服务权限 */}
          <Card className="shadow-sm">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg font-semibold text-gray-900">服务权限</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex gap-6">
                <label className="flex items-center cursor-pointer">
                  <input 
                    type="radio" 
                    value="all"
                    checked={form.permissions === 'all'}
                    onChange={(e) => handleInputChange('permissions', e.target.value)}
                    className="mr-2"
                  />
                  <span className="text-sm text-gray-700">全部服务</span>
                </label>
                <label className="flex items-center cursor-pointer">
                  <input 
                    type="radio" 
                    value="claude"
                    checked={form.permissions === 'claude'}
                    onChange={(e) => handleInputChange('permissions', e.target.value)}
                    className="mr-2"
                  />
                  <span className="text-sm text-gray-700">仅 Claude</span>
                </label>
                <label className="flex items-center cursor-pointer">
                  <input 
                    type="radio" 
                    value="gemini"
                    checked={form.permissions === 'gemini'}
                    onChange={(e) => handleInputChange('permissions', e.target.value)}
                    className="mr-2"
                  />
                  <span className="text-sm text-gray-700">仅 Gemini</span>
                </label>
              </div>
              <p className="text-sm text-gray-500">
                控制此 API Key 可以访问哪些服务
              </p>
            </CardContent>
          </Card>

          {/* 专属账号绑定 */}
          <Card className="shadow-sm">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg font-semibold text-gray-900">专属账号绑定 (可选)</CardTitle>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={accountsLoading}
                  onClick={refreshAccounts}
                >
                  <RefreshCw className={`w-4 h-4 mr-2 ${accountsLoading ? 'animate-spin' : ''}`} />
                  {accountsLoading ? '刷新中...' : '刷新账号'}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 gap-6">
                <div className="space-y-3">
                  <Label className="text-sm font-medium text-gray-600">Claude 专属账号</Label>
                  <Select 
                    value={form.claudeAccountId} 
                    onValueChange={(value) => handleInputChange('claudeAccountId', value)}
                    disabled={form.permissions === 'gemini'}
                  >
                    <SelectTrigger className="h-10">
                      <SelectValue placeholder="请选择Claude账号" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="shared">使用共享账号池</SelectItem>
                      {accounts.claude.map((account) => (
                        <SelectItem key={account.id} value={account.id}>
                          {account.name} ({account.status === 'active' ? '正常' : '异常'})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-3">
                  <Label className="text-sm font-medium text-gray-600">Gemini 专属账号</Label>
                  <Select 
                    value={form.geminiAccountId} 
                    onValueChange={(value) => handleInputChange('geminiAccountId', value)}
                    disabled={form.permissions === 'claude'}
                  >
                    <SelectTrigger className="h-10">
                      <SelectValue placeholder="请选择Gemini账号" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="shared">使用共享账号池</SelectItem>
                      {accounts.gemini.map((account) => (
                        <SelectItem key={account.id} value={account.id}>
                          {account.name} ({account.status === 'active' ? '正常' : '异常'})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <p className="text-sm text-gray-500">
                选择专属账号后，此API Key将只使用该账号，不选择则使用共享账号池
              </p>
            </CardContent>
          </Card>

          {/* 模型限制 */}
          <Card className="shadow-sm">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg font-semibold text-gray-900">模型限制</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center space-x-3">
                <Switch
                  checked={form.enableModelRestriction}
                  onCheckedChange={(checked) => handleInputChange('enableModelRestriction', checked)}
                />
                <Label className="text-sm font-medium text-gray-700">启用模型限制</Label>
              </div>
              
              {form.enableModelRestriction && (
                <div className="space-y-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                  <div className="space-y-3">
                    <Label className="text-sm font-medium text-gray-700">限制的模型列表</Label>
                    <div className="flex flex-wrap gap-2 mb-3 min-h-[32px]">
                      {form.restrictedModels.map((model, index) => (
                        <span 
                          key={index}
                          className="inline-flex items-center px-2 py-1 rounded-full text-sm bg-red-100 text-red-800"
                        >
                          {model}
                          <button 
                            type="button"
                            className="ml-1 text-red-600 hover:text-red-800"
                            onClick={() => removeRestrictedModel(index)}
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                      {form.restrictedModels.length === 0 && (
                        <span className="text-gray-400 text-sm">暂无限制的模型</span>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Input 
                        value={form.modelInput}
                        onChange={(e) => handleInputChange('modelInput', e.target.value)}
                        type="text"
                        placeholder="输入模型名称，按回车添加"
                        className="flex-1"
                        onKeyPress={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            addRestrictedModel();
                          }
                        }}
                      />
                      <Button 
                        type="button"
                        className="px-3 py-2 bg-red-500 text-white hover:bg-red-600"
                        onClick={addRestrictedModel}
                      >
                        <Plus className="w-4 h-4" />
                      </Button>
                    </div>
                    <p className="text-sm text-gray-500">
                      例如：claude-opus-4-20250514
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* 客户端限制 */}
          <Card className="shadow-sm">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg font-semibold text-gray-900">客户端限制</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center space-x-3">
                <Switch
                  checked={form.enableClientRestriction}
                  onCheckedChange={(checked) => handleInputChange('enableClientRestriction', checked)}
                />
                <Label className="text-sm font-medium text-gray-700">启用客户端限制</Label>
              </div>
              
              {form.enableClientRestriction && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="space-y-3">
                    <Label className="text-sm font-medium text-gray-700">允许的客户端</Label>
                    <div className="space-y-2">
                      {supportedClients.map((client) => (
                        <div key={client.id} className="flex items-start">
                          <input 
                            id={`client_${client.id}`}
                            type="checkbox"
                            checked={form.allowedClients.includes(client.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                handleInputChange('allowedClients', [...form.allowedClients, client.id]);
                              } else {
                                handleInputChange('allowedClients', form.allowedClients.filter(id => id !== client.id));
                              }
                            }}
                            className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 mt-0.5"
                          />
                          <label htmlFor={`client_${client.id}`} className="ml-2 flex-1 cursor-pointer">
                            <span className="text-sm font-medium text-gray-700">{client.name}</span>
                            <span className="text-sm text-gray-500 block">{client.description}</span>
                          </label>
                        </div>
                      ))}
                    </div>
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
              onClick={() => router.back()}
              className="h-11 px-6"
            >
              取消
            </Button>
            <Button 
              type="submit" 
              disabled={loading}
              className="h-11 px-6"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  创建中...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  创建
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
      
      {/* API Key 创建成功弹窗 */}
      {createdApiKey && (
        <ApiKeySuccessDialog
          open={showSuccessDialog}
          onClose={() => {
            setShowSuccessDialog(false);
            setCreatedApiKey(null);
            router.push(`/enterprise/${enterpriseId}/ai-resources?tab=api-keys`);
          }}
          apiKeyName={createdApiKey.name}
          apiKey={createdApiKey.key}
        />
      )}
    </div>
  );
}
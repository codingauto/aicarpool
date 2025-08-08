'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Key, Plus, Copy, RotateCcw, Trash2, Eye, EyeOff, AlertTriangle, User, Clock, DollarSign, Settings, TestTube, CheckCircle, XCircle, AlertCircle, X, ChevronDown, ChevronUp } from 'lucide-react';
import { toast } from 'sonner';
import { GroupManagerGuard } from '@/components/auth/PermissionGuard';

interface ApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  permissions: string[];
  expiresAt?: string;
  lastUsedAt?: string;
  isActive: boolean;
  createdAt: string;
  createdBy: {
    id: string;
    name: string;
    email: string;
  };
  usageStats: {
    totalRequests: number;
    totalTokens: number;
    totalCost: number;
  };
}

interface ApiKeyManagementProps {
  groupId: string;
  canManageApiKeys: boolean;
  members?: GroupMember[];
  currentUserId?: string;
}

interface GroupMember {
  id: string;
  userId: string;
  role: string;
  joinedAt: string;
  user: {
    id: string;
    name: string;
    email: string;
  };
}

export function ApiKeyManagement({ groupId, canManageApiKeys, members = [], currentUserId }: ApiKeyManagementProps) {
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [visibleKeys, setVisibleKeys] = useState<Set<string>>(new Set());
  const [showCliConfigDialog, setShowCliConfigDialog] = useState(false);
  const [newlyCreatedKey, setNewlyCreatedKey] = useState<string>('');
  const [testingKeys, setTestingKeys] = useState<Set<string>>(new Set());
  const [showTestDialog, setShowTestDialog] = useState(false);
  const [testResults, setTestResults] = useState<any>(null);
  
  // 获取当前域名
  const getCurrentDomain = () => {
    if (typeof window !== 'undefined') {
      return window.location.origin;
    }
    return 'https://your-domain.com';
  };
  
  // 创建API密钥表单状态
  const [createForm, setCreateForm] = useState({
    name: '',
    tags: [] as string[],
    description: '',
    targetUserId: currentUserId || '', // 默认为当前用户
    expiresInDays: 0, // 0表示永不过期
    dailyCostLimit: 50,
    concurrencyLimit: 0, // 0表示无限制
    rateLimit: {
      type: 'unlimited' as 'unlimited' | 'requests' | 'tokens',
      windowMinutes: 60,
      maxRequests: 1000,
      maxTokens: 100000
    },
    servicePermissions: 'all' as 'all' | 'claude' | 'gemini',
    claudeAccountId: '',
    geminiAccountId: '',
    enableModelRestriction: false,
    enableClientRestriction: false
  });
  
  // 新增状态管理
  const [tagInput, setTagInput] = useState('');
  const [showRateLimitSettings, setShowRateLimitSettings] = useState(false);
  const [showConcurrencySettings, setShowConcurrencySettings] = useState(false);
  const [showAccountBindingSettings, setShowAccountBindingSettings] = useState(false);
  const [customDailyLimit, setCustomDailyLimit] = useState(false);
  const [customExpiry, setCustomExpiry] = useState(false);

  const fetchApiKeys = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/groups/${groupId}/api-keys`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        // 确保设置的是数组 - API返回格式是 { data: { apiKeys: [...] } }
        const keys = data?.data?.apiKeys || data?.apiKeys || 
                     (Array.isArray(data?.data) ? data.data : 
                      Array.isArray(data) ? data : []);
        setApiKeys(keys);
      }
    } catch (error) {
      console.error('获取API密钥列表失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateApiKey = async () => {
    if (!createForm.name.trim()) {
      toast.error('请输入API密钥名称');
      return;
    }

    setCreating(true);
    try {
      const token = localStorage.getItem('token');
      
      // 构建请求数据
      const requestData: any = {
        name: createForm.name,
        description: createForm.description,
        targetUserId: createForm.targetUserId || currentUserId,
        expiresInDays: createForm.expiresInDays,
        dailyCostLimit: createForm.dailyCostLimit,
        concurrencyLimit: createForm.concurrencyLimit,
        tags: createForm.tags,
        servicePermissions: createForm.servicePermissions === 'all' ? ['all'] : [createForm.servicePermissions],
        enableModelRestriction: createForm.enableModelRestriction,
        enableClientRestriction: createForm.enableClientRestriction
      };
      
      // 处理速率限制
      if (createForm.rateLimit.type !== 'unlimited') {
        requestData.rateLimit = {
          windowMinutes: createForm.rateLimit.windowMinutes,
          maxRequests: createForm.rateLimit.type === 'requests' ? createForm.rateLimit.maxRequests : null,
          maxTokens: createForm.rateLimit.type === 'tokens' ? createForm.rateLimit.maxTokens : null
        };
      }
      
      // 处理专属账号绑定
      if (createForm.claudeAccountId) {
        requestData.claudeAccountId = createForm.claudeAccountId;
      }
      if (createForm.geminiAccountId) {
        requestData.geminiAccountId = createForm.geminiAccountId;
      }
      
      const response = await fetch(`/api/groups/${groupId}/api-keys`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestData)
      });

      const data = await response.json();
      if (data.success) {
        toast.success('API密钥创建成功');
        setShowCreateDialog(false);
        setCreateForm({
          name: '',
          tags: [],
          description: '',
          targetUserId: currentUserId || '',
          expiresInDays: 0,
          dailyCostLimit: 50,
          concurrencyLimit: 0,
          rateLimit: {
            type: 'unlimited',
            windowMinutes: 60,
            maxRequests: 1000,
            maxTokens: 100000
          },
          servicePermissions: 'all',
          claudeAccountId: '',
          geminiAccountId: '',
          enableModelRestriction: false,
          enableClientRestriction: false
        });
        setTagInput('');
        setShowRateLimitSettings(false);
        setShowConcurrencySettings(false);
        setShowAccountBindingSettings(false);
        setCustomDailyLimit(false);
        setCustomExpiry(false);
        fetchApiKeys();
        
        // 显示完整的API密钥和CLI配置
        if (data.data && data.data.apiKey && data.data.apiKey.key) {
          const fullKey = data.data.apiKey.key;
          setNewlyCreatedKey(fullKey);
          setShowCliConfigDialog(true);
        } else {
          console.warn('API密钥创建成功但未返回密钥信息');
        }
      } else {
        throw new Error(data.message || '创建API密钥失败');
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '创建API密钥失败');
    } finally {
      setCreating(false);
    }
  };

  const handleToggleKeyVisibility = (keyId: string) => {
    const newVisible = new Set(visibleKeys);
    if (newVisible.has(keyId)) {
      newVisible.delete(keyId);
    } else {
      newVisible.add(keyId);
    }
    setVisibleKeys(newVisible);
  };
  
  // 标签管理函数
  const handleAddTag = () => {
    if (tagInput.trim() && !createForm.tags.includes(tagInput.trim())) {
      setCreateForm(prev => ({
        ...prev,
        tags: [...prev.tags, tagInput.trim()]
      }));
      setTagInput('');
    }
  };
  
  const handleRemoveTag = (tagToRemove: string) => {
    setCreateForm(prev => ({
      ...prev,
      tags: prev.tags.filter(tag => tag !== tagToRemove)
    }));
  };
  
  const handleTagInputKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddTag();
    }
  };

  const handleDeleteApiKey = async (keyId: string, keyName: string) => {
    if (!confirm(`确定要删除API密钥 "${keyName}" 吗？此操作无法撤销。`)) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/groups/${groupId}/api-keys/${keyId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        toast.success('API密钥已删除');
        fetchApiKeys();
      } else {
        throw new Error('删除API密钥失败');
      }
    } catch (error) {
      toast.error('删除API密钥失败');
    }
  };

  const handleToggleApiKey = async (keyId: string, isActive: boolean) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/groups/${groupId}/api-keys/${keyId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ isActive: !isActive })
      });

      if (response.ok) {
        toast.success(`API密钥已${isActive ? '禁用' : '启用'}`);
        fetchApiKeys();
      } else {
        throw new Error('更新API密钥状态失败');
      }
    } catch (error) {
      toast.error('更新API密钥状态失败');
    }
  };

  const formatLastUsed = (lastUsedAt?: string) => {
    if (!lastUsedAt) return '从未使用';
    const date = new Date(lastUsedAt);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return '今天';
    if (diffDays === 1) return '昨天';
    if (diffDays < 30) return `${diffDays}天前`;
    return date.toLocaleDateString('zh-CN');
  };

  const getPermissionDisplayName = (permission: string) => {
    const names: Record<string, string> = {
      'chat': '聊天对话',
      'usage': '使用统计',
      'members': '成员管理',
      'admin': '完全管理'
    };
    return names[permission] || permission;
  };

  const isExpiringSoon = (expiresAt?: string) => {
    if (!expiresAt) return false;
    const expiryDate = new Date(expiresAt);
    const now = new Date();
    const diffMs = expiryDate.getTime() - now.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    return diffDays <= 7;
  };

  const handleTestApiKey = async (keyId: string, keyName: string) => {
    setTestingKeys(prev => new Set(prev).add(keyId));
    
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/groups/${groupId}/api-keys/${keyId}/test`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const data = await response.json();
      if (data.success) {
        setTestResults(data.data);
        setShowTestDialog(true);
        toast.success(`API密钥 "${keyName}" 测试完成`);
      } else {
        toast.error(data.message || 'API密钥测试失败');
      }
    } catch (error) {
      toast.error('API密钥测试失败');
    } finally {
      setTestingKeys(prev => {
        const newSet = new Set(prev);
        newSet.delete(keyId);
        return newSet;
      });
    }
  };

  const getQuotaUsagePercentage = (used: number, limit?: number) => {
    if (!limit) return 0;
    return Math.min((used / limit) * 100, 100);
  };

  useEffect(() => {
    fetchApiKeys();
  }, [groupId]);

  if (loading) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="py-8">
            <div className="text-center text-gray-500">加载API密钥列表...</div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // 确保 apiKeys 是数组
  const safeApiKeys = Array.isArray(apiKeys) ? apiKeys : [];
  
  const activeKeys = safeApiKeys.filter(key => key.isActive);
  const expiredKeys = safeApiKeys.filter(key => key.expiresAt && new Date(key.expiresAt) < new Date());
  const totalRequests = safeApiKeys.reduce((sum, key) => sum + (key.usageStats?.totalRequests || 0), 0);
  const totalTokens = safeApiKeys.reduce((sum, key) => sum + (key.usageStats?.totalTokens || 0), 0);

  return (
    <div className="space-y-6">
      {/* API密钥统计 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">总密钥数</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{safeApiKeys.length}</div>
            <div className="text-sm text-gray-500">已创建密钥</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">活跃密钥</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{activeKeys.length}</div>
            <div className="text-sm text-gray-500">
              正在使用 {expiredKeys.length > 0 && (
                <span className="text-red-500">({expiredKeys.length} 已过期)</span>
              )}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">总请求数</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{totalRequests.toLocaleString()}</div>
            <div className="text-sm text-gray-500">API调用次数</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">配额使用</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="text-2xl font-bold text-purple-600">{totalTokens.toLocaleString()}</div>
              <div className="text-sm text-gray-500">累计Token消耗</div>
              {/* 配额预警 */}
              {safeApiKeys.some(key => {
                const usage = key.quotaLimit ? (Number(key.quotaUsed) / Number(key.quotaLimit)) * 100 : 0;
                return usage >= 80;
              }) && (
                <div className="flex items-center gap-1 text-xs text-yellow-600">
                  <AlertTriangle className="w-3 h-3" />
                  <span>部分密钥配额紧张</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* API密钥管理 */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>API密钥管理</CardTitle>
              <CardDescription>管理拼车组的API访问密钥</CardDescription>
            </div>
            <GroupManagerGuard groupId={groupId}>
              <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
                <DialogTrigger asChild>
                  <Button className="bg-purple-500 hover:bg-purple-600 text-white">
                    <Plus className="w-4 h-4 mr-2" />
                    创建密钥
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-3xl w-[90vw] max-h-[85vh] flex flex-col p-0">
                  <DialogHeader className="flex-shrink-0 px-6 pt-6 pb-4">
                    <DialogTitle className="flex items-center gap-2 text-lg">
                      <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                        <Key className="w-5 h-5 text-blue-600" />
                      </div>
                      创建新的 API Key
                    </DialogTitle>
                  </DialogHeader>
                  
                  {/* 可滚动的表单内容区域 */}
                  <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
                    {/* 名称 */}
                    <div className="space-y-2">
                      <Label htmlFor="name" className="flex items-center gap-1">
                        名称 <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="name"
                        value={createForm.name}
                        onChange={(e) => setCreateForm(prev => ({ ...prev, name: e.target.value }))}
                        placeholder="为您的 API Key 取一个名称"
                      />
                    </div>
                    
                    {/* 标签 */}
                    <div className="space-y-2">
                      <Label>标签</Label>
                      <div className="text-sm text-gray-500">创建标签：</div>
                      <div className="flex items-center gap-2">
                        <Input
                          value={tagInput}
                          onChange={(e) => setTagInput(e.target.value)}
                          onKeyPress={handleTagInputKeyPress}
                          placeholder="输入新标签名称"
                          className="flex-1"
                        />
                        <Button
                          type="button"
                          size="icon"
                          variant="default"
                          className="bg-green-500 hover:bg-green-600"
                          onClick={handleAddTag}
                        >
                          <Plus className="w-4 h-4" />
                        </Button>
                      </div>
                      {createForm.tags.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-2">
                          {createForm.tags.map((tag) => (
                            <Badge key={tag} variant="secondary" className="px-3 py-1">
                              {tag}
                              <button
                                type="button"
                                onClick={() => handleRemoveTag(tag)}
                                className="ml-2 hover:text-red-500"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </Badge>
                          ))}
                        </div>
                      )}
                      <p className="text-xs text-gray-500">用于标记不同团队或用途，方便筛选管理</p>
                    </div>
                    
                    {/* 速率限制设置（可选） */}
                    <div className="space-y-3">
                      <div 
                        className="flex items-center justify-between cursor-pointer"
                        onClick={() => setShowRateLimitSettings(!showRateLimitSettings)}
                      >
                        <Label className="cursor-pointer">速率限制设置（可选）</Label>
                        {showRateLimitSettings ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </div>
                      
                      {showRateLimitSettings && (
                        <div className="space-y-3 pl-4 border-l-2 border-gray-200">
                          <div className="text-sm text-gray-600">时间窗口（分钟）</div>
                          <RadioGroup
                            value={createForm.rateLimit.type}
                            onValueChange={(value) => setCreateForm(prev => ({
                              ...prev,
                              rateLimit: { ...prev.rateLimit, type: value as any }
                            }))}
                          >
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value="unlimited" id="unlimited" />
                              <Label htmlFor="unlimited">无限制</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value="requests" id="requests" />
                              <Label htmlFor="requests">
                                窗口内最大请求 
                                <Input
                                  type="number"
                                  value={createForm.rateLimit.maxRequests}
                                  onChange={(e) => setCreateForm(prev => ({
                                    ...prev,
                                    rateLimit: { ...prev.rateLimit, maxRequests: parseInt(e.target.value) || 1000 }
                                  }))}
                                  className="ml-2 w-24 inline-block"
                                  disabled={createForm.rateLimit.type !== 'requests'}
                                />
                              </Label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value="tokens" id="tokens" />
                              <Label htmlFor="tokens">
                                窗口内最大Token
                                <Input
                                  type="number"
                                  value={createForm.rateLimit.maxTokens}
                                  onChange={(e) => setCreateForm(prev => ({
                                    ...prev,
                                    rateLimit: { ...prev.rateLimit, maxTokens: parseInt(e.target.value) || 100000 }
                                  }))}
                                  className="ml-2 w-32 inline-block"
                                  disabled={createForm.rateLimit.type !== 'tokens'}
                                />
                              </Label>
                            </div>
                          </RadioGroup>
                          
                          <div className="bg-gray-50 p-3 rounded text-sm text-gray-600">
                            <div className="font-semibold mb-1">使用示例：</div>
                            {createForm.rateLimit.type === 'unlimited' && (
                              <div>示例1: 时间窗口=60，请求次数=1000 → 每60分钟最多1000次请求</div>
                            )}
                            {createForm.rateLimit.type === 'requests' && (
                              <div>示例2: 时间窗口=1，Token=10000 → 每分钟最多10,000个Token</div>
                            )}
                            {createForm.rateLimit.type === 'tokens' && (
                              <div>示例3: 窗口=30，请求=50，Token=100000 → 每30分钟最多50次请求且不超10万Token</div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                    
                    {/* 每日费用限制 */}
                    <div className="space-y-2">
                      <Label>每日费用限制（美元）</Label>
                      <div className="flex gap-2 flex-wrap">
                        <Button
                          type="button"
                          variant={createForm.dailyCostLimit === 50 ? "default" : "outline"}
                          size="sm"
                          onClick={() => { setCreateForm(prev => ({ ...prev, dailyCostLimit: 50 })); setCustomDailyLimit(false); }}
                        >
                          $50
                        </Button>
                        <Button
                          type="button"
                          variant={createForm.dailyCostLimit === 100 ? "default" : "outline"}
                          size="sm"
                          onClick={() => { setCreateForm(prev => ({ ...prev, dailyCostLimit: 100 })); setCustomDailyLimit(false); }}
                        >
                          $100
                        </Button>
                        <Button
                          type="button"
                          variant={createForm.dailyCostLimit === 200 ? "default" : "outline"}
                          size="sm"
                          onClick={() => { setCreateForm(prev => ({ ...prev, dailyCostLimit: 200 })); setCustomDailyLimit(false); }}
                        >
                          $200
                        </Button>
                        <Button
                          type="button"
                          variant={customDailyLimit ? "default" : "outline"}
                          size="sm"
                          onClick={() => setCustomDailyLimit(true)}
                        >
                          自定义
                        </Button>
                      </div>
                      {customDailyLimit && (
                        <Input
                          type="number"
                          min="0"
                          value={createForm.dailyCostLimit}
                          onChange={(e) => setCreateForm(prev => ({ ...prev, dailyCostLimit: parseInt(e.target.value) || 0 }))}
                          placeholder="输入自定义金额"
                        />
                      )}
                      <p className="text-xs text-gray-500">设置此 API Key 每日的费用限制，超过限制将拒绝请求，0 或留空表示无限制</p>
                    </div>
                    
                    {/* 并发限制（可选） */}
                    <div className="space-y-2">
                      <div 
                        className="flex items-center justify-between cursor-pointer"
                        onClick={() => setShowConcurrencySettings(!showConcurrencySettings)}
                      >
                        <Label className="cursor-pointer">并发限制（可选）</Label>
                        {showConcurrencySettings ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </div>
                      {showConcurrencySettings && (
                        <div className="pl-4 border-l-2 border-gray-200">
                          <Input
                            type="number"
                            min="0"
                            value={createForm.concurrencyLimit}
                            onChange={(e) => setCreateForm(prev => ({ ...prev, concurrencyLimit: parseInt(e.target.value) || 0 }))}
                            placeholder="0 表示无限制"
                          />
                          <p className="text-xs text-gray-500 mt-1">设置此 API Key 可同时处理的最大请求数，0 或留空表示无限制</p>
                        </div>
                      )}
                    </div>
                    
                    {/* 备注（可选） */}
                    <div className="space-y-2">
                      <Label htmlFor="description">备注（可选）</Label>
                      <Textarea
                        id="description"
                        value={createForm.description}
                        onChange={(e) => setCreateForm(prev => ({ ...prev, description: e.target.value }))}
                        placeholder="描述此 API Key 的用途..."
                        rows={3}
                      />
                    </div>
                    
                    {/* 有效期限 */}
                    <div className="space-y-2">
                      <Label>有效期限</Label>
                      <Select 
                        value={createForm.expiresInDays.toString()} 
                        onValueChange={(value) => {
                          const days = parseInt(value);
                          setCreateForm(prev => ({ ...prev, expiresInDays: days }));
                          setCustomExpiry(days === -1);
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="0">永不过期</SelectItem>
                          <SelectItem value="7">7天</SelectItem>
                          <SelectItem value="30">30天</SelectItem>
                          <SelectItem value="90">90天</SelectItem>
                          <SelectItem value="-1">自定义</SelectItem>
                        </SelectContent>
                      </Select>
                      {customExpiry && (
                        <Input
                          type="number"
                          min="1"
                          placeholder="输入天数"
                          onChange={(e) => setCreateForm(prev => ({ ...prev, expiresInDays: parseInt(e.target.value) || 30 }))}
                        />
                      )}
                    </div>
                    
                    {/* 服务权限 */}
                    <div className="space-y-2">
                      <Label>服务权限</Label>
                      <RadioGroup
                        value={createForm.servicePermissions}
                        onValueChange={(value) => setCreateForm(prev => ({ ...prev, servicePermissions: value as any }))}
                      >
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="all" id="all-services" />
                          <Label htmlFor="all-services">全部服务</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="claude" id="claude-only" />
                          <Label htmlFor="claude-only">仅 Claude</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="gemini" id="gemini-only" />
                          <Label htmlFor="gemini-only">仅 Gemini</Label>
                        </div>
                      </RadioGroup>
                      <p className="text-xs text-gray-500">控制此 API Key 可以访问哪些服务</p>
                    </div>
                    
                    {/* 专属账号绑定（可选） */}
                    <div className="space-y-3">
                      <div 
                        className="flex items-center justify-between cursor-pointer"
                        onClick={() => setShowAccountBindingSettings(!showAccountBindingSettings)}
                      >
                        <Label className="cursor-pointer">专属账号绑定（可选）</Label>
                        {showAccountBindingSettings ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </div>
                      {showAccountBindingSettings && (
                        <div className="space-y-3 pl-4 border-l-2 border-gray-200">
                          <div className="space-y-2">
                            <Label>Claude 专属账号</Label>
                            <Select 
                              value={createForm.claudeAccountId || "shared"}
                              onValueChange={(value) => setCreateForm(prev => ({ 
                                ...prev, 
                                claudeAccountId: value === "shared" ? "" : value 
                              }))}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="shared">使用共享账号池</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          
                          <div className="space-y-2">
                            <Label>Gemini 专属账号</Label>
                            <Select 
                              value={createForm.geminiAccountId || "shared"}
                              onValueChange={(value) => setCreateForm(prev => ({ 
                                ...prev, 
                                geminiAccountId: value === "shared" ? "" : value 
                              }))}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="shared">使用共享账号池</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          
                          <p className="text-xs text-gray-500">
                            选择专属账号后，此API Key将只使用该账号，不选择则使用共享账号池
                          </p>
                        </div>
                      )}
                    </div>
                    
                    {/* 高级选项 */}
                    <div className="space-y-2">
                      <Label>高级选项</Label>
                      <div className="space-y-3">
                        <div className="flex items-center space-x-2">
                          <Checkbox 
                            id="model-restriction"
                            checked={createForm.enableModelRestriction}
                            onCheckedChange={(checked) => setCreateForm(prev => ({ 
                              ...prev, 
                              enableModelRestriction: checked as boolean 
                            }))}
                          />
                          <Label htmlFor="model-restriction" className="cursor-pointer">
                            启用模型限制
                          </Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Checkbox 
                            id="client-restriction"
                            checked={createForm.enableClientRestriction}
                            onCheckedChange={(checked) => setCreateForm(prev => ({ 
                              ...prev, 
                              enableClientRestriction: checked as boolean 
                            }))}
                          />
                          <Label htmlFor="client-restriction" className="cursor-pointer">
                            启用客户端限制
                          </Label>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* 固定在底部的按钮区域 */}
                  <div className="flex-shrink-0 border-t px-6 py-4">
                    <div className="flex gap-3 justify-end">
                      <Button 
                        variant="outline" 
                        onClick={() => {
                          setShowCreateDialog(false);
                          // 重置表单
                          setCreateForm({
                            name: '',
                            tags: [],
                            description: '',
                            targetUserId: currentUserId || '',
                            expiresInDays: 0,
                            dailyCostLimit: 50,
                            concurrencyLimit: 0,
                            rateLimit: {
                              type: 'unlimited',
                              windowMinutes: 60,
                              maxRequests: 1000,
                              maxTokens: 100000
                            },
                            servicePermissions: 'all',
                            claudeAccountId: '',
                            geminiAccountId: '',
                            enableModelRestriction: false,
                            enableClientRestriction: false
                          });
                          setTagInput('');
                          setShowRateLimitSettings(false);
                          setShowConcurrencySettings(false);
                          setShowAccountBindingSettings(false);
                          setCustomDailyLimit(false);
                          setCustomExpiry(false);
                        }}
                      >
                        取消
                      </Button>
                      <Button 
                        onClick={handleCreateApiKey} 
                        disabled={creating || !createForm.name.trim()}
                        className="bg-blue-500 hover:bg-blue-600"
                      >
                        {creating ? (
                          <>
                            <RotateCcw className="w-4 h-4 mr-2 animate-spin" />
                            创建中...
                          </>
                        ) : (
                          <>
                            <Plus className="w-4 h-4 mr-2" />
                            创建
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </GroupManagerGuard>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {safeApiKeys.map((apiKey) => {
              const isExpired = apiKey.expiresAt && new Date(apiKey.expiresAt) < new Date();
              const isVisible = visibleKeys.has(apiKey.id);
              
              return (
                <div key={apiKey.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                      <Key className="w-5 h-5 text-purple-600" />
                    </div>
                    
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{apiKey.name}</span>
                        {isExpiringSoon(apiKey.expiresAt) && !isExpired && (
                          <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
                            即将过期
                          </Badge>
                        )}
                        {isExpired && (
                          <Badge variant="secondary" className="bg-red-100 text-red-800">
                            已过期
                          </Badge>
                        )}
                      </div>
                      <div className="text-sm text-gray-500">
                        密钥: {apiKey.keyPrefix}***
                        <button
                          onClick={() => handleToggleKeyVisibility(apiKey.id)}
                          className="ml-2 text-blue-500 hover:text-blue-600"
                        >
                          {isVisible ? <EyeOff className="w-4 h-4 inline" /> : <Eye className="w-4 h-4 inline" />}
                        </button>
                      </div>
                      <div className="text-xs text-gray-400">
                        权限: {apiKey.permissions.map(getPermissionDisplayName).join(', ')}
                      </div>
                      <div className="text-xs text-gray-400">
                        最后使用: {formatLastUsed(apiKey.lastUsedAt)}
                      </div>
                      {apiKey.expiresAt && (
                        <div className="text-xs text-gray-400">
                          过期时间: {new Date(apiKey.expiresAt).toLocaleDateString('zh-CN')}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    {/* 使用统计 */}
                    <div className="text-right text-sm space-y-2">
                      <div className="space-y-1">
                        <div className="text-gray-600">{apiKey.usageStats.totalRequests} 次调用</div>
                        <div className="text-gray-500">{apiKey.usageStats.totalTokens.toLocaleString()} tokens</div>
                        <div className="text-gray-500">${apiKey.usageStats.totalCost.toFixed(2)}</div>
                      </div>
                      {/* 配额使用进度 */}
                      {apiKey.quotaLimit && (
                        <div className="w-32">
                          <div className="flex justify-between text-xs text-gray-500 mb-1">
                            <span>配额</span>
                            <span>{((Number(apiKey.quotaUsed) / Number(apiKey.quotaLimit)) * 100).toFixed(1)}%</span>
                          </div>
                          <Progress 
                            value={getQuotaUsagePercentage(Number(apiKey.quotaUsed), Number(apiKey.quotaLimit))}
                            className="h-2"
                          />
                        </div>
                      )}
                    </div>
                    
                    {/* 状态标签 */}
                    <Badge 
                      variant={apiKey.isActive && !isExpired ? 'default' : 'secondary'}
                      className={
                        apiKey.isActive && !isExpired ? 'bg-green-100 text-green-800' :
                        isExpired ? 'bg-red-100 text-red-800' :
                        'bg-gray-100 text-gray-800'
                      }
                    >
                      {isExpired ? '已过期' : apiKey.isActive ? '活跃' : '停用'}
                    </Badge>
                    
                    {/* 管理操作 */}
                    {canManageApiKeys && (
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleTestApiKey(apiKey.id, apiKey.name)}
                          disabled={testingKeys.has(apiKey.id) || isExpired}
                          className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                        >
                          {testingKeys.has(apiKey.id) ? (
                            <RotateCcw className="w-4 h-4 animate-spin" />
                          ) : (
                            <TestTube className="w-4 h-4" />
                          )}
                        </Button>
                        
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleToggleApiKey(apiKey.id, apiKey.isActive)}
                          disabled={isExpired}
                        >
                          {apiKey.isActive ? '停用' : '启用'}
                        </Button>
                        
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteApiKey(apiKey.id, apiKey.name)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            
            {safeApiKeys.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <Key className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                <p>暂无API密钥</p>
                <p className="text-sm">创建API密钥来访问拼车组的AI服务</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 安全提醒 */}
      {safeApiKeys.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-orange-500" />
              安全提醒
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                <span>API密钥具有访问您拼车组AI服务的权限，请妥善保管</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                <span>不要在公开的代码仓库中暴露API密钥</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                <span>定期轮换API密钥，特别是当怀疑密钥泄露时</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                <span>为不同的应用和环境使用不同的API密钥</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* CLI配置指导对话框 */}
      <Dialog open={showCliConfigDialog} onOpenChange={setShowCliConfigDialog}>
        <DialogContent className="max-w-4xl w-[95vw] max-h-[90vh] flex flex-col">
          <DialogHeader className="flex-shrink-0 pb-4 border-b">
            <DialogTitle className="flex items-center gap-2">
              <Key className="w-5 h-5" />
              API密钥创建成功！
            </DialogTitle>
            <DialogDescription>
              您的API密钥已创建成功。请复制以下配置信息，密钥将只显示这一次。
            </DialogDescription>
          </DialogHeader>
          
          {/* 可滚动的内容区域 */}
          <div className="flex-1 overflow-y-auto px-1">
            <div className="space-y-6 py-4">
            {/* API密钥显示 */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">您的API密钥</Label>
              <div className="flex items-center gap-2">
                <code className="flex-1 p-3 bg-gray-100 rounded border font-mono text-sm break-all">
                  {newlyCreatedKey}
                </code>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    navigator.clipboard.writeText(newlyCreatedKey);
                    toast.success('API密钥已复制到剪贴板');
                  }}
                >
                  <Copy className="w-4 h-4 mr-1" />
                  复制
                </Button>
              </div>
            </div>

            {/* CLI工具配置 */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                <Settings className="w-4 h-4" />
                CLI工具配置
              </div>
              
              {/* Claude Code CLI */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Claude Code CLI</Label>
                <div className="bg-gray-900 text-green-400 p-3 rounded font-mono text-sm overflow-x-auto">
                  <div className="whitespace-pre-wrap break-all"># 设置环境变量</div>
                  <div className="whitespace-pre-wrap break-all">export ANTHROPIC_BASE_URL="{getCurrentDomain()}/api/v1"</div>
                  <div className="whitespace-pre-wrap break-all">export ANTHROPIC_AUTH_TOKEN="{newlyCreatedKey}"</div>
                  <div className="mt-2 whitespace-pre-wrap break-all"># 验证配置</div>
                  <div className="whitespace-pre-wrap break-all">claude --version</div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const config = `# Claude Code CLI 配置\nexport ANTHROPIC_BASE_URL="${getCurrentDomain()}/api/v1"\nexport ANTHROPIC_AUTH_TOKEN="${newlyCreatedKey}"\n\n# 验证配置\nclaude --version`;
                    navigator.clipboard.writeText(config);
                    toast.success('Claude Code配置已复制');
                  }}
                >
                  <Copy className="w-4 h-4 mr-1" />
                  复制配置
                </Button>
              </div>

              {/* Gemini CLI */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Gemini CLI</Label>
                <div className="bg-gray-900 text-green-400 p-3 rounded font-mono text-sm overflow-x-auto">
                  <div className="whitespace-pre-wrap break-all"># 设置环境变量</div>
                  <div className="whitespace-pre-wrap break-all">export GEMINI_API_URL="{getCurrentDomain()}/api/ai-proxy"</div>
                  <div className="whitespace-pre-wrap break-all">export GEMINI_API_KEY="{newlyCreatedKey}"</div>
                  <div className="mt-2 whitespace-pre-wrap break-all"># 验证配置</div>
                  <div className="whitespace-pre-wrap break-all">gemini-cli --help</div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const config = `# Gemini CLI 配置\nexport GEMINI_API_URL="${getCurrentDomain()}/api/ai-proxy"\nexport GEMINI_API_KEY="${newlyCreatedKey}"\n\n# 验证配置\ngemini-cli --help`;
                    navigator.clipboard.writeText(config);
                    toast.success('Gemini CLI配置已复制');
                  }}
                >
                  <Copy className="w-4 h-4 mr-1" />
                  复制配置
                </Button>
              </div>

              {/* ampcode CLI */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">ampcode CLI</Label>
                <div className="bg-gray-900 text-green-400 p-3 rounded font-mono text-sm overflow-x-auto">
                  <div className="whitespace-pre-wrap break-all"># 设置环境变量</div>
                  <div className="whitespace-pre-wrap break-all">export AMPCODE_BASE_URL="{getCurrentDomain()}/api/ai-proxy"</div>
                  <div className="whitespace-pre-wrap break-all">export AMPCODE_API_KEY="{newlyCreatedKey}"</div>
                  <div className="mt-2 whitespace-pre-wrap break-all"># 验证配置</div>
                  <div className="whitespace-pre-wrap break-all">ampcode --version</div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const config = `# ampcode CLI 配置\nexport AMPCODE_BASE_URL="${getCurrentDomain()}/api/ai-proxy"\nexport AMPCODE_API_KEY="${newlyCreatedKey}"\n\n# 验证配置\nampcode --version`;
                    navigator.clipboard.writeText(config);
                    toast.success('ampcode配置已复制');
                  }}
                >
                  <Copy className="w-4 h-4 mr-1" />
                  复制配置
                </Button>
              </div>
            </div>

            {/* 安全提醒 */}
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5" />
                <div className="space-y-2">
                  <div className="font-medium text-yellow-800">重要安全提醒</div>
                  <div className="text-sm text-yellow-700 space-y-1">
                    <div>• 请妥善保管您的API密钥，不要在公开场所分享</div>
                    <div>• 建议将密钥保存在安全的密码管理器中</div>
                    <div>• 如果怀疑密钥泄露，请立即删除并重新创建</div>
                    <div>• 定期检查API密钥的使用情况和统计信息</div>
                  </div>
                </div>
              </div>
            </div>
            </div>
          </div>

          {/* 固定在底部的按钮区域 */}
          <div className="flex-shrink-0 border-t pt-4">
            <div className="flex justify-end gap-2">
              <Button 
                onClick={() => {
                  setShowCliConfigDialog(false);
                  setNewlyCreatedKey('');
                }}
              >
                我已保存，关闭
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* API Key测试结果对话框 */}
      <Dialog open={showTestDialog} onOpenChange={setShowTestDialog}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <TestTube className="w-5 h-5" />
              API密钥测试结果
            </DialogTitle>
            <DialogDescription>
              检查API密钥的有效性、配额使用情况和连接状态
            </DialogDescription>
          </DialogHeader>
          
          {testResults && (
            <div className="space-y-6">
              {/* 总体状态 */}
              <div className="flex items-center gap-3 p-4 rounded-lg border-2" style={{
                borderColor: testResults.overall === 'success' ? '#10b981' : '#ef4444',
                backgroundColor: testResults.overall === 'success' ? '#ecfdf5' : '#fef2f2'
              }}>
                {testResults.overall === 'success' ? (
                  <CheckCircle className="w-6 h-6 text-green-600" />
                ) : (
                  <XCircle className="w-6 h-6 text-red-600" />
                )}
                <div>
                  <div className="font-medium text-lg">
                    {testResults.overall === 'success' ? '测试通过' : '测试失败'}
                  </div>
                  <div className="text-sm text-gray-600">{testResults.message}</div>
                </div>
              </div>

              {/* API密钥信息 */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="font-medium mb-2">API密钥信息</div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">名称: </span>
                    <span className="font-medium">{testResults.apiKey.name}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">状态: </span>
                    <Badge variant={testResults.apiKey.status === 'active' ? 'default' : 'secondary'}>
                      {testResults.apiKey.status === 'active' ? '活跃' : '停用'}
                    </Badge>
                  </div>
                  <div>
                    <span className="text-gray-600">密钥前缀: </span>
                    <code className="bg-white px-2 py-1 rounded text-xs">{testResults.apiKey.keyPrefix}</code>
                  </div>
                  <div>
                    <span className="text-gray-600">创建时间: </span>
                    <span>{new Date(testResults.apiKey.createdAt).toLocaleString('zh-CN')}</span>
                  </div>
                </div>
              </div>

              {/* 测试详情 */}
              <div className="space-y-4">
                <div className="font-medium">测试详情</div>
                
                {Object.entries(testResults.testResults).map(([key, result]: [string, any]) => (
                  <div key={key} className="border rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      {result.status === 'success' && <CheckCircle className="w-5 h-5 text-green-600" />}
                      {result.status === 'error' && <XCircle className="w-5 h-5 text-red-600" />}
                      {result.status === 'warning' && <AlertCircle className="w-5 h-5 text-yellow-600" />}
                      {result.status === 'info' && <AlertTriangle className="w-5 h-5 text-blue-600" />}
                      <span className="font-medium">{result.name}</span>
                    </div>
                    
                    {result.message && (
                      <div className="text-sm text-gray-600 mb-2">{result.message}</div>
                    )}
                    
                    {result.details && (
                      <div className="bg-gray-50 p-3 rounded text-sm">
                        {typeof result.details === 'object' ? (
                          <div className="space-y-1">
                            {Object.entries(result.details).map(([detailKey, detailValue]: [string, any]) => (
                              <div key={detailKey} className="flex justify-between">
                                <span className="text-gray-600">{detailKey}:</span>
                                <span className="font-medium">{String(detailValue)}</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div>{String(result.details)}</div>
                        )}
                      </div>
                    )}
                    
                    {result.error && (
                      <div className="text-sm text-red-600 mt-2">
                        错误: {result.error}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-4">
            <Button onClick={() => setShowTestDialog(false)}>
              关闭
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
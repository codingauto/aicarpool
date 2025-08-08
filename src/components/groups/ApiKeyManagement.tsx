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
import { Key, Plus, Copy, RotateCcw, Trash2, Eye, EyeOff, AlertTriangle, User, Clock, DollarSign, Settings, TestTube, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
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
    description: '',
    targetUserId: currentUserId || '', // 默认为当前用户
    expiresInDays: 30,
    dailyCostLimit: 5,
    rateLimit: {
      windowMinutes: 60,
      maxRequests: 100,
      maxTokens: 50000
    },
    servicePermissions: ['all'] as string[],
    resourceBinding: 'shared' as 'shared' | 'dedicated'
  });

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
      const response = await fetch(`/api/groups/${groupId}/api-keys`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: createForm.name,
          description: createForm.description,
          targetUserId: createForm.targetUserId,
          expiresInDays: createForm.expiresInDays,
          dailyCostLimit: createForm.dailyCostLimit,
          rateLimit: createForm.rateLimit,
          servicePermissions: createForm.servicePermissions,
          resourceBinding: createForm.resourceBinding
        })
      });

      const data = await response.json();
      if (data.success) {
        toast.success('API密钥创建成功');
        setShowCreateDialog(false);
        setCreateForm({
          name: '',
          description: '',
          targetUserId: currentUserId || '',
          expiresInDays: 30,
          dailyCostLimit: 5,
          rateLimit: {
            windowMinutes: 60,
            maxRequests: 100,
            maxTokens: 50000
          },
          servicePermissions: ['all'],
          resourceBinding: 'shared'
        });
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

  const getQuotaUsageColor = (percentage: number) => {
    if (percentage >= 90) return 'bg-red-500';
    if (percentage >= 75) return 'bg-yellow-500';
    return 'bg-green-500';
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
                <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>创建新的API密钥</DialogTitle>
                    <DialogDescription>
                      为拼车组成员创建API访问密钥，用于CLI工具和程序化访问AI服务
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-6">
                    {/* 基础信息 */}
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                        <Settings className="w-4 h-4" />
                        基础信息
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="name">密钥名称</Label>
                          <Input
                            id="name"
                            value={createForm.name}
                            onChange={(e) => setCreateForm(prev => ({ ...prev, name: e.target.value }))}
                            placeholder="如：生产环境CLI"
                          />
                        </div>
                        
                        <div className="space-y-2">
                          <Label htmlFor="targetUser">绑定成员</Label>
                          <Select 
                            value={createForm.targetUserId} 
                            onValueChange={(value) => setCreateForm(prev => ({ ...prev, targetUserId: value }))}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="选择成员" />
                            </SelectTrigger>
                            <SelectContent>
                              {canManageApiKeys ? (
                                members.map((member) => (
                                  <SelectItem key={member.userId} value={member.userId}>
                                    <div className="flex items-center gap-2">
                                      <User className="w-4 h-4" />
                                      {member.user.name}
                                      {member.userId === currentUserId && ' (我)'}
                                    </div>
                                  </SelectItem>
                                ))
                              ) : (
                                <SelectItem value={currentUserId || ''}>
                                  <div className="flex items-center gap-2">
                                    <User className="w-4 h-4" />
                                    我自己
                                  </div>
                                </SelectItem>
                              )}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="description">描述（可选）</Label>
                        <Textarea
                          id="description"
                          value={createForm.description}
                          onChange={(e) => setCreateForm(prev => ({ ...prev, description: e.target.value }))}
                          placeholder="描述此API密钥的用途..."
                          rows={2}
                        />
                      </div>
                    </div>

                    {/* 配额限制 */}
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                        <DollarSign className="w-4 h-4" />
                        配额限制
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="dailyLimit">每日费用限制 ($)</Label>
                          <Input
                            id="dailyLimit"
                            type="number"
                            min="1"
                            max="100"
                            value={createForm.dailyCostLimit}
                            onChange={(e) => setCreateForm(prev => ({ 
                              ...prev, 
                              dailyCostLimit: parseInt(e.target.value) || 5 
                            }))}
                          />
                        </div>
                        
                        <div className="space-y-2">
                          <Label htmlFor="windowMinutes">时间窗口（分钟）</Label>
                          <Select 
                            value={createForm.rateLimit.windowMinutes.toString()} 
                            onValueChange={(value) => setCreateForm(prev => ({ 
                              ...prev, 
                              rateLimit: { 
                                ...prev.rateLimit, 
                                windowMinutes: parseInt(value) 
                              } 
                            }))}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="1">1分钟</SelectItem>
                              <SelectItem value="5">5分钟</SelectItem>
                              <SelectItem value="10">10分钟</SelectItem>
                              <SelectItem value="60">60分钟</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="maxRequests">窗口内最大请求数</Label>
                          <Input
                            id="maxRequests"
                            type="number"
                            min="1"
                            value={createForm.rateLimit.maxRequests}
                            onChange={(e) => setCreateForm(prev => ({ 
                              ...prev, 
                              rateLimit: { 
                                ...prev.rateLimit, 
                                maxRequests: parseInt(e.target.value) || 100 
                              } 
                            }))}
                          />
                        </div>
                        
                        <div className="space-y-2">
                          <Label htmlFor="maxTokens">窗口内最大Token数</Label>
                          <Input
                            id="maxTokens"
                            type="number"
                            min="1000"
                            value={createForm.rateLimit.maxTokens}
                            onChange={(e) => setCreateForm(prev => ({ 
                              ...prev, 
                              rateLimit: { 
                                ...prev.rateLimit, 
                                maxTokens: parseInt(e.target.value) || 50000 
                              } 
                            }))}
                          />
                        </div>
                      </div>
                    </div>

                    {/* 服务权限和过期设置 */}
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                        <Clock className="w-4 h-4" />
                        服务权限与过期设置
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="servicePermissions">服务权限</Label>
                          <Select 
                            value={createForm.servicePermissions[0]} 
                            onValueChange={(value) => setCreateForm(prev => ({ 
                              ...prev, 
                              servicePermissions: [value] 
                            }))}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">全部服务</SelectItem>
                              <SelectItem value="claude">仅 Claude</SelectItem>
                              <SelectItem value="gemini">仅 Gemini</SelectItem>
                              <SelectItem value="custom">自定义</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        
                        <div className="space-y-2">
                          <Label htmlFor="expiresInDays">有效期</Label>
                          <Select 
                            value={createForm.expiresInDays.toString()} 
                            onValueChange={(value) => setCreateForm(prev => ({ 
                              ...prev, 
                              expiresInDays: parseInt(value) 
                            }))}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="7">7天</SelectItem>
                              <SelectItem value="30">30天</SelectItem>
                              <SelectItem value="90">90天</SelectItem>
                              <SelectItem value="365">1年</SelectItem>
                              <SelectItem value="0">永不过期</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex gap-2 justify-end">
                      <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                        取消
                      </Button>
                      <Button onClick={handleCreateApiKey} disabled={creating}>
                        {creating ? (
                          <>
                            <RotateCcw className="w-4 h-4 mr-2 animate-spin" />
                            创建中...
                          </>
                        ) : (
                          <>
                            <Key className="w-4 h-4 mr-2" />
                            创建密钥
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
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Key className="w-5 h-5" />
              API密钥创建成功！
            </DialogTitle>
            <DialogDescription>
              您的API密钥已创建成功。请复制以下配置信息，密钥将只显示这一次。
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6">
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
                <div className="bg-gray-900 text-green-400 p-3 rounded font-mono text-sm">
                  <div># 设置环境变量</div>
                  <div>export ANTHROPIC_BASE_URL="{getCurrentDomain()}/api/v1"</div>
                  <div>export ANTHROPIC_AUTH_TOKEN="{newlyCreatedKey}"</div>
                  <div className="mt-2"># 验证配置</div>
                  <div>claude --version</div>
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
                <div className="bg-gray-900 text-green-400 p-3 rounded font-mono text-sm">
                  <div># 设置环境变量</div>
                  <div>export GEMINI_API_URL="{getCurrentDomain()}/api/ai-proxy"</div>
                  <div>export GEMINI_API_KEY="{newlyCreatedKey}"</div>
                  <div className="mt-2"># 验证配置</div>
                  <div>gemini-cli --help</div>
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
                <div className="bg-gray-900 text-green-400 p-3 rounded font-mono text-sm">
                  <div># 设置环境变量</div>
                  <div>export AMPCODE_BASE_URL="{getCurrentDomain()}/api/ai-proxy"</div>
                  <div>export AMPCODE_API_KEY="{newlyCreatedKey}"</div>
                  <div className="mt-2"># 验证配置</div>
                  <div>ampcode --version</div>
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

          <div className="flex justify-end gap-2 pt-4">
            <Button 
              onClick={() => {
                setShowCliConfigDialog(false);
                setNewlyCreatedKey('');
              }}
            >
              我已保存，关闭
            </Button>
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
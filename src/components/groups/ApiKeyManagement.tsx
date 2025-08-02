'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Key, Plus, Copy, RotateCcw, Trash2, Eye, EyeOff, AlertTriangle } from 'lucide-react';
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
}

export function ApiKeyManagement({ groupId, canManageApiKeys }: ApiKeyManagementProps) {
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [visibleKeys, setVisibleKeys] = useState<Set<string>>(new Set());
  
  // 创建API密钥表单状态
  const [createForm, setCreateForm] = useState({
    name: '',
    permissions: ['chat'],
    expiresInDays: 30,
    description: ''
  });

  const fetchApiKeys = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/groups/${groupId}/api-keys`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setApiKeys(data.data || []);
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
        body: JSON.stringify(createForm)
      });

      const data = await response.json();
      if (data.success) {
        toast.success('API密钥创建成功');
        setShowCreateDialog(false);
        setCreateForm({ name: '', permissions: ['chat'], expiresInDays: 30, description: '' });
        fetchApiKeys();
        
        // 显示完整的API密钥
        if (data.data.fullKey) {
          const keyDialog = document.createElement('div');
          keyDialog.innerHTML = `
            <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div class="bg-white p-6 rounded-lg max-w-md w-full mx-4">
                <h3 class="text-lg font-bold mb-4">新的API密钥</h3>
                <p class="text-sm text-gray-600 mb-4">请复制并保存此密钥，它只会显示这一次：</p>
                <div class="bg-gray-100 p-3 rounded border font-mono text-sm break-all">
                  ${data.data.fullKey}
                </div>
                <div class="flex gap-2 mt-4">
                  <button onclick="navigator.clipboard.writeText('${data.data.fullKey}').then(() => alert('已复制到剪贴板'))" 
                          class="flex-1 bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600">
                    复制密钥
                  </button>
                  <button onclick="this.closest('.fixed').remove()" 
                          class="flex-1 bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600">
                    关闭
                  </button>
                </div>
              </div>
            </div>
          `;
          document.body.appendChild(keyDialog);
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

  const activeKeys = apiKeys.filter(key => key.isActive);
  const expiredKeys = apiKeys.filter(key => key.expiresAt && new Date(key.expiresAt) < new Date());
  const totalRequests = apiKeys.reduce((sum, key) => sum + key.usageStats.totalRequests, 0);
  const totalTokens = apiKeys.reduce((sum, key) => sum + key.usageStats.totalTokens, 0);

  return (
    <div className="space-y-6">
      {/* API密钥统计 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">总密钥数</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{apiKeys.length}</div>
            <div className="text-sm text-gray-500">已创建密钥</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">活跃密钥</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{activeKeys.length}</div>
            <div className="text-sm text-gray-500">正在使用</div>
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
            <CardTitle className="text-sm font-medium text-gray-600">Token消耗</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">{totalTokens.toLocaleString()}</div>
            <div className="text-sm text-gray-500">累计消耗</div>
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
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>创建新的API密钥</DialogTitle>
                    <DialogDescription>
                      为拼车组创建API访问密钥，用于程序化访问AI服务
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="name">密钥名称</Label>
                      <Input
                        id="name"
                        value={createForm.name}
                        onChange={(e) => setCreateForm(prev => ({ ...prev, name: e.target.value }))}
                        placeholder="输入密钥名称，如：生产环境API"
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="permissions">权限范围</Label>
                      <Select 
                        value={createForm.permissions[0]} 
                        onValueChange={(value) => setCreateForm(prev => ({ ...prev, permissions: [value] }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="chat">仅聊天对话</SelectItem>
                          <SelectItem value="usage">聊天+使用统计</SelectItem>
                          <SelectItem value="members">聊天+成员查看</SelectItem>
                          <SelectItem value="admin">完全管理权限</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div>
                      <Label htmlFor="expiresInDays">有效期（天）</Label>
                      <Select 
                        value={createForm.expiresInDays.toString()} 
                        onValueChange={(value) => setCreateForm(prev => ({ ...prev, expiresInDays: parseInt(value) }))}
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
                    
                    <div>
                      <Label htmlFor="description">描述（可选）</Label>
                      <Textarea
                        id="description"
                        value={createForm.description}
                        onChange={(e) => setCreateForm(prev => ({ ...prev, description: e.target.value }))}
                        placeholder="描述此API密钥的用途..."
                        rows={3}
                      />
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
            {apiKeys.map((apiKey) => {
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
                    <div className="text-right text-sm">
                      <div className="text-gray-600">{apiKey.usageStats.totalRequests} 次调用</div>
                      <div className="text-gray-500">{apiKey.usageStats.totalTokens.toLocaleString()} tokens</div>
                      <div className="text-gray-500">${apiKey.usageStats.totalCost.toFixed(2)}</div>
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
            
            {apiKeys.length === 0 && (
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
      {apiKeys.length > 0 && (
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
    </div>
  );
}
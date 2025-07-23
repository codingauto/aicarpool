'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AppHeader } from '@/components/layout/AppHeader';
import { EnhancedAiServiceConfig } from '@/components/groups/EnhancedAiServiceConfig';
import { DeploymentModeConfig } from '@/components/groups/DeploymentModeConfig';
import { 
  Users, 
  Key, 
  Activity, 
  Settings, 
  UserPlus, 
  Plus,
  MoreHorizontal,
  Mail,
  Calendar,
  DollarSign,
  Clock,
  Shield,
  Copy,
  CheckCircle,
  Globe,
  Server,
  AlertTriangle,
  TrendingUp
} from 'lucide-react';

interface GroupDetail {
  id: string;
  name: string;
  description?: string;
  maxMembers: number;
  status: string;
  settings?: any;
  createdAt: string;
  updatedAt: string;
  createdBy: {
    id: string;
    name: string;
    email: string;
  };
  members: Array<{
    id: string;
    role: string;
    status: string;
    joinedAt: string;
    user: {
      id: string;
      name: string;
      email: string;
      avatar?: string;
    };
  }>;
  aiServices: Array<{
    id: string;
    isEnabled: boolean;
    quota?: any;
    authConfig?: any;
    aiService: {
      id: string;
      serviceName: string;
      displayName: string;
      description?: string;
    };
  }>;
  apiKeys: Array<{
    id: string;
    key: string;
    name: string;
    description?: string;
    quotaLimit?: bigint;
    quotaUsed: bigint;
    status: string;
    lastUsedAt?: string;
    createdAt: string;
    aiService: {
      id: string;
      serviceName: string;
      displayName: string;
    };
    user: {
      id: string;
      name: string;
    };
  }>;
  invitations: Array<{
    id: string;
    email: string;
    status: string;
    expiresAt: string;
    createdAt: string;
    inviter: {
      id: string;
      name: string;
    };
  }>;
  stats: {
    memberCount: number;
    apiKeyCount: number;
    totalUsage: number;
    totalCost: number;
  };
}

export default function GroupDetailPage() {
  const params = useParams();
  const router = useRouter();
  const groupId = params.id as string;

  const [group, setGroup] = useState<GroupDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentUser, setCurrentUser] = useState<any>(null);

  // 邀请用户相关状态
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteError, setInviteError] = useState('');

  // 创建API密钥相关状态
  const [showCreateKeyDialog, setShowCreateKeyDialog] = useState(false);
  const [keyName, setKeyName] = useState('');
  const [keyDescription, setKeyDescription] = useState('');
  const [selectedAiService, setSelectedAiService] = useState('');
  const [createKeyLoading, setCreateKeyLoading] = useState(false);
  const [createKeyError, setCreateKeyError] = useState('');

  // AI服务相关状态已移至EnhancedAiServiceConfig组件

  // Tab状态管理
  const [activeTab, setActiveTab] = useState('members');

  const fetchGroupDetail = async () => {
    setLoading(true);
    setError('');

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        router.push('/auth/login');
        return;
      }

      const response = await fetch(`/api/groups/${groupId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (data.success) {
        setGroup(data.data);
      } else {
        console.error('API Error:', { status: response.status, data });
        if (response.status === 401) {
          console.log('Token expired, redirecting to login');
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          router.push('/auth/login');
          return;
        } else {
          setError(data.error || '获取拼车组详情失败');
        }
      }
    } catch (error) {
      console.error('Network error:', error);
      setError('网络错误，请稍后重试');
    } finally {
      setLoading(false);
    }
  };


  // 添加AI服务
  const handleAddAiService = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddServiceLoading(true);
    setAddServiceError('');

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        router.push('/auth/login');
        return;
      }

      const requestData = {
        aiServiceId: selectedServiceId,
        keyName: serviceApiKey,
        quota: {
          ...(dailyLimit && { dailyLimit: parseInt(dailyLimit) }),
          ...(monthlyLimit && { monthlyLimit: parseInt(monthlyLimit) }),
        },
      };

      const response = await fetch(`/api/groups/${groupId}/ai-services`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(requestData),
      });

      const data = await response.json();
      if (data.success) {
        // 显示生成的API密钥
        if (data.data.generatedApiKey) {
          setGeneratedApiKey(data.data.generatedApiKey);
          setShowGeneratedKey(true);
        }
        
        // 重新获取拼车组信息并保持在AI服务tab
        await fetchGroupDetail();
        setActiveTab('services');
      } else {
        setAddServiceError(data.error || '添加AI服务失败');
      }
    } catch (error) {
      setAddServiceError('网络错误，请稍后重试');
    } finally {
      setAddServiceLoading(false);
    }
  };

  // 复制API密钥到剪贴板
  const copyApiKey = async () => {
    try {
      await navigator.clipboard.writeText(generatedApiKey);
      alert('API密钥已复制到剪贴板');
    } catch (error) {
      console.error('复制失败:', error);
      alert('复制失败，请手动复制');
    }
  };

  // 复制现有API密钥到剪贴板
  const copyExistingApiKey = async (apiKey: string) => {
    try {
      await navigator.clipboard.writeText(apiKey);
      alert('API密钥已复制到剪贴板');
    } catch (error) {
      console.error('复制失败:', error);
      alert('复制失败，请手动复制');
    }
  };

  // 格式化密钥显示（隐藏中间部分）
  const formatApiKeyDisplay = (key: string) => {
    if (key.length <= 12) return key;
    const prefix = key.substring(0, 8);
    const suffix = key.substring(key.length - 4);
    return `${prefix}...${suffix}`;
  };

  // 关闭AI服务配置对话框
  const closeAiServiceDialog = () => {
    setShowAddAiServiceDialog(false);
    setShowGeneratedKey(false);
    setSelectedServiceId('');
    setServiceApiKey('');
    setDailyLimit('');
    setMonthlyLimit('');
    setGeneratedApiKey('');
    setAddServiceError('');
  };

  // 切换AI服务启用状态
  const toggleAiServiceStatus = async (aiServiceId: string, currentStatus: boolean) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        router.push('/auth/login');
        return;
      }

      const response = await fetch(`/api/groups/${groupId}/ai-services`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          aiServiceId,
          isEnabled: !currentStatus,
        }),
      });

      const data = await response.json();
      if (data.success) {
        // 重新获取拼车组信息以更新UI并保持在AI服务tab
        await fetchGroupDetail();
        setActiveTab('services');
      } else {
        alert(data.error || '更新AI服务状态失败');
      }
    } catch (error) {
      console.error('Toggle AI service error:', error);
      alert('网络错误，请稍后重试');
    }
  };

  const handleInviteUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviteLoading(true);
    setInviteError('');

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/groups/${groupId}/invitations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          email: inviteEmail,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setShowInviteDialog(false);
        setInviteEmail('');
        fetchGroupDetail(); // 刷新数据
      } else {
        setInviteError(data.error || '邀请用户失败');
      }
    } catch (error) {
      setInviteError('网络错误，请稍后重试');
    } finally {
      setInviteLoading(false);
    }
  };

  const handleCreateApiKey = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateKeyLoading(true);
    setCreateKeyError('');

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/groups/${groupId}/api-keys`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: keyName,
          description: keyDescription || undefined,
          aiServiceId: selectedAiService,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setShowCreateKeyDialog(false);
        setKeyName('');
        setKeyDescription('');
        setSelectedAiService('');
        fetchGroupDetail(); // 刷新数据
      } else {
        setCreateKeyError(data.error || '创建API密钥失败');
      }
    } catch (error) {
      setCreateKeyError('网络错误，请稍后重试');
    } finally {
      setCreateKeyLoading(false);
    }
  };

  useEffect(() => {
    fetchGroupDetail();
    // 获取当前用户信息
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      try {
        setCurrentUser(JSON.parse(storedUser));
      } catch (e) {
        console.error('Failed to parse stored user:', e);
      }
    }
  }, [groupId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="text-lg text-gray-600">加载中...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="text-red-500 mb-4">{error}</div>
          <Button onClick={fetchGroupDetail}>重试</Button>
        </div>
      </div>
    );
  }

  if (!group) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="text-gray-500">拼车组不存在</div>
        </div>
      </div>
    );
  }

  const isAdmin = group.members.find(m => 
    m.user.id === currentUser?.id && m.role === 'admin'
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader title={group.name} />

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Group Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-3xl font-bold text-gray-900">{group.name}</h2>
              {group.description && (
                <p className="text-gray-600 mt-2">{group.description}</p>
              )}
            </div>
            <div className="flex items-center space-x-2">
              <Badge variant={group.status === 'active' ? 'default' : 'secondary'}>
                {group.status === 'active' ? '活跃' : '禁用'}
              </Badge>
              {isAdmin && (
                <Button variant="outline" size="sm">
                  <Settings className="w-4 h-4 mr-2" />
                  设置
                </Button>
              )}
            </div>
          </div>

          {/* Statistics */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center">
                  <Users className="w-5 h-5 text-blue-600 mr-3" />
                  <div>
                    <div className="text-2xl font-bold">
                      {group.stats.memberCount}/{group.maxMembers}
                    </div>
                    <div className="text-sm text-gray-600">成员</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center">
                  <Key className="w-5 h-5 text-green-600 mr-3" />
                  <div>
                    <div className="text-2xl font-bold">{group.stats.apiKeyCount}</div>
                    <div className="text-sm text-gray-600">API密钥</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center">
                  <Activity className="w-5 h-5 text-purple-600 mr-3" />
                  <div>
                    <div className="text-2xl font-bold">{group.aiServices.length}</div>
                    <div className="text-sm text-gray-600">AI服务</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center">
                  <DollarSign className="w-5 h-5 text-orange-600 mr-3" />
                  <div>
                    <div className="text-2xl font-bold">
                      ${group.stats.totalCost.toFixed(2)}
                    </div>
                    <div className="text-sm text-gray-600">总费用</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-8">
            <TabsTrigger value="members">成员管理</TabsTrigger>
            <TabsTrigger value="services">AI服务</TabsTrigger>
            <TabsTrigger value="api-keys">API密钥</TabsTrigger>
            <TabsTrigger value="deployment">部署模式</TabsTrigger>
            <TabsTrigger value="ip-proxy">IP代理</TabsTrigger>
            <TabsTrigger value="edge-nodes">边缘节点</TabsTrigger>
            <TabsTrigger value="invitations">邀请管理</TabsTrigger>
            <TabsTrigger value="usage">使用统计</TabsTrigger>
          </TabsList>

          {/* 成员管理 */}
          <TabsContent value="members" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>成员列表</CardTitle>
                    <CardDescription>
                      管理拼车组成员和权限
                    </CardDescription>
                  </div>
                  {isAdmin && (
                    <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
                      <DialogTrigger asChild>
                        <Button>
                          <UserPlus className="w-4 h-4 mr-2" />
                          邀请成员
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>邀请新成员</DialogTitle>
                          <DialogDescription>
                            输入要邀请的用户邮箱地址
                          </DialogDescription>
                        </DialogHeader>
                        <form onSubmit={handleInviteUser} className="space-y-4">
                          <div className="space-y-2">
                            <Label htmlFor="inviteEmail">邮箱地址</Label>
                            <Input
                              id="inviteEmail"
                              type="email"
                              value={inviteEmail}
                              onChange={(e) => setInviteEmail(e.target.value)}
                              required
                              disabled={inviteLoading}
                              placeholder="请输入邮箱地址"
                            />
                          </div>
                          {inviteError && (
                            <div className="text-red-500 text-sm">{inviteError}</div>
                          )}
                          <div className="flex space-x-2">
                            <Button type="submit" disabled={inviteLoading}>
                              {inviteLoading ? '邀请中...' : '发送邀请'}
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => setShowInviteDialog(false)}
                              disabled={inviteLoading}
                            >
                              取消
                            </Button>
                          </div>
                        </form>
                      </DialogContent>
                    </Dialog>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>用户</TableHead>
                      <TableHead>角色</TableHead>
                      <TableHead>状态</TableHead>
                      <TableHead>加入时间</TableHead>
                      <TableHead>操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {group.members.map((member) => (
                      <TableRow key={member.id}>
                        <TableCell>
                          <div className="flex items-center space-x-3">
                            <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
                              {member.user.avatar ? (
                                <img 
                                  src={member.user.avatar} 
                                  alt={member.user.name}
                                  className="w-8 h-8 rounded-full"
                                />
                              ) : (
                                <span className="text-sm font-medium">
                                  {member.user.name.charAt(0).toUpperCase()}
                                </span>
                              )}
                            </div>
                            <div>
                              <div className="font-medium">{member.user.name}</div>
                              <div className="text-sm text-gray-500">{member.user.email}</div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={member.role === 'admin' ? 'default' : 'secondary'}>
                            {member.role === 'admin' ? '管理员' : '成员'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={member.status === 'active' ? 'default' : 'secondary'}>
                            {member.status === 'active' ? '活跃' : '禁用'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {new Date(member.joinedAt).toLocaleDateString('zh-CN')}
                        </TableCell>
                        <TableCell>
                          {isAdmin && member.user.id !== currentUser?.id && (
                            <Button variant="ghost" size="sm">
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* AI服务 */}
          <TabsContent value="services" className="space-y-6">
            <EnhancedAiServiceConfig
              groupId={groupId}
              isAdmin={isAdmin}
              onRefresh={fetchGroupDetail}
            />
          </TabsContent>

          {/* 部署模式 */}
          <TabsContent value="deployment" className="space-y-6">
            <DeploymentModeConfig
              groupId={groupId}
              isAdmin={isAdmin}
            />
          </TabsContent>

          {/* API密钥 */}
          <TabsContent value="api-keys" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>API密钥管理</CardTitle>
                    <CardDescription>
                      管理拼车组的API密钥
                    </CardDescription>
                  </div>
                  <Dialog open={showCreateKeyDialog} onOpenChange={setShowCreateKeyDialog}>
                    <DialogTrigger asChild>
                      <Button>
                        <Plus className="w-4 h-4 mr-2" />
                        创建密钥
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>创建API密钥</DialogTitle>
                        <DialogDescription>
                          为指定的AI服务创建新的API密钥
                        </DialogDescription>
                      </DialogHeader>
                      <form onSubmit={handleCreateApiKey} className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="keyName">密钥名称</Label>
                          <Input
                            id="keyName"
                            value={keyName}
                            onChange={(e) => setKeyName(e.target.value)}
                            required
                            disabled={createKeyLoading}
                            placeholder="请输入密钥名称"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="keyDescription">描述（可选）</Label>
                          <Textarea
                            id="keyDescription"
                            value={keyDescription}
                            onChange={(e) => setKeyDescription(e.target.value)}
                            disabled={createKeyLoading}
                            placeholder="请输入密钥描述"
                            rows={3}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="aiService">AI服务</Label>
                          <Select value={selectedAiService} onValueChange={setSelectedAiService} required>
                            <SelectTrigger>
                              <SelectValue placeholder="选择AI服务" />
                            </SelectTrigger>
                            <SelectContent>
                              {group.aiServices.filter(s => s.isEnabled).map((service) => (
                                <SelectItem key={service.aiService.id} value={service.aiService.id}>
                                  {service.aiService.displayName}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        {createKeyError && (
                          <div className="text-red-500 text-sm">{createKeyError}</div>
                        )}
                        <div className="flex space-x-2">
                          <Button type="submit" disabled={createKeyLoading}>
                            {createKeyLoading ? '创建中...' : '创建'}
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => setShowCreateKeyDialog(false)}
                            disabled={createKeyLoading}
                          >
                            取消
                          </Button>
                        </div>
                      </form>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent>
                {group.apiKeys.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>名称</TableHead>
                        <TableHead>API密钥</TableHead>
                        <TableHead>AI服务</TableHead>
                        <TableHead>创建者</TableHead>
                        <TableHead>配额使用</TableHead>
                        <TableHead>状态</TableHead>
                        <TableHead>最后使用</TableHead>
                        <TableHead>操作</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {group.apiKeys.map((apiKey) => (
                        <TableRow key={apiKey.id}>
                          <TableCell>
                            <div>
                              <div className="font-medium">{apiKey.name}</div>
                              {apiKey.description && (
                                <div className="text-sm text-gray-500">{apiKey.description}</div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center space-x-2">
                              <code className="text-xs bg-gray-100 px-2 py-1 rounded font-mono">
                                {formatApiKeyDisplay(apiKey.key)}
                              </code>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => copyExistingApiKey(apiKey.key)}
                                className="h-6 w-6 p-0 hover:bg-gray-100"
                              >
                                <Copy className="w-3 h-3" />
                              </Button>
                            </div>
                          </TableCell>
                          <TableCell>{apiKey.aiService.displayName}</TableCell>
                          <TableCell>{apiKey.user.name}</TableCell>
                          <TableCell>
                            <div className="text-sm">
                              {apiKey.quotaUsed.toString()} / {apiKey.quotaLimit?.toString() || '无限制'}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={apiKey.status === 'active' ? 'default' : 'secondary'}>
                              {apiKey.status === 'active' ? '活跃' : '禁用'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {apiKey.lastUsedAt 
                              ? new Date(apiKey.lastUsedAt).toLocaleDateString('zh-CN')
                              : '从未使用'
                            }
                          </TableCell>
                          <TableCell>
                            <Button variant="ghost" size="sm">
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center py-8">
                    <div className="text-gray-500 mb-4">还没有创建API密钥</div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* IP代理管理 */}
          <TabsContent value="ip-proxy" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>IP代理管理</CardTitle>
                    <CardDescription>
                      管理拼车组的IP代理套餐和配置
                    </CardDescription>
                  </div>
                  {isAdmin && (
                    <Button onClick={() => router.push('/ip-packages')}>
                      <Globe className="w-4 h-4 mr-2" />
                      浏览套餐
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8">
                  <Globe className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    IP代理功能开发中
                  </h3>
                  <p className="text-gray-500 mb-4">
                    将显示拼车组订阅的IP代理套餐、使用统计和配置管理
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
                    <div className="bg-blue-50 p-4 rounded-lg">
                      <div className="text-blue-600 font-medium mb-2">套餐管理</div>
                      <div className="text-sm text-gray-600">
                        查看和管理订阅的IP代理套餐
                      </div>
                    </div>
                    <div className="bg-green-50 p-4 rounded-lg">
                      <div className="text-green-600 font-medium mb-2">使用统计</div>
                      <div className="text-sm text-gray-600">
                        监控流量使用和连接状态
                      </div>
                    </div>
                    <div className="bg-purple-50 p-4 rounded-lg">
                      <div className="text-purple-600 font-medium mb-2">配置同步</div>
                      <div className="text-sm text-gray-600">
                        同步代理配置到拼车组成员
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* 边缘节点管理 */}
          <TabsContent value="edge-nodes" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>边缘节点管理</CardTitle>
                    <CardDescription>
                      管理拼车组绑定的边缘节点和负载调度
                    </CardDescription>
                  </div>
                  {isAdmin && (
                    <Button>
                      <Server className="w-4 h-4 mr-2" />
                      绑定节点
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8">
                  <Server className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    边缘节点功能开发中
                  </h3>
                  <p className="text-gray-500 mb-4">
                    将显示拼车组绑定的边缘节点、健康状态和负载调度配置
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
                    <div className="bg-blue-50 p-4 rounded-lg">
                      <div className="text-blue-600 font-medium mb-2">节点管理</div>
                      <div className="text-sm text-gray-600">
                        绑定和管理边缘节点
                      </div>
                    </div>
                    <div className="bg-green-50 p-4 rounded-lg">
                      <div className="text-green-600 font-medium mb-2">健康监控</div>
                      <div className="text-sm text-gray-600">
                        实时监控节点健康状态
                      </div>
                    </div>
                    <div className="bg-orange-50 p-4 rounded-lg">
                      <div className="text-orange-600 font-medium mb-2">负载调度</div>
                      <div className="text-sm text-gray-600">
                        配置智能负载调度策略
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* 邀请管理 */}
          <TabsContent value="invitations" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>邀请管理</CardTitle>
                <CardDescription>
                  查看和管理拼车组邀请
                </CardDescription>
              </CardHeader>
              <CardContent>
                {group.invitations.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>邮箱</TableHead>
                        <TableHead>状态</TableHead>
                        <TableHead>邀请者</TableHead>
                        <TableHead>邀请时间</TableHead>
                        <TableHead>过期时间</TableHead>
                        <TableHead>操作</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {group.invitations.map((invitation) => (
                        <TableRow key={invitation.id}>
                          <TableCell className="font-medium">{invitation.email}</TableCell>
                          <TableCell>
                            <Badge 
                              variant={
                                invitation.status === 'pending' ? 'default' :
                                invitation.status === 'accepted' ? 'default' : 'secondary'
                              }
                            >
                              {invitation.status === 'pending' ? '待接受' :
                               invitation.status === 'accepted' ? '已接受' : '已过期'
                              }
                            </Badge>
                          </TableCell>
                          <TableCell>{invitation.inviter.name}</TableCell>
                          <TableCell>
                            {new Date(invitation.createdAt).toLocaleDateString('zh-CN')}
                          </TableCell>
                          <TableCell>
                            {new Date(invitation.expiresAt).toLocaleDateString('zh-CN')}
                          </TableCell>
                          <TableCell>
                            {isAdmin && invitation.status === 'pending' && (
                              <Button variant="ghost" size="sm">
                                <MoreHorizontal className="w-4 h-4" />
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center py-8">
                    <div className="text-gray-500">没有邀请记录</div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* 使用统计 */}
          <TabsContent value="usage" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>使用统计</CardTitle>
                <CardDescription>
                  查看拼车组的使用情况和成本分析
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8">
                  <div className="text-gray-500 mb-4">使用统计功能开发中</div>
                  <div className="text-sm text-gray-400">
                    将显示详细的使用统计图表和成本分析
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
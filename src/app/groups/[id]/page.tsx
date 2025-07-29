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
  RefreshCw,
  X,
  Copy,
  QrCode,
  Link,
  Download,
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
  
  // 邀请操作相关状态
  const [inviteActionLoading, setInviteActionLoading] = useState<string | null>(null);
  
  // 批量邀请相关状态
  const [showBatchInviteDialog, setShowBatchInviteDialog] = useState(false);
  const [batchEmails, setBatchEmails] = useState('');
  const [batchInviteLoading, setBatchInviteLoading] = useState(false);
  const [batchInviteError, setBatchInviteError] = useState('');
  const [batchInviteResult, setBatchInviteResult] = useState<any>(null);
  
  // 邀请链接相关状态
  const [showCreateInviteLinkDialog, setShowCreateInviteLinkDialog] = useState(false);
  const [inviteLinks, setInviteLinks] = useState<any[]>([]);
  const [inviteLinkLoading, setInviteLinkLoading] = useState(false);
  const [inviteLinkError, setInviteLinkError] = useState('');
  const [inviteLinkForm, setInviteLinkForm] = useState({
    name: '',
    maxUses: 10,
    expiresInDays: 7
  });
  
  // 二维码相关状态
  const [showQRCodeDialog, setShowQRCodeDialog] = useState(false);
  const [qrCodeData, setQRCodeData] = useState<any>(null);
  const [qrCodeLoading, setQRCodeLoading] = useState(false);

  // 创建API密钥相关状态
  const [showCreateKeyDialog, setShowCreateKeyDialog] = useState(false);
  const [keyName, setKeyName] = useState('');
  const [keyDescription, setKeyDescription] = useState('');
  const [selectedAiService, setSelectedAiService] = useState('');
  const [createKeyLoading, setCreateKeyLoading] = useState(false);
  const [createKeyError, setCreateKeyError] = useState('');

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

  // 撤销邀请
  const handleCancelInvitation = async (invitationId: string) => {
    setInviteActionLoading(invitationId);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/groups/${groupId}/invitations/${invitationId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();
      if (data.success) {
        fetchGroupDetail(); // 刷新数据
      } else {
        alert(data.message || '撤销邀请失败');
      }
    } catch (error) {
      console.error('撤销邀请失败:', error);
      alert('网络错误，请稍后重试');
    } finally {
      setInviteActionLoading(null);
    }
  };

  // 重新发送邀请
  const handleResendInvitation = async (invitationId: string) => {
    setInviteActionLoading(invitationId);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/groups/${groupId}/invitations/${invitationId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();
      if (data.success) {
        alert('邀请已重新发送');
        fetchGroupDetail(); // 刷新数据
      } else {
        alert(data.message || '重新发送邀请失败');
      }
    } catch (error) {
      console.error('重新发送邀请失败:', error);
      alert('网络错误，请稍后重试');
    } finally {
      setInviteActionLoading(null);
    }
  };

  // 批量邀请用户
  const handleBatchInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setBatchInviteLoading(true);
    setBatchInviteError('');
    setBatchInviteResult(null);

    try {
      // 解析邮箱列表
      const emailList = batchEmails
        .split('\n')
        .map(email => email.trim())
        .filter(email => email.length > 0);

      if (emailList.length === 0) {
        setBatchInviteError('请输入至少一个邮箱地址');
        return;
      }

      const token = localStorage.getItem('token');
      const response = await fetch(`/api/groups/${groupId}/invitations/batch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          emails: emailList,
        }),
      });

      const data = await response.json();
      if (data.success) {
        setBatchInviteResult(data.data);
        setBatchEmails('');
        fetchGroupDetail(); // 刷新数据
      } else {
        setBatchInviteError(data.message || '批量邀请失败');
      }
    } catch (error) {
      console.error('批量邀请失败:', error);
      setBatchInviteError('网络错误，请稍后重试');
    } finally {
      setBatchInviteLoading(false);
    }
  };

  // 重置批量邀请对话框
  const resetBatchInviteDialog = () => {
    setShowBatchInviteDialog(false);
    setBatchEmails('');
    setBatchInviteError('');
    setBatchInviteResult(null);
  };

  // 获取邀请链接列表
  const fetchInviteLinks = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/groups/${groupId}/invite-link`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      const data = await response.json();
      if (data.success) {
        setInviteLinks(data.data);
      }
    } catch (error) {
      console.error('获取邀请链接失败:', error);
    }
  };

  // 创建邀请链接
  const handleCreateInviteLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviteLinkLoading(true);
    setInviteLinkError('');
    
    try {
      console.log('开始创建邀请链接...');
      console.log('表单数据:', inviteLinkForm);
      
      const token = localStorage.getItem('token');
      if (!token) {
        setInviteLinkError('用户未登录，请重新登录');
        return;
      }

      const response = await fetch(`/api/groups/${groupId}/invite-link`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(inviteLinkForm),
      });

      console.log('API响应状态:', response.status);
      
      const data = await response.json();
      console.log('API响应数据:', data);

      if (data.success) {
        setShowCreateInviteLinkDialog(false);
        setInviteLinkForm({ name: '', maxUses: 10, expiresInDays: 7 });
        setInviteLinkError('');
        fetchInviteLinks(); // 刷新列表
        alert('邀请链接创建成功！');
      } else {
        const errorMsg = data.error || data.message || '创建邀请链接失败';
        console.error('API错误:', errorMsg);
        setInviteLinkError(errorMsg);
      }
    } catch (error) {
      console.error('创建邀请链接网络错误:', error);
      const errorMsg = error instanceof Error ? error.message : '网络连接失败';
      setInviteLinkError(`网络错误: ${errorMsg}`);
    } finally {
      setInviteLinkLoading(false);
    }
  };

  // 生成二维码
  const handleGenerateQRCode = async (linkId?: string) => {
    setQRCodeLoading(true);
    setShowQRCodeDialog(true);
    
    try {
      const token = localStorage.getItem('token');
      const url = linkId 
        ? `/api/groups/${groupId}/qrcode?linkId=${linkId}`
        : `/api/groups/${groupId}/qrcode`;
        
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();
      if (data.success) {
        setQRCodeData(data.data);
      } else {
        alert(data.message || '生成二维码失败');
        setShowQRCodeDialog(false);
      }
    } catch (error) {
      console.error('生成二维码失败:', error);
      alert('网络错误，请稍后重试');
      setShowQRCodeDialog(false);
    } finally {
      setQRCodeLoading(false);
    }
  };

  // 复制邀请链接
  const copyInviteLink = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      alert('邀请链接已复制到剪贴板');
    } catch (error) {
      console.error('复制失败:', error);
      alert('复制失败，请手动复制');
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

  useEffect(() => {
    fetchGroupDetail();
    fetchInviteLinks();
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

  const isAdmin = !!group.members.find(m => 
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
                          {new Date(member.joinedAt).toLocaleDateString('zh-CN', {
                            year: 'numeric',
                            month: '2-digit',
                            day: '2-digit'
                          })}
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
            {/* 邀请方式快捷操作 */}
            {isAdmin && (
              <Card>
                <CardHeader>
                  <CardTitle>邀请新成员</CardTitle>
                  <CardDescription>
                    选择适合的邀请方式快速邀请新成员加入
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
                      <DialogTrigger asChild>
                        <Button variant="outline" className="h-20 flex-col space-y-2">
                          <Mail className="w-6 h-6" />
                          <span>邮件邀请</span>
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>邮件邀请</DialogTitle>
                          <DialogDescription>
                            输入邮箱地址发送邀请邮件
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
                              {inviteLoading ? '发送中...' : '发送邀请'}
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

                    <Dialog open={showBatchInviteDialog} onOpenChange={setShowBatchInviteDialog}>
                      <DialogTrigger asChild>
                        <Button variant="outline" className="h-20 flex-col space-y-2">
                          <Users className="w-6 h-6" />
                          <span>批量邀请</span>
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-2xl">
                        <DialogHeader>
                          <DialogTitle>批量邀请</DialogTitle>
                          <DialogDescription>
                            一次邀请多个用户，每行一个邮箱地址
                          </DialogDescription>
                        </DialogHeader>
                        <form onSubmit={handleBatchInvite} className="space-y-4">
                          <div className="space-y-2">
                            <Label htmlFor="batchEmails">邮箱列表</Label>
                            <Textarea
                              id="batchEmails"
                              value={batchEmails}
                              onChange={(e) => setBatchEmails(e.target.value)}
                              placeholder="user1@example.com&#10;user2@example.com&#10;user3@example.com"
                              rows={6}
                              disabled={batchInviteLoading}
                            />
                            <div className="text-sm text-gray-500">
                              最多一次邀请50个用户
                            </div>
                          </div>
                          {batchInviteError && (
                            <div className="text-red-500 text-sm">{batchInviteError}</div>
                          )}
                          {batchInviteResult && (
                            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                              <h4 className="font-medium text-green-800 mb-2">批量邀请结果</h4>
                              <div className="text-sm text-green-700 space-y-1">
                                <div>成功: {batchInviteResult.summary.successful} 个</div>
                                <div>失败: {batchInviteResult.summary.failed} 个</div>
                                <div>跳过: {batchInviteResult.summary.skippedMembers + batchInviteResult.summary.skippedInvitations} 个</div>
                              </div>
                            </div>
                          )}
                          <div className="flex space-x-2">
                            <Button type="submit" disabled={batchInviteLoading}>
                              {batchInviteLoading ? '批量邀请中...' : '批量邀请'}
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              onClick={resetBatchInviteDialog}
                              disabled={batchInviteLoading}
                            >
                              {batchInviteResult ? '重置' : '取消'}
                            </Button>
                          </div>
                        </form>
                      </DialogContent>
                    </Dialog>

                    <Dialog open={showCreateInviteLinkDialog} onOpenChange={setShowCreateInviteLinkDialog}>
                      <DialogTrigger asChild>
                        <Button variant="outline" className="h-20 flex-col space-y-2">
                          <Link className="w-6 h-6" />
                          <span>创建链接</span>
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>创建邀请链接</DialogTitle>
                          <DialogDescription>
                            创建可重复使用的邀请链接
                          </DialogDescription>
                        </DialogHeader>
                        <form onSubmit={handleCreateInviteLink} className="space-y-4">
                          <div className="space-y-2">
                            <Label htmlFor="linkName">链接名称</Label>
                            <Input
                              id="linkName"
                              value={inviteLinkForm.name}
                              onChange={(e) => setInviteLinkForm({...inviteLinkForm, name: e.target.value})}
                              required
                              disabled={inviteLinkLoading}
                              placeholder="请输入链接名称"
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label htmlFor="maxUses">最大使用次数</Label>
                              <Input
                                id="maxUses"
                                type="number"
                                min="1"
                                max="100"
                                value={inviteLinkForm.maxUses}
                                onChange={(e) => setInviteLinkForm({...inviteLinkForm, maxUses: parseInt(e.target.value) || 10})}
                                disabled={inviteLinkLoading}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="expiresInDays">有效期（天）</Label>
                              <Input
                                id="expiresInDays"
                                type="number"
                                min="1"
                                max="30"
                                value={inviteLinkForm.expiresInDays}
                                onChange={(e) => setInviteLinkForm({...inviteLinkForm, expiresInDays: parseInt(e.target.value) || 7})}
                                disabled={inviteLinkLoading}
                              />
                            </div>
                          </div>
                          {inviteLinkError && (
                            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                              <div className="flex items-start">
                                <AlertTriangle className="w-5 h-5 text-red-600 mr-2 mt-0.5 flex-shrink-0" />
                                <div>
                                  <div className="text-red-800 font-medium mb-1">创建失败</div>
                                  <div className="text-red-700 text-sm">{inviteLinkError}</div>
                                </div>
                              </div>
                            </div>
                          )}
                          <div className="flex space-x-2">
                            <Button type="submit" disabled={inviteLinkLoading}>
                              {inviteLinkLoading ? (
                                <>
                                  <div className="w-4 h-4 animate-spin rounded-full border-2 border-white border-t-transparent mr-2"></div>
                                  创建中...
                                </>
                              ) : (
                                '创建链接'
                              )}
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => {
                                setShowCreateInviteLinkDialog(false);
                                setInviteLinkError('');
                              }}
                              disabled={inviteLinkLoading}
                            >
                              取消
                            </Button>
                          </div>
                        </form>
                      </DialogContent>
                    </Dialog>

                    <Button 
                      variant="outline" 
                      className="h-20 flex-col space-y-2"
                      onClick={() => handleGenerateQRCode()}
                    >
                      <QrCode className="w-6 h-6" />
                      <span>生成二维码</span>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* 邮件邀请列表 */}
            <Card>
              <CardHeader>
                <CardTitle>邮件邀请记录</CardTitle>
                <CardDescription>
                  查看和管理邮件邀请记录
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
                            {(() => {
                              try {
                                const date = new Date(invitation.createdAt);
                                if (isNaN(date.getTime())) return '日期格式错误';
                                return date.toLocaleDateString('zh-CN', {
                                  year: 'numeric',
                                  month: '2-digit',
                                  day: '2-digit'
                                });
                              } catch (error) {
                                return '日期解析失败';
                              }
                            })()}
                          </TableCell>
                          <TableCell>
                            {(() => {
                              try {
                                const date = new Date(invitation.expiresAt);
                                if (isNaN(date.getTime())) return '日期格式错误';
                                return date.toLocaleDateString('zh-CN', {
                                  year: 'numeric',
                                  month: '2-digit',
                                  day: '2-digit'
                                });
                              } catch (error) {
                                return '日期解析失败';
                              }
                            })()}
                          </TableCell>
                          <TableCell>
                            {isAdmin && invitation.status === 'pending' && (
                              <div className="flex space-x-2">
                                <Button 
                                  variant="ghost" 
                                  size="sm"
                                  onClick={() => handleResendInvitation(invitation.id)}
                                  disabled={inviteActionLoading === invitation.id}
                                  title="重新发送邀请"
                                >
                                  {inviteActionLoading === invitation.id ? (
                                    <div className="w-4 h-4 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600"></div>
                                  ) : (
                                    <RefreshCw className="w-4 h-4 text-blue-600" />
                                  )}
                                </Button>
                                <Button 
                                  variant="ghost" 
                                  size="sm"
                                  onClick={() => handleCancelInvitation(invitation.id)}
                                  disabled={inviteActionLoading === invitation.id}
                                  title="撤销邀请"
                                >
                                  {inviteActionLoading === invitation.id ? (
                                    <div className="w-4 h-4 animate-spin rounded-full border-2 border-gray-300 border-t-red-600"></div>
                                  ) : (
                                    <X className="w-4 h-4 text-red-600" />
                                  )}
                                </Button>
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center py-8">
                    <div className="text-gray-500">没有邮件邀请记录</div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* 邀请链接列表 */}
            <Card>
              <CardHeader>
                <CardTitle>邀请链接管理</CardTitle>
                <CardDescription>
                  管理可重复使用的邀请链接
                </CardDescription>
              </CardHeader>
              <CardContent>
                {inviteLinks.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>链接名称</TableHead>
                        <TableHead>使用情况</TableHead>
                        <TableHead>状态</TableHead>
                        <TableHead>创建者</TableHead>
                        <TableHead>过期时间</TableHead>
                        <TableHead>操作</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {inviteLinks.map((link) => (
                        <TableRow key={link.id}>
                          <TableCell className="font-medium">{link.name}</TableCell>
                          <TableCell>
                            <div className="text-sm">
                              {link.usedCount}/{link.maxUses} 次使用
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge 
                              variant={
                                link.status === 'active' ? 'default' : 'secondary'
                              }
                            >
                              {link.status === 'active' ? '活跃' : 
                               link.status === 'expired' ? '已过期' : '已禁用'}
                            </Badge>
                          </TableCell>
                          <TableCell>{link.creator.name}</TableCell>
                          <TableCell>
                            {(() => {
                              try {
                                if (!link.expiresAt) return '无过期时间';
                                const date = new Date(link.expiresAt);
                                if (isNaN(date.getTime())) return '日期格式错误';
                                return date.toLocaleDateString('zh-CN', {
                                  year: 'numeric',
                                  month: '2-digit',
                                  day: '2-digit'
                                });
                              } catch (error) {
                                console.error('日期解析错误:', error, link.expiresAt);
                                return '日期解析失败';
                              }
                            })()}
                          </TableCell>
                          <TableCell>
                            <div className="flex space-x-2">
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => copyInviteLink(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001'}/join/${link.token}`)}
                                title="复制链接"
                              >
                                <Copy className="w-4 h-4 text-blue-600" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => handleGenerateQRCode(link.id)}
                                title="生成二维码"
                              >
                                <QrCode className="w-4 h-4 text-green-600" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center py-8">
                    <div className="text-gray-500">没有邀请链接</div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* 二维码对话框 */}
            <Dialog open={showQRCodeDialog} onOpenChange={setShowQRCodeDialog}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>邀请二维码</DialogTitle>
                  <DialogDescription>
                    扫描二维码加入拼车组
                  </DialogDescription>
                </DialogHeader>
                <div className="text-center space-y-4">
                  {qrCodeLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                      <span className="ml-2">正在生成二维码...</span>
                    </div>
                  ) : qrCodeData ? (
                    <>
                      <div className="flex justify-center">
                        <img 
                          src={qrCodeData.qrCode} 
                          alt="邀请二维码" 
                          className="border rounded-lg"
                        />
                      </div>
                      <div className="text-sm text-gray-600">
                        <p>邀请链接:</p>
                        <code className="block bg-gray-100 p-2 rounded text-xs break-all">
                          {qrCodeData.inviteUrl}
                        </code>
                      </div>
                      <div className="flex space-x-2">
                        <Button 
                          onClick={() => copyInviteLink(qrCodeData.inviteUrl)}
                          variant="outline"
                        >
                          <Copy className="w-4 h-4 mr-2" />
                          复制链接
                        </Button>
                        <Button 
                          onClick={() => {
                            const link = document.createElement('a');
                            link.href = qrCodeData.qrCode;
                            link.download = '邀请二维码.png';
                            link.click();
                          }}
                          variant="outline"
                        >
                          <Download className="w-4 h-4 mr-2" />
                          下载二维码
                        </Button>
                      </div>
                    </>
                  ) : null}
                </div>
              </DialogContent>
            </Dialog>
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

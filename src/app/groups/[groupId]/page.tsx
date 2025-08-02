'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { GroupHeader } from '@/components/groups/GroupHeader';
import { MemberManagement } from '@/components/groups/MemberManagement';
import { InvitationManagement } from '@/components/groups/InvitationManagement';
import { ApiKeyManagement } from '@/components/groups/ApiKeyManagement';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Settings, Users, Database, BarChart3, Key, UserPlus, AlertTriangle, Building2, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import { PermissionGuard, GroupEditorGuard, GroupManagerGuard, usePermissionCheck } from '@/components/auth/PermissionGuard';
import { useEnterprisePermissions } from '@/hooks/useEnterprisePermissions';
import { UsageChart } from '@/components/charts/UsageChart';

interface GroupDetail {
  id: string;
  name: string;
  description?: string;
  maxMembers: number;
  status: string;
  enterpriseId?: string;
  enterpriseName?: string;
  stats: {
    memberCount: number;
    totalCost: number;
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
      enterpriseRoles?: Array<{
        roleName: string;
        displayName: string;
        scope: string;
      }>;
    };
  }>;
  resourceBinding?: {
    id: string;
    bindingMode: 'dedicated' | 'shared' | 'hybrid';
    dailyTokenLimit: number;
    monthlyBudget?: number;
    priorityLevel: string;
  };
}

interface GroupPermissions {
  canView: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canManageMembers: boolean;
  canManageInvitations: boolean;
  canManageResources: boolean;
  canViewUsage: boolean;
  canExportData: boolean;
  canManageApiKeys: boolean;
}

interface CurrentUsage {
  today: {
    tokens: number;
    cost: number;
    requests: number;
  };
  thisMonth: {
    tokens: number;
    cost: number;
    requests: number;
  };
  utilizationRate: {
    dailyTokens: number;
    monthlyBudget: number;
  };
}

export default function GroupDetailPage() {
  const params = useParams();
  const router = useRouter();
  const groupId = params.groupId as string;

  const [group, setGroup] = useState<GroupDetail | null>(null);
  const [currentUsage, setCurrentUsage] = useState<CurrentUsage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentUser, setCurrentUser] = useState<{ id: string; name: string; email: string } | null>(null);
  const [activeTab, setActiveTab] = useState('overview');

  // 使用新的企业级权限系统
  const { 
    currentGroupPermissions, 
    hasPermission, 
    hasGroupPermission,
    permissionLevel,
    isEnterpriseMember 
  } = useEnterprisePermissions(groupId);

  const { 
    canManageGroup, 
    canEditGroup, 
    canViewGroup,
    isAdmin,
    canManageMembers 
  } = usePermissionCheck();

  // 基于新权限系统的权限检查
  const canManageResources = canManageGroup(groupId) || hasPermission('canManageResources');
  const canManageInvitations = canManageGroup(groupId) || hasPermission('canInviteMembers');
  const canManageApiKeys = canManageGroup(groupId) || hasPermission('canManageApiKeys');
  const canEdit = canEditGroup(groupId);
  const canViewUsage = canViewGroup(groupId);

  const fetchGroupDetail = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        router.push('/auth/login');
        return;
      }

      // 获取拼车组基本信息和权限
      const [groupResponse, membersResponse] = await Promise.all([
        fetch(`/api/groups/${groupId}`, {
          headers: { 'Authorization': `Bearer ${token}` },
        }),
        fetch(`/api/groups/${groupId}/members`, {
          headers: { 'Authorization': `Bearer ${token}` },
        })
      ]);

      if (groupResponse.status === 401 || membersResponse.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        router.push('/auth/login');
        return;
      }

      // 安全地解析JSON响应
      let groupData = { success: false, message: '获取拼车组信息失败' };
      let membersData = { success: false, members: [] };

      try {
        if (groupResponse.ok) {
          const groupText = await groupResponse.text();
          if (groupText.trim() && !groupText.startsWith('<!DOCTYPE')) {
            groupData = JSON.parse(groupText);
          }
        }
      } catch (error) {
        console.error('解析拼车组响应失败:', error);
      }

      try {
        if (membersResponse.ok) {
          const membersText = await membersResponse.text();
          if (membersText.trim() && !membersText.startsWith('<!DOCTYPE')) {
            membersData = JSON.parse(membersText);
          }
        }
      } catch (error) {
        console.error('解析成员响应失败:', error);
      }

      if (!groupData.success) {
        setError(groupData.message || '获取拼车组详情失败');
        return;
      }

      // 权限信息现在通过 useEnterprisePermissions hook 获取
      // 不再需要手动设置 permissions state

      // 组合数据
      const combinedGroup: GroupDetail = {
        ...groupData.data,
        enterpriseId: membersData.success ? membersData.group?.enterpriseId : null,
        enterpriseName: membersData.success ? membersData.group?.enterpriseName : null,
        members: membersData.success ? membersData.members : [],
      };

      setGroup(combinedGroup);
      setCurrentUsage(null); // 使用统计数据将通过独立API获取

    } catch (error) {
      console.error('获取拼车组详情失败:', error);
      setError('获取拼车组详情失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGroupDetail();
    
    // Get current user info
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      setCurrentUser(JSON.parse(storedUser));
    }
  }, [groupId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-500" />
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
          <button onClick={fetchGroupDetail} className="bg-blue-500 text-white px-4 py-2 rounded">
            重试
          </button>
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

  const getBindingModeDisplay = (mode: string) => {
    switch (mode) {
      case 'dedicated':
        return { label: '专属模式', color: 'bg-blue-100 text-blue-800' };
      case 'shared':
        return { label: '共享模式', color: 'bg-green-100 text-green-800' };
      case 'hybrid':
        return { label: '混合模式', color: 'bg-orange-100 text-orange-800' };
      default:
        return { label: '未配置', color: 'bg-gray-100 text-gray-800' };
    }
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toFixed(0);
  };

  return (
    <div className="p-6">
      {/* 企业信息提示 */}
      {group.enterpriseId && (
        <Alert className="mb-6">
          <Building2 className="h-4 w-4" />
          <AlertDescription>
            此拼车组隶属于企业：<strong>{group.enterpriseName}</strong>，使用企业级AI资源管理
          </AlertDescription>
        </Alert>
      )}

      <GroupHeader group={group} isAdmin={canManageGroup(groupId)} />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4" />
            概览
          </TabsTrigger>
          
          <PermissionGuard groupId={groupId} action="manage" 
            fallback={<TabsTrigger value="resources" disabled className="flex items-center gap-2 opacity-50">
              <Database className="w-4 h-4" />
              资源配置
            </TabsTrigger>}>
            <TabsTrigger value="resources" className="flex items-center gap-2">
              <Database className="w-4 h-4" />
              资源配置
            </TabsTrigger>
          </PermissionGuard>

          <PermissionGuard groupId={groupId} action="edit"
            fallback={<TabsTrigger value="members" disabled className="flex items-center gap-2 opacity-50">
              <Users className="w-4 h-4" />
              成员管理
            </TabsTrigger>}>
            <TabsTrigger value="members" className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              成员管理
            </TabsTrigger>
          </PermissionGuard>

          <PermissionGuard groupId={groupId} action="edit"
            fallback={<TabsTrigger value="invitations" disabled className="flex items-center gap-2 opacity-50">
              <UserPlus className="w-4 h-4" />
              邀请管理
            </TabsTrigger>}>
            <TabsTrigger value="invitations" className="flex items-center gap-2">
              <UserPlus className="w-4 h-4" />
              邀请管理
            </TabsTrigger>
          </PermissionGuard>

          <PermissionGuard groupId={groupId} action="manage"
            fallback={<TabsTrigger value="api-keys" disabled className="flex items-center gap-2 opacity-50">
              <Key className="w-4 h-4" />
              API密钥
            </TabsTrigger>}>
            <TabsTrigger value="api-keys" className="flex items-center gap-2">
              <Key className="w-4 h-4" />
              API密钥
            </TabsTrigger>
          </PermissionGuard>

          <PermissionGuard groupId={groupId} action="edit"
            fallback={<TabsTrigger value="settings" disabled className="flex items-center gap-2 opacity-50">
              <Settings className="w-4 h-4" />
              设置
            </TabsTrigger>}>
            <TabsTrigger value="settings" className="flex items-center gap-2">
              <Settings className="w-4 h-4" />
              设置
            </TabsTrigger>
          </PermissionGuard>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* 基本信息卡片 */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">成员数量</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{group.stats.memberCount}</div>
                <div className="text-sm text-gray-500">/ {group.maxMembers} 最大</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">资源模式</CardTitle>
              </CardHeader>
              <CardContent>
                {group.resourceBinding ? (
                  <Badge className={getBindingModeDisplay(group.resourceBinding.bindingMode).color}>
                    {getBindingModeDisplay(group.resourceBinding.bindingMode).label}
                  </Badge>
                ) : (
                  <Badge variant="outline">未配置</Badge>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">今日使用</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {currentUsage ? formatNumber(currentUsage.today.tokens) : '0'}
                </div>
                <div className="text-sm text-gray-500">Tokens</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">今日成本</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  ${currentUsage ? currentUsage.today.cost.toFixed(2) : '0.00'}
                </div>
                <div className="text-sm text-gray-500">美元</div>
              </CardContent>
            </Card>
          </div>

          {/* 企业信息与权限状态 */}
          {group.enterpriseId && (
            <Card>
              <CardHeader>
                <CardTitle>企业信息与权限</CardTitle>
                <CardDescription>该拼车组归属的企业组织和当前用户权限级别</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">{group.enterpriseName || '未命名企业'}</div>
                      <div className="text-sm text-gray-500">企业ID: {group.enterpriseId}</div>
                    </div>
                    <Badge variant="outline">
                      {isEnterpriseMember ? '企业成员' : '访客'}
                    </Badge>
                  </div>

                  {/* 权限级别显示 */}
                  <div className="border-t pt-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-medium">权限级别</div>
                        <div className="text-xs text-gray-500">
                          拼车组角色: {currentGroupPermissions.roleInGroup}
                        </div>
                      </div>
                      <Badge 
                        variant={permissionLevel === 'enterprise_admin' ? 'default' : 'secondary'}
                        className={
                          permissionLevel === 'enterprise_admin' ? 'bg-purple-100 text-purple-800' :
                          permissionLevel === 'group_admin' ? 'bg-blue-100 text-blue-800' :
                          permissionLevel === 'member' ? 'bg-green-100 text-green-800' :
                          'bg-gray-100 text-gray-800'
                        }
                      >
                        {permissionLevel === 'enterprise_admin' ? '企业管理员' :
                         permissionLevel === 'group_admin' ? '拼车组管理员' :
                         permissionLevel === 'member' ? '成员' : '访客'}
                      </Badge>
                    </div>
                  </div>

                  {/* 权限详情 */}
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className={`flex items-center gap-1 ${currentGroupPermissions.canView ? 'text-green-600' : 'text-gray-400'}`}>
                      <span className="w-2 h-2 rounded-full bg-current"></span>
                      查看权限
                    </div>
                    <div className={`flex items-center gap-1 ${currentGroupPermissions.canEdit ? 'text-green-600' : 'text-gray-400'}`}>
                      <span className="w-2 h-2 rounded-full bg-current"></span>
                      编辑权限
                    </div>
                    <div className={`flex items-center gap-1 ${currentGroupPermissions.canManage ? 'text-green-600' : 'text-gray-400'}`}>
                      <span className="w-2 h-2 rounded-full bg-current"></span>
                      管理权限
                    </div>
                    <div className={`flex items-center gap-1 ${hasPermission('canViewAnalytics') ? 'text-green-600' : 'text-gray-400'}`}>
                      <span className="w-2 h-2 rounded-full bg-current"></span>
                      数据分析
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* 使用统计图表 */}
          <UsageChart 
            groupId={groupId} 
            timeRange="30d" 
            showServiceBreakdown={true}
          />
        </TabsContent>

        <TabsContent value="resources" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>AI资源配置</CardTitle>
              <CardDescription>
                配置拼车组的AI服务资源绑定模式和使用配额
              </CardDescription>
            </CardHeader>
            <CardContent>
              {group.resourceBinding ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-sm text-gray-600">绑定模式</div>
                      <Badge className={getBindingModeDisplay(group.resourceBinding.bindingMode).color}>
                        {getBindingModeDisplay(group.resourceBinding.bindingMode).label}
                      </Badge>
                    </div>
                    <div>
                      <div className="text-sm text-gray-600">优先级</div>
                      <div className="font-medium">{group.resourceBinding.priorityLevel}</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-600">日Token限制</div>
                      <div className="font-medium">{formatNumber(group.resourceBinding.dailyTokenLimit)}</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-600">月预算</div>
                      <div className="font-medium">
                        {group.resourceBinding.monthlyBudget ? 
                          `$${group.resourceBinding.monthlyBudget}` : '无限制'}
                      </div>
                    </div>
                  </div>
                  <GroupManagerGuard groupId={groupId}>
                    <div className="pt-4 border-t">
                      <Button 
                        className="bg-blue-500 text-white hover:bg-blue-600"
                        onClick={() => router.push(`/groups/${groupId}/resources`)}
                      >
                        配置资源绑定
                      </Button>
                    </div>
                  </GroupManagerGuard>
                </div>
              ) : (
                <div className="text-center py-8">
                  <div className="text-gray-500 mb-4">还未配置AI资源绑定</div>
                  <GroupManagerGuard groupId={groupId}>
                    <Button 
                      className="bg-blue-500 text-white hover:bg-blue-600"
                      onClick={() => router.push(`/groups/${groupId}/resources`)}
                    >
                      开始配置
                    </Button>
                  </GroupManagerGuard>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="members" className="space-y-6">
          <MemberManagement
            groupId={groupId}
            members={group.members}
            currentUserId={currentUser?.id}
            canManageMembers={canManageMembers()}
            onInviteClick={() => setActiveTab('invitations')}
          />
        </TabsContent>

        <TabsContent value="invitations" className="space-y-6">
          <InvitationManagement
            groupId={groupId}
            canManageMembers={canManageMembers()}
          />
        </TabsContent>

        <TabsContent value="api-keys" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                API密钥管理
                <GroupManagerGuard groupId={groupId}>
                  <Button 
                    size="sm"
                    className="bg-purple-500 text-white hover:bg-purple-600"
                    onClick={() => {
                      // TODO: 实现创建API密钥功能
                      toast.info('创建API密钥功能开发中...');
                    }}
                  >
                    <Key className="w-4 h-4 mr-2" />
                    创建密钥
                  </Button>
                </GroupManagerGuard>
              </CardTitle>
              <CardDescription>管理用于调用AI服务的API密钥</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {/* API密钥统计 */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-sm text-gray-600">活跃密钥</div>
                          <div className="text-2xl font-bold text-green-600">3</div>
                        </div>
                        <Key className="w-8 h-8 text-green-500" />
                      </div>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-sm text-gray-600">今日调用</div>
                          <div className="text-2xl font-bold text-blue-600">1,234</div>
                        </div>
                        <BarChart3 className="w-8 h-8 text-blue-500" />
                      </div>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-sm text-gray-600">今日费用</div>
                          <div className="text-2xl font-bold text-orange-600">$23.45</div>
                        </div>
                        <Database className="w-8 h-8 text-orange-500" />
                      </div>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-sm text-gray-600">成功率</div>
                          <div className="text-2xl font-bold text-purple-600">98.5%</div>
                        </div>
                        <CheckCircle className="w-8 h-8 text-purple-500" />
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* API密钥列表 */}
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">API密钥列表</h3>
                  
                  {/* 模拟API密钥数据 */}
                  {[
                    {
                      id: '1',
                      name: '生产环境密钥',
                      key: 'aicarpool_prod_1234567890abcdef',
                      status: 'active',
                      createdAt: '2024-01-10T10:00:00Z',
                      lastUsed: '2024-01-15T14:30:00Z',
                      calls: 15420,
                      cost: 234.56,
                      rateLimit: '1000/hour'
                    },
                    {
                      id: '2',
                      name: '开发测试密钥',
                      key: 'aicarpool_dev_abcdef1234567890',
                      status: 'active',
                      createdAt: '2024-01-12T15:00:00Z',
                      lastUsed: '2024-01-15T12:15:00Z',
                      calls: 3280,
                      cost: 45.12,
                      rateLimit: '500/hour'
                    },
                    {
                      id: '3',
                      name: '备用密钥',
                      key: 'aicarpool_backup_fedcba0987654321',
                      status: 'inactive',
                      createdAt: '2024-01-08T09:00:00Z',
                      lastUsed: '2024-01-14T08:45:00Z',
                      calls: 890,
                      cost: 12.34,
                      rateLimit: '200/hour'
                    }
                  ].map((apiKey) => (
                    <div key={apiKey.id} className="border rounded-lg p-4 space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
                            <Key className="w-5 h-5 text-purple-600" />
                          </div>
                          <div>
                            <div className="font-medium">{apiKey.name}</div>
                            <div className="text-sm text-gray-500">
                              创建时间: {new Date(apiKey.createdAt).toLocaleDateString()}
                            </div>
                            <div className="text-xs text-gray-400">
                              最后使用: {new Date(apiKey.lastUsed).toLocaleDateString()}
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-3">
                          <Badge 
                            variant={apiKey.status === 'active' ? 'default' : 'secondary'}
                            className={
                              apiKey.status === 'active' ? 'bg-green-100 text-green-800' :
                              'bg-gray-100 text-gray-800'
                            }
                          >
                            {apiKey.status === 'active' ? '活跃' : '停用'}
                          </Badge>

                          <GroupManagerGuard groupId={groupId}>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  // 复制API密钥到剪贴板
                                  navigator.clipboard.writeText(apiKey.key);
                                  toast.success('API密钥已复制到剪贴板');
                                }}
                              >
                                复制
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  // TODO: 实现重新生成密钥功能
                                  toast.info('重新生成密钥功能开发中...');
                                }}
                              >
                                重新生成
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className={apiKey.status === 'active' ? 'text-orange-600 hover:text-orange-700' : 'text-green-600 hover:text-green-700'}
                                onClick={() => {
                                  // TODO: 实现启用/停用密钥功能
                                  toast.info('切换密钥状态功能开发中...');
                                }}
                              >
                                {apiKey.status === 'active' ? '停用' : '启用'}
                              </Button>
                            </div>
                          </GroupManagerGuard>
                        </div>
                      </div>

                      {/* API密钥信息 */}
                      <div className="bg-gray-50 p-3 rounded text-sm font-mono">
                        <div className="flex items-center justify-between">
                          <span className="text-gray-600">
                            {apiKey.key.substring(0, 20)}...{apiKey.key.substring(apiKey.key.length - 8)}
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              navigator.clipboard.writeText(apiKey.key);
                              toast.success('API密钥已复制');
                            }}
                          >
                            <Key className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>

                      {/* 使用统计 */}
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <div className="text-gray-600">总调用次数</div>
                          <div className="font-medium">{apiKey.calls.toLocaleString()}</div>
                        </div>
                        <div>
                          <div className="text-gray-600">总费用</div>
                          <div className="font-medium">${apiKey.cost.toFixed(2)}</div>
                        </div>
                        <div>
                          <div className="text-gray-600">速率限制</div>
                          <div className="font-medium">{apiKey.rateLimit}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* 创建新密钥 */}
                <GroupManagerGuard groupId={groupId}>
                  <div className="border-t pt-6">
                    <h3 className="text-lg font-medium mb-4">创建新API密钥</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="text-sm font-medium">密钥名称</label>
                        <input
                          type="text"
                          placeholder="例如：生产环境密钥"
                          className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium">速率限制</label>
                        <select className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500">
                          <option value="200">200 请求/小时</option>
                          <option value="500">500 请求/小时</option>
                          <option value="1000">1000 请求/小时</option>
                          <option value="2000">2000 请求/小时</option>
                        </select>
                      </div>
                      <div className="flex items-end">
                        <Button 
                          className="w-full bg-purple-500 text-white hover:bg-purple-600"
                          onClick={() => {
                            // TODO: 实现创建密钥功能
                            toast.info('创建API密钥功能开发中...');
                          }}
                        >
                          创建密钥
                        </Button>
                      </div>
                    </div>
                  </div>
                </GroupManagerGuard>

                {/* 使用说明 */}
                <div className="bg-blue-50 p-4 rounded-lg">
                  <h4 className="font-medium text-blue-900 mb-2">API使用说明</h4>
                  <div className="text-sm text-blue-800 space-y-1">
                    <div>• API基础URL: https://api.aicarpool.com/v1</div>
                    <div>• 在请求头中添加: Authorization: Bearer YOUR_API_KEY</div>
                    <div>• 支持的端点: /chat/completions, /embeddings, /models</div>
                    <div>• 请求格式与OpenAI兼容，可直接替换现有代码</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>拼车组设置</CardTitle>
              <CardDescription>管理拼车组的基本信息和配置</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-gray-500">
                设置功能正在开发中...
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
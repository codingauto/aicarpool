'use client';

/**
 * 企业AI账号详情页面
 * 
 * 功能：
 * - 显示AI账号的详细信息
 * - 查看账号使用统计
 * - 查看绑定的拼车组
 * - 查看健康状态历史
 */

import React, { useState, useEffect, use } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  ArrowLeft,
  ChevronLeft,
  Building2,
  Server,
  Activity,
  DollarSign,
  Clock,
  Users,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Edit,
  Trash2,
  RefreshCw,
  BarChart3,
  Settings,
  Zap
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEnterpriseContext } from '@/contexts/enterprise-context';
import { toast } from 'sonner';

interface AiAccount {
  id: string;
  name: string;
  description: string;
  platform: string;
  accountType: string;
  isEnabled: boolean;
  status: string;
  currentLoad: number;
  supportedModels: string[];
  currentModel: string;
  dailyLimit: number;
  totalRequests: number;
  totalTokens: number;
  totalCost: number;
  lastUsedAt: string | null;
  recentUsage: {
    tokens: number;
    cost: number;
  };
  healthStatus: {
    isHealthy: boolean;
    responseTime: number;
    checkedAt: string;
  } | null;
  boundGroups: {
    id: string;
    name: string;
    priority: number;
    isActive: boolean;
  }[];
  createdAt: string;
  updatedAt: string;
  credentials: {
    apiEndpoint?: string;
    lastChecked?: string;
  };
  config: {
    dailyLimit: number;
    costPerToken: number;
    proxyEnabled: boolean;
  };
}

export default function AiAccountDetailPage({ 
  params 
}: { 
  params: Promise<{ enterpriseId: string; accountId: string }> 
}) {
  const { enterpriseId, accountId } = use(params);
  const router = useRouter();
  const { currentEnterprise, hasRole } = useEnterpriseContext();
  
  const [account, setAccount] = useState<AiAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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
          const accountData = result.data.account;
          // 格式化账号数据以匹配前端接口
          const formattedAccount = {
            ...accountData,
            recentUsage: {
              tokens: accountData.usageStats?.last24h?.tokens || 0,
              cost: accountData.usageStats?.last24h?.cost || 0
            },
            healthStatus: accountData.healthHistory?.[0] ? {
              isHealthy: accountData.healthHistory[0].isHealthy,
              responseTime: accountData.healthHistory[0].responseTime,
              checkedAt: accountData.healthHistory[0].checkedAt
            } : null,
            credentials: {
              apiEndpoint: accountData.apiEndpoint
            },
            config: {
              dailyLimit: accountData.dailyLimit,
              costPerToken: accountData.costPerToken,
              proxyEnabled: !!accountData.proxyConfig
            }
          };
          setAccount(formattedAccount);
          setError('');
        } else {
          setError(result.message || '获取账号详情失败');
        }
      } else {
        setError('获取账号详情失败');
      }
    } catch (error) {
      console.error('获取账号详情失败:', error);
      setError('获取账号详情失败');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = () => {
    router.push(`/enterprise/${enterpriseId}/ai-accounts/${accountId}/edit`);
  };

  const handleDelete = async () => {
    if (!confirm('确定要删除这个AI账号吗？此操作不可恢复。')) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/enterprises/${enterpriseId}/ai-accounts/${accountId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          toast.success('账号删除成功');
          router.push(`/enterprise/${enterpriseId}/ai-resources?tab=accounts`);
        } else {
          toast.error(result.message || '删除失败');
        }
      } else {
        toast.error('删除失败');
      }
    } catch (error) {
      console.error('删除账号失败:', error);
      toast.error('删除失败');
    }
  };

  const getServiceTypeDisplayName = (platform: string) => {
    const displayNames: Record<string, string> = {
      'claude': 'Claude',
      'gemini': 'Gemini',
      'openai': 'OpenAI',
      'gpt': 'OpenAI',
      'qwen': '通义千问',
      'zhipu': '智谱AI',
      'kimi': 'Kimi'
    };
    return displayNames[serviceType] || serviceType;
  };

  const getStatusBadge = (status: string, isEnabled: boolean) => {
    if (!isEnabled) {
      return <Badge variant="secondary">已禁用</Badge>;
    }
    
    switch (status) {
      case 'active':
        return <Badge className="bg-green-100 text-green-800">活跃</Badge>;
      case 'inactive':
        return <Badge variant="secondary">闲置</Badge>;
      case 'error':
        return <Badge variant="destructive">错误</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getHealthIcon = (healthStatus: AiAccount['healthStatus']) => {
    if (!healthStatus) {
      return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
    }
    
    return healthStatus.isHealthy 
      ? <CheckCircle className="w-5 h-5 text-green-500" />
      : <XCircle className="w-5 h-5 text-red-500" />;
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-48 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center py-12">
          <AlertTriangle className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">加载失败</h3>
          <p className="text-gray-600 mb-4">{error}</p>
          <div className="space-x-4">
            <Button onClick={fetchAccountDetail}>重试</Button>
            <Button 
              variant="outline" 
              onClick={() => router.push(`/enterprise/${enterpriseId}/ai-resources?tab=accounts`)}
            >
              返回账号列表
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!account) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center py-12">
          <p className="text-gray-500">账号不存在</p>
          <Button 
            onClick={() => router.push(`/enterprise/${enterpriseId}/ai-resources?tab=accounts`)}
            className="mt-4"
          >
            返回账号列表
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-6xl mx-auto">
        {/* 面包屑和标题 */}
        <div className="flex items-center gap-4 mb-6">
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => router.push(`/enterprise/${enterpriseId}/ai-resources?tab=accounts`)}
          >
            <ChevronLeft className="w-4 h-4 mr-2" />
            返回账号列表
          </Button>
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Building2 className="w-4 h-4" />
            <span>{currentEnterprise?.name || '未知企业'}</span>
            <span>/</span>
            <span>AI账号管理</span>
            <span>/</span>
            <span>{account.name}</span>
          </div>
        </div>

        <div className="space-y-6">
          {/* 账号基本信息和操作 */}
          <div className="flex items-start justify-between">
            <div className="flex items-start space-x-4">
              <div className="flex items-center justify-center w-12 h-12 bg-blue-100 rounded-lg">
                <Server className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <h1 className="text-3xl font-bold text-gray-900">{account.name}</h1>
                  {getHealthIcon(account.healthStatus)}
                </div>
                <p className="text-gray-600 mb-3">{account.description}</p>
                <div className="flex items-center gap-3">
                  <Badge variant="outline">
                    {getServiceTypeDisplayName(account.platform)}
                  </Badge>
                  {getStatusBadge(account.status, account.isEnabled)}
                  <Badge variant="secondary">
                    {account.accountType === 'dedicated' ? '专用' : '共享'}
                  </Badge>
                </div>
              </div>
            </div>
            
            {(hasRole('owner') || hasRole('admin')) && (
              <div className="flex gap-2">
                <Button onClick={handleEdit}>
                  <Edit className="w-4 h-4 mr-2" />
                  编辑
                </Button>
                <Button variant="destructive" onClick={handleDelete}>
                  <Trash2 className="w-4 h-4 mr-2" />
                  删除
                </Button>
              </div>
            )}
          </div>

          {/* 关键指标卡片 */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">当前负载</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{account.currentLoad}%</div>
                <Progress value={account.currentLoad} className="mt-2" />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">总请求数</CardTitle>
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{(account.totalRequests || 0).toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">
                  今日: {(account.recentUsage?.tokens || 0).toLocaleString()} tokens
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">总成本</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">${(account.totalCost || 0).toFixed(2)}</div>
                <p className="text-xs text-muted-foreground">
                  今日: ${(account.recentUsage?.cost || 0).toFixed(2)}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">响应时间</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {account.healthStatus?.responseTime || 0}ms
                </div>
                <p className="text-xs text-muted-foreground">
                  {account.healthStatus?.isHealthy ? '健康' : '异常'}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* 详细信息Tab */}
          <Tabs defaultValue="overview" className="space-y-6">
            <TabsList>
              <TabsTrigger value="overview">账号概览</TabsTrigger>
              <TabsTrigger value="groups">绑定拼车组</TabsTrigger>
              <TabsTrigger value="config">配置信息</TabsTrigger>
              <TabsTrigger value="usage">使用统计</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>基本信息</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium text-gray-500">服务类型</label>
                        <p className="mt-1">{getServiceTypeDisplayName(account.platform)}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-500">账号类型</label>
                        <p className="mt-1">{account.accountType === 'dedicated' ? '专用账号' : '共享账号'}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-500">当前模型</label>
                        <p className="mt-1">{account.currentModel}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-500">每日限制</label>
                        <p className="mt-1">{(account.dailyLimit || 0).toLocaleString()} 请求</p>
                      </div>
                    </div>
                    
                    <div>
                      <label className="text-sm font-medium text-gray-500">支持的模型</label>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {(account.supportedModels || []).map((model) => (
                          <Badge key={model} variant="outline">{model}</Badge>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="text-sm font-medium text-gray-500">最后使用时间</label>
                      <p className="mt-1">
                        {account.lastUsedAt 
                          ? new Date(account.lastUsedAt).toLocaleString('zh-CN')
                          : '从未使用'
                        }
                      </p>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>健康状态</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {account.healthStatus ? (
                      <>
                        <div className="flex items-center gap-3">
                          {getHealthIcon(account.healthStatus)}
                          <span className="font-medium">
                            {account.healthStatus.isHealthy ? '健康' : '异常'}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="text-sm font-medium text-gray-500">响应时间</label>
                            <p className="mt-1">{account.healthStatus.responseTime}ms</p>
                          </div>
                          <div>
                            <label className="text-sm font-medium text-gray-500">检查时间</label>
                            <p className="mt-1">
                              {new Date(account.healthStatus.checkedAt).toLocaleString('zh-CN')}
                            </p>
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="text-center py-4">
                        <AlertTriangle className="w-8 h-8 text-yellow-500 mx-auto mb-2" />
                        <p className="text-gray-600">暂无健康状态数据</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="groups" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>绑定的拼车组 ({(account.boundGroups || []).length})</CardTitle>
                </CardHeader>
                <CardContent>
                  {(account.boundGroups || []).length > 0 ? (
                    <div className="space-y-4">
                      {(account.boundGroups || []).map((group) => (
                        <div key={group.id} className="flex items-center justify-between p-4 border rounded-lg">
                          <div className="flex items-center space-x-4">
                            <Users className="w-5 h-5 text-blue-500" />
                            <div>
                              <h4 className="font-medium">{group.name}</h4>
                              <p className="text-sm text-gray-500">优先级: {group.priority}</p>
                            </div>
                          </div>
                          <Badge variant={group.isActive ? "default" : "secondary"}>
                            {group.isActive ? '活跃' : '暂停'}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-500">暂未绑定任何拼车组</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="config" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>配置信息</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="text-sm font-medium text-gray-500">API端点</label>
                      <p className="mt-1 font-mono text-sm bg-gray-100 p-2 rounded">
                        {account.credentials?.apiEndpoint || '使用默认端点'}
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">每日请求限制</label>
                      <p className="mt-1">{(account.config?.dailyLimit || 0).toLocaleString()} 次</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">每Token成本</label>
                      <p className="mt-1">${(account.config?.costPerToken || 0).toFixed(6)}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">代理设置</label>
                      <p className="mt-1">{account.config?.proxyEnabled ? '已启用' : '已禁用'}</p>
                    </div>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium text-gray-500">创建时间</label>
                    <p className="mt-1">{new Date(account.createdAt).toLocaleString('zh-CN')}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">更新时间</label>
                    <p className="mt-1">{new Date(account.updatedAt).toLocaleString('zh-CN')}</p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="usage" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>使用统计</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-12 text-gray-500">
                    <BarChart3 className="h-12 w-12 mx-auto mb-4" />
                    <p>使用统计图表功能开发中...</p>
                    <p className="text-sm mt-2">将显示详细的使用趋势和统计数据</p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
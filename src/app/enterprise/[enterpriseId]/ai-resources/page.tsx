'use client';

/**
 * 企业AI资源管理页面
 * 
 * 功能：
 * - 显示企业AI资源概览
 * - 账号状态分布
 * - 使用统计和成本分析
 * - 拼车组使用排行
 * - 趋势分析
 */

import React, { useState, useEffect, use } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Activity, 
  DollarSign, 
  Server, 
  Users, 
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  BarChart3,
  Plus,
  Settings,
  Zap,
  ChevronLeft,
  Building2,
  Search,
  Filter,
  RefreshCw,
  Eye,
  Edit

} from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEnterpriseContext } from '@/contexts/enterprise-context';
import { toast } from 'sonner';


interface AiResourceDashboard {
  totalAccounts: number;
  activeAccounts: number;
  totalGroups: number;
  dailyRequests: number;
  dailyCost: number;
  averageResponseTime: number;
  accountsByService: {
    platform: string;
    count: number;
    healthyCount: number;
    avgLoad: number;
  }[];
  topGroupsByUsage: {
    groupId: string;
    groupName: string;
    dailyRequests: number;
    dailyCost: number;
  }[];
  recentAlerts: {
    id: string;
    type: 'error' | 'warning' | 'info';
    message: string;
    timestamp: string;
    accountId?: string;
  }[];
}

interface AiAccount {
  id: string;
  name: string;
  description: string;
  platform: string; // 改为platform
  authType: string;
  accountType: string;
  priority: number;
  isEnabled: boolean;
  status: string;
  validationStatus: string;
  currentLoad: number;
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
  // 平台特定配置
  geminiProjectId?: string;
  claudeConsoleApiUrl?: string;
  proxyEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}





export default function EnterpriseAiResourcesPage({ params }: { params: Promise<{ enterpriseId: string }> }) {
  const { enterpriseId } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { currentEnterprise, hasRole } = useEnterpriseContext();
  
  // 从URL参数获取默认Tab
  const defaultTab = searchParams?.get('tab') || 'overview';
  const [dashboard, setDashboard] = useState<AiResourceDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedTimeRange, setSelectedTimeRange] = useState('24h');
  
  // 账号管理相关状态
  const [accounts, setAccounts] = useState<AiAccount[]>([]);
  const [accountsLoading, setAccountsLoading] = useState(false);
  const [accountsError, setAccountsError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedService, setSelectedService] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);





  useEffect(() => {
    fetchAiResourceDashboard();
  }, [enterpriseId, selectedTimeRange]);

  useEffect(() => {
    fetchAccounts();
  }, [enterpriseId, currentPage, selectedService, selectedStatus, searchTerm]);





  const fetchAiResourceDashboard = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/enterprises/${enterpriseId}/ai-resources/dashboard`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          setDashboard(result.data);
          setError('');
        } else {
          setError(result.message || '获取AI资源信息失败');
        }
      } else {
        setError('获取AI资源信息失败');
      }
    } catch (error) {
      console.error('获取AI资源信息失败:', error);
      setError('获取AI资源信息失败');
    } finally {
      setLoading(false);
    }
  };

  const fetchAccounts = async () => {
    try {
      setAccountsLoading(true);
      const token = localStorage.getItem('token');
      const params = new URLSearchParams({
        page: currentPage.toString(),
        pageSize: '20',
        ...(selectedService && { platform: selectedService }), // 改为platform
        ...(selectedStatus && { status: selectedStatus }),
        ...(searchTerm && { search: searchTerm })
      });

      const response = await fetch(`/api/enterprises/${enterpriseId}/ai-accounts?${params}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          setAccounts(result.data.accounts || []);
          setTotalCount(result.data.totalCount || 0);
          setAccountsError('');
        } else {
          setAccountsError(result.message || '获取AI账号列表失败');
        }
      } else {
        setAccountsError('获取AI账号列表失败');
      }
    } catch (error) {
      console.error('获取AI账号列表失败:', error);
      setAccountsError('获取AI账号列表失败');
    } finally {
      setAccountsLoading(false);
    }
  };



  const handleCreateAccount = () => {
    router.push(`/enterprise/${enterpriseId}/ai-accounts/create`);
  };

  const handleEditAccount = (accountId: string) => {
    router.push(`/enterprise/${enterpriseId}/ai-accounts/${accountId}/edit`);
  };

  const handleViewAccount = (accountId: string) => {
    router.push(`/enterprise/${enterpriseId}/ai-accounts/${accountId}`);
  };





  const getPlatformDisplayName = (platform: string) => {
    const displayNames: Record<string, string> = {
      'claude': 'Claude',
      'gemini': 'Gemini',
      'claude_console': 'Claude Console',
      'openai': 'OpenAI',
      'gpt': 'OpenAI',
      'qwen': '通义千问',
      'zhipu': '智谱AI',
      'kimi': 'Kimi'
    };
    return displayNames[platform] || platform;
  };

  const getAuthTypeDisplayName = (authType: string) => {
    const displayNames: Record<string, string> = {
      'oauth': 'OAuth',
      'manual': '手动Token',
      'api_key': 'API密钥'
    };
    return displayNames[authType] || authType;
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
      return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
    }
    
    return healthStatus.isHealthy 
      ? <CheckCircle className="w-4 h-4 text-green-500" />
      : <XCircle className="w-4 h-4 text-red-500" />;
  };

  const getServiceTypeColor = (platform: string) => {
    const colors: Record<string, string> = {
      'claude': 'bg-blue-500',
      'gemini': 'bg-green-500',
      'openai': 'bg-purple-500',
      'gpt': 'bg-purple-500',
      'qwen': 'bg-orange-500',
      'zhipu': 'bg-indigo-500',
      'kimi': 'bg-pink-500'
    };
    return colors[platform] || 'bg-gray-500';
  };

  const getHealthStatusIcon = (healthyCount: number, totalCount: number) => {
    const healthRatio = healthyCount / totalCount;
    if (healthRatio >= 0.8) {
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    } else if (healthRatio >= 0.5) {
      return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
    } else {
      return <XCircle className="h-4 w-4 text-red-500" />;
    }
  };

  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'error':
        return <XCircle className="w-4 h-4 text-red-500" />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      default:
        return <CheckCircle className="w-4 h-4 text-blue-500" />;
    }
  };





  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-32 bg-gray-200 rounded"></div>
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
          <Button onClick={fetchAiResourceDashboard}>重试</Button>
        </div>
      </div>
    );
  }

  if (!dashboard) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center py-12">
          <p className="text-gray-500">无法加载仪表板数据</p>
          <Button onClick={fetchAiResourceDashboard} className="mt-4">
            重试
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
            onClick={() => router.push(`/enterprise/${enterpriseId}/dashboard`)}
          >
            <ChevronLeft className="w-4 h-4 mr-2" />
            返回企业控制面板
          </Button>
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Building2 className="w-4 h-4" />
            <span>{currentEnterprise?.name || '未知企业'}</span>
            <span>/</span>
            <span>AI资源管理</span>
          </div>
        </div>

        <div className="space-y-6">
        {/* 页面标题 */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">AI资源管理</h1>
            <p className="text-gray-600 mt-1">管理企业AI资源和监控使用情况</p>
          </div>
        </div>

        {/* 主要内容区域 - 使用Tab导航 */}
        <Tabs defaultValue={defaultTab} className="space-y-6">
          <TabsList>
            <TabsTrigger value="overview">资源概览</TabsTrigger>
            <TabsTrigger value="accounts">账号管理</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            {dashboard ? (
              <>
                {/* 关键指标卡片 */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">总账号数</CardTitle>
                      <Server className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{dashboard.totalAccounts}</div>
                      <p className="text-xs text-muted-foreground">
                        活跃: {dashboard.activeAccounts}
                      </p>
                    </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">今日请求</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{dashboard.dailyRequests.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">
                分布在 {dashboard.totalGroups} 个拼车组
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">今日成本</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${dashboard.dailyCost.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground">
                平均每请求 ${dashboard.dailyRequests > 0 ? (dashboard.dailyCost / dashboard.dailyRequests).toFixed(4) : '0.0000'}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">平均响应时间</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{dashboard.averageResponseTime}ms</div>
              <p className="text-xs text-muted-foreground">
                {dashboard.averageResponseTime < 2000 ? '性能良好' : '需要优化'}
              </p>
            </CardContent>
          </Card>
        </div>

            {/* 详细信息Tab */}
            <Tabs defaultValue="services" className="space-y-6">
              <TabsList>
                <TabsTrigger value="services">按服务分布</TabsTrigger>
                <TabsTrigger value="usage">使用排行</TabsTrigger>
                <TabsTrigger value="alerts">告警信息</TabsTrigger>
                <TabsTrigger value="trends">趋势分析</TabsTrigger>
              </TabsList>

              <TabsContent value="services" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>AI服务分布</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {dashboard.accountsByService.map((service) => (
                        <div key={service.platform} className="space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                              <div className={`w-3 h-3 rounded-full ${getServiceTypeColor(service.platform)}`}></div>
                              <span className="font-medium">{getPlatformDisplayName(service.platform)}</span>
                          {getHealthStatusIcon(service.healthyCount, service.count)}
                        </div>
                        <Badge variant="secondary">
                          {service.count} 账号
                        </Badge>
                      </div>
                      
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span>健康账号</span>
                          <span>{service.healthyCount}/{service.count}</span>
                        </div>
                        <Progress 
                          value={(service.healthyCount / service.count) * 100} 
                          className="h-2"
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span>平均负载</span>
                          <span>{service.avgLoad}%</span>
                        </div>
                        <Progress 
                          value={service.avgLoad} 
                          className="h-2"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="usage" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>拼车组使用排行</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {dashboard.topGroupsByUsage.map((group, index) => (
                    <div key={group.groupId} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center space-x-4">
                        <div className="flex items-center justify-center w-8 h-8 bg-primary text-primary-foreground rounded-full text-sm font-bold">
                          {index + 1}
                        </div>
                        <div>
                          <div className="font-medium">{group.groupName}</div>
                          <div className="text-sm text-gray-500">
                            {group.dailyRequests.toLocaleString()} 次请求
                          </div>
                        </div>
                      </div>
                      
                      <div className="text-right">
                        <div className="font-medium">${group.dailyCost.toFixed(2)}</div>
                        <div className="text-sm text-gray-500">今日成本</div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="alerts" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>告警信息</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {dashboard.recentAlerts.length > 0 ? (
                    dashboard.recentAlerts.map((alert) => (
                      <div key={alert.id} className="flex items-start space-x-3 p-4 border rounded-lg">
                        {getAlertIcon(alert.type)}
                        <div className="flex-1">
                          <p className="text-sm text-gray-900">{alert.message}</p>
                          <p className="text-xs text-gray-500 mt-1">
                            {new Date(alert.timestamp).toLocaleString('zh-CN')}
                          </p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8">
                      <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
                      <p className="text-gray-600">暂无告警信息</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="trends" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>趋势分析</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-12 text-gray-500">
                  <BarChart3 className="h-12 w-12 mx-auto mb-4" />
                  <p>趋势图表功能开发中...</p>
                  <p className="text-sm mt-2">将显示使用量、成本和性能趋势</p>
                </div>
              </CardContent>
            </Card>
              </TabsContent>
            </Tabs>
              </>
            ) : (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
                <p className="text-gray-600 mt-4">加载资源概览中...</p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="accounts" className="space-y-6">
            {/* 账号管理标题和操作 */}
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-semibold">AI账号管理</h3>
                <p className="text-gray-600 mt-1">管理企业的AI服务账号和配置</p>
              </div>
              
              {(hasRole('owner') || hasRole('admin')) && (
                <Button onClick={handleCreateAccount}>
                  <Plus className="h-4 w-4 mr-2" />
                  添加账号
                </Button>
              )}
            </div>

            {/* 搜索和筛选 */}
            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="搜索账号名称..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              
              <div className="flex gap-2">
                <select
                  value={selectedService}
                  onChange={(e) => setSelectedService(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-md"
                >
                  <option value="">所有服务</option>
                  <option value="claude">Claude</option>
                  <option value="openai">OpenAI</option>
                  <option value="gemini">Gemini</option>
                  <option value="qwen">通义千问</option>
                  <option value="zhipu">智谱AI</option>
                  <option value="kimi">Kimi</option>
                </select>
                
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-md"
                >
                  <option value="">所有状态</option>
                  <option value="active">活跃</option>
                  <option value="inactive">闲置</option>
                  <option value="error">错误</option>
                </select>

                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={fetchAccounts}
                  disabled={accountsLoading}
                >
                  <RefreshCw className={`w-4 h-4 ${accountsLoading ? 'animate-spin' : ''}`} />
                </Button>
              </div>
            </div>

            {/* 账号列表 - 表格格式 */}
            {accountsError ? (
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center">
                    <AlertTriangle className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">加载失败</h3>
                    <p className="text-gray-600 mb-4">{accountsError}</p>
                    <Button onClick={fetchAccounts}>重试</Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle>AI账号列表 ({totalCount})</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {accountsLoading ? (
                    <div className="p-6">
                      <div className="space-y-4">
                        {[...Array(3)].map((_, i) => (
                          <div key={i} className="animate-pulse">
                            <div className="flex items-center justify-between p-4 border rounded-lg">
                              <div className="flex items-center space-x-4">
                                <div className="w-4 h-4 bg-gray-200 rounded"></div>
                                <div className="space-y-2">
                                  <div className="h-4 bg-gray-200 rounded w-32"></div>
                                  <div className="h-3 bg-gray-200 rounded w-48"></div>
                                </div>
                              </div>
                              <div className="flex space-x-2">
                                <div className="h-6 bg-gray-200 rounded w-16"></div>
                                <div className="h-6 bg-gray-200 rounded w-12"></div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-gray-50 border-b">
                          <tr>
                            <th className="text-left py-3 px-4 font-medium text-gray-900">名称</th>
                            <th className="text-left py-3 px-4 font-medium text-gray-900">平台/类型</th>
                            <th className="text-left py-3 px-4 font-medium text-gray-900">状态</th>
                            <th className="text-left py-3 px-4 font-medium text-gray-900">优先级</th>
                            <th className="text-left py-3 px-4 font-medium text-gray-900">代理</th>
                            <th className="text-left py-3 px-4 font-medium text-gray-900">今日使用</th>
                            <th className="text-left py-3 px-4 font-medium text-gray-900">合适端口</th>
                            <th className="text-left py-3 px-4 font-medium text-gray-900">最后使用</th>
                            <th className="text-left py-3 px-4 font-medium text-gray-900">操作</th>
                          </tr>
                        </thead>
                        <tbody>
                          {accounts.map((account) => (
                            <tr key={account.id} className="border-b hover:bg-gray-50">
                              {/* 名称列 */}
                              <td className="py-3 px-4">
                                <div className="flex items-center space-x-2">
                                  <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center text-white text-xs font-medium">
                                    {account.name.charAt(0).toUpperCase()}
                                  </div>
                                  <div>
                                    <div className="font-medium text-gray-900">{account.name}</div>
                                    <div className="text-xs text-gray-500">{account.id.substring(0, 8)}...</div>
                                  </div>
                                </div>
                              </td>
                              
                              {/* 平台/类型列 */}
                              <td className="py-3 px-4">
                                <div className="flex items-center space-x-1">
                                  <Badge variant="outline" className="text-xs">
                                    {getPlatformDisplayName(account.platform)}
                                  </Badge>
                                  <Badge variant="secondary" className="text-xs">
                                    {getAuthTypeDisplayName(account.authType)}
                                  </Badge>
                                </div>
                              </td>
                              
                              {/* 状态列 */}
                              <td className="py-3 px-4">
                                {getStatusBadge(account.status, account.isEnabled)}
                              </td>
                              
                              {/* 优先级列 */}
                              <td className="py-3 px-4">
                                <span className="text-sm text-gray-900">
                                  {account.priority ? account.priority : 'N/A'}
                                </span>
                              </td>
                              
                              {/* 代理列 */}
                              <td className="py-3 px-4">
                                <span className="text-sm text-gray-600">
                                  {account.proxyEnabled ? '已启用' : '无代理'}
                                </span>
                              </td>
                              
                              {/* 今日使用列 */}
                              <td className="py-3 px-4">
                                <div className="text-sm">
                                  <div className="text-gray-900">
                                    ${account.recentUsage.cost.toFixed(2)}
                                  </div>
                                  <div className="text-gray-500">
                                    {account.recentUsage.tokens.toLocaleString()} tokens
                                  </div>
                                </div>
                              </td>
                              
                              {/* 合适端口列 */}
                              <td className="py-3 px-4">
                                <span className="text-sm text-gray-600">N/A</span>
                              </td>
                              
                              {/* 最后使用列 */}
                              <td className="py-3 px-4">
                                <span className="text-sm text-gray-600">
                                  {account.lastUsedAt 
                                    ? new Date(account.lastUsedAt).toLocaleDateString('zh-CN')
                                    : '从未使用'
                                  }
                                </span>
                              </td>
                              
                              {/* 操作列 */}
                              <td className="py-3 px-4">
                                <div className="flex items-center space-x-1">
                                  {/* 启用/禁用按钮 */}
                                  <Button
                                    variant={account.isEnabled ? "default" : "secondary"}
                                    size="sm"
                                    className="h-8 px-3 text-xs"
                                  >
                                    {account.isEnabled ? '启用' : '禁用'}
                                  </Button>
                                  
                                  {/* 编辑按钮 */}
                                  {(hasRole('owner') || hasRole('admin')) && (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => handleEditAccount(account.id)}
                                      className="h-8 px-3 text-xs"
                                    >
                                      编辑
                                    </Button>
                                  )}
                                  
                                  {/* 删除按钮 */}
                                  {(hasRole('owner') || hasRole('admin')) && (
                                    <Button
                                      variant="destructive"
                                      size="sm"
                                      className="h-8 px-3 text-xs"
                                    >
                                      删除
                                    </Button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))}
                          
                          {accounts.length === 0 && !accountsLoading && (
                            <tr>
                              <td colSpan={9} className="text-center py-12">
                                <Server className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                                <p className="text-gray-500 mb-4">暂无AI账号</p>
                                {(hasRole('owner') || hasRole('admin')) && (
                                  <Button onClick={handleCreateAccount}>
                                    <Plus className="h-4 w-4 mr-2" />
                                    添加第一个账号
                                  </Button>
                                )}
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>


        </Tabs>
        </div>
      </div>
    </div>
  );
}
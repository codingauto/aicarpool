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

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
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
  Building2
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEnterpriseContext } from '@/contexts/enterprise-context';

interface AiResourceDashboard {
  totalAccounts: number;
  activeAccounts: number;
  totalGroups: number;
  dailyRequests: number;
  dailyCost: number;
  averageResponseTime: number;
  accountsByService: {
    serviceType: string;
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

export default function EnterpriseAiResourcesPage({ params }: { params: Promise<{ enterpriseId: string }> }) {
  const { enterpriseId } = React.use(params);
  const router = useRouter();
  const { currentEnterprise, hasRole } = useEnterpriseContext();
  const [dashboard, setDashboard] = useState<AiResourceDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedTimeRange, setSelectedTimeRange] = useState('24h');

  useEffect(() => {
    fetchAiResourceDashboard();
  }, [enterpriseId, selectedTimeRange]);

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

  const getServiceTypeDisplayName = (serviceType: string) => {
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

  const getServiceTypeColor = (serviceType: string) => {
    const colors: Record<string, string> = {
      'claude': 'bg-blue-500',
      'gemini': 'bg-green-500',
      'openai': 'bg-purple-500',
      'gpt': 'bg-purple-500',
      'qwen': 'bg-orange-500',
      'zhipu': 'bg-indigo-500',
      'kimi': 'bg-pink-500'
    };
    return colors[serviceType] || 'bg-gray-500';
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
        {/* 页面标题和操作 */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">AI资源管理</h1>
            <p className="text-gray-600 mt-1">管理企业AI资源和监控使用情况</p>
          </div>
          
          {hasRole('owner') || hasRole('admin') ? (
            <div className="flex gap-3">
              <Button 
                variant="outline" 
                onClick={() => router.push(`/enterprise/${enterpriseId}/ai-accounts`)}
              >
                <Settings className="h-4 w-4 mr-2" />
                管理账号
              </Button>
              <Button onClick={() => router.push(`/enterprise/${enterpriseId}/ai-accounts/create`)}>
                <Plus className="h-4 w-4 mr-2" />
                添加账号
              </Button>
            </div>
          ) : null}
        </div>

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
                    <div key={service.serviceType} className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <div className={`w-3 h-3 rounded-full ${getServiceTypeColor(service.serviceType)}`}></div>
                          <span className="font-medium">{getServiceTypeDisplayName(service.serviceType)}</span>
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
        </div>
      </div>
    </div>
  );
}
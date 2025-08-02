'use client';

/**
 * 企业AI资源总览页面
 * 
 * 功能：
 * - 显示企业AI资源概览
 * - 账号状态分布
 * - 使用统计和成本分析
 * - 拼车组使用排行
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
  Settings
} from 'lucide-react';
import { useRouter } from 'next/navigation';

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
    dailyCost: number;
    requestCount: number;
  }[];
}

export default function AiResourcesPage() {
  const router = useRouter();
  const [dashboardData, setDashboardData] = useState<AiResourceDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedTimeRange, setSelectedTimeRange] = useState('24h');

  useEffect(() => {
    fetchDashboardData();
  }, [selectedTimeRange]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      
      // 模拟数据，实际应该调用API
      const mockData: AiResourceDashboard = {
        totalAccounts: 15,
        activeAccounts: 12,
        totalGroups: 8,
        dailyRequests: 1247,
        dailyCost: 45.67,
        averageResponseTime: 1234,
        accountsByService: [
          { serviceType: 'claude', count: 6, healthyCount: 5, avgLoad: 45 },
          { serviceType: 'gemini', count: 4, healthyCount: 4, avgLoad: 32 },
          { serviceType: 'openai', count: 3, healthyCount: 2, avgLoad: 67 },
          { serviceType: 'qwen', count: 2, healthyCount: 1, avgLoad: 78 }
        ],
        topGroupsByUsage: [
          { groupId: '1', groupName: '前端开发组', dailyCost: 15.23, requestCount: 342 },
          { groupId: '2', groupName: '后端开发组', dailyCost: 12.45, requestCount: 289 },
          { groupId: '3', groupName: '产品设计组', dailyCost: 8.76, requestCount: 234 },
          { groupId: '4', groupName: '测试组', dailyCost: 6.12, requestCount: 187 },
          { groupId: '5', groupName: '运维组', dailyCost: 3.11, requestCount: 95 }
        ]
      };
      
      setDashboardData(mockData);
    } catch (error) {
      console.error('获取仪表板数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const getServiceTypeDisplayName = (serviceType: string) => {
    const displayNames: Record<string, string> = {
      'claude': 'Claude',
      'gemini': 'Gemini',
      'openai': 'OpenAI',
      'qwen': '通义千问'
    };
    return displayNames[serviceType] || serviceType;
  };

  const getServiceTypeColor = (serviceType: string) => {
    const colors: Record<string, string> = {
      'claude': 'bg-blue-500',
      'gemini': 'bg-green-500',
      'openai': 'bg-purple-500',
      'qwen': 'bg-orange-500'
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

  if (loading) {
    return (
      <div className="container mx-auto p-6">
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

  if (!dashboardData) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center py-12">
          <p className="text-gray-500">无法加载仪表板数据</p>
          <Button onClick={fetchDashboardData} className="mt-4">
            重试
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* 页面标题和操作 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">AI资源总览</h1>
          <p className="text-gray-600 mt-1">管理企业AI资源和监控使用情况</p>
        </div>
        
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => router.push('/enterprise/ai-accounts')}>
            <Settings className="h-4 w-4 mr-2" />
            管理账号
          </Button>
          <Button onClick={() => router.push('/enterprise/ai-accounts/create')}>
            <Plus className="h-4 w-4 mr-2" />
            添加账号
          </Button>
        </div>
      </div>

      {/* 关键指标卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">总账号数</CardTitle>
            <Server className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboardData.totalAccounts}</div>
            <p className="text-xs text-muted-foreground">
              活跃: {dashboardData.activeAccounts}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">今日请求</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboardData.dailyRequests.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              分布在 {dashboardData.totalGroups} 个拼车组
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">今日成本</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${dashboardData.dailyCost.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">
              平均每请求 ${(dashboardData.dailyCost / dashboardData.dailyRequests).toFixed(4)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">平均响应时间</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboardData.averageResponseTime}ms</div>
            <p className="text-xs text-muted-foreground">
              {dashboardData.averageResponseTime < 2000 ? '性能良好' : '需要优化'}
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="services" className="space-y-6">
        <TabsList>
          <TabsTrigger value="services">按服务分布</TabsTrigger>
          <TabsTrigger value="usage">使用排行</TabsTrigger>
          <TabsTrigger value="trends">趋势分析</TabsTrigger>
        </TabsList>

        <TabsContent value="services" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>AI服务分布</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {dashboardData.accountsByService.map((service) => (
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
                {dashboardData.topGroupsByUsage.map((group, index) => (
                  <div key={group.groupId} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center space-x-4">
                      <div className="flex items-center justify-center w-8 h-8 bg-primary text-primary-foreground rounded-full text-sm font-bold">
                        {index + 1}
                      </div>
                      <div>
                        <div className="font-medium">{group.groupName}</div>
                        <div className="text-sm text-gray-500">
                          {group.requestCount} 次请求
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
  );
}
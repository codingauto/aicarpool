'use client';

/**
 * 企业专属数据分析页面
 * 
 * 功能：
 * - 使用统计分析
 * - 成本趋势分析
 * - 服务性能分析
 * - 用户行为分析
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  BarChart3,
  TrendingUp,
  TrendingDown,
  Activity,
  DollarSign,
  Clock,
  Users,
  Zap,
  Download,
  Filter,
  Calendar
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEnterpriseContext } from '@/contexts/enterprise-context';
import { EnterpriseLayout } from '@/components/layout/enterprise-navigation';

interface AnalyticsData {
  summary: {
    totalRequests: number;
    totalCost: number;
    avgResponseTime: number;
    activeUsers: number;
    requestsGrowth: number;
    costGrowth: number;
    performanceGrowth: number;
    usersGrowth: number;
  };
  usageTrends: {
    date: string;
    requests: number;
    cost: number;
    responseTime: number;
  }[];
  serviceBreakdown: {
    service: string;
    requests: number;
    cost: number;
    avgResponseTime: number;
    successRate: number;
  }[];
  topUsers: {
    userId: string;
    userName: string;
    requests: number;
    cost: number;
  }[];
  topGroups: {
    groupId: string;
    groupName: string;
    requests: number;
    cost: number;
    memberCount: number;
  }[];
}

export default function EnterpriseAnalyticsPage({ params }: { params: Promise<{ enterpriseId: string }> }) {
  const { enterpriseId } = React.use(params);
  const router = useRouter();
  const { currentEnterprise, hasRole } = useEnterpriseContext();
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [timeRange, setTimeRange] = useState('7d');

  useEffect(() => {
    fetchAnalytics();
  }, [enterpriseId, timeRange]);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/enterprises/${enterpriseId}/analytics?timeRange=${timeRange}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setAnalytics(data.data);
        } else {
          setError(data.message || '获取分析数据失败');
        }
      } else {
        setError('获取分析数据失败');
      }
    } catch (error) {
      console.error('获取分析数据失败:', error);
      setError('获取分析数据失败');
    } finally {
      setLoading(false);
    }
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    }
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
  };

  const getGrowthColor = (growth: number) => {
    if (growth > 0) return 'text-green-600';
    if (growth < 0) return 'text-red-600';
    return 'text-gray-600';
  };

  const getGrowthIcon = (growth: number) => {
    if (growth > 0) return <TrendingUp className="w-4 h-4" />;
    if (growth < 0) return <TrendingDown className="w-4 h-4" />;
    return <Activity className="w-4 h-4" />;
  };

  if (loading) {
    return (
      <EnterpriseLayout enterpriseId={enterpriseId}>
        <div className="p-6">
          <div className="flex items-center justify-center h-64">
            <div className="text-lg text-gray-600">加载分析数据...</div>
          </div>
        </div>
      </EnterpriseLayout>
    );
  }

  if (error || !analytics) {
    return (
      <EnterpriseLayout enterpriseId={enterpriseId}>
        <div className="p-6">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <BarChart3 className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">数据加载失败</h3>
                <p className="text-gray-600 mb-4">{error || '暂无分析数据'}</p>
                <Button onClick={fetchAnalytics}>重试</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </EnterpriseLayout>
    );
  }

  return (
    <EnterpriseLayout enterpriseId={enterpriseId}>
      <div className="p-6 space-y-6">
        {/* 页面标题和控制 */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <BarChart3 className="w-6 h-6 text-blue-600" />
              数据分析
            </h1>
            <p className="text-gray-600 mt-1">
              企业AI资源使用分析和性能报告
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Select value={timeRange} onValueChange={setTimeRange}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1d">最近1天</SelectItem>
                <SelectItem value="7d">最近7天</SelectItem>
                <SelectItem value="30d">最近30天</SelectItem>
                <SelectItem value="90d">最近90天</SelectItem>
              </SelectContent>
            </Select>
            {hasRole(['owner', 'admin']) && (
              <Button variant="outline">
                <Download className="w-4 h-4 mr-2" />
                导出报告
              </Button>
            )}
          </div>
        </div>

        {/* 核心指标概览 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">总请求数</p>
                  <p className="text-2xl font-bold text-gray-900">{formatNumber(analytics.summary.totalRequests)}</p>
                </div>
                <Activity className="w-8 h-8 text-blue-500" />
              </div>
              <div className={`mt-4 flex items-center text-sm ${getGrowthColor(analytics.summary.requestsGrowth)}`}>
                {getGrowthIcon(analytics.summary.requestsGrowth)}
                <span className="ml-1">{Math.abs(analytics.summary.requestsGrowth)}% 较上期</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">总成本</p>
                  <p className="text-2xl font-bold text-gray-900">${analytics.summary.totalCost.toFixed(2)}</p>
                </div>
                <DollarSign className="w-8 h-8 text-green-500" />
              </div>
              <div className={`mt-4 flex items-center text-sm ${getGrowthColor(analytics.summary.costGrowth)}`}>
                {getGrowthIcon(analytics.summary.costGrowth)}
                <span className="ml-1">{Math.abs(analytics.summary.costGrowth)}% 较上期</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">平均响应时间</p>
                  <p className="text-2xl font-bold text-gray-900">{analytics.summary.avgResponseTime}ms</p>
                </div>
                <Clock className="w-8 h-8 text-purple-500" />
              </div>
              <div className={`mt-4 flex items-center text-sm ${getGrowthColor(-analytics.summary.performanceGrowth)}`}>
                {getGrowthIcon(-analytics.summary.performanceGrowth)}
                <span className="ml-1">{Math.abs(analytics.summary.performanceGrowth)}% 较上期</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">活跃用户</p>
                  <p className="text-2xl font-bold text-gray-900">{analytics.summary.activeUsers}</p>
                </div>
                <Users className="w-8 h-8 text-orange-500" />
              </div>
              <div className={`mt-4 flex items-center text-sm ${getGrowthColor(analytics.summary.usersGrowth)}`}>
                {getGrowthIcon(analytics.summary.usersGrowth)}
                <span className="ml-1">{Math.abs(analytics.summary.usersGrowth)}% 较上期</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 详细分析标签页 */}
        <Tabs defaultValue="trends" className="space-y-4">
          <TabsList>
            <TabsTrigger value="trends">趋势分析</TabsTrigger>
            <TabsTrigger value="services">服务分析</TabsTrigger>
            <TabsTrigger value="users">用户分析</TabsTrigger>
            <TabsTrigger value="groups">拼车组分析</TabsTrigger>
          </TabsList>

          <TabsContent value="trends">
            <Card>
              <CardHeader>
                <CardTitle>使用趋势</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64 flex items-center justify-center bg-gray-50 rounded-lg">
                  <div className="text-center">
                    <BarChart3 className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                    <p className="text-gray-600">趋势图表将在此处显示</p>
                    <p className="text-sm text-gray-500">需要集成图表库如 Chart.js 或 Recharts</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="services">
            <Card>
              <CardHeader>
                <CardTitle>服务性能分析</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {analytics.serviceBreakdown.map((service, index) => (
                    <div key={index} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center space-x-3">
                        <Zap className="w-5 h-5 text-blue-500" />
                        <div>
                          <h4 className="font-medium text-gray-900 capitalize">{service.service}</h4>
                          <p className="text-sm text-gray-600">
                            成功率 {(service.successRate * 100).toFixed(1)}%
                          </p>
                        </div>
                      </div>
                      <div className="text-right space-y-1">
                        <div className="text-sm font-medium">{formatNumber(service.requests)} 请求</div>
                        <div className="text-sm text-gray-600">${service.cost.toFixed(2)}</div>
                        <div className="text-xs text-gray-500">{service.avgResponseTime}ms</div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="users">
            <Card>
              <CardHeader>
                <CardTitle>用户使用排行</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {analytics.topUsers.map((user, index) => (
                    <div key={user.userId} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                          <span className="text-sm font-medium text-blue-600">#{index + 1}</span>
                        </div>
                        <div>
                          <h4 className="font-medium text-gray-900">{user.userName}</h4>
                          <p className="text-sm text-gray-600">用户ID: {user.userId}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-semibold text-gray-900">{formatNumber(user.requests)}</div>
                        <div className="text-sm text-gray-600">${user.cost.toFixed(2)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="groups">
            <Card>
              <CardHeader>
                <CardTitle>拼车组使用排行</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {analytics.topGroups.map((group, index) => (
                    <div key={group.groupId} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                          <span className="text-sm font-medium text-green-600">#{index + 1}</span>
                        </div>
                        <div>
                          <h4 className="font-medium text-gray-900">{group.groupName}</h4>
                          <p className="text-sm text-gray-600">{group.memberCount} 名成员</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-semibold text-gray-900">{formatNumber(group.requests)}</div>
                        <div className="text-sm text-gray-600">${group.cost.toFixed(2)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </EnterpriseLayout>
  );
}
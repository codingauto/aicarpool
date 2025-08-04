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

import React, { useState, useEffect, use } from 'react';
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
  Calendar,
  ChevronLeft,
  Building2
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEnterpriseContext } from '@/contexts/enterprise-context';

interface AnalyticsData {
  enterprise: {
    id: string;
    name: string;
  };
  timeRange: string;
  summary: {
    totalGroups: number;
    totalMembers: number;
    totalTokens: number;
    totalCost: number;
    totalRequests: number;
    avgResponseTime: number;
    avgSuccessRate: number;
  };
  usageData: {
    date: string;
    tokens: number;
    cost: number;
    requests: number;
    responseTime: number;
    successRate: number;
  }[];
  serviceUsage: {
    serviceType: string;
    tokens: number;
    cost: number;
    requests: number;
    percentage: number;
  }[];
  groupStats: {
    groupId: string;
    groupName: string;
    memberCount: number;
    resourceMode: string;
    dailyTokens: number;
    dailyCost: number;
    utilizationRate: number;
    efficiency: number;
  }[];
  departmentStats: {
    departmentId: string;
    departmentName: string;
    groupCount: number;
    memberCount: number;
    dailyTokens: number;
    dailyCost: number;
    efficiency: number;
  }[];
}

export default function EnterpriseAnalyticsPage({ params }: { params: Promise<{ enterpriseId: string }> }) {
  const { enterpriseId } = use(params);
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
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center h-64">
          <div className="text-lg text-gray-600">加载分析数据...</div>
        </div>
      </div>
    );
  }

  if (error || !analytics) {
    return (
      <div className="container mx-auto px-4 py-8">
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
            <span>数据分析</span>
          </div>
        </div>

        <div className="space-y-6">
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
            {(hasRole('owner') || hasRole('admin')) && (
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
              <div className="mt-4 flex items-center text-sm text-green-600">
                <TrendingUp className="w-4 h-4" />
                <span className="ml-1">+12% 较上期</span>
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
              <div className="mt-4 flex items-center text-sm text-red-600">
                <TrendingUp className="w-4 h-4" />
                <span className="ml-1">+8% 较上期</span>
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
              <div className="mt-4 flex items-center text-sm text-green-600">
                <TrendingDown className="w-4 h-4" />
                <span className="ml-1">-5% 较上期</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">总成员数</p>
                  <p className="text-2xl font-bold text-gray-900">{analytics.summary.totalMembers}</p>
                </div>
                <Users className="w-8 h-8 text-orange-500" />
              </div>
              <div className="mt-4 flex items-center text-sm text-blue-600">
                <TrendingUp className="w-4 h-4" />
                <span className="ml-1">+15% 较上期</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 详细分析标签页 */}
        <Tabs defaultValue="trends" className="space-y-4">
          <TabsList>
            <TabsTrigger value="trends">趋势分析</TabsTrigger>
            <TabsTrigger value="services">服务分析</TabsTrigger>
            <TabsTrigger value="users">每日详情</TabsTrigger>
            <TabsTrigger value="groups">拼车组分析</TabsTrigger>
          </TabsList>

          <TabsContent value="trends">
            <Card>
              <CardHeader>
                <CardTitle>使用趋势分析</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {/* 总体统计 */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-blue-50 p-4 rounded-lg">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-blue-600">总拼车组</p>
                          <p className="text-xl font-bold text-blue-900">{analytics.summary.totalGroups}</p>
                        </div>
                        <Users className="w-8 h-8 text-blue-500" />
                      </div>
                    </div>
                    <div className="bg-green-50 p-4 rounded-lg">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-green-600">总Token使用</p>
                          <p className="text-xl font-bold text-green-900">{formatNumber(analytics.summary.totalTokens)}</p>
                        </div>
                        <Zap className="w-8 h-8 text-green-500" />
                      </div>
                    </div>
                    <div className="bg-purple-50 p-4 rounded-lg">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-purple-600">平均成功率</p>
                          <p className="text-xl font-bold text-purple-900">{analytics.summary.avgSuccessRate}%</p>
                        </div>
                        <Activity className="w-8 h-8 text-purple-500" />
                      </div>
                    </div>
                  </div>
                  
                  {/* 使用趋势表格 */}
                  <div>
                    <h4 className="font-medium mb-3">使用趋势数据</h4>
                    <div className="border rounded-lg overflow-hidden">
                      <div className="bg-gray-50 px-4 py-2 border-b">
                        <div className="grid grid-cols-6 gap-4 text-sm font-medium text-gray-600">
                          <span>日期</span>
                          <span>请求数</span>
                          <span>Token数</span>
                          <span>成本</span>
                          <span>响应时间</span>
                          <span>成功率</span>
                        </div>
                      </div>
                      <div className="divide-y">
                        {analytics.usageData.slice(-10).map((day) => (
                          <div key={day.date} className="px-4 py-3 hover:bg-gray-50">
                            <div className="grid grid-cols-6 gap-4 text-sm">
                              <span className="font-medium">{day.date}</span>
                              <span>{formatNumber(day.requests)}</span>
                              <span>{formatNumber(day.tokens)}</span>
                              <span>${day.cost.toFixed(2)}</span>
                              <span>{day.responseTime}ms</span>
                              <span className="flex items-center">
                                <div className={`w-2 h-2 rounded-full mr-2 ${
                                  day.successRate >= 95 ? 'bg-green-500' : 
                                  day.successRate >= 90 ? 'bg-yellow-500' : 'bg-red-500'
                                }`}></div>
                                {day.successRate}%
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
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
                  {analytics.serviceUsage.map((service, index) => (
                    <div key={index} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center space-x-3">
                        <Zap className="w-5 h-5 text-blue-500" />
                        <div>
                          <h4 className="font-medium text-gray-900">{service.serviceType}</h4>
                          <p className="text-sm text-gray-600">
                            占比 {service.percentage}%
                          </p>
                        </div>
                      </div>
                      <div className="text-right space-y-1">
                        <div className="text-sm font-medium">{formatNumber(service.requests)} 请求</div>
                        <div className="text-sm text-gray-600">${service.cost.toFixed(2)}</div>
                        <div className="text-xs text-gray-500">{formatNumber(service.tokens)} tokens</div>
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
                <CardTitle>每日使用详情</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {analytics.usageData.slice(-7).map((day, index) => (
                    <div key={day.date} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                          <span className="text-sm font-medium text-blue-600">#{index + 1}</span>
                        </div>
                        <div>
                          <h4 className="font-medium text-gray-900">{day.date}</h4>
                          <p className="text-sm text-gray-600">成功率: {day.successRate}%</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-semibold text-gray-900">{formatNumber(day.requests)}</div>
                        <div className="text-sm text-gray-600">${day.cost.toFixed(2)}</div>
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
                  {analytics.groupStats.map((group, index) => (
                    <div key={group.groupId} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                          <span className="text-sm font-medium text-green-600">#{index + 1}</span>
                        </div>
                        <div>
                          <h4 className="font-medium text-gray-900">{group.groupName}</h4>
                          <p className="text-sm text-gray-600">{group.memberCount} 名成员 • {group.resourceMode} 模式</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-semibold text-gray-900">{formatNumber(group.dailyTokens)} tokens</div>
                        <div className="text-sm text-gray-600">${group.dailyCost.toFixed(2)}/天</div>
                        <div className="text-xs text-gray-500">利用率 {group.utilizationRate}% • 效率 {group.efficiency}%</div>
                      </div>
                    </div>
                  ))}
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
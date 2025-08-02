'use client';

/**
 * 企业专属AI资源管理页面
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
  Settings,
  Zap
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEnterpriseContext } from '@/contexts/enterprise-context';
import { EnterpriseLayout } from '@/components/layout/enterprise-navigation';

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

  useEffect(() => {
    fetchAiResourceDashboard();
  }, [enterpriseId]);

  const fetchAiResourceDashboard = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/enterprises/${enterpriseId}/ai-resources/dashboard`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setDashboard(data.data);
        } else {
          setError(data.message || '获取AI资源信息失败');
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

  const getServiceIcon = (serviceType: string) => {
    switch (serviceType) {
      case 'claude':
        return '🤖';
      case 'gpt':
        return '💬';
      case 'gemini':
        return '💎';
      default:
        return '🔧';
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
      <EnterpriseLayout enterpriseId={enterpriseId}>
        <div className="p-6">
          <div className="flex items-center justify-center h-64">
            <div className="text-lg text-gray-600">加载AI资源信息...</div>
          </div>
        </div>
      </EnterpriseLayout>
    );
  }

  if (error) {
    return (
      <EnterpriseLayout enterpriseId={enterpriseId}>
        <div className="p-6">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <AlertTriangle className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">加载失败</h3>
                <p className="text-gray-600 mb-4">{error}</p>
                <Button onClick={fetchAiResourceDashboard}>重试</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </EnterpriseLayout>
    );
  }

  if (!dashboard) {
    return (
      <EnterpriseLayout enterpriseId={enterpriseId}>
        <div className="p-6">
          <div className="text-center">
            <div className="text-lg text-gray-600">暂无AI资源信息</div>
          </div>
        </div>
      </EnterpriseLayout>
    );
  }

  return (
    <EnterpriseLayout enterpriseId={enterpriseId}>
      <div className="p-6 space-y-6">
        {/* 页面标题 */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Zap className="w-6 h-6 text-blue-600" />
              AI资源管理
            </h1>
            <p className="text-gray-600 mt-1">
              管理企业的AI服务账号和资源配置
            </p>
          </div>
          {hasRole(['owner', 'admin']) && (
            <div className="flex gap-2">
              <Button 
                variant="outline"
                onClick={() => router.push(`/enterprise/${enterpriseId}/ai-resources/settings`)}
              >
                <Settings className="w-4 h-4 mr-2" />
                设置
              </Button>
              <Button onClick={() => router.push(`/enterprise/${enterpriseId}/ai-resources/create`)}>
                <Plus className="w-4 h-4 mr-2" />
                添加账号
              </Button>
            </div>
          )}
        </div>

        {/* 概览统计 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">AI账号总数</p>
                  <p className="text-2xl font-bold text-gray-900">{dashboard.totalAccounts}</p>
                </div>
                <Server className="w-8 h-8 text-blue-500" />
              </div>
              <div className="mt-4">
                <div className="flex items-center text-sm text-gray-600">
                  <CheckCircle className="w-4 h-4 text-green-500 mr-1" />
                  {dashboard.activeAccounts} 个活跃
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">拼车组数量</p>
                  <p className="text-2xl font-bold text-gray-900">{dashboard.totalGroups}</p>
                </div>
                <Users className="w-8 h-8 text-green-500" />
              </div>
              <div className="mt-4">
                <div className="flex items-center text-sm text-gray-600">
                  <Activity className="w-4 h-4 text-blue-500 mr-1" />
                  使用AI资源
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">今日请求</p>
                  <p className="text-2xl font-bold text-gray-900">{dashboard.dailyRequests.toLocaleString()}</p>
                </div>
                <TrendingUp className="w-8 h-8 text-purple-500" />
              </div>
              <div className="mt-4">
                <div className="flex items-center text-sm text-gray-600">
                  <Clock className="w-4 h-4 text-gray-400 mr-1" />
                  {dashboard.averageResponseTime}ms 平均响应
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">今日成本</p>
                  <p className="text-2xl font-bold text-gray-900">${dashboard.dailyCost.toFixed(2)}</p>
                </div>
                <DollarSign className="w-8 h-8 text-yellow-500" />
              </div>
              <div className="mt-4">
                <div className="flex items-center text-sm text-green-600">
                  <TrendingUp className="w-4 h-4 mr-1" />
                  较昨日持平
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 详细信息标签页 */}
        <Tabs defaultValue="services" className="space-y-4">
          <TabsList>
            <TabsTrigger value="services">服务分布</TabsTrigger>
            <TabsTrigger value="usage">使用排行</TabsTrigger>
            <TabsTrigger value="alerts">告警信息</TabsTrigger>
          </TabsList>

          <TabsContent value="services">
            <Card>
              <CardHeader>
                <CardTitle>AI服务分布</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {dashboard.accountsByService.map((service, index) => (
                    <div key={index} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center space-x-3">
                        <span className="text-2xl">{getServiceIcon(service.serviceType)}</span>
                        <div>
                          <h4 className="font-medium text-gray-900 capitalize">{service.serviceType}</h4>
                          <p className="text-sm text-gray-600">
                            {service.healthyCount}/{service.count} 健康
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-semibold text-gray-900">{service.count}</div>
                        <div className="flex items-center space-x-2">
                          <Progress value={service.avgLoad} className="w-20" />
                          <span className="text-sm text-gray-600">{service.avgLoad}%</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="usage">
            <Card>
              <CardHeader>
                <CardTitle>拼车组使用排行</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {dashboard.topGroupsByUsage.map((group, index) => (
                    <div key={group.groupId} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                          <span className="text-sm font-medium text-blue-600">#{index + 1}</span>
                        </div>
                        <div>
                          <h4 className="font-medium text-gray-900">{group.groupName}</h4>
                          <p className="text-sm text-gray-600">今日请求 {group.dailyRequests.toLocaleString()} 次</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-semibold text-gray-900">${group.dailyCost.toFixed(2)}</div>
                        <div className="text-sm text-gray-600">今日成本</div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="alerts">
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
        </Tabs>
      </div>
    </EnterpriseLayout>
  );
}
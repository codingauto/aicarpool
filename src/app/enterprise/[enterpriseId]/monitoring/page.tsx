'use client';

/**
 * 企业专属监控中心页面
 * 
 * 功能：
 * - 系统性能监控
 * - 服务健康状态
 * - 实时指标展示
 * - 性能趋势分析
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Monitor,
  Activity,
  Server,
  Database,
  Wifi,
  Cpu,
  HardDrive,
  MemoryStick,
  Network,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  TrendingUp,
  TrendingDown,
  Zap,
  Globe,
  RefreshCw
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEnterpriseContext } from '@/contexts/enterprise-context';
import { EnterpriseLayout } from '@/components/layout/enterprise-navigation';

interface SystemMetric {
  name: string;
  value: number;
  unit: string;
  status: 'normal' | 'warning' | 'critical';
  trend: 'up' | 'down' | 'stable';
  lastUpdated: string;
}

interface ServiceHealth {
  serviceName: string;
  status: 'healthy' | 'degraded' | 'down';
  responseTime: number;
  uptime: number;
  errorRate: number;
  lastCheck: string;
}

interface PerformanceMetric {
  timestamp: string;
  cpuUsage: number;
  memoryUsage: number;
  networkTraffic: number;
  responseTime: number;
}

interface MonitoringData {
  overview: {
    systemHealth: 'healthy' | 'warning' | 'critical';
    totalServices: number;
    healthyServices: number;
    avgResponseTime: number;
    uptime: number;
  };
  systemMetrics: SystemMetric[];
  serviceHealth: ServiceHealth[];
  performanceData: PerformanceMetric[];
  alerts: {
    id: string;
    type: 'warning' | 'error' | 'info';
    message: string;
    service: string;
    timestamp: string;
  }[];
}

export default function EnterpriseMonitoringPage({ params }: { params: Promise<{ enterpriseId: string }> }) {
  const { enterpriseId } = React.use(params);
  const router = useRouter();
  const { currentEnterprise, hasRole } = useEnterpriseContext();
  const [monitoringData, setMonitoringData] = useState<MonitoringData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [timeRange, setTimeRange] = useState('1h');
  const [autoRefresh, setAutoRefresh] = useState(true);

  useEffect(() => {
    fetchMonitoringData();
    
    // 设置自动刷新
    if (autoRefresh) {
      const interval = setInterval(fetchMonitoringData, 30000); // 30秒刷新一次
      return () => clearInterval(interval);
    }
  }, [enterpriseId, timeRange, autoRefresh]);

  const fetchMonitoringData = async () => {
    try {
      setRefreshing(true);
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/enterprises/${enterpriseId}/monitoring?timeRange=${timeRange}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setMonitoringData(data.data);
        } else {
          setError(data.message || '获取监控数据失败');
        }
      } else {
        setError('获取监控数据失败');
      }
    } catch (error) {
      console.error('获取监控数据失败:', error);
      setError('获取监控数据失败');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
      case 'normal':
        return 'text-green-600 bg-green-50 border-green-200';
      case 'warning':
      case 'degraded':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'critical':
      case 'down':
        return 'text-red-600 bg-red-50 border-red-200';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
      case 'normal':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'warning':
      case 'degraded':
        return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      case 'critical':
      case 'down':
        return <XCircle className="w-4 h-4 text-red-500" />;
      default:
        return <Activity className="w-4 h-4 text-gray-500" />;
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'up':
        return <TrendingUp className="w-4 h-4 text-red-500" />;
      case 'down':
        return <TrendingDown className="w-4 h-4 text-green-500" />;
      default:
        return <Activity className="w-4 h-4 text-gray-500" />;
    }
  };

  const getMetricIcon = (metricName: string) => {
    switch (metricName.toLowerCase()) {
      case 'cpu usage':
        return <Cpu className="w-5 h-5 text-blue-500" />;
      case 'memory usage':
        return <MemoryStick className="w-5 h-5 text-green-500" />;
      case 'disk usage':
        return <HardDrive className="w-5 h-5 text-purple-500" />;
      case 'network traffic':
        return <Network className="w-5 h-5 text-orange-500" />;
      default:
        return <Activity className="w-5 h-5 text-gray-500" />;
    }
  };

  if (loading) {
    return (
      <EnterpriseLayout enterpriseId={enterpriseId}>
        <div className="p-6">
          <div className="flex items-center justify-center h-64">
            <div className="text-lg text-gray-600">加载监控数据...</div>
          </div>
        </div>
      </EnterpriseLayout>
    );
  }

  if (error || !monitoringData) {
    return (
      <EnterpriseLayout enterpriseId={enterpriseId}>
        <div className="p-6">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <Monitor className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">监控数据加载失败</h3>
                <p className="text-gray-600 mb-4">{error || '暂无监控数据'}</p>
                <Button onClick={fetchMonitoringData}>重试</Button>
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
              <Monitor className="w-6 h-6 text-blue-600" />
              监控中心
            </h1>
            <p className="text-gray-600 mt-1">
              实时监控企业AI资源系统状态和性能指标
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Select value={timeRange} onValueChange={setTimeRange}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1h">最近1小时</SelectItem>
                <SelectItem value="6h">最近6小时</SelectItem>
                <SelectItem value="24h">最近24小时</SelectItem>
                <SelectItem value="7d">最近7天</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={autoRefresh ? 'bg-green-50 border-green-200' : ''}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
              {autoRefresh ? '自动刷新' : '手动刷新'}
            </Button>
            <Button variant="outline" onClick={fetchMonitoringData} disabled={refreshing}>
              <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
              刷新
            </Button>
          </div>
        </div>

        {/* 系统概览 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">系统健康度</p>
                  <p className={`text-2xl font-bold ${
                    monitoringData.overview.systemHealth === 'healthy' ? 'text-green-600' :
                    monitoringData.overview.systemHealth === 'warning' ? 'text-yellow-600' : 'text-red-600'
                  }`}>
                    {monitoringData.overview.systemHealth === 'healthy' ? '健康' :
                     monitoringData.overview.systemHealth === 'warning' ? '警告' : '严重'}
                  </p>
                </div>
                {getStatusIcon(monitoringData.overview.systemHealth)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">服务状态</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {monitoringData.overview.healthyServices}/{monitoringData.overview.totalServices}
                  </p>
                </div>
                <Server className="w-8 h-8 text-blue-500" />
              </div>
              <div className="mt-4">
                <Progress 
                  value={(monitoringData.overview.healthyServices / monitoringData.overview.totalServices) * 100} 
                  className="h-2" 
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">平均响应时间</p>
                  <p className="text-2xl font-bold text-gray-900">{monitoringData.overview.avgResponseTime}ms</p>
                </div>
                <Clock className="w-8 h-8 text-purple-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">系统运行时间</p>
                  <p className="text-2xl font-bold text-gray-900">{monitoringData.overview.uptime}%</p>
                </div>
                <Zap className="w-8 h-8 text-green-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 详细监控信息 */}
        <Tabs defaultValue="metrics" className="space-y-4">
          <TabsList>
            <TabsTrigger value="metrics">系统指标</TabsTrigger>
            <TabsTrigger value="services">服务健康</TabsTrigger>
            <TabsTrigger value="performance">性能趋势</TabsTrigger>
            <TabsTrigger value="alerts">告警信息</TabsTrigger>
          </TabsList>

          <TabsContent value="metrics">
            <Card>
              <CardHeader>
                <CardTitle>系统指标</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {monitoringData.systemMetrics.map((metric, index) => (
                    <div key={index} className={`p-4 border rounded-lg ${getStatusColor(metric.status)}`}>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center space-x-3">
                          {getMetricIcon(metric.name)}
                          <div>
                            <h4 className="font-medium">{metric.name}</h4>
                            <p className="text-sm opacity-75">
                              最后更新: {new Date(metric.lastUpdated).toLocaleTimeString('zh-CN')}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          {getTrendIcon(metric.trend)}
                          {getStatusIcon(metric.status)}
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span>当前值: {metric.value}{metric.unit}</span>
                          <span>状态: {metric.status}</span>
                        </div>
                        <Progress value={metric.value} className="h-2" />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="services">
            <Card>
              <CardHeader>
                <CardTitle>服务健康状态</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {monitoringData.serviceHealth.map((service, index) => (
                    <div key={index} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center space-x-4">
                        {getStatusIcon(service.status)}
                        <div>
                          <h4 className="font-medium text-gray-900">{service.serviceName}</h4>
                          <p className="text-sm text-gray-600">
                            最后检查: {new Date(service.lastCheck).toLocaleString('zh-CN')}
                          </p>
                        </div>
                      </div>
                      <div className="text-right space-y-1">
                        <div className="text-sm">
                          <span className="text-gray-600">响应时间: </span>
                          <span className="font-medium">{service.responseTime}ms</span>
                        </div>
                        <div className="text-sm">
                          <span className="text-gray-600">运行时间: </span>
                          <span className="font-medium">{service.uptime}%</span>
                        </div>
                        <div className="text-sm">
                          <span className="text-gray-600">错误率: </span>
                          <span className="font-medium">{service.errorRate}%</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="performance">
            <Card>
              <CardHeader>
                <CardTitle>性能趋势</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64 flex items-center justify-center bg-gray-50 rounded-lg">
                  <div className="text-center">
                    <Activity className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                    <p className="text-gray-600">性能趋势图表将在此处显示</p>
                    <p className="text-sm text-gray-500">需要集成图表库如 Chart.js 或 Recharts</p>
                  </div>
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
                  {monitoringData.alerts.length > 0 ? (
                    monitoringData.alerts.map((alert) => (
                      <div key={alert.id} className="flex items-start space-x-3 p-4 border rounded-lg">
                        {getStatusIcon(alert.type)}
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900">{alert.message}</p>
                          <div className="flex items-center space-x-4 mt-2 text-xs text-gray-500">
                            <span>服务: {alert.service}</span>
                            <span>{new Date(alert.timestamp).toLocaleString('zh-CN')}</span>
                          </div>
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
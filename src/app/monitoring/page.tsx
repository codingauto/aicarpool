'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AppHeader } from '@/components/layout/AppHeader';
import { 
  Activity, 
  AlertTriangle, 
  CheckCircle, 
  XCircle,
  TrendingUp,
  TrendingDown,
  Server,
  Database,
  Globe,
  Users,
  DollarSign,
  Clock,
  RefreshCw,
  Settings
} from 'lucide-react';

interface SystemOverview {
  users: { total: number; active: number };
  groups: { total: number; active: number };
  requests: { today: number; total: number };
  costs: { today: number; total: number };
  nodes: { active: number; total: number };
}

interface HealthCheck {
  overall: 'healthy' | 'warning' | 'critical';
  services: Record<string, {
    status: 'healthy' | 'warning' | 'critical';
    metrics: Record<string, number>;
    message?: string;
  }>;
}

interface AlertIncident {
  id: string;
  ruleId: string;
  status: 'active' | 'resolved' | 'suppressed';
  severity: string;
  title: string;
  description: string;
  startTime: Date;
  endTime?: Date;
  resolvedBy?: string;
}

interface MetricData {
  timestamp: Date;
  value: number;
  component: string;
  metricName: string;
  tags: Record<string, any>;
}

export default function MonitoringPage() {
  const [overview, setOverview] = useState<SystemOverview | null>(null);
  const [healthCheck, setHealthCheck] = useState<HealthCheck | null>(null);
  const [incidents, setIncidents] = useState<AlertIncident[]>([]);
  const [metrics, setMetrics] = useState<MetricData[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const router = useRouter();

  useEffect(() => {
    fetchData();
    // 每30秒自动刷新
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        router.push('/auth/login');
        return;
      }

      const [overviewRes, healthRes, incidentsRes, metricsRes] = await Promise.all([
        fetch('/api/monitoring/overview', {
          headers: { 'Authorization': `Bearer ${token}` },
        }),
        fetch('/api/monitoring/health', {
          headers: { 'Authorization': `Bearer ${token}` },
        }),
        fetch('/api/monitoring/incidents?status=active', {
          headers: { 'Authorization': `Bearer ${token}` },
        }),
        fetch('/api/monitoring/metrics?component=api&startTime=' + new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), {
          headers: { 'Authorization': `Bearer ${token}` },
        }),
      ]);

      const [overviewData, healthData, incidentsData, metricsData] = await Promise.all([
        overviewRes.json(),
        healthRes.json(),
        incidentsRes.json(),
        metricsRes.json(),
      ]);

      if (overviewData.success) setOverview(overviewData.data);
      if (healthData.success) setHealthCheck(healthData.data);
      if (incidentsData.success) setIncidents(incidentsData.data);
      if (metricsData.success) setMetrics(metricsData.data);
    } catch (error) {
      console.error('获取监控数据失败:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchData();
  };

  const resolveIncident = async (incidentId: string) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/monitoring/incidents/${incidentId}/resolve`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ resolvedBy: 'current_user' }),
      });

      if (response.ok) {
        await fetchData();
      }
    } catch (error) {
      console.error('解决告警失败:', error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'text-green-600 bg-green-50';
      case 'warning':
        return 'text-yellow-600 bg-yellow-50';
      case 'critical':
        return 'text-red-600 bg-red-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-yellow-600" />;
      case 'critical':
        return <XCircle className="w-5 h-5 text-red-600" />;
      default:
        return <Activity className="w-5 h-5 text-gray-600" />;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'info':
        return 'default';
      case 'warning':
        return 'secondary';
      case 'error':
        return 'destructive';
      case 'critical':
        return 'destructive';
      default:
        return 'default';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-lg">加载监控数据...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader showUserInfo={false}>
        <Button variant="outline" onClick={handleRefresh} disabled={refreshing}>
          <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          刷新
        </Button>
        <Button variant="outline">
          <Settings className="w-4 h-4 mr-2" />
          设置
        </Button>
      </AppHeader>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">系统概览</TabsTrigger>
            <TabsTrigger value="health">健康状态</TabsTrigger>
            <TabsTrigger value="alerts">告警事件</TabsTrigger>
            <TabsTrigger value="metrics">性能指标</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            {/* 系统状态卡片 */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {healthCheck && (
                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center">
                      {getStatusIcon(healthCheck.overall)}
                      <div className="ml-3">
                        <div className="text-2xl font-bold capitalize">
                          {healthCheck.overall === 'healthy' ? '正常' : 
                           healthCheck.overall === 'warning' ? '警告' : '严重'}
                        </div>
                        <div className="text-sm text-gray-600">系统状态</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {overview && (
                <>
                  <Card>
                    <CardContent className="p-6">
                      <div className="flex items-center">
                        <Users className="w-5 h-5 text-blue-600" />
                        <div className="ml-3">
                          <div className="text-2xl font-bold">
                            {overview.users.active}/{overview.users.total}
                          </div>
                          <div className="text-sm text-gray-600">活跃用户</div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-6">
                      <div className="flex items-center">
                        <Activity className="w-5 h-5 text-green-600" />
                        <div className="ml-3">
                          <div className="text-2xl font-bold">{overview.requests.today}</div>
                          <div className="text-sm text-gray-600">今日请求</div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-6">
                      <div className="flex items-center">
                        <DollarSign className="w-5 h-5 text-orange-600" />
                        <div className="ml-3">
                          <div className="text-2xl font-bold">
                            ${overview.costs.today.toFixed(2)}
                          </div>
                          <div className="text-sm text-gray-600">今日成本</div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </>
              )}
            </div>

            {/* 详细统计 */}
            {overview && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>用户统计</CardTitle>
                    <CardDescription>用户注册和活跃情况</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <span>总用户数</span>
                        <span className="font-bold">{overview.users.total}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span>活跃用户数</span>
                        <span className="font-bold text-green-600">{overview.users.active}</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-green-600 h-2 rounded-full"
                          style={{
                            width: `${overview.users.total > 0 ? (overview.users.active / overview.users.total) * 100 : 0}%`
                          }}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>拼车组统计</CardTitle>
                    <CardDescription>拼车组创建和活跃情况</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <span>总拼车组数</span>
                        <span className="font-bold">{overview.groups.total}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span>活跃拼车组数</span>
                        <span className="font-bold text-blue-600">{overview.groups.active}</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-blue-600 h-2 rounded-full"
                          style={{
                            width: `${overview.groups.total > 0 ? (overview.groups.active / overview.groups.total) * 100 : 0}%`
                          }}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>请求统计</CardTitle>
                    <CardDescription>API请求量统计</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <span>今日请求数</span>
                        <span className="font-bold text-purple-600">{overview.requests.today}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span>总请求数</span>
                        <span className="font-bold">{overview.requests.total}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>边缘节点</CardTitle>
                    <CardDescription>边缘节点运行状态</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <span>在线节点</span>
                        <span className="font-bold text-green-600">{overview.nodes.active}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span>总节点数</span>
                        <span className="font-bold">{overview.nodes.total}</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-green-600 h-2 rounded-full"
                          style={{
                            width: `${overview.nodes.total > 0 ? (overview.nodes.active / overview.nodes.total) * 100 : 0}%`
                          }}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>

          <TabsContent value="health" className="space-y-6">
            {healthCheck && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {Object.entries(healthCheck.services).map(([serviceName, service]) => (
                  <Card key={serviceName}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="flex items-center gap-2">
                          {serviceName === 'database' && <Database className="w-5 h-5" />}
                          {serviceName === 'api' && <Server className="w-5 h-5" />}
                          {serviceName === 'edge_nodes' && <Globe className="w-5 h-5" />}
                          {serviceName === 'database' ? '数据库' : 
                           serviceName === 'api' ? 'API服务' : 
                           serviceName === 'edge_nodes' ? '边缘节点' : serviceName}
                        </CardTitle>
                        <Badge 
                          className={getStatusColor(service.status)}
                          variant="outline"
                        >
                          {service.status === 'healthy' ? '正常' : 
                           service.status === 'warning' ? '警告' : '故障'}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {service.message && (
                        <div className="text-sm text-gray-600 mb-4">
                          {service.message}
                        </div>
                      )}
                      <div className="space-y-2">
                        {Object.entries(service.metrics).map(([metricName, value]) => (
                          <div key={metricName} className="flex justify-between items-center text-sm">
                            <span className="text-gray-500">
                              {metricName === 'connection_time' ? '连接时间' :
                               metricName === 'avg_response_time' ? '平均响应时间' :
                               metricName === 'active_nodes' ? '在线节点' :
                               metricName === 'total_nodes' ? '总节点' : metricName}
                            </span>
                            <span className="font-medium">
                              {metricName.includes('time') ? `${value}ms` : value}
                            </span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="alerts" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>活跃告警事件</CardTitle>
                <CardDescription>当前需要处理的告警事件</CardDescription>
              </CardHeader>
              <CardContent>
                {incidents.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>严重级别</TableHead>
                        <TableHead>标题</TableHead>
                        <TableHead>描述</TableHead>
                        <TableHead>开始时间</TableHead>
                        <TableHead>持续时间</TableHead>
                        <TableHead>操作</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {incidents.map((incident) => (
                        <TableRow key={incident.id}>
                          <TableCell>
                            <Badge variant={getSeverityColor(incident.severity)}>
                              {incident.severity === 'info' ? '信息' :
                               incident.severity === 'warning' ? '警告' :
                               incident.severity === 'error' ? '错误' : '严重'}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-medium">{incident.title}</TableCell>
                          <TableCell className="max-w-xs truncate">
                            {incident.description}
                          </TableCell>
                          <TableCell>
                            {new Date(incident.startTime).toLocaleString('zh-CN')}
                          </TableCell>
                          <TableCell>
                            {Math.floor((Date.now() - new Date(incident.startTime).getTime()) / 60000)}分钟
                          </TableCell>
                          <TableCell>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => resolveIncident(incident.id)}
                            >
                              解决
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center py-8">
                    <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">
                      系统运行正常
                    </h3>
                    <p className="text-gray-500">当前没有活跃的告警事件</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="metrics" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>性能指标</CardTitle>
                <CardDescription>系统性能指标趋势（最近24小时）</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8">
                  <TrendingUp className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    图表功能开发中
                  </h3>
                  <p className="text-gray-500 mb-4">
                    将显示实时性能指标图表和趋势分析
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                    <div className="bg-blue-50 p-4 rounded-lg">
                      <div className="text-blue-600 font-medium mb-2">响应时间</div>
                      <div className="text-sm text-gray-600">
                        API响应时间趋势图
                      </div>
                    </div>
                    <div className="bg-green-50 p-4 rounded-lg">
                      <div className="text-green-600 font-medium mb-2">请求量</div>
                      <div className="text-sm text-gray-600">
                        请求量变化趋势图
                      </div>
                    </div>
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
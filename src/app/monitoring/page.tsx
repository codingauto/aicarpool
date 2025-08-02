'use client';

/**
 * AI服务监控统计页面
 * 
 * 功能：
 * - 实时服务状态监控
 * - 性能指标分析
 * - 成本统计和趋势
 * - 使用量统计
 * - 异常告警
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  Activity,
  DollarSign,
  Clock,
  Server,
  AlertTriangle,
  CheckCircle,
  XCircle,
  TrendingUp,
  TrendingDown,
  BarChart3,
  RefreshCw,
  Download,
  Filter,
  Zap,
  Users,
  Database,
  Settings,
  Globe
} from 'lucide-react';
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { CardDescription } from '@/components/ui/card';

interface ServiceMetrics {
  serviceType: string;
  serviceName: string;
  status: 'healthy' | 'warning' | 'error';
  responseTime: number;
  successRate: number;
  totalRequests: number;
  errorCount: number;
  dailyCost: number;
  currentLoad: number;
  lastCheck: string;
}

interface UsageStats {
  timeRange: string;
  totalRequests: number;
  totalCost: number;
  totalTokens: number;
  avgResponseTime: number;
  successRate: number;
  topUsers: Array<{
    name: string;
    requests: number;
    cost: number;
  }>;
  topGroups: Array<{
    name: string;
    requests: number;
    cost: number;
  }>;
}

interface AlertItem {
  id: string;
  type: 'error' | 'warning' | 'info';
  service: string;
  message: string;
  timestamp: string;
  isResolved: boolean;
}

export default function MonitoringPage() {
  const [serviceMetrics, setServiceMetrics] = useState<ServiceMetrics[]>([]);
  const [usageStats, setUsageStats] = useState<UsageStats | null>(null);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedTimeRange, setSelectedTimeRange] = useState('24h');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [healthCheck, setHealthCheck] = useState<any>(null);
  const [overview, setOverview] = useState<any>(null);
  const [incidents, setIncidents] = useState<any[]>([]);

  useEffect(() => {
    fetchMonitoringData();
    
    if (autoRefresh) {
      const interval = setInterval(fetchMonitoringData, 30000); // 30秒刷新
      return () => clearInterval(interval);
    }
  }, [selectedTimeRange, autoRefresh]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchMonitoringData();
    setRefreshing(false);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'text-green-600 bg-green-50 border-green-200';
      case 'warning':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'error':
        return 'text-red-600 bg-red-50 border-red-200';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200';
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
      default:
        return 'outline';
    }
  };

  const resolveIncident = (id: string) => {
    setIncidents(prev => prev.filter(incident => incident.id !== id));
  };

  const fetchMonitoringData = async () => {
    try {
      // 模拟健康检查数据
      const mockHealthCheck = {
        overall: 'healthy',
        services: {
          database: {
            status: 'healthy',
            message: '数据库连接正常',
            metrics: {
              connection_time: 45,
              avg_response_time: 120
            }
          },
          api: {
            status: 'healthy',
            message: 'API服务运行正常',
            metrics: {
              avg_response_time: 230
            }
          },
          edge_nodes: {
            status: 'warning',
            message: '部分边缘节点响应慢',
            metrics: {
              active_nodes: 8,
              total_nodes: 10
            }
          }
        }
      };

      // 模拟概览数据
      const mockOverview = {
        users: {
          total: 1250,
          active: 867
        },
        groups: {
          total: 45,
          active: 38
        },
        requests: {
          today: 15420,
          total: 234567
        },
        costs: {
          today: 156.78
        },
        nodes: {
          active: 8,
          total: 10
        }
      };

      // 模拟告警事件
      const mockIncidents = [
        {
          id: '1',
          severity: 'warning',
          title: '边缘节点响应慢',
          description: '部分边缘节点响应时间超过阈值',
          startTime: new Date(Date.now() - 300000).toISOString()
        }
      ];

      // 模拟数据，实际应该调用API
      const mockServiceMetrics: ServiceMetrics[] = [
        {
          serviceType: 'claude',
          serviceName: 'Claude (Anthropic)',
          status: 'healthy',
          responseTime: 1234,
          successRate: 99.8,
          totalRequests: 4567,
          errorCount: 9,
          dailyCost: 156.78,
          currentLoad: 45,
          lastCheck: new Date().toISOString()
        },
        {
          serviceType: 'gemini',
          serviceName: 'Gemini (Google)',
          status: 'healthy',
          responseTime: 892,
          successRate: 99.5,
          totalRequests: 3421,
          errorCount: 17,
          dailyCost: 98.45,
          currentLoad: 32,
          lastCheck: new Date().toISOString()
        },
        {
          serviceType: 'openai',
          serviceName: 'OpenAI GPT',
          status: 'warning',
          responseTime: 2156,
          successRate: 97.8,
          totalRequests: 2234,
          errorCount: 49,
          dailyCost: 234.56,
          currentLoad: 78,
          lastCheck: new Date().toISOString()
        },
        {
          serviceType: 'qwen',
          serviceName: '通义千问',
          status: 'error',
          responseTime: 5432,
          successRate: 89.2,
          totalRequests: 1567,
          errorCount: 169,
          dailyCost: 67.89,
          currentLoad: 15,
          lastCheck: new Date().toISOString()
        }
      ];

      const mockUsageStats: UsageStats = {
        timeRange: selectedTimeRange,
        totalRequests: 11789,
        totalCost: 557.68,
        totalTokens: 2345678,
        avgResponseTime: 1578,
        successRate: 96.8,
        topUsers: [
          { name: '张三', requests: 1234, cost: 89.45 },
          { name: '李四', requests: 987, cost: 67.23 },
          { name: '王五', requests: 765, cost: 45.67 }
        ],
        topGroups: [
          { name: '前端开发组', requests: 3456, cost: 234.56 },
          { name: '后端开发组', requests: 2345, cost: 178.90 },
          { name: '产品设计组', requests: 1234, cost: 98.76 }
        ]
      };

      const mockAlerts: AlertItem[] = [
        {
          id: '1',
          type: 'error',
          service: '通义千问',
          message: '服务响应时间过长，平均5.4秒',
          timestamp: new Date(Date.now() - 300000).toISOString(),
          isResolved: false
        },
        {
          id: '2',
          type: 'warning',
          service: 'OpenAI GPT',
          message: 'API调用失败率较高，当前2.2%',
          timestamp: new Date(Date.now() - 600000).toISOString(),
          isResolved: false
        },
        {
          id: '3',
          type: 'warning',
          service: 'Claude',
          message: '日成本接近预算上限',
          timestamp: new Date(Date.now() - 900000).toISOString(),
          isResolved: true
        }
      ];

      setServiceMetrics(mockServiceMetrics);
      setUsageStats(mockUsageStats);
      setAlerts(mockAlerts);
      setHealthCheck(mockHealthCheck);
      setOverview(mockOverview);
      setIncidents(mockIncidents);
    } catch (error) {
      console.error('获取监控数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'warning':
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      case 'error':
        return <XCircle className="h-5 w-5 text-red-500" />;
      default:
        return <Activity className="h-5 w-5 text-gray-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'healthy':
        return <Badge variant="default" className="bg-green-500">正常</Badge>;
      case 'warning':
        return <Badge variant="secondary" className="bg-yellow-500 text-white">警告</Badge>;
      case 'error':
        return <Badge variant="destructive">错误</Badge>;
      default:
        return <Badge variant="outline">未知</Badge>;
    }
  };

  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'info':
        return <CheckCircle className="h-4 w-4 text-blue-500" />;
      default:
        return <Activity className="h-4 w-4 text-gray-500" />;
    }
  };

  const exportData = () => {
    const data = {
      serviceMetrics,
      usageStats,
      alerts: alerts.filter(alert => !alert.isResolved),
      exportTime: new Date().toISOString()
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `monitoring-report-${selectedTimeRange}-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
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

  return (
    <div className="p-6">
      {/* Page Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">监控中心</h1>
          <p className="text-gray-600 mt-1">系统健康状态和性能监控</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            刷新
          </Button>
          <Button variant="outline">
            <Settings className="w-4 h-4 mr-2" />
            设置
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div>
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
      </div>
    </div>
  );
}
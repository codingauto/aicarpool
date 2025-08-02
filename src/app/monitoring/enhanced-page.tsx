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
  Database
} from 'lucide-react';

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

export default function EnhancedMonitoringPage() {
  const [serviceMetrics, setServiceMetrics] = useState<ServiceMetrics[]>([]);
  const [usageStats, setUsageStats] = useState<UsageStats | null>(null);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTimeRange, setSelectedTimeRange] = useState('24h');
  const [autoRefresh, setAutoRefresh] = useState(true);

  useEffect(() => {
    fetchMonitoringData();
    
    if (autoRefresh) {
      const interval = setInterval(fetchMonitoringData, 30000); // 30秒刷新
      return () => clearInterval(interval);
    }
  }, [selectedTimeRange, autoRefresh]);

  const fetchMonitoringData = async () => {
    try {
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
    <div className="container mx-auto p-6 space-y-6">
      {/* 页面标题和控制 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">AI服务监控</h1>
          <p className="text-gray-600 mt-1">实时监控AI服务状态、性能和使用情况</p>
        </div>
        
        <div className="flex items-center space-x-4">
          <Select value={selectedTimeRange} onValueChange={setSelectedTimeRange}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1h">1小时</SelectItem>
              <SelectItem value="6h">6小时</SelectItem>
              <SelectItem value="24h">24小时</SelectItem>
              <SelectItem value="7d">7天</SelectItem>
              <SelectItem value="30d">30天</SelectItem>
            </SelectContent>
          </Select>
          
          <Button
            variant="outline"
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={autoRefresh ? 'bg-green-50 border-green-200' : ''}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${autoRefresh ? 'animate-spin' : ''}`} />
            {autoRefresh ? '自动刷新' : '手动刷新'}
          </Button>
          
          <Button variant="outline" onClick={exportData}>
            <Download className="h-4 w-4 mr-2" />
            导出报告
          </Button>
        </div>
      </div>

      {/* 未解决告警 */}
      {alerts.filter(alert => !alert.isResolved).length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <div className="flex items-center justify-between">
              <span>
                当前有 {alerts.filter(alert => !alert.isResolved).length} 个未解决的告警需要处理
              </span>
              <Button variant="link" size="sm" className="text-red-700 underline">
                查看详情
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* 概览统计 */}
      {usageStats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">总请求数</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{usageStats.totalRequests.toLocaleString()}</div>
              <div className="flex items-center text-xs text-muted-foreground">
                <TrendingUp className="h-3 w-3 mr-1 text-green-500" />
                +12.5% 相比昨天
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">总成本</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${usageStats.totalCost.toFixed(2)}</div>
              <div className="flex items-center text-xs text-muted-foreground">
                <TrendingDown className="h-3 w-3 mr-1 text-red-500" />
                -3.2% 相比昨天
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">平均响应时间</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{usageStats.avgResponseTime}ms</div>
              <div className="flex items-center text-xs text-muted-foreground">
                <TrendingUp className="h-3 w-3 mr-1 text-green-500" />
                性能良好
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">成功率</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{usageStats.successRate}%</div>
              <div className="flex items-center text-xs text-muted-foreground">
                <TrendingUp className="h-3 w-3 mr-1 text-green-500" />
                +0.8% 相比昨天
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs defaultValue="services" className="space-y-6">
        <TabsList>
          <TabsTrigger value="services">服务状态</TabsTrigger>
          <TabsTrigger value="usage">使用分析</TabsTrigger>
          <TabsTrigger value="alerts">告警中心</TabsTrigger>
          <TabsTrigger value="optimization">优化建议</TabsTrigger>
        </TabsList>

        <TabsContent value="services" className="space-y-6">
          <div className="grid gap-6">
            {serviceMetrics.map((service) => (
              <Card key={service.serviceType}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      {getStatusIcon(service.status)}
                      <div>
                        <CardTitle className="text-lg">{service.serviceName}</CardTitle>
                        <p className="text-sm text-gray-600">
                          最后检查: {new Date(service.lastCheck).toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                    {getStatusBadge(service.status)}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                    <div className="space-y-1">
                      <p className="text-sm text-gray-600">响应时间</p>
                      <p className="text-lg font-medium">{service.responseTime}ms</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm text-gray-600">成功率</p>
                      <p className="text-lg font-medium">{service.successRate}%</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm text-gray-600">总请求</p>
                      <p className="text-lg font-medium">{service.totalRequests.toLocaleString()}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm text-gray-600">错误数</p>
                      <p className="text-lg font-medium text-red-600">{service.errorCount}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm text-gray-600">今日成本</p>
                      <p className="text-lg font-medium">${service.dailyCost.toFixed(2)}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm text-gray-600">当前负载</p>
                      <div className="space-y-1">
                        <p className="text-lg font-medium">{service.currentLoad}%</p>
                        <Progress value={service.currentLoad} className="h-2" />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="usage" className="space-y-6">
          {usageStats && (
            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>热门用户</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {usageStats.topUsers.map((user, index) => (
                      <div key={index} className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                            <span className="text-sm font-medium">{index + 1}</span>
                          </div>
                          <div>
                            <p className="font-medium">{user.name}</p>
                            <p className="text-sm text-gray-600">{user.requests} 请求</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-medium">${user.cost.toFixed(2)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>热门拼车组</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {usageStats.topGroups.map((group, index) => (
                      <div key={index} className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                            <span className="text-sm font-medium">{index + 1}</span>
                          </div>
                          <div>
                            <p className="font-medium">{group.name}</p>
                            <p className="text-sm text-gray-600">{group.requests} 请求</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-medium">${group.cost.toFixed(2)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          <Card>
            <CardHeader>
              <CardTitle>使用趋势图表</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12 text-gray-500">
                <BarChart3 className="h-16 w-16 mx-auto mb-4" />
                <p className="text-lg">趋势图表功能开发中...</p>
                <p className="text-sm mt-2">将显示请求量、成本和响应时间的历史趋势</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="alerts" className="space-y-6">
          <div className="space-y-4">
            {alerts.map((alert) => (
              <Card key={alert.id} className={alert.isResolved ? 'opacity-60' : ''}>
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-3">
                      {getAlertIcon(alert.type)}
                      <div>
                        <div className="flex items-center space-x-2">
                          <h4 className="font-medium">{alert.service}</h4>
                          <Badge variant={alert.type === 'error' ? 'destructive' : 
                                        alert.type === 'warning' ? 'secondary' : 'default'}>
                            {alert.type === 'error' ? '错误' : 
                             alert.type === 'warning' ? '警告' : '信息'}
                          </Badge>
                          {alert.isResolved && (
                            <Badge variant="outline">已解决</Badge>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 mt-1">{alert.message}</p>
                        <p className="text-xs text-gray-500 mt-2">
                          {new Date(alert.timestamp).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    
                    {!alert.isResolved && (
                      <Button variant="outline" size="sm">
                        标记已解决
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
            
            {alerts.length === 0 && (
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center py-8">
                    <CheckCircle className="h-12 w-12 mx-auto text-green-500 mb-4" />
                    <h3 className="text-lg font-medium">暂无告警</h3>
                    <p className="text-gray-600 mt-1">所有服务运行正常</p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="optimization" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5 text-yellow-500" />
                  性能优化建议
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="border-l-4 border-yellow-400 pl-4">
                  <h4 className="font-medium">通义千问服务优化</h4>
                  <p className="text-sm text-gray-600 mt-1">
                    响应时间过长，建议调整负载均衡策略或增加备用账号
                  </p>
                </div>
                <div className="border-l-4 border-blue-400 pl-4">
                  <h4 className="font-medium">OpenAI服务优化</h4>
                  <p className="text-sm text-gray-600 mt-1">
                    失败率较高，建议检查API密钥状态和网络连接
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-green-500" />
                  成本优化建议
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="border-l-4 border-green-400 pl-4">
                  <h4 className="font-medium">Claude服务成本控制</h4>
                  <p className="text-sm text-gray-600 mt-1">
                    日成本接近预算上限，建议调整使用配额或切换到更经济的模型
                  </p>
                </div>
                <div className="border-l-4 border-purple-400 pl-4">
                  <h4 className="font-medium">资源分配优化</h4>
                  <p className="text-sm text-gray-600 mt-1">
                    部分拼车组资源利用率较低，建议重新分配或共享资源
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-blue-500" />
                智能优化推荐
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="flex items-start space-x-4">
                  <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
                  <div>
                    <h4 className="font-medium">负载均衡优化</h4>
                    <p className="text-sm text-gray-600 mt-1 mb-3">
                      基于历史数据分析，建议在高峰时间（14:00-18:00）自动切换到性能更好的Claude服务
                    </p>
                    <Button variant="outline" size="sm">应用建议</Button>
                  </div>
                </div>
                
                <div className="flex items-start space-x-4">
                  <div className="w-2 h-2 bg-green-500 rounded-full mt-2"></div>
                  <div>
                    <h4 className="font-medium">预算管理优化</h4>
                    <p className="text-sm text-gray-600 mt-1 mb-3">
                      预测本月成本将超出预算15%，建议对非关键拼车组启用成本限制
                    </p>
                    <Button variant="outline" size="sm">查看详情</Button>
                  </div>
                </div>
                
                <div className="flex items-start space-x-4">
                  <div className="w-2 h-2 bg-orange-500 rounded-full mt-2"></div>
                  <div>
                    <h4 className="font-medium">服务健康监控</h4>
                    <p className="text-sm text-gray-600 mt-1 mb-3">
                      建议为通义千问服务设置响应时间告警阈值（3秒），以便及时处理性能问题
                    </p>
                    <Button variant="outline" size="sm">配置告警</Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
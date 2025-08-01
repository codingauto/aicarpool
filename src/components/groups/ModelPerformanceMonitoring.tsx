'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts';
import { Activity, Clock, CheckCircle, AlertTriangle, RefreshCw, TrendingUp, TrendingDown } from 'lucide-react';

interface ModelMetric {
  id: string;
  modelId: string;
  metricType: 'response_time' | 'success_rate' | 'error_rate' | 'health_score';
  value: number;
  unit: string;
  windowStart: string;
  windowEnd: string;
  sampleCount: number;
  tags?: Record<string, any>;
}

interface MetricsSummary {
  responseTime: {
    average: number | null;
    min: number | null;
    max: number | null;
    count: number;
    unit: string;
  };
  successRate: {
    average: number | null;
    count: number;
    unit: string;
  };
  errorRate: {
    average: number | null;
    count: number;
    unit: string;
  };
  healthScore: {
    average: number | null;
    count: number;
    unit: string;
  };
}

interface MetricsData {
  metrics: ModelMetric[];
  summary: MetricsSummary;
  availableModels: string[];
  query: {
    timeRange: string;
    modelId?: string;
    metricType?: string;
  };
  totalCount: number;
}

interface ModelPerformanceMonitoringProps {
  groupId: string;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

export function ModelPerformanceMonitoring({ groupId }: ModelPerformanceMonitoringProps) {
  const [metricsData, setMetricsData] = useState<MetricsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedModel, setSelectedModel] = useState<string>('all');
  const [timeRange, setTimeRange] = useState('24h');
  const [metricType, setMetricType] = useState('all');

  const fetchMetrics = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const params = new URLSearchParams({
        timeRange,
        ...(selectedModel !== 'all' && { modelId: selectedModel }),
        ...(metricType !== 'all' && { metricType }),
        limit: '100',
      });

      const response = await fetch(`/api/groups/${groupId}/model-metrics?${params}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();
      if (data.success) {
        setMetricsData(data.data);
        setError('');
      } else {
        setError(data.error || '获取性能指标失败');
      }
    } catch (error) {
      console.error('获取性能指标失败:', error);
      setError('获取性能指标失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
  }, [groupId, selectedModel, timeRange, metricType]);

  const prepareChartData = () => {
    if (!metricsData) return { responseTimeData: [], successRateData: [], modelDistribution: [] };

    // 按时间分组的响应时间数据
    const responseTimeData = metricsData.metrics
      .filter(m => m.metricType === 'response_time')
      .map(m => ({
        time: new Date(m.windowStart).toLocaleString(),
        [m.modelId]: m.value,
        timestamp: new Date(m.windowStart).getTime(),
      }))
      .sort((a, b) => a.timestamp - b.timestamp);

    // 按时间分组的成功率数据
    const successRateData = metricsData.metrics
      .filter(m => m.metricType === 'success_rate')
      .map(m => ({
        time: new Date(m.windowStart).toLocaleString(),
        [m.modelId]: m.value,
        timestamp: new Date(m.windowStart).getTime(),
      }))
      .sort((a, b) => a.timestamp - b.timestamp);

    // 模型使用分布
    const modelUsage = metricsData.metrics.reduce((acc, m) => {
      acc[m.modelId] = (acc[m.modelId] || 0) + m.sampleCount;
      return acc;
    }, {} as Record<string, number>);

    const modelDistribution = Object.entries(modelUsage).map(([model, count], index) => ({
      name: model,
      value: count,
      fill: COLORS[index % COLORS.length],
    }));

    return { responseTimeData, successRateData, modelDistribution };
  };

  const { responseTimeData, successRateData, modelDistribution } = prepareChartData();

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="text-center py-8">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4" />
          <div className="text-gray-500">加载性能数据中...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">性能监控</h2>
          <p className="text-gray-600">多模型性能指标和趋势分析</p>
        </div>
        <Button onClick={fetchMetrics} variant="outline">
          <RefreshCw className="w-4 h-4 mr-2" />
          刷新数据
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* 筛选器 */}
      <Card>
        <CardHeader>
          <CardTitle>数据筛选</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <div>
              <label className="text-sm font-medium">时间范围</label>
              <Select value={timeRange} onValueChange={setTimeRange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1h">过去1小时</SelectItem>
                  <SelectItem value="6h">过去6小时</SelectItem>
                  <SelectItem value="24h">过去24小时</SelectItem>
                  <SelectItem value="7d">过去7天</SelectItem>
                  <SelectItem value="30d">过去30天</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">模型</label>
              <Select value={selectedModel} onValueChange={setSelectedModel}>
                <SelectTrigger>
                  <SelectValue placeholder="所有模型" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">所有模型</SelectItem>
                  {metricsData?.availableModels.map(model => (
                    <SelectItem key={model} value={model}>{model}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">指标类型</label>
              <Select value={metricType} onValueChange={setMetricType}>
                <SelectTrigger>
                  <SelectValue placeholder="所有指标" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">所有指标</SelectItem>
                  <SelectItem value="response_time">响应时间</SelectItem>
                  <SelectItem value="success_rate">成功率</SelectItem>
                  <SelectItem value="error_rate">错误率</SelectItem>
                  <SelectItem value="health_score">健康分数</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 汇总统计 */}
      <div className="grid gap-6 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">平均响应时间</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {metricsData?.summary.responseTime.average ? 
                `${Math.round(metricsData.summary.responseTime.average)}ms` : 
                'N/A'
              }
            </div>
            <p className="text-xs text-muted-foreground">
              {metricsData?.summary.responseTime.count || 0} 个样本
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">平均成功率</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {metricsData?.summary.successRate.average ? 
                `${metricsData.summary.successRate.average.toFixed(1)}%` : 
                'N/A'
              }
            </div>
            <p className="text-xs text-muted-foreground">
              {metricsData?.summary.successRate.count || 0} 个样本
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">平均错误率</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {metricsData?.summary.errorRate.average ? 
                `${metricsData.summary.errorRate.average.toFixed(1)}%` : 
                'N/A'
              }
            </div>
            <p className="text-xs text-muted-foreground">
              {metricsData?.summary.errorRate.count || 0} 个样本
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">平均健康分数</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {metricsData?.summary.healthScore.average ? 
                Math.round(metricsData.summary.healthScore.average) : 
                'N/A'
              }
            </div>
            <p className="text-xs text-muted-foreground">
              {metricsData?.summary.healthScore.count || 0} 个样本
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 图表展示 */}
      <Tabs defaultValue="response-time" className="space-y-6">
        <TabsList>
          <TabsTrigger value="response-time">响应时间趋势</TabsTrigger>
          <TabsTrigger value="success-rate">成功率趋势</TabsTrigger>
          <TabsTrigger value="distribution">模型使用分布</TabsTrigger>
          <TabsTrigger value="comparison">模型对比</TabsTrigger>
        </TabsList>

        <TabsContent value="response-time">
          <Card>
            <CardHeader>
              <CardTitle>响应时间趋势</CardTitle>
              <CardDescription>各模型的响应时间变化趋势</CardDescription>
            </CardHeader>
            <CardContent>
              {responseTimeData.length > 0 ? (
                <ResponsiveContainer width="100%" height={400}>
                  <LineChart data={responseTimeData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="time" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    {metricsData?.availableModels.map((model, index) => (
                      <Line
                        key={model}
                        type="monotone"
                        dataKey={model}
                        stroke={COLORS[index % COLORS.length]}
                        strokeWidth={2}
                        connectNulls={false}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  暂无响应时间数据
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="success-rate">
          <Card>
            <CardHeader>
              <CardTitle>成功率趋势</CardTitle>
              <CardDescription>各模型的成功率变化趋势</CardDescription>
            </CardHeader>
            <CardContent>
              {successRateData.length > 0 ? (
                <ResponsiveContainer width="100%" height={400}>
                  <LineChart data={successRateData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="time" />
                    <YAxis domain={[0, 100]} />
                    <Tooltip />
                    <Legend />
                    {metricsData?.availableModels.map((model, index) => (
                      <Line
                        key={model}
                        type="monotone"
                        dataKey={model}
                        stroke={COLORS[index % COLORS.length]}
                        strokeWidth={2}
                        connectNulls={false}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  暂无成功率数据
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="distribution">
          <Card>
            <CardHeader>
              <CardTitle>模型使用分布</CardTitle>
              <CardDescription>各模型的使用频率分布</CardDescription>
            </CardHeader>
            <CardContent>
              {modelDistribution.length > 0 ? (
                <div className="grid gap-6 md:grid-cols-2">
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={modelDistribution}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {modelDistribution.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                  <div>
                    <h4 className="font-medium mb-4">使用统计</h4>
                    <div className="space-y-2">
                      {modelDistribution.map(item => (
                        <div key={item.name} className="flex items-center justify-between">
                          <div className="flex items-center">
                            <div
                              className="w-3 h-3 rounded mr-2"
                              style={{ backgroundColor: item.fill }}
                            />
                            <span className="text-sm">{item.name}</span>
                          </div>
                          <span className="text-sm font-medium">{item.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  暂无使用分布数据
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="comparison">
          <Card>
            <CardHeader>
              <CardTitle>模型性能对比</CardTitle>
              <CardDescription>各模型的综合性能对比</CardDescription>
            </CardHeader>
            <CardContent>
              {metricsData && metricsData.availableModels.length > 0 ? (
                <div className="space-y-4">
                  {metricsData.availableModels.map(model => {
                    const modelMetrics = metricsData.metrics.filter(m => m.modelId === model);
                    const avgResponseTime = modelMetrics
                      .filter(m => m.metricType === 'response_time')
                      .reduce((sum, m, _, arr) => sum + m.value / arr.length, 0);
                    const avgSuccessRate = modelMetrics
                      .filter(m => m.metricType === 'success_rate')
                      .reduce((sum, m, _, arr) => sum + m.value / arr.length, 0);
                    const avgHealthScore = modelMetrics
                      .filter(m => m.metricType === 'health_score')
                      .reduce((sum, m, _, arr) => sum + m.value / arr.length, 0);

                    return (
                      <div key={model} className="border rounded-lg p-4">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="font-medium">{model}</h4>
                          <Badge variant={avgHealthScore > 80 ? 'default' : 'secondary'}>
                            健康分数: {Math.round(avgHealthScore) || 'N/A'}
                          </Badge>
                        </div>
                        <div className="grid gap-3 md:grid-cols-3">
                          <div className="text-center">
                            <div className="text-sm text-gray-600">平均响应时间</div>
                            <div className="text-lg font-semibold">
                              {avgResponseTime ? `${Math.round(avgResponseTime)}ms` : 'N/A'}
                            </div>
                          </div>
                          <div className="text-center">
                            <div className="text-sm text-gray-600">平均成功率</div>
                            <div className="text-lg font-semibold">
                              {avgSuccessRate ? `${avgSuccessRate.toFixed(1)}%` : 'N/A'}
                            </div>
                          </div>
                          <div className="text-center">
                            <div className="text-sm text-gray-600">使用次数</div>
                            <div className="text-lg font-semibold">
                              {modelMetrics.reduce((sum, m) => sum + m.sampleCount, 0)}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  暂无模型对比数据
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
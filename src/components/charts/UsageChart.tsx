'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  BarChart3, 
  TrendingUp, 
  DollarSign, 
  Activity,
  Calendar,
  Clock,
  Users,
  Zap
} from 'lucide-react';

interface UsageData {
  date: string;
  tokens: number;
  cost: number;
  requests: number;
  responseTime: number;
  successRate: number;
}

interface ServiceUsage {
  serviceType: string;
  tokens: number;
  cost: number;
  requests: number;
  percentage: number;
}

interface UsageChartProps {
  groupId: string;
  timeRange?: '7d' | '30d' | '90d';
  showServiceBreakdown?: boolean;
  isEnterprise?: boolean; // 是否为企业级分析
}

export function UsageChart({ groupId, timeRange = '7d', showServiceBreakdown = true, isEnterprise = false }: UsageChartProps) {
  const [selectedTimeRange, setSelectedTimeRange] = useState(timeRange);
  const [usageData, setUsageData] = useState<UsageData[]>([]);
  const [serviceUsage, setServiceUsage] = useState<ServiceUsage[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  // 模拟数据生成
  useEffect(() => {
    const generateMockData = () => {
      const days = selectedTimeRange === '7d' ? 7 : selectedTimeRange === '30d' ? 30 : 90;
      const data: UsageData[] = [];
      
      for (let i = days - 1; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        
        data.push({
          date: date.toISOString().split('T')[0],
          tokens: Math.floor(Math.random() * 10000) + 5000,
          cost: Math.floor(Math.random() * 100) + 20,
          requests: Math.floor(Math.random() * 500) + 100,
          responseTime: Math.floor(Math.random() * 1000) + 500,
          successRate: Math.floor(Math.random() * 10) + 90
        });
      }
      
      setUsageData(data);

      // 模拟服务使用数据
      const services: ServiceUsage[] = [
        { serviceType: 'OpenAI', tokens: 25000, cost: 350, requests: 1200, percentage: 45 },
        { serviceType: 'Claude', tokens: 18000, cost: 280, requests: 850, percentage: 32 },
        { serviceType: 'Gemini', tokens: 8000, cost: 120, requests: 400, percentage: 15 },
        { serviceType: '千帆', tokens: 4500, cost: 80, requests: 250, percentage: 8 }
      ];
      
      setServiceUsage(services);
      setLoading(false);
    };

    generateMockData();
  }, [selectedTimeRange]);

  const totalTokens = usageData.reduce((sum, day) => sum + day.tokens, 0);
  const totalCost = usageData.reduce((sum, day) => sum + day.cost, 0);
  const totalRequests = usageData.reduce((sum, day) => sum + day.requests, 0);
  const avgResponseTime = Math.floor(usageData.reduce((sum, day) => sum + day.responseTime, 0) / usageData.length);
  const avgSuccessRate = Math.floor(usageData.reduce((sum, day) => sum + day.successRate, 0) / usageData.length);

  const getTimeRangeLabel = (range: string) => {
    switch (range) {
      case '7d': return '最近7天';
      case '30d': return '最近30天';
      case '90d': return '最近90天';
      default: return '最近7天';
    }
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  };

  const getServiceIcon = (serviceType: string) => {
    switch (serviceType) {
      case 'OpenAI': return '🤖';
      case 'Claude': return '🧠';
      case 'Gemini': return '💎';
      case '千帆': return '⛵';
      default: return '🔧';
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-gray-200 rounded w-1/4"></div>
            <div className="h-64 bg-gray-200 rounded"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* 控制面板 */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>使用统计分析</CardTitle>
              <CardDescription>
                {isEnterprise ? '企业级AI服务使用情况分析' : '拼车组AI服务使用情况分析'}
              </CardDescription>
            </div>
            <Select value={selectedTimeRange} onValueChange={setSelectedTimeRange}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7d">最近7天</SelectItem>
                <SelectItem value="30d">最近30天</SelectItem>
                <SelectItem value="90d">最近90天</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
      </Card>

      {/* 概览统计 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-gray-600">总Token数</div>
                <div className="text-2xl font-bold text-blue-600">{formatNumber(totalTokens)}</div>
                <div className="text-xs text-gray-500">{getTimeRangeLabel(selectedTimeRange)}</div>
              </div>
              <Zap className="w-8 h-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-gray-600">总费用</div>
                <div className="text-2xl font-bold text-green-600">${totalCost.toFixed(0)}</div>
                <div className="text-xs text-gray-500">平均 ${(totalCost / usageData.length).toFixed(1)}/天</div>
              </div>
              <DollarSign className="w-8 h-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-gray-600">总请求数</div>
                <div className="text-2xl font-bold text-purple-600">{formatNumber(totalRequests)}</div>
                <div className="text-xs text-gray-500">平均 {Math.floor(totalRequests / usageData.length)}/天</div>
              </div>
              <BarChart3 className="w-8 h-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-gray-600">平均响应</div>
                <div className="text-2xl font-bold text-orange-600">{avgResponseTime}ms</div>
                <div className="text-xs text-gray-500">响应时间</div>
              </div>
              <Clock className="w-8 h-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-gray-600">成功率</div>
                <div className="text-2xl font-bold text-red-600">{avgSuccessRate}%</div>
                <div className="text-xs text-gray-500">请求成功率</div>
              </div>
              <Activity className="w-8 h-8 text-red-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 详细图表 */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">趋势概览</TabsTrigger>
          <TabsTrigger value="services">服务分布</TabsTrigger>
          <TabsTrigger value="performance">性能分析</TabsTrigger>
          <TabsTrigger value="cost">成本分析</TabsTrigger>
        </TabsList>

        {/* 趋势概览 */}
        <TabsContent value="overview" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>使用趋势</CardTitle>
              <CardDescription>Token使用量、请求数和费用的趋势变化</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-64 flex items-center justify-center border-2 border-dashed border-gray-200 rounded-lg">
                <div className="text-center text-gray-500">
                  <BarChart3 className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                  <p>趋势图表组件</p>
                  <p className="text-sm">需要集成图表库 (如 Chart.js 或 Recharts)</p>
                </div>
              </div>
              
              {/* 简化的趋势数据表格 */}
              <div className="mt-6 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="p-2 text-left">日期</th>
                      <th className="p-2 text-right">Token数</th>
                      <th className="p-2 text-right">请求数</th>
                      <th className="p-2 text-right">费用</th>
                      <th className="p-2 text-right">成功率</th>
                    </tr>
                  </thead>
                  <tbody>
                    {usageData.slice(-7).map((day, index) => (
                      <tr key={index} className="border-t">
                        <td className="p-2">{new Date(day.date).toLocaleDateString()}</td>
                        <td className="p-2 text-right">{formatNumber(day.tokens)}</td>
                        <td className="p-2 text-right">{day.requests}</td>
                        <td className="p-2 text-right">${day.cost.toFixed(2)}</td>
                        <td className="p-2 text-right">
                          <Badge variant={day.successRate >= 95 ? 'default' : 'secondary'}>
                            {day.successRate}%
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 服务分布 */}
        <TabsContent value="services" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>AI服务使用分布</CardTitle>
              <CardDescription>各AI服务提供商的使用情况对比</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {serviceUsage.map((service, index) => (
                  <div key={index} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{getServiceIcon(service.serviceType)}</span>
                        <span className="font-medium">{service.serviceType}</span>
                        <Badge variant="outline">{service.percentage}%</Badge>
                      </div>
                      <div className="text-sm text-gray-600">
                        {formatNumber(service.tokens)} tokens · ${service.cost} · {service.requests} 请求
                      </div>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-gradient-to-r from-blue-500 to-blue-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${service.percentage}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center p-4 bg-blue-50 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">{serviceUsage.length}</div>
                  <div className="text-sm text-gray-600">使用的服务</div>
                </div>
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">
                    {serviceUsage.find(s => s.serviceType === 'OpenAI')?.percentage || 0}%
                  </div>
                  <div className="text-sm text-gray-600">主要服务占比</div>
                </div>
                <div className="text-center p-4 bg-purple-50 rounded-lg">
                  <div className="text-2xl font-bold text-purple-600">
                    ${(totalCost / totalTokens * 1000).toFixed(3)}
                  </div>
                  <div className="text-sm text-gray-600">每千Token成本</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 性能分析 */}
        <TabsContent value="performance" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>性能指标分析</CardTitle>
              <CardDescription>响应时间和成功率的详细分析</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-medium mb-4">响应时间分布</h4>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm">&lt; 500ms</span>
                      <div className="flex items-center gap-2">
                        <div className="w-20 bg-gray-200 rounded-full h-2">
                          <div className="bg-green-500 h-2 rounded-full" style={{ width: '25%' }}></div>
                        </div>
                        <span className="text-sm">25%</span>
                      </div>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm">500ms - 1s</span>
                      <div className="flex items-center gap-2">
                        <div className="w-20 bg-gray-200 rounded-full h-2">
                          <div className="bg-yellow-500 h-2 rounded-full" style={{ width: '45%' }}></div>
                        </div>
                        <span className="text-sm">45%</span>
                      </div>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm">1s - 2s</span>
                      <div className="flex items-center gap-2">
                        <div className="w-20 bg-gray-200 rounded-full h-2">
                          <div className="bg-orange-500 h-2 rounded-full" style={{ width: '25%' }}></div>
                        </div>
                        <span className="text-sm">25%</span>
                      </div>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm">&gt; 2s</span>
                      <div className="flex items-center gap-2">
                        <div className="w-20 bg-gray-200 rounded-full h-2">
                          <div className="bg-red-500 h-2 rounded-full" style={{ width: '5%' }}></div>
                        </div>
                        <span className="text-sm">5%</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="font-medium mb-4">成功率统计</h4>
                  <div className="space-y-3">
                    {serviceUsage.map((service, index) => (
                      <div key={index} className="flex justify-between items-center">
                        <span className="text-sm">{service.serviceType}</span>
                        <div className="flex items-center gap-2">
                          <div className="w-20 bg-gray-200 rounded-full h-2">
                            <div 
                              className="bg-green-500 h-2 rounded-full" 
                              style={{ width: `${95 + Math.floor(Math.random() * 5)}%` }}
                            ></div>
                          </div>
                          <span className="text-sm">{95 + Math.floor(Math.random() * 5)}%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 成本分析 */}
        <TabsContent value="cost" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>成本效益分析</CardTitle>
              <CardDescription>AI服务使用成本的详细分析和优化建议</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {/* 成本构成 */}
                <div>
                  <h4 className="font-medium mb-4">成本构成分析</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {serviceUsage.map((service, index) => (
                      <div key={index} className="p-4 border rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span>{getServiceIcon(service.serviceType)}</span>
                            <span className="font-medium">{service.serviceType}</span>
                          </div>
                          <Badge variant="outline">${service.cost}</Badge>
                        </div>
                        <div className="text-sm text-gray-600">
                          <div>每千Token: ${(service.cost / service.tokens * 1000).toFixed(3)}</div>
                          <div>使用量: {formatNumber(service.tokens)} tokens</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 成本趋势和建议 */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="font-medium mb-4">成本趋势</h4>
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-green-600 mb-2">
                          ↓ 15%
                        </div>
                        <div className="text-sm text-gray-600">
                          相比上月成本下降15%
                        </div>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-medium mb-4">优化建议</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2 p-2 bg-blue-50 rounded">
                        <TrendingUp className="w-4 h-4 text-blue-600" />
                        <span>考虑增加低成本模型的使用比例</span>
                      </div>
                      <div className="flex items-center gap-2 p-2 bg-green-50 rounded">
                        <DollarSign className="w-4 h-4 text-green-600" />
                        <span>当前成本效率处于良好水平</span>
                      </div>
                    </div>
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
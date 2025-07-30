'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { StatsOverviewCards } from './stats-overview-cards';
import { TokenDistributionChart } from './token-distribution-chart';
import { UsageTrendChart } from './usage-trend-chart';
import { DetailedStatsTable } from './detailed-stats-table';
import { TimeRangeSelector } from './time-range-selector';
import { 
  RefreshCw, 
  TrendingUp,
  BarChart3,
  PieChart,
  Table,
  Download,
  AlertTriangle
} from 'lucide-react';

interface EnhancedUsageStatsData {
  overview: {
    totalApiKeys: number;
    totalUsers: number;
    todayRequests: number;
    systemStatus: 'normal' | 'warning' | 'error';
    totalTokens: string;
    totalCost: number;
    avgRPM: number;
    avgTPM: number;
  };
  distribution: Array<{
    service: string;
    tokens: number;
    percentage: number;
    cost: number;
    color: string;
  }>;
  tokenTrends: Array<{
    date: string;
    inputTokens?: number;
    outputTokens?: number;
    totalTokens: number;
    requests: number;
    cost: number;
  }>;
  apiKeyTrends: Array<{
    date: string;
    usage: number;
  }>;
  detailedStats: Array<{
    model: string;
    requests: number;
    tokens: string;
    cost: string;
    percentage: string;
  }>;
  memberUsage?: Array<{
    userId: string;
    userName: string;
    tokens: string;
    cost: string;
    percentage: string;
  }>;
}

interface EnhancedUsageStatsProps {
  apiEndpoint?: string; // 默认为 /api/user/usage-stats
  groupId?: string; // 如果提供，使用拼车组API
  title?: string;
  showMemberUsage?: boolean;
}

export function EnhancedUsageStats({ 
  apiEndpoint,
  groupId,
  title = "使用统计分析",
  showMemberUsage = false
}: EnhancedUsageStatsProps) {
  
  const [data, setData] = useState<EnhancedUsageStatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [timeRange, setTimeRange] = useState({ option: '7d' as const });
  const [activeTab, setActiveTab] = useState('overview');

  // 确定使用的API端点
  const getApiEndpoint = () => {
    if (apiEndpoint) return apiEndpoint;
    if (groupId) return `/api/groups/${groupId}/usage-stats`;
    return '/api/user/usage-stats';
  };

  const fetchStats = async () => {
    setLoading(true);
    setError('');

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setError('用户未登录');
        return;
      }

      // 构建查询参数
      const params = new URLSearchParams();
      
      if (timeRange.option === 'custom' && timeRange.startDate && timeRange.endDate) {
        const start = new Date(timeRange.startDate);
        const end = new Date(timeRange.endDate);
        const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
        params.append('days', days.toString());
      } else {
        const daysMap = {
          '1d': '1',
          '7d': '7', 
          '30d': '30',
          '90d': '90'
        };
        params.append('days', daysMap[timeRange.option] || '7');
      }

      const response = await fetch(`${getApiEndpoint()}?${params}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const result = await response.json();

      if (result.success) {
        setData(result.data);
      } else {
        setError(result.error || '获取统计数据失败');
      }
    } catch (error) {
      console.error('Fetch stats error:', error);
      setError('网络错误，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  const handleExportData = () => {
    if (!data) return;
    
    // 导出JSON格式的完整数据
    const exportData = {
      exportTime: new Date().toISOString(),
      timeRange,
      ...data
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { 
      type: 'application/json' 
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `usage-stats-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    fetchStats();
  }, [timeRange, groupId]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <BarChart3 className="w-5 h-5" />
            <span>{title}</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <div className="text-gray-600">加载统计数据中...</div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <AlertTriangle className="w-5 h-5 text-red-500" />
            <span>{title}</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12">
            <div className="text-red-500 mb-4">{error}</div>
            <Button onClick={fetchStats} variant="outline">
              <RefreshCw className="w-4 h-4 mr-2" />
              重试
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12 text-gray-500">
            暂无统计数据
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* 头部控制区域 */}
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
            <div>
              <CardTitle className="flex items-center space-x-2">
                <BarChart3 className="w-5 h-5" />
                <span>{title}</span>
              </CardTitle>
              <CardDescription>
                {groupId ? '拼车组使用情况的详细统计和分析' : '您的AI服务使用情况详细统计和分析'}
              </CardDescription>
            </div>
            <div className="flex flex-col md:flex-row items-stretch md:items-center space-y-2 md:space-y-0 md:space-x-3">
              <TimeRangeSelector
                value={timeRange}
                onChange={setTimeRange}
              />
              <div className="flex space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={fetchStats}
                  className="flex items-center space-x-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>刷新</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportData}
                  className="flex items-center space-x-2"
                >
                  <Download className="w-4 h-4" />
                  <span>导出</span>
                </Button>
              </div>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* 概览统计卡片 */}
      <StatsOverviewCards 
        data={data.overview} 
        isGroupStats={!!groupId}
      />

      {/* 详细统计标签页 */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview" className="flex items-center space-x-2">
            <TrendingUp className="w-4 h-4" />
            <span>趋势分析</span>
          </TabsTrigger>
          <TabsTrigger value="distribution" className="flex items-center space-x-2">
            <PieChart className="w-4 h-4" />
            <span>使用分布</span>
          </TabsTrigger>
          <TabsTrigger value="detailed" className="flex items-center space-x-2">
            <Table className="w-4 h-4" />
            <span>详细统计</span>
          </TabsTrigger>
          {showMemberUsage && data.memberUsage && (
            <TabsTrigger value="members" className="flex items-center space-x-2">
              <BarChart3 className="w-4 h-4" />
              <span>成员使用</span>
            </TabsTrigger>
          )}
        </TabsList>

        {/* 趋势分析 */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <UsageTrendChart 
              data={data.tokenTrends} 
              title="Token使用趋势"
            />
            <UsageTrendChart 
              data={data.apiKeyTrends.map(item => ({
                date: item.date,
                totalTokens: item.usage,
                requests: item.usage,
                cost: 0
              }))} 
              title="API Keys使用趋势"
              showAllMetrics={false}
            />
          </div>
        </TabsContent>

        {/* 使用分布 */}
        <TabsContent value="distribution">
          <TokenDistributionChart 
            data={data.distribution}
            title="Token使用分布分析"
          />
        </TabsContent>

        {/* 详细统计 */}
        <TabsContent value="detailed">
          <DetailedStatsTable 
            data={data.detailedStats}
            title="模型使用详细统计"
            onRefresh={fetchStats}
          />
        </TabsContent>

        {/* 成员使用（仅拼车组） */}
        {showMemberUsage && data.memberUsage && (
          <TabsContent value="members">
            <DetailedStatsTable 
              data={data.memberUsage.map(member => ({
                model: member.userName,
                requests: 0,
                tokens: member.tokens,
                cost: member.cost,
                percentage: member.percentage
              }))}
              title="成员使用统计"
              onRefresh={fetchStats}
            />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
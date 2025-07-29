'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface UsageStatsData {
  period: {
    days: number;
    startDate: string;
    endDate: string;
  };
  total: {
    tokenCount: string;
    cost: number;
    requestCount: number;
    avgResponseTime: number;
  };
  daily: Array<{
    date: string;
    tokenCount: string;
    cost: number;
    requestCount: number;
    avgResponseTime: number;
  }>;
  byService: Array<{
    aiServiceId: string;
    serviceName: string;
    displayName: string;
    tokenCount: string;
    cost: number;
    requestCount: number;
    avgResponseTime: number;
  }>;
}

export function UsageStats() {
  const [stats, setStats] = useState<UsageStatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [period, setPeriod] = useState('30');

  const fetchStats = async () => {
    setLoading(true);
    setError('');

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/user/usage-stats?days=${period}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (data.success) {
        setStats(data.data);
      } else {
        setError(data.error || '获取统计数据失败');
      }
    } catch (error) {
      setError('网络错误，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, [period]);

  const formatTokenCount = (tokenCount: string) => {
    const count = parseInt(tokenCount);
    if (count >= 1000000) {
      return `${(count / 1000000).toFixed(1)}M`;
    } else if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}K`;
    }
    return count.toString();
  };

  const formatCost = (cost: number) => {
    return `¥${cost.toFixed(4)}`;
  };

  const formatResponseTime = (time: number) => {
    return `${Math.round(time)}ms`;
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>使用统计</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <div className="text-gray-500">加载中...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>使用统计</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <div className="text-red-500">{error}</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!stats || !stats.total) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* 总体统计 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>使用统计</CardTitle>
              <CardDescription>您的AI服务使用情况</CardDescription>
            </div>
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">最近7天</SelectItem>
                <SelectItem value="30">最近30天</SelectItem>
                <SelectItem value="90">最近90天</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {stats.total?.tokenCount ? formatTokenCount(stats.total.tokenCount) : '0'}
              </div>
              <div className="text-sm text-gray-600">总Token数</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {stats.total?.cost ? formatCost(stats.total.cost) : '¥0.0000'}
              </div>
              <div className="text-sm text-gray-600">总费用</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">
                {stats.total?.requestCount || 0}
              </div>
              <div className="text-sm text-gray-600">请求次数</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">
                {stats.total?.avgResponseTime ? formatResponseTime(stats.total.avgResponseTime) : '0ms'}
              </div>
              <div className="text-sm text-gray-600">平均响应时间</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 按服务统计 */}
      {stats.byService && stats.byService.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>按AI服务统计</CardTitle>
            <CardDescription>不同AI服务的使用情况</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {stats.byService.map((service) => (
                <div key={service.aiServiceId} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center space-x-3">
                    <Badge variant="outline">{service.displayName}</Badge>
                    <div className="text-sm text-gray-600">
                      {service.requestCount} 次请求
                    </div>
                  </div>
                  <div className="flex items-center space-x-4 text-sm">
                    <div>
                      <span className="text-blue-600 font-semibold">
                        {formatTokenCount(service.tokenCount)}
                      </span>
                      <span className="text-gray-600 ml-1">tokens</span>
                    </div>
                    <div>
                      <span className="text-green-600 font-semibold">
                        {formatCost(service.cost)}
                      </span>
                    </div>
                    <div>
                      <span className="text-orange-600 font-semibold">
                        {formatResponseTime(service.avgResponseTime)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 最近使用情况 */}
      {stats.daily && stats.daily.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>最近使用趋势</CardTitle>
            <CardDescription>每日使用情况</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {stats.daily.slice(0, 7).map((day) => (
                <div key={day.date} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="font-medium">
                    {new Date(day.date).toLocaleDateString('zh-CN', { 
                      month: 'short', 
                      day: 'numeric' 
                    })}
                  </div>
                  <div className="flex items-center space-x-4 text-sm">
                    <div className="text-blue-600">
                      {formatTokenCount(day.tokenCount)} tokens
                    </div>
                    <div className="text-green-600">
                      {formatCost(day.cost)}
                    </div>
                    <div className="text-purple-600">
                      {day.requestCount} 次
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
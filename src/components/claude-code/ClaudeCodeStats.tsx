/**
 * Claude Code 统计面板组件
 */
'use client';
import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import {
  Users,
  MessageSquare,
  Zap,
  Clock,
  TrendingUp,
  AlertCircle,
  RefreshCw
} from 'lucide-react';

interface ClaudeCodeStatsProps {
  stats: any;
  onRefresh: () => void;
}

export function ClaudeCodeStats({ stats, onRefresh }: ClaudeCodeStatsProps) {
  const [timeRange, setTimeRange] = useState('7d');
  const [loading, setLoading] = useState(false);

  const handleRefresh = async () => {
    setLoading(true);
    await onRefresh();
    setLoading(false);
  };

  const handleTimeRangeChange = async (value: string) => {
    setTimeRange(value);
    setLoading(true);
    try {
      const response = await fetch(`/api/claude-code/stats?timeRange=${value}`);
      if (response.ok) {
        const data = await response.json();
        // 这里需要更新父组件的状态
        // 实际实现中可能需要回调函数
      }
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!stats) {
    return (
      <Card className="p-6">
        <div className="text-center text-gray-500">
          暂无统计数据
        </div>
      </Card>
    );
  }

  const { overview, timeSeries, distribution, errors, topUsers } = stats;

  return (
    <div className="space-y-6">
      {/* 顶部控制栏 */}
      <div className="flex justify-between items-center">
        <div className="flex items-center space-x-4">
          <Select 
            value={timeRange} 
            onValueChange={handleTimeRangeChange}
          >
            <option value="7d">最近 7 天</option>
            <option value="30d">最近 30 天</option>
            <option value="90d">最近 90 天</option>
          </Select>
        </div>
        <Button 
          onClick={handleRefresh} 
          disabled={loading}
          variant="outline"
          size="sm"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          刷新
        </Button>
      </div>

      {/* 关键指标卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">总用户数</p>
              <p className="text-2xl font-bold text-gray-900">
                {overview.totalUsers.toLocaleString()}
              </p>
              <p className="text-sm text-green-600">
                活跃: {overview.activeUsers}
              </p>
            </div>
            <Users className="h-8 w-8 text-blue-600" />
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">总请求数</p>
              <p className="text-2xl font-bold text-gray-900">
                {overview.totalRequests.toLocaleString()}
              </p>
              <p className="text-sm text-green-600">
                成功率: {overview.successRate}%
              </p>
            </div>
            <MessageSquare className="h-8 w-8 text-green-600" />
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">总 Tokens</p>
              <p className="text-2xl font-bold text-gray-900">
                {(overview.totalTokens / 1000000).toFixed(1)}M
              </p>
              <p className="text-sm text-gray-500">
                输入: {(overview.inputTokens / 1000).toFixed(0)}K | 
                输出: {(overview.outputTokens / 1000).toFixed(0)}K
              </p>
            </div>
            <Zap className="h-8 w-8 text-yellow-600" />
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">平均响应时间</p>
              <p className="text-2xl font-bold text-gray-900">
                {overview.averageResponseTime}ms
              </p>
              <p className="text-sm text-gray-500">
                最近 {timeRange}
              </p>
            </div>
            <Clock className="h-8 w-8 text-purple-600" />
          </div>
        </Card>
      </div>

      {/* 图表和分布 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 模型使用分布 */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">模型使用分布</h3>
          <div className="space-y-3">
            {distribution.models.slice(0, 5).map((model: any, index: number) => (
              <div key={model.model} className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className={`w-3 h-3 rounded-full bg-blue-${(index + 1) * 100}`} />
                  <span className="text-sm font-medium truncate max-w-[200px]">
                    {model.model}
                  </span>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium">{model.requests}</p>
                  <p className="text-xs text-gray-500">
                    {(model.tokens / 1000).toFixed(0)}K tokens
                  </p>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* 版本分布 */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">CLI 版本分布</h3>
          <div className="space-y-3">
            {distribution.versions.slice(0, 5).map((version: any, index: number) => (
              <div key={version.version} className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className={`w-3 h-3 rounded-full bg-green-${(index + 1) * 100}`} />
                  <span className="text-sm font-medium">{version.version}</span>
                </div>
                <span className="text-sm font-medium">{version.requests}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* 错误分析和顶级用户 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 错误分析 */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center">
            <AlertCircle className="h-5 w-5 mr-2 text-red-600" />
            错误分析
          </h3>
          {errors.length > 0 ? (
            <div className="space-y-3">
              {errors.slice(0, 5).map((error: any, index: number) => (
                <div key={index} className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 truncate max-w-[250px]">
                    {error.error}
                  </span>
                  <span className="text-sm font-medium text-red-600">
                    {error.count}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500">暂无错误记录</p>
          )}
        </Card>

        {/* 顶级用户 */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center">
            <TrendingUp className="h-5 w-5 mr-2 text-blue-600" />
            活跃用户 TOP 5
          </h3>
          <div className="space-y-3">
            {topUsers.slice(0, 5).map((user: any, index: number) => (
              <div key={user.id} className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                    <span className="text-xs font-medium text-blue-600">
                      #{index + 1}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-medium">
                      {user.displayName || user.email || user.id}
                    </p>
                    <p className="text-xs text-gray-500">
                      {user.requests} 请求
                    </p>
                  </div>
                </div>
                <span className="text-sm font-medium">
                  {(user.tokens / 1000).toFixed(0)}K tokens
                </span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
/**
 * AI服务使用统计仪表板
 * 展示多平台AI服务的使用情况和监控数据
 */

'use client';

import React, { useState, useEffect } from 'react';
import {
  ChartBarIcon,
  CpuChipIcon,
  BanknotesIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ArrowUpIcon,
  ArrowDownIcon
} from '@heroicons/react/24/outline';
import { ServiceType, getPlatformConfig } from '@/lib/ai-platforms/platform-configs';
import { AiServiceAccount } from '@/lib/ai-platforms/ai-service-client';

interface UsageStats {
  totalRequests: number;
  totalTokens: number;
  totalCost: number;
  avgResponseTime: number;
  errorRate: number;
  activeAccounts: number;
}

interface PlatformStats {
  serviceType: ServiceType;
  requests: number;
  tokens: number;
  cost: number;
  avgResponseTime: number;
  errorCount: number;
  accounts: number;
}

interface UsageDashboardProps {
  accounts: AiServiceAccount[];
  dateRange: {
    start: Date;
    end: Date;
  };
  onDateRangeChange: (range: { start: Date; end: Date }) => void;
}

export default function UsageDashboard({
  accounts,
  dateRange,
  onDateRangeChange
}: UsageDashboardProps) {
  const [loading, setLoading] = useState(true);
  const [overallStats, setOverallStats] = useState<UsageStats>({
    totalRequests: 0,
    totalTokens: 0,
    totalCost: 0,
    avgResponseTime: 0,
    errorRate: 0,
    activeAccounts: 0
  });
  const [platformStats, setPlatformStats] = useState<PlatformStats[]>([]);
  const [timeSeriesData, setTimeSeriesData] = useState<any[]>([]);

  useEffect(() => {
    loadUsageStats();
  }, [accounts, dateRange]);

  const loadUsageStats = async () => {
    setLoading(true);
    try {
      // 模拟数据加载
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // 模拟统计数据
      const mockOverallStats: UsageStats = {
        totalRequests: 15234,
        totalTokens: 2456789,
        totalCost: 234.56,
        avgResponseTime: 1450,
        errorRate: 2.3,
        activeAccounts: accounts.filter(a => a.isEnabled).length
      };

      // 模拟平台统计
      const mockPlatformStats: PlatformStats[] = Object.values(ServiceType).map(serviceType => {
        const accountCount = accounts.filter(a => a.serviceType === serviceType).length;
        return {
          serviceType,
          requests: Math.floor(Math.random() * 5000),
          tokens: Math.floor(Math.random() * 500000),
          cost: Math.random() * 100,
          avgResponseTime: Math.floor(Math.random() * 2000) + 500,
          errorCount: Math.floor(Math.random() * 50),
          accounts: accountCount
        };
      }).filter(stat => stat.accounts > 0);

      setOverallStats(mockOverallStats);
      setPlatformStats(mockPlatformStats);
    } catch (error) {
      console.error('Failed to load usage stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('zh-CN', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(amount);
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('zh-CN').format(num);
  };

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                <div className="h-4 bg-gray-200 rounded w-1/2 mb-4"></div>
                <div className="h-8 bg-gray-200 rounded w-3/4"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 头部和日期选择器 */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">使用统计</h2>
          <p className="mt-1 text-sm text-gray-500">
            AI服务使用情况总览和分析
          </p>
        </div>
        
        <div className="mt-4 sm:mt-0 flex space-x-3">
          <select 
            onChange={(e) => {
              const days = parseInt(e.target.value);
              const end = new Date();
              const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);
              onDateRangeChange({ start, end });
            }}
            className="border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="7">最近7天</option>
            <option value="30">最近30天</option>
            <option value="90">最近90天</option>
          </select>
        </div>
      </div>

      {/* 总览卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="总请求数"
          value={formatNumber(overallStats.totalRequests)}
          icon={<ChartBarIcon className="h-6 w-6" />}
          color="blue"
          change={+12.5}
        />
        <StatCard
          title="总Token数"
          value={formatNumber(overallStats.totalTokens)}
          icon={<CpuChipIcon className="h-6 w-6" />}
          color="green"
          change={+8.2}
        />
        <StatCard
          title="总成本"
          value={formatCurrency(overallStats.totalCost)}
          icon={<BanknotesIcon className="h-6 w-6" />}
          color="purple"
          change={-3.1}
        />
        <StatCard
          title="平均响应时间"
          value={formatDuration(overallStats.avgResponseTime)}
          icon={<ClockIcon className="h-6 w-6" />}
          color="orange"
          change={-5.7}
        />
      </div>

      {/* 账号状态总览 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h3 className="text-lg font-medium text-gray-900 mb-4">账号状态</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <CheckCircleIcon className="h-5 w-5 text-green-500 mr-2" />
                <span className="text-sm text-gray-700">活跃账号</span>
              </div>
              <span className="text-sm font-medium text-gray-900">
                {overallStats.activeAccounts} / {accounts.length}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <ExclamationTriangleIcon className="h-5 w-5 text-red-500 mr-2" />
                <span className="text-sm text-gray-700">错误率</span>
              </div>
              <span className="text-sm font-medium text-gray-900">
                {overallStats.errorRate}%
              </span>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h3 className="text-lg font-medium text-gray-900 mb-4">平台分布</h3>
          <div className="space-y-3">
            {platformStats.slice(0, 5).map((stat) => {
              const config = getPlatformConfig(stat.serviceType);
              const percentage = (stat.requests / overallStats.totalRequests * 100);
              
              return (
                <div key={stat.serviceType} className="flex items-center justify-between">
                  <div className="flex items-center">
                    <span className="text-lg mr-2">{getPlatformIcon(stat.serviceType)}</span>
                    <span className="text-sm text-gray-700">{config.displayName}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-16 bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-blue-600 h-2 rounded-full" 
                        style={{ width: `${Math.min(percentage, 100)}%` }}
                      />
                    </div>
                    <span className="text-sm font-medium text-gray-900 w-10 text-right">
                      {percentage.toFixed(1)}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 平台详细统计 */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">平台使用详情</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  平台
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  请求数
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Token数
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  成本
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  平均响应时间
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  错误数
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  账号数
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {platformStats.map((stat) => {
                const config = getPlatformConfig(stat.serviceType);
                return (
                  <tr key={stat.serviceType}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <span className="text-lg mr-2">{getPlatformIcon(stat.serviceType)}</span>
                        <span className="text-sm font-medium text-gray-900">
                          {config.displayName}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatNumber(stat.requests)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatNumber(stat.tokens)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatCurrency(stat.cost)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatDuration(stat.avgResponseTime)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        stat.errorCount > 10 ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
                      }`}>
                        {stat.errorCount}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {stat.accounts}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// 统计卡片组件
function StatCard({
  title,
  value,
  icon,
  color,
  change
}: {
  title: string;
  value: string;
  icon: React.ReactNode;
  color: 'blue' | 'green' | 'purple' | 'orange';
  change?: number;
}) {
  const colorClasses = {
    blue: 'text-blue-600 bg-blue-100',
    green: 'text-green-600 bg-green-100',
    purple: 'text-purple-600 bg-purple-100',
    orange: 'text-orange-600 bg-orange-100'
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
      <div className="flex items-center">
        <div className={`p-2 rounded-lg ${colorClasses[color]}`}>
          {icon}
        </div>
        <div className="ml-4 flex-1">
          <p className="text-sm font-medium text-gray-500">{title}</p>
          <div className="flex items-baseline">
            <p className="text-2xl font-semibold text-gray-900">{value}</p>
            {change !== undefined && (
              <div className={`ml-2 flex items-center text-sm ${
                change >= 0 ? 'text-green-600' : 'text-red-600'
              }`}>
                {change >= 0 ? (
                  <ArrowUpIcon className="h-4 w-4 mr-1" />
                ) : (
                  <ArrowDownIcon className="h-4 w-4 mr-1" />
                )}
                <span>{Math.abs(change)}%</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// 获取平台图标
function getPlatformIcon(serviceType: ServiceType): string {
  const icons = {
    [ServiceType.CLAUDE]: '🤖',
    [ServiceType.CLAUDE_CONSOLE]: '🔧',
    [ServiceType.OPENAI]: '🎯',
    [ServiceType.GEMINI]: '💎',
    [ServiceType.QWEN]: '🌟',
    [ServiceType.GLM]: '🧠',
    [ServiceType.KIMI]: '🌙',
    [ServiceType.WENXIN]: '🎨',
    [ServiceType.SPARK]: '⚡',
    [ServiceType.HUNYUAN]: '☁️',
    [ServiceType.MINIMAX]: '📏',
    [ServiceType.BAICHUAN]: '🏔️',
    [ServiceType.SENSETIME]: '👁️',
    [ServiceType.DOUBAO]: '🎁'
  };
  
  return icons[serviceType] || '🤖';
}
'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Key, 
  Users, 
  Activity, 
  CheckCircle,
  TrendingUp,
  DollarSign,
  BarChart3,
  Zap
} from 'lucide-react';

interface StatsOverviewData {
  totalApiKeys: number;
  totalUsers: number;
  todayRequests: number;
  systemStatus: 'normal' | 'warning' | 'error';
  totalTokens: string;
  totalCost: number;
  avgRPM: number;
  avgTPM: number;
}

interface StatsOverviewCardsProps {
  data: StatsOverviewData;
  isGroupStats?: boolean;
}

export function StatsOverviewCards({ data, isGroupStats = false }: StatsOverviewCardsProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'normal':
        return 'bg-green-100 text-green-800';
      case 'warning':
        return 'bg-yellow-100 text-yellow-800';
      case 'error':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'normal':
        return '正常';
      case 'warning':
        return '警告';
      case 'error':
        return '错误';
      default:
        return '未知';
    }
  };

  const formatCost = (cost: number) => {
    return `$${cost.toFixed(2)}`;
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M`;
    } else if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K`;
    }
    return num.toString();
  };

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      {/* 总API Keys */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center">
            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center mr-3">
              <Key className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-blue-600">{data.totalApiKeys}</div>
              <div className="text-sm text-gray-600">总API Keys</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 总用户数/成员数 */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center">
            <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center mr-3">
              <Users className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-green-600">{data.totalUsers}</div>
              <div className="text-sm text-gray-600">
                {isGroupStats ? '拼车组成员' : '属于账户'}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 今日请求 */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center">
            <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center mr-3">
              <Activity className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-purple-600">{data.todayRequests}</div>
              <div className="text-sm text-gray-600">今日请求</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 系统状态 */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center">
            <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center mr-3">
              <CheckCircle className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <Badge className={getStatusColor(data.systemStatus)}>
                {getStatusText(data.systemStatus)}
              </Badge>
              <div className="text-sm text-gray-600 mt-1">系统状态</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 总Token消耗 */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center">
            <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center mr-3">
              <TrendingUp className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-indigo-600">{data.totalTokens}</div>
              <div className="text-sm text-gray-600">总Token消耗</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 总费用 */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center">
            <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center mr-3">
              <DollarSign className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-emerald-600">{formatCost(data.totalCost)}</div>
              <div className="text-sm text-gray-600">总Token费用</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 平均RPM */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center">
            <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center mr-3">
              <BarChart3 className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-orange-600">{data.avgRPM}</div>
              <div className="text-sm text-gray-600">平均RPM</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 平均TPM */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center">
            <div className="w-10 h-10 bg-pink-100 rounded-full flex items-center justify-center mr-3">
              <Zap className="w-5 h-5 text-pink-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-pink-600">{data.avgTPM}</div>
              <div className="text-sm text-gray-600">平均TPM</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
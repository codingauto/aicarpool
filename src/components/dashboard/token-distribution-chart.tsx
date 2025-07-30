'use client';

import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface DistributionData {
  service: string;
  tokens: number;
  percentage: number;
  cost: number;
  color: string;
}

interface TokenDistributionChartProps {
  data: DistributionData[];
  title?: string;
}

export function TokenDistributionChart({ 
  data, 
  title = "Token使用分布" 
}: TokenDistributionChartProps) {
  
  const formatTokens = (tokens: number) => {
    if (tokens >= 1000000) {
      return `${(tokens / 1000000).toFixed(2)}M`;
    } else if (tokens >= 1000) {
      return `${(tokens / 1000).toFixed(1)}K`;
    }
    return tokens.toString();
  };

  const formatCost = (cost: number) => {
    return `$${cost.toFixed(2)}`;
  };

  const formatPercentage = (percentage: number) => {
    return `${percentage.toFixed(1)}%`;
  };

  // 自定义Tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white p-3 border rounded-lg shadow-lg">
          <p className="font-semibold text-gray-800">{data.service}</p>
          <p className="text-blue-600">
            Tokens: {formatTokens(data.tokens)}
          </p>
          <p className="text-green-600">
            费用: {formatCost(data.cost)}
          </p>
          <p className="text-purple-600">
            占比: {formatPercentage(data.percentage)}
          </p>
        </div>
      );
    }
    return null;
  };

  // 自定义Label显示百分比
  const renderLabel = (entry: any) => {
    return `${entry.percentage.toFixed(1)}%`;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>
          不同AI服务的Token使用分布情况
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={renderLabel}
                outerRadius={80}
                fill="#8884d8"
                dataKey="tokens"
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              <Legend 
                formatter={(value, entry: any) => (
                  <span style={{ color: entry.color }}>
                    {entry.payload.service}
                  </span>
                )}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        
        {/* 详细统计列表 */}
        <div className="mt-6 space-y-3">
          {data.map((item, index) => (
            <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center space-x-3">
                <div 
                  className="w-4 h-4 rounded-full" 
                  style={{ backgroundColor: item.color }}
                />
                <div>
                  <div className="font-medium text-gray-900">{item.service}</div>
                  <div className="text-sm text-gray-500">
                    {formatTokens(item.tokens)} tokens
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="font-semibold text-gray-900">
                  {formatPercentage(item.percentage)}
                </div>
                <div className="text-sm text-green-600">
                  {formatCost(item.cost)}
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
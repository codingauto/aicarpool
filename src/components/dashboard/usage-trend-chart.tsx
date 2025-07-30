'use client';

import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Legend 
} from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface TrendData {
  date: string;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens: number;
  requests: number;
  cost: number;
}

interface UsageTrendChartProps {
  data: TrendData[];
  title?: string;
  showAllMetrics?: boolean;
}

export function UsageTrendChart({ 
  data, 
  title = "Token使用趋势",
  showAllMetrics = true 
}: UsageTrendChartProps) {
  
  const formatTokens = (tokens: number) => {
    if (tokens >= 1000000) {
      return `${(tokens / 1000000).toFixed(1)}M`;
    } else if (tokens >= 1000) {
      return `${(tokens / 1000).toFixed(1)}K`;
    }
    return tokens.toString();
  };

  const formatCost = (cost: number) => {
    return `$${cost.toFixed(2)}`;
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('zh-CN', { 
      month: '2-digit', 
      day: '2-digit' 
    });
  };

  // 自定义Tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-4 border rounded-lg shadow-lg">
          <p className="font-semibold text-gray-800 mb-2">
            {formatDate(label)}
          </p>
          {payload.map((item: any, index: number) => (
            <p key={index} style={{ color: item.color }} className="text-sm">
              {item.name}: {
                item.dataKey === 'cost' 
                  ? formatCost(item.value)
                  : item.dataKey.includes('Token') 
                    ? formatTokens(item.value)
                    : item.value
              }
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>
          过去7天的使用趋势分析
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis 
                dataKey="date" 
                tickFormatter={formatDate}
                stroke="#666"
                fontSize={12}
              />
              <YAxis 
                tickFormatter={formatTokens}
                stroke="#666"
                fontSize={12}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              
              {/* 输入Token */}
              {showAllMetrics && data[0]?.inputTokens !== undefined && (
                <Line
                  type="monotone"
                  dataKey="inputTokens"
                  stroke="#4285f4"
                  strokeWidth={2}
                  dot={{ fill: '#4285f4', strokeWidth: 2, r: 4 }}
                  name="输入Token"
                />
              )}
              
              {/* 输出Token */}
              {showAllMetrics && data[0]?.outputTokens !== undefined && (
                <Line
                  type="monotone"
                  dataKey="outputTokens"
                  stroke="#34a853"
                  strokeWidth={2}
                  dot={{ fill: '#34a853', strokeWidth: 2, r: 4 }}
                  name="输出Token"
                />
              )}
              
              {/* 总Token */}
              <Line
                type="monotone"
                dataKey="totalTokens"
                stroke="#ea4335"
                strokeWidth={3}
                dot={{ fill: '#ea4335', strokeWidth: 2, r: 5 }}
                name="总Token"
              />
              
              {/* 请求数 (使用右侧Y轴) */}
              {showAllMetrics && (
                <Line
                  type="monotone"
                  dataKey="requests"
                  stroke="#fbbc04"
                  strokeWidth={2}
                  dot={{ fill: '#fbbc04', strokeWidth: 2, r: 4 }}
                  name="请求数"
                  yAxisId="right"
                />
              )}
              
              {/* 费用 */}
              {showAllMetrics && (
                <Line
                  type="monotone"
                  dataKey="cost"
                  stroke="#9c27b0"
                  strokeWidth={2}
                  dot={{ fill: '#9c27b0', strokeWidth: 2, r: 4 }}
                  name="费用 ($)"
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
        
        {/* 趋势分析摘要 */}
        <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center p-3 bg-blue-50 rounded-lg">
            <div className="text-lg font-semibold text-blue-600">
              {formatTokens(data.reduce((sum, item) => sum + item.totalTokens, 0))}
            </div>
            <div className="text-sm text-gray-600">总Token</div>
          </div>
          
          <div className="text-center p-3 bg-green-50 rounded-lg">
            <div className="text-lg font-semibold text-green-600">
              {data.reduce((sum, item) => sum + item.requests, 0)}
            </div>
            <div className="text-sm text-gray-600">总请求</div>
          </div>
          
          <div className="text-center p-3 bg-purple-50 rounded-lg">
            <div className="text-lg font-semibold text-purple-600">
              {formatCost(data.reduce((sum, item) => sum + item.cost, 0))}
            </div>
            <div className="text-sm text-gray-600">总费用</div>
          </div>
          
          <div className="text-center p-3 bg-orange-50 rounded-lg">
            <div className="text-lg font-semibold text-orange-600">
              {formatTokens(Math.round(data.reduce((sum, item) => sum + item.totalTokens, 0) / data.length))}
            </div>
            <div className="text-sm text-gray-600">日均Token</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
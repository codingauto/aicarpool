'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Download, RefreshCw } from 'lucide-react';

interface DetailedStatsData {
  model: string;
  requests: number;
  tokens: string;
  cost: string;
  percentage: string;
}

interface DetailedStatsTableProps {
  data: DetailedStatsData[];
  title?: string;
  showExport?: boolean;
  onRefresh?: () => void;
  onExport?: () => void;
}

export function DetailedStatsTable({ 
  data, 
  title = "详细统计数据",
  showExport = true,
  onRefresh,
  onExport
}: DetailedStatsTableProps) {
  
  const handleExport = () => {
    if (onExport) {
      onExport();
      return;
    }
    
    // 默认导出CSV
    const headers = ['模型', '请求数', 'Token数', '费用', '占比'];
    const csvContent = [
      headers.join(','),
      ...data.map(row => [
        row.model,
        row.requests,
        row.tokens,
        row.cost.replace('$', ''),
        row.percentage.replace('%', '')
      ].join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'usage-stats.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getPercentageColor = (percentage: string) => {
    const num = parseFloat(percentage.replace('%', ''));
    if (num >= 80) return 'bg-red-100 text-red-800';
    if (num >= 50) return 'bg-orange-100 text-orange-800';
    if (num >= 20) return 'bg-yellow-100 text-yellow-800';
    return 'bg-green-100 text-green-800';
  };

  const formatRequests = (requests: number) => {
    if (requests >= 1000) {
      return `${(requests / 1000).toFixed(1)}K`;
    }
    return requests.toString();
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>{title}</CardTitle>
            <CardDescription>
              按模型详细统计的使用情况和费用分析
            </CardDescription>
          </div>
          <div className="flex items-center space-x-2">
            {onRefresh && (
              <Button
                variant="outline"
                size="sm"
                onClick={onRefresh}
                className="flex items-center space-x-2"
              >
                <RefreshCw className="w-4 h-4" />
                <span>刷新</span>
              </Button>
            )}
            {showExport && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleExport}
                className="flex items-center space-x-2"
              >
                <Download className="w-4 h-4" />
                <span>导出</span>
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[40%]">模型</TableHead>
                <TableHead className="text-center">请求数</TableHead>
                <TableHead className="text-center">Token数</TableHead>
                <TableHead className="text-center">费用</TableHead>
                <TableHead className="text-center">占比</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.length > 0 ? (
                data.map((row, index) => (
                  <TableRow key={index} className="hover:bg-gray-50">
                    <TableCell className="font-mono text-sm">
                      <div className="max-w-xs truncate" title={row.model}>
                        {row.model}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="font-semibold text-gray-900">
                        {formatRequests(row.requests)}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="font-semibold text-blue-600">
                        {row.tokens}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="font-semibold text-green-600">
                        {row.cost}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge 
                        variant="secondary" 
                        className={getPercentageColor(row.percentage)}
                      >
                        {row.percentage}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-gray-500">
                    暂无统计数据
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        
        {/* 表格底部汇总信息 */}
        {data.length > 0 && (
          <div className="mt-4 pt-4 border-t">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div className="text-center">
                <div className="font-semibold text-gray-900">
                  {data.reduce((sum, row) => sum + row.requests, 0).toLocaleString()}
                </div>
                <div className="text-gray-500">总请求数</div>
              </div>
              
              <div className="text-center">
                <div className="font-semibold text-blue-600">
                  {data.length} 个模型
                </div>
                <div className="text-gray-500">使用模型</div>
              </div>
              
              <div className="text-center">
                <div className="font-semibold text-green-600">
                  {data.reduce((sum, row) => {
                    const cost = parseFloat(row.cost.replace('$', ''));
                    return sum + cost;
                  }, 0).toFixed(2)}$
                </div>
                <div className="text-gray-500">总费用</div>
              </div>
              
              <div className="text-center">
                <div className="font-semibold text-purple-600">
                  100%
                </div>
                <div className="text-gray-500">总占比</div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  DollarSign,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  Clock,
  PieChart,
  BarChart3,
  AlertCircle
} from 'lucide-react';

interface CostSummary {
  totalCost: number;
  totalTokens: number;
  totalRequests: number;
  costByModel: Record<string, number>;
  costByDepartment: Record<string, number>;
  costByTimeRange: Array<{
    date: string;
    cost: number;
    tokens: number;
    requests: number;
  }>;
}

interface BudgetUsage {
  budgetLimit: number;
  currentSpend: number;
  remainingBudget: number;
  percentage: number;
  isOverBudget: boolean;
  projectedSpend: number;
}

interface BudgetAlert {
  id: string;
  type: 'department' | 'group' | 'enterprise';
  entityId: string;
  entityName: string;
  budgetLimit: number;
  currentSpend: number;
  percentage: number;
  alertType: 'warning' | 'critical' | 'exceeded';
  period: 'daily' | 'weekly' | 'monthly';
  triggeredAt: string;
}

interface BudgetManagementProps {
  enterpriseId: string;
  isAdmin: boolean;
}

export function BudgetManagement({ enterpriseId, isAdmin }: BudgetManagementProps) {
  const [costSummary, setCostSummary] = useState<CostSummary | null>(null);
  const [budgetUsage, setBudgetUsage] = useState<BudgetUsage | null>(null);
  const [budgetAlerts, setBudgetAlerts] = useState<BudgetAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [timeRange, setTimeRange] = useState('30d');

  const fetchCostData = async () => {
    try {
      const token = localStorage.getItem('token');
      
      // 并行获取数据
      const [costsRes, alertsRes] = await Promise.all([
        fetch(`/api/enterprises/${enterpriseId}/costs?timeRange=${timeRange}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch(`/api/enterprises/${enterpriseId}/budget-alerts`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
      ]);

      const [costsData, alertsData] = await Promise.all([
        costsRes.json(),
        alertsRes.json()
      ]);

      if (costsData.success) {
        setCostSummary(costsData.data.costSummary);
        setBudgetUsage(costsData.data.budgetUsage);
      } else {
        setError(costsData.error || '获取成本数据失败');
      }

      if (alertsData.success) {
        setBudgetAlerts(alertsData.data.alerts || []);
      }

    } catch (error) {
      console.error('获取预算数据失败:', error);
      setError('获取预算数据失败');
    } finally {
      setLoading(false);
    }
  };

  const getBudgetStatusColor = (percentage: number, isOverBudget: boolean) => {
    if (isOverBudget) return 'text-red-600';
    if (percentage >= 90) return 'text-red-600';
    if (percentage >= 80) return 'text-yellow-600';
    return 'text-green-600';
  };

  const getBudgetStatusBadge = (percentage: number, isOverBudget: boolean) => {
    if (isOverBudget) return <Badge variant="destructive">超限</Badge>;
    if (percentage >= 90) return <Badge variant="destructive">紧急</Badge>;
    if (percentage >= 80) return <Badge className="bg-yellow-500">警告</Badge>;
    return <Badge variant="default">正常</Badge>;
  };

  const getAlertIcon = (alertType: string) => {
    switch (alertType) {
      case 'exceeded': return <AlertTriangle className="w-4 h-4 text-red-500" />;
      case 'critical': return <AlertCircle className="w-4 h-4 text-red-500" />;
      case 'warning': return <Clock className="w-4 h-4 text-yellow-500" />;
      default: return <CheckCircle className="w-4 h-4 text-green-500" />;
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('zh-CN', {
      style: 'currency',
      currency: 'CNY',
      minimumFractionDigits: 2
    }).format(amount);
  };

  useEffect(() => {
    fetchCostData();
  }, [enterpriseId, timeRange]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="text-center py-8">
          <div className="text-gray-500">加载预算数据...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 头部 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">预算管理</h2>
          <p className="text-gray-600">监控企业AI服务成本和预算使用情况</p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">7天</SelectItem>
              <SelectItem value="30d">30天</SelectItem>
              <SelectItem value="90d">90天</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={fetchCostData}>
            刷新
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview">总览</TabsTrigger>
          <TabsTrigger value="departments">部门成本</TabsTrigger>
          <TabsTrigger value="models">模型成本</TabsTrigger>
          <TabsTrigger value="alerts">预算预警</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* 预算使用概览 */}
          {budgetUsage && (
            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <DollarSign className="w-5 h-5 text-green-500" />
                    月度预算使用
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">预算使用率</span>
                    {getBudgetStatusBadge(budgetUsage.percentage, budgetUsage.isOverBudget)}
                  </div>
                  
                  <Progress 
                    value={Math.min(budgetUsage.percentage, 100)} 
                    className={`h-3 ${budgetUsage.isOverBudget ? 'bg-red-100' : ''}`}
                  />
                  
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <div className="text-gray-600">已使用</div>
                      <div className={`font-bold text-lg ${getBudgetStatusColor(budgetUsage.percentage, budgetUsage.isOverBudget)}`}>
                        {formatCurrency(budgetUsage.currentSpend)}
                      </div>
                    </div>
                    <div>
                      <div className="text-gray-600">预算总额</div>
                      <div className="font-bold text-lg">
                        {formatCurrency(budgetUsage.budgetLimit)}
                      </div>
                    </div>
                    <div>
                      <div className="text-gray-600">剩余预算</div>
                      <div className="font-bold">
                        {formatCurrency(budgetUsage.remainingBudget)}
                      </div>
                    </div>
                    <div>
                      <div className="text-gray-600">预计支出</div>
                      <div className="font-bold">
                        {formatCurrency(budgetUsage.projectedSpend)}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-blue-500" />
                    支出统计
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {costSummary && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">总支出</span>
                        <span className="text-2xl font-bold">
                          {formatCurrency(costSummary.totalCost)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">总Token数</span>
                        <span className="font-medium">
                          {costSummary.totalTokens.toLocaleString()}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">总请求数</span>
                        <span className="font-medium">
                          {costSummary.totalRequests.toLocaleString()}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">平均每请求成本</span>
                        <span className="font-medium">
                          {formatCurrency(costSummary.totalCost / Math.max(costSummary.totalRequests, 1))}
                        </span>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {/* 成本趋势 */}
          {costSummary && costSummary.costByTimeRange.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-purple-500" />
                  成本趋势
                </CardTitle>
                <CardDescription>
                  过去{timeRange}的成本变化趋势
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-600">
                        {costSummary.costByTimeRange.length}
                      </div>
                      <div className="text-sm text-gray-600">活跃天数</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-600">
                        {formatCurrency(
                          costSummary.costByTimeRange.reduce((sum, day) => sum + day.cost, 0) / 
                          Math.max(costSummary.costByTimeRange.length, 1)
                        )}
                      </div>
                      <div className="text-sm text-gray-600">日均成本</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-purple-600">
                        {Math.round(
                          costSummary.costByTimeRange.reduce((sum, day) => sum + day.requests, 0) / 
                          Math.max(costSummary.costByTimeRange.length, 1)
                        )}
                      </div>
                      <div className="text-sm text-gray-600">日均请求</div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="departments">
          <Card>
            <CardHeader>
              <CardTitle>部门成本分布</CardTitle>
              <CardDescription>
                各部门的AI服务成本使用情况
              </CardDescription>
            </CardHeader>
            <CardContent>
              {costSummary && Object.keys(costSummary.costByDepartment).length > 0 ? (
                <div className="space-y-4">
                  {Object.entries(costSummary.costByDepartment)
                    .sort(([,a], [,b]) => b - a)
                    .map(([departmentId, cost]) => (
                      <div key={departmentId} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                        <div className="flex items-center gap-3">
                          <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                          <span className="font-medium">{departmentId}</span>
                        </div>
                        <div className="text-right">
                          <div className="font-bold">{formatCurrency(cost)}</div>
                          <div className="text-sm text-gray-600">
                            {((cost / costSummary.totalCost) * 100).toFixed(1)}%
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <PieChart className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                  <p className="text-gray-600">暂无部门成本数据</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="models">
          <Card>
            <CardHeader>
              <CardTitle>模型成本分布</CardTitle>
              <CardDescription>
                不同AI模型的成本使用情况
              </CardDescription>
            </CardHeader>
            <CardContent>
              {costSummary && Object.keys(costSummary.costByModel).length > 0 ? (
                <div className="space-y-4">
                  {Object.entries(costSummary.costByModel)
                    .sort(([,a], [,b]) => b - a)
                    .map(([modelId, cost]) => (
                      <div key={modelId} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                        <div className="flex items-center gap-3">
                          <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                          <span className="font-medium">{modelId}</span>
                        </div>
                        <div className="text-right">
                          <div className="font-bold">{formatCurrency(cost)}</div>
                          <div className="text-sm text-gray-600">
                            {((cost / costSummary.totalCost) * 100).toFixed(1)}%
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <BarChart3 className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                  <p className="text-gray-600">暂无模型成本数据</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="alerts">
          <Card>
            <CardHeader>
              <CardTitle>预算预警</CardTitle>
              <CardDescription>
                预算使用异常和超限情况
              </CardDescription>
            </CardHeader>
            <CardContent>
              {budgetAlerts.length > 0 ? (
                <div className="space-y-3">
                  {budgetAlerts.map((alert) => (
                    <Alert 
                      key={alert.id} 
                      variant={alert.alertType === 'exceeded' ? 'destructive' : 'default'}
                    >
                      {getAlertIcon(alert.alertType)}
                      <AlertDescription className="ml-2">
                        <div className="flex items-center justify-between">
                          <div>
                            <strong>{alert.entityName}</strong> 预算使用率达到 
                            <strong className="ml-1">{alert.percentage.toFixed(1)}%</strong>
                            <div className="text-sm text-gray-600 mt-1">
                              已使用: {formatCurrency(alert.currentSpend)} / 
                              预算: {formatCurrency(alert.budgetLimit)}
                            </div>
                          </div>
                          <Badge variant={
                            alert.alertType === 'exceeded' ? 'destructive' : 
                            alert.alertType === 'critical' ? 'destructive' : 'secondary'
                          }>
                            {alert.alertType === 'exceeded' ? '已超限' :
                             alert.alertType === 'critical' ? '紧急' : '警告'}
                          </Badge>
                        </div>
                      </AlertDescription>
                    </Alert>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <CheckCircle className="w-12 h-12 mx-auto text-green-500 mb-4" />
                  <h3 className="text-lg font-medium mb-2">预算健康</h3>
                  <p className="text-gray-600">
                    所有部门和组的预算使用正常
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
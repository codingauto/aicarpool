'use client';

/**
 * 企业专属预算管理页面
 * 
 * 功能：
 * - 预算设置和监控
 * - 成本分配管理
 * - 预算告警设置
 * - 费用报告生成
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  DollarSign,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  Plus,
  Edit,
  Bell,
  Download,
  Calendar,
  Target,
  PieChart
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEnterpriseContext } from '@/contexts/enterprise-context';
import { EnterpriseLayout } from '@/components/layout/enterprise-navigation';

interface BudgetData {
  overview: {
    totalBudget: number;
    usedBudget: number;
    remainingBudget: number;
    monthlyBudget: number;
    currentMonthUsed: number;
    budgetUtilization: number;
  };
  departments: {
    id: string;
    name: string;
    budget: number;
    used: number;
    utilization: number;
    status: 'normal' | 'warning' | 'critical';
  }[];
  alerts: {
    id: string;
    type: 'budget_exceeded' | 'budget_warning' | 'unusual_usage';
    message: string;
    department?: string;
    threshold: number;
    current: number;
    timestamp: string;
  }[];
  recentTransactions: {
    id: string;
    date: string;
    description: string;
    amount: number;
    department: string;
    service: string;
  }[];
}

interface BudgetAllocation {
  departmentId: string;
  departmentName: string;
  monthlyBudget: number;
  warningThreshold: number;
  criticalThreshold: number;
}

export default function EnterpriseBudgetPage({ params }: { params: Promise<{ enterpriseId: string }> }) {
  const { enterpriseId } = React.use(params);
  const router = useRouter();
  const { currentEnterprise, hasRole } = useEnterpriseContext();
  const [budgetData, setBudgetData] = useState<BudgetData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showBudgetDialog, setShowBudgetDialog] = useState(false);
  const [selectedDepartment, setSelectedDepartment] = useState<BudgetAllocation | null>(null);

  useEffect(() => {
    fetchBudgetData();
  }, [enterpriseId]);

  const fetchBudgetData = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/enterprises/${enterpriseId}/budget`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setBudgetData(data.data);
        } else {
          setError(data.message || '获取预算数据失败');
        }
      } else {
        setError('获取预算数据失败');
      }
    } catch (error) {
      console.error('获取预算数据失败:', error);
      setError('获取预算数据失败');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'critical':
        return 'text-red-600 bg-red-50 border-red-200';
      case 'warning':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      default:
        return 'text-green-600 bg-green-50 border-green-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'critical':
        return <AlertTriangle className="w-4 h-4" />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4" />;
      default:
        return <CheckCircle className="w-4 h-4" />;
    }
  };

  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'budget_exceeded':
        return <AlertTriangle className="w-4 h-4 text-red-500" />;
      case 'budget_warning':
        return <Bell className="w-4 h-4 text-yellow-500" />;
      default:
        return <Bell className="w-4 h-4 text-blue-500" />;
    }
  };

  if (loading) {
    return (
      <EnterpriseLayout enterpriseId={enterpriseId}>
        <div className="p-6">
          <div className="flex items-center justify-center h-64">
            <div className="text-lg text-gray-600">加载预算数据...</div>
          </div>
        </div>
      </EnterpriseLayout>
    );
  }

  if (error || !budgetData) {
    return (
      <EnterpriseLayout enterpriseId={enterpriseId}>
        <div className="p-6">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <DollarSign className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">预算数据加载失败</h3>
                <p className="text-gray-600 mb-4">{error || '暂无预算数据'}</p>
                <Button onClick={fetchBudgetData}>重试</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </EnterpriseLayout>
    );
  }

  return (
    <EnterpriseLayout enterpriseId={enterpriseId}>
      <div className="p-6 space-y-6">
        {/* 页面标题 */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <DollarSign className="w-6 h-6 text-green-600" />
              预算管理
            </h1>
            <p className="text-gray-600 mt-1">
              管理企业AI资源预算分配和成本控制
            </p>
          </div>
          {hasRole(['owner', 'admin']) && (
            <div className="flex gap-2">
              <Button variant="outline">
                <Download className="w-4 h-4 mr-2" />
                导出报告
              </Button>
              <Dialog open={showBudgetDialog} onOpenChange={setShowBudgetDialog}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="w-4 h-4 mr-2" />
                    设置预算
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>预算设置</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="text-center py-8">
                      <Target className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-600">预算设置功能开发中...</p>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          )}
        </div>

        {/* 预算概览 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">总预算</p>
                  <p className="text-2xl font-bold text-gray-900">${budgetData.overview.totalBudget.toFixed(2)}</p>
                </div>
                <Target className="w-8 h-8 text-blue-500" />
              </div>
              <div className="mt-4">
                <div className="text-sm text-gray-600">本年度预算总额</div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">已使用</p>
                  <p className="text-2xl font-bold text-gray-900">${budgetData.overview.usedBudget.toFixed(2)}</p>
                </div>
                <TrendingUp className="w-8 h-8 text-green-500" />
              </div>
              <div className="mt-4">
                <Progress value={budgetData.overview.budgetUtilization} className="h-2" />
                <div className="text-sm text-gray-600 mt-1">
                  {budgetData.overview.budgetUtilization.toFixed(1)}% 预算使用率
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">剩余预算</p>
                  <p className="text-2xl font-bold text-gray-900">${budgetData.overview.remainingBudget.toFixed(2)}</p>
                </div>
                <DollarSign className="w-8 h-8 text-yellow-500" />
              </div>
              <div className="mt-4">
                <div className="text-sm text-gray-600">可用余额</div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">本月使用</p>
                  <p className="text-2xl font-bold text-gray-900">${budgetData.overview.currentMonthUsed.toFixed(2)}</p>
                </div>
                <Calendar className="w-8 h-8 text-purple-500" />
              </div>
              <div className="mt-4">
                <div className="text-sm text-gray-600">
                  / ${budgetData.overview.monthlyBudget.toFixed(2)} 月预算
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 详细信息标签页 */}
        <Tabs defaultValue="departments" className="space-y-4">
          <TabsList>
            <TabsTrigger value="departments">部门预算</TabsTrigger>
            <TabsTrigger value="alerts">预算告警</TabsTrigger>
            <TabsTrigger value="transactions">费用明细</TabsTrigger>
          </TabsList>

          <TabsContent value="departments">
            <Card>
              <CardHeader>
                <CardTitle>部门预算分配</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {budgetData.departments.map((dept) => (
                    <div key={dept.id} className={`p-4 border rounded-lg ${getStatusColor(dept.status)}`}>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center space-x-3">
                          {getStatusIcon(dept.status)}
                          <div>
                            <h4 className="font-medium">{dept.name}</h4>
                            <p className="text-sm opacity-75">
                              使用率 {dept.utilization.toFixed(1)}%
                            </p>
                          </div>
                        </div>
                        {hasRole(['owner', 'admin']) && (
                          <Button variant="ghost" size="sm">
                            <Edit className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span>已使用: ${dept.used.toFixed(2)}</span>
                          <span>预算: ${dept.budget.toFixed(2)}</span>
                        </div>
                        <Progress value={dept.utilization} className="h-2" />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="alerts">
            <Card>
              <CardHeader>
                <CardTitle>预算告警</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {budgetData.alerts.length > 0 ? (
                    budgetData.alerts.map((alert) => (
                      <div key={alert.id} className="flex items-start space-x-3 p-4 border rounded-lg">
                        {getAlertIcon(alert.type)}
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900">{alert.message}</p>
                          {alert.department && (
                            <p className="text-xs text-gray-600 mt-1">部门: {alert.department}</p>
                          )}
                          <div className="flex items-center space-x-4 mt-2 text-xs text-gray-500">
                            <span>阈值: ${alert.threshold.toFixed(2)}</span>
                            <span>当前: ${alert.current.toFixed(2)}</span>
                            <span>{new Date(alert.timestamp).toLocaleString('zh-CN')}</span>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8">
                      <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
                      <p className="text-gray-600">暂无预算告警</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="transactions">
            <Card>
              <CardHeader>
                <CardTitle>费用明细</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {budgetData.recentTransactions.map((transaction) => (
                    <div key={transaction.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                          <PieChart className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                          <h4 className="font-medium text-gray-900">{transaction.description}</h4>
                          <div className="flex items-center space-x-2 text-sm text-gray-600">
                            <span>{transaction.department}</span>
                            <span>•</span>
                            <span>{transaction.service}</span>
                            <span>•</span>
                            <span>{new Date(transaction.date).toLocaleDateString('zh-CN')}</span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-semibold text-gray-900">
                          ${transaction.amount.toFixed(2)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </EnterpriseLayout>
  );
}
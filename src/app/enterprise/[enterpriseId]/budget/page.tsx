'use client';

/**
 * 企业预算管理页面
 * 
 * 功能：
 * - 查看企业AI账号使用成本
 * - 设置预算限制和告警
 * - 分析成本趋势
 * - 管理付费计划
 */

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  DollarSign, 
  CreditCard, 
  TrendingUp, 
  AlertTriangle, 
  Settings,
  BarChart3,
  Calendar,
  Target,
  Zap,
  PiggyBank,
  TrendingDown,
  CheckCircle,
  Clock
} from 'lucide-react';

interface BudgetPageProps {
  params: Promise<{ enterpriseId: string }>;
}

export default function BudgetPage({ params }: BudgetPageProps) {
  const [activeTab, setActiveTab] = useState('overview');
  const [monthlyBudget, setMonthlyBudget] = useState('5000');
  const [alertThreshold, setAlertThreshold] = useState('80');

  // 模拟预算数据
  const budgetData = {
    currentSpent: 3250.50,
    monthlyBudget: 5000,
    lastMonthSpent: 2980.30,
    budgetUsagePercent: 65,
    remainingBudget: 1749.50,
    dailyAverage: 108.35,
    projectedMonthEnd: 4350.80,
    alerts: [
      { type: 'warning', message: '本月已使用预算的65%，接近告警阈值' },
      { type: 'info', message: 'Claude-3.5 Sonnet 使用量较上月增长15%' }
    ],
    costByService: [
      { name: 'Claude-3.5 Sonnet', cost: 1850.30, usage: '2.5M tokens', percent: 57 },
      { name: 'GPT-4 Turbo', cost: 980.20, usage: '1.8M tokens', percent: 30 },
      { name: 'Gemini Pro', cost: 320.00, usage: '1.2M tokens', percent: 10 },
      { name: '其他服务', cost: 100.00, usage: '500K tokens', percent: 3 }
    ],
    dailyCosts: [
      { date: '01/08', cost: 120.50 },
      { date: '02/08', cost: 95.30 },
      { date: '03/08', cost: 134.20 },
      // 更多数据...
    ]
  };

  const getUsageColor = (percent: number) => {
    if (percent >= 90) return 'text-red-600 bg-red-50';
    if (percent >= 70) return 'text-orange-600 bg-orange-50';
    return 'text-green-600 bg-green-50';
  };

  const getProgressColor = (percent: number) => {
    if (percent >= 90) return 'bg-red-500';
    if (percent >= 70) return 'bg-orange-500';
    return 'bg-green-500';
  };

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <DollarSign className="w-6 h-6 text-green-600" />
            预算管理
          </h1>
          <p className="text-gray-600 mt-1">管理AI服务成本和预算控制</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline">
            <BarChart3 className="w-4 h-4 mr-2" />
            导出报告
          </Button>
          <Button>
            <Settings className="w-4 h-4 mr-2" />
            预算设置
          </Button>
        </div>
      </div>

      {/* 预算概览卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-green-600" />
              本月已使用
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              ¥{budgetData.currentSpent.toLocaleString()}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              较上月 {((budgetData.currentSpent - budgetData.lastMonthSpent) / budgetData.lastMonthSpent * 100).toFixed(1)}%
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Target className="w-4 h-4 text-blue-600" />
              月度预算
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ¥{budgetData.monthlyBudget.toLocaleString()}
            </div>
            <Progress 
              value={budgetData.budgetUsagePercent} 
              className="mt-2 h-2"
            />
            <div className="text-xs text-gray-500 mt-1">
              已使用 {budgetData.budgetUsagePercent}%
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <PiggyBank className="w-4 h-4 text-purple-600" />
              剩余预算
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">
              ¥{budgetData.remainingBudget.toLocaleString()}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              预计可用 {Math.ceil(budgetData.remainingBudget / budgetData.dailyAverage)} 天
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-orange-600" />
              月末预测
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              ¥{budgetData.projectedMonthEnd.toLocaleString()}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              基于当前使用趋势
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 告警信息 */}
      {budgetData.alerts.length > 0 && (
        <div className="space-y-2">
          {budgetData.alerts.map((alert, index) => (
            <div 
              key={index}
              className={`flex items-center gap-3 p-3 rounded-lg ${
                alert.type === 'warning' ? 'bg-orange-50 border border-orange-200' : 'bg-blue-50 border border-blue-200'
              }`}
            >
              {alert.type === 'warning' ? (
                <AlertTriangle className="w-5 h-5 text-orange-500" />
              ) : (
                <Clock className="w-5 h-5 text-blue-500" />
              )}
              <span className={`text-sm ${
                alert.type === 'warning' ? 'text-orange-800' : 'text-blue-800'
              }`}>
                {alert.message}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* 详细标签页 */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-4 w-full">
          <TabsTrigger value="overview">使用概览</TabsTrigger>
          <TabsTrigger value="services">服务分析</TabsTrigger>
          <TabsTrigger value="trends">趋势分析</TabsTrigger>
          <TabsTrigger value="settings">预算设置</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 本月使用情况 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="w-5 h-5" />
                  本月使用情况
                </CardTitle>
                <CardDescription>按日统计的成本使用</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="text-center p-6 bg-gray-50 rounded-lg">
                    <BarChart3 className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                    <p className="text-gray-600">成本趋势图表</p>
                    <p className="text-sm text-gray-500">（图表组件待实现）</p>
                  </div>
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <p className="text-lg font-semibold">¥{budgetData.dailyAverage}</p>
                      <p className="text-xs text-gray-500">日均成本</p>
                    </div>
                    <div>
                      <p className="text-lg font-semibold">{new Date().getDate()}</p>
                      <p className="text-xs text-gray-500">已用天数</p>
                    </div>
                    <div>
                      <p className="text-lg font-semibold">{31 - new Date().getDate()}</p>
                      <p className="text-xs text-gray-500">剩余天数</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 预算健康度 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5" />
                  预算健康度
                </CardTitle>
                <CardDescription>基于使用趋势的预算分析</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm">预算使用率</span>
                    <Badge className={getUsageColor(budgetData.budgetUsagePercent)}>
                      {budgetData.budgetUsagePercent}%
                    </Badge>
                  </div>
                  <Progress 
                    value={budgetData.budgetUsagePercent} 
                    className="h-3"
                  />
                  
                  <div className="flex justify-between items-center pt-2">
                    <span className="text-sm">预测超支风险</span>
                    <Badge className="text-green-600 bg-green-50">
                      低风险
                    </Badge>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span className="text-sm">成本效率</span>
                    <Badge className="text-blue-600 bg-blue-50">
                      良好
                    </Badge>
                  </div>
                </div>

                <div className="pt-4 border-t">
                  <h4 className="font-medium mb-2">建议操作</h4>
                  <ul className="text-sm text-gray-600 space-y-1">
                    <li>• 当前使用趋势健康，预算控制良好</li>
                    <li>• 可考虑优化Claude使用以降低成本</li>
                    <li>• 建议设置75%使用率告警</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="services" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>AI服务成本分析</CardTitle>
              <CardDescription>各AI服务的详细成本统计</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {budgetData.costByService.map((service, index) => (
                  <div key={index} className="space-y-2">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-3">
                        <Zap className="w-4 h-4 text-blue-500" />
                        <span className="font-medium">{service.name}</span>
                        <Badge variant="outline">{service.usage}</Badge>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold">¥{service.cost.toLocaleString()}</div>
                        <div className="text-sm text-gray-500">{service.percent}%</div>
                      </div>
                    </div>
                    <Progress value={service.percent} className="h-2" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="trends" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>成本趋势分析</CardTitle>
              <CardDescription>历史成本数据和趋势预测</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center p-12 bg-gray-50 rounded-lg">
                <TrendingUp className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-600 mb-2">趋势分析图表</h3>
                <p className="text-gray-500">详细的成本趋势分析图表将在此显示</p>
                <p className="text-sm text-gray-400 mt-2">包含月度对比、同比分析、预测模型等</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>预算设置</CardTitle>
                <CardDescription>配置月度预算和告警阈值</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="monthly-budget">月度预算限额 (¥)</Label>
                  <Input
                    id="monthly-budget"
                    value={monthlyBudget}
                    onChange={(e) => setMonthlyBudget(e.target.value)}
                    placeholder="输入月度预算"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="alert-threshold">告警阈值 (%)</Label>
                  <Input
                    id="alert-threshold"
                    value={alertThreshold}
                    onChange={(e) => setAlertThreshold(e.target.value)}
                    placeholder="输入告警阈值"
                  />
                  <p className="text-sm text-gray-500">
                    当使用率达到此阈值时发送告警通知
                  </p>
                </div>

                <Button className="w-full">
                  <Settings className="w-4 h-4 mr-2" />
                  保存设置
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>通知设置</CardTitle>
                <CardDescription>配置预算告警和通知方式</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">邮件通知</p>
                      <p className="text-sm text-gray-500">通过邮件接收预算告警</p>
                    </div>
                    <input type="checkbox" defaultChecked className="rounded" />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">每日报告</p>
                      <p className="text-sm text-gray-500">每日成本使用情况汇总</p>
                    </div>
                    <input type="checkbox" className="rounded" />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">超支警告</p>
                      <p className="text-sm text-gray-500">预算即将超支时发送警告</p>
                    </div>
                    <input type="checkbox" defaultChecked className="rounded" />
                  </div>
                </div>

                <Button variant="outline" className="w-full">
                  <AlertTriangle className="w-4 h-4 mr-2" />
                  测试通知
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
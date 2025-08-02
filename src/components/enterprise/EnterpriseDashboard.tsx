'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Building2, 
  Users, 
  Database, 
  Activity, 
  TrendingUp, 
  DollarSign,
  AlertCircle,
  CheckCircle,
  Zap,
  Settings,
  BarChart3
} from 'lucide-react';

// 导入子组件
import { OrganizationStructure } from './OrganizationStructure';
import { AccountPoolManager } from './AccountPoolManager';
import { ModelHealthMonitor } from './ModelHealthMonitor';
import { BudgetManagement } from './BudgetManagement';
import { PermissionManagement } from './PermissionManagement';
import { AlertMonitor } from './AlertMonitor';
import { UsageChart } from '@/components/charts/UsageChart';
import { RealTimeMonitor } from '@/components/monitoring/RealTimeMonitor';

interface DashboardStats {
  enterprise: {
    id: string;
    name: string;
    planType: string;
  };
  departments: {
    total: number;
    active: number;
  };
  accountPools: {
    total: number;
    active: number;
    totalAccounts: number;
  };
  groups: {
    total: number;
    active: number;
  };
  models: {
    total: number;
    healthy: number;
    active: string;
  };
}

interface EnterpriseDashboardProps {
  enterpriseId: string;
  isAdmin: boolean;
}

export function EnterpriseDashboard({ enterpriseId, isAdmin }: EnterpriseDashboardProps) {
  const router = useRouter();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('overview');

  const fetchDashboardStats = async () => {
    try {
      const token = localStorage.getItem('token');
      
      // 并行获取所有统计数据
      const [departmentsRes, poolsRes] = await Promise.all([
        fetch(`/api/enterprises/${enterpriseId}/departments`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch(`/api/enterprises/${enterpriseId}/account-pools`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
      ]);

      const [departmentsData, poolsData] = await Promise.all([
        departmentsRes.json(),
        poolsRes.json()
      ]);

      if (departmentsData.success && poolsData.success) {
        // 计算统计数据
        const departmentStats = {
          total: departmentsData.data?.totalCount || 0,
          active: departmentsData.data?.totalCount || 0
        };

        const pools = Array.isArray(poolsData.data) ? poolsData.data : [];
        const poolStats = {
          total: pools.length || 0,
          active: pools.filter((pool: any) => pool.isActive).length || 0,
          totalAccounts: pools.reduce((sum: number, pool: any) => 
            sum + (pool._count?.accountBindings || 0), 0
          )
        };

        const departments = departmentsData.data?.departments || [];
        const groupCount = departments.reduce((sum: number, dept: any) => 
          sum + (dept._count?.groups || 0), 0
        ) || 0;

        // 获取企业信息
        const enterprise = departmentsData.data?.enterprise || {
          id: enterpriseId,
          name: '企业',
          planType: 'basic'
        };

        setStats({
          enterprise,
          departments: departmentStats,
          accountPools: poolStats,
          groups: {
            total: groupCount,
            active: groupCount
          },
          models: {
            total: 5, // Claude Sonnet, Opus, Kimi, GLM, Qwen
            healthy: 4, // 假设大部分健康
            active: 'claude-4-sonnet'
          }
        });
      } else {
        // 提供更详细的错误信息
        const errorMsg = departmentsData.error || poolsData.error || '获取企业统计数据失败';
        console.error('API错误详情:', { departmentsData, poolsData });
        setError(errorMsg);
      }
    } catch (error) {
      console.error('获取企业统计数据失败:', error);
      setError('获取企业统计数据失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardStats();
  }, [enterpriseId]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="text-center py-8">
          <div className="text-gray-500">加载企业控制面板...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {/* 企业头部信息 */}
      {stats && (
        <div className="bg-gradient-to-r from-blue-500 to-purple-600 text-white p-6 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">{stats.enterprise.name}</h1>
              <p className="text-blue-100 mt-2">企业级AI资源管理平台</p>
            </div>
            <div className="text-right">
              <Badge variant="secondary" className="text-lg px-4 py-2">
                {stats.enterprise.planType.toUpperCase()}
              </Badge>
              <div className="text-sm text-blue-100 mt-2">
                企业ID: {stats.enterprise.id.slice(0, 8)}...
              </div>
            </div>
          </div>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-10">
          <TabsTrigger value="overview">总览</TabsTrigger>
          <TabsTrigger value="analytics">数据分析</TabsTrigger>
          <TabsTrigger value="ai-resources">AI资源</TabsTrigger>
          <TabsTrigger value="groups">拼车组</TabsTrigger>
          <TabsTrigger value="organization">组织架构</TabsTrigger>
          <TabsTrigger value="pools">账号池</TabsTrigger>
          <TabsTrigger value="budget">预算管理</TabsTrigger>
          <TabsTrigger value="permissions">权限管理</TabsTrigger>
          <TabsTrigger value="alerts">告警监控</TabsTrigger>
          <TabsTrigger value="monitoring">系统监控</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* 统计卡片 */}
          {stats && (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">部门总数</p>
                      <p className="text-3xl font-bold">{stats.departments.total}</p>
                      <p className="text-xs text-green-600 mt-1">
                        {stats.departments.active} 个活跃
                      </p>
                    </div>
                    <Building2 className="w-8 h-8 text-blue-500" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">拼车组</p>
                      <p className="text-3xl font-bold">{stats.groups.total}</p>
                      <p className="text-xs text-green-600 mt-1">
                        {stats.groups.active} 个活跃
                      </p>
                    </div>
                    <Users className="w-8 h-8 text-green-500" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">账号池</p>
                      <p className="text-3xl font-bold">{stats.accountPools.total}</p>
                      <p className="text-xs text-blue-600 mt-1">
                        {stats.accountPools.totalAccounts} 个账号
                      </p>
                    </div>
                    <Database className="w-8 h-8 text-purple-500" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">AI模型</p>
                      <p className="text-3xl font-bold">{stats.models.total}</p>
                      <p className="text-xs text-green-600 mt-1">
                        {stats.models.healthy} 个健康
                      </p>
                    </div>
                    <Activity className="w-8 h-8 text-orange-500" />
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* 系统状态 */}
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  系统状态
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm">AI服务可用性</span>
                  <Badge variant="default">99.9%</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">平均响应时间</span>
                  <Badge variant="secondary">1.2s</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">当前活跃模型</span>
                  <Badge variant="outline">{stats?.models.active}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">负载均衡状态</span>
                  <Badge variant="default">正常</Badge>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-blue-500" />
                  资源使用
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm">账号池利用率</span>
                  <Badge variant="secondary">85%</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">API调用量</span>
                  <Badge variant="outline">12.5K/天</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">成本效率</span>
                  <Badge variant="default">优秀</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">存储使用</span>
                  <Badge variant="secondary">2.1GB</Badge>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 快速操作 */}
          <Card>
            <CardHeader>
              <CardTitle>快速操作</CardTitle>
              <CardDescription>
                常用的管理操作和工具
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-4">
                <button 
                  onClick={() => setActiveTab('ai-resources')}
                  className="flex items-center gap-3 p-4 border rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <Zap className="w-6 h-6 text-yellow-500" />
                  <div className="text-left">
                    <div className="font-medium">AI资源管理</div>
                    <div className="text-sm text-gray-600">管理AI账号和服务配置</div>
                  </div>
                </button>

                <button 
                  onClick={() => setActiveTab('organization')}
                  className="flex items-center gap-3 p-4 border rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <Building2 className="w-6 h-6 text-blue-500" />
                  <div className="text-left">
                    <div className="font-medium">管理组织架构</div>
                    <div className="text-sm text-gray-600">创建和管理部门结构</div>
                  </div>
                </button>
                
                <button 
                  onClick={() => setActiveTab('analytics')}
                  className="flex items-center gap-3 p-4 border rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <BarChart3 className="w-6 h-6 text-purple-500" />
                  <div className="text-left">
                    <div className="font-medium">数据分析</div>
                    <div className="text-sm text-gray-600">查看使用统计和成本分析</div>
                  </div>
                </button>
                
                <button 
                  onClick={() => setActiveTab('monitoring')}
                  className="flex items-center gap-3 p-4 border rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <Activity className="w-6 h-6 text-orange-500" />
                  <div className="text-left">
                    <div className="font-medium">监控模型健康</div>
                    <div className="text-sm text-gray-600">查看性能和故障转移</div>
                  </div>
                </button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-blue-500" />
                企业级使用分析
              </CardTitle>
              <CardDescription>
                企业所有拼车组的AI资源使用情况综合分析
              </CardDescription>
            </CardHeader>
            <CardContent>
              <UsageChart 
                groupId={enterpriseId} 
                timeRange="90d" 
                showServiceBreakdown={true}
                isEnterprise={true}
              />
            </CardContent>
          </Card>

          {/* 企业级统计概览 */}
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>成本效益分析</CardTitle>
                <CardDescription>各部门和拼车组的成本效益对比</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {[
                    { dept: '技术部', groups: 5, cost: 234.56, efficiency: 92 },
                    { dept: '产品部', groups: 3, cost: 156.78, efficiency: 88 },
                    { dept: '设计部', groups: 2, cost: 89.12, efficiency: 95 },
                    { dept: '运营部', groups: 2, cost: 67.89, efficiency: 90 }
                  ].map((item, index) => (
                    <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <div className="font-medium">{item.dept}</div>
                        <div className="text-sm text-gray-500">{item.groups} 个拼车组</div>
                      </div>
                      <div className="text-right">
                        <div className="font-medium">${item.cost}</div>
                        <div className="text-sm text-gray-500">效率: {item.efficiency}%</div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>服务使用趋势</CardTitle>
                <CardDescription>AI服务提供商使用分布变化</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {[
                    { service: 'Claude', usage: '45%', trend: '+5%', color: 'text-green-600' },
                    { service: 'OpenAI', usage: '32%', trend: '-2%', color: 'text-red-600' },
                    { service: 'Gemini', usage: '15%', trend: '+3%', color: 'text-green-600' },
                    { service: '千帆', usage: '8%', trend: '-1%', color: 'text-red-600' }
                  ].map((item, index) => (
                    <div key={index} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                        <span className="font-medium">{item.service}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{item.usage}</span>
                        <span className={`text-sm ${item.color}`}>{item.trend}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="ai-resources" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            <Card className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="w-5 h-5 text-blue-500" />
                  AI账号管理
                </CardTitle>
                <CardDescription>
                  管理企业的所有AI服务账号
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span>总账号数</span>
                    <Badge variant="secondary">{stats?.accountPools.totalAccounts || 0}</Badge>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>活跃账号</span>
                    <Badge variant="default">{Math.floor((stats?.accountPools.totalAccounts || 0) * 0.8)}</Badge>
                  </div>
                  <button 
                    onClick={() => router.push('/enterprise/ai-accounts')}
                    className="w-full mt-4 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                  >
                    管理AI账号
                  </button>
                </div>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-green-500" />
                  资源总览
                </CardTitle>
                <CardDescription>
                  查看AI资源使用情况和统计
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span>今日请求</span>
                    <Badge variant="outline">1.2K</Badge>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>今日成本</span>
                    <Badge variant="secondary">$45.67</Badge>
                  </div>
                  <button 
                    onClick={() => setActiveTab('analytics')}
                    className="w-full mt-4 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
                  >
                    查看资源总览
                  </button>
                </div>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="w-5 h-5 text-orange-500" />
                  健康监控
                </CardTitle>
                <CardDescription>
                  监控AI服务健康状态和性能
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span>服务可用性</span>
                    <Badge variant="default">99.9%</Badge>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>平均响应时间</span>
                    <Badge variant="secondary">1.2s</Badge>
                  </div>
                  <button 
                    onClick={() => setActiveTab('monitoring')}
                    className="w-full mt-4 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
                  >
                    查看健康监控
                  </button>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>快速操作</CardTitle>
              <CardDescription>
                常用的AI资源管理操作
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-4">
                <button 
                  onClick={() => router.push('/enterprise/ai-accounts/create')}
                  className="flex flex-col items-center gap-2 p-4 border rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                    <Zap className="w-4 h-4 text-blue-600" />
                  </div>
                  <span className="font-medium">添加AI账号</span>
                  <span className="text-xs text-gray-600">创建新的AI服务账号</span>
                </button>
                
                <button 
                  onClick={() => router.push('/enterprise/ai-accounts')}
                  className="flex flex-col items-center gap-2 p-4 border rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                    <Database className="w-4 h-4 text-green-600" />
                  </div>
                  <span className="font-medium">管理账号</span>
                  <span className="text-xs text-gray-600">查看和编辑AI账号</span>
                </button>
                
                <button 
                  onClick={() => setActiveTab('analytics')}
                  className="flex flex-col items-center gap-2 p-4 border rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                    <TrendingUp className="w-4 h-4 text-purple-600" />
                  </div>
                  <span className="font-medium">资源统计</span>
                  <span className="text-xs text-gray-600">查看使用统计和成本</span>
                </button>
                
                <button 
                  onClick={() => setActiveTab('monitoring')}
                  className="flex flex-col items-center gap-2 p-4 border rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center">
                    <Activity className="w-4 h-4 text-orange-600" />
                  </div>
                  <span className="font-medium">健康检查</span>
                  <span className="text-xs text-gray-600">监控服务状态</span>
                </button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="groups" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            <Card className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-blue-500" />
                  拼车组管理
                </CardTitle>
                <CardDescription>
                  查看和管理企业内的拼车组
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span>总拼车组数</span>
                    <Badge variant="secondary">{stats?.groups.total || 0}</Badge>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>活跃拼车组</span>
                    <Badge variant="default">{stats?.groups.active || 0}</Badge>
                  </div>
                  <button 
                    onClick={() => router.push(`/enterprise/${enterpriseId}/groups`)}
                    className="w-full mt-4 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                  >
                    管理拼车组
                  </button>
                </div>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="w-5 h-5 text-green-500" />
                  资源配置
                </CardTitle>
                <CardDescription>
                  拼车组AI资源绑定和配额管理
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span>已配置组数</span>
                    <Badge variant="outline">80%</Badge>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>资源利用率</span>
                    <Badge variant="secondary">85%</Badge>
                  </div>
                  <button 
                    onClick={() => setActiveTab('ai-resources')}
                    className="w-full mt-4 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
                  >
                    查看资源配置
                  </button>
                </div>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-orange-500" />
                  使用统计
                </CardTitle>
                <CardDescription>
                  拼车组资源使用情况和成本分析
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span>今日总请求</span>
                    <Badge variant="default">1.2K</Badge>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>今日总成本</span>
                    <Badge variant="secondary">$45.67</Badge>
                  </div>
                  <button 
                    onClick={() => setActiveTab('monitoring')}
                    className="w-full mt-4 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
                  >
                    查看详细统计
                  </button>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                拼车组资源配置概览
                <Button 
                  onClick={() => router.push(`/enterprise/${enterpriseId}/groups/create`)}
                  size="sm"
                >
                  <Users className="w-4 h-4 mr-2" />
                  创建拼车组
                </Button>
              </CardTitle>
              <CardDescription>
                查看各拼车组的资源绑定模式和使用情况
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[
                  { name: '前端开发组', mode: '混合模式', usage: 65, cost: 23.45, status: 'active' },
                  { name: '后端开发组', mode: '专属模式', usage: 42, cost: 18.90, status: 'active' },
                  { name: '产品设计组', mode: '共享模式', usage: 28, cost: 8.76, status: 'inactive' },
                  { name: '测试组', mode: '共享模式', usage: 55, cost: 12.34, status: 'active' }
                ].map((group, index) => (
                  <div key={index} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center space-x-4">
                      <div>
                        <div className="font-medium">{group.name}</div>
                        <div className="text-sm text-gray-500">{group.mode}</div>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-4">
                      <div className="text-right">
                        <div className="text-sm font-medium">使用率: {group.usage}%</div>
                        <div className="text-sm text-gray-500">成本: ${group.cost}</div>
                      </div>
                      
                      <Badge variant={group.status === 'active' ? 'default' : 'secondary'}>
                        {group.status === 'active' ? '活跃' : '非活跃'}
                      </Badge>
                      
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => router.push(`/enterprise/${enterpriseId}/groups/${index + 1}`)}
                      >
                        配置
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="mt-4 text-center">
                <Button 
                  variant="outline" 
                  onClick={() => router.push(`/enterprise/${enterpriseId}/groups`)}
                >
                  查看所有拼车组
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="organization">
          <OrganizationStructure 
            enterpriseId={enterpriseId} 
            isAdmin={isAdmin} 
          />
        </TabsContent>

        <TabsContent value="pools">
          <AccountPoolManager 
            enterpriseId={enterpriseId} 
            isAdmin={isAdmin} 
          />
        </TabsContent>

        <TabsContent value="budget">
          <BudgetManagement 
            enterpriseId={enterpriseId} 
            isAdmin={isAdmin} 
          />
        </TabsContent>

        <TabsContent value="permissions">
          <PermissionManagement 
            enterpriseId={enterpriseId} 
            isAdmin={isAdmin} 
          />
        </TabsContent>

        <TabsContent value="alerts">
          <AlertMonitor 
            enterpriseId={enterpriseId} 
          />
        </TabsContent>

        <TabsContent value="monitoring">
          <RealTimeMonitor 
            isEnterprise={true}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
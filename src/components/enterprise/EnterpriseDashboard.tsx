'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
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
  Zap
} from 'lucide-react';

// 导入子组件
import { OrganizationStructure } from './OrganizationStructure';
import { AccountPoolManager } from './AccountPoolManager';
import { ModelHealthMonitor } from './ModelHealthMonitor';
import { BudgetManagement } from './BudgetManagement';
import { PermissionManagement } from './PermissionManagement';
import { AlertMonitor } from './AlertMonitor';

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
        <TabsList className="grid w-full grid-cols-7">
          <TabsTrigger value="overview">总览</TabsTrigger>
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
              <div className="grid gap-4 md:grid-cols-3">
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
                  onClick={() => setActiveTab('pools')}
                  className="flex items-center gap-3 p-4 border rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <Database className="w-6 h-6 text-purple-500" />
                  <div className="text-left">
                    <div className="font-medium">配置账号池</div>
                    <div className="text-sm text-gray-600">设置负载均衡策略</div>
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
          <ModelHealthMonitor 
            groupId="default" 
            isAdmin={isAdmin} 
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useEnterpriseContext } from '@/contexts/enterprise-context';
import { EnterpriseGate, PermissionButton } from '@/components/auth/enterprise-gate';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
  BarChart3,
  ArrowLeft
} from 'lucide-react';

interface EnterpriseInfo {
  id: string;
  name: string;
  planType: string;
}

interface DashboardStats {
  enterprise: EnterpriseInfo;
  members: {
    total: number;
    active: number;
  };
  groups: {
    total: number;
    active: number;
  };
  aiResources: {
    accounts: number;
    pools: number;
    usage: number;
  };
  costs: {
    today: number;
    month: number;
    efficiency: number;
  };
}

function DashboardContent() {
  const params = useParams();
  const router = useRouter();
  const enterpriseId = params.enterpriseId as string;
  const { currentEnterprise, userRole, hasPermission } = useEnterpriseContext();
  
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [localUserRole, setLocalUserRole] = useState<string>('member');

  useEffect(() => {
    fetchDashboardData();
  }, [enterpriseId]);

  const fetchDashboardData = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        router.push('/');
        return;
      }

      // 获取企业基本信息
      const enterpriseResponse = await fetch(`/api/enterprises/${enterpriseId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!enterpriseResponse.ok) {
        if (enterpriseResponse.status === 401) {
          router.push('/');
          return;
        }
        if (enterpriseResponse.status === 403) {
          setError('您没有权限访问此企业');
          return;
        }
        throw new Error('获取企业信息失败');
      }

      const enterpriseData = await enterpriseResponse.json();
      
      if (enterpriseData.success) {
        const enterprise = enterpriseData.data;
        
        // 模拟统计数据（后续替换为真实API）
        const mockStats: DashboardStats = {
          enterprise: {
            id: enterprise.id,
            name: enterprise.name,
            planType: enterprise.planType || 'basic'
          },
          members: {
            total: 12,
            active: 8
          },
          groups: {
            total: 4,
            active: 3
          },
          aiResources: {
            accounts: 15,
            pools: 3,
            usage: 78
          },
          costs: {
            today: 45.67,
            month: 1234.56,
            efficiency: 92
          }
        };

        setStats(mockStats);
        setLocalUserRole('admin'); // 模拟用户角色
      } else {
        setError('获取企业信息失败');
      }
    } catch (error) {
      console.error('获取企业数据失败:', error);
      setError('加载失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="text-lg text-gray-600">加载企业控制面板...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <Alert variant="destructive" className="max-w-md mx-auto">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
        <div className="text-center">
          <Button onClick={() => router.push('/')} variant="outline">
            返回企业选择
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
        {/* 欢迎区域 */}
        <div className="bg-gradient-to-r from-blue-500 to-purple-600 text-white p-6 rounded-lg mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold">欢迎来到 {currentEnterprise?.name || stats?.enterprise.name}</h2>
              <p className="text-blue-100 mt-2">企业级AI资源管理和拼车服务平台</p>
            </div>
            <div className="text-right">
              <div className="text-sm text-blue-100">
                企业ID: {stats?.enterprise.id.slice(0, 8)}...
              </div>
            </div>
          </div>
        </div>

        {/* 统计卡片 */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-8">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">团队成员</p>
                  <p className="text-3xl font-bold">{stats?.members.total}</p>
                  <p className="text-xs text-green-600 mt-1">
                    {stats?.members.active} 个活跃
                  </p>
                </div>
                <Users className="w-8 h-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">拼车组</p>
                  <p className="text-3xl font-bold">{stats?.groups.total}</p>
                  <p className="text-xs text-green-600 mt-1">
                    {stats?.groups.active} 个活跃
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
                  <p className="text-sm font-medium text-gray-600">AI账号</p>
                  <p className="text-3xl font-bold">{stats?.aiResources.accounts}</p>
                  <p className="text-xs text-blue-600 mt-1">
                    {stats?.aiResources.pools} 个账号池
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
                  <p className="text-sm font-medium text-gray-600">今日成本</p>
                  <p className="text-3xl font-bold">${stats?.costs.today}</p>
                  <p className="text-xs text-green-600 mt-1">
                    效率 {stats?.costs.efficiency}%
                  </p>
                </div>
                <DollarSign className="w-8 h-8 text-orange-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 系统状态和快速操作 */}
        <div className="grid gap-6 md:grid-cols-2 mb-8">
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
                <Badge variant="outline">claude-4-sonnet</Badge>
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
                <Badge variant="secondary">{stats?.aiResources.usage}%</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">API调用量</span>
                <Badge variant="outline">12.5K/天</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">月度成本</span>
                <Badge variant="default">${stats?.costs.month}</Badge>
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
              常用的企业管理操作和工具
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-4">
              <EnterpriseGate requiredRoles={['admin', 'owner']} showError={false}>
                <button 
                  onClick={() => router.push(`/enterprise/${enterpriseId}/groups`)}
                  className="flex items-center gap-3 p-4 border rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <Users className="w-6 h-6 text-blue-500" />
                  <div className="text-left">
                    <div className="font-medium">拼车组管理</div>
                    <div className="text-sm text-gray-600">创建和管理拼车组</div>
                  </div>
                </button>
              </EnterpriseGate>

              <EnterpriseGate requiredRoles={['admin', 'owner']} showError={false}>
                <button 
                  onClick={() => router.push(`/enterprise/${enterpriseId}/ai-resources`)}
                  className="flex items-center gap-3 p-4 border rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <Zap className="w-6 h-6 text-yellow-500" />
                  <div className="text-left">
                    <div className="font-medium">AI资源管理</div>
                    <div className="text-sm text-gray-600">管理AI账号和服务配置</div>
                  </div>
                </button>
              </EnterpriseGate>

              <EnterpriseGate requiredRoles={['admin', 'owner']} showError={false}>
                <button 
                  onClick={() => router.push(`/enterprise/${enterpriseId}/organization`)}
                  className="flex items-center gap-3 p-4 border rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <Building2 className="w-6 h-6 text-green-500" />
                  <div className="text-left">
                    <div className="font-medium">组织架构</div>
                    <div className="text-sm text-gray-600">管理部门和成员</div>
                  </div>
                </button>
              </EnterpriseGate>
              
              <button 
                onClick={() => router.push(`/enterprise/${enterpriseId}/analytics`)}
                className="flex items-center gap-3 p-4 border rounded-lg hover:bg-gray-50 transition-colors"
              >
                <BarChart3 className="w-6 h-6 text-purple-500" />
                <div className="text-left">
                  <div className="font-medium">数据分析</div>
                  <div className="text-sm text-gray-600">查看使用统计和成本分析</div>
                </div>
              </button>
            </div>
          </CardContent>
        </Card>
    </div>
  );
}

export default function EnterpriseDashboardPage() {
  return <DashboardContent />;
}
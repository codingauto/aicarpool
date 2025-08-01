'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Plus, 
  Settings, 
  Users, 
  Activity, 
  AlertCircle, 
  CheckCircle, 
  BarChart3,
  Database,
  Link2
} from 'lucide-react';

interface AccountPool {
  id: string;
  name: string;
  description?: string;
  poolType: 'shared' | 'dedicated';
  loadBalanceStrategy: 'round_robin' | 'least_connections' | 'weighted';
  maxLoadPerAccount: number;
  priority: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  accountBindings: Array<{
    id: string;
    weight: number;
    maxLoadPercentage: number;
    isActive: boolean;
    account: {
      id: string;
      name: string;
      serviceType: string;
      status: string;
      isEnabled: boolean;
    };
  }>;
  groupBindings: Array<{
    id: string;
    bindingType: string;
    priority: number;
    group: {
      id: string;
      name: string;
    };
  }>;
  _count: {
    accountBindings: number;
    groupBindings: number;
  };
}

interface AccountPoolManagerProps {
  enterpriseId: string;
  isAdmin: boolean;
}

export function AccountPoolManager({ enterpriseId, isAdmin }: AccountPoolManagerProps) {
  const [pools, setPools] = useState<AccountPool[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedPool, setSelectedPool] = useState<AccountPool | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  // 新建账号池表单状态
  const [newPool, setNewPool] = useState({
    name: '',
    description: '',
    poolType: 'shared' as 'shared' | 'dedicated',
    loadBalanceStrategy: 'round_robin' as 'round_robin' | 'least_connections' | 'weighted',
    maxLoadPerAccount: 80,
    priority: 1,
    accountIds: [] as string[]
  });

  const fetchPools = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/enterprises/${enterpriseId}/account-pools`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();
      if (data.success) {
        setPools(data.data);
      } else {
        setError(data.error || '获取账号池失败');
      }
    } catch (error) {
      console.error('获取账号池失败:', error);
      setError('获取账号池失败');
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePool = async () => {
    if (!isAdmin) return;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/enterprises/${enterpriseId}/account-pools`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(newPool),
      });

      const data = await response.json();
      if (data.success) {
        await fetchPools();
        setCreateDialogOpen(false);
        setNewPool({
          name: '',
          description: '',
          poolType: 'shared',
          loadBalanceStrategy: 'round_robin',
          maxLoadPerAccount: 80,
          priority: 1,
          accountIds: []
        });
        alert('账号池创建成功');
      } else {
        alert(data.error || '创建账号池失败');
      }
    } catch (error) {
      console.error('创建账号池失败:', error);
      alert('创建账号池失败');
    }
  };

  useEffect(() => {
    fetchPools();
  }, [enterpriseId]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="text-center py-8">
          <div className="text-gray-500">加载中...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 头部 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">账号池管理</h2>
          <p className="text-gray-600">管理企业级AI账号池，实现智能负载均衡和资源分配</p>
        </div>
        {isAdmin && (
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                创建账号池
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>创建新账号池</DialogTitle>
                <DialogDescription>
                  配置账号池的基本信息和负载均衡策略
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>账号池名称</Label>
                    <Input
                      value={newPool.name}
                      onChange={(e) => setNewPool(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="输入账号池名称"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>优先级</Label>
                    <Input
                      type="number"
                      min="1"
                      value={newPool.priority}
                      onChange={(e) => setNewPool(prev => ({ ...prev, priority: parseInt(e.target.value) }))}
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label>描述</Label>
                  <Input
                    value={newPool.description}
                    onChange={(e) => setNewPool(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="账号池用途描述"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>池类型</Label>
                    <Select 
                      value={newPool.poolType} 
                      onValueChange={(value: 'shared' | 'dedicated') => setNewPool(prev => ({ ...prev, poolType: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="shared">共享池</SelectItem>
                        <SelectItem value="dedicated">专属池</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>负载均衡策略</Label>
                    <Select 
                      value={newPool.loadBalanceStrategy} 
                      onValueChange={(value: any) => setNewPool(prev => ({ ...prev, loadBalanceStrategy: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="round_robin">轮询</SelectItem>
                        <SelectItem value="least_connections">最少连接</SelectItem>
                        <SelectItem value="weighted">加权分配</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>单账号最大负载 (%)</Label>
                  <Input
                    type="number"
                    min="1"
                    max="100"
                    value={newPool.maxLoadPerAccount}
                    onChange={(e) => setNewPool(prev => ({ ...prev, maxLoadPerAccount: parseInt(e.target.value) }))}
                  />
                </div>

                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                    取消
                  </Button>
                  <Button onClick={handleCreatePool} disabled={!newPool.name}>
                    创建
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* 账号池列表 */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {pools.map((pool) => (
          <Card key={pool.id} className="hover:shadow-md transition-shadow">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">{pool.name}</CardTitle>
                <div className="flex items-center gap-2">
                  <Badge variant={pool.poolType === 'shared' ? 'default' : 'secondary'}>
                    {pool.poolType === 'shared' ? '共享' : '专属'}
                  </Badge>
                  <Badge variant={pool.isActive ? 'default' : 'destructive'}>
                    {pool.isActive ? '活跃' : '停用'}
                  </Badge>
                </div>
              </div>
              {pool.description && (
                <CardDescription>{pool.description}</CardDescription>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <Database className="w-4 h-4 text-gray-500" />
                  <span>{pool._count.accountBindings} 个账号</span>
                </div>
                <div className="flex items-center gap-2">
                  <Link2 className="w-4 h-4 text-gray-500" />
                  <span>{pool._count.groupBindings} 个绑定</span>
                </div>
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-gray-500" />
                  <span>{pool.loadBalanceStrategy}</span>
                </div>
                <div className="flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-gray-500" />
                  <span>负载 ≤ {pool.maxLoadPerAccount}%</span>
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-sm font-medium text-gray-700">绑定的服务类型</div>
                <div className="flex flex-wrap gap-1">
                  {[...new Set(pool.accountBindings.map(binding => binding.account.serviceType))].map(serviceType => (
                    <Badge key={serviceType} variant="outline" className="text-xs">
                      {serviceType}
                    </Badge>
                  ))}
                </div>
              </div>

              {isAdmin && (
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="flex-1">
                    <Settings className="w-4 h-4 mr-1" />
                    配置
                  </Button>
                  <Button variant="outline" size="sm" className="flex-1">
                    <Users className="w-4 h-4 mr-1" />
                    绑定
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {pools.length === 0 && !loading && (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <Database className="w-12 h-12 mx-auto text-gray-400 mb-4" />
              <h3 className="text-lg font-medium mb-2">暂无账号池</h3>
              <p className="text-gray-600 mb-4">
                创建账号池来管理和分配AI服务账号
              </p>
              {isAdmin && (
                <Button onClick={() => setCreateDialogOpen(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  创建第一个账号池
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
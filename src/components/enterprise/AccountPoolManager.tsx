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
  const [editingPool, setEditingPool] = useState<AccountPool | null>(null);
  const [bindingDialogOpen, setBindingDialogOpen] = useState(false);
  const [availableAccounts, setAvailableAccounts] = useState<any[]>([]);

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
        resetNewPoolForm();
        alert('账号池创建成功');
      } else {
        alert(data.error || '创建账号池失败');
      }
    } catch (error) {
      console.error('创建账号池失败:', error);
      alert('创建账号池失败');
    }
  };

  const handleUpdatePool = async () => {
    if (!isAdmin || !editingPool) return;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/enterprises/${enterpriseId}/account-pools/${editingPool.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: newPool.name,
          description: newPool.description,
          poolType: newPool.poolType,
          loadBalanceStrategy: newPool.loadBalanceStrategy,
          maxLoadPerAccount: newPool.maxLoadPerAccount,
          priority: newPool.priority
        }),
      });

      const data = await response.json();
      if (data.success) {
        await fetchPools();
        setEditingPool(null);
        resetNewPoolForm();
        alert('账号池更新成功');
      } else {
        alert(data.error || '更新账号池失败');
      }
    } catch (error) {
      console.error('更新账号池失败:', error);
      alert('更新账号池失败');
    }
  };

  const handleDeletePool = async (pool: AccountPool) => {
    if (!isAdmin) return;

    if (!confirm(`确定要删除账号池"${pool.name}"吗？`)) return;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/enterprises/${enterpriseId}/account-pools/${pool.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();
      if (data.success) {
        await fetchPools();
        alert('账号池删除成功');
      } else {
        alert(data.error || '删除账号池失败');
      }
    } catch (error) {
      console.error('删除账号池失败:', error);
      alert('删除账号池失败');
    }
  };

  const fetchAvailableAccounts = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/enterprises/${enterpriseId}/ai-accounts`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();
      if (data.success && Array.isArray(data.data)) {
        setAvailableAccounts(data.data);
      } else {
        setAvailableAccounts([]);
      }
    } catch (error) {
      console.error('获取可用账号失败:', error);
      setAvailableAccounts([]);
    }
  };

  const resetNewPoolForm = () => {
    setNewPool({
      name: '',
      description: '',
      poolType: 'shared',
      loadBalanceStrategy: 'round_robin',
      maxLoadPerAccount: 80,
      priority: 1,
      accountIds: []
    });
  };

  const openEditDialog = (pool: AccountPool) => {
    setEditingPool(pool);
    setNewPool({
      name: pool.name,
      description: pool.description || '',
      poolType: pool.poolType,
      loadBalanceStrategy: pool.loadBalanceStrategy,
      maxLoadPerAccount: pool.maxLoadPerAccount,
      priority: pool.priority,
      accountIds: pool.accountBindings.map(binding => binding.account.id)
    });
  };

  const openBindingDialog = (pool: AccountPool) => {
    setSelectedPool(pool);
    setBindingDialogOpen(true);
    fetchAvailableAccounts();
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
          <Button onClick={() => setCreateDialogOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            创建账号池
          </Button>
        )}
      </div>

      {/* 创建/编辑账号池对话框 */}
      <Dialog 
        open={createDialogOpen || !!editingPool} 
        onOpenChange={(open) => {
          if (!open) {
            setCreateDialogOpen(false);
            setEditingPool(null);
            resetNewPoolForm();
          }
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingPool ? '编辑账号池' : '创建新账号池'}
            </DialogTitle>
            <DialogDescription>
              {editingPool ? '修改账号池配置' : '配置新账号池的基本信息和负载均衡策略'}
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
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      setCreateDialogOpen(false);
                      setEditingPool(null);
                      resetNewPoolForm();
                    }}
                  >
                    取消
                  </Button>
                  <Button 
                    onClick={editingPool ? handleUpdatePool : handleCreatePool} 
                    disabled={!newPool.name}
                  >
                    {editingPool ? '更新' : '创建'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

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
                <div className="grid grid-cols-3 gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => openEditDialog(pool)}
                  >
                    <Settings className="w-4 h-4 mr-1" />
                    编辑
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => openBindingDialog(pool)}
                  >
                    <Users className="w-4 h-4 mr-1" />
                    绑定
                  </Button>
                  <Button 
                    variant="destructive" 
                    size="sm"
                    onClick={() => handleDeletePool(pool)}
                    disabled={pool._count.groupBindings > 0}
                  >
                    删除
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

      {/* 账号绑定对话框 */}
      <Dialog open={bindingDialogOpen} onOpenChange={setBindingDialogOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>管理账号绑定</DialogTitle>
            <DialogDescription>
              为账号池 "{selectedPool?.name}" 配置AI账号绑定
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {selectedPool && (
              <Tabs defaultValue="bound" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="bound">已绑定账号</TabsTrigger>
                  <TabsTrigger value="available">可用账号</TabsTrigger>
                </TabsList>
                
                <TabsContent value="bound" className="space-y-4">
                  <div className="text-sm text-gray-600 mb-4">
                    当前绑定了 {selectedPool.accountBindings.length} 个AI账号
                  </div>
                  <div className="grid gap-3">
                    {selectedPool.accountBindings.map(binding => (
                      <Card key={binding.id} className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <Badge variant="outline">
                              {binding.account.serviceType}
                            </Badge>
                            <div>
                              <div className="font-medium">{binding.account.name}</div>
                              <div className="text-sm text-gray-600">
                                权重: {binding.weight} | 最大负载: {binding.maxLoadPercentage}%
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant={binding.account.status === 'active' ? 'default' : 'secondary'}>
                              {binding.account.status === 'active' ? '活跃' : '停用'}
                            </Badge>
                            <Button variant="outline" size="sm">
                              解绑
                            </Button>
                          </div>
                        </div>
                      </Card>
                    ))}
                    {selectedPool.accountBindings.length === 0 && (
                      <div className="text-center py-8 text-gray-500">
                        暂无绑定的账号
                      </div>
                    )}
                  </div>
                </TabsContent>
                
                <TabsContent value="available" className="space-y-4">
                  <div className="text-sm text-gray-600 mb-4">
                    可绑定 {Array.isArray(availableAccounts) ? availableAccounts.length : 0} 个可用账号
                  </div>
                  <div className="grid gap-3">
                    {Array.isArray(availableAccounts) && availableAccounts.map(account => (
                      <Card key={account.id} className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <Badge variant="outline">
                              {account.serviceType}
                            </Badge>
                            <div>
                              <div className="font-medium">{account.name}</div>
                              <div className="text-sm text-gray-600">
                                ID: {account.id}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant={account.status === 'active' ? 'default' : 'secondary'}>
                              {account.status === 'active' ? '可用' : '不可用'}
                            </Badge>
                            <Button variant="outline" size="sm" disabled={account.status !== 'active'}>
                              绑定
                            </Button>
                          </div>
                        </div>
                      </Card>
                    ))}
                    {(!Array.isArray(availableAccounts) || availableAccounts.length === 0) && (
                      <div className="text-center py-8 text-gray-500">
                        暂无可用账号
                      </div>
                    )}
                  </div>
                </TabsContent>
              </Tabs>
            )}
            
            <div className="flex justify-end">
              <Button variant="outline" onClick={() => setBindingDialogOpen(false)}>
                关闭
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
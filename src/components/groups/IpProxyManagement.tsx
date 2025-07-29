'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { 
  Globe, 
  Plus, 
  Activity, 
  Users, 
  BarChart3,
  RefreshCw,
  Edit,
  Trash2,
  CheckCircle,
  Pause,
  AlertTriangle,
  TrendingUp,
  Copy,
  Eye,
  EyeOff,
  Monitor
} from 'lucide-react';
import { IpProxyRealTimeMonitor } from './IpProxyRealTimeMonitor';

interface IpProxyConfig {
  id: string;
  name: string;
  description?: string;
  proxyType: string;
  host: string;
  port: number;
  username?: string;
  password?: string;
  location?: string;
  isEnabled: boolean;
  maxConnections: number;
  currentConnections: number;
  trafficUsed: bigint;
  trafficLimit?: bigint;
  status: string;
  lastCheckAt?: string;
  responseTime?: number;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
  usageLogs?: any[];
  memberConfigs?: any[];
  _count?: {
    usageLogs: number;
    memberConfigs: number;
  };
}

interface IpProxyManagementProps {
  groupId: string;
  isAdmin: boolean;
}

export function IpProxyManagement({ groupId, isAdmin }: IpProxyManagementProps) {
  const [proxyConfigs, setProxyConfigs] = useState<IpProxyConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // 创建代理配置相关状态
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState('');
  const [createForm, setCreateForm] = useState({
    name: '',
    description: '',
    proxyType: 'http',
    host: '',
    port: 8080,
    username: '',
    password: '',
    location: '',
    maxConnections: 10,
    trafficLimit: 0
  });

  // 编辑代理配置相关状态
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingProxy, setEditingProxy] = useState<IpProxyConfig | null>(null);
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState('');

  // 统计数据相关状态
  const [statsData, setStatsData] = useState<any>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsPeriod, setStatsPeriod] = useState('7d');

  // 成员配置同步状态
  const [syncData, setSyncData] = useState<any>(null);
  const [syncLoading, setSyncLoading] = useState(false);

  // 密码显示状态
  const [showPasswords, setShowPasswords] = useState<{[key: string]: boolean}>({});

  // 实时监控相关状态
  const [showMonitorDialog, setShowMonitorDialog] = useState(false);
  const [monitoringProxy, setMonitoringProxy] = useState<IpProxyConfig | null>(null);

  // 获取IP代理配置列表
  const fetchProxyConfigs = async () => {
    setLoading(true);
    setError('');

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/groups/${groupId}/ip-proxy`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();
      if (data.success) {
        setProxyConfigs(data.data);
      } else {
        setError(data.error || '获取IP代理配置失败');
      }
    } catch (error) {
      console.error('获取IP代理配置失败:', error);
      setError('网络错误，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  // 创建IP代理配置
  const handleCreateProxy = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateLoading(true);
    setCreateError('');

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/groups/${groupId}/ip-proxy`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...createForm,
          trafficLimit: createForm.trafficLimit > 0 ? createForm.trafficLimit : undefined
        }),
      });

      const data = await response.json();
      if (data.success) {
        setShowCreateDialog(false);
        setCreateForm({
          name: '',
          description: '',
          proxyType: 'http',
          host: '',
          port: 8080,
          username: '',
          password: '',
          location: '',
          maxConnections: 10,
          trafficLimit: 0
        });
        fetchProxyConfigs();
      } else {
        setCreateError(data.error || '创建代理配置失败');
      }
    } catch (error) {
      console.error('创建代理配置失败:', error);
      setCreateError('网络错误，请稍后重试');
    } finally {
      setCreateLoading(false);
    }
  };

  // 编辑IP代理配置
  const handleEditProxy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProxy) return;

    setEditLoading(true);
    setEditError('');

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/groups/${groupId}/ip-proxy/${editingProxy.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: editingProxy.name,
          description: editingProxy.description,
          proxyType: editingProxy.proxyType,
          host: editingProxy.host,
          port: editingProxy.port,
          username: editingProxy.username,
          password: editingProxy.password,
          location: editingProxy.location,
          maxConnections: editingProxy.maxConnections,
          trafficLimit: editingProxy.trafficLimit ? Number(editingProxy.trafficLimit) / (1024 * 1024) : undefined,
          isEnabled: editingProxy.isEnabled
        }),
      });

      const data = await response.json();
      if (data.success) {
        setShowEditDialog(false);
        setEditingProxy(null);
        fetchProxyConfigs();
      } else {
        setEditError(data.error || '更新代理配置失败');
      }
    } catch (error) {
      console.error('更新代理配置失败:', error);
      setEditError('网络错误，请稍后重试');
    } finally {
      setEditLoading(false);
    }
  };

  // 删除IP代理配置
  const handleDeleteProxy = async (proxyId: string) => {
    if (!confirm('确定要删除这个代理配置吗？此操作不可恢复。')) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/groups/${groupId}/ip-proxy/${proxyId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();
      if (data.success) {
        fetchProxyConfigs();
      } else {
        alert(data.error || '删除代理配置失败');
      }
    } catch (error) {
      console.error('删除代理配置失败:', error);
      alert('网络错误，请稍后重试');
    }
  };

  // 获取统计数据
  const fetchStats = async (proxyId: string) => {
    setStatsLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/groups/${groupId}/ip-proxy/${proxyId}/stats?period=${statsPeriod}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();
      if (data.success) {
        setStatsData(data.data);
      }
    } catch (error) {
      console.error('获取统计数据失败:', error);
    } finally {
      setStatsLoading(false);
    }
  };

  // 获取同步状态
  const fetchSyncStatus = async (proxyId: string) => {
    setSyncLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/groups/${groupId}/ip-proxy/${proxyId}/sync`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();
      if (data.success) {
        setSyncData(data.data);
      }
    } catch (error) {
      console.error('获取同步状态失败:', error);
    } finally {
      setSyncLoading(false);
    }
  };

  // 触发配置同步
  const handleSyncConfig = async (proxyId: string, userIds?: string[]) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/groups/${groupId}/ip-proxy/${proxyId}/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          userIds,
          forceSync: false
        }),
      });

      const data = await response.json();
      if (data.success) {
        alert(data.message);
        fetchSyncStatus(proxyId);
      } else {
        alert(data.error || '同步配置失败');
      }
    } catch (error) {
      console.error('同步配置失败:', error);
      alert('网络错误，请稍后重试');
    }
  };

  // 切换密码显示状态
  const togglePasswordVisibility = (proxyId: string) => {
    setShowPasswords(prev => ({
      ...prev,
      [proxyId]: !prev[proxyId]
    }));
  };

  // 打开实时监控
  const handleOpenMonitor = (proxy: IpProxyConfig) => {
    setMonitoringProxy(proxy);
    setShowMonitorDialog(true);
  };

  // 复制配置信息
  const copyProxyConfig = async (proxy: IpProxyConfig) => {
    const configText = `代理类型: ${proxy.proxyType.toUpperCase()}
主机地址: ${proxy.host}
端口: ${proxy.port}
用户名: ${proxy.username || '无'}
密码: ${proxy.password || '无'}
位置: ${proxy.location || '未知'}`;

    try {
      await navigator.clipboard.writeText(configText);
      alert('代理配置已复制到剪贴板');
    } catch (error) {
      console.error('复制失败:', error);
      alert('复制失败，请手动复制');
    }
  };

  // 格式化流量显示
  const formatTraffic = (bytes: bigint | number) => {
    const numBytes = typeof bytes === 'bigint' ? Number(bytes) : bytes;
    const mb = numBytes / (1024 * 1024);
    if (mb < 1024) {
      return `${mb.toFixed(2)} MB`;
    }
    const gb = mb / 1024;
    return `${gb.toFixed(2)} GB`;
  };

  // 计算流量使用百分比
  const getTrafficUsagePercent = (used: bigint | number, limit?: bigint | number) => {
    const numUsed = typeof used === 'bigint' ? Number(used) : used;
    const numLimit = typeof limit === 'bigint' ? Number(limit) : (limit || 0);
    if (!numLimit || numLimit === 0) return 0;
    return Math.min((numUsed / numLimit) * 100, 100);
  };

  useEffect(() => {
    fetchProxyConfigs();
  }, [groupId]);

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto mb-4"></div>
            <div className="text-gray-600">加载中...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <div className="text-center">
            <div className="text-red-500 mb-4">{error}</div>
            <Button onClick={fetchProxyConfigs}>重试</Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* 概览统计 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center">
              <Globe className="w-5 h-5 text-blue-600 mr-3" />
              <div>
                <div className="text-2xl font-bold">{proxyConfigs.length}</div>
                <div className="text-sm text-gray-600">代理配置</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center">
              <Activity className="w-5 h-5 text-green-600 mr-3" />
              <div>
                <div className="text-2xl font-bold">
                  {proxyConfigs.filter(p => p.status === 'active').length}
                </div>
                <div className="text-sm text-gray-600">活跃代理</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center">
              <Users className="w-5 h-5 text-purple-600 mr-3" />
              <div>
                <div className="text-2xl font-bold">
                  {proxyConfigs.reduce((sum, p) => sum + (Number(p.currentConnections) || 0), 0)}
                </div>
                <div className="text-sm text-gray-600">当前连接</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center">
              <TrendingUp className="w-5 h-5 text-orange-600 mr-3" />
              <div>
                <div className="text-2xl font-bold">
                  {formatTraffic(proxyConfigs.reduce((sum, p) => sum + Number(p.trafficUsed || 0), 0))}
                </div>
                <div className="text-sm text-gray-600">总流量</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 主要内容区域 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>IP代理管理</CardTitle>
              <CardDescription>
                管理拼车组的IP代理配置和使用统计
              </CardDescription>
            </div>
            <div className="flex items-center space-x-2">
              <Button variant="outline" onClick={fetchProxyConfigs}>
                <RefreshCw className="w-4 h-4 mr-2" />
                刷新
              </Button>
              {isAdmin && (
                <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="w-4 h-4 mr-2" />
                      添加代理
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl">
                    <DialogHeader>
                      <DialogTitle>添加IP代理配置</DialogTitle>
                      <DialogDescription>
                        创建新的IP代理配置并同步给拼车组成员
                      </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleCreateProxy} className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="name">代理名称</Label>
                          <Input
                            id="name"
                            value={createForm.name}
                            onChange={(e) => setCreateForm({...createForm, name: e.target.value})}
                            required
                            disabled={createLoading}
                            placeholder="请输入代理名称"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="proxyType">代理类型</Label>
                          <Select 
                            value={createForm.proxyType} 
                            onValueChange={(value) => setCreateForm({...createForm, proxyType: value})}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="http">HTTP</SelectItem>
                              <SelectItem value="https">HTTPS</SelectItem>
                              <SelectItem value="socks5">SOCKS5</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="host">主机地址</Label>
                          <Input
                            id="host"
                            value={createForm.host}
                            onChange={(e) => setCreateForm({...createForm, host: e.target.value})}
                            required
                            disabled={createLoading}
                            placeholder="例如: proxy.example.com"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="port">端口</Label>
                          <Input
                            id="port"
                            type="number"
                            min="1"
                            max="65535"
                            value={createForm.port}
                            onChange={(e) => setCreateForm({...createForm, port: parseInt(e.target.value) || 8080})}
                            required
                            disabled={createLoading}
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="username">用户名（可选）</Label>
                          <Input
                            id="username"
                            value={createForm.username}
                            onChange={(e) => setCreateForm({...createForm, username: e.target.value})}
                            disabled={createLoading}
                            placeholder="代理认证用户名"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="password">密码（可选）</Label>
                          <Input
                            id="password"
                            type="password"
                            value={createForm.password}
                            onChange={(e) => setCreateForm({...createForm, password: e.target.value})}
                            disabled={createLoading}
                            placeholder="代理认证密码"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="location">位置（可选）</Label>
                          <Input
                            id="location"
                            value={createForm.location}
                            onChange={(e) => setCreateForm({...createForm, location: e.target.value})}
                            disabled={createLoading}
                            placeholder="例如: 美国东部"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="maxConnections">最大连接数</Label>
                          <Input
                            id="maxConnections"
                            type="number"
                            min="1"
                            max="1000"
                            value={createForm.maxConnections}
                            onChange={(e) => setCreateForm({...createForm, maxConnections: parseInt(e.target.value) || 10})}
                            disabled={createLoading}
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="trafficLimit">流量限制（GB，0表示无限制）</Label>
                        <Input
                          id="trafficLimit"
                          type="number"
                          min="0"
                          value={createForm.trafficLimit}
                          onChange={(e) => setCreateForm({...createForm, trafficLimit: parseInt(e.target.value) || 0})}
                          disabled={createLoading}
                          placeholder="0"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="description">描述（可选）</Label>
                        <Textarea
                          id="description"
                          value={createForm.description}
                          onChange={(e) => setCreateForm({...createForm, description: e.target.value})}
                          disabled={createLoading}
                          placeholder="代理配置描述"
                          rows={3}
                        />
                      </div>

                      {createError && (
                        <div className="text-red-500 text-sm">{createError}</div>
                      )}

                      <div className="flex space-x-2">
                        <Button type="submit" disabled={createLoading}>
                          {createLoading ? '创建中...' : '创建代理'}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setShowCreateDialog(false)}
                          disabled={createLoading}
                        >
                          取消
                        </Button>
                      </div>
                    </form>
                  </DialogContent>
                </Dialog>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {proxyConfigs.length > 0 ? (
            <div className="space-y-4">
              {proxyConfigs.map((proxy) => (
                <Card key={proxy.id} className="border-l-4 border-l-blue-500">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <h3 className="text-lg font-semibold">{proxy.name}</h3>
                          <Badge variant={proxy.status === 'active' ? 'default' : 'secondary'}>
                            {proxy.status === 'active' ? '活跃' : '禁用'}
                          </Badge>
                          <Badge variant="outline">
                            {proxy.proxyType.toUpperCase()}
                          </Badge>
                          {proxy.isEnabled ? (
                            <Badge variant="default" className="bg-green-100 text-green-800">
                              <CheckCircle className="w-3 h-3 mr-1" />
                              启用
                            </Badge>
                          ) : (
                            <Badge variant="secondary">
                              <Pause className="w-3 h-3 mr-1" />
                              禁用
                            </Badge>
                          )}
                        </div>
                        {proxy.description && (
                          <p className="text-gray-600 text-sm mb-2">{proxy.description}</p>
                        )}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <span className="text-gray-500">地址:</span>
                            <div className="font-mono">{proxy.host}:{proxy.port}</div>
                          </div>
                          <div>
                            <span className="text-gray-500">位置:</span>
                            <div>{proxy.location || '未知'}</div>
                          </div>
                          <div>
                            <span className="text-gray-500">连接:</span>
                            <div>{proxy.currentConnections}/{proxy.maxConnections}</div>
                          </div>
                          <div>
                            <span className="text-gray-500">响应时间:</span>
                            <div>{proxy.responseTime ? `${proxy.responseTime}ms` : '未知'}</div>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyProxyConfig(proxy)}
                          title="复制配置"
                        >
                          <Copy className="w-4 h-4" />
                        </Button>
                        {isAdmin && (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setEditingProxy(proxy);
                                setShowEditDialog(true);
                              }}
                              title="编辑配置"
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteProxy(proxy.id)}
                              title="删除配置"
                              className="text-red-600 hover:text-red-700"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>

                    {/* 流量使用进度条 */}
                    {proxy.trafficLimit && proxy.trafficLimit > BigInt(0) && (
                      <div className="mb-4">
                        <div className="flex justify-between text-sm mb-1">
                          <span>流量使用</span>
                          <span>
                            {formatTraffic(proxy.trafficUsed)} / {formatTraffic(proxy.trafficLimit)}
                          </span>
                        </div>
                        <Progress 
                          value={getTrafficUsagePercent(proxy.trafficUsed, proxy.trafficLimit)} 
                          className="h-2"
                        />
                      </div>
                    )}

                    {/* 认证信息 */}
                    {(proxy.username || proxy.password) && (
                      <div className="bg-gray-50 rounded-lg p-3 mb-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-gray-700">认证信息</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => togglePasswordVisibility(proxy.id)}
                            className="h-6 w-6 p-0"
                          >
                            {showPasswords[proxy.id] ? (
                              <EyeOff className="w-3 h-3" />
                            ) : (
                              <Eye className="w-3 h-3" />
                            )}
                          </Button>
                        </div>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="text-gray-500">用户名:</span>
                            <div className="font-mono">{proxy.username || '无'}</div>
                          </div>
                          <div>
                            <span className="text-gray-500">密码:</span>
                            <div className="font-mono">
                              {proxy.password ? (
                                showPasswords[proxy.id] ? proxy.password : '••••••••'
                              ) : '无'}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* 统计信息 */}
                    <div className="grid grid-cols-3 gap-4 text-center border-t pt-4">
                      <div>
                        <div className="text-lg font-semibold">{proxy._count?.usageLogs || 0}</div>
                        <div className="text-sm text-gray-500">总连接数</div>
                      </div>
                      <div>
                        <div className="text-lg font-semibold">{proxy._count?.memberConfigs || 0}</div>
                        <div className="text-sm text-gray-500">配置成员</div>
                      </div>
                      <div>
                        <div className="text-lg font-semibold">{formatTraffic(proxy.trafficUsed || 0)}</div>
                        <div className="text-sm text-gray-500">已用流量</div>
                      </div>
                    </div>

                    {/* 操作按钮 */}
                    {isAdmin && (
                      <div className="flex justify-end space-x-2 mt-4 pt-4 border-t">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenMonitor(proxy)}
                        >
                          <Monitor className="w-4 h-4 mr-2" />
                          实时监控
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => fetchStats(proxy.id)}
                        >
                          <BarChart3 className="w-4 h-4 mr-2" />
                          查看统计
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => fetchSyncStatus(proxy.id)}
                        >
                          <Users className="w-4 h-4 mr-2" />
                          同步状态
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleSyncConfig(proxy.id)}
                        >
                          <RefreshCw className="w-4 h-4 mr-2" />
                          同步配置
                        </Button>
                      </div>
                    )}

                    {/* 错误信息 */}
                    {proxy.errorMessage && (
                      <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                        <div className="flex items-start">
                          <AlertTriangle className="w-5 h-5 text-red-600 mr-2 mt-0.5 flex-shrink-0" />
                          <div>
                            <div className="text-red-800 font-medium mb-1">代理错误</div>
                            <div className="text-red-700 text-sm">{proxy.errorMessage}</div>
                          </div>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <Globe className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                还没有IP代理配置
              </h3>
              <p className="text-gray-500 mb-4">
                创建第一个IP代理配置来开始使用代理服务
              </p>
              {isAdmin && (
                <Button onClick={() => setShowCreateDialog(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  添加代理配置
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 实时监控对话框 */}
      <Dialog open={showMonitorDialog} onOpenChange={setShowMonitorDialog}>
        <DialogContent className="max-w-7xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>实时监控</DialogTitle>
            <DialogDescription>
              {monitoringProxy?.name} 的实时监控数据
            </DialogDescription>
          </DialogHeader>
          {monitoringProxy && (
            <IpProxyRealTimeMonitor
              groupId={groupId}
              proxyId={monitoringProxy.id}
              proxyName={monitoringProxy.name}
              isAdmin={isAdmin}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

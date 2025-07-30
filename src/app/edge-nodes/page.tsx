'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Server, 
  Plus, 
  Activity, 
  Settings, 
  RefreshCw,
  CheckCircle,
  AlertTriangle,
  XCircle,
  MapPin,
  Cpu,
  HardDrive,
  Network,
  Users,
  Clock,
  TrendingUp
} from 'lucide-react';

interface EdgeNode {
  id: string;
  nodeId: string;
  serverId?: string;
  nodeName: string;
  location: string;
  endpoint: string;
  status: 'active' | 'inactive' | 'maintenance';
  capabilities: {
    cpu: { cores: number; frequency: string };
    memory: { total: string; available: string };
    network: { bandwidth: string; latency: number };
    maxConnections: number;
  };
  currentLoad: {
    cpu: number;
    memory: number;
    connections: number;
    requestsPerSecond: number;
  };
  healthScore: number;
  lastHeartbeat?: Date;
  version: string;
}

export default function EdgeNodesPage() {
  const [nodes, setNodes] = useState<EdgeNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [showRegisterDialog, setShowRegisterDialog] = useState(false);
  const [registerLoading, setRegisterLoading] = useState(false);
  const router = useRouter();

  // 节点注册表单状态
  const [nodeName, setNodeName] = useState('');
  const [location, setLocation] = useState('');
  const [endpoint, setEndpoint] = useState('');
  const [cpuCores, setCpuCores] = useState('');
  const [cpuFreq, setCpuFreq] = useState('');
  const [memoryTotal, setMemoryTotal] = useState('');
  const [bandwidth, setBandwidth] = useState('');
  const [maxConnections, setMaxConnections] = useState('');

  useEffect(() => {
    fetchNodes();
    // 每30秒自动刷新
    const interval = setInterval(fetchNodes, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchNodes = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        router.push('/auth/login');
        return;
      }

      const response = await fetch('/api/edge-nodes', {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      const data = await response.json();
      if (data.success) {
        setNodes(data.data.nodes || []);
      }
    } catch (error) {
      console.error('获取边缘节点失败:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchNodes();
  };

  const handleRegisterNode = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegisterLoading(true);

    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/edge-nodes/register', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          nodeName,
          location,
          endpoint,
          capabilities: {
            cpu: {
              cores: parseInt(cpuCores),
              frequency: cpuFreq,
            },
            memory: {
              total: memoryTotal,
              available: memoryTotal,
            },
            network: {
              bandwidth,
              latency: 10,
            },
            maxConnections: parseInt(maxConnections),
          },
        }),
      });

      const data = await response.json();
      if (data.success) {
        setShowRegisterDialog(false);
        resetForm();
        await fetchNodes();
        alert('节点注册成功！');
      } else {
        alert(`注册失败: ${data.error}`);
      }
    } catch (error) {
      alert('网络错误，请稍后重试');
    } finally {
      setRegisterLoading(false);
    }
  };

  const resetForm = () => {
    setNodeName('');
    setLocation('');
    setEndpoint('');
    setCpuCores('');
    setCpuFreq('');
    setMemoryTotal('');
    setBandwidth('');
    setMaxConnections('');
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'default';
      case 'inactive':
        return 'destructive';
      case 'maintenance':
        return 'secondary';
      default:
        return 'default';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'active':
        return '在线';
      case 'inactive':
        return '离线';
      case 'maintenance':
        return '维护中';
      default:
        return status;
    }
  };

  const getHealthIcon = (score: number) => {
    if (score >= 80) return <CheckCircle className="w-5 h-5 text-green-600" />;
    if (score >= 50) return <AlertTriangle className="w-5 h-5 text-yellow-600" />;
    return <XCircle className="w-5 h-5 text-red-600" />;
  };

  const getHealthColor = (score: number) => {
    if (score >= 80) return 'text-green-600 bg-green-50';
    if (score >= 50) return 'text-yellow-600 bg-yellow-50';
    return 'text-red-600 bg-red-50';
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-lg">加载边缘节点数据...</div>
        </div>
      </div>
    );
  }

  const activeNodes = nodes.filter(node => node.status === 'active');
  const totalLoad = activeNodes.reduce((sum, node) => sum + node.currentLoad.cpu, 0) / Math.max(activeNodes.length, 1);
  const totalConnections = activeNodes.reduce((sum, node) => sum + node.currentLoad.connections, 0);

  return (
    <div className="p-6">
      {/* Page Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">边缘节点</h1>
          <p className="text-gray-600 mt-1">管理分布式边缘节点和负载均衡</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            刷新
          </Button>
          <Dialog open={showRegisterDialog} onOpenChange={setShowRegisterDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              注册节点
            </Button>
          </DialogTrigger>
                <DialogContent className="sm:max-w-[600px]">
                  <DialogHeader>
                    <DialogTitle>注册边缘节点</DialogTitle>
                    <DialogDescription>
                      添加新的边缘节点到网络中
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleRegisterNode} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="nodeName">节点名称</Label>
                        <Input
                          id="nodeName"
                          value={nodeName}
                          onChange={(e) => setNodeName(e.target.value)}
                          required
                          placeholder="输入节点名称"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="location">地理位置</Label>
                        <Select value={location} onValueChange={setLocation}>
                          <SelectTrigger>
                            <SelectValue placeholder="选择地理位置" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="北京">北京</SelectItem>
                            <SelectItem value="上海">上海</SelectItem>
                            <SelectItem value="广州">广州</SelectItem>
                            <SelectItem value="深圳">深圳</SelectItem>
                            <SelectItem value="杭州">杭州</SelectItem>
                            <SelectItem value="成都">成都</SelectItem>
                            <SelectItem value="香港">香港</SelectItem>
                            <SelectItem value="新加坡">新加坡</SelectItem>
                            <SelectItem value="东京">东京</SelectItem>
                            <SelectItem value="首尔">首尔</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="endpoint">节点端点</Label>
                      <Input
                        id="endpoint"
                        value={endpoint}
                        onChange={(e) => setEndpoint(e.target.value)}
                        required
                        placeholder="https://node.example.com:8080"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="cpuCores">CPU核心数</Label>
                        <Input
                          id="cpuCores"
                          type="number"
                          value={cpuCores}
                          onChange={(e) => setCpuCores(e.target.value)}
                          required
                          placeholder="4"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="cpuFreq">CPU频率</Label>
                        <Input
                          id="cpuFreq"
                          value={cpuFreq}
                          onChange={(e) => setCpuFreq(e.target.value)}
                          required
                          placeholder="2.4GHz"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="memoryTotal">内存容量</Label>
                        <Input
                          id="memoryTotal"
                          value={memoryTotal}
                          onChange={(e) => setMemoryTotal(e.target.value)}
                          required
                          placeholder="8GB"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="bandwidth">网络带宽</Label>
                        <Input
                          id="bandwidth"
                          value={bandwidth}
                          onChange={(e) => setBandwidth(e.target.value)}
                          required
                          placeholder="1Gbps"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="maxConnections">最大连接数</Label>
                      <Input
                        id="maxConnections"
                        type="number"
                        value={maxConnections}
                        onChange={(e) => setMaxConnections(e.target.value)}
                        required
                        placeholder="1000"
                      />
                    </div>

                    <div className="flex justify-end space-x-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setShowRegisterDialog(false)}
                        disabled={registerLoading}
                      >
                        取消
                      </Button>
                      <Button type="submit" disabled={registerLoading}>
                        {registerLoading ? '注册中...' : '注册节点'}
                      </Button>
                    </div>
                  </form>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      {/* Main Content */}
      <div>
        {/* 统计卡片 */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <Server className="w-5 h-5 text-blue-600 mr-3" />
                <div>
                  <div className="text-2xl font-bold">{nodes.length}</div>
                  <div className="text-sm text-gray-600">总节点数</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <CheckCircle className="w-5 h-5 text-green-600 mr-3" />
                <div>
                  <div className="text-2xl font-bold">{activeNodes.length}</div>
                  <div className="text-sm text-gray-600">在线节点</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <Cpu className="w-5 h-5 text-purple-600 mr-3" />
                <div>
                  <div className="text-2xl font-bold">{totalLoad.toFixed(1)}%</div>
                  <div className="text-sm text-gray-600">平均负载</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <Users className="w-5 h-5 text-orange-600 mr-3" />
                <div>
                  <div className="text-2xl font-bold">{totalConnections}</div>
                  <div className="text-sm text-gray-600">总连接数</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="overview">节点概览</TabsTrigger>
            <TabsTrigger value="performance">性能监控</TabsTrigger>
            <TabsTrigger value="configuration">负载配置</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            {nodes.length > 0 ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                {nodes.map((node) => (
                  <Card key={node.id}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="flex items-center gap-2">
                            <Server className="w-5 h-5" />
                            {node.nodeName}
                          </CardTitle>
                          <CardDescription className="flex items-center gap-2 mt-1">
                            <MapPin className="w-4 h-4" />
                            {node.location}
                          </CardDescription>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <Badge variant={getStatusColor(node.status)}>
                            {getStatusText(node.status)}
                          </Badge>
                          <div className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs ${getHealthColor(node.healthScore)}`}>
                            {getHealthIcon(node.healthScore)}
                            健康度 {node.healthScore}
                          </div>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* 性能指标 */}
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div className="flex items-center gap-2">
                          <Cpu className="w-4 h-4 text-blue-500" />
                          <span>CPU: {node.currentLoad.cpu}%</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <HardDrive className="w-4 h-4 text-green-500" />
                          <span>内存: {node.currentLoad.memory}%</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Users className="w-4 h-4 text-purple-500" />
                          <span>连接: {node.currentLoad.connections}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Network className="w-4 h-4 text-orange-500" />
                          <span>RPS: {node.currentLoad.requestsPerSecond}</span>
                        </div>
                      </div>

                      {/* 规格信息 */}
                      <div className="bg-gray-50 p-3 rounded-lg">
                        <div className="text-sm font-medium mb-2">节点规格</div>
                        <div className="text-xs text-gray-600 space-y-1">
                          <div>CPU: {node.capabilities.cpu.cores}核 {node.capabilities.cpu.frequency}</div>
                          <div>内存: {node.capabilities.memory.total}</div>
                          <div>带宽: {node.capabilities.network.bandwidth}</div>
                          <div>最大连接: {node.capabilities.maxConnections}</div>
                        </div>
                      </div>

                      {/* 最后心跳 */}
                      <div className="flex items-center justify-between text-xs text-gray-500">
                        <span>版本: {node.version}</span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {node.lastHeartbeat 
                            ? `${Math.floor((Date.now() - new Date(node.lastHeartbeat).getTime()) / 60000)}分钟前`
                            : '无心跳'}
                        </span>
                      </div>

                      {/* 操作按钮 */}
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" className="flex-1">
                          <Settings className="w-4 h-4 mr-1" />
                          配置
                        </Button>
                        <Button variant="outline" size="sm" className="flex-1">
                          <Activity className="w-4 h-4 mr-1" />
                          监控
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <Server className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  暂无边缘节点
                </h3>
                <p className="text-gray-500 mb-4">
                  还没有注册任何边缘节点
                </p>
                <Button onClick={() => setShowRegisterDialog(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  注册第一个节点
                </Button>
              </div>
            )}
          </TabsContent>

          <TabsContent value="performance" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>性能监控</CardTitle>
                <CardDescription>边缘节点性能指标和趋势分析</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8">
                  <TrendingUp className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    性能图表功能开发中
                  </h3>
                  <p className="text-gray-500 mb-4">
                    将显示节点CPU、内存、网络等性能指标的实时图表
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="configuration" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>负载均衡配置</CardTitle>
                <CardDescription>配置节点间的负载均衡策略</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8">
                  <Settings className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    负载均衡配置功能开发中
                  </h3>
                  <p className="text-gray-500 mb-4">
                    将支持轮询、最少连接、加权轮询等多种负载均衡算法配置
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
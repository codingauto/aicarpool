'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { 
  Server, 
  Globe, 
  Settings, 
  Info, 
  CheckCircle,
  AlertTriangle,
  Network,
  Zap,
  Shield,
  Clock,
  Users,
  Loader2
} from 'lucide-react';
import { toast } from 'sonner';

interface DeploymentMode {
  id: string;
  mode: 'centralized' | 'distributed';
  config: any;
  isActive: boolean;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

interface DeploymentModeConfigProps {
  groupId: string;
  isAdmin: boolean;
}

const deploymentModes = [
  {
    value: 'centralized',
    label: 'IP代理模式',
    icon: Globe,
    description: '通过IP代理服务器转发请求，简单易用的部署方式',
    benefits: [
      '部署简单，单一服务器管理',
      '成本较低，适合中小规模',
      '配置集中，维护方便',
      '快速启动项目'
    ],
    drawbacks: [
      '可能存在地理延迟',
      '单点故障风险',
      '扩展能力有限'
    ],
    recommendedFor: '拼车组 < 10个，用户 < 100人',
    techSpecs: {
      maxGroups: 50,
      maxUsers: 500,
      avgLatency: '100-300ms',
      availability: '99.5%'
    }
  },
  {
    value: 'distributed',
    label: '边缘节点模式',
    icon: Network,
    description: '通过分布在不同地理位置的边缘节点就近处理请求',
    benefits: [
      '就近处理，延迟更低',
      '水平扩展能力强',
      '高可用性，容错能力好',
      '适合大规模部署'
    ],
    drawbacks: [
      '部署复杂，多节点管理',
      '初期成本较高',
      '运维复杂度增加'
    ],
    recommendedFor: '拼车组 > 20个，用户 > 200人',
    techSpecs: {
      maxGroups: 'unlimited',
      maxUsers: 'unlimited',
      avgLatency: '10-50ms',
      availability: '99.9%'
    }
  }
];

export function DeploymentModeConfig({ groupId, isAdmin }: DeploymentModeConfigProps) {
  const [currentMode, setCurrentMode] = useState<DeploymentMode | null>(null);
  const [loading, setLoading] = useState(true);
  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  const [selectedMode, setSelectedMode] = useState<string>('');
  const [switchingMode, setSwitchingMode] = useState(false);

  // 配置表单状态
  const [modeConfig, setModeConfig] = useState({
    enableHealthCheck: true,
    healthCheckInterval: 300,
    enableFailover: true,
    maxRetries: 3,
    requestTimeout: 30,
    enableLoadBalancing: true,
    loadBalanceStrategy: 'round_robin',
    enableGeoRouting: false,
    preferredRegions: [] as string[],
    enableSessionStickiness: false,
    sessionTtl: 3600,
  });

  useEffect(() => {
    fetchCurrentMode();
  }, [groupId]);

  const fetchCurrentMode = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const response = await fetch(`/api/groups/${groupId}/deployment-modes`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const result = await response.json();
      if (result.success) {
        const activeMode = result.data.find((mode: DeploymentMode) => mode.isActive);
        setCurrentMode(activeMode || null);
        if (activeMode) {
          setModeConfig(activeMode.config || modeConfig);
        }
      } else {
        toast.error(result.message || '获取部署模式失败');
      }
    } catch (error) {
      console.error('Failed to fetch deployment mode:', error);
      toast.error('获取部署模式失败');
    } finally {
      setLoading(false);
    }
  };

  const handleModeSwitch = async () => {
    if (!selectedMode) return;

    setSwitchingMode(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const payload = {
        mode: selectedMode,
        config: modeConfig,
        description: `切换到${deploymentModes.find(m => m.value === selectedMode)?.label}`,
      };

      const response = await fetch(`/api/groups/${groupId}/deployment-modes`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json();
      if (result.success) {
        toast.success('部署模式切换成功');
        setConfigDialogOpen(false);
        fetchCurrentMode();
      } else {
        toast.error(result.message || '切换失败');
      }
    } catch (error) {
      console.error('Failed to switch mode:', error);
      toast.error('切换失败');
    } finally {
      setSwitchingMode(false);
    }
  };

  const getCurrentModeInfo = () => {
    if (!currentMode) return null;
    return deploymentModes.find(mode => mode.value === currentMode.mode);
  };

  const currentModeInfo = getCurrentModeInfo();

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          <span className="ml-2 text-gray-500">加载中...</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* 当前部署模式状态 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Settings className="w-5 h-5 mr-2" />
            当前部署模式
          </CardTitle>
          <CardDescription>
            当前拼车组使用的部署架构模式
          </CardDescription>
        </CardHeader>
        <CardContent>
          {currentMode && currentModeInfo ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <currentModeInfo.icon className="w-8 h-8 text-blue-600" />
                  <div>
                    <h3 className="text-lg font-semibold">{currentModeInfo.label}</h3>
                    <p className="text-sm text-gray-600">{currentModeInfo.description}</p>
                  </div>
                </div>
                <Badge variant="default" className="bg-green-100 text-green-800">
                  <CheckCircle className="w-3 h-3 mr-1" />
                  当前激活
                </Badge>
              </div>

              {/* 技术规格 */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-gray-50 rounded-lg">
                <div className="text-center">
                  <div className="text-sm text-gray-500">最大组数</div>
                  <div className="font-semibold">{currentModeInfo.techSpecs.maxGroups}</div>
                </div>
                <div className="text-center">
                  <div className="text-sm text-gray-500">最大用户</div>
                  <div className="font-semibold">{currentModeInfo.techSpecs.maxUsers}</div>
                </div>
                <div className="text-center">
                  <div className="text-sm text-gray-500">平均延迟</div>
                  <div className="font-semibold">{currentModeInfo.techSpecs.avgLatency}</div>
                </div>
                <div className="text-center">
                  <div className="text-sm text-gray-500">可用性</div>
                  <div className="font-semibold">{currentModeInfo.techSpecs.availability}</div>
                </div>
              </div>

              {isAdmin && (
                <div className="flex justify-end">
                  <Dialog open={configDialogOpen} onOpenChange={setConfigDialogOpen}>
                    <DialogTrigger asChild>
                      <Button 
                        variant="outline"
                        onClick={() => setSelectedMode('centralized')} // 默认选中IP代理模式
                      >
                        <Settings className="w-4 h-4 mr-2" />
                        切换模式
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[700px] max-h-[80vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle>切换部署模式</DialogTitle>
                        <DialogDescription>
                          选择适合您业务规模的部署架构模式
                        </DialogDescription>
                      </DialogHeader>
                      
                      <div className="space-y-6">
                        {/* 模式选择 */}
                        <div className="space-y-4">
                          <Label>选择部署模式</Label>
                          <div className="grid grid-cols-1 gap-4">
                            {deploymentModes.map((mode) => {
                              const Icon = mode.icon;
                              return (
                                <Card 
                                  key={mode.value}
                                  className={`cursor-pointer transition-all ${
                                    selectedMode === mode.value 
                                      ? 'ring-2 ring-blue-500 bg-blue-50' 
                                      : 'hover:bg-gray-50'
                                  }`}
                                  onClick={() => setSelectedMode(mode.value)}
                                >
                                  <CardContent className="p-4">
                                    <div className="flex items-start space-x-3">
                                      <div className="flex items-center space-x-2">
                                        <input
                                          type="radio"
                                          checked={selectedMode === mode.value}
                                          onChange={() => setSelectedMode(mode.value)}
                                          className="w-4 h-4"
                                        />
                                        <Icon className="w-6 h-6 text-blue-600" />
                                      </div>
                                      <div className="flex-1">
                                        <h4 className="font-semibold">{mode.label}</h4>
                                        <p className="text-sm text-gray-600 mb-2">{mode.description}</p>
                                        <div className="text-xs text-gray-500">{mode.recommendedFor}</div>
                                      </div>
                                    </div>
                                  </CardContent>
                                </Card>
                              );
                            })}
                          </div>
                        </div>

                        {/* 高级配置 */}
                        {selectedMode && (
                          <div className="space-y-4">
                            <Label>高级配置</Label>
                            <div className="grid grid-cols-2 gap-4">
                              <div className="flex items-center space-x-2">
                                <Switch
                                  checked={modeConfig.enableHealthCheck}
                                  onCheckedChange={(checked) => 
                                    setModeConfig({ ...modeConfig, enableHealthCheck: checked })
                                  }
                                />
                                <Label>启用健康检查</Label>
                              </div>
                              <div className="flex items-center space-x-2">
                                <Switch
                                  checked={modeConfig.enableFailover}
                                  onCheckedChange={(checked) => 
                                    setModeConfig({ ...modeConfig, enableFailover: checked })
                                  }
                                />
                                <Label>启用故障转移</Label>
                              </div>
                              <div className="flex items-center space-x-2">
                                <Switch
                                  checked={modeConfig.enableLoadBalancing}
                                  onCheckedChange={(checked) => 
                                    setModeConfig({ ...modeConfig, enableLoadBalancing: checked })
                                  }
                                />
                                <Label>启用负载均衡</Label>
                              </div>
                              <div className="flex items-center space-x-2">
                                <Switch
                                  checked={modeConfig.enableSessionStickiness}
                                  onCheckedChange={(checked) => 
                                    setModeConfig({ ...modeConfig, enableSessionStickiness: checked })
                                  }
                                />
                                <Label>启用会话粘性</Label>
                              </div>
                            </div>
                          </div>
                        )}

                        <div className="flex justify-end space-x-2">
                          <Button 
                            variant="outline" 
                            onClick={() => setConfigDialogOpen(false)}
                          >
                            取消
                          </Button>
                          <Button 
                            onClick={handleModeSwitch}
                            disabled={!selectedMode || switchingMode}
                          >
                            {switchingMode && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                            {switchingMode ? '切换中...' : '确认切换'}
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8">
              <AlertTriangle className="h-12 w-12 mx-auto text-gray-400 mb-4" />
              <p className="text-gray-500 mb-4">未配置部署模式</p>
              {isAdmin && (
                <Button onClick={() => {
                  setSelectedMode('centralized'); // 默认选中IP代理模式
                  setConfigDialogOpen(true);
                }}>
                  <Settings className="w-4 h-4 mr-2" />
                  配置部署模式
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 模式对比 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Info className="w-5 h-5 mr-2" />
            部署模式对比
          </CardTitle>
          <CardDescription>
            不同部署模式的特点和适用场景
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-3">特性</th>
                  <th className="text-center p-3">IP代理模式</th>
                  <th className="text-center p-3">边缘节点模式</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b">
                  <td className="p-3 font-medium">部署复杂度</td>
                  <td className="p-3 text-center text-green-600">简单</td>
                  <td className="p-3 text-center text-red-600">复杂</td>
                </tr>
                <tr className="border-b">
                  <td className="p-3 font-medium">扩展性</td>
                  <td className="p-3 text-center text-yellow-600">垂直扩展</td>
                  <td className="p-3 text-center text-green-600">水平扩展</td>
                </tr>
                <tr className="border-b">
                  <td className="p-3 font-medium">延迟</td>
                  <td className="p-3 text-center text-yellow-600">可能较高</td>
                  <td className="p-3 text-center text-green-600">很低</td>
                </tr>
                <tr className="border-b">
                  <td className="p-3 font-medium">成本</td>
                  <td className="p-3 text-center text-green-600">低</td>
                  <td className="p-3 text-center text-red-600">高</td>
                </tr>
                <tr>
                  <td className="p-3 font-medium">运维复杂度</td>
                  <td className="p-3 text-center text-green-600">低</td>
                  <td className="p-3 text-center text-red-600">高</td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
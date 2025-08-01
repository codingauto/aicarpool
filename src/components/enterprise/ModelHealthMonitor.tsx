'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Activity,
  AlertTriangle,
  CheckCircle,
  Clock,
  Zap,
  TrendingUp,
  RotateCcw,
  Settings,
  AlertCircle,
  LineChart,
  Timer
} from 'lucide-react';

interface HealthResult {
  modelId: string;
  isHealthy: boolean;
  responseTime: number;
  errorRate: number;
  lastChecked: string;
  score: number;
  details?: {
    endpoint: string;
    statusCode?: number;
    errorMessage?: string;
    successfulRequests: number;
    totalRequests: number;
  };
}

interface ModelStatus {
  activeModel: string;
  availableModels: string[];
  failoverHistory: Array<{
    id: string;
    fromModel: string;
    toModel: string;
    reason: string;
    success: boolean;
    errorMsg?: string;
    responseTime?: number;
    timestamp: string;
  }>;
}

interface ModelHealthMonitorProps {
  groupId: string;
  isAdmin: boolean;
}

export function ModelHealthMonitor({ groupId, isAdmin }: ModelHealthMonitorProps) {
  const [modelHealth, setModelHealth] = useState<HealthResult[]>([]);
  const [modelStatus, setModelStatus] = useState<ModelStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [switchDialogOpen, setSwitchDialogOpen] = useState(false);
  const [selectedModel, setSelectedModel] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchModelHealth = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/groups/${groupId}/models/health`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();
      if (data.success) {
        setModelHealth(data.data.models || []);
      } else {
        setError(data.error || '获取模型健康状态失败');
      }
    } catch (error) {
      console.error('获取模型健康状态失败:', error);
      setError('获取模型健康状态失败');
    }
  }, [groupId]);

  const fetchModelStatus = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/groups/${groupId}/models/switch`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();
      if (data.success) {
        setModelStatus(data.data);
      }
    } catch (error) {
      console.error('获取模型状态失败:', error);
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  const handleSwitchModel = async () => {
    if (!selectedModel || !isAdmin) return;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/groups/${groupId}/models/switch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          targetModel: selectedModel,
          reason: 'manual'
        }),
      });

      const data = await response.json();
      if (data.success) {
        await fetchModelStatus();
        setSwitchDialogOpen(false);
        setSelectedModel('');
        alert('模型切换成功');
      } else {
        alert(data.error || '模型切换失败');
      }
    } catch (error) {
      console.error('模型切换失败:', error);
      alert('模型切换失败');
    }
  };

  const getHealthBadgeVariant = (isHealthy: boolean, score: number) => {
    if (!isHealthy) return 'destructive';
    if (score >= 80) return 'default';
    if (score >= 60) return 'secondary';
    return 'destructive';
  };

  const getHealthIcon = (isHealthy: boolean, score: number) => {
    if (!isHealthy) return <AlertTriangle className="w-4 h-4" />;
    if (score >= 80) return <CheckCircle className="w-4 h-4" />;
    return <AlertCircle className="w-4 h-4" />;
  };

  useEffect(() => {
    fetchModelHealth();
    fetchModelStatus();
  }, [fetchModelHealth, fetchModelStatus]);

  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      fetchModelHealth();
    }, 30000); // 30秒刷新一次

    return () => clearInterval(interval);
  }, [autoRefresh, fetchModelHealth]);

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
          <h2 className="text-2xl font-bold">模型健康监控</h2>
          <p className="text-gray-600">实时监控AI模型性能和健康状态</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="autoRefresh"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded"
            />
            <label htmlFor="autoRefresh" className="text-sm text-gray-600">
              自动刷新
            </label>
          </div>
          <Button variant="outline" onClick={fetchModelHealth}>
            <RotateCcw className="w-4 h-4 mr-2" />
            刷新
          </Button>
          {isAdmin && (
            <Dialog open={switchDialogOpen} onOpenChange={setSwitchDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Zap className="w-4 h-4 mr-2" />
                  切换模型
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>手动切换模型</DialogTitle>
                  <DialogDescription>
                    选择要切换到的目标模型
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">目标模型</label>
                    <Select value={selectedModel} onValueChange={setSelectedModel}>
                      <SelectTrigger>
                        <SelectValue placeholder="选择模型" />
                      </SelectTrigger>
                      <SelectContent>
                        {modelStatus?.availableModels.map(model => (
                          <SelectItem key={model} value={model}>
                            {model}
                            {model === modelStatus.activeModel && ' (当前)'}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setSwitchDialogOpen(false)}>
                      取消
                    </Button>
                    <Button 
                      onClick={handleSwitchModel} 
                      disabled={!selectedModel || selectedModel === modelStatus?.activeModel}
                    >
                      切换
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="health" className="space-y-6">
        <TabsList>
          <TabsTrigger value="health">健康状态</TabsTrigger>
          <TabsTrigger value="performance">性能指标</TabsTrigger>
          <TabsTrigger value="failover">故障转移</TabsTrigger>
        </TabsList>

        <TabsContent value="health" className="space-y-6">
          {/* 当前活跃模型 */}
          {modelStatus && (
            <Card className="border-2 border-blue-200">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="w-5 h-5 text-blue-500" />
                  当前活跃模型
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Badge variant="default" className="text-lg px-3 py-1">
                      {modelStatus.activeModel}
                    </Badge>
                    <div className="text-sm text-gray-600">
                      可用模型: {modelStatus.availableModels.length} 个
                    </div>
                  </div>
                  {isAdmin && (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => setSwitchDialogOpen(true)}
                    >
                      <Settings className="w-4 h-4 mr-1" />
                      切换
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* 模型健康列表 */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {modelHealth.map((model) => (
              <Card key={model.modelId} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{model.modelId}</CardTitle>
                    <Badge variant={getHealthBadgeVariant(model.isHealthy, model.score)}>
                      {getHealthIcon(model.isHealthy, model.score)}
                      {model.isHealthy ? '健康' : '异常'}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="flex items-center gap-2">
                      <Timer className="w-4 h-4 text-gray-500" />
                      <span>{model.responseTime}ms</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-gray-500" />
                      <span>分数: {model.score}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-gray-500" />
                      <span>错误率: {model.errorRate.toFixed(1)}%</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-gray-500" />
                      <span>{new Date(model.lastChecked).toLocaleTimeString()}</span>
                    </div>
                  </div>

                  {model.details && (
                    <div className="pt-2 border-t text-xs text-gray-600">
                      <div>请求成功: {model.details.successfulRequests}/{model.details.totalRequests}</div>
                      {model.details.errorMessage && (
                        <div className="text-red-600 mt-1">
                          错误: {model.details.errorMessage}
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          {modelHealth.length === 0 && (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center py-8">
                  <Activity className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                  <h3 className="text-lg font-medium mb-2">暂无健康数据</h3>
                  <p className="text-gray-600 mb-4">
                    系统正在收集模型健康状态数据
                  </p>
                  <Button onClick={fetchModelHealth}>
                    <RotateCcw className="w-4 h-4 mr-2" />
                    重新获取
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="performance">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-8">
                <LineChart className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                <h3 className="text-lg font-medium mb-2">性能指标图表</h3>
                <p className="text-gray-600">
                  详细的性能指标和趋势分析（待实现）
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="failover">
          <Card>
            <CardHeader>
              <CardTitle>故障转移历史</CardTitle>
              <CardDescription>
                记录模型自动切换和手动切换的历史
              </CardDescription>
            </CardHeader>
            <CardContent>
              {modelStatus?.failoverHistory && modelStatus.failoverHistory.length > 0 ? (
                <div className="space-y-3">
                  {modelStatus.failoverHistory.map((event, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                      <div className="flex items-center gap-3">
                        <Badge variant={event.success ? 'default' : 'destructive'}>
                          {event.success ? '成功' : '失败'}
                        </Badge>
                        <div className="text-sm">
                          <div>{event.fromModel} → {event.toModel}</div>
                          <div className="text-gray-600">{event.reason}</div>
                        </div>
                      </div>
                      <div className="text-xs text-gray-600">
                        {new Date(event.timestamp).toLocaleString()}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Zap className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                  <h3 className="text-lg font-medium mb-2">暂无故障转移记录</h3>
                  <p className="text-gray-600">
                    所有模型运行正常，未发生故障转移
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
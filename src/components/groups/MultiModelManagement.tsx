'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Settings, Play, Pause, RotateCcw, Activity, AlertCircle, CheckCircle } from 'lucide-react';

interface ModelConfiguration {
  id: string;
  serviceType: string;
  primaryModel: string;
  fallbackModels: string[];
  failoverTrigger: 'manual' | 'automatic' | 'hybrid';
  healthCheckThreshold: number;
  failbackEnabled: boolean;
  strategy: string;
  maxRetries: number;
  timeout: number;
  healthCheckInterval: number;
  isEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

interface ModelStatus {
  groupId: string;
  serviceType: string;
  configuration: {
    primaryModel: string;
    fallbackModels: string[];
    failoverTrigger: string;
    strategy: string;
    isEnabled: boolean;
  };
  currentStatus: {
    activeModel: string;
    availableModels: string[];
    lastUpdated: string;
    error?: string;
  };
  recentFailovers: Array<{
    id: string;
    fromModel: string;
    toModel: string;
    reason: string;
    success: boolean;
    timestamp: string;
    responseTime?: number;
    errorMsg?: string;
  }>;
}

interface MultiModelManagementProps {
  groupId: string;
  isAdmin: boolean;
}

export function MultiModelManagement({ groupId, isAdmin }: MultiModelManagementProps) {
  const [configurations, setConfigurations] = useState<ModelConfiguration[]>([]);
  const [modelStatus, setModelStatus] = useState<ModelStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [switchingModel, setSwitchingModel] = useState(false);
  const [error, setError] = useState('');

  const fetchConfigurations = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/groups/${groupId}/model-configurations`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();
      if (data.success) {
        setConfigurations(data.data);
      } else {
        setError(data.error || '获取模型配置失败');
      }
    } catch (error) {
      console.error('获取模型配置失败:', error);
      setError('获取模型配置失败');
    }
  };

  const fetchModelStatus = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/groups/${groupId}/model-switch`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();
      if (data.success) {
        setModelStatus(data.data);
      } else if (response.status !== 404) {
        setError(data.error || '获取模型状态失败');
      }
    } catch (error) {
      console.error('获取模型状态失败:', error);
    }
  };

  const handleSwitchModel = async (targetModel: string, reason: 'manual' | 'maintenance' | 'performance' = 'manual') => {
    if (!isAdmin) return;

    setSwitchingModel(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/groups/${groupId}/model-switch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          targetModel,
          reason,
          serviceType: 'claude_code',
        }),
      });

      const data = await response.json();
      if (data.success) {
        await fetchModelStatus();
        alert(`成功切换到模型: ${targetModel}`);
      } else {
        alert(data.error || '模型切换失败');
      }
    } catch (error) {
      console.error('模型切换失败:', error);
      alert('模型切换失败');
    } finally {
      setSwitchingModel(false);
    }
  };

  const handleCreateConfiguration = async (configData: any) => {
    if (!isAdmin) return;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/groups/${groupId}/model-configurations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(configData),
      });

      const data = await response.json();
      if (data.success) {
        await fetchConfigurations();
        await fetchModelStatus();
        alert('模型配置创建成功');
      } else {
        alert(data.error || '创建模型配置失败');
      }
    } catch (error) {
      console.error('创建模型配置失败:', error);
      alert('创建模型配置失败');
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      await Promise.all([
        fetchConfigurations(),
        fetchModelStatus(),
      ]);
      setLoading(false);
    };

    fetchData();
  }, [groupId]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="text-center py-8">
          <div className="text-gray-500">加载中...</div>
        </div>
      </div>
    );
  }

  const claudeConfig = configurations.find(c => c.serviceType === 'claude_code');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">多模型管理</h2>
          <p className="text-gray-600">配置和管理Claude Code CLI的多模型支持</p>
        </div>
        {isAdmin && !claudeConfig && (
          <Button onClick={() => handleCreateConfiguration({
            serviceType: 'claude_code',
            primaryModel: 'claude-4-sonnet',
            fallbackModels: ['claude-4-opus', 'kimi-k2-instruct', 'glm-4.5', 'qwen3-32b'],
            failoverTrigger: 'automatic',
            healthCheckThreshold: 80,
            failbackEnabled: true,
          })}>
            <Settings className="w-4 h-4 mr-2" />
            启用多模型支持
          </Button>
        )}
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {!claudeConfig ? (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <Settings className="w-12 h-12 mx-auto text-gray-400 mb-4" />
              <h3 className="text-lg font-medium mb-2">多模型支持未启用</h3>
              <p className="text-gray-600 mb-4">
                启用多模型支持后，Claude Code CLI将自动在多个AI模型间切换，提供更稳定的服务
              </p>
              {isAdmin && (
                <Button onClick={() => handleCreateConfiguration({
                  serviceType: 'claude_code',
                  primaryModel: 'claude-4-sonnet',
                  fallbackModels: ['claude-4-opus', 'kimi-k2-instruct', 'glm-4.5', 'qwen3-32b'],
                  failoverTrigger: 'automatic',
                  healthCheckThreshold: 80,
                  failbackEnabled: true,
                })}>
                  启用多模型支持
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Tabs defaultValue="status" className="space-y-6">
          <TabsList>
            <TabsTrigger value="status">当前状态</TabsTrigger>
            <TabsTrigger value="config">配置管理</TabsTrigger>
            <TabsTrigger value="history">切换历史</TabsTrigger>
          </TabsList>

          <TabsContent value="status" className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              {/* 当前活跃模型状态 */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Activity className="w-5 h-5 mr-2" />
                    当前活跃模型
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {modelStatus?.currentStatus ? (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">活跃模型:</span>
                        <Badge variant="default" className="text-sm">
                          {modelStatus.currentStatus.activeModel}
                        </Badge>
                      </div>
                      <div className="text-sm text-gray-600">
                        最后更新: {new Date(modelStatus.currentStatus.lastUpdated).toLocaleString()}
                      </div>
                      {modelStatus.currentStatus.error && (
                        <Alert variant="destructive">
                          <AlertCircle className="h-4 w-4" />
                          <AlertDescription>{modelStatus.currentStatus.error}</AlertDescription>
                        </Alert>
                      )}
                    </div>
                  ) : (
                    <div className="text-gray-500">无法获取模型状态</div>
                  )}
                </CardContent>
              </Card>

              {/* 快速切换 */}
              <Card>
                <CardHeader>
                  <CardTitle>快速切换</CardTitle>
                  <CardDescription>手动切换到其他可用模型</CardDescription>
                </CardHeader>
                <CardContent>
                  {isAdmin && modelStatus?.currentStatus ? (
                    <div className="space-y-4">
                      <div className="grid gap-2">
                        {modelStatus.currentStatus.availableModels
                          .filter(model => model !== modelStatus.currentStatus.activeModel)
                          .map(model => (
                          <Button
                            key={model}
                            variant="outline"
                            size="sm"
                            onClick={() => handleSwitchModel(model)}
                            disabled={switchingModel}
                            className="justify-start"
                          >
                            <RotateCcw className="w-4 h-4 mr-2" />
                            切换到 {model}
                          </Button>
                        ))}
                      </div>
                      {switchingModel && (
                        <div className="text-center text-sm text-gray-600">
                          正在切换模型...
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-gray-500">
                      {!isAdmin ? '需要管理员权限' : '无可用模型'}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* 模型配置概览 */}
            <Card>
              <CardHeader>
                <CardTitle>配置概览</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-3">
                  <div>
                    <Label className="text-sm font-medium text-gray-600">主模型</Label>
                    <div className="text-lg font-semibold">{claudeConfig.primaryModel}</div>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-600">故障转移模式</Label>
                    <div className="text-lg font-semibold capitalize">{claudeConfig.failoverTrigger}</div>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-600">备用模型数量</Label>
                    <div className="text-lg font-semibold">{claudeConfig.fallbackModels.length}</div>
                  </div>
                </div>
                <div className="mt-4">
                  <Label className="text-sm font-medium text-gray-600">备用模型</Label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {claudeConfig.fallbackModels.map(model => (
                      <Badge key={model} variant="secondary">
                        {model}
                      </Badge>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="config" className="space-y-6">
            <ModelConfigurationForm
              config={claudeConfig}
              isAdmin={isAdmin}
              onSave={handleCreateConfiguration}
            />
          </TabsContent>

          <TabsContent value="history" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>模型切换历史</CardTitle>
                <CardDescription>最近的模型切换记录</CardDescription>
              </CardHeader>
              <CardContent>
                {modelStatus?.recentFailovers && modelStatus.recentFailovers.length > 0 ? (
                  <div className="space-y-4">
                    {modelStatus.recentFailovers.map(failover => (
                      <div key={failover.id} className="flex items-center justify-between py-3 border-b">
                        <div className="flex items-center space-x-4">
                          {failover.success ? (
                            <CheckCircle className="w-5 h-5 text-green-500" />
                          ) : (
                            <AlertCircle className="w-5 h-5 text-red-500" />
                          )}
                          <div>
                            <div className="font-medium">
                              {failover.fromModel} → {failover.toModel}
                            </div>
                            <div className="text-sm text-gray-600">
                              {failover.reason === 'automatic_failover' ? '自动故障转移' :
                               failover.reason === 'manual_switch' ? '手动切换' : '维护'}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm">
                            {new Date(failover.timestamp).toLocaleString()}
                          </div>
                          {failover.responseTime && (
                            <div className="text-xs text-gray-500">
                              {failover.responseTime}ms
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-gray-500 text-center py-8">
                    暂无切换记录
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

interface ModelConfigurationFormProps {
  config: ModelConfiguration;
  isAdmin: boolean;
  onSave: (config: any) => void;
}

function ModelConfigurationForm({ config, isAdmin, onSave }: ModelConfigurationFormProps) {
  const [formData, setFormData] = useState({
    failoverTrigger: config.failoverTrigger,
    healthCheckThreshold: config.healthCheckThreshold,
    failbackEnabled: config.failbackEnabled,
    maxRetries: config.maxRetries,
    timeout: config.timeout,
    healthCheckInterval: config.healthCheckInterval,
  });

  const handleSave = () => {
    onSave({
      serviceType: 'claude_code',
      ...formData,
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>模型配置</CardTitle>
        <CardDescription>调整多模型路由的参数设置</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-2">
            <Label>故障转移触发方式</Label>
            <Select
              value={formData.failoverTrigger}
              onValueChange={(value: any) => setFormData(prev => ({ ...prev, failoverTrigger: value }))}
              disabled={!isAdmin}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="automatic">自动</SelectItem>
                <SelectItem value="manual">手动</SelectItem>
                <SelectItem value="hybrid">混合</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>健康检查阈值 (%)</Label>
            <Input
              type="number"
              min="0"
              max="100"
              value={formData.healthCheckThreshold}
              onChange={(e) => setFormData(prev => ({ ...prev, healthCheckThreshold: parseInt(e.target.value) }))}
              disabled={!isAdmin}
            />
          </div>

          <div className="space-y-2">
            <Label>最大重试次数</Label>
            <Input
              type="number"
              min="1"
              max="10"
              value={formData.maxRetries}
              onChange={(e) => setFormData(prev => ({ ...prev, maxRetries: parseInt(e.target.value) }))}
              disabled={!isAdmin}
            />
          </div>

          <div className="space-y-2">
            <Label>请求超时 (毫秒)</Label>
            <Input
              type="number"
              min="5000"
              max="120000"
              step="1000"
              value={formData.timeout}
              onChange={(e) => setFormData(prev => ({ ...prev, timeout: parseInt(e.target.value) }))}
              disabled={!isAdmin}
            />
          </div>

          <div className="space-y-2">
            <Label>健康检查间隔 (毫秒)</Label>
            <Input
              type="number"
              min="30000"
              max="600000"
              step="10000"
              value={formData.healthCheckInterval}
              onChange={(e) => setFormData(prev => ({ ...prev, healthCheckInterval: parseInt(e.target.value) }))}
              disabled={!isAdmin}
            />
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="failback"
              checked={formData.failbackEnabled}
              onCheckedChange={(checked) => setFormData(prev => ({ ...prev, failbackEnabled: checked }))}
              disabled={!isAdmin}
            />
            <Label htmlFor="failback">启用故障恢复</Label>
          </div>
        </div>

        {isAdmin && (
          <div className="flex justify-end">
            <Button onClick={handleSave}>
              保存配置
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
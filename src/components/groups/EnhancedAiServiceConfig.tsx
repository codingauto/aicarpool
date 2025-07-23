'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { 
  Settings, 
  Plus, 
  ChevronUp, 
  ChevronDown, 
  Activity, 
  DollarSign, 
  Zap,
  Shield,
  Network,
  AlertCircle,
  CheckCircle,
  Clock,
  Loader2
} from 'lucide-react';
import { toast } from 'sonner';

interface AiServiceDetail {
  id: string;
  isEnabled: boolean;
  quota?: any;
  authConfig?: any;
  proxySettings?: any;
  aiService: {
    id: string;
    serviceName: string;
    displayName: string;
    description?: string;
    baseUrl: string;
  };
  quotaConfig?: any;
  quotaUsage?: any;
  priority: number;
  routingStrategy: string;
  healthStatus: string;
  responseTime: number;
}

interface EnhancedAiServiceConfigProps {
  groupId: string;
  isAdmin: boolean;
  onRefresh?: () => void;
}

const routingStrategies = [
  { value: 'priority', label: '优先级路由', desc: '按设置的优先级顺序路由' },
  { value: 'round_robin', label: '轮询路由', desc: '依次轮流使用各服务' },
  { value: 'least_connections', label: '最少连接', desc: '选择当前连接数最少的服务' },
  { value: 'response_time', label: '响应时间', desc: '选择响应时间最短的服务' },
];

export function EnhancedAiServiceConfig({ groupId, isAdmin, onRefresh }: EnhancedAiServiceConfigProps) {
  const [services, setServices] = useState<AiServiceDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  const [selectedService, setSelectedService] = useState<AiServiceDetail | null>(null);
  const [availableServices, setAvailableServices] = useState<any[]>([]);
  const [addDialogOpen, setAddDialogOpen] = useState(false);

  // 配置表单状态
  const [formData, setFormData] = useState({
    isEnabled: true,
    priority: 1,
    dailyTokenLimit: 100000,
    monthlyTokenLimit: 3000000,
    dailyCostLimit: 10.0,
    monthlyCostLimit: 300.0,
    userDailyTokenLimit: '',
    userMonthlyTokenLimit: '',
    apiKey: '',
    routingStrategy: 'priority',
    enableProxy: false,
    proxyType: 'none',
    failoverEnabled: true,
    healthCheckEnabled: true,
  });

  useEffect(() => {
    fetchServices();
  }, [groupId]);

  const fetchServices = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const response = await fetch(`/api/groups/${groupId}/ai-services/configure`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const result = await response.json();
      if (result.success) {
        setServices(result.data);
      } else {
        toast.error(result.message || '获取AI服务配置失败');
      }
    } catch (error) {
      console.error('Failed to fetch AI services:', error);
      toast.error('获取AI服务配置失败');
    } finally {
      setLoading(false);
    }
  };

  const fetchAvailableServices = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const response = await fetch('/api/ai-services', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const result = await response.json();
      if (result.success) {
        // 过滤掉已配置的服务
        const configuredIds = services.map(s => s.aiService.id);
        const unconfigured = result.data.filter(
          (service: any) => !configuredIds.includes(service.id)
        );
        setAvailableServices(unconfigured);
      }
    } catch (error) {
      console.error('Failed to fetch available services:', error);
    }
  };

  const handleConfigureService = async () => {
    if (!selectedService) return;

    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const payload = {
        aiServiceId: selectedService.aiService.id,
        isEnabled: formData.isEnabled,
        priority: formData.priority,
        quota: {
          dailyTokenLimit: formData.dailyTokenLimit,
          monthlyTokenLimit: formData.monthlyTokenLimit,
          dailyCostLimit: formData.dailyCostLimit,
          monthlyCostLimit: formData.monthlyCostLimit,
          userDailyTokenLimit: formData.userDailyTokenLimit ? parseInt(formData.userDailyTokenLimit) : undefined,
          userMonthlyTokenLimit: formData.userMonthlyTokenLimit ? parseInt(formData.userMonthlyTokenLimit) : undefined,
        },
        authConfig: {
          apiKey: formData.apiKey,
        },
        proxySettings: {
          enableProxy: formData.enableProxy,
          proxyType: formData.proxyType,
          routingStrategy: formData.routingStrategy,
          failoverEnabled: formData.failoverEnabled,
          healthCheckEnabled: formData.healthCheckEnabled,
          priority: formData.priority,
        },
      };

      const response = await fetch(`/api/groups/${groupId}/ai-services/configure`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json();
      if (result.success) {
        toast.success('AI服务配置成功');
        setConfigDialogOpen(false);
        fetchServices();
        onRefresh?.();
      } else {
        toast.error(result.message || '配置失败');
      }
    } catch (error) {
      console.error('Failed to configure service:', error);
      toast.error('配置失败');
    }
  };

  const updateServicePriority = async (serviceId: string, newPriority: number) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const response = await fetch(`/api/groups/${groupId}/ai-services/priority`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          services: [{ aiServiceId: serviceId, priority: newPriority }],
        }),
      });

      const result = await response.json();
      if (result.success) {
        toast.success('优先级更新成功');
        fetchServices();
      } else {
        toast.error(result.message || '更新失败');
      }
    } catch (error) {
      console.error('Failed to update priority:', error);
      toast.error('更新失败');
    }
  };

  const openConfigDialog = (service: AiServiceDetail) => {
    setSelectedService(service);
    setFormData({
      isEnabled: service.isEnabled,
      priority: service.priority,
      dailyTokenLimit: service.quotaConfig?.dailyTokenLimit ? Number(service.quotaConfig.dailyTokenLimit) : 100000,
      monthlyTokenLimit: service.quotaConfig?.monthlyTokenLimit ? Number(service.quotaConfig.monthlyTokenLimit) : 3000000,
      dailyCostLimit: service.quotaConfig?.dailyCostLimit || 10.0,
      monthlyCostLimit: service.quotaConfig?.monthlyCostLimit || 300.0,
      userDailyTokenLimit: service.quotaConfig?.userDailyTokenLimit ? String(service.quotaConfig.userDailyTokenLimit) : '',
      userMonthlyTokenLimit: service.quotaConfig?.userMonthlyTokenLimit ? String(service.quotaConfig.userMonthlyTokenLimit) : '',
      apiKey: service.authConfig?.apiKey || '',
      routingStrategy: service.routingStrategy || 'priority',
      enableProxy: service.proxySettings?.enableProxy || false,
      proxyType: service.proxySettings?.proxyType || 'none',
      failoverEnabled: service.proxySettings?.failoverEnabled !== false,
      healthCheckEnabled: service.proxySettings?.healthCheckEnabled !== false,
    });
    setConfigDialogOpen(true);
  };

  const getHealthBadge = (status: string) => {
    switch (status) {
      case 'healthy':
        return <Badge variant="default" className="bg-green-100 text-green-800"><CheckCircle className="w-3 h-3 mr-1" />健康</Badge>;
      case 'warning':
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800"><AlertCircle className="w-3 h-3 mr-1" />警告</Badge>;
      case 'error':
        return <Badge variant="destructive"><AlertCircle className="w-3 h-3 mr-1" />错误</Badge>;
      default:
        return <Badge variant="outline"><Clock className="w-3 h-3 mr-1" />未知</Badge>;
    }
  };

  const getUsagePercentage = (used: number, limit: number) => {
    if (!limit) return 0;
    return Math.min((used / limit) * 100, 100);
  };

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
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>AI服务配置</CardTitle>
              <CardDescription>
                管理拼车组的AI服务，配置优先级、配额和路由策略
              </CardDescription>
            </div>
            {isAdmin && (
              <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
                <DialogTrigger asChild>
                  <Button onClick={fetchAvailableServices}>
                    <Plus className="w-4 h-4 mr-2" />
                    添加服务
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>添加AI服务</DialogTitle>
                    <DialogDescription>
                      为拼车组添加新的AI服务
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label>选择服务</Label>
                      <Select>
                        <SelectTrigger>
                          <SelectValue placeholder="选择AI服务" />
                        </SelectTrigger>
                        <SelectContent>
                          {availableServices.map((service) => (
                            <SelectItem key={service.id} value={service.id}>
                              {service.displayName} ({service.serviceName})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {services.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>服务</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>优先级</TableHead>
                  <TableHead>路由策略</TableHead>
                  <TableHead>配额使用</TableHead>
                  <TableHead>健康状态</TableHead>
                  <TableHead>响应时间</TableHead>
                  {isAdmin && <TableHead>操作</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {services.map((service) => (
                  <TableRow key={service.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{service.aiService.displayName}</div>
                        <div className="text-sm text-gray-500">{service.aiService.serviceName}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={service.isEnabled}
                        disabled={!isAdmin}
                        onCheckedChange={(checked) => {
                          // TODO: 实现快速启用/禁用
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-1">
                        <span>{service.priority}</span>
                        {isAdmin && (
                          <div className="flex flex-col">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => updateServicePriority(service.aiService.id, service.priority - 1)}
                              disabled={service.priority <= 1}
                              className="h-6 w-6 p-0"
                            >
                              <ChevronUp className="w-3 h-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => updateServicePriority(service.aiService.id, service.priority + 1)}
                              className="h-6 w-6 p-0"
                            >
                              <ChevronDown className="w-3 h-3" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {routingStrategies.find(s => s.value === service.routingStrategy)?.label || '优先级路由'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="text-sm">
                          令牌: {service.quotaUsage?.dailyTokens || 0} / {service.quotaConfig?.dailyTokenLimit || 'N/A'}
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-blue-600 h-2 rounded-full"
                            style={{
                              width: `${getUsagePercentage(
                                Number(service.quotaUsage?.dailyTokens || 0),
                                Number(service.quotaConfig?.dailyTokenLimit || 0)
                              )}%`
                            }}
                          />
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {getHealthBadge(service.healthStatus)}
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">{service.responseTime}ms</span>
                    </TableCell>
                    {isAdmin && (
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openConfigDialog(service)}
                        >
                          <Settings className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8">
              <Activity className="h-12 w-12 mx-auto text-gray-400 mb-4" />
              <p className="text-gray-500 mb-4">还没有配置AI服务</p>
              {isAdmin && (
                <Button onClick={fetchAvailableServices}>
                  <Plus className="w-4 h-4 mr-2" />
                  添加AI服务
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 配置对话框 */}
      <Dialog open={configDialogOpen} onOpenChange={setConfigDialogOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              配置 {selectedService?.aiService.displayName}
            </DialogTitle>
            <DialogDescription>
              设置AI服务的详细配置，包括配额、路由和代理设置
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6">
            {/* 基本设置 */}
            <div className="space-y-4">
              <h4 className="text-sm font-medium">基本设置</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center space-x-2">
                  <Switch
                    checked={formData.isEnabled}
                    onCheckedChange={(checked) => setFormData({ ...formData, isEnabled: checked })}
                  />
                  <Label>启用服务</Label>
                </div>
                <div>
                  <Label>优先级</Label>
                  <Input
                    type="number"
                    min="1"
                    max="100"
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) || 1 })}
                  />
                </div>
              </div>
              <div>
                <Label>API密钥</Label>
                <Input
                  type="password"
                  value={formData.apiKey}
                  onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
                  placeholder="输入AI服务的API密钥"
                />
              </div>
            </div>

            {/* 配额设置 */}
            <div className="space-y-4">
              <h4 className="text-sm font-medium flex items-center">
                <DollarSign className="w-4 h-4 mr-2" />
                配额设置
              </h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>每日令牌限制</Label>
                  <Input
                    type="number"
                    value={formData.dailyTokenLimit}
                    onChange={(e) => setFormData({ ...formData, dailyTokenLimit: parseInt(e.target.value) || 0 })}
                  />
                </div>
                <div>
                  <Label>每月令牌限制</Label>
                  <Input
                    type="number"
                    value={formData.monthlyTokenLimit}
                    onChange={(e) => setFormData({ ...formData, monthlyTokenLimit: parseInt(e.target.value) || 0 })}
                  />
                </div>
                <div>
                  <Label>每日费用限制($)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.dailyCostLimit}
                    onChange={(e) => setFormData({ ...formData, dailyCostLimit: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div>
                  <Label>每月费用限制($)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.monthlyCostLimit}
                    onChange={(e) => setFormData({ ...formData, monthlyCostLimit: parseFloat(e.target.value) || 0 })}
                  />
                </div>
              </div>
            </div>

            {/* 路由设置 */}
            <div className="space-y-4">
              <h4 className="text-sm font-medium flex items-center">
                <Network className="w-4 h-4 mr-2" />
                路由设置
              </h4>
              <div>
                <Label>路由策略</Label>
                <Select value={formData.routingStrategy} onValueChange={(value) => setFormData({ ...formData, routingStrategy: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {routingStrategies.map((strategy) => (
                      <SelectItem key={strategy.value} value={strategy.value}>
                        <div>
                          <div>{strategy.label}</div>
                          <div className="text-xs text-gray-500">{strategy.desc}</div>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  <Switch
                    checked={formData.failoverEnabled}
                    onCheckedChange={(checked) => setFormData({ ...formData, failoverEnabled: checked })}
                  />
                  <Label>启用故障转移</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    checked={formData.healthCheckEnabled}
                    onCheckedChange={(checked) => setFormData({ ...formData, healthCheckEnabled: checked })}
                  />
                  <Label>启用健康检查</Label>
                </div>
              </div>
            </div>

            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setConfigDialogOpen(false)}>
                取消
              </Button>
              <Button onClick={handleConfigureService}>
                保存配置
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
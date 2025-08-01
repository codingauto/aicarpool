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
  Network,
  AlertCircle,
  CheckCircle,
  Clock,
  Loader2,
  User,
  Key
} from 'lucide-react';
import { toast } from 'sonner';
import AiAccountForm from '../AiAccountForm';

interface AiServiceDetail {
  id: string;
  isEnabled: boolean;
  quota?: any;
  authConfig?: any;
  proxySettings?: any;
  accountId?: string;
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

interface AiServiceConfigProps {
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

export function AiServiceConfig({ groupId, isAdmin, onRefresh }: AiServiceConfigProps) {
  const [services, setServices] = useState<AiServiceDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  const [selectedService, setSelectedService] = useState<AiServiceDetail | null>(null);
  const [accountFormOpen, setAccountFormOpen] = useState(false);
  const [selectedServiceType, setSelectedServiceType] = useState<'claude' | 'gemini' | 'ampcode' | 'kimi' | 'zhipu' | 'qwen' | null>(null);

  // 定义静态AI服务列表（包含多模型支持）
  const staticAiServices = [
    {
      id: 'claude',
      serviceName: 'claude',
      displayName: 'Claude Code',
      description: 'Anthropic Claude AI服务 - 支持多模型切换',
      baseUrl: 'https://api.anthropic.com',
      isEnabled: true,
      category: 'primary',
      supportedModels: ['claude-4-sonnet', 'claude-4-opus', 'claude-3.5-sonnet'],
    },
    {
      id: 'gemini',
      serviceName: 'gemini',
      displayName: 'Gemini CLI',
      description: 'Google Gemini AI服务',
      baseUrl: 'https://generativelanguage.googleapis.com',
      isEnabled: true,
      category: 'primary',
      supportedModels: ['gemini-1.5-pro', 'gemini-1.5-flash'],
    },
    {
      id: 'ampcode',
      serviceName: 'ampcode',
      displayName: 'AmpCode',
      description: 'AmpCode AI服务',
      baseUrl: 'https://api.ampcode.com',
      isEnabled: true,
      category: 'primary',
      supportedModels: ['ampcode-v1'],
    },
    {
      id: 'kimi',
      serviceName: 'kimi',
      displayName: 'Kimi K2 (2025)',
      description: 'Moonshot AI Kimi K2 - 1T参数MoE模型，优越的Agent能力',
      baseUrl: 'https://api.moonshot.cn',
      isEnabled: true,
      category: 'fallback',
      supportedModels: ['kimi-k2-instruct', 'kimi-k2-base', 'moonshot-v1-128k'],
      pricing: '输入$0.15/M tokens, 输出$2.5/M tokens',
      features: ['全球领先的MoE架构', 'Agent专用优化', '开源商用'],
    },
    {
      id: 'zhipu',
      serviceName: 'zhipu',
      displayName: 'GLM-4.5 (2025)',
      description: '智谱GLM-4.5 - 3550亿参数，综合性能全球第三',
      baseUrl: 'https://open.bigmodel.cn',
      isEnabled: true,
      category: 'fallback',
      supportedModels: ['glm-4.5', 'glm-4.5-air', 'glm-4-plus', 'glm-4-flash'],
      pricing: '输入￥0.8/M tokens, 输出￥2/M tokens',
      features: ['原生融合智能体', '超过100 tokens/s', '开源Apache 2.0'],
    },
    {
      id: 'qwen',
      serviceName: 'qwen',
      displayName: 'Qwen3 (2025)',
      description: '阿里通义千问Qwen3 - 235B MoE，支持思考模式',
      baseUrl: 'https://dashscope.aliyuncs.com',
      isEnabled: true,
      category: 'fallback',
      supportedModels: ['qwen3-32b', 'qwen3-14b', 'qwen3-8b', 'qwen3-coder-plus'],
      pricing: '竞争力定价，支持思考模式',
      features: ['36T Tokens训练', '思考+非思考模式', 'Agent专用优化'],
    },
  ];

  const [availableServices, setAvailableServices] = useState<any[]>([]);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [selectedNewService, setSelectedNewService] = useState<string>('');

  // 配置表单状态
  const [formData, setFormData] = useState({
    isEnabled: true,
    priority: 1,
    dailyTokenLimit: 100000,
    monthlyTokenLimit: 3000000,
    dailyCostLimit: 10.0,
    monthlyCostLimit: 300.0,
    routingStrategy: 'priority',
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
        toast.success(`成功加载 ${result.data.length} 个AI服务配置`);
      } else {
        toast.error(result.error || result.message || '获取AI服务配置失败');
      }
    } catch (error) {
      console.error('Failed to fetch AI services:', error);
      toast.error('网络错误，获取AI服务配置失败');
    } finally {
      setLoading(false);
    }
  };

  const getAvailableServices = () => {
    const configuredIds = Array.isArray(services) ? services.map(s => s.aiService?.id).filter(Boolean) : [];
    return staticAiServices.filter(service => !configuredIds.includes(service.id));
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
        },
        proxySettings: {
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
      routingStrategy: service.routingStrategy || 'priority',
      failoverEnabled: service.proxySettings?.failoverEnabled !== false,
      healthCheckEnabled: service.proxySettings?.healthCheckEnabled !== false,
    });
    setConfigDialogOpen(true);
  };

  const openAccountForm = (serviceType: 'claude' | 'gemini' | 'ampcode') => {
    setSelectedServiceType(serviceType);
    setAccountFormOpen(true);
  };

  const handleAccountSuccess = () => {
    setAccountFormOpen(false);
    setSelectedServiceType(null);
    fetchServices();
    onRefresh?.();
    toast.success('账户创建成功');
  };

  const getHealthBadge = (status: string) => {
    switch (status) {
      case 'healthy':
        return <Badge variant="default" className="text-green-800 bg-green-100"><CheckCircle className="mr-1 w-3 h-3" />健康</Badge>;
      case 'warning':
        return <Badge variant="secondary" className="text-yellow-800 bg-yellow-100"><AlertCircle className="mr-1 w-3 h-3" />警告</Badge>;
      case 'error':
        return <Badge variant="destructive"><AlertCircle className="mr-1 w-3 h-3" />错误</Badge>;
      default:
        return <Badge variant="outline"><Clock className="mr-1 w-3 h-3" />未知</Badge>;
    }
  };

  const getUsagePercentage = (used: number, limit: number) => {
    if (!limit) return 0;
    return Math.min((used / limit) * 100, 100);
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex justify-center items-center py-12">
          <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
          <span className="ml-2 text-gray-500">加载中...</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>AI服务配置</CardTitle>
              <CardDescription>
                管理拼车组的AI服务，配置优先级、配额和路由策略
              </CardDescription>
            </div>
            {isAdmin && (
              <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
                <DialogTrigger asChild>
                  <Button 
                    onClick={() => {
                      setSelectedNewService('');
                      setAvailableServices(getAvailableServices());
                    }}
                    disabled={getAvailableServices().length === 0}
                    title={getAvailableServices().length === 0 ? "所有AI服务都已配置" : "添加新的AI服务"}
                  >
                    <Plus className="mr-2 w-4 h-4" />
                    {getAvailableServices().length === 0 ? "已配置所有服务" : "添加服务"}
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
                    {getAvailableServices().length > 0 ? (
                      <div>
                        <Label>选择服务</Label>
                        <Select value={selectedNewService} onValueChange={setSelectedNewService}>
                          <SelectTrigger>
                            <SelectValue placeholder="选择AI服务" />
                          </SelectTrigger>
                          <SelectContent>
                            {getAvailableServices().map((service) => (
                              <SelectItem key={service.id} value={service.id}>
                                {service.displayName} ({service.serviceName})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    ) : (
                      <div className="py-4 text-center">
                        <CheckCircle className="mx-auto mb-2 w-8 h-8 text-green-500" />
                        <p className="text-sm text-gray-500">
                          所有支持的AI服务都已配置完成
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                          支持的服务：Claude Code、Gemini CLI、AmpCode
                        </p>
                      </div>
                    )}
                    {getAvailableServices().length > 0 && (
                      <div className="flex justify-end space-x-2">
                        <Button variant="outline" onClick={() => {
                          setAddDialogOpen(false);
                          setSelectedNewService('');
                        }}>
                          取消
                        </Button>
                        <Button 
                          onClick={() => {
                            if (!selectedNewService) {
                              toast.error('请选择要添加的AI服务');
                              return;
                            }
                            
                            const serviceType = selectedNewService as 'claude' | 'gemini' | 'ampcode';
                            setAddDialogOpen(false);
                            openAccountForm(serviceType);
                          }}
                        >
                          下一步：添加账户
                        </Button>
                      </div>
                    )}
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
                  <TableHead>认证方式</TableHead>
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
                      <div className="flex gap-1 items-center">
                        {service.accountId ? (
                          <>
                            <User className="w-3 h-3" />
                            <span className="text-sm">账户认证</span>
                          </>
                        ) : (
                          <>
                            <Key className="w-3 h-3" />
                            <span className="text-sm">API Key</span>
                          </>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={service.isEnabled ? "default" : "secondary"}>
                        {service.isEnabled ? "启用" : "禁用"}
                      </Badge>
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
                              className="p-0 w-6 h-6"
                            >
                              <ChevronUp className="w-3 h-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => updateServicePriority(service.aiService.id, service.priority + 1)}
                              className="p-0 w-6 h-6"
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
                        <div className="w-full h-2 bg-gray-200 rounded-full">
                          <div
                            className="h-2 bg-blue-600 rounded-full"
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
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openConfigDialog(service)}
                          >
                            <Settings className="w-4 h-4" />
                          </Button>
                          {service.accountId ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openAccountForm(service.aiService.serviceName as 'claude' | 'gemini' | 'ampcode')}
                              title="管理账户"
                            >
                              <User className="w-4 h-4" />
                            </Button>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openAccountForm(service.aiService.serviceName as 'claude' | 'gemini' | 'ampcode')}
                              title="添加账户"
                              className="text-blue-600"
                            >
                              <Plus className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="py-8 text-center">
              <Activity className="mx-auto mb-4 w-12 h-12 text-gray-400" />
              <p className="mb-4 text-gray-500">还没有配置AI服务</p>
              {isAdmin && (
                <Button 
                  onClick={() => {
                    setSelectedNewService('');
                    setAddDialogOpen(true);
                    setAvailableServices(getAvailableServices());
                  }}
                  disabled={getAvailableServices().length === 0}
                  title={getAvailableServices().length === 0 ? "所有AI服务都已配置" : "添加新的AI服务"}
                >
                  <Plus className="mr-2 w-4 h-4" />
                  {getAvailableServices().length === 0 ? "已配置所有服务" : "添加AI服务"}
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 服务配置对话框 */}
      <Dialog open={configDialogOpen} onOpenChange={setConfigDialogOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              配置 {selectedService?.aiService.displayName}
            </DialogTitle>
            <DialogDescription>
              管理AI服务的配额和路由设置
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6">
            {/* 基本设置 */}
            <div className="p-4 space-y-4 rounded-lg border">
              <h4 className="flex gap-2 items-center text-sm font-medium">
                <Settings className="w-4 h-4" />
                基本设置
              </h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center space-x-2">
                  <Switch
                    checked={formData.isEnabled}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isEnabled: checked }))}
                  />
                  <Label>启用服务</Label>
                </div>
                <div className="space-y-2">
                  <Label>优先级</Label>
                  <Input
                    type="number"
                    min="1"
                    max="100"
                    value={formData.priority}
                    onChange={(e) => setFormData(prev => ({ ...prev, priority: parseInt(e.target.value) || 1 }))}
                  />
                </div>
              </div>
            </div>

            {/* 配额设置 */}
            <div className="p-4 space-y-4 rounded-lg border">
              <h4 className="flex gap-2 items-center text-sm font-medium">
                <DollarSign className="w-4 h-4" />
                配额设置
              </h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>每日令牌限制</Label>
                  <Input
                    type="number"
                    value={formData.dailyTokenLimit}
                    onChange={(e) => setFormData(prev => ({ ...prev, dailyTokenLimit: parseInt(e.target.value) || 0 }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>每月令牌限制</Label>
                  <Input
                    type="number"
                    value={formData.monthlyTokenLimit}
                    onChange={(e) => setFormData(prev => ({ ...prev, monthlyTokenLimit: parseInt(e.target.value) || 0 }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>每日费用限制($)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.dailyCostLimit}
                    onChange={(e) => setFormData(prev => ({ ...prev, dailyCostLimit: parseFloat(e.target.value) || 0 }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>每月费用限制($)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.monthlyCostLimit}
                    onChange={(e) => setFormData(prev => ({ ...prev, monthlyCostLimit: parseFloat(e.target.value) || 0 }))}
                  />
                </div>
              </div>
            </div>

            {/* 路由设置 */}
            <div className="p-4 space-y-4 rounded-lg border">
              <h4 className="flex gap-2 items-center text-sm font-medium">
                <Network className="w-4 h-4" />
                路由设置
              </h4>
              <div className="space-y-2">
                <Label>路由策略</Label>
                <Select value={formData.routingStrategy} onValueChange={(value) => setFormData(prev => ({ ...prev, routingStrategy: value }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {routingStrategies.map((strategy) => (
                      <SelectItem key={strategy.value} value={strategy.value}>
                        <div>
                          <div>{strategy.label}</div>
                          <div className="text-xs text-muted-foreground">{strategy.desc}</div>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center space-x-2">
                  <Switch
                    checked={formData.failoverEnabled}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, failoverEnabled: checked }))}
                  />
                  <Label>启用故障转移</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    checked={formData.healthCheckEnabled}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, healthCheckEnabled: checked }))}
                  />
                  <Label>启用健康检查</Label>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-6 space-x-2 border-t">
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

      {/* AI账户表单 */}
      {accountFormOpen && selectedServiceType && (
        <AiAccountForm
          serviceType={selectedServiceType}
          groupId={groupId}
          onClose={() => {
            setAccountFormOpen(false);
            setSelectedServiceType(null);
          }}
          onSuccess={handleAccountSuccess}
        />
      )}
    </div>
  );
}
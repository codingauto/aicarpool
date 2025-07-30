'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  Loader2,
  User,
  Key
} from 'lucide-react';
import { toast } from 'sonner';
import ProxyConfig from '../ProxyConfig';

interface AiServiceDetail {
  id: string;
  isEnabled: boolean;
  quota?: any;
  authConfig?: any;
  proxySettings?: any;
  accountId?: string; // 绑定的账户ID
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
  // 定义静态的3个AI服务
  const staticAiServices = [
    {
      id: 'claude',
      serviceName: 'claude',
      displayName: 'Claude Code',
      description: 'Anthropic Claude AI服务',
      baseUrl: 'https://api.anthropic.com',
      isEnabled: true,
    },
    {
      id: 'gemini',
      serviceName: 'gemini',
      displayName: 'Gemini CLI',
      description: 'Google Gemini AI服务',
      baseUrl: 'https://generativelanguage.googleapis.com',
      isEnabled: true,
    },
    {
      id: 'ampcode',
      serviceName: 'ampcode',
      displayName: 'AmpCode',
      description: 'AmpCode AI服务',
      baseUrl: 'https://api.ampcode.com',
      isEnabled: true,
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
    userDailyTokenLimit: '',
    userMonthlyTokenLimit: '',
    apiKey: '',
    refreshToken: '', // 新增refreshToken字段
    useAccountAuth: false, // 是否使用账户认证
    routingStrategy: 'priority',
    enableProxy: false,
    proxyType: 'none',
    failoverEnabled: true,
    healthCheckEnabled: true,
    // 账户配置字段
    accountName: '',
    accountDescription: '',
    accountType: 'shared' as 'shared' | 'dedicated',
    authType: 'oauth' as 'oauth' | 'api_key',
    projectId: '', // Gemini项目ID
    // 代理配置
    proxyEnabled: false,
    selectedProxyId: '', // 新增：选中的代理ID
    proxyHost: '',
    proxyPort: '',
    proxyUsername: '',
    proxyPassword: '',
  });

  // 账户添加步骤状态
  const [currentStep, setCurrentStep] = useState(1); // 1: 基本信息, 2: 授权认证
  const [oauthStep, setOauthStep] = useState(1); // OAuth流程步骤: 1: 生成链接, 2: 打开页面, 3: 输入代码
  const [authUrl, setAuthUrl] = useState('');
  const [authCode, setAuthCode] = useState('');
  
  // 账户管理模式状态
  const [accountMode, setAccountMode] = useState<'create' | 'manage'>('create'); // 创建模式 vs 管理模式
  const [existingAccount, setExistingAccount] = useState<any>(null); // 现有账户信息

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

  const getAvailableServices = () => {
    // 过滤掉已配置的服务
    const configuredIds = Array.isArray(services) ? services.map(s => s.aiService?.id).filter(Boolean) : [];
    return staticAiServices.filter(service => !configuredIds.includes(service.id));
  };

  const handleConfigureService = async () => {
    if (!selectedService) return;

    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      // 如果在账户管理标签页
      if (formData.useAccountAuth) {
        if (accountMode === 'create') {
          // 创建账户逻辑
          const accountPayload = {
            serviceType: selectedService.aiService.serviceName as 'claude' | 'gemini' | 'ampcode',
            name: formData.accountName,
            description: formData.accountDescription,
            accountType: formData.accountType,
            authType: formData.authType,
            credentials: formData.authType === 'api_key' ? {
              apiKey: formData.apiKey,
              ...(formData.projectId && { projectId: formData.projectId })
            } : {
              // OAuth模式：模拟token交换
              authCode: authCode,
              accessToken: `mock_access_token_${Date.now()}`,
              refreshToken: `mock_refresh_token_${Date.now()}`,
              ...(formData.projectId && { projectId: formData.projectId })
            },
            proxy: formData.proxyEnabled ? {
              type: formData.proxyType,
              host: formData.proxyHost,
              port: parseInt(formData.proxyPort) || 80,
              username: formData.proxyUsername || null,
              password: formData.proxyPassword || null,
              ...(formData.selectedProxyId && { proxyId: formData.selectedProxyId })
            } : null
          };

          const accountResponse = await fetch(`/api/groups/${groupId}/ai-accounts`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(accountPayload),
          });

          const accountResult = await accountResponse.json();
          if (accountResult.success) {
            toast.success('账户创建成功');
            // 重置状态
            setCurrentStep(1);
            setOauthStep(1);
            setAuthCode('');
            setAuthUrl('');
            setConfigDialogOpen(false);
            fetchServices();
            onRefresh?.();
          } else {
            toast.error(accountResult.message || '账户创建失败');
          }
          return;
        } else if (accountMode === 'manage') {
          // 更新账户逻辑
          const updatePayload: any = {
            name: formData.accountName,
            description: formData.accountDescription,
            accountType: formData.accountType,
            proxy: formData.proxyEnabled ? {
              type: formData.proxyType,
              host: formData.proxyHost,
              port: parseInt(formData.proxyPort) || 80,
              username: formData.proxyUsername || null,
              password: formData.proxyPassword || null,
              ...(formData.selectedProxyId && { proxyId: formData.selectedProxyId })
            } : null
          };

          // 只有当Token字段有值时才添加到更新payload中
          const credentialsUpdate: any = {};
          if (formData.apiKey.trim()) {
            credentialsUpdate.apiKey = formData.apiKey;
          }
          if (formData.refreshToken && formData.refreshToken.trim()) {
            credentialsUpdate.refreshToken = formData.refreshToken;
          }
          if (formData.projectId) {
            credentialsUpdate.projectId = formData.projectId;
          }
          
          if (Object.keys(credentialsUpdate).length > 0) {
            updatePayload.credentials = credentialsUpdate;
          }

          const accountResponse = await fetch(`/api/groups/${groupId}/ai-accounts/${selectedService.accountId}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(updatePayload),
          });

          const accountResult = await accountResponse.json();
          if (accountResult.success) {
            toast.success('账户更新成功');
            setConfigDialogOpen(false);
            fetchServices();
            onRefresh?.();
          } else {
            toast.error(accountResult.message || '账户更新失败');
          }
          return;
        }
      }

      // 原有的服务配置逻辑（非账户管理模式）
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
        proxySettings: {
          enableProxy: formData.enableProxy,
          proxyType: formData.proxyType,
          routingStrategy: formData.routingStrategy,
          failoverEnabled: formData.failoverEnabled,
          healthCheckEnabled: formData.healthCheckEnabled,
          priority: formData.priority,
        },
        authConfig: {
          apiKey: formData.apiKey,
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

  const openConfigDialog = async (service: AiServiceDetail) => {
    setSelectedService(service);
    
    // 重置步骤状态
    setCurrentStep(1);
    setOauthStep(1);
    setAuthUrl('');
    setAuthCode('');
    
    // 检查是否已有绑定的账户
    const hasAccount = !!service.accountId;
    setAccountMode(hasAccount ? 'manage' : 'create');
    
    // 如果有账户，获取账户详细信息
    if (hasAccount) {
      try {
        const token = localStorage.getItem('token');
        if (token) {
          const response = await fetch(`/api/groups/${groupId}/ai-accounts/${service.accountId}`, {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });
          const result = await response.json();
          if (result.success) {
            setExistingAccount(result.data);
            // 更新表单数据以反映现有账户信息
            setTimeout(() => {
              setFormData(prev => ({
                ...prev,
                accountName: result.data.name || prev.accountName,
                accountDescription: result.data.description || prev.accountDescription,
                accountType: result.data.accountType || prev.accountType,
                authType: result.data.authType || prev.authType,
                projectId: result.data.credentials?.projectId || prev.projectId,
                proxyEnabled: !!(result.data.proxy?.host),
                selectedProxyId: result.data.proxy?.proxyId || '', // 如果有选中的代理ID
                proxyType: result.data.proxy?.type || 'socks5',
                proxyHost: result.data.proxy?.host || '',
                proxyPort: result.data.proxy?.port?.toString() || '',
                proxyUsername: result.data.proxy?.username || '',
                proxyPassword: result.data.proxy?.password || '',
              }));
            }, 100);
          }
        }
      } catch (error) {
        console.error('Failed to fetch account details:', error);
      }
    } else {
      setExistingAccount(null);
    }
    
    setFormData(prev => ({
      ...prev,
      isEnabled: service.isEnabled,
      priority: service.priority,
      dailyTokenLimit: service.quotaConfig?.dailyTokenLimit ? Number(service.quotaConfig.dailyTokenLimit) : 100000,
      monthlyTokenLimit: service.quotaConfig?.monthlyTokenLimit ? Number(service.quotaConfig.monthlyTokenLimit) : 3000000,
      dailyCostLimit: service.quotaConfig?.dailyCostLimit || 10.0,
      monthlyCostLimit: service.quotaConfig?.monthlyCostLimit || 300.0,
      userDailyTokenLimit: service.quotaConfig?.userDailyTokenLimit ? String(service.quotaConfig.userDailyTokenLimit) : '',
      userMonthlyTokenLimit: service.quotaConfig?.userMonthlyTokenLimit ? String(service.quotaConfig.userMonthlyTokenLimit) : '',
      apiKey: service.authConfig?.apiKey || '',
      useAccountAuth: true, // 默认使用账户认证
      routingStrategy: service.routingStrategy || 'priority',
      enableProxy: service.proxySettings?.enableProxy || false,
      proxyType: service.proxySettings?.proxyType || 'none',
      failoverEnabled: service.proxySettings?.failoverEnabled !== false,
      healthCheckEnabled: service.proxySettings?.healthCheckEnabled !== false,
      // 根据模式初始化账户配置字段
      accountName: `${service.aiService.displayName} Account`,
      accountDescription: `${service.aiService.displayName} 服务专用账户`,
      accountType: 'shared',
      authType: 'oauth',
      projectId: '',
      proxyEnabled: false,
      proxyHost: '',
      proxyPort: '',
      proxyUsername: '',
      proxyPassword: '',
    }));
    setConfigDialogOpen(true);
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
                  <Button onClick={() => {
                    setSelectedNewService('');
                    setAvailableServices(getAvailableServices());
                  }}>
                    <Plus className="mr-2 w-4 h-4" />
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
                      <Select value={selectedNewService} onValueChange={setSelectedNewService}>
                        <SelectTrigger>
                          <SelectValue placeholder="选择AI服务" />
                        </SelectTrigger>
                        <SelectContent>
                          {getAvailableServices().length > 0 ? (
                            getAvailableServices().map((service) => (
                              <SelectItem key={service.id} value={service.id}>
                                {service.displayName} ({service.serviceName})
                              </SelectItem>
                            ))
                          ) : (
                            <SelectItem value="no-services" disabled>
                              暂无可用服务
                            </SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                    {selectedNewService && (
                      <div className="flex justify-end space-x-2">
                        <Button variant="outline" onClick={() => {
                          setAddDialogOpen(false);
                          setSelectedNewService('');
                        }}>
                          取消
                        </Button>
                        <Button onClick={async () => {
                          if (!selectedNewService) return;
                          
                          try {
                            const token = localStorage.getItem('token');
                            if (!token) return;

                            const payload = {
                              aiServiceId: selectedNewService,
                              isEnabled: true,
                              priority: 1,
                              quota: {
                                dailyTokenLimit: 100000,
                                monthlyTokenLimit: 3000000,
                                dailyCostLimit: 10.0,
                                monthlyCostLimit: 300.0,
                              },
                              authConfig: {
                                apiKey: '',
                              },
                              proxySettings: {
                                enableProxy: false,
                                proxyType: 'none',
                                routingStrategy: 'priority',
                                failoverEnabled: true,
                                healthCheckEnabled: true,
                                priority: 1,
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
                              toast.success('AI服务添加成功');
                              setAddDialogOpen(false);
                              setSelectedNewService('');
                              fetchServices();
                              onRefresh?.();
                            } else {
                              toast.error(result.message || '添加失败');
                            }
                          } catch (error) {
                            console.error('Failed to add service:', error);
                            toast.error('添加失败');
                          }
                        }}>
                          添加服务
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
            <div className="py-8 text-center">
              <Activity className="mx-auto mb-4 w-12 h-12 text-gray-400" />
              <p className="mb-4 text-gray-500">还没有配置AI服务</p>
              {isAdmin && (
                <Button onClick={() => {
                  setSelectedNewService('');
                  setAddDialogOpen(true);
                  setAvailableServices(getAvailableServices());
                }}>
                  <Plus className="mr-2 w-4 h-4" />
                  添加AI服务
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 配置对话框 */}
      <Dialog open={configDialogOpen} onOpenChange={setConfigDialogOpen}>
        <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              配置 {selectedService?.aiService.displayName}
            </DialogTitle>
            <DialogDescription>
              管理AI服务的账户、配额、路由和代理设置
            </DialogDescription>
          </DialogHeader>
          
          <Tabs defaultValue="accounts" className="w-full">
            <TabsList className="grid grid-cols-2 mb-6 w-full">
              <TabsTrigger value="service" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                服务配置
              </TabsTrigger>
              <TabsTrigger value="accounts" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                账户管理
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="service" className="mt-0 space-y-6">
            {/* 认证设置 */}
            <div className="p-4 space-y-4 rounded-lg border">
              <h4 className="flex gap-2 items-center text-sm font-medium">
                <Key className="w-4 h-4" />
                认证设置
              </h4>
              <div className="flex items-center space-x-2">
                <Switch
                  checked={formData.useAccountAuth}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, useAccountAuth: checked }))}
                />
                <Label>使用账户认证（推荐）</Label>
              </div>
              
              {formData.useAccountAuth ? (
                <div className="space-y-2">
                  <Label>选择账户</Label>
                  <Select value={formData.accountId} onValueChange={(value) => setFormData(prev => ({ ...prev, accountId: value }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="选择已配置的账户" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">请先在账户管理中添加账户</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    切换到"账户管理"标签页来添加和管理账户
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <Label>API密钥</Label>
                  <Input
                    type="password"
                    value={formData.apiKey}
                    onChange={(e) => setFormData(prev => ({ ...prev, apiKey: e.target.value }))}
                    placeholder="输入AI服务的API密钥"
                  />
                  <p className="text-xs text-muted-foreground">
                    建议使用账户认证，支持OAuth和更高级的功能
                  </p>
                </div>
              )}
            </div>

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
            </TabsContent>
            
            <TabsContent value="accounts" className="space-y-4">
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold">
                      {accountMode === 'create' 
                        ? `添加 ${selectedService?.aiService.displayName} 账户`
                        : `管理 ${selectedService?.aiService.displayName} 账户`
                      }
                    </h3>
                    <p className="text-sm text-gray-500">
                      {accountMode === 'create'
                        ? '创建专用于此AI服务的认证账户'
                        : '管理已绑定的AI服务认证账户'
                      }
                    </p>
                  </div>
                </div>

                {/* 创建模式 - 显示步骤指示器 */}
                {accountMode === 'create' && (
                  <div className="flex items-center justify-center py-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center space-x-4">
                      <div className="flex items-center">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
                          currentStep >= 1 ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-500'
                        }`}>
                          1
                        </div>
                        <span className="ml-2 text-sm font-medium text-gray-700">基本信息</span>
                      </div>
                      <div className="w-8 h-0.5 bg-gray-300"></div>
                      <div className="flex items-center">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
                          currentStep >= 2 ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-500'
                        }`}>
                          2
                        </div>
                        <span className="ml-2 text-sm font-medium text-gray-700">授权认证</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* 管理模式 - 显示账户状态 */}
                {accountMode === 'manage' && existingAccount && (
                  <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center">
                        <User className="w-5 h-5 text-white" />
                      </div>
                      <div className="flex-1">
                        <h4 className="font-medium text-green-800">
                          {existingAccount.name}
                        </h4>
                        <p className="text-sm text-green-600">
                          {existingAccount.accountType === 'shared' ? '共享账户' : '专属账户'} • 
                          {existingAccount.authType === 'oauth' ? 'OAuth认证' : 'API Key认证'}
                        </p>
                        {existingAccount.description && (
                          <p className="text-xs text-green-600 mt-1">
                            {existingAccount.description}
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        <Badge variant="default" className="bg-green-100 text-green-800">
                          已连接
                        </Badge>
                        {existingAccount.lastUsedAt && (
                          <p className="text-xs text-green-600 mt-1">
                            最后使用: {new Date(existingAccount.lastUsedAt).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* 创建模式: 步骤1: 基本信息 */}
                {accountMode === 'create' && currentStep === 1 && (
                  <div className="space-y-6">
                    {/* 平台选择 - 已固定 */}
                    <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                      <h4 className="flex gap-2 items-center text-sm font-medium text-blue-800 mb-2">
                        <Shield className="w-4 h-4" />
                        平台: {selectedService?.aiService.displayName}
                      </h4>
                      <p className="text-xs text-blue-700">
                        将为 {selectedService?.aiService.displayName} 服务创建专用账户
                      </p>
                    </div>

                    {/* 认证方式选择 */}
                    <div className="p-4 space-y-4 rounded-lg border">
                      <h4 className="flex gap-2 items-center text-sm font-medium">
                        <Key className="w-4 h-4" />
                        认证方式
                      </h4>
                      <RadioGroup
                        value={formData.authType}
                        onValueChange={(value: 'oauth' | 'api_key') => setFormData(prev => ({ ...prev, authType: value }))}
                        className="flex gap-6"
                      >
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="oauth" id="step1-oauth" />
                          <Label htmlFor="step1-oauth">OAuth 授权 (推荐)</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="api_key" id="step1-api-key" />
                          <Label htmlFor="step1-api-key">手动输入 Access Token</Label>
                        </div>
                      </RadioGroup>
                    </div>

                    {/* 账户基本信息 */}
                    <div className="p-4 space-y-4 rounded-lg border">
                      <h4 className="flex gap-2 items-center text-sm font-medium">
                        <User className="w-4 h-4" />
                        账户信息
                      </h4>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>账户名称</Label>
                          <Input
                            value={formData.accountName}
                            onChange={(e) => setFormData(prev => ({ ...prev, accountName: e.target.value }))}
                            placeholder="为账户设置一个易识别的名称"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>账户类型</Label>
                          <RadioGroup
                            value={formData.accountType}
                            onValueChange={(value: 'shared' | 'dedicated') => setFormData(prev => ({ ...prev, accountType: value }))}
                            className="flex gap-4"
                          >
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value="shared" id="step1-shared" />
                              <Label htmlFor="step1-shared">共享账户</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value="dedicated" id="step1-dedicated" />
                              <Label htmlFor="step1-dedicated">专属账户</Label>
                            </div>
                          </RadioGroup>
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <Label>描述 (可选)</Label>
                        <Textarea
                          value={formData.accountDescription}
                          onChange={(e) => setFormData(prev => ({ ...prev, accountDescription: e.target.value }))}
                          placeholder="账户用途说明..."
                          className="resize-none"
                          rows={2}
                        />
                      </div>
                      
                      <div className="text-xs text-gray-500 bg-gray-50 p-3 rounded">
                        <strong>账户类型说明：</strong>
                        <br />• 共享账户：供所有API Key使用，适合团队共享
                        <br />• 专属账户：仅供特定API Key使用，适合个人专用
                      </div>
                    </div>

                    {/* Gemini项目配置 */}
                    {selectedService?.aiService.serviceName === 'gemini' && (
                      <div className="p-4 space-y-4 rounded-lg border">
                        <h4 className="flex gap-2 items-center text-sm font-medium">
                          <Settings className="w-4 h-4" />
                          Gemini 项目配置
                        </h4>
                        <div className="space-y-2">
                          <Label>项目编号 (可选)</Label>
                          <Input
                            value={formData.projectId}
                            onChange={(e) => setFormData(prev => ({ ...prev, projectId: e.target.value }))}
                            placeholder="例如：123456789012（纯数字）"
                          />
                          <div className="text-xs text-amber-700 bg-amber-50 p-3 rounded border border-amber-200">
                            <strong>提示：</strong>Google Cloud/Workspace 账号需要提供项目编号。
                            如果您使用的是普通个人Google账号，可以留空此字段。
                          </div>
                        </div>
                      </div>
                    )}

                    {/* 代理配置 */}
                    <ProxyConfig
                      groupId={groupId}
                      value={{
                        enabled: formData.proxyEnabled,
                        selectedProxyId: formData.selectedProxyId,
                        type: formData.proxyType as 'socks5' | 'http' | 'https',
                        host: formData.proxyHost,
                        port: formData.proxyPort,
                        username: formData.proxyUsername,
                        password: formData.proxyPassword
                      }}
                      onChange={(proxy) => setFormData(prev => ({
                        ...prev,
                        proxyEnabled: proxy.enabled,
                        selectedProxyId: proxy.selectedProxyId || '',
                        proxyType: proxy.type,
                        proxyHost: proxy.host,
                        proxyPort: proxy.port,
                        proxyUsername: proxy.username || '',
                        proxyPassword: proxy.password || ''
                      }))}
                    />

                    {/* 手动Token输入（仅在选择api_key时显示）*/}
                    {formData.authType === 'api_key' && (
                      <div className="p-4 space-y-4 rounded-lg border border-orange-200 bg-orange-50">
                        <h4 className="flex gap-2 items-center text-sm font-medium text-orange-800">
                          <Key className="w-4 h-4" />
                          Access Token 配置
                        </h4>
                        <div className="space-y-2">
                          <Label>Access Token</Label>
                          <Textarea
                            value={formData.apiKey}
                            onChange={(e) => setFormData(prev => ({ ...prev, apiKey: e.target.value }))}
                            placeholder="请输入 Access Token..."
                            className="resize-none font-mono text-xs"
                            rows={3}
                          />
                          <div className="text-xs text-orange-700">
                            <strong>获取方法：</strong>从已登录的 {selectedService?.aiService.displayName} CLI 获取凭证文件中的 Access Token
                          </div>
                        </div>
                      </div>
                    )}

                    {/* 步骤1操作按钮 */}
                    <div className="flex justify-end space-x-2 pt-4 border-t">
                      <Button variant="outline" onClick={() => setConfigDialogOpen(false)}>
                        取消
                      </Button>
                      {formData.authType === 'oauth' ? (
                        <Button onClick={() => {
                          if (!formData.accountName.trim()) {
                            toast.error('请填写账户名称');
                            return;
                          }
                          setCurrentStep(2);
                        }}>
                          下一步
                        </Button>
                      ) : (
                        <Button onClick={() => {
                          if (!formData.accountName.trim()) {
                            toast.error('请填写账户名称');
                            return;
                          }
                          if (!formData.apiKey.trim()) {
                            toast.error('请填写 Access Token');
                            return;
                          }
                          // 直接创建账户（API Key模式）
                          handleConfigureService();
                        }}>
                          创建账户
                        </Button>
                      )}
                    </div>
                  </div>
                )}

                {/* 创建模式: 步骤2: OAuth授权流程 */}
                {accountMode === 'create' && currentStep === 2 && formData.authType === 'oauth' && (
                  <div className="space-y-6">
                    <div className="p-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">
                        请按照以下步骤完成 Claude 账户的授权：
                      </h3>

                      {/* OAuth流程步骤 */}
                      <div className="space-y-4">
                        {/* 步骤1: 点击下方按钮生成授权链接 */}
                        <div className="p-4 rounded-lg border border-blue-200 bg-blue-50">
                          <div className="flex items-start gap-3">
                            <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0">
                              1
                            </div>
                            <div className="flex-1">
                              <h4 className="font-medium text-gray-900 mb-3">点击下方按钮生成授权链接</h4>
                              <Button 
                                className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2"
                                onClick={() => {
                                  setAuthUrl(`https://auth.${selectedService?.aiService.serviceName}.com/oauth/authorize`);
                                  setOauthStep(2);
                                }}
                              >
                                🔗 生成授权链接
                              </Button>
                            </div>
                          </div>
                        </div>

                        {/* 步骤2: 在浏览器中打开链接并完成授权 */}
                        <div className={`p-4 rounded-lg border ${
                          oauthStep >= 2 ? 'border-blue-200 bg-blue-50' : 'border-gray-200 bg-gray-50'
                        }`}>
                          <div className="flex items-start gap-3">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold flex-shrink-0 ${
                              oauthStep >= 2 ? 'bg-blue-500 text-white' : 'bg-gray-300 text-gray-600'
                            }`}>
                              2
                            </div>
                            <div className="flex-1">
                              <h4 className="font-medium text-gray-900 mb-2">在浏览器中打开链接并完成授权</h4>
                              <p className="text-sm text-gray-700 mb-3">
                                请在新标签页中打开授权链接，登录您的 Claude 账户并授权。
                              </p>
                              {oauthStep >= 2 && authUrl && (
                                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                                  <div className="flex items-start gap-2 text-sm">
                                    <span className="text-yellow-600">⚠️</span>
                                    <span className="text-yellow-800">
                                      <strong>注意：</strong>如果您设置了代理，请确保浏览器也使用相同的代理访问授权页面。
                                    </span>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* 步骤3: 输入 Authorization Code */}
                        <div className={`p-4 rounded-lg border ${
                          oauthStep >= 3 || authUrl ? 'border-blue-200 bg-blue-50' : 'border-gray-200 bg-gray-50'
                        }`}>
                          <div className="flex items-start gap-3">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold flex-shrink-0 ${
                              oauthStep >= 3 || authUrl ? 'bg-blue-500 text-white' : 'bg-gray-300 text-gray-600'
                            }`}>
                              3
                            </div>
                            <div className="flex-1">
                              <h4 className="font-medium text-gray-900 mb-2">输入 Authorization Code</h4>
                              <p className="text-sm text-gray-700 mb-3">
                                授权完成后，页面会显示一个 <strong>Authorization Code</strong>，请将其复制并粘贴到下方输入框：
                              </p>
                              
                              <div className="space-y-3">
                                <div>
                                  <label className="text-sm font-medium text-blue-600 flex items-center gap-1">
                                    🔑 Authorization Code
                                  </label>
                                  <Input
                                    value={authCode}
                                    onChange={(e) => setAuthCode(e.target.value)}
                                    placeholder="粘贴从Claude页面获取的Authorization Code..."
                                    className="mt-1 font-mono text-sm"
                                  />
                                </div>
                                
                                <div className="text-xs text-gray-500 bg-gray-100 p-2 rounded">
                                  💡 请粘贴从Claude页面复制的Authorization Code
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* 步骤2操作按钮 */}
                    <div className="flex justify-between pt-4 border-t">
                      <Button variant="outline" onClick={() => setCurrentStep(1)}>
                        上一步
                      </Button>
                      <div className="flex gap-2">
                        <Button variant="outline" onClick={() => setConfigDialogOpen(false)}>
                          取消
                        </Button>
                        {authUrl && (
                          <Button
                            onClick={() => {
                              if (!authCode.trim()) {
                                toast.error('请输入授权码');
                                return;
                              }
                              // 完成OAuth授权并创建账户
                              handleConfigureService();
                            }}
                            disabled={!authCode.trim()}
                            className="bg-blue-500 hover:bg-blue-600"
                          >
                            完成授权
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* 管理模式: 账户更新界面 */}
                {accountMode === 'manage' && (
                  <div className="space-y-6">
                    {/* 账户基本信息编辑 */}
                    <div className="p-4 space-y-4 rounded-lg border">
                      <h4 className="flex gap-2 items-center text-sm font-medium">
                        <User className="w-4 h-4" />
                        账户信息
                      </h4>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>账户名称</Label>
                          <Input
                            value={formData.accountName}
                            onChange={(e) => setFormData(prev => ({ ...prev, accountName: e.target.value }))}
                            placeholder="为账户设置一个易识别的名称"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>账户类型</Label>
                          <RadioGroup
                            value={formData.accountType}
                            onValueChange={(value: 'shared' | 'dedicated') => setFormData(prev => ({ ...prev, accountType: value }))}
                            className="flex gap-4"
                          >
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value="shared" id="manage-shared" />
                              <Label htmlFor="manage-shared">共享账户</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value="dedicated" id="manage-dedicated" />
                              <Label htmlFor="manage-dedicated">专属账户</Label>
                            </div>
                          </RadioGroup>
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <Label>描述 (可选)</Label>
                        <Textarea
                          value={formData.accountDescription}
                          onChange={(e) => setFormData(prev => ({ ...prev, accountDescription: e.target.value }))}
                          placeholder="账户用途说明..."
                          className="resize-none"
                          rows={2}
                        />
                      </div>
                    </div>

                    {/* Token 更新卡片 - 仿照截图样式 */}
                    <div className="p-4 space-y-4 rounded-lg border border-orange-200 bg-orange-50">
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center flex-shrink-0">
                          <Key className="w-4 h-4 text-white" />
                        </div>
                        <div className="flex-1">
                          <h4 className="text-base text-orange-900 mb-2 font-medium">更新 Token</h4>
                          <p className="text-sm text-orange-800 mb-2">
                            可以更新 Access Token 和 Refresh Token。为了安全起见，不会显示当前的 Token 值。
                          </p>
                          <div className="flex items-center gap-1 text-xs text-orange-700">
                            <span>💡</span>
                            <span>留空表示不更新该字段。</span>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label>新的 Access Token</Label>
                          <Textarea
                            value={formData.apiKey}
                            onChange={(e) => setFormData(prev => ({ ...prev, apiKey: e.target.value }))}
                            placeholder="留空表示不更新..."
                            className="resize-none font-mono text-xs bg-white"
                            rows={4}
                          />
                        </div>
                        
                        <div className="space-y-2">
                          <Label>新的 Refresh Token</Label>
                          <Textarea
                            value={formData.refreshToken || ''}
                            onChange={(e) => setFormData(prev => ({ ...prev, refreshToken: e.target.value }))}
                            placeholder="留空表示不更新..."
                            className="resize-none font-mono text-xs bg-white"
                            rows={4}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Gemini项目配置 */}
                    {selectedService?.aiService.serviceName === 'gemini' && (
                      <div className="p-4 space-y-4 rounded-lg border">
                        <h4 className="flex gap-2 items-center text-sm font-medium">
                          <Settings className="w-4 h-4" />
                          Gemini 项目配置
                        </h4>
                        <div className="space-y-2">
                          <Label>项目编号 (可选)</Label>
                          <Input
                            value={formData.projectId}
                            onChange={(e) => setFormData(prev => ({ ...prev, projectId: e.target.value }))}
                            placeholder="例如：123456789012（纯数字）"
                          />
                          <div className="text-xs text-amber-700 bg-amber-50 p-3 rounded border border-amber-200">
                            <strong>提示：</strong>Google Cloud/Workspace 账号需要提供项目编号。
                            如果您使用的是普通个人Google账号，可以留空此字段。
                          </div>
                        </div>
                      </div>
                    )}

                    {/* 代理配置 */}
                    <ProxyConfig
                      groupId={groupId}
                      value={{
                        enabled: formData.proxyEnabled,
                        selectedProxyId: formData.selectedProxyId,
                        type: formData.proxyType as 'socks5' | 'http' | 'https',
                        host: formData.proxyHost,
                        port: formData.proxyPort,
                        username: formData.proxyUsername,
                        password: formData.proxyPassword
                      }}
                      onChange={(proxy) => setFormData(prev => ({
                        ...prev,
                        proxyEnabled: proxy.enabled,
                        selectedProxyId: proxy.selectedProxyId || '',
                        proxyType: proxy.type,
                        proxyHost: proxy.host,
                        proxyPort: proxy.port,
                        proxyUsername: proxy.username || '',
                        proxyPassword: proxy.password || ''
                      }))}
                    />

                    {/* OAuth 重新授权选项 */}
                    {existingAccount?.authType === 'oauth' && (
                      <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                        <h4 className="flex gap-2 items-center text-sm font-medium text-blue-800 mb-2">
                          <Shield className="w-4 h-4" />
                          OAuth 重新授权
                        </h4>
                        <p className="text-xs text-blue-700 mb-3">
                          如果当前Token已过期或无效，可以进行OAuth重新授权获取新的凭证。
                        </p>
                        <Button size="sm" variant="outline" className="border-blue-300 text-blue-700 hover:bg-blue-100">
                          开始重新授权
                        </Button>
                      </div>
                    )}

                    {/* 管理模式操作按钮 */}
                    <div className="flex justify-between pt-4 border-t">
                      <Button 
                        variant="outline" 
                        className="text-red-600 border-red-300 hover:bg-red-50"
                        onClick={async () => {
                          if (confirm('确定要解绑此账户吗？解绑后需要重新创建账户才能使用此服务。')) {
                            try {
                              const token = localStorage.getItem('token');
                              if (!token) return;

                              const response = await fetch(`/api/groups/${groupId}/ai-services/${selectedService.aiService.id}/unbind-account`, {
                                method: 'DELETE',
                                headers: {
                                  Authorization: `Bearer ${token}`,
                                },
                              });

                              const result = await response.json();
                              if (result.success) {
                                toast.success('账户已解绑');
                                setConfigDialogOpen(false);
                                fetchServices();
                                onRefresh?.();
                              } else {
                                toast.error(result.message || '解绑失败');
                              }
                            } catch (error) {
                              console.error('Failed to unbind account:', error);
                              toast.error('解绑失败');
                            }
                          }
                        }}
                      >
                        解绑账户
                      </Button>
                      <div className="flex space-x-2">
                        <Button variant="outline" onClick={() => setConfigDialogOpen(false)}>
                          取消
                        </Button>
                        <Button onClick={() => {
                          if (!formData.accountName.trim()) {
                            toast.error('请填写账户名称');
                            return;
                          }
                          handleConfigureService();
                        }}>
                          更新账户
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </div>
  );
}
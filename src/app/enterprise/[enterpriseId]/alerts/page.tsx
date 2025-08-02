'use client';

/**
 * 企业专属告警管理页面
 * 
 * 功能：
 * - 告警规则配置
 * - 告警历史查看
 * - 通知设置管理
 * - 告警响应处理
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { 
  Bell,
  AlertTriangle,
  AlertCircle,
  Info,
  CheckCircle,
  XCircle,
  Clock,
  Plus,
  Edit,
  Trash2,
  Search,
  Filter,
  Settings,
  Mail,
  MessageSquare,
  Smartphone,
  Users,
  Activity,
  TrendingUp,
  ChevronLeft,
  Building2
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEnterpriseContext } from '@/contexts/enterprise-context';

interface AlertRule {
  id: string;
  name: string;
  description: string;
  condition: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  isEnabled: boolean;
  triggers: string[];
  actions: string[];
  cooldown: number;
  createdAt: string;
  lastTriggered?: string;
}

interface AlertIncident {
  id: string;
  ruleId: string;
  ruleName: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  status: 'active' | 'resolved' | 'suppressed';
  title: string;
  description: string;
  startTime: string;
  endTime?: string;
  resolvedBy?: string;
  affectedServices: string[];
}

interface NotificationChannel {
  id: string;
  name: string;
  type: 'email' | 'sms' | 'webhook' | 'slack';
  isEnabled: boolean;
  config: Record<string, any>;
  recipients: string[];
}

interface AlertsData {
  rules: AlertRule[];
  incidents: AlertIncident[];
  channels: NotificationChannel[];
  stats: {
    totalRules: number;
    activeRules: number;
    activeIncidents: number;
    resolvedToday: number;
  };
}

export default function EnterpriseAlertsPage({ params }: { params: Promise<{ enterpriseId: string }> }) {
  const { enterpriseId } = React.use(params);
  const router = useRouter();
  const { currentEnterprise, hasRole } = useEnterpriseContext();
  const [alertsData, setAlertsData] = useState<AlertsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showRuleDialog, setShowRuleDialog] = useState(false);
  const [showChannelDialog, setShowChannelDialog] = useState(false);
  const [selectedRule, setSelectedRule] = useState<AlertRule | null>(null);

  useEffect(() => {
    fetchAlertsData();
  }, [enterpriseId]);

  const fetchAlertsData = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/enterprises/${enterpriseId}/alerts`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setAlertsData(data.data);
        } else {
          setError(data.message || '获取告警数据失败');
        }
      } else {
        setError('获取告警数据失败');
      }
    } catch (error) {
      console.error('获取告警数据失败:', error);
      setError('获取告警数据失败');
    } finally {
      setLoading(false);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'text-red-600 bg-red-50 border-red-200';
      case 'error':
        return 'text-red-600 bg-red-50 border-red-200';
      case 'warning':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'info':
        return 'text-blue-600 bg-blue-50 border-blue-200';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <XCircle className="w-4 h-4 text-red-500" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      case 'info':
        return <Info className="w-4 h-4 text-blue-500" />;
      default:
        return <Bell className="w-4 h-4 text-gray-500" />;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <AlertTriangle className="w-4 h-4 text-red-500" />;
      case 'resolved':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'suppressed':
        return <XCircle className="w-4 h-4 text-gray-500" />;
      default:
        return <Clock className="w-4 h-4 text-gray-500" />;
    }
  };

  const getChannelIcon = (type: string) => {
    switch (type) {
      case 'email':
        return <Mail className="w-4 h-4 text-blue-500" />;
      case 'sms':
        return <Smartphone className="w-4 h-4 text-green-500" />;
      case 'webhook':
        return <Activity className="w-4 h-4 text-purple-500" />;
      case 'slack':
        return <MessageSquare className="w-4 h-4 text-orange-500" />;
      default:
        return <Bell className="w-4 h-4 text-gray-500" />;
    }
  };

  const filteredIncidents = alertsData?.incidents.filter(incident => {
    const matchesSearch = incident.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         incident.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesSeverity = severityFilter === 'all' || incident.severity === severityFilter;
    const matchesStatus = statusFilter === 'all' || incident.status === statusFilter;
    return matchesSearch && matchesSeverity && matchesStatus;
  }) || [];

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-32 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error || !alertsData) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center py-12">
          <Bell className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">告警数据加载失败</h3>
          <p className="text-gray-600 mb-4">{error || '暂无告警数据'}</p>
          <Button onClick={fetchAlertsData}>重试</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-6xl mx-auto">
        {/* 面包屑和标题 */}
        <div className="flex items-center gap-4 mb-6">
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => router.push(`/enterprise/${enterpriseId}/dashboard`)}
          >
            <ChevronLeft className="w-4 h-4 mr-2" />
            返回企业控制面板
          </Button>
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Building2 className="w-4 h-4" />
            <span>{currentEnterprise?.name || '未知企业'}</span>
            <span>/</span>
            <span>告警管理</span>
          </div>
        </div>

        <div className="space-y-6">
        {/* 页面标题 */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Bell className="w-6 h-6 text-red-600" />
              告警管理
            </h1>
            <p className="text-gray-600 mt-1">
              配置和管理企业系统告警规则和通知
            </p>
          </div>
          {hasRole(['owner', 'admin']) && (
            <div className="flex gap-2">
              <Dialog open={showChannelDialog} onOpenChange={setShowChannelDialog}>
                <DialogTrigger asChild>
                  <Button variant="outline">
                    <Settings className="w-4 h-4 mr-2" />
                    通知设置
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>通知渠道设置</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="text-center py-8">
                      <Settings className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-600">通知设置功能开发中...</p>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
              <Dialog open={showRuleDialog} onOpenChange={setShowRuleDialog}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="w-4 h-4 mr-2" />
                    创建规则
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>创建告警规则</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="text-center py-8">
                      <Plus className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-600">告警规则创建功能开发中...</p>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          )}
        </div>

        {/* 告警概览统计 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">告警规则</p>
                  <p className="text-2xl font-bold text-gray-900">{alertsData.stats.totalRules}</p>
                </div>
                <Bell className="w-8 h-8 text-blue-500" />
              </div>
              <div className="mt-4">
                <div className="text-sm text-gray-600">
                  {alertsData.stats.activeRules} 个活跃规则
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">活跃告警</p>
                  <p className="text-2xl font-bold text-red-600">{alertsData.stats.activeIncidents}</p>
                </div>
                <AlertTriangle className="w-8 h-8 text-red-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">今日已解决</p>
                  <p className="text-2xl font-bold text-green-600">{alertsData.stats.resolvedToday}</p>
                </div>
                <CheckCircle className="w-8 h-8 text-green-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">通知渠道</p>
                  <p className="text-2xl font-bold text-gray-900">{alertsData.channels.length}</p>
                </div>
                <MessageSquare className="w-8 h-8 text-purple-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 详细信息标签页 */}
        <Tabs defaultValue="incidents" className="space-y-4">
          <TabsList>
            <TabsTrigger value="incidents">告警事件</TabsTrigger>
            <TabsTrigger value="rules">告警规则</TabsTrigger>
            <TabsTrigger value="channels">通知渠道</TabsTrigger>
          </TabsList>

          <TabsContent value="incidents">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>告警事件</CardTitle>
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                      <Input
                        placeholder="搜索告警..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10 w-64"
                      />
                    </div>
                    <Select value={severityFilter} onValueChange={setSeverityFilter}>
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">所有级别</SelectItem>
                        <SelectItem value="critical">严重</SelectItem>
                        <SelectItem value="error">错误</SelectItem>
                        <SelectItem value="warning">警告</SelectItem>
                        <SelectItem value="info">信息</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">所有状态</SelectItem>
                        <SelectItem value="active">活跃</SelectItem>
                        <SelectItem value="resolved">已解决</SelectItem>
                        <SelectItem value="suppressed">已抑制</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {filteredIncidents.map((incident) => (
                    <div key={incident.id} className="flex items-start justify-between p-4 border rounded-lg">
                      <div className="flex items-start space-x-4">
                        {getSeverityIcon(incident.severity)}
                        <div>
                          <h4 className="font-medium text-gray-900">{incident.title}</h4>
                          <p className="text-sm text-gray-600 mt-1">{incident.description}</p>
                          <div className="flex items-center space-x-4 mt-2 text-xs text-gray-500">
                            <span>开始时间: {new Date(incident.startTime).toLocaleString('zh-CN')}</span>
                            {incident.endTime && (
                              <span>结束时间: {new Date(incident.endTime).toLocaleString('zh-CN')}</span>
                            )}
                            <span>影响服务: {incident.affectedServices.join(', ')}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-3">
                        <Badge className={`flex items-center gap-1 ${getSeverityColor(incident.severity)}`}>
                          {getSeverityIcon(incident.severity)}
                          {incident.severity}
                        </Badge>
                        <Badge 
                          variant={incident.status === 'active' ? 'destructive' : 
                                  incident.status === 'resolved' ? 'default' : 'secondary'}
                          className="flex items-center gap-1"
                        >
                          {getStatusIcon(incident.status)}
                          {incident.status}
                        </Badge>
                        {hasRole(['owner', 'admin']) && incident.status === 'active' && (
                          <Button variant="outline" size="sm">
                            处理
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="rules">
            <Card>
              <CardHeader>
                <CardTitle>告警规则</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {alertsData.rules.map((rule) => (
                    <div key={rule.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center space-x-4">
                        <Switch checked={rule.isEnabled} />
                        <div>
                          <h4 className="font-medium text-gray-900">{rule.name}</h4>
                          <p className="text-sm text-gray-600">{rule.description}</p>
                          <div className="flex items-center space-x-4 mt-2 text-xs text-gray-500">
                            <span>条件: {rule.condition}</span>
                            <span>冷却时间: {rule.cooldown}秒</span>
                            {rule.lastTriggered && (
                              <span>最后触发: {new Date(rule.lastTriggered).toLocaleString('zh-CN')}</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-3">
                        <Badge className={`flex items-center gap-1 ${getSeverityColor(rule.severity)}`}>
                          {getSeverityIcon(rule.severity)}
                          {rule.severity}
                        </Badge>
                        {hasRole(['owner', 'admin']) && (
                          <div className="flex gap-1">
                            <Button variant="ghost" size="sm">
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="sm">
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="channels">
            <Card>
              <CardHeader>
                <CardTitle>通知渠道</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {alertsData.channels.map((channel) => (
                    <div key={channel.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center space-x-4">
                        <Switch checked={channel.isEnabled} />
                        <div className="flex items-center space-x-3">
                          {getChannelIcon(channel.type)}
                          <div>
                            <h4 className="font-medium text-gray-900">{channel.name}</h4>
                            <p className="text-sm text-gray-600">
                              {channel.recipients.length} 个接收者
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-3">
                        <Badge variant="secondary">
                          {channel.type}
                        </Badge>
                        {hasRole(['owner', 'admin']) && (
                          <div className="flex gap-1">
                            <Button variant="ghost" size="sm">
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="sm">
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
        </div>
      </div>
    </div>
  );
}
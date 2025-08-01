'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  AlertTriangle,
  AlertCircle,
  CheckCircle,
  Clock,
  Bell,
  TrendingUp,
  Activity
} from 'lucide-react';

interface AlertSummary {
  total: number;
  active: number;
  resolved: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  recentAlerts: AlertItem[];
}

interface AlertItem {
  id: string;
  ruleId: string;
  ruleName: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'active' | 'resolved' | 'suppressed';
  entityType: string;
  entityId: string;
  entityName?: string;
  message: string;
  details: Record<string, any>;
  triggeredAt: string;
  resolvedAt?: string;
}

interface AlertMonitorProps {
  enterpriseId: string;
}

export function AlertMonitor({ enterpriseId }: AlertMonitorProps) {
  const [alertSummary, setAlertSummary] = useState<AlertSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchAlerts = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/enterprises/${enterpriseId}/alerts?summary=true`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();
      if (data.success) {
        setAlertSummary(data.data.summary);
      } else {
        setError(data.error || '获取告警信息失败');
      }
    } catch (error) {
      console.error('获取告警信息失败:', error);
      setError('获取告警信息失败');
    } finally {
      setLoading(false);
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <AlertTriangle className="w-4 h-4 text-red-500" />;
      case 'high':
        return <AlertCircle className="w-4 h-4 text-orange-500" />;
      case 'medium':
        return <Clock className="w-4 h-4 text-yellow-500" />;
      case 'low':
        return <CheckCircle className="w-4 h-4 text-blue-500" />;
      default:
        return <Bell className="w-4 h-4 text-gray-500" />;
    }
  };

  const getSeverityBadge = (severity: string) => {
    const variants = {
      'critical': 'destructive' as const,
      'high': 'destructive' as const,
      'medium': 'default' as const,
      'low': 'secondary' as const
    };

    const labels = {
      'critical': '严重',
      'high': '高',
      'medium': '中',
      'low': '低'
    };

    return (
      <Badge variant={variants[severity as keyof typeof variants] || 'secondary'}>
        {labels[severity as keyof typeof labels] || severity}
      </Badge>
    );
  };

  const getEntityTypeLabel = (entityType: string) => {
    const labels: Record<string, string> = {
      'model': '模型',
      'department': '部门',
      'group': '拼车组',
      'enterprise': '企业'
    };
    return labels[entityType] || entityType;
  };

  useEffect(() => {
    fetchAlerts();
    
    // 每30秒刷新一次
    const interval = setInterval(fetchAlerts, 30000);
    return () => clearInterval(interval);
  }, [enterpriseId]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="text-center py-8">
          <div className="text-gray-500">加载告警信息...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 头部 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">告警监控</h2>
          <p className="text-gray-600">实时监控系统状态和异常告警</p>
        </div>
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-green-500" />
          <span className="text-sm text-green-600">监控中</span>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {alertSummary && (
        <>
          {/* 告警统计 */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">活跃告警</p>
                    <p className="text-3xl font-bold text-red-600">{alertSummary.active}</p>
                  </div>
                  <AlertTriangle className="w-8 h-8 text-red-500" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">严重告警</p>
                    <p className="text-3xl font-bold text-red-600">{alertSummary.critical}</p>
                  </div>
                  <AlertCircle className="w-8 h-8 text-red-500" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">高级告警</p>
                    <p className="text-3xl font-bold text-orange-600">{alertSummary.high}</p>
                  </div>
                  <Clock className="w-8 h-8 text-orange-500" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">总告警数</p>
                    <p className="text-3xl font-bold">{alertSummary.total}</p>
                  </div>
                  <Bell className="w-8 h-8 text-gray-500" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 最近告警 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                最近告警
              </CardTitle>
              <CardDescription>
                最近触发的告警事件
              </CardDescription>
            </CardHeader>
            <CardContent>
              {alertSummary.recentAlerts.length > 0 ? (
                <div className="space-y-4">
                  {alertSummary.recentAlerts.map((alert) => (
                    <div key={alert.id} className="flex items-start gap-4 p-4 border rounded-lg">
                      <div className="flex-shrink-0 mt-1">
                        {getSeverityIcon(alert.severity)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-2">
                          <h4 className="font-medium text-sm">{alert.ruleName}</h4>
                          {getSeverityBadge(alert.severity)}
                          <Badge variant="outline" className="text-xs">
                            {getEntityTypeLabel(alert.entityType)}
                          </Badge>
                        </div>
                        <p className="text-sm text-gray-600 mb-2">{alert.message}</p>
                        <div className="flex items-center gap-4 text-xs text-gray-500">
                          <span>实体: {alert.entityName || alert.entityId}</span>
                          <span>时间: {new Date(alert.triggeredAt).toLocaleString()}</span>
                          {alert.resolvedAt && (
                            <span>已解决: {new Date(alert.resolvedAt).toLocaleString()}</span>
                          )}
                        </div>
                        {alert.details && Object.keys(alert.details).length > 0 && (
                          <div className="mt-2 p-2 bg-gray-50 rounded text-xs">
                            {Object.entries(alert.details).map(([key, value]) => (
                              <div key={key} className="flex justify-between">
                                <span className="font-medium">{key}:</span>
                                <span>{typeof value === 'object' ? JSON.stringify(value) : String(value)}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="flex-shrink-0">
                        <Badge variant={alert.status === 'active' ? 'destructive' : 'secondary'}>
                          {alert.status === 'active' ? '活跃' : '已解决'}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <CheckCircle className="w-12 h-12 mx-auto text-green-500 mb-4" />
                  <h3 className="text-lg font-medium mb-2">系统运行正常</h3>
                  <p className="text-gray-600">
                    当前没有活跃的告警，所有系统都在正常运行
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* 告警规则状态 */}
          <Card>
            <CardHeader>
              <CardTitle>告警规则状态</CardTitle>
              <CardDescription>
                当前启用的告警监控规则
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="p-4 border rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    <span className="font-medium">模型健康监控</span>
                  </div>
                  <p className="text-sm text-gray-600">监控AI模型健康分数和可用性</p>
                </div>
                
                <div className="p-4 border rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    <span className="font-medium">性能监控</span>
                  </div>
                  <p className="text-sm text-gray-600">监控模型响应时间和错误率</p>
                </div>
                
                <div className="p-4 border rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    <span className="font-medium">预算监控</span>
                  </div>
                  <p className="text-sm text-gray-600">监控部门预算使用情况和超限</p>
                </div>
                
                <div className="p-4 border rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    <span className="font-medium">系统监控</span>
                  </div>
                  <p className="text-sm text-gray-600">监控系统错误和异常状态</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
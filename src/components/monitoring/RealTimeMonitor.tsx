'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Activity, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  Zap,
  Database,
  TrendingUp,
  AlertCircle
} from 'lucide-react';

interface AlertItem {
  id: string;
  type: 'warning' | 'error' | 'info';
  title: string;
  message: string;
  timestamp: string;
  resolved: boolean;
}

interface SystemStatus {
  apiHealth: 'healthy' | 'degraded' | 'down';
  responseTime: number;
  requestRate: number;
  errorRate: number;
  activeConnections: number;
}

interface RealTimeMonitorProps {
  groupId?: string;
  isEnterprise?: boolean;
}

export function RealTimeMonitor({ groupId, isEnterprise = false }: RealTimeMonitorProps) {
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [systemStatus, setSystemStatus] = useState<SystemStatus>({
    apiHealth: 'healthy',
    responseTime: 1200,
    requestRate: 145,
    errorRate: 0.2,
    activeConnections: 23
  });
  const [loading, setLoading] = useState(true);

  // 模拟实时数据更新
  useEffect(() => {
    const generateMockAlerts = () => {
      const mockAlerts: AlertItem[] = [
        {
          id: '1',
          type: 'warning',
          title: 'API响应时间延长',
          message: 'Claude API平均响应时间超过2秒，可能影响用户体验',
          timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
          resolved: false
        },
        {
          id: '2',
          type: 'info',
          title: '新AI账号已配置',
          message: '企业账号池已添加新的GPT-4账号，现在可以使用',
          timestamp: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
          resolved: true
        },
        {
          id: '3',
          type: 'error',
          title: 'OpenAI服务中断',
          message: 'OpenAI API暂时不可用，已自动切换到备用服务',
          timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
          resolved: true
        },
        {
          id: '4',
          type: 'warning',
          title: '预算使用告警',
          message: '技术部月度预算已使用80%，建议关注使用情况',
          timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
          resolved: false
        }
      ];
      
      setAlerts(mockAlerts);
    };

    const updateSystemStatus = () => {
      setSystemStatus(prev => ({
        ...prev,
        responseTime: Math.floor(Math.random() * 1000) + 800,
        requestRate: Math.floor(Math.random() * 50) + 120,
        errorRate: Math.random() * 1,
        activeConnections: Math.floor(Math.random() * 10) + 20
      }));
    };

    generateMockAlerts();
    setLoading(false);

    // 每30秒更新一次状态
    const interval = setInterval(updateSystemStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'text-green-600 bg-green-100';
      case 'degraded': return 'text-yellow-600 bg-yellow-100';
      case 'down': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'error': return AlertTriangle;
      case 'warning': return AlertCircle;
      case 'info': return CheckCircle;
      default: return Activity;
    }
  };

  const getAlertColor = (type: string) => {
    switch (type) {
      case 'error': return 'border-red-200 bg-red-50';
      case 'warning': return 'border-yellow-200 bg-yellow-50';
      case 'info': return 'border-blue-200 bg-blue-50';
      default: return 'border-gray-200 bg-gray-50';
    }
  };

  const resolveAlert = (alertId: string) => {
    setAlerts(prev => 
      prev.map(alert => 
        alert.id === alertId 
          ? { ...alert, resolved: true }
          : alert
      )
    );
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="py-8">
            <div className="text-center text-gray-500">加载监控数据...</div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const activeAlerts = alerts.filter(alert => !alert.resolved);
  const resolvedAlerts = alerts.filter(alert => alert.resolved);

  return (
    <div className="space-y-6">
      {/* 系统状态概览 */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">API健康状态</p>
                <Badge className={getStatusColor(systemStatus.apiHealth)}>
                  {systemStatus.apiHealth === 'healthy' ? '正常' : 
                   systemStatus.apiHealth === 'degraded' ? '降级' : '故障'}
                </Badge>
              </div>
              <Activity className="w-8 h-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">平均响应时间</p>
                <p className="text-2xl font-bold">{systemStatus.responseTime}ms</p>
              </div>
              <Clock className="w-8 h-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">请求率</p>
                <p className="text-2xl font-bold">{systemStatus.requestRate}/min</p>
              </div>
              <TrendingUp className="w-8 h-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">错误率</p>
                <p className="text-2xl font-bold">{systemStatus.errorRate.toFixed(2)}%</p>
              </div>
              <Zap className="w-8 h-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 活跃告警 */}
      {activeAlerts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-500" />
              活跃告警 ({activeAlerts.length})
            </CardTitle>
            <CardDescription>需要关注的系统告警和通知</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {activeAlerts.map((alert) => {
                const AlertIcon = getAlertIcon(alert.type);
                return (
                  <div key={alert.id} className={`p-4 border rounded-lg ${getAlertColor(alert.type)}`}>
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <AlertIcon className="w-5 h-5 mt-0.5" />
                        <div>
                          <div className="font-medium">{alert.title}</div>
                          <div className="text-sm text-gray-600 mt-1">{alert.message}</div>
                          <div className="text-xs text-gray-500 mt-2">
                            {new Date(alert.timestamp).toLocaleString('zh-CN')}
                          </div>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => resolveAlert(alert.id)}
                      >
                        标记已解决
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 系统性能指标 */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>服务状态</CardTitle>
            <CardDescription>各AI服务提供商的实时状态</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[
                { service: 'Claude API', status: 'healthy', latency: '1.2s' },
                { service: 'OpenAI API', status: 'degraded', latency: '2.8s' },
                { service: 'Gemini API', status: 'healthy', latency: '1.5s' },
                { service: '千帆 API', status: 'healthy', latency: '0.9s' }
              ].map((item, index) => (
                <div key={index} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${
                      item.status === 'healthy' ? 'bg-green-500' :
                      item.status === 'degraded' ? 'bg-yellow-500' : 'bg-red-500'
                    }`}></div>
                    <span className="font-medium">{item.service}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-600">{item.latency}</span>
                    <Badge variant={item.status === 'healthy' ? 'default' : 'secondary'}>
                      {item.status === 'healthy' ? '正常' : '降级'}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>资源使用</CardTitle>
            <CardDescription>系统资源实时使用情况</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span>CPU使用率</span>
                  <span>45%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div className="bg-blue-600 h-2 rounded-full" style={{ width: '45%' }}></div>
                </div>
              </div>
              
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span>内存使用率</span>
                  <span>62%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div className="bg-green-600 h-2 rounded-full" style={{ width: '62%' }}></div>
                </div>
              </div>
              
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span>数据库连接</span>
                  <span>{systemStatus.activeConnections}/50</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div className="bg-purple-600 h-2 rounded-full" style={{ width: `${(systemStatus.activeConnections / 50) * 100}%` }}></div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 已解决的告警历史 */}
      {resolvedAlerts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-500" />
              告警历史
            </CardTitle>
            <CardDescription>最近已解决的告警记录</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {resolvedAlerts.slice(0, 5).map((alert) => {
                const AlertIcon = getAlertIcon(alert.type);
                return (
                  <div key={alert.id} className="p-3 border rounded-lg bg-gray-50">
                    <div className="flex items-start gap-3">
                      <AlertIcon className="w-4 h-4 mt-0.5 text-gray-400" />
                      <div className="flex-1">
                        <div className="font-medium text-gray-700">{alert.title}</div>
                        <div className="text-sm text-gray-600">{alert.message}</div>
                        <div className="text-xs text-gray-500 mt-1">
                          {new Date(alert.timestamp).toLocaleString('zh-CN')} • 已解决
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
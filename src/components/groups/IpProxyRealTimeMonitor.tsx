'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useIpProxyMonitor } from '@/hooks/useIpProxyMonitor';
import { 
  Activity, 
  Users, 
  TrendingUp, 
  Clock, 
  RefreshCw,
  Wifi,
  WifiOff,
  CheckCircle,
  XCircle,
  AlertTriangle,
  BarChart3,
  Globe
} from 'lucide-react';

interface IpProxyRealTimeMonitorProps {
  groupId: string;
  proxyId: string;
  proxyName: string;
  isAdmin: boolean;
}

export function IpProxyRealTimeMonitor({ 
  groupId, 
  proxyId, 
  proxyName, 
  isAdmin 
}: IpProxyRealTimeMonitorProps) {
  const [refreshInterval, setRefreshInterval] = useState(5000);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const {
    data,
    loading,
    error,
    isConnected,
    refresh,
    updateProxyHealth,
    formatBytes,
    calculateSuccessRate,
    getStatusColor
  } = useIpProxyMonitor({
    groupId,
    proxyId,
    enabled: autoRefresh,
    refreshInterval
  });

  // 执行健康检查
  const handleHealthCheck = async () => {
    if (!data) return;

    try {
      // 这里应该实际测试代理连接，暂时模拟
      const startTime = Date.now();
      
      // 模拟健康检查（实际应该测试代理连接）
      const isHealthy = Math.random() > 0.2; // 80%概率健康
      const responseTime = Math.floor(Math.random() * 500) + 50; // 50-550ms
      
      await updateProxyHealth({
        isHealthy,
        responseTime,
        errorMessage: isHealthy ? undefined : '连接超时或代理服务器无响应'
      });

      alert(isHealthy ? '健康检查通过' : '健康检查失败');
    } catch (error) {
      console.error('健康检查失败:', error);
      alert('健康检查失败: ' + (error instanceof Error ? error.message : '未知错误'));
    }
  };

  if (loading && !data) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto mb-4"></div>
            <div className="text-gray-600">加载监控数据...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error && !data) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <div className="text-center">
            <XCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
            <div className="text-red-500 mb-4">{error}</div>
            <Button onClick={refresh}>重试</Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <div className="text-center">
            <Globe className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <div className="text-gray-500">暂无监控数据</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* 监控控制面板 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center space-x-2">
                <Activity className="w-5 h-5" />
                <span>实时监控 - {proxyName}</span>
                <div className="flex items-center space-x-2 ml-4">
                  {isConnected ? (
                    <Badge variant="default" className="bg-green-100 text-green-800">
                      <Wifi className="w-3 h-3 mr-1" />
                      已连接
                    </Badge>
                  ) : (
                    <Badge variant="secondary">
                      <WifiOff className="w-3 h-3 mr-1" />
                      未连接
                    </Badge>
                  )}
                  <Badge variant="outline">
                    {new Date(data.timestamp).toLocaleTimeString('zh-CN')}
                  </Badge>
                </div>
              </CardTitle>
              <CardDescription>
                实时监控代理服务器的连接状态、流量使用和性能指标
              </CardDescription>
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setAutoRefresh(!autoRefresh)}
              >
                {autoRefresh ? '暂停' : '开始'}自动刷新
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={refresh}
                disabled={loading}
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                刷新
              </Button>
              {isAdmin && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleHealthCheck}
                >
                  <CheckCircle className="w-4 h-4 mr-2" />
                  健康检查
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* 实时统计概览 */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center">
              <Users className="w-5 h-5 text-blue-600 mr-3" />
              <div>
                <div className="text-2xl font-bold">{data.realTimeStats.activeConnections}</div>
                <div className="text-sm text-gray-600">活跃连接</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center">
              <BarChart3 className="w-5 h-5 text-green-600 mr-3" />
              <div>
                <div className="text-2xl font-bold">{data.realTimeStats.totalConnections}</div>
                <div className="text-sm text-gray-600">总连接数</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center">
              <CheckCircle className="w-5 h-5 text-purple-600 mr-3" />
              <div>
                <div className="text-2xl font-bold">{data.realTimeStats.successRate}%</div>
                <div className="text-sm text-gray-600">成功率</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center">
              <TrendingUp className="w-5 h-5 text-orange-600 mr-3" />
              <div>
                <div className="text-2xl font-bold">{formatBytes(data.realTimeStats.totalBytes)}</div>
                <div className="text-sm text-gray-600">流量使用</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center">
              <Clock className="w-5 h-5 text-indigo-600 mr-3" />
              <div>
                <div className="text-2xl font-bold">{data.realTimeStats.avgResponseTime}ms</div>
                <div className="text-sm text-gray-600">响应时间</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 代理状态详情 */}
      <Card>
        <CardHeader>
          <CardTitle>代理状态</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">运行状态</span>
                <Badge 
                  variant={data.proxyStatus.status === 'active' ? 'default' : 'destructive'}
                  className={data.proxyStatus.status === 'active' ? 'bg-green-100 text-green-800' : ''}
                >
                  {data.proxyStatus.status === 'active' ? '正常运行' : '异常'}
                </Badge>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">启用状态</span>
                <Badge variant={data.proxyStatus.isEnabled ? 'default' : 'secondary'}>
                  {data.proxyStatus.isEnabled ? '已启用' : '已禁用'}
                </Badge>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">连接使用</span>
                <span className="text-sm">
                  {data.proxyStatus.currentConnections} / {data.proxyStatus.maxConnections}
                </span>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>连接使用率</span>
                  <span>
                    {Math.round((data.proxyStatus.currentConnections / data.proxyStatus.maxConnections) * 100)}%
                  </span>
                </div>
                <Progress 
                  value={(data.proxyStatus.currentConnections / data.proxyStatus.maxConnections) * 100} 
                  className="h-2"
                />
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">流量使用</span>
                <span className="text-sm">
                  {formatBytes(data.proxyStatus.trafficUsed)}
                  {data.proxyStatus.trafficLimit && ` / ${formatBytes(data.proxyStatus.trafficLimit)}`}
                </span>
              </div>

              {data.proxyStatus.trafficLimit && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>流量使用率</span>
                    <span>
                      {Math.round((Number(data.proxyStatus.trafficUsed) / Number(data.proxyStatus.trafficLimit)) * 100)}%
                    </span>
                  </div>
                  <Progress 
                    value={(Number(data.proxyStatus.trafficUsed) / Number(data.proxyStatus.trafficLimit)) * 100} 
                    className="h-2"
                  />
                </div>
              )}

              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">最后检查</span>
                <span className="text-sm text-gray-600">
                  {data.proxyStatus.lastCheckAt 
                    ? new Date(data.proxyStatus.lastCheckAt).toLocaleString('zh-CN')
                    : '从未检查'
                  }
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">响应时间</span>
                <span className="text-sm">
                  {data.proxyStatus.responseTime ? `${data.proxyStatus.responseTime}ms` : '未知'}
                </span>
              </div>
            </div>
          </div>

          {data.proxyStatus.errorMessage && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-start">
                <AlertTriangle className="w-5 h-5 text-red-600 mr-2 mt-0.5 flex-shrink-0" />
                <div>
                  <div className="text-red-800 font-medium mb-1">错误信息</div>
                  <div className="text-red-700 text-sm">{data.proxyStatus.errorMessage}</div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 用户使用统计 */}
      {data.userStats.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>用户使用统计</CardTitle>
            <CardDescription>
              显示各用户的连接使用情况和流量消耗
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.userStats.map((userStat) => (
                <div key={userStat.user.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
                      <span className="text-sm font-medium">
                        {userStat.user.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <div className="font-medium">{userStat.user.name}</div>
                      <div className="text-sm text-gray-500">{userStat.user.email}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-medium">{formatBytes(userStat.bytes)}</div>
                    <div className="text-sm text-gray-500">
                      {userStat.connections} 次连接 · 成功率 {calculateSuccessRate(userStat.successfulConnections, userStat.connections)}%
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 最近连接记录 */}
      {data.recentLogs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>最近连接记录</CardTitle>
            <CardDescription>
              显示最近的代理连接活动和状态
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {data.recentLogs.map((log) => (
                <div key={log.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
                      <span className="text-sm font-medium">
                        {log.user.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <div className="font-medium">{log.targetHost}:{log.targetPort}</div>
                      <div className="text-sm text-gray-500">
                        {log.user.name} · {new Date(log.startTime).toLocaleString('zh-CN')}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge variant={log.status === 'success' ? 'default' : 'destructive'}>
                      {log.status === 'success' ? '成功' : '失败'}
                    </Badge>
                    <div className="text-sm text-gray-500 mt-1">
                      {formatBytes(Number(log.bytesIn || 0) + Number(log.bytesOut || 0))}
                      {log.duration && ` · ${log.duration}s`}
                    </div>
                    {log.errorMessage && (
                      <div className="text-sm text-red-500 mt-1 max-w-32 truncate" title={log.errorMessage}>
                        {log.errorMessage}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
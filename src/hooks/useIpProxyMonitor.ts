import { useState, useEffect, useRef, useCallback } from 'react';

interface MonitorData {
  proxyId: string;
  timestamp: string;
  realTimeStats: {
    activeConnections: number;
    totalConnections: number;
    successRate: number;
    totalBytes: number;
    avgResponseTime: number;
  };
  minuteStats: Array<{
    time: string;
    connections: number;
    successfulConnections: number;
    bytes: number;
  }>;
  userStats: Array<{
    user: {
      id: string;
      name: string;
      email: string;
    };
    connections: number;
    successfulConnections: number;
    bytes: number;
  }>;
  recentLogs: Array<{
    id: string;
    userId: string;
    user: {
      id: string;
      name: string;
      email: string;
    };
    targetHost: string;
    targetPort: number;
    status: string;
    startTime: string;
    endTime?: string;
    duration?: number;
    bytesIn?: bigint;
    bytesOut?: bigint;
    errorMessage?: string;
  }>;
  proxyStatus: {
    status: string;
    isEnabled: boolean;
    currentConnections: number;
    maxConnections: number;
    trafficUsed: bigint;
    trafficLimit?: bigint;
    lastCheckAt?: string;
    responseTime?: number;
    errorMessage?: string;
  };
}

interface UseIpProxyMonitorOptions {
  groupId: string;
  proxyId: string;
  enabled?: boolean;
  refreshInterval?: number; // 刷新间隔，毫秒
}

export function useIpProxyMonitor({
  groupId,
  proxyId,
  enabled = true,
  refreshInterval = 5000 // 默认5秒刷新一次
}: UseIpProxyMonitorOptions) {
  const [data, setData] = useState<MonitorData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const mountedRef = useRef(true);

  // 获取监控数据
  const fetchMonitorData = useCallback(async () => {
    if (!enabled || !mountedRef.current) return;

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setError('未找到认证令牌');
        return;
      }

      const response = await fetch(`/api/groups/${groupId}/ip-proxy/${proxyId}/monitor`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      
      if (result.success) {
        if (mountedRef.current) {
          setData(result.data);
          setError(null);
          setIsConnected(true);
        }
      } else {
        throw new Error(result.error || '获取监控数据失败');
      }
    } catch (err) {
      console.error('获取监控数据失败:', err);
      if (mountedRef.current) {
        setError(err instanceof Error ? err.message : '网络错误');
        setIsConnected(false);
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [groupId, proxyId, enabled]);

  // 启动监控
  const startMonitoring = useCallback(() => {
    if (!enabled || intervalRef.current) return;

    // 立即获取一次数据
    fetchMonitorData();

    // 设置定时刷新
    intervalRef.current = setInterval(fetchMonitorData, refreshInterval);
  }, [fetchMonitorData, enabled, refreshInterval]);

  // 停止监控
  const stopMonitoring = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsConnected(false);
  }, []);

  // 手动刷新
  const refresh = useCallback(() => {
    setLoading(true);
    fetchMonitorData();
  }, [fetchMonitorData]);

  // 更新代理健康状态
  const updateProxyHealth = useCallback(async (healthCheckData: {
    isHealthy: boolean;
    responseTime?: number;
    errorMessage?: string;
  }) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('未找到认证令牌');
      }

      const response = await fetch(`/api/groups/${groupId}/ip-proxy/${proxyId}/monitor`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          action: 'health_check',
          healthCheckData
        }),
      });

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || '更新健康状态失败');
      }

      // 刷新监控数据
      fetchMonitorData();
      
      return result.data;
    } catch (err) {
      console.error('更新代理健康状态失败:', err);
      throw err;
    }
  }, [groupId, proxyId, fetchMonitorData]);

  // 格式化字节数
  const formatBytes = useCallback((bytes: number | bigint) => {
    const numBytes = typeof bytes === 'bigint' ? Number(bytes) : bytes;
    if (numBytes === 0) return '0 B';
    
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(numBytes) / Math.log(k));
    
    return parseFloat((numBytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }, []);

  // 计算成功率
  const calculateSuccessRate = useCallback((successful: number, total: number) => {
    return total > 0 ? Math.round((successful / total) * 100) : 0;
  }, []);

  // 获取状态颜色
  const getStatusColor = useCallback((status: string) => {
    switch (status) {
      case 'active':
        return 'text-green-600';
      case 'error':
        return 'text-red-600';
      case 'inactive':
        return 'text-gray-600';
      default:
        return 'text-yellow-600';
    }
  }, []);

  // 组件挂载时启动监控
  useEffect(() => {
    mountedRef.current = true;
    
    if (enabled) {
      startMonitoring();
    }

    return () => {
      mountedRef.current = false;
      stopMonitoring();
    };
  }, [enabled, startMonitoring, stopMonitoring]);

  // 当参数变化时重新启动监控
  useEffect(() => {
    if (enabled) {
      stopMonitoring();
      startMonitoring();
    }
  }, [groupId, proxyId, refreshInterval]);

  return {
    data,
    loading,
    error,
    isConnected,
    refresh,
    startMonitoring,
    stopMonitoring,
    updateProxyHealth,
    formatBytes,
    calculateSuccessRate,
    getStatusColor
  };
}
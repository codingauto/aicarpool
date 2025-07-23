/**
 * API相关类型定义
 */

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  timestamp: string;
}

export interface RegisterNodeRequest {
  nodeName: string;
  location: string;
  endpoint: string;
  capabilities: {
    cpu: { cores: number; frequency: string };
    memory: { total: string; available: string };
    network: { bandwidth: string; latency: number };
    maxConnections: number;
  };
  serverId?: string;
}

export interface RegisterNodeResponse {
  nodeId: string;
  publicKey: string;
  privateKey: string;
  endpoint: string;
}

export interface HeartbeatRequest {
  nodeId: string;
  currentLoad: {
    cpu: number;
    memory: number;
    connections: number;
    requestsPerSecond: number;
  };
  status?: 'active' | 'maintenance';
  metadata?: Record<string, any>;
}

export interface ConfigSyncRequest {
  nodeId: string;
  currentVersion?: string;
}

export interface ConfigSyncResponse {
  configuration: {
    aiServices?: Record<string, any>;
    routing?: Record<string, any>;
    security?: Record<string, any>;
  };
  version: string;
  timestamp: string;
}

export interface HealthCheckRequest {
  nodeId: string;
  healthData: {
    status: 'healthy' | 'unhealthy' | 'warning';
    score: number;
    checks: Record<string, any>;
    timestamp: string;
  };
}

export interface MetricsReportRequest {
  nodeId: string;
  metrics: Array<{
    metricType: string;
    value: number;
    unit: string;
    timestamp: string;
    metadata?: Record<string, any>;
  }>;
}

export interface ProxyRequestData {
  method: string;
  url: string;
  headers: Record<string, string>;
  body?: any;
  groupId: string;
  userId: string;
  serviceType: string;
}

export interface ProxyResponseData {
  statusCode: number;
  headers: Record<string, string>;
  body?: any;
  responseTime: number;
  error?: string;
}

export interface WebSocketMessage {
  type: 'heartbeat' | 'config_update' | 'health_check' | 'proxy_request' | 'node_command';
  id: string;
  timestamp: string;
  data: any;
}

export interface NodeCommand {
  command: 'restart' | 'update_config' | 'health_check' | 'stop_service' | 'start_service';
  parameters?: Record<string, any>;
  nodeId: string;
}

export interface CommandResponse {
  commandId: string;
  status: 'success' | 'error' | 'in_progress';
  message?: string;
  data?: any;
  timestamp: string;
}
/**
 * 边缘节点类型定义
 */

export interface NodeCapabilities {
  cpu: {
    cores: number;
    frequency: string;
  };
  memory: {
    total: string;
    available: string;
  };
  network: {
    bandwidth: string;
    latency: number;
  };
  maxConnections: number;
}

export interface NodeLoad {
  cpu: number;          // CPU使用率百分比
  memory: number;       // 内存使用率百分比
  connections: number;  // 当前连接数
  requestsPerSecond: number; // 每秒请求数
}

export interface NodeInfo {
  nodeId: string;
  nodeName: string;
  location: string;
  endpoint: string;
  status: 'active' | 'inactive' | 'maintenance';
  capabilities: NodeCapabilities;
  currentLoad: NodeLoad;
  healthScore: number;
  version: string;
}

export interface NodeRegistration {
  nodeName: string;
  location: string;
  endpoint: string;
  capabilities: NodeCapabilities;
  serverId?: string;
}

export interface NodeAuth {
  nodeId: string;
  publicKey: string;
  privateKey: string;
  endpoint: string;
}

export interface HeartbeatData {
  nodeId: string;
  timestamp: Date;
  currentLoad: NodeLoad;
  status?: 'active' | 'maintenance';
  metadata?: Record<string, any>;
}

export interface ConfigSync {
  aiServices?: Record<string, any>;
  routing?: Record<string, any>;
  security?: Record<string, any>;
  version: string;
  timestamp: Date;
}

export interface LoadBalancingStrategy {
  algorithm: 'round_robin' | 'least_connections' | 'weighted_round_robin' | 'geographic' | 'health_based';
  weights?: Record<string, number>;
  healthThreshold?: number;
  geographicPreference?: string[];
}

export interface AiServiceConfig {
  name: string;
  displayName: string;
  endpoint: string;
  apiKeyHeader: string;
  apiKeyPrefix?: string;
  timeout: number;
  retryAttempts: number;
  models?: string[];
  rateLimit?: {
    requests: number;
    window: number;
  };
}

export interface UsageStats {
  service: string;
  model: string;
  requestId?: string;
  timestamp: Date;
  responseTime: number;
  success: boolean;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  estimatedCost?: number;
  errorType?: string;
  errorMessage?: string;
  groupId?: string;
  userApiKeyHash?: string;
}

export interface ServiceHealthStats {
  serviceName: string;
  status: string;
  responseTime?: number;
  errorMessage?: string;
  consecutiveSuccesses?: number;
  consecutiveFailures?: number;
  avgResponseTime?: number;
  successRate?: number;
}

export interface HealthMetrics {
  timestamp: Date;
  cpu: number;
  memory: number;
  network: number;
  requests: number;
}

export interface ProxyRequest {
  requestId?: string;
  service: string;
  model: string;
  messages: any[];
  apiKey?: string;
  headers?: Record<string, string>;
  maxTokens?: number;
  temperature?: number;
  parameters?: Record<string, any>;
}

export interface ProxyResponse {
  success: boolean;
  data?: any;
  error?: string;
  responseTime: number;
  service: string;
  model: string;
}

export interface MetricData {
  nodeId: string;
  metricType: 'cpu' | 'memory' | 'network' | 'requests' | 'response_time' | 'error_rate';
  value: number;
  unit: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface HealthCheckResult {
  status: 'healthy' | 'unhealthy' | 'warning';
  score: number;
  checks: {
    cpu: { status: string; value: number };
    memory: { status: string; value: number };
    network: { status: string; value: number };
    disk: { status: string; value: number };
    services: { status: string; count: number };
  };
  timestamp: Date;
}

export interface EdgeNodeEvent {
  type: 'register' | 'heartbeat' | 'config_update' | 'health_check' | 'shutdown';
  nodeId: string;
  timestamp: Date;
  data?: any;
}

// Claude Code 专用类型定义
export interface ClaudeCodeRequest extends ProxyRequest {
  stream?: boolean;
  system?: string | SystemMessage[];
  anthropic_version?: string;
  max_tokens?: number;
  temperature?: number;
  tools?: Tool[];
  tool_choice?: ToolChoice;
}

export interface SystemMessage {
  type: 'text';
  text: string;
  cache_control?: {
    type: 'ephemeral';
  };
}

export interface Tool {
  name: string;
  description: string;
  input_schema: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
}

export interface ToolChoice {
  type: 'auto' | 'any' | 'tool';
  name?: string;
}

export interface ClaudeCodeUser {
  id: string;
  apiKey: string;
  userId: string;
  quotaDaily: number;
  quotaMonthly: number;
  usedDaily: number;
  usedMonthly: number;
  createdAt: Date;
  lastUsedAt?: Date;
  status: 'active' | 'suspended' | 'expired';
  version?: string;
  metadata?: Record<string, any>;
}

export interface ClaudeCodeUsage {
  userId: string;
  requestId: string;
  timestamp: Date;
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
  totalTokens: number;
  model: string;
  requestDuration: number;
  success: boolean;
  error?: string;
  tools?: string[];
  files?: string[];
}

export interface ClaudeCodeHeaders {
  'user-agent': string;
  'anthropic-version': string;
  'x-stainless-lang'?: string;
  'x-stainless-package-version'?: string;
  'x-stainless-os'?: string;
  'x-stainless-arch'?: string;
  'x-stainless-runtime'?: string;
  'x-stainless-runtime-version'?: string;
  'x-app'?: string;
  'accept-language'?: string;
  'anthropic-dangerous-direct-browser-access'?: string;
  [key: string]: string | undefined;
}

export interface ClaudeCodeConfig {
  supportedVersions: string[];
  systemPrompt: string;
  defaultHeaders: ClaudeCodeHeaders;
  quotaLimits: {
    daily: number;
    monthly: number;
  };
  features: {
    tools: boolean;
    files: boolean;
    streaming: boolean;
    memory: boolean;
  };
}
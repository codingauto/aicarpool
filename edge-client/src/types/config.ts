/**
 * 配置相关类型定义
 */

export interface ServerConfig {
  port: number;
  host: string;
  ssl?: {
    enabled: boolean;
    certPath: string;
    keyPath: string;
  };
  keepAliveTimeout: number;
  requestTimeout: number;
  maxConnections: number;
}

export interface CentralServerConfig {
  url: string;
  wsUrl: string;
  timeout: number;
  retryAttempts: number;
  retryDelay: number;
}

export interface AuthConfig {
  privateKeyPath: string;
  publicKeyPath: string;
  tokenExpiration: number;
}

export interface LoggingConfig {
  level: 'error' | 'warn' | 'info' | 'debug';
  maxSize: string;
  maxFiles: string;
  datePattern: string;
  zippedArchive: boolean;
}

export interface MonitoringConfig {
  metricsInterval: number;
  heartbeatInterval: number;
  healthCheckInterval: number;
  retentionDays: number;
}

export interface ProxyConfig {
  timeout: number;
  retryAttempts: number;
  retryDelay: number;
  rateLimit: {
    windowMs: number;
    max: number;
  };
}

export interface EdgeNodeConfig {
  node: {
    name: string;
    location: string;
    endpoint: string;
    capabilities: {
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
    };
  };
  server: ServerConfig;
  centralServer: CentralServerConfig;
  auth: AuthConfig;
  logging: LoggingConfig;
  monitoring: MonitoringConfig;
  proxy: ProxyConfig;
  environment: 'development' | 'production' | 'test';
  debug: boolean;
}
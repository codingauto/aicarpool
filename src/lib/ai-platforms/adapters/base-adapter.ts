/**
 * AI服务平台适配器基础接口
 * 定义所有平台适配器需要实现的通用接口
 */

export interface Credentials {
  [key: string]: string;
}

export interface ProxyConfig {
  type: 'http' | 'socks5';
  host: string;
  port: number;
  username?: string;
  password?: string;
}

export interface ServiceStatus {
  isHealthy: boolean;
  status: 'active' | 'error' | 'maintenance' | 'warning';
  responseTime?: number;
  errorMessage?: string;
  lastChecked: Date;
}

export interface ValidationResult {
  isValid: boolean;
  errorMessage?: string;
  details?: {
    [key: string]: any;
  };
}

export interface ModelInfo {
  id: string;
  name: string;
  description?: string;
  contextLength?: number;
  inputPrice?: number;   // per 1K tokens
  outputPrice?: number;  // per 1K tokens
  isAvailable: boolean;
}

export interface UsageStats {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  requests: number;
  cost: number;
  errors: number;
}

export interface RateLimitInfo {
  requestsPerMinute: number;
  tokensPerMinute: number;
  currentRequests: number;
  currentTokens: number;
  resetTime: Date;
}

/**
 * AI服务适配器基础接口
 */
export interface AIServiceAdapter {
  /**
   * 平台标识
   */
  readonly platformId: string;
  
  /**
   * 平台名称
   */
  readonly platformName: string;

  /**
   * 验证账号凭据
   * @param credentials 认证凭据
   * @param proxyConfig 代理配置
   */
  validateCredentials(
    credentials: Credentials, 
    proxyConfig?: ProxyConfig
  ): Promise<ValidationResult>;

  /**
   * 获取服务健康状态  
   * @param credentials 认证凭据
   * @param proxyConfig 代理配置
   */
  getServiceStatus(
    credentials: Credentials,
    proxyConfig?: ProxyConfig
  ): Promise<ServiceStatus>;

  /**
   * 获取可用模型列表
   * @param credentials 认证凭据
   * @param proxyConfig 代理配置
   */
  getAvailableModels(
    credentials: Credentials,
    proxyConfig?: ProxyConfig
  ): Promise<ModelInfo[]>;

  /**
   * 测试连接
   * @param credentials 认证凭据 
   * @param proxyConfig 代理配置
   */
  testConnection(
    credentials: Credentials,
    proxyConfig?: ProxyConfig
  ): Promise<boolean>;

  /**
   * 获取使用统计
   * @param credentials 认证凭据
   * @param startDate 开始日期
   * @param endDate 结束日期
   * @param proxyConfig 代理配置
   */
  getUsageStats?(
    credentials: Credentials,
    startDate: Date,
    endDate: Date,
    proxyConfig?: ProxyConfig
  ): Promise<UsageStats>;

  /**
   * 获取速率限制信息
   * @param credentials 认证凭据
   * @param proxyConfig 代理配置
   */
  getRateLimitInfo?(
    credentials: Credentials,
    proxyConfig?: ProxyConfig
  ): Promise<RateLimitInfo>;

  /**
   * 刷新访问令牌（OAuth平台）
   * @param refreshToken 刷新令牌
   * @param proxyConfig 代理配置
   */
  refreshAccessToken?(
    refreshToken: string,
    proxyConfig?: ProxyConfig
  ): Promise<{
    accessToken: string;
    refreshToken?: string;
    expiresAt: Date;
  }>;

  /**
   * 格式化错误信息
   * @param error 原始错误
   */
  formatError(error: any): string;
}

/**
 * OAuth适配器接口
 */
export interface OAuthAdapter extends AIServiceAdapter {
  /**
   * 生成OAuth授权URL
   * @param redirectUri 回调地址
   * @param state 状态参数
   * @param proxyConfig 代理配置
   */
  generateAuthUrl(
    redirectUri: string,
    state?: string,
    proxyConfig?: ProxyConfig
  ): Promise<{
    url: string;
    codeVerifier?: string;
    state: string;
  }>;

  /**
   * 交换授权码获取访问令牌
   * @param code 授权码
   * @param redirectUri 回调地址
   * @param codeVerifier PKCE验证码
   * @param proxyConfig 代理配置
   */
  exchangeCodeForToken(
    code: string,
    redirectUri: string,
    codeVerifier?: string,
    proxyConfig?: ProxyConfig
  ): Promise<{
    accessToken: string;
    refreshToken?: string;
    expiresAt: Date;
    scopes?: string[];
  }>;
}

/**
 * 适配器错误类
 */
export class AdapterError extends Error {
  constructor(
    message: string,
    public code?: string,
    public statusCode?: number,
    public originalError?: any
  ) {
    super(message);
    this.name = 'AdapterError';
  }
}

/**
 * 网络错误类
 */
export class NetworkError extends AdapterError {
  constructor(message: string, originalError?: any) {
    super(message, 'NETWORK_ERROR', undefined, originalError);
    this.name = 'NetworkError';
  }
}

/**
 * 认证错误类
 */
export class AuthenticationError extends AdapterError {
  constructor(message: string, originalError?: any) {
    super(message, 'AUTH_ERROR', 401, originalError);
    this.name = 'AuthenticationError';
  }
}

/**
 * 配额超限错误类
 */
export class QuotaExceededError extends AdapterError {
  constructor(message: string, originalError?: any) {
    super(message, 'QUOTA_EXCEEDED', 429, originalError);
    this.name = 'QuotaExceededError';
  }
}

/**
 * 服务不可用错误类
 */
export class ServiceUnavailableError extends AdapterError {
  constructor(message: string, originalError?: any) {
    super(message, 'SERVICE_UNAVAILABLE', 503, originalError);
    this.name = 'ServiceUnavailableError';
  }
}
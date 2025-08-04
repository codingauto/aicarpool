/**
 * HTTP客户端工具类
 * 支持代理配置和自动重试
 */

import axios, { 
  AxiosInstance, 
  AxiosRequestConfig, 
  AxiosResponse, 
  AxiosError 
} from 'axios';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { SocksProxyAgent } from 'socks-proxy-agent';
import { ProxyConfig } from '../adapters/base-adapter';

export interface HttpClientConfig {
  baseURL?: string;
  timeout?: number;
  proxy?: ProxyConfig;
  headers?: Record<string, string>;
  retries?: number;
  retryDelay?: number;
}

export class HttpClient {
  private client: AxiosInstance;
  private config: HttpClientConfig;

  constructor(config: HttpClientConfig = {}) {
    this.config = {
      timeout: 30000,
      retries: 3,
      retryDelay: 1000,
      ...config
    };

    this.client = this.createClient();
  }

  private createClient(): AxiosInstance {
    const axiosConfig: AxiosRequestConfig = {
      baseURL: this.config.baseURL,
      timeout: this.config.timeout,
      headers: this.config.headers || {}
    };

    // 配置代理
    if (this.config.proxy) {
      const agent = this.createProxyAgent(this.config.proxy);
      axiosConfig.httpsAgent = agent;
      axiosConfig.httpAgent = agent;
    }

    const client = axios.create(axiosConfig);

    // 添加重试拦截器
    this.addRetryInterceptor(client);

    return client;
  }

  private createProxyAgent(proxy: ProxyConfig): any {
    const { type, host, port, username, password } = proxy;
    
    let proxyUrl = `${type}://${host}:${port}`;
    if (username && password) {
      proxyUrl = `${type}://${username}:${password}@${host}:${port}`;
    }

    if (type === 'socks5') {
      return new SocksProxyAgent(proxyUrl);
    } else if (type === 'http') {
      return new HttpsProxyAgent(proxyUrl);
    }

    throw new Error(`Unsupported proxy type: ${type}`);
  }

  private addRetryInterceptor(client: AxiosInstance): void {
    client.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        const config = error.config as any;
        
        // 如果没有配置重试次数或已达到最大重试次数，直接抛出错误
        if (!this.config.retries || config._retryCount >= this.config.retries) {
          return Promise.reject(error);
        }

        // 只对可重试的错误进行重试
        if (!this.isRetryableError(error)) {
          return Promise.reject(error);
        }

        config._retryCount = config._retryCount || 0;
        config._retryCount++;

        // 计算延迟时间（指数退避）
        const delay = this.config.retryDelay! * Math.pow(2, config._retryCount - 1);
        
        await this.sleep(delay);
        
        return client(config);
      }
    );
  }

  private isRetryableError(error: AxiosError): boolean {
    // 网络错误或5xx服务器错误可重试
    if (!error.response) {
      return true; // 网络错误
    }

    const status = error.response.status;
    return status >= 500 || status === 429; // 服务器错误或限流
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * GET请求
   */
  async get<T = any>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.client.get(url, config);
  }

  /**
   * POST请求
   */
  async post<T = any>(
    url: string, 
    data?: any, 
    config?: AxiosRequestConfig
  ): Promise<AxiosResponse<T>> {
    return this.client.post(url, data, config);
  }

  /**
   * PUT请求
   */
  async put<T = any>(
    url: string, 
    data?: any, 
    config?: AxiosRequestConfig
  ): Promise<AxiosResponse<T>> {
    return this.client.put(url, data, config);
  }

  /**
   * DELETE请求
   */
  async delete<T = any>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.client.delete(url, config);
  }

  /**
   * 自定义请求
   */
  async request<T = any>(config: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.client.request(config);
  }

  /**
   * 设置默认头部
   */
  setDefaultHeaders(headers: Record<string, string>): void {
    Object.assign(this.client.defaults.headers, headers);
  }

  /**
   * 设置认证头部
   */
  setAuthHeader(token: string, type: 'Bearer' | 'API-Key' | 'Authorization' = 'Bearer'): void {
    this.client.defaults.headers.Authorization = type === 'Bearer' 
      ? `Bearer ${token}`
      : type === 'API-Key'
      ? token
      : `${type} ${token}`;
  }

  /**
   * 移除认证头部
   */
  removeAuthHeader(): void {
    delete this.client.defaults.headers.Authorization;
  }

  /**
   * 更新代理配置
   */
  updateProxy(proxy?: ProxyConfig): void {
    this.config.proxy = proxy;
    this.client = this.createClient();
  }

  /**
   * 获取当前配置
   */
  getConfig(): HttpClientConfig {
    return { ...this.config };
  }

  /**
   * 关闭客户端
   */
  close(): void {
    // 清理资源
    this.client.defaults.timeout = 0;
  }
}

/**
 * 创建HTTP客户端实例
 */
export function createHttpClient(config?: HttpClientConfig): HttpClient {
  return new HttpClient(config);
}

/**
 * 格式化HTTP错误
 */
export function formatHttpError(error: AxiosError): string {
  if (error.response) {
    const { status, statusText, data } = error.response;
    const message = typeof data === 'object' && data.message 
      ? data.message 
      : typeof data === 'string' 
      ? data 
      : statusText;
    
    return `HTTP ${status}: ${message}`;
  } else if (error.request) {
    return '网络请求失败，请检查网络连接或代理设置';
  } else {
    return `请求配置错误: ${error.message}`;
  }
}

/**
 * 检查是否为网络错误
 */
export function isNetworkError(error: AxiosError): boolean {
  return !error.response && !!error.request;
}

/**
 * 检查是否为认证错误
 */
export function isAuthError(error: AxiosError): boolean {
  return error.response?.status === 401 || error.response?.status === 403;
}

/**
 * 检查是否为限流错误
 */
export function isRateLimitError(error: AxiosError): boolean {
  return error.response?.status === 429;
}

/**
 * 检查是否为服务器错误
 */
export function isServerError(error: AxiosError): boolean {
  const status = error.response?.status;
  return status ? status >= 500 : false;
}
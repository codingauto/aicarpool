/**
 * 网络工具函数
 */
import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { ApiResponse } from '@/types/api.js';

export class NetworkUtil {
  private static instances: Map<string, AxiosInstance> = new Map();

  /**
   * 创建HTTP客户端实例
   */
  static createHttpClient(baseURL: string, options: AxiosRequestConfig = {}): AxiosInstance {
    const cacheKey = `${baseURL}_${JSON.stringify(options)}`;
    
    if (this.instances.has(cacheKey)) {
      return this.instances.get(cacheKey)!;
    }

    const instance = axios.create({
      baseURL,
      timeout: options.timeout || 30000,
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'AICarpool-EdgeClient/1.0.0',
        ...options.headers
      }
    });

    // 请求拦截器
    instance.interceptors.request.use(
      (config) => {
        console.log(`发送请求: ${config.method?.toUpperCase()} ${config.url}`);
        return config;
      },
      (error) => {
        console.error('请求拦截器错误:', error);
        return Promise.reject(error);
      }
    );

    // 响应拦截器
    instance.interceptors.response.use(
      (response) => {
        console.log(`收到响应: ${response.status} ${response.config.url}`);
        return response;
      },
      (error) => {
        console.error('响应拦截器错误:', error.message);
        return Promise.reject(error);
      }
    );

    this.instances.set(cacheKey, instance);
    return instance;
  }

  /**
   * 带重试的HTTP请求
   */
  static async requestWithRetry<T = any>(
    client: AxiosInstance,
    config: AxiosRequestConfig,
    maxRetries: number = 3,
    retryDelay: number = 1000
  ): Promise<AxiosResponse<ApiResponse<T>>> {
    let lastError: any;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await client.request<ApiResponse<T>>(config);
        return response;
      } catch (error: any) {
        lastError = error;
        
        if (attempt === maxRetries) {
          break;
        }

        // 只有在特定错误情况下才重试
        if (this.shouldRetry(error)) {
          console.log(`请求失败，第${attempt}次重试，${retryDelay}ms后重试...`);
          await this.delay(retryDelay);
          retryDelay *= 2; // 指数退避
        } else {
          break;
        }
      }
    }

    throw lastError;
  }

  /**
   * 判断是否应该重试
   */
  private static shouldRetry(error: any): boolean {
    if (!error.response) {
      // 网络错误、超时等
      return true;
    }

    const status = error.response.status;
    // 服务器错误或临时不可用时重试
    return status >= 500 || status === 429;
  }

  /**
   * 延迟函数
   */
  static delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 健康检查请求
   */
  static async healthCheck(url: string, timeout: number = 5000): Promise<boolean> {
    try {
      const response = await axios.get(`${url}/health`, {
        timeout,
        validateStatus: (status) => status < 500
      });
      return response.status < 400;
    } catch (error) {
      return false;
    }
  }

  /**
   * 获取公网IP
   */
  static async getPublicIP(): Promise<string | null> {
    const services = [
      'https://api.ipify.org?format=json',
      'https://httpbin.org/ip',
      'https://api.myip.com'
    ];

    for (const service of services) {
      try {
        const response = await axios.get(service, { timeout: 5000 });
        
        if (service.includes('ipify')) {
          return response.data.ip;
        } else if (service.includes('httpbin')) {
          return response.data.origin.split(',')[0].trim();
        } else if (service.includes('myip')) {
          return response.data.ip;
        }
      } catch (error) {
        console.warn(`获取公网IP失败 (${service}):`, error instanceof Error ? error.message : String(error));
      }
    }

    return null;
  }

  /**
   * 检查URL是否可访问
   */
  static async isUrlAccessible(url: string, timeout: number = 5000): Promise<boolean> {
    try {
      await axios.head(url, {
        timeout,
        validateStatus: () => true
      });
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * 下载文件
   */
  static async downloadFile(url: string, timeout: number = 30000): Promise<Buffer> {
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout
    });
    return Buffer.from(response.data);
  }

  /**
   * 上传文件
   */
  static async uploadFile(
    url: string,
    fileBuffer: Buffer,
    filename: string,
    additionalFields: Record<string, string> = {}
  ): Promise<AxiosResponse> {
    const FormData = (await import('form-data')).default;
    const form = new FormData();
    
    form.append('file', fileBuffer, filename);
    
    Object.entries(additionalFields).forEach(([key, value]) => {
      form.append(key, value);
    });

    return axios.post(url, form, {
      headers: {
        ...form.getHeaders(),
      },
      timeout: 60000
    });
  }

  /**
   * WebSocket连接状态检查
   */
  static isWebSocketConnected(ws: any): boolean {
    return ws && ws.readyState === 1; // WebSocket.OPEN
  }

  /**
   * 安全的WebSocket发送
   */
  static safeWebSocketSend(ws: any, data: any): boolean {
    if (this.isWebSocketConnected(ws)) {
      try {
        ws.send(typeof data === 'string' ? data : JSON.stringify(data));
        return true;
      } catch (error) {
        console.error('WebSocket发送失败:', error);
        return false;
      }
    }
    return false;
  }

  /**
   * 解析URL
   */
  static parseUrl(url: string): URL | null {
    try {
      return new URL(url);
    } catch (error) {
      return null;
    }
  }

  /**
   * 构建查询字符串
   */
  static buildQueryString(params: Record<string, any>): string {
    const searchParams = new URLSearchParams();
    
    Object.entries(params).forEach(([key, value]) => {
      if (value !== null && value !== undefined) {
        searchParams.append(key, String(value));
      }
    });

    return searchParams.toString();
  }

  /**
   * 清理HTTP客户端缓存
   */
  static clearHttpClientCache(): void {
    this.instances.clear();
  }
}
/**
 * 集中化的API客户端
 * 
 * 提供统一的API请求处理，包括：
 * - 自动添加认证header
 * - 自动处理token刷新
 * - 统一的错误处理
 * - 请求重试机制
 */

import { authService } from './auth-service';

interface ApiRequestOptions extends RequestInit {
  skipAuth?: boolean; // 跳过认证（用于登录等公开接口）
  maxRetries?: number; // 最大重试次数
}

interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  code?: string;
}

class ApiClient {
  private static instance: ApiClient;
  private baseUrl: string = '';

  private constructor() {}

  static getInstance(): ApiClient {
    if (!ApiClient.instance) {
      ApiClient.instance = new ApiClient();
    }
    return ApiClient.instance;
  }

  /**
   * 发送API请求
   */
  async request<T = any>(
    url: string,
    options: ApiRequestOptions = {}
  ): Promise<ApiResponse<T>> {
    const { skipAuth = false, maxRetries = 1, ...fetchOptions } = options;

    // 准备请求headers
    const headers = new Headers(fetchOptions.headers);
    
    // 添加认证header（除非明确跳过）
    if (!skipAuth) {
      const token = authService.getAccessToken();
      if (token) {
        headers.set('Authorization', `Bearer ${token}`);
      }
    }

    // 确保有Content-Type
    if (!headers.has('Content-Type') && fetchOptions.body) {
      headers.set('Content-Type', 'application/json');
    }

    // 执行请求
    let lastError: any;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const response = await fetch(url, {
          ...fetchOptions,
          headers,
        });

        // 处理401未授权响应
        if (response.status === 401 && !skipAuth) {
          console.log('🔐 收到401响应，尝试刷新token...');
          
          // 尝试刷新token
          const newToken = await authService.refreshAccessToken();
          
          if (newToken) {
            console.log('✅ Token刷新成功，重试请求...');
            // 更新请求header
            headers.set('Authorization', `Bearer ${newToken}`);
            // 重试请求（只重试一次）
            if (attempt === 0) {
              continue;
            }
          } else {
            console.log('❌ Token刷新失败，跳转到登录页...');
            // 刷新失败，清除认证状态并跳转登录
            authService.logout();
            
            // 跳转到登录页
            if (typeof window !== 'undefined') {
              window.location.href = '/auth/login';
            }
            
            return {
              success: false,
              error: '认证已过期，请重新登录',
              code: 'AUTH_EXPIRED',
            };
          }
        }

        // 处理响应
        const data = await this.parseResponse<T>(response);
        
        // 如果是成功响应或者不需要重试的错误，直接返回
        if (response.ok || attempt >= maxRetries) {
          return data;
        }

        lastError = data;
      } catch (error) {
        console.error(`API请求失败 (尝试 ${attempt + 1}/${maxRetries + 1}):`, error);
        lastError = error;
        
        // 如果还有重试机会，继续
        if (attempt < maxRetries) {
          // 等待一段时间后重试（指数退避）
          await this.delay(Math.pow(2, attempt) * 1000);
          continue;
        }
      }
    }

    // 所有重试都失败了
    return {
      success: false,
      error: lastError?.message || '请求失败',
      code: 'REQUEST_FAILED',
    };
  }

  /**
   * GET请求
   */
  async get<T = any>(
    url: string,
    options?: ApiRequestOptions
  ): Promise<ApiResponse<T>> {
    return this.request<T>(url, {
      ...options,
      method: 'GET',
    });
  }

  /**
   * POST请求
   */
  async post<T = any>(
    url: string,
    body?: any,
    options?: ApiRequestOptions
  ): Promise<ApiResponse<T>> {
    return this.request<T>(url, {
      ...options,
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  /**
   * PUT请求
   */
  async put<T = any>(
    url: string,
    body?: any,
    options?: ApiRequestOptions
  ): Promise<ApiResponse<T>> {
    return this.request<T>(url, {
      ...options,
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  /**
   * PATCH请求
   */
  async patch<T = any>(
    url: string,
    body?: any,
    options?: ApiRequestOptions
  ): Promise<ApiResponse<T>> {
    return this.request<T>(url, {
      ...options,
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  /**
   * DELETE请求
   */
  async delete<T = any>(
    url: string,
    options?: ApiRequestOptions
  ): Promise<ApiResponse<T>> {
    return this.request<T>(url, {
      ...options,
      method: 'DELETE',
    });
  }

  /**
   * 解析响应
   */
  private async parseResponse<T>(response: Response): Promise<ApiResponse<T>> {
    try {
      const data = await response.json();
      
      // 如果响应已经是标准格式
      if (data.success !== undefined) {
        return data;
      }
      
      // 否则包装成标准格式
      return {
        success: response.ok,
        data: response.ok ? data : undefined,
        error: !response.ok ? (data.message || data.error || '请求失败') : undefined,
        code: !response.ok ? (data.code || response.status.toString()) : undefined,
      };
    } catch (error) {
      // JSON解析失败
      return {
        success: response.ok,
        error: !response.ok ? `请求失败: ${response.status} ${response.statusText}` : undefined,
        code: response.status.toString(),
      };
    }
  }

  /**
   * 延迟函数
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 构建查询字符串
   */
  buildQueryString(params: Record<string, any>): string {
    const searchParams = new URLSearchParams();
    
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        searchParams.append(key, String(value));
      }
    });
    
    const queryString = searchParams.toString();
    return queryString ? `?${queryString}` : '';
  }

  /**
   * 上传文件
   */
  async upload<T = any>(
    url: string,
    formData: FormData,
    options?: ApiRequestOptions
  ): Promise<ApiResponse<T>> {
    // 上传文件时不设置Content-Type，让浏览器自动设置
    const { headers = {}, ...restOptions } = options || {};
    const headersObj = headers instanceof Headers ? Object.fromEntries(headers.entries()) : headers;
    
    // 移除Content-Type
    const { 'Content-Type': _, ...cleanHeaders } = headersObj as any;
    
    return this.request<T>(url, {
      ...restOptions,
      method: 'POST',
      headers: cleanHeaders,
      body: formData,
    });
  }
}

// 导出单例实例
export const apiClient = ApiClient.getInstance();

// 导出类型
export type { ApiResponse, ApiRequestOptions };

// 便捷函数导出
export const api = {
  get: apiClient.get.bind(apiClient),
  post: apiClient.post.bind(apiClient),
  put: apiClient.put.bind(apiClient),
  patch: apiClient.patch.bind(apiClient),
  delete: apiClient.delete.bind(apiClient),
  upload: apiClient.upload.bind(apiClient),
  request: apiClient.request.bind(apiClient),
};
/**
 * Claude API适配器
 * 实现Anthropic Claude API的完整支持
 */

import { 
  AIServiceAdapter, 
  OAuthAdapter,
  Credentials, 
  ProxyConfig, 
  ServiceStatus, 
  ValidationResult, 
  ModelInfo,
  UsageStats,
  AdapterError,
  AuthenticationError,
  NetworkError,
  QuotaExceededError
} from './base-adapter';
import { HttpClient, createHttpClient, formatHttpError } from '../utils/http-client';
import { ServiceType } from '../platform-configs';

export interface ClaudeCredentials extends Credentials {
  apiKey?: string;
  accessToken?: string;
  refreshToken?: string;
  organization?: string;
}

interface ClaudeModel {
  id: string;
  display_name: string;
  created_at: string;
}

interface ClaudeUsage {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
}

export class ClaudeAdapter implements AIServiceAdapter, OAuthAdapter {
  readonly platformId = ServiceType.CLAUDE;
  readonly platformName = 'Claude';
  
  private readonly baseURL = 'https://api.anthropic.com';
  private readonly apiVersion = '2023-06-01';
  private readonly oauthClientId = '9d1c250a-e61b-44d9-88ed-5944d1962f5e';
  private readonly oauthBaseUrl = 'https://console.anthropic.com/v1/oauth';

  async validateCredentials(
    credentials: ClaudeCredentials, 
    proxyConfig?: ProxyConfig
  ): Promise<ValidationResult> {
    try {
      const client = this.createClient(credentials, proxyConfig);
      
      // 尝试获取模型列表来验证凭据
      await client.get('/v1/models');
      
      return {
        isValid: true
      };
    } catch (error: any) {
      return {
        isValid: false,
        errorMessage: this.formatError(error),
        details: {
          statusCode: error.response?.status,
          error: error.message
        }
      };
    }
  }

  async getServiceStatus(
    credentials: ClaudeCredentials,
    proxyConfig?: ProxyConfig
  ): Promise<ServiceStatus> {
    const startTime = Date.now();
    
    try {
      const client = this.createClient(credentials, proxyConfig);
      
      // 发送简单的健康检查请求
      await client.get('/v1/models');
      
      const responseTime = Date.now() - startTime;
      
      return {
        isHealthy: true,
        status: 'active',
        responseTime,
        lastChecked: new Date()
      };
    } catch (error: any) {
      const responseTime = Date.now() - startTime;
      
      return {
        isHealthy: false,
        status: this.getStatusFromError(error),
        responseTime,
        errorMessage: this.formatError(error),
        lastChecked: new Date()
      };
    }
  }

  async getAvailableModels(
    credentials: ClaudeCredentials,
    proxyConfig?: ProxyConfig
  ): Promise<ModelInfo[]> {
    try {
      const client = this.createClient(credentials, proxyConfig);
      const response = await client.get<{ data: ClaudeModel[] }>('/v1/models');
      
      return response.data.data.map(model => ({
        id: model.id,
        name: model.display_name || model.id,
        description: `Claude model: ${model.display_name}`,
        contextLength: this.getContextLength(model.id),
        inputPrice: this.getInputPrice(model.id),
        outputPrice: this.getOutputPrice(model.id),
        isAvailable: true
      }));
    } catch (error) {
      throw new AdapterError(
        `Failed to get available models: ${this.formatError(error)}`,
        'GET_MODELS_ERROR',
        error.response?.status,
        error
      );
    }
  }

  async testConnection(
    credentials: ClaudeCredentials,
    proxyConfig?: ProxyConfig
  ): Promise<boolean> {
    try {
      const status = await this.getServiceStatus(credentials, proxyConfig);
      return status.isHealthy;
    } catch (error) {
      return false;
    }
  }

  async getUsageStats(
    credentials: ClaudeCredentials,
    startDate: Date,
    endDate: Date,
    proxyConfig?: ProxyConfig
  ): Promise<UsageStats> {
    // Claude API 目前不提供直接的使用统计接口
    // 这里返回默认值，实际使用中可能需要从其他数据源获取
    return {
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      requests: 0,
      cost: 0,
      errors: 0
    };
  }

  async generateAuthUrl(
    redirectUri: string,
    state?: string,
    proxyConfig?: ProxyConfig
  ): Promise<{ url: string; codeVerifier: string; state: string }> {
    const actualState = state || this.generateRandomString(32);
    const codeVerifier = this.generateRandomString(64);
    const codeChallenge = await this.generateCodeChallenge(codeVerifier);
    
    const params = new URLSearchParams({
      client_id: this.oauthClientId,
      response_type: 'code',
      redirect_uri: redirectUri,
      state: actualState,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
      scope: 'claude:read claude:write'
    });

    const authUrl = `${this.oauthBaseUrl}/authorize?${params.toString()}`;
    
    return {
      url: authUrl,
      codeVerifier,
      state: actualState
    };
  }

  async exchangeCodeForToken(
    code: string,
    redirectUri: string,
    codeVerifier?: string,
    proxyConfig?: ProxyConfig
  ): Promise<{
    accessToken: string;
    refreshToken?: string;
    expiresAt: Date;
    scopes?: string[];
  }> {
    try {
      const client = createHttpClient({
        baseURL: this.oauthBaseUrl,
        proxy: proxyConfig
      });

      const response = await client.post('/token', {
        grant_type: 'authorization_code',
        client_id: this.oauthClientId,
        code,
        redirect_uri: redirectUri,
        code_verifier: codeVerifier
      }, {
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const { access_token, refresh_token, expires_in, scope } = response.data;
      
      const expiresAt = new Date();
      expiresAt.setSeconds(expiresAt.getSeconds() + expires_in);

      return {
        accessToken: access_token,
        refreshToken: refresh_token,
        expiresAt,
        scopes: scope ? scope.split(' ') : undefined
      };
    } catch (error: any) {
      throw new AuthenticationError(
        `Failed to exchange code for token: ${this.formatError(error)}`,
        error
      );
    }
  }

  async refreshAccessToken(
    refreshToken: string,
    proxyConfig?: ProxyConfig
  ): Promise<{
    accessToken: string;
    refreshToken?: string;
    expiresAt: Date;
  }> {
    try {
      const client = createHttpClient({
        baseURL: this.oauthBaseUrl,
        proxy: proxyConfig
      });

      const response = await client.post('/token', {
        grant_type: 'refresh_token',
        client_id: this.oauthClientId,
        refresh_token: refreshToken
      }, {
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const { access_token, refresh_token, expires_in } = response.data;
      
      const expiresAt = new Date();
      expiresAt.setSeconds(expiresAt.getSeconds() + expires_in);

      return {
        accessToken: access_token,
        refreshToken: refresh_token || refreshToken,
        expiresAt
      };
    } catch (error: any) {
      throw new AuthenticationError(
        `Failed to refresh access token: ${this.formatError(error)}`,
        error
      );
    }
  }

  formatError(error: any): string {
    if (error.response) {
      const { status, data } = error.response;
      
      if (data?.error?.message) {
        return data.error.message;
      }
      
      switch (status) {
        case 400:
          return '请求参数错误';
        case 401:
          return 'API密钥无效或已过期';
        case 403:
          return '权限不足，请检查API密钥权限';
        case 429:
          return '请求频率超限，请稍后重试';
        case 500:
          return 'Claude服务内部错误';
        case 503:
          return 'Claude服务暂时不可用';
        default:
          return `HTTP ${status}: ${data?.message || '未知错误'}`;
      }
    }
    
    return formatHttpError(error);
  }

  private createClient(credentials: ClaudeCredentials, proxyConfig?: ProxyConfig): HttpClient {
    const client = createHttpClient({
      baseURL: this.baseURL,
      proxy: proxyConfig,
      headers: {
        'anthropic-version': this.apiVersion,
        'content-type': 'application/json'
      }
    });

    // 设置认证头部
    if (credentials.accessToken) {
      client.setAuthHeader(credentials.accessToken, 'Bearer');
    } else if (credentials.apiKey) {
      client.setDefaultHeaders({
        'x-api-key': credentials.apiKey
      });
    }

    return client;
  }

  private getStatusFromError(error: any): 'error' | 'maintenance' | 'warning' {
    const status = error.response?.status;
    
    if (status === 503) return 'maintenance';
    if (status === 429) return 'warning';
    return 'error';
  }

  private getContextLength(modelId: string): number {
    const contextLengths: Record<string, number> = {
      'claude-3-5-sonnet-20241022': 200000,
      'claude-3-5-sonnet-20240620': 200000,
      'claude-3-5-haiku-20241022': 200000,
      'claude-3-opus-20240229': 200000,
      'claude-3-sonnet-20240229': 200000,
      'claude-3-haiku-20240307': 200000
    };
    
    return contextLengths[modelId] || 200000;
  }

  private getInputPrice(modelId: string): number {
    // 价格单位：美元/1K tokens
    const inputPrices: Record<string, number> = {
      'claude-3-5-sonnet-20241022': 0.003,
      'claude-3-5-sonnet-20240620': 0.003,
      'claude-3-5-haiku-20241022': 0.001,
      'claude-3-opus-20240229': 0.015,
      'claude-3-sonnet-20240229': 0.003,
      'claude-3-haiku-20240307': 0.00025
    };
    
    return inputPrices[modelId] || 0.003;
  }

  private getOutputPrice(modelId: string): number {
    // 价格单位：美元/1K tokens
    const outputPrices: Record<string, number> = {
      'claude-3-5-sonnet-20241022': 0.015,
      'claude-3-5-sonnet-20240620': 0.015,
      'claude-3-5-haiku-20241022': 0.005,
      'claude-3-opus-20240229': 0.075,
      'claude-3-sonnet-20240229': 0.015,
      'claude-3-haiku-20240307': 0.00125
    };
    
    return outputPrices[modelId] || 0.015;
  }

  private generateRandomString(length: number): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  private async generateCodeChallenge(codeVerifier: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(codeVerifier);
    const digest = await crypto.subtle.digest('SHA-256', data);
    
    return btoa(String.fromCharCode(...new Uint8Array(digest)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  }
}
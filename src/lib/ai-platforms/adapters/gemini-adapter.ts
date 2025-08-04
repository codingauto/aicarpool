/**
 * Google Gemini API适配器
 * 完整实现Google Gemini AI模型的API支持
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
  AuthenticationError
} from './base-adapter';
import { HttpClient, createHttpClient, formatHttpError } from '../utils/http-client';
import { ServiceType } from '../platform-configs';

export interface GeminiCredentials extends Credentials {
  apiKey?: string;
  accessToken?: string;
  refreshToken?: string;
  projectId?: string;
}

interface GeminiModel {
  name: string;
  displayName: string;
  description: string;
  inputTokenLimit: number;
  outputTokenLimit: number;
  supportedGenerationMethods: string[];
}

interface GeminiUsage {
  promptTokenCount: number;
  candidatesTokenCount: number;
  totalTokenCount: number;
}

export class GeminiAdapter implements AIServiceAdapter, OAuthAdapter {
  readonly platformId = ServiceType.GEMINI;
  readonly platformName = 'Gemini';
  
  private readonly baseURL = 'https://generativelanguage.googleapis.com';
  private readonly oauthBaseUrl = 'https://oauth2.googleapis.com';
  private readonly apiVersion = 'v1beta';
  private readonly clientId = process.env.GOOGLE_OAUTH_CLIENT_ID || '';
  private readonly clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET || '';

  async validateCredentials(
    credentials: GeminiCredentials, 
    proxyConfig?: ProxyConfig
  ): Promise<ValidationResult> {
    try {
      if (!credentials.apiKey && !credentials.accessToken) {
        return {
          isValid: false,
          errorMessage: 'API Key or Access Token is required'
        };
      }

      const client = this.createClient(credentials, proxyConfig);
      
      // 验证凭据有效性
      await client.get(`/${this.apiVersion}/models`);
      
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
    credentials: GeminiCredentials,
    proxyConfig?: ProxyConfig
  ): Promise<ServiceStatus> {
    const startTime = Date.now();
    
    try {
      const client = this.createClient(credentials, proxyConfig);
      
      // 发送健康检查请求
      await client.get(`/${this.apiVersion}/models`);
      
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
    credentials: GeminiCredentials,
    proxyConfig?: ProxyConfig
  ): Promise<ModelInfo[]> {
    try {
      const client = this.createClient(credentials, proxyConfig);
      const response = await client.get<{ models: GeminiModel[] }>(`/${this.apiVersion}/models`);
      
      // 过滤出聊天生成模型
      const chatModels = response.data.models.filter(model => 
        model.supportedGenerationMethods.includes('generateContent')
      );
      
      return chatModels.map(model => ({
        id: this.extractModelId(model.name),
        name: model.displayName || this.extractModelId(model.name),
        description: model.description,
        contextLength: model.inputTokenLimit,
        inputPrice: this.getInputPrice(this.extractModelId(model.name)),
        outputPrice: this.getOutputPrice(this.extractModelId(model.name)),
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
    credentials: GeminiCredentials,
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
    credentials: GeminiCredentials,
    startDate: Date,
    endDate: Date,
    proxyConfig?: ProxyConfig
  ): Promise<UsageStats> {
    // Gemini API目前不提供详细的使用统计接口
    // 返回默认值
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
    
    const scopes = [
      'https://www.googleapis.com/auth/generative-language.retriever',
      'https://www.googleapis.com/auth/generative-language.tuning'
    ].join(' ');
    
    const params = new URLSearchParams({
      client_id: this.clientId,
      response_type: 'code',
      redirect_uri: redirectUri,
      scope: scopes,
      state: actualState,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
      access_type: 'offline',
      prompt: 'consent'
    });

    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
    
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
        client_id: this.clientId,
        client_secret: this.clientSecret,
        code,
        redirect_uri: redirectUri,
        code_verifier: codeVerifier
      }, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
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
        client_id: this.clientId,
        client_secret: this.clientSecret,
        refresh_token: refreshToken
      }, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
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
          return '权限不足，请检查API密钥权限或项目配置';
        case 429:
          return '请求频率超限，请稍后重试';
        case 500:
          return 'Gemini服务内部错误';
        case 503:
          return 'Gemini服务暂时不可用';
        default:
          return `HTTP ${status}: ${data?.error?.message || '未知错误'}`;
      }
    }
    
    return formatHttpError(error);
  }

  private createClient(credentials: GeminiCredentials, proxyConfig?: ProxyConfig): HttpClient {
    const client = createHttpClient({
      baseURL: this.baseURL,
      proxy: proxyConfig,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    // 设置认证
    if (credentials.accessToken) {
      client.setAuthHeader(credentials.accessToken, 'Bearer');
    } else if (credentials.apiKey) {
      // API Key认证方式
      client.setDefaultHeaders({
        'x-goog-api-key': credentials.apiKey
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

  private extractModelId(fullName: string): string {
    // 从完整模型名称中提取模型ID
    // 例如: "models/gemini-1.5-pro" -> "gemini-1.5-pro"
    const parts = fullName.split('/');
    return parts[parts.length - 1];
  }

  private getInputPrice(modelId: string): number {
    // 价格单位：美元/1K tokens (截至2024年的价格)
    const inputPrices: Record<string, number> = {
      'gemini-1.5-pro': 0.0035,
      'gemini-1.5-flash': 0.00035,
      'gemini-1.0-pro': 0.0005,
      'gemini-pro': 0.0005,
      'gemini-pro-vision': 0.0025
    };
    
    return inputPrices[modelId] || 0.0005;
  }

  private getOutputPrice(modelId: string): number {
    // 价格单位：美元/1K tokens (截至2024年的价格)
    const outputPrices: Record<string, number> = {
      'gemini-1.5-pro': 0.0105,
      'gemini-1.5-flash': 0.00105,
      'gemini-1.0-pro': 0.0015,
      'gemini-pro': 0.0015,
      'gemini-pro-vision': 0.0025
    };
    
    return outputPrices[modelId] || 0.0015;
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
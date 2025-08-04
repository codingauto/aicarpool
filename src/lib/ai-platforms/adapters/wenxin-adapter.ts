/**
 * 百度文心一言 API适配器
 * 完整实现百度文心一言系列模型的API支持
 */

import { 
  AIServiceAdapter, 
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

export interface WenxinCredentials extends Credentials {
  apiKey: string;
  secretKey: string;
  accessToken?: string;
  expiresAt?: Date;
}

interface WenxinTokenResponse {
  access_token: string;
  expires_in: number;
}

interface WenxinUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

export class WenxinAdapter implements AIServiceAdapter {
  readonly platformId = ServiceType.WENXIN;
  readonly platformName = 'Wenxin';
  
  private readonly baseURL = 'https://aip.baidubce.com';
  private readonly authURL = 'https://aip.baidubce.com/oauth/2.0/token';

  async validateCredentials(
    credentials: WenxinCredentials, 
    proxyConfig?: ProxyConfig
  ): Promise<ValidationResult> {
    try {
      if (!credentials.apiKey || !credentials.secretKey) {
        return {
          isValid: false,
          errorMessage: 'API Key and Secret Key are required'
        };
      }

      // 获取访问令牌
      await this.ensureAccessToken(credentials, proxyConfig);
      
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
    credentials: WenxinCredentials,
    proxyConfig?: ProxyConfig
  ): Promise<ServiceStatus> {
    const startTime = Date.now();
    
    try {
      // 确保有有效的访问令牌
      await this.ensureAccessToken(credentials, proxyConfig);
      
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
    credentials: WenxinCredentials,
    proxyConfig?: ProxyConfig
  ): Promise<ModelInfo[]> {
    try {
      // 文心一言的可用模型（基于官方文档）
      const models = [
        {
          id: 'ernie-4.0-8k',
          name: 'ERNIE-4.0-8K',
          description: '百度文心大模型4.0，8K上下文',
          contextLength: 8000,
          inputPrice: 0.12,   // ¥120/百万tokens，约$0.12/1K tokens
          outputPrice: 0.12,
          isAvailable: true
        },
        {
          id: 'ernie-4.0-8k-preview',
          name: 'ERNIE-4.0-8K-Preview',
          description: '百度文心大模型4.0预览版',
          contextLength: 8000,
          inputPrice: 0.12,
          outputPrice: 0.12,
          isAvailable: true
        },
        {
          id: 'ernie-3.5-8k',
          name: 'ERNIE-3.5-8K',
          description: '百度文心大模型3.5，8K上下文',
          contextLength: 8000,
          inputPrice: 0.012,  // ¥12/百万tokens
          outputPrice: 0.012,
          isAvailable: true
        },
        {
          id: 'ernie-3.5-8k-0205',
          name: 'ERNIE-3.5-8K-0205',
          description: '百度文心大模型3.5增强版',
          contextLength: 8000,
          inputPrice: 0.012,
          outputPrice: 0.012,
          isAvailable: true
        },
        {
          id: 'ernie-3.5-4k-0205',
          name: 'ERNIE-3.5-4K-0205',
          description: '百度文心大模型3.5，4K上下文',
          contextLength: 4000,
          inputPrice: 0.012,
          outputPrice: 0.012,
          isAvailable: true
        },
        {
          id: 'ernie-turbo-8k',
          name: 'ERNIE-Turbo-8K',
          description: '百度文心turbo模型，高性价比',
          contextLength: 8000,
          inputPrice: 0.008,  // ¥8/百万tokens
          outputPrice: 0.008,
          isAvailable: true
        },
        {
          id: 'ernie-speed-8k',
          name: 'ERNIE-Speed-8K',
          description: '百度文心speed模型，高速响应',
          contextLength: 8000,
          inputPrice: 0.004,  // ¥4/百万tokens
          outputPrice: 0.004,
          isAvailable: true
        },
        {
          id: 'ernie-lite-8k',
          name: 'ERNIE-Lite-8K',
          description: '百度文心lite模型，轻量版本',
          contextLength: 8000,
          inputPrice: 0.002,  // ¥2/百万tokens
          outputPrice: 0.002,
          isAvailable: true
        }
      ];

      return models;
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
    credentials: WenxinCredentials,
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
    credentials: WenxinCredentials,
    startDate: Date,
    endDate: Date,
    proxyConfig?: ProxyConfig
  ): Promise<UsageStats> {
    // 文心一言API目前不提供使用统计接口
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

  formatError(error: any): string {
    if (error.response) {
      const { status, data } = error.response;
      
      // 处理文心一言特有的错误格式
      if (data?.error_description) {
        return data.error_description;
      }
      
      if (data?.error_msg) {
        return data.error_msg;
      }
      
      switch (status) {
        case 400:
          return '请求参数错误，请检查输入格式';
        case 401:
          return 'API密钥无效或已过期';
        case 403:
          return '权限不足，请检查API密钥权限';
        case 429:
          return '请求频率超限，请稍后重试';
        case 500:
          return '文心一言服务内部错误';
        case 503:
          return '文心一言服务暂时不可用';
        default:
          return `HTTP ${status}: ${data?.error_msg || '未知错误'}`;
      }
    }
    
    return formatHttpError(error);
  }

  /**
   * 确保访问令牌有效
   */
  private async ensureAccessToken(
    credentials: WenxinCredentials, 
    proxyConfig?: ProxyConfig
  ): Promise<string> {
    // 检查是否有有效的访问令牌
    if (credentials.accessToken && credentials.expiresAt && 
        credentials.expiresAt > new Date()) {
      return credentials.accessToken;
    }

    // 获取新的访问令牌
    const client = createHttpClient({
      baseURL: '',
      proxy: proxyConfig
    });

    const response = await client.post(this.authURL, null, {
      params: {
        grant_type: 'client_credentials',
        client_id: credentials.apiKey,
        client_secret: credentials.secretKey
      }
    });

    if (!response.data.access_token) {
      throw new AuthenticationError('Failed to obtain access token');
    }

    const tokenData: WenxinTokenResponse = response.data;
    
    // 更新凭据
    credentials.accessToken = tokenData.access_token;
    credentials.expiresAt = new Date(Date.now() + (tokenData.expires_in * 1000));

    return tokenData.access_token;
  }

  private createClient(credentials: WenxinCredentials, proxyConfig?: ProxyConfig): HttpClient {
    const client = createHttpClient({
      baseURL: this.baseURL,
      proxy: proxyConfig,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });

    return client;
  }

  private getStatusFromError(error: any): 'error' | 'maintenance' | 'warning' {
    const status = error.response?.status;
    
    if (status === 503) return 'maintenance';
    if (status === 429) return 'warning';
    return 'error';
  }

  /**
   * 测试特定模型的可用性
   */
  async testModel(
    credentials: WenxinCredentials,
    modelId: string,
    proxyConfig?: ProxyConfig
  ): Promise<boolean> {
    try {
      const accessToken = await this.ensureAccessToken(credentials, proxyConfig);
      const client = this.createClient(credentials, proxyConfig);
      
      // 不同模型有不同的endpoint
      const endpoint = this.getModelEndpoint(modelId);
      
      await client.post(`${endpoint}?access_token=${accessToken}`, {
        messages: [
          {
            role: 'user',
            content: 'Hello'
          }
        ]
      });
      
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * 获取模型对应的API端点
   */
  private getModelEndpoint(modelId: string): string {
    const endpoints: Record<string, string> = {
      'ernie-4.0-8k': '/rpc/2.0/ai_custom/v1/wenxinworkshop/chat/completions_pro',
      'ernie-4.0-8k-preview': '/rpc/2.0/ai_custom/v1/wenxinworkshop/chat/ernie-4.0-8k-preview',
      'ernie-3.5-8k': '/rpc/2.0/ai_custom/v1/wenxinworkshop/chat/completions',
      'ernie-3.5-8k-0205': '/rpc/2.0/ai_custom/v1/wenxinworkshop/chat/ernie-3.5-8k-0205',
      'ernie-3.5-4k-0205': '/rpc/2.0/ai_custom/v1/wenxinworkshop/chat/ernie-3.5-4k-0205',
      'ernie-turbo-8k': '/rpc/2.0/ai_custom/v1/wenxinworkshop/chat/eb-instant',
      'ernie-speed-8k': '/rpc/2.0/ai_custom/v1/wenxinworkshop/chat/ernie_speed',
      'ernie-lite-8k': '/rpc/2.0/ai_custom/v1/wenxinworkshop/chat/ernie-lite-8k'
    };
    
    return endpoints[modelId] || endpoints['ernie-3.5-8k'];
  }

  /**
   * 获取模型详细信息
   */
  async getModelInfo(
    credentials: WenxinCredentials,
    modelId: string,
    proxyConfig?: ProxyConfig
  ): Promise<ModelInfo | null> {
    const models = await this.getAvailableModels(credentials, proxyConfig);
    return models.find(model => model.id === modelId) || null;
  }

  /**
   * 估算token数量（简单估算）
   */
  estimateTokenCount(text: string): number {
    // 简单估算：中文1个字符约等于1个token，英文1个单词约等于1个token
    const chineseChars = (text.match(/[\u4e00-\u9fff]/g) || []).length;
    const englishWords = (text.match(/[a-zA-Z]+/g) || []).length;
    const otherChars = text.length - chineseChars - englishWords;
    
    return chineseChars + englishWords + Math.ceil(otherChars / 4);
  }
}
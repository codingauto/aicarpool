/**
 * 月之暗面 Kimi API适配器
 * 完整实现Kimi AI模型的API支持
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

export interface KimiCredentials extends Credentials {
  apiKey: string;
}

interface KimiModel {
  id: string;
  object: string;
  owned_by: string;
}

interface KimiUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

export class KimiAdapter implements AIServiceAdapter {
  readonly platformId = ServiceType.KIMI;
  readonly platformName = 'Kimi';
  
  private readonly baseURL = 'https://api.moonshot.cn';
  private readonly apiVersion = 'v1';

  async validateCredentials(
    credentials: KimiCredentials, 
    proxyConfig?: ProxyConfig
  ): Promise<ValidationResult> {
    try {
      if (!credentials.apiKey) {
        return {
          isValid: false,
          errorMessage: 'API Key is required'
        };
      }

      const client = this.createClient(credentials, proxyConfig);
      
      // 验证API Key有效性
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
    credentials: KimiCredentials,
    proxyConfig?: ProxyConfig
  ): Promise<ServiceStatus> {
    const startTime = Date.now();
    
    try {
      const client = this.createClient(credentials, proxyConfig);
      
      // 发送健康检查请求
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
    credentials: KimiCredentials,
    proxyConfig?: ProxyConfig
  ): Promise<ModelInfo[]> {
    try {
      // Kimi的可用模型（基于官方文档）
      const models = [
        {
          id: 'moonshot-v1-8k',
          name: 'Moonshot-V1-8K',
          description: 'Kimi 8K上下文长度模型，适合日常对话',
          contextLength: 8000,
          inputPrice: 0.012,  // ¥12/百万tokens，约$0.012/1K tokens
          outputPrice: 0.012,
          isAvailable: true
        },
        {
          id: 'moonshot-v1-32k',
          name: 'Moonshot-V1-32K',
          description: 'Kimi 32K上下文长度模型，支持更长对话',
          contextLength: 32000,
          inputPrice: 0.024,  // ¥24/百万tokens
          outputPrice: 0.024,
          isAvailable: true
        },
        {
          id: 'moonshot-v1-128k',
          name: 'Moonshot-V1-128K',
          description: 'Kimi 128K上下文长度模型，支持超长文档理解',
          contextLength: 128000,
          inputPrice: 0.06,   // ¥60/百万tokens
          outputPrice: 0.06,
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
    credentials: KimiCredentials,
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
    credentials: KimiCredentials,
    startDate: Date,
    endDate: Date,
    proxyConfig?: ProxyConfig
  ): Promise<UsageStats> {
    // Kimi API目前不提供使用统计接口
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
      
      // 处理Kimi特有的错误格式
      if (data?.error?.message) {
        return data.error.message;
      }
      
      if (data?.message) {
        return data.message;
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
          return 'Kimi服务内部错误';
        case 503:
          return 'Kimi服务暂时不可用';
        default:
          return `HTTP ${status}: ${data?.message || '未知错误'}`;
      }
    }
    
    return formatHttpError(error);
  }

  private createClient(credentials: KimiCredentials, proxyConfig?: ProxyConfig): HttpClient {
    const client = createHttpClient({
      baseURL: this.baseURL,
      proxy: proxyConfig,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });

    // 设置认证头部
    client.setAuthHeader(credentials.apiKey, 'Bearer');

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
    credentials: KimiCredentials,
    modelId: string,
    proxyConfig?: ProxyConfig
  ): Promise<boolean> {
    try {
      const client = this.createClient(credentials, proxyConfig);
      
      await client.post('/v1/chat/completions', {
        model: modelId,
        messages: [
          {
            role: 'user',
            content: 'Hello'
          }
        ],
        max_tokens: 1
      });
      
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * 获取模型详细信息
   */
  async getModelInfo(
    credentials: KimiCredentials,
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
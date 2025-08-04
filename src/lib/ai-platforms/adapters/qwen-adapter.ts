/**
 * 阿里云通义千问API适配器
 * 完整实现阿里云DashScope API的支持
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

export interface QwenCredentials extends Credentials {
  apiKey: string;
  accessKeyId?: string;
  accessKeySecret?: string;
  region?: string;
}

interface QwenModel {
  model_id: string;
  model_name: string;
  model_type: string;
  task_type: string[];
  input_modality: string[];
  output_modality: string[];
}

interface QwenUsage {
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
}

interface QwenResponse {
  status_code: number;
  request_id: string;
  code?: string;
  message?: string;
  output?: {
    text?: string;
    choices?: Array<{
      finish_reason: string;
      message: {
        role: string;
        content: string;
      };
    }>;
  };
  usage?: QwenUsage;
}

export class QwenAdapter implements AIServiceAdapter {
  readonly platformId = ServiceType.QWEN;
  readonly platformName = 'Qwen';
  
  private readonly baseURL = 'https://dashscope.aliyuncs.com';
  private readonly apiVersion = 'v1';

  async validateCredentials(
    credentials: QwenCredentials, 
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
      
      // 使用简单的文本生成来验证API Key
      await client.post('/api/v1/services/aigc/text-generation/generation', {
        model: 'qwen-turbo',
        input: {
          messages: [
            {
              role: 'user',
              content: 'Hello'
            }
          ]
        },
        parameters: {
          max_tokens: 10
        }
      });
      
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
    credentials: QwenCredentials,
    proxyConfig?: ProxyConfig
  ): Promise<ServiceStatus> {
    const startTime = Date.now();
    
    try {
      const client = this.createClient(credentials, proxyConfig);
      
      // 发送健康检查请求
      await client.post('/api/v1/services/aigc/text-generation/generation', {
        model: 'qwen-turbo',
        input: {
          messages: [
            {
              role: 'user',
              content: 'ping'
            }
          ]
        },
        parameters: {
          max_tokens: 1
        }
      });
      
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
    credentials: QwenCredentials,
    proxyConfig?: ProxyConfig
  ): Promise<ModelInfo[]> {
    try {
      // 通义千问的可用模型（基于官方文档）
      const models = [
        {
          id: 'qwen-turbo',
          name: 'Qwen-Turbo',
          description: '通义千问超大规模语言模型，支持中文英文等不同语言输入',
          contextLength: 8192,
          inputPrice: 0.008,  // ¥8/百万tokens，约$0.008/1K tokens
          outputPrice: 0.008,
          isAvailable: true
        },
        {
          id: 'qwen-plus',
          name: 'Qwen-Plus',
          description: '通义千问增强版，具有更强的理解和生成能力',
          contextLength: 32768,
          inputPrice: 0.02,  // ¥20/百万tokens
          outputPrice: 0.02,
          isAvailable: true
        },
        {
          id: 'qwen-max',
          name: 'Qwen-Max',
          description: '通义千问千亿级别超大规模语言模型',
          contextLength: 8192,
          inputPrice: 0.12,  // ¥120/百万tokens
          outputPrice: 0.12,
          isAvailable: true
        },
        {
          id: 'qwen-max-longcontext',
          name: 'Qwen-Max-LongContext',
          description: '通义千问长上下文版本，支持最长约30万字的上下文',
          contextLength: 300000,
          inputPrice: 0.12,
          outputPrice: 0.12,
          isAvailable: true
        },
        {
          id: 'qwen-math-plus',
          name: 'Qwen-Math-Plus',
          description: '通义千问数学专用模型，专门用于数学问题求解',
          contextLength: 4096,
          inputPrice: 0.02,
          outputPrice: 0.02,
          isAvailable: true
        },
        {
          id: 'qwen-coder-plus',
          name: 'Qwen-Coder-Plus',
          description: '通义千问代码专用模型，专门用于代码生成和理解',
          contextLength: 65536,
          inputPrice: 0.02,
          outputPrice: 0.02,
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
    credentials: QwenCredentials,
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
    credentials: QwenCredentials,
    startDate: Date,
    endDate: Date,
    proxyConfig?: ProxyConfig
  ): Promise<UsageStats> {
    // 通义千问API目前不提供使用统计接口
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
      
      // 处理通义千问特有的错误格式
      if (data?.code && data?.message) {
        return `${data.code}: ${data.message}`;
      }
      
      if (data?.error?.message) {
        return data.error.message;
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
          return '通义千问服务内部错误';
        case 503:
          return '通义千问服务暂时不可用';
        default:
          return `HTTP ${status}: ${data?.message || '未知错误'}`;
      }
    }
    
    return formatHttpError(error);
  }

  private createClient(credentials: QwenCredentials, proxyConfig?: ProxyConfig): HttpClient {
    const client = createHttpClient({
      baseURL: this.baseURL,
      proxy: proxyConfig,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });

    // 设置认证头部
    client.setDefaultHeaders({
      'Authorization': `Bearer ${credentials.apiKey}`
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
    credentials: QwenCredentials,
    modelId: string,
    proxyConfig?: ProxyConfig
  ): Promise<boolean> {
    try {
      const client = this.createClient(credentials, proxyConfig);
      
      await client.post('/api/v1/services/aigc/text-generation/generation', {
        model: modelId,
        input: {
          messages: [
            {
              role: 'user',
              content: 'Hello'
            }
          ]
        },
        parameters: {
          max_tokens: 1
        }
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
    credentials: QwenCredentials,
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
/**
 * OpenAI API适配器
 * 完整实现OpenAI GPT系列模型的API支持
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
  AuthenticationError,
  QuotaExceededError
} from './base-adapter';
import { HttpClient, createHttpClient, formatHttpError } from '../utils/http-client';
import { ServiceType } from '../platform-configs';

export interface OpenAICredentials extends Credentials {
  apiKey: string;
  organization?: string;
}

interface OpenAIModel {
  id: string;
  object: string;
  created: number;
  owned_by: string;
}

interface OpenAIUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

interface OpenAIBillingUsage {
  total_usage: number;
  daily_costs: Array<{
    timestamp: number;
    line_items: Array<{
      name: string;
      cost: number;
    }>;
  }>;
}

export class OpenAIAdapter implements AIServiceAdapter {
  readonly platformId = ServiceType.OPENAI;
  readonly platformName = 'OpenAI';
  
  private readonly baseURL = 'https://api.openai.com';
  private readonly apiVersion = 'v1';

  async validateCredentials(
    credentials: OpenAICredentials, 
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
    credentials: OpenAICredentials,
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
    credentials: OpenAICredentials,
    proxyConfig?: ProxyConfig
  ): Promise<ModelInfo[]> {
    try {
      const client = this.createClient(credentials, proxyConfig);
      const response = await client.get<{ data: OpenAIModel[] }>('/v1/models');
      
      // 过滤出GPT模型和其他聊天模型
      const chatModels = response.data.data.filter(model => 
        model.id.includes('gpt') || 
        model.id.includes('chat') ||
        this.isKnownChatModel(model.id)
      );
      
      return chatModels.map(model => ({
        id: model.id,
        name: this.getModelDisplayName(model.id),
        description: `OpenAI ${this.getModelDisplayName(model.id)} model`,
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
    credentials: OpenAICredentials,
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
    credentials: OpenAICredentials,
    startDate: Date,
    endDate: Date,
    proxyConfig?: ProxyConfig
  ): Promise<UsageStats> {
    try {
      const client = this.createClient(credentials, proxyConfig);
      
      // OpenAI提供使用情况API（需要相应权限）
      const startDateStr = startDate.toISOString().split('T')[0];
      const endDateStr = endDate.toISOString().split('T')[0];
      
      const response = await client.get<OpenAIBillingUsage>(
        `/v1/usage?start_date=${startDateStr}&end_date=${endDateStr}`
      );
      
      let totalTokens = 0;
      let totalCost = 0;
      let totalRequests = response.data.daily_costs.length;
      
      response.data.daily_costs.forEach(day => {
        day.line_items.forEach(item => {
          totalCost += item.cost;
        });
      });
      
      return {
        inputTokens: Math.floor(totalTokens * 0.6), // 估算
        outputTokens: Math.floor(totalTokens * 0.4), // 估算
        totalTokens,
        requests: totalRequests,
        cost: totalCost,
        errors: 0
      };
    } catch (error) {
      // 如果无法获取统计信息，返回默认值
      return {
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        requests: 0,
        cost: 0,
        errors: 0
      };
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
          return '请求频率超限或配额不足';
        case 500:
          return 'OpenAI服务内部错误';
        case 503:
          return 'OpenAI服务暂时不可用';
        default:
          return `HTTP ${status}: ${data?.error?.message || '未知错误'}`;
      }
    }
    
    return formatHttpError(error);
  }

  private createClient(credentials: OpenAICredentials, proxyConfig?: ProxyConfig): HttpClient {
    const client = createHttpClient({
      baseURL: this.baseURL,
      proxy: proxyConfig,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    // 设置认证头部
    client.setAuthHeader(credentials.apiKey, 'Bearer');
    
    // 设置组织头部（如果提供）
    if (credentials.organization) {
      client.setDefaultHeaders({
        'OpenAI-Organization': credentials.organization
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

  private isKnownChatModel(modelId: string): boolean {
    const knownChatModels = [
      'text-davinci-003',
      'text-davinci-002',
      'code-davinci-002'
    ];
    return knownChatModels.includes(modelId);
  }

  private getModelDisplayName(modelId: string): string {
    const displayNames: Record<string, string> = {
      'gpt-4o': 'GPT-4o',
      'gpt-4o-mini': 'GPT-4o Mini',
      'gpt-4-turbo': 'GPT-4 Turbo',
      'gpt-4-turbo-preview': 'GPT-4 Turbo Preview',
      'gpt-4': 'GPT-4',
      'gpt-4-32k': 'GPT-4 32K',
      'gpt-3.5-turbo': 'GPT-3.5 Turbo',
      'gpt-3.5-turbo-16k': 'GPT-3.5 Turbo 16K',
      'text-davinci-003': 'Text Davinci 003',
      'text-davinci-002': 'Text Davinci 002',
      'code-davinci-002': 'Code Davinci 002'
    };
    
    return displayNames[modelId] || modelId;
  }

  private getContextLength(modelId: string): number {
    const contextLengths: Record<string, number> = {
      'gpt-4o': 128000,
      'gpt-4o-mini': 128000,
      'gpt-4-turbo': 128000,
      'gpt-4-turbo-preview': 128000,
      'gpt-4': 8192,
      'gpt-4-32k': 32768,
      'gpt-3.5-turbo': 16385,
      'gpt-3.5-turbo-16k': 16385,
      'text-davinci-003': 4097,
      'text-davinci-002': 4097,
      'code-davinci-002': 8001
    };
    
    return contextLengths[modelId] || 4096;
  }

  private getInputPrice(modelId: string): number {
    // 价格单位：美元/1K tokens (截至2024年的价格）
    const inputPrices: Record<string, number> = {
      'gpt-4o': 0.005,
      'gpt-4o-mini': 0.00015,
      'gpt-4-turbo': 0.01,
      'gpt-4-turbo-preview': 0.01,
      'gpt-4': 0.03,
      'gpt-4-32k': 0.06,
      'gpt-3.5-turbo': 0.0005,
      'gpt-3.5-turbo-16k': 0.003,
      'text-davinci-003': 0.02,
      'text-davinci-002': 0.02,
      'code-davinci-002': 0.02
    };
    
    return inputPrices[modelId] || 0.01;
  }

  private getOutputPrice(modelId: string): number {
    // 价格单位：美元/1K tokens (截至2024年的价格）
    const outputPrices: Record<string, number> = {
      'gpt-4o': 0.015,
      'gpt-4o-mini': 0.0006,
      'gpt-4-turbo': 0.03,
      'gpt-4-turbo-preview': 0.03,
      'gpt-4': 0.06,
      'gpt-4-32k': 0.12,
      'gpt-3.5-turbo': 0.0015,
      'gpt-3.5-turbo-16k': 0.004,
      'text-davinci-003': 0.02,
      'text-davinci-002': 0.02,
      'code-davinci-002': 0.02
    };
    
    return outputPrices[modelId] || 0.03;
  }
}
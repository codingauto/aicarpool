/**
 * 统一的AI服务客户端
 * 整合所有平台适配器，提供统一的调用接口
 */

import { AIServiceAdapter, ProxyConfig, ServiceStatus, ModelInfo, UsageStats } from './adapters/base-adapter';
import { getAdapter, validateAccountCredentials, testAccountConnection, getAvailableModels } from './adapter-manager';
import { ServiceType, getPlatformConfig } from './platform-configs';

// 统一的AI服务账号接口
export interface AiServiceAccount {
  id: string;
  name: string;
  serviceType: ServiceType;
  authType: string;
  encryptedCredentials: string;
  proxyConfig?: ProxyConfig;
  region?: string;
  endpointUrl?: string;
  platformConfig?: Record<string, any>;
  supportedModels?: string[];
  currentModel?: string;
  costPerToken?: number;
  isEnabled: boolean;
  status: 'active' | 'inactive' | 'error';
  createdAt: Date;
  updatedAt: Date;
}

// AI请求接口
export interface AiRequest {
  messages: Array<{
    role: 'user' | 'assistant' | 'system';
    content: string;
  }>;
  model?: string;
  maxTokens?: number;
  temperature?: number;
  stream?: boolean;
  systemPrompt?: string;
}

// AI响应接口
export interface AiResponse {
  message: {
    role: 'assistant';
    content: string;
  };
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  cost: number;
  model: string;
  accountUsed: {
    id: string;
    name: string;
    serviceType: ServiceType;
  };
  metadata: {
    responseTime: number;
    requestId?: string;
    finishReason?: string;
  };
}

// 错误接口
export interface AiError {
  error: string;
  code?: string;
  statusCode?: number;
  accountUsed?: {
    id: string;
    name: string;
    serviceType: ServiceType;
  };
  metadata: {
    responseTime: number;
  };
}

/**
 * AI服务客户端类
 */
export class AiServiceClient {
  private account: AiServiceAccount;
  private adapter: AIServiceAdapter;
  private credentials: any;

  constructor(account: AiServiceAccount) {
    this.account = account;
    this.adapter = getAdapter(account.serviceType);
    
    // 解密凭据
    try {
      this.credentials = this.decryptCredentials(account.encryptedCredentials);
    } catch (error) {
      throw new Error(`Failed to decrypt credentials for account ${account.name}: ${error}`);
    }
  }

  /**
   * 执行AI请求
   */
  async executeRequest(request: AiRequest): Promise<AiResponse> {
    const startTime = Date.now();
    
    try {
      // 获取使用的模型
      const model = request.model || this.account.currentModel || this.getDefaultModel();
      
      // 构建请求消息
      const messages = request.systemPrompt 
        ? [{ role: 'system' as const, content: request.systemPrompt }, ...request.messages]
        : request.messages;

      // 调用对应平台的API
      const response = await this.callPlatformAPI({
        ...request,
        messages,
        model
      });

      const responseTime = Date.now() - startTime;
      const cost = this.calculateCost(response.usage, model);

      return {
        message: response.message,
        usage: response.usage,
        cost,
        model: response.model || model,
        accountUsed: {
          id: this.account.id,
          name: this.account.name,
          serviceType: this.account.serviceType
        },
        metadata: {
          responseTime,
          requestId: response.requestId,
          finishReason: response.finishReason
        }
      };

    } catch (error: any) {
      const responseTime = Date.now() - startTime;
      
      const aiError: AiError = {
        error: error.message || 'Unknown error',
        code: error.code,
        statusCode: error.statusCode,
        accountUsed: {
          id: this.account.id,
          name: this.account.name,
          serviceType: this.account.serviceType
        },
        metadata: {
          responseTime
        }
      };

      throw aiError;
    }
  }

  /**
   * 健康检查
   */
  async healthCheck(): Promise<{
    isHealthy: boolean;
    responseTime: number;
    status: ServiceStatus;
    error?: string;
  }> {
    const startTime = Date.now();
    
    try {
      const status = await this.adapter.getServiceStatus(
        this.credentials,
        this.account.proxyConfig
      );
      
      return {
        isHealthy: status.isHealthy,
        responseTime: Date.now() - startTime,
        status
      };
    } catch (error: any) {
      return {
        isHealthy: false,
        responseTime: Date.now() - startTime,
        status: {
          isHealthy: false,
          status: 'error',
          responseTime: Date.now() - startTime,
          errorMessage: error.message,
          lastChecked: new Date()
        },
        error: error.message
      };
    }
  }

  /**
   * 获取可用模型
   */
  async getAvailableModels(): Promise<ModelInfo[]> {
    return this.adapter.getAvailableModels(
      this.credentials,
      this.account.proxyConfig
    );
  }

  /**
   * 验证账号凭据
   */
  async validateCredentials(): Promise<{
    isValid: boolean;
    errorMessage?: string;
  }> {
    return this.adapter.validateCredentials(
      this.credentials,
      this.account.proxyConfig
    );
  }

  /**
   * 获取使用统计
   */
  async getUsageStats(startDate: Date, endDate: Date): Promise<UsageStats> {
    return this.adapter.getUsageStats(
      this.credentials,
      startDate,
      endDate,
      this.account.proxyConfig
    );
  }

  /**
   * 调用平台API
   */
  private async callPlatformAPI(request: AiRequest): Promise<{
    message: { role: 'assistant'; content: string };
    usage: { promptTokens: number; completionTokens: number; totalTokens: number };
    model?: string;
    requestId?: string;
    finishReason?: string;
  }> {
    // 这里需要根据不同平台调用相应的API
    // 由于每个平台的API接口不同，这里提供一个通用的实现框架
    
    switch (this.account.serviceType) {
      case ServiceType.CLAUDE:
        return this.callClaudeAPI(request);
      case ServiceType.OPENAI:
        return this.callOpenAIAPI(request);
      case ServiceType.GEMINI:
        return this.callGeminiAPI(request);
      case ServiceType.QWEN:
        return this.callQwenAPI(request);
      case ServiceType.GLM:
        return this.callGLMAPI(request);
      case ServiceType.KIMI:
        return this.callKimiAPI(request);
      case ServiceType.WENXIN:
        return this.callWenxinAPI(request);
      case ServiceType.SPARK:
        return this.callSparkAPI(request);
      default:
        throw new Error(`Platform ${this.account.serviceType} not implemented`);
    }
  }

  /**
   * Claude API调用
   */
  private async callClaudeAPI(request: AiRequest): Promise<any> {
    const response = await fetch(this.account.endpointUrl || 'https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.credentials.apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: request.model,
        max_tokens: request.maxTokens || 1000,
        temperature: request.temperature || 0.7,
        messages: request.messages
      })
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(`Claude API error: ${response.status} - ${error.error?.message || response.statusText}`);
    }

    const data = await response.json();
    
    return {
      message: {
        role: 'assistant' as const,
        content: data.content[0]?.text || ''
      },
      usage: {
        promptTokens: data.usage?.input_tokens || 0,
        completionTokens: data.usage?.output_tokens || 0,
        totalTokens: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0)
      },
      model: data.model,
      requestId: data.id
    };
  }

  /**
   * OpenAI API调用
   */
  private async callOpenAIAPI(request: AiRequest): Promise<any> {
    const response = await fetch(this.account.endpointUrl || 'https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.credentials.apiKey}`
      },
      body: JSON.stringify({
        model: request.model,
        messages: request.messages,
        max_tokens: request.maxTokens || 1000,
        temperature: request.temperature || 0.7
      })
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(`OpenAI API error: ${response.status} - ${error.error?.message || response.statusText}`);
    }

    const data = await response.json();
    const choice = data.choices[0];
    
    return {
      message: {
        role: 'assistant' as const,
        content: choice?.message?.content || ''
      },
      usage: {
        promptTokens: data.usage?.prompt_tokens || 0,
        completionTokens: data.usage?.completion_tokens || 0,
        totalTokens: data.usage?.total_tokens || 0
      },
      model: data.model,
      requestId: data.id,
      finishReason: choice?.finish_reason
    };
  }

  /**
   * Gemini API调用
   */
  private async callGeminiAPI(request: AiRequest): Promise<any> {
    const model = request.model || 'gemini-pro';
    const url = this.account.endpointUrl || 
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${this.credentials.apiKey}`;

    const contents = request.messages.map(msg => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }]
    }));

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents,
        generationConfig: {
          temperature: request.temperature || 0.7,
          maxOutputTokens: request.maxTokens || 1000
        }
      })
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(`Gemini API error: ${response.status} - ${error.error?.message || response.statusText}`);
    }

    const data = await response.json();
    const candidate = data.candidates?.[0];
    
    if (!candidate?.content?.parts?.[0]?.text) {
      throw new Error('Invalid Gemini response format');
    }

    return {
      message: {
        role: 'assistant' as const,
        content: candidate.content.parts[0].text
      },
      usage: {
        promptTokens: data.usageMetadata?.promptTokenCount || 0,
        completionTokens: data.usageMetadata?.candidatesTokenCount || 0,
        totalTokens: data.usageMetadata?.totalTokenCount || 0
      },
      model: model,
      finishReason: candidate.finishReason
    };
  }

  /**
   * 其他平台API调用的占位符方法
   */
  private async callQwenAPI(request: AiRequest): Promise<any> {
    throw new Error('Qwen API implementation needed');
  }

  private async callGLMAPI(request: AiRequest): Promise<any> {
    throw new Error('GLM API implementation needed');
  }

  private async callKimiAPI(request: AiRequest): Promise<any> {
    throw new Error('Kimi API implementation needed');
  }

  private async callWenxinAPI(request: AiRequest): Promise<any> {
    throw new Error('Wenxin API implementation needed');
  }

  private async callSparkAPI(request: AiRequest): Promise<any> {
    throw new Error('Spark API implementation needed');
  }

  /**
   * 解密凭据
   */
  private decryptCredentials(encryptedCredentials: string): any {
    try {
      // 这里应该实现真正的解密逻辑
      // 暂时假设credentials是JSON字符串
      return JSON.parse(encryptedCredentials);
    } catch (error) {
      throw new Error('Invalid credentials format');
    }
  }

  /**
   * 计算成本
   */
  private calculateCost(usage: { promptTokens: number; completionTokens: number; totalTokens: number }, model: string): number {
    if (this.account.costPerToken) {
      // 简化计算：使用固定的token成本
      return usage.totalTokens * this.account.costPerToken;
    }

    // 使用平台配置的定价
    const platformConfig = getPlatformConfig(this.account.serviceType);
    // 这里需要根据模型获取具体的定价信息
    // 暂时返回一个估算值
    return usage.totalTokens * 0.001; // $0.001 per token as fallback
  }

  /**
   * 获取默认模型
   */
  private getDefaultModel(): string {
    const platformConfig = getPlatformConfig(this.account.serviceType);
    return platformConfig.supportedModels[0] || 'default';
  }
}

/**
 * 账号管理器
 */
export class AiAccountManager {
  private clients: Map<string, AiServiceClient> = new Map();

  /**
   * 获取或创建客户端
   */
  getClient(account: AiServiceAccount): AiServiceClient {
    if (!this.clients.has(account.id)) {
      this.clients.set(account.id, new AiServiceClient(account));
    }
    return this.clients.get(account.id)!;
  }

  /**
   * 移除客户端
   */
  removeClient(accountId: string): void {
    this.clients.delete(accountId);
  }

  /**
   * 批量健康检查
   */
  async batchHealthCheck(accounts: AiServiceAccount[]): Promise<Array<{
    accountId: string;
    isHealthy: boolean;
    responseTime: number;
    error?: string;
  }>> {
    const results = await Promise.allSettled(
      accounts.map(async account => {
        const client = this.getClient(account);
        const health = await client.healthCheck();
        return {
          accountId: account.id,
          isHealthy: health.isHealthy,
          responseTime: health.responseTime,
          error: health.error
        };
      })
    );

    return results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        return {
          accountId: accounts[index].id,
          isHealthy: false,
          responseTime: 0,
          error: result.reason?.message || 'Health check failed'
        };
      }
    });
  }

  /**
   * 批量验证凭据
   */
  async batchValidateCredentials(accounts: AiServiceAccount[]): Promise<Array<{
    accountId: string;
    isValid: boolean;
    error?: string;
  }>> {
    const results = await Promise.allSettled(
      accounts.map(async account => {
        const client = this.getClient(account);
        const validation = await client.validateCredentials();
        return {
          accountId: account.id,
          isValid: validation.isValid,
          error: validation.errorMessage
        };
      })
    );

    return results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        return {
          accountId: accounts[index].id,
          isValid: false,
          error: result.reason?.message || 'Validation failed'
        };
      }
    });
  }
}

// 全局账号管理器实例
export const aiAccountManager = new AiAccountManager();
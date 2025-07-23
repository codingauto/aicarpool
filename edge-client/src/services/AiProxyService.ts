/**
 * AI服务代理
 */
import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { AiServiceConfig, ProxyRequest, ProxyResponse } from '@/types/index.js';
import { EdgeClient } from '@/core/EdgeClient.js';

export class AiProxyService {
  protected edgeClient: EdgeClient;
  private httpClient: AxiosInstance;
  private supportedServices: Map<string, AiServiceConfig> = new Map();

  constructor(edgeClient: EdgeClient) {
    this.edgeClient = edgeClient;
    this.httpClient = axios.create({
      timeout: 30000,
      maxRedirects: 3
    });
  }

  /**
   * 初始化AI服务代理
   */
  async initialize(): Promise<void> {
    console.log('初始化AI服务代理...');
    
    // 从配置中加载支持的AI服务
    await this.loadSupportedServices();
    
    console.log(`已加载 ${this.supportedServices.size} 个AI服务配置`);
  }

  /**
   * 加载支持的AI服务配置
   */
  private async loadSupportedServices(): Promise<void> {
    try {
      // 这里应该从中央服务器获取配置，现在先使用默认配置
      const defaultServices: AiServiceConfig[] = [
        {
          name: 'claude',
          displayName: 'Claude API',
          endpoint: 'https://api.anthropic.com/v1/messages',
          apiKeyHeader: 'x-api-key',
          timeout: 30000,
          retryAttempts: 3,
          models: ['claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022'],
          rateLimit: {
            requests: 100,
            window: 60000 // 1分钟
          }
        },
        {
          name: 'openai',
          displayName: 'OpenAI API',
          endpoint: 'https://api.openai.com/v1/chat/completions',
          apiKeyHeader: 'Authorization',
          apiKeyPrefix: 'Bearer ',
          timeout: 30000,
          retryAttempts: 3,
          models: ['gpt-4', 'gpt-3.5-turbo', 'gpt-4-turbo'],
          rateLimit: {
            requests: 200,
            window: 60000
          }
        }
      ];

      for (const service of defaultServices) {
        this.supportedServices.set(service.name, service);
      }
    } catch (error) {
      console.error('加载AI服务配置失败:', error);
    }
  }

  /**
   * 处理代理请求
   */
  async handleProxyRequest(request: ProxyRequest): Promise<ProxyResponse> {
    const startTime = Date.now();
    
    try {
      // 验证服务是否支持
      const serviceConfig = this.supportedServices.get(request.service);
      if (!serviceConfig) {
        throw new Error(`不支持的AI服务: ${request.service}`);
      }

      // 验证模型是否支持
      if (serviceConfig.models && !serviceConfig.models.includes(request.model)) {
        throw new Error(`服务 ${request.service} 不支持模型 ${request.model}`);
      }

      // 构建请求头
      const headers = this.buildRequestHeaders(serviceConfig, request);

      // 构建请求体
      const requestBody = this.buildRequestBody(serviceConfig, request);

      // 发送请求到AI服务
      const response = await this.httpClient.post(
        serviceConfig.endpoint,
        requestBody,
        {
          headers,
          timeout: serviceConfig.timeout
        }
      );

      const responseTime = Date.now() - startTime;

      // 记录使用统计
      await this.recordUsageStats(request, response, responseTime);

      return {
        success: true,
        data: response.data,
        responseTime,
        service: request.service,
        model: request.model
      };

    } catch (error: any) {
      const responseTime = Date.now() - startTime;
      
      console.error(`AI代理请求失败 [${request.service}/${request.model}]:`, error.message);
      
      // 记录错误统计
      await this.recordErrorStats(request, error, responseTime);

      return {
        success: false,
        error: error.message,
        responseTime,
        service: request.service,
        model: request.model
      };
    }
  }

  /**
   * 构建请求头
   */
  private buildRequestHeaders(serviceConfig: AiServiceConfig, request: ProxyRequest): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'AiCarpool-EdgeClient/1.0.0'
    };

    // 添加API密钥
    if (request.apiKey) {
      const keyValue = serviceConfig.apiKeyPrefix ? 
        `${serviceConfig.apiKeyPrefix}${request.apiKey}` : 
        request.apiKey;
      headers[serviceConfig.apiKeyHeader] = keyValue;
    }

    // 添加自定义头
    if (request.headers) {
      Object.assign(headers, request.headers);
    }

    return headers;
  }

  /**
   * 构建请求体
   */
  private buildRequestBody(serviceConfig: AiServiceConfig, request: ProxyRequest): any {
    // 根据不同的AI服务构建不同的请求体格式
    switch (serviceConfig.name) {
      case 'claude':
        return {
          model: request.model,
          messages: request.messages,
          max_tokens: request.maxTokens || 4096,
          temperature: request.temperature || 0.7,
          ...request.parameters
        };
      
      case 'openai':
        return {
          model: request.model,
          messages: request.messages,
          max_tokens: request.maxTokens || 4096,
          temperature: request.temperature || 0.7,
          ...request.parameters
        };
      
      default:
        return {
          model: request.model,
          messages: request.messages,
          ...request.parameters
        };
    }
  }

  /**
   * 记录使用统计
   */
  private async recordUsageStats(
    request: ProxyRequest, 
    response: AxiosResponse, 
    responseTime: number
  ): Promise<void> {
    try {
      // 提取token使用信息
      const usage = this.extractUsageInfo(response.data, request.service);
      
      // 发送统计数据到EdgeClient
      this.edgeClient.recordApiUsage({
        service: request.service,
        model: request.model,
        requestId: request.requestId || this.generateRequestId(),
        timestamp: new Date(),
        responseTime,
        success: true,
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        totalTokens: usage.totalTokens,
        estimatedCost: this.calculateCost(usage, request.service, request.model)
      });
    } catch (error) {
      console.error('记录使用统计失败:', error);
    }
  }

  /**
   * 记录错误统计
   */
  private async recordErrorStats(
    request: ProxyRequest, 
    error: any, 
    responseTime: number
  ): Promise<void> {
    try {
      this.edgeClient.recordApiUsage({
        service: request.service,
        model: request.model,
        requestId: request.requestId || this.generateRequestId(),
        timestamp: new Date(),
        responseTime,
        success: false,
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        estimatedCost: 0,
        errorType: this.getErrorType(error),
        errorMessage: error.message
      });
    } catch (err) {
      console.error('记录错误统计失败:', err);
    }
  }

  /**
   * 提取使用信息
   */
  private extractUsageInfo(responseData: any, service: string): {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  } {
    let inputTokens = 0;
    let outputTokens = 0;
    let totalTokens = 0;

    try {
      switch (service) {
        case 'claude':
          if (responseData.usage) {
            inputTokens = responseData.usage.input_tokens || 0;
            outputTokens = responseData.usage.output_tokens || 0;
            totalTokens = inputTokens + outputTokens;
          }
          break;
        
        case 'openai':
          if (responseData.usage) {
            inputTokens = responseData.usage.prompt_tokens || 0;
            outputTokens = responseData.usage.completion_tokens || 0;
            totalTokens = responseData.usage.total_tokens || (inputTokens + outputTokens);
          }
          break;
      }
    } catch (error) {
      console.warn('提取使用信息失败:', error);
    }

    return { inputTokens, outputTokens, totalTokens };
  }

  /**
   * 计算成本
   */
  private calculateCost(usage: any, service: string, model: string): number {
    // 这里应该根据实际的定价模型计算成本
    // 现在使用简化的计算方式
    const costPer1K = this.getCostPer1K(service, model);
    return (usage.totalTokens / 1000) * costPer1K;
  }

  /**
   * 获取每1K token的成本
   */
  private getCostPer1K(service: string, model: string): number {
    // 简化的定价表，实际应该从配置中获取
    const pricing: Record<string, Record<string, number>> = {
      claude: {
        'claude-3-5-sonnet-20241022': 0.015,
        'claude-3-5-haiku-20241022': 0.008
      },
      openai: {
        'gpt-4': 0.03,
        'gpt-3.5-turbo': 0.002,
        'gpt-4-turbo': 0.01
      }
    };

    return pricing[service]?.[model] || 0.01;
  }

  /**
   * 获取错误类型
   */
  private getErrorType(error: any): string {
    if (error.code === 'ECONNABORTED') return 'timeout';
    if (error.response?.status === 401) return 'auth_error';
    if (error.response?.status === 429) return 'rate_limit';
    if (error.response?.status >= 500) return 'server_error';
    if (error.response?.status >= 400) return 'client_error';
    return 'unknown_error';
  }

  /**
   * 生成请求ID
   */
  private generateRequestId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substring(2, 11);
  }

  /**
   * 更新服务配置
   */
  async updateServiceConfig(configs: AiServiceConfig[]): Promise<void> {
    this.supportedServices.clear();
    for (const config of configs) {
      this.supportedServices.set(config.name, config);
    }
    console.log(`已更新 ${configs.length} 个AI服务配置`);
  }

  /**
   * 获取支持的服务列表
   */
  getSupportedServices(): string[] {
    return Array.from(this.supportedServices.keys());
  }

  /**
   * 获取服务配置
   */
  getServiceConfig(serviceName: string): AiServiceConfig | undefined {
    return this.supportedServices.get(serviceName);
  }

  /**
   * 检查服务健康状态
   */
  async checkServiceHealth(serviceName: string): Promise<{
    service: string;
    healthy: boolean;
    responseTime?: number;
    error?: string;
  }> {
    const serviceConfig = this.supportedServices.get(serviceName);
    if (!serviceConfig) {
      return {
        service: serviceName,
        healthy: false,
        error: '服务配置不存在'
      };
    }

    const startTime = Date.now();
    try {
      // 发送简单的健康检查请求
      await this.httpClient.get(serviceConfig.endpoint.replace(/\/[^\/]*$/g, '/health'), {
        timeout: 5000
      });
      
      return {
        service: serviceName,
        healthy: true,
        responseTime: Date.now() - startTime
      };
    } catch (error: any) {
      return {
        service: serviceName,
        healthy: false,
        responseTime: Date.now() - startTime,
        error: error.message
      };
    }
  }
}
// AI服务的基础接口定义
export interface AIServiceConfig {
  apiKey: string;
  baseUrl: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
  timeout?: number;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatRequest {
  messages: ChatMessage[];
  model?: string;
  maxTokens?: number;
  temperature?: number;
  stream?: boolean;
}

export interface ChatResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: ChatMessage;
    finishReason: string;
  }>;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface UsageInfo {
  requestId: string;
  service: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  cost: number;
  responseTime: number;
  timestamp: Date;
}

// AI服务基础抽象类
export abstract class AIServiceBase {
  protected config: AIServiceConfig;
  protected serviceName: string;

  constructor(config: AIServiceConfig, serviceName: string) {
    this.config = config;
    this.serviceName = serviceName;
  }

  // 抽象方法，由子类实现
  abstract chat(request: ChatRequest): Promise<ChatResponse>;
  abstract calculateCost(usage: ChatResponse['usage'], model: string): number;
  abstract validateApiKey(): Promise<boolean>;
  abstract healthCheck(): Promise<boolean>;

  // 通用方法
  protected generateRequestId(): string {
    return `${this.serviceName}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  protected async makeRequest(
    url: string,
    options: RequestInit,
    timeoutMs: number = 30000
  ): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Request timeout');
      }
      throw error;
    }
  }

  protected handleError(error: unknown, context: string): never {
    console.error(`${this.serviceName} ${context} error:`, error);
    
    if (error instanceof Error) {
      if (error.message.includes('timeout')) {
        throw new Error(`${this.serviceName} request timeout`);
      }
      if (error.message.includes('401') || error.message.includes('unauthorized')) {
        throw new Error(`${this.serviceName} API key invalid`);
      }
      if (error.message.includes('429')) {
        throw new Error(`${this.serviceName} rate limit exceeded`);
      }
      if (error.message.includes('quota')) {
        throw new Error(`${this.serviceName} quota exceeded`);
      }
    }

    throw new Error(`${this.serviceName} ${context} failed`);
  }
}
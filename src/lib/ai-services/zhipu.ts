import { AIServiceBase, AIServiceConfig, ChatRequest, ChatResponse, ChatMessage } from './base';

interface ZhipuMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface ZhipuRequest {
  model: string;
  messages: ZhipuMessage[];
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
}

interface ZhipuResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export class ZhipuService extends AIServiceBase {
  private readonly defaultModel = 'glm-4-plus';
  private readonly costPerToken = {
    'glm-4.5': { input: 0.0001, output: 0.0001 },
    'glm-4.5-plus': { input: 0.0002, output: 0.0002 },
    'glm-4.5-air': { input: 0.000001, output: 0.000001 },
    'glm-4.5-airx': { input: 0.00001, output: 0.00001 },
    'glm-4.5-flash': { input: 0.0000001, output: 0.0000001 },
  };

  constructor(config: AIServiceConfig) {
    super(config, 'zhipu');
  }

  async chat(request: ChatRequest): Promise<ChatResponse> {
    const startTime = Date.now();
    
    try {
      const zhipuRequest: ZhipuRequest = {
        model: request.model || this.defaultModel,
        messages: this.convertMessages(request.messages),
        temperature: request.temperature || 0.7,
        max_tokens: request.maxTokens || 4096,
      };

      const response = await this.makeRequest(
        `${this.config.baseUrl}/api/paas/v4/chat/completions`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.config.apiKey}`,
          },
          body: JSON.stringify(zhipuRequest),
        },
        this.config.timeout
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const zhipuResponse: ZhipuResponse = await response.json();
      
      // 转换为统一格式
      const chatResponse: ChatResponse = {
        id: zhipuResponse.id,
        object: zhipuResponse.object,
        created: zhipuResponse.created,
        model: zhipuResponse.model,
        choices: zhipuResponse.choices.map(choice => ({
          index: choice.index,
          message: {
            role: 'assistant',
            content: choice.message.content,
          },
          finishReason: this.mapFinishReason(choice.finish_reason),
        })),
        usage: {
          promptTokens: zhipuResponse.usage.prompt_tokens,
          completionTokens: zhipuResponse.usage.completion_tokens,
          totalTokens: zhipuResponse.usage.total_tokens,
        },
      };

      return chatResponse;

    } catch (error) {
      this.handleError(error, 'chat');
    }
  }

  calculateCost(usage: ChatResponse['usage'], model: string): number {
    const rates = this.costPerToken[model as keyof typeof this.costPerToken] || 
                  this.costPerToken[this.defaultModel as keyof typeof this.costPerToken];
    
    const inputCost = usage.promptTokens * rates.input;
    const outputCost = usage.completionTokens * rates.output;
    
    return inputCost + outputCost;
  }

  async validateApiKey(): Promise<boolean> {
    try {
      const response = await this.makeRequest(
        `${this.config.baseUrl}/api/paas/v4/models`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${this.config.apiKey}`,
          },
        },
        5000
      );

      return response.ok;
    } catch (error) {
      console.error('Zhipu API key validation error:', error);
      return false;
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.chat({
        messages: [{ role: 'user', content: 'ping' }],
        maxTokens: 10,
        temperature: 0,
      });
      return true;
    } catch (error) {
      console.warn('Zhipu health check failed:', error);
      return false;
    }
  }

  private convertMessages(messages: ChatMessage[]): ZhipuMessage[] {
    return messages.map(msg => ({
      role: msg.role as 'system' | 'user' | 'assistant',
      content: msg.content,
    }));
  }

  private mapFinishReason(zhipuFinishReason: string): string {
    switch (zhipuFinishReason) {
      case 'stop':
        return 'stop';
      case 'length':
        return 'length';
      case 'content_filter':
        return 'content_filter';
      case 'function_call':
        return 'function_call';
      default:
        return 'stop';
    }
  }
}
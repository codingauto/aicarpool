import { AIServiceBase, AIServiceConfig, ChatRequest, ChatResponse, ChatMessage } from './base';

interface KimiMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface KimiRequest {
  model: string;
  messages: KimiMessage[];
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
}

interface KimiResponse {
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

export class KimiService extends AIServiceBase {
  private readonly defaultModel = 'k2';
  private readonly costPerToken = {
    'k2': { input: 0.000012, output: 0.000012 }
  };

  constructor(config: AIServiceConfig) {
    super(config, 'kimi');
  }

  async chat(request: ChatRequest): Promise<ChatResponse> {
    const startTime = Date.now();
    
    try {
      const kimiRequest: KimiRequest = {
        model: request.model || this.defaultModel,
        messages: this.convertMessages(request.messages),
        temperature: request.temperature || 0.7,
        max_tokens: request.maxTokens || 4096,
      };

      const response = await this.makeRequest(
        `${this.config.baseUrl}/v1/chat/completions`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.config.apiKey}`,
          },
          body: JSON.stringify(kimiRequest),
        },
        this.config.timeout
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const kimiResponse: KimiResponse = await response.json();
      
      // 转换为统一格式
      const chatResponse: ChatResponse = {
        id: kimiResponse.id,
        object: kimiResponse.object,
        created: kimiResponse.created,
        model: kimiResponse.model,
        choices: kimiResponse.choices.map(choice => ({
          index: choice.index,
          message: {
            role: 'assistant',
            content: choice.message.content,
          },
          finishReason: this.mapFinishReason(choice.finish_reason),
        })),
        usage: {
          promptTokens: kimiResponse.usage.prompt_tokens,
          completionTokens: kimiResponse.usage.completion_tokens,
          totalTokens: kimiResponse.usage.total_tokens,
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
        `${this.config.baseUrl}/v1/models`,
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
      console.error('Kimi API key validation error:', error);
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
      console.warn('Kimi health check failed:', error);
      return false;
    }
  }

  private convertMessages(messages: ChatMessage[]): KimiMessage[] {
    return messages.map(msg => ({
      role: msg.role as 'system' | 'user' | 'assistant',
      content: msg.content,
    }));
  }

  private mapFinishReason(kimiFinishReason: string): string {
    switch (kimiFinishReason) {
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
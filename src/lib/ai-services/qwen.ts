import { AIServiceBase, AIServiceConfig, ChatRequest, ChatResponse, ChatMessage } from './base';

interface QwenMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface QwenRequest {
  model: string;
  input: {
    messages: QwenMessage[];
  };
  parameters?: {
    temperature?: number;
    max_tokens?: number;
    stream?: boolean;
  };
}

interface QwenResponse {
  output: {
    text: string;
    finish_reason: string;
    choices?: Array<{
      message: {
        role: string;
        content: string;
      };
      finish_reason: string;
    }>;
  };
  usage: {
    input_tokens: number;
    output_tokens: number;
    total_tokens: number;
  };
  request_id: string;
}

export class QwenService extends AIServiceBase {
  private readonly defaultModel = 'qwen-max';
  private readonly costPerToken = {
    'qwen-turbo': { input: 0.000003, output: 0.000006 },
    'qwen-plus': { input: 0.000008, output: 0.000024 },
    'qwen-max': { input: 0.00002, output: 0.00006 },
    'qwen-max-latest': { input: 0.00002, output: 0.00006 },
  };

  constructor(config: AIServiceConfig) {
    super(config, 'qwen');
  }

  async chat(request: ChatRequest): Promise<ChatResponse> {
    const startTime = Date.now();
    
    try {
      const qwenRequest: QwenRequest = {
        model: request.model || this.defaultModel,
        input: {
          messages: this.convertMessages(request.messages),
        },
        parameters: {
          temperature: request.temperature || 0.7,
          max_tokens: request.maxTokens || 4096,
        },
      };

      const response = await this.makeRequest(
        `${this.config.baseUrl}/compatible-mode/v1/chat/completions`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.config.apiKey}`,
            'X-DashScope-SSE': 'disable',
          },
          body: JSON.stringify({
            model: qwenRequest.model,
            messages: qwenRequest.input.messages,
            temperature: qwenRequest.parameters?.temperature,
            max_tokens: qwenRequest.parameters?.max_tokens,
          }),
        },
        this.config.timeout
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const qwenResponse = await response.json();
      
      // 兼容不同的响应格式
      let choices, usage, id;
      
      if (qwenResponse.choices) {
        // OpenAI兼容格式
        choices = qwenResponse.choices;
        usage = qwenResponse.usage;
        id = qwenResponse.id;
      } else {
        // 原生格式
        const qwenNativeResponse = qwenResponse as QwenResponse;
        choices = [{
          index: 0,
          message: {
            role: 'assistant',
            content: qwenNativeResponse.output.text || qwenNativeResponse.output.choices?.[0]?.message?.content || '',
          },
          finish_reason: qwenNativeResponse.output.finish_reason,
        }];
        usage = {
          prompt_tokens: qwenNativeResponse.usage.input_tokens,
          completion_tokens: qwenNativeResponse.usage.output_tokens,
          total_tokens: qwenNativeResponse.usage.total_tokens,
        };
        id = qwenNativeResponse.request_id;
      }

      // 转换为统一格式
      const chatResponse: ChatResponse = {
        id: id || this.generateRequestId(),
        object: 'chat.completion',
        created: Math.floor(Date.now() / 1000),
        model: request.model || this.defaultModel,
        choices: choices.map((choice: any) => ({
          index: choice.index || 0,
          message: {
            role: 'assistant',
            content: choice.message.content,
          },
          finishReason: this.mapFinishReason(choice.finish_reason),
        })),
        usage: {
          promptTokens: usage.prompt_tokens,
          completionTokens: usage.completion_tokens,
          totalTokens: usage.total_tokens,
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
        `${this.config.baseUrl}/compatible-mode/v1/models`,
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
      console.error('Qwen API key validation error:', error);
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
      console.warn('Qwen health check failed:', error);
      return false;
    }
  }

  private convertMessages(messages: ChatMessage[]): QwenMessage[] {
    return messages.map(msg => ({
      role: msg.role as 'system' | 'user' | 'assistant',
      content: msg.content,
    }));
  }

  private mapFinishReason(qwenFinishReason: string): string {
    switch (qwenFinishReason) {
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
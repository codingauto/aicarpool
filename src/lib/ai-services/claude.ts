import { AIServiceBase, AIServiceConfig, ChatRequest, ChatResponse, ChatMessage } from './base';

interface ClaudeMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface ClaudeRequest {
  model: string;
  max_tokens: number;
  messages: ClaudeMessage[];
  temperature?: number;
  stream?: boolean;
}

interface ClaudeResponse {
  id: string;
  type: string;
  role: string;
  content: Array<{
    type: string;
    text: string;
  }>;
  model: string;
  stop_reason: string;
  stop_sequence: null;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

export class ClaudeService extends AIServiceBase {
  private readonly defaultModel = 'claude-3-haiku-20240307';
  private readonly costPerToken = {
    'claude-3-opus-20240229': { input: 0.000015, output: 0.000075 },
    'claude-3-sonnet-20240229': { input: 0.000003, output: 0.000015 },
    'claude-3-haiku-20240307': { input: 0.00000025, output: 0.00000125 },
  };

  constructor(config: AIServiceConfig) {
    super(config, 'claude');
  }

  async chat(request: ChatRequest): Promise<ChatResponse> {
    const startTime = Date.now();
    
    try {
      const claudeRequest: ClaudeRequest = {
        model: request.model || this.defaultModel,
        max_tokens: request.maxTokens || 4096,
        messages: this.convertMessages(request.messages),
        temperature: request.temperature || 0.7,
      };

      const response = await this.makeRequest(
        `${this.config.baseUrl}/v1/messages`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.config.apiKey}`,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify(claudeRequest),
        },
        this.config.timeout
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const claudeResponse: ClaudeResponse = await response.json();
      
      // 转换为统一格式
      const chatResponse: ChatResponse = {
        id: claudeResponse.id,
        object: 'chat.completion',
        created: Math.floor(Date.now() / 1000),
        model: claudeResponse.model,
        choices: [{
          index: 0,
          message: {
            role: 'assistant',
            content: claudeResponse.content[0]?.text || '',
          },
          finishReason: this.mapStopReason(claudeResponse.stop_reason),
        }],
        usage: {
          promptTokens: claudeResponse.usage.input_tokens,
          completionTokens: claudeResponse.usage.output_tokens,
          totalTokens: claudeResponse.usage.input_tokens + claudeResponse.usage.output_tokens,
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
        `${this.config.baseUrl}/v1/messages`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.config.apiKey}`,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: this.defaultModel,
            max_tokens: 1,
            messages: [{ role: 'user', content: 'test' }],
          }),
        },
        5000
      );

      return response.ok || response.status === 400; // 400也表示认证成功
    } catch (error) {
      console.error('Claude API key validation error:', error);
      return false;
    }
  }

  private convertMessages(messages: ChatMessage[]): ClaudeMessage[] {
    return messages
      .filter(msg => msg.role !== 'system') // Claude不支持system消息
      .map(msg => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      }));
  }

  private mapStopReason(claudeStopReason: string): string {
    switch (claudeStopReason) {
      case 'end_turn':
        return 'stop';
      case 'max_tokens':
        return 'length';
      case 'stop_sequence':
        return 'stop';
      default:
        return 'stop';
    }
  }
}
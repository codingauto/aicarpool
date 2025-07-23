import { AIServiceBase, AIServiceConfig, ChatRequest, ChatResponse, ChatMessage } from './base';

interface GeminiContent {
  role: string;
  parts: Array<{ text: string }>;
}

interface GeminiRequest {
  contents: GeminiContent[];
  generationConfig?: {
    temperature?: number;
    maxOutputTokens?: number;
  };
}

interface GeminiResponse {
  candidates: Array<{
    content: {
      parts: Array<{ text: string }>;
      role: string;
    };
    finishReason: string;
    index: number;
  }>;
  usageMetadata: {
    promptTokenCount: number;
    candidatesTokenCount: number;
    totalTokenCount: number;
  };
}

export class GeminiService extends AIServiceBase {
  private readonly defaultModel = 'gemini-pro';
  private readonly costPerToken = {
    'gemini-pro': { input: 0.0000005, output: 0.0000015 },
    'gemini-pro-vision': { input: 0.00000025, output: 0.00000075 },
  };

  constructor(config: AIServiceConfig) {
    super(config, 'gemini');
  }

  async chat(request: ChatRequest): Promise<ChatResponse> {
    const startTime = Date.now();
    
    try {
      const model = request.model || this.defaultModel;
      const geminiRequest: GeminiRequest = {
        contents: this.convertMessages(request.messages),
        generationConfig: {
          temperature: request.temperature || 0.7,
          maxOutputTokens: request.maxTokens || 4096,
        },
      };

      const url = `${this.config.baseUrl}/v1beta/models/${model}:generateContent?key=${this.config.apiKey}`;
      
      const response = await this.makeRequest(
        url,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(geminiRequest),
        },
        this.config.timeout
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const geminiResponse: GeminiResponse = await response.json();
      
      if (!geminiResponse.candidates || geminiResponse.candidates.length === 0) {
        throw new Error('No response from Gemini');
      }

      const candidate = geminiResponse.candidates[0];
      
      // 转换为统一格式
      const chatResponse: ChatResponse = {
        id: this.generateRequestId(),
        object: 'chat.completion',
        created: Math.floor(Date.now() / 1000),
        model: model,
        choices: [{
          index: 0,
          message: {
            role: 'assistant',
            content: candidate.content.parts[0]?.text || '',
          },
          finishReason: this.mapFinishReason(candidate.finishReason),
        }],
        usage: {
          promptTokens: geminiResponse.usageMetadata.promptTokenCount,
          completionTokens: geminiResponse.usageMetadata.candidatesTokenCount,
          totalTokens: geminiResponse.usageMetadata.totalTokenCount,
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
      const url = `${this.config.baseUrl}/v1beta/models?key=${this.config.apiKey}`;
      
      const response = await this.makeRequest(
        url,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        },
        5000
      );

      return response.ok;
    } catch (error) {
      console.error('Gemini API key validation error:', error);
      return false;
    }
  }

  private convertMessages(messages: ChatMessage[]): GeminiContent[] {
    const contents: GeminiContent[] = [];
    
    for (const message of messages) {
      if (message.role === 'system') {
        // 将system消息转换为user消息
        contents.push({
          role: 'user',
          parts: [{ text: `System: ${message.content}` }],
        });
      } else {
        contents.push({
          role: message.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: message.content }],
        });
      }
    }

    return contents;
  }

  private mapFinishReason(geminiFinishReason: string): string {
    switch (geminiFinishReason) {
      case 'STOP':
        return 'stop';
      case 'MAX_TOKENS':
        return 'length';
      case 'SAFETY':
        return 'content_filter';
      case 'RECITATION':
        return 'content_filter';
      default:
        return 'stop';
    }
  }
}
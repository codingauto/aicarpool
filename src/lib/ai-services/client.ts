/**
 * AI服务统一客户端
 * 
 * 支持的AI服务：
 * - Claude (Anthropic)
 * - Gemini (Google)
 * - OpenAI (GPT系列)
 * - Qwen (阿里通义千问)
 * - Zhipu (智谱AI)
 * - Kimi (月之暗面)
 */

import { AiRequest, AiResponse } from '@/lib/services/smart-ai-router';

// AI服务账号接口
export interface AiServiceAccount {
  id: string;
  name: string;
  serviceType: string;
  authType: 'api_key' | 'oauth';
  encryptedCredentials: string;
  apiEndpoint?: string;
  proxyType?: string;
  proxyHost?: string;
  proxyPort?: number;
  proxyUsername?: string;
  proxyPassword?: string;
  supportedModels: string[];
  currentModel?: string;
  costPerToken: number;
}

// 统一的AI服务客户端
export class AiServiceClient {
  private account: AiServiceAccount;
  private credentials: any;

  constructor(account: AiServiceAccount) {
    this.account = account;
    try {
      this.credentials = JSON.parse(account.encryptedCredentials);
    } catch (error) {
      throw new Error(`Invalid credentials format for account ${account.name}`);
    }
  }

  /**
   * 执行AI请求
   */
  async executeRequest(request: AiRequest): Promise<AiResponse> {
    const startTime = Date.now();
    
    try {
      let response: any;
      
      switch (this.account.serviceType) {
        case 'claude':
          response = await this.callClaude(request);
          break;
        case 'gemini':
          response = await this.callGemini(request);
          break;
        case 'openai':
          response = await this.callOpenAI(request);
          break;
        case 'qwen':
          response = await this.callQwen(request);
          break;
        case 'zhipu':
          response = await this.callZhipu(request);
          break;
        case 'kimi':
          response = await this.callKimi(request);
          break;
        default:
          throw new Error(`Unsupported AI service: ${this.account.serviceType}`);
      }

      const responseTime = Date.now() - startTime;
      
      return {
        message: response.message,
        usage: response.usage,
        cost: this.calculateCost(response.usage),
        accountUsed: {
          id: this.account.id,
          name: this.account.name,
          serviceType: this.account.serviceType
        },
        metadata: {
          responseTime,
          model: response.model || this.account.currentModel,
          requestId: response.requestId
        }
      };

    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      throw {
        error: error instanceof Error ? error.message : String(error),
        accountUsed: {
          id: this.account.id,
          name: this.account.name,
          serviceType: this.account.serviceType
        },
        metadata: {
          responseTime,
          model: this.account.currentModel
        }
      };
    }
  }

  /**
   * 健康检查
   */
  async healthCheck(): Promise<{ isHealthy: boolean; responseTime: number; error?: string }> {
    const startTime = Date.now();
    
    try {
      // 发送简单的测试请求
      const testRequest: AiRequest = {
        messages: [{ role: 'user', content: 'Hi' }],
        serviceType: this.account.serviceType as any,
        maxTokens: 10,
        temperature: 0.1
      };

      await this.executeRequest(testRequest);
      
      return {
        isHealthy: true,
        responseTime: Date.now() - startTime
      };
    } catch (error) {
      return {
        isHealthy: false,
        responseTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * 调用Claude API
   */
  private async callClaude(request: AiRequest): Promise<any> {
    const apiKey = this.credentials.apiKey;
    if (!apiKey) {
      throw new Error('Claude API key not configured');
    }

    const url = this.account.apiEndpoint || 'https://api.anthropic.com/v1/messages';
    const model = request.model || this.account.currentModel || 'claude-3-haiku-20240307';

    const response = await this.makeHttpRequest(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model,
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
        role: 'assistant',
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
   * 调用Gemini API
   */
  private async callGemini(request: AiRequest): Promise<any> {
    const apiKey = this.credentials.apiKey;
    if (!apiKey) {
      throw new Error('Gemini API key not configured');
    }

    const model = request.model || this.account.currentModel || 'gemini-pro';
    const url = this.account.apiEndpoint || 
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    // 转换消息格式
    const contents = request.messages.map(msg => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }]
    }));

    const response = await this.makeHttpRequest(url, {
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
    
    if (!data.candidates?.[0]?.content?.parts?.[0]?.text) {
      throw new Error('Invalid Gemini response format');
    }

    return {
      message: {
        role: 'assistant',
        content: data.candidates[0].content.parts[0].text
      },
      usage: {
        promptTokens: data.usageMetadata?.promptTokenCount || 0,
        completionTokens: data.usageMetadata?.candidatesTokenCount || 0,
        totalTokens: data.usageMetadata?.totalTokenCount || 0
      },
      model: model
    };
  }

  /**
   * 调用OpenAI API
   */
  private async callOpenAI(request: AiRequest): Promise<any> {
    const apiKey = this.credentials.apiKey;
    if (!apiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const url = this.account.apiEndpoint || 'https://api.openai.com/v1/chat/completions';
    const model = request.model || this.account.currentModel || 'gpt-3.5-turbo';

    const response = await this.makeHttpRequest(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        messages: request.messages,
        max_tokens: request.maxTokens || 1000,
        temperature: request.temperature || 0.7,
        stream: false
      })
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(`OpenAI API error: ${response.status} - ${error.error?.message || response.statusText}`);
    }

    const data = await response.json();
    
    return {
      message: {
        role: 'assistant',
        content: data.choices[0]?.message?.content || ''
      },
      usage: {
        promptTokens: data.usage?.prompt_tokens || 0,
        completionTokens: data.usage?.completion_tokens || 0,
        totalTokens: data.usage?.total_tokens || 0
      },
      model: data.model,
      requestId: data.id
    };
  }

  /**
   * 调用通义千问API
   */
  private async callQwen(request: AiRequest): Promise<any> {
    const apiKey = this.credentials.apiKey;
    if (!apiKey) {
      throw new Error('Qwen API key not configured');
    }

    const url = this.account.apiEndpoint || 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation';
    const model = request.model || this.account.currentModel || 'qwen-max';

    // 转换消息格式
    const input = {
      messages: request.messages
    };

    const response = await this.makeHttpRequest(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        input,
        parameters: {
          max_tokens: request.maxTokens || 1000,
          temperature: request.temperature || 0.7
        }
      })
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(`Qwen API error: ${response.status} - ${error.message || response.statusText}`);
    }

    const data = await response.json();
    
    return {
      message: {
        role: 'assistant',
        content: data.output?.text || ''
      },
      usage: {
        promptTokens: data.usage?.input_tokens || 0,
        completionTokens: data.usage?.output_tokens || 0,
        totalTokens: data.usage?.total_tokens || 0
      },
      model: model,
      requestId: data.request_id
    };
  }

  /**
   * 调用智谱AI API
   */
  private async callZhipu(request: AiRequest): Promise<any> {
    // 智谱AI的实现
    throw new Error('Zhipu AI integration not implemented yet');
  }

  /**
   * 调用Kimi API
   */
  private async callKimi(request: AiRequest): Promise<any> {
    // Kimi的实现
    throw new Error('Kimi integration not implemented yet');
  }

  /**
   * 发送HTTP请求（支持代理）
   */
  private async makeHttpRequest(url: string, options: RequestInit): Promise<Response> {
    // 如果配置了代理，这里需要处理代理逻辑
    // 暂时使用标准的fetch
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30秒超时
    
    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new Error('Request timeout');
      }
      
      throw error;
    }
  }

  /**
   * 计算请求成本
   */
  private calculateCost(usage: { promptTokens: number; completionTokens: number; totalTokens: number }): number {
    // 简化的成本计算，实际应该根据不同服务和模型的定价
    const inputCost = usage.promptTokens * Number(this.account.costPerToken) * 0.5; // 输入token成本较低
    const outputCost = usage.completionTokens * Number(this.account.costPerToken) * 1.5; // 输出token成本较高
    
    return Number((inputCost + outputCost).toFixed(6));
  }
}
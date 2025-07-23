import { AIServiceBase, AIServiceConfig } from './base';
import { ClaudeService } from './claude';
import { GeminiService } from './gemini';

export type SupportedAIService = 'claude' | 'gemini' | 'ampcode';

export class AIServiceFactory {
  static create(serviceName: SupportedAIService, config: AIServiceConfig): AIServiceBase {
    switch (serviceName) {
      case 'claude':
        return new ClaudeService(config);
      
      case 'gemini':
        return new GeminiService(config);
      
      case 'ampcode':
        // TODO: 实现AmpCode服务
        throw new Error('AmpCode service not implemented yet');
      
      default:
        throw new Error(`Unsupported AI service: ${serviceName}`);
    }
  }

  static getSupportedServices(): SupportedAIService[] {
    return ['claude', 'gemini', 'ampcode'];
  }

  static getServiceInfo(serviceName: SupportedAIService) {
    const serviceInfo = {
      claude: {
        displayName: 'Claude',
        description: 'Anthropic的Claude AI模型，擅长代码分析和编程任务',
        defaultBaseUrl: 'https://api.anthropic.com',
        models: [
          'claude-3-opus-20240229',
          'claude-3-sonnet-20240229', 
          'claude-3-haiku-20240307',
        ],
        supportedFeatures: ['chat', 'code', 'analysis'],
      },
      gemini: {
        displayName: 'Gemini',
        description: 'Google的Gemini AI模型，多模态能力强',
        defaultBaseUrl: 'https://generativelanguage.googleapis.com',
        models: [
          'gemini-pro',
          'gemini-pro-vision',
        ],
        supportedFeatures: ['chat', 'vision', 'code'],
      },
      ampcode: {
        displayName: 'AmpCode',
        description: '专业的代码生成和优化AI服务',
        defaultBaseUrl: 'https://api.ampcode.com',
        models: [
          'ampcode-pro',
          'ampcode-lite',
        ],
        supportedFeatures: ['code', 'optimization', 'refactoring'],
      },
    };

    return serviceInfo[serviceName];
  }
}
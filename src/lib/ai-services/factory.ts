import { AIServiceBase, AIServiceConfig } from './base';
import { ClaudeService } from './claude';
import { GeminiService } from './gemini';
import { KimiService } from './kimi';
import { ZhipuService } from './zhipu';
import { QwenService } from './qwen';

export type SupportedAIService = 'claude' | 'gemini' | 'ampcode' | 'kimi' | 'zhipu' | 'qwen';

export class AIServiceFactory {
  static create(serviceName: SupportedAIService, config: AIServiceConfig): AIServiceBase {
    switch (serviceName) {
      case 'claude':
        return new ClaudeService(config);
      
      case 'gemini':
        return new GeminiService(config);
      
      case 'kimi':
        return new KimiService(config);
      
      case 'zhipu':
        return new ZhipuService(config);
      
      case 'qwen':
        return new QwenService(config);
      
      case 'ampcode':
        // TODO: 实现AmpCode服务
        throw new Error('AmpCode service not implemented yet');
      
      default:
        throw new Error(`Unsupported AI service: ${serviceName}`);
    }
  }

  static getSupportedServices(): SupportedAIService[] {
    return ['claude', 'gemini', 'ampcode', 'kimi', 'zhipu', 'qwen'];
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
          'claude-3.5-sonnet-20241022',
          'claude-sonnet-4-20250514',
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
      kimi: {
        displayName: 'Kimi',
        description: 'Moonshot AI的Kimi模型，长文本处理能力强',
        defaultBaseUrl: 'https://api.moonshot.cn',
        models: [
          'moonshot-v1-8k',
          'moonshot-v1-32k',
          'moonshot-v1-128k',
        ],
        supportedFeatures: ['chat', 'long-context', 'code'],
      },
      zhipu: {
        displayName: 'GLM',
        description: '智谱AI的GLM模型，中文理解能力强',
        defaultBaseUrl: 'https://open.bigmodel.cn',
        models: [
          'glm-4',
          'glm-4-plus',
          'glm-4-air',
          'glm-4-airx',
          'glm-4-flash',
        ],
        supportedFeatures: ['chat', 'chinese', 'code'],
      },
      qwen: {
        displayName: 'Qwen',
        description: '阿里云的通义千问模型，全能型AI助手',
        defaultBaseUrl: 'https://dashscope.aliyuncs.com',
        models: [
          'qwen-turbo',
          'qwen-plus',
          'qwen-max',
          'qwen-max-0403',
          'qwen-max-0919',
          'qwen-max-latest',
        ],
        supportedFeatures: ['chat', 'code', 'analysis'],
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
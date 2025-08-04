/**
 * AI平台配置常量
 * 定义所有支持的AI服务平台的配置信息
 */

export enum ServiceType {
  CLAUDE = 'claude',
  CLAUDE_CONSOLE = 'claude_console',
  OPENAI = 'openai',
  GEMINI = 'gemini',
  QWEN = 'qwen',           // 通义千问
  GLM = 'glm',             // 智谱AI
  KIMI = 'kimi',           // 月之暗面
  WENXIN = 'wenxin',       // 文心一言
  SPARK = 'spark',         // 讯飞星火
  HUNYUAN = 'hunyuan',     // 腾讯混元
  MINIMAX = 'minimax',     // MiniMax
  BAICHUAN = 'baichuan',   // 百川AI
  SENSETIME = 'sensetime', // 商汤
  DOUBAO = 'doubao'        // 豆包
}

export enum AuthType {
  API_KEY = 'api_key',
  OAUTH = 'oauth',
  SESSION_TOKEN = 'session_token',
  ACCESS_KEY = 'access_key',
  BEARER_TOKEN = 'bearer_token',
  APP_KEY = 'app_key',
  PROJECT_KEY = 'project_key'
}

export interface PlatformConfig {
  id: ServiceType;
  name: string;
  displayName: string;
  description: string;
  icon: string;
  category: 'international' | 'domestic';
  supportedAuthTypes: AuthType[];
  defaultAuthType: AuthType;
  apiEndpoint?: string;
  documentationUrl?: string;
  requiredFields: string[];
  optionalFields: string[];
  supportedModels: string[];
  defaultModel?: string;
  supportsStreaming: boolean;
  supportsOAuth: boolean;
  supportsProxy: boolean;
  rateLimits?: {
    requestsPerMinute?: number;
    tokensPerMinute?: number;
  };
}

export const PLATFORM_CONFIGS: Record<ServiceType, PlatformConfig> = {
  [ServiceType.CLAUDE]: {
    id: ServiceType.CLAUDE,
    name: 'claude',
    displayName: 'Claude',
    description: 'Anthropic Claude AI助手',
    icon: '🤖',
    category: 'international',
    supportedAuthTypes: [AuthType.API_KEY, AuthType.OAUTH],
    defaultAuthType: AuthType.API_KEY,
    apiEndpoint: 'https://api.anthropic.com',
    documentationUrl: 'https://docs.anthropic.com/',
    requiredFields: ['apiKey'],
    optionalFields: ['organization'],
    supportedModels: [
      'claude-3-5-sonnet-20241022',
      'claude-3-5-sonnet-20240620',
      'claude-3-5-haiku-20241022',
      'claude-3-opus-20240229',
      'claude-3-sonnet-20240229',
      'claude-3-haiku-20240307'
    ],
    defaultModel: 'claude-3-5-sonnet-20241022',
    supportsStreaming: true,
    supportsOAuth: true,
    supportsProxy: true,
    rateLimits: {
      requestsPerMinute: 60,
      tokensPerMinute: 100000
    }
  },

  [ServiceType.CLAUDE_CONSOLE]: {
    id: ServiceType.CLAUDE_CONSOLE,
    name: 'claude-console',
    displayName: 'Claude Console',
    description: 'Claude Console网页版',
    icon: '🖥️',
    category: 'international',
    supportedAuthTypes: [AuthType.SESSION_TOKEN],
    defaultAuthType: AuthType.SESSION_TOKEN,
    apiEndpoint: 'https://console.anthropic.com',
    documentationUrl: 'https://console.anthropic.com',
    requiredFields: ['sessionToken'],
    optionalFields: [],
    supportedModels: [
      'claude-3-5-sonnet',
      'claude-3-opus',
      'claude-3-sonnet',
      'claude-3-haiku'
    ],
    defaultModel: 'claude-3-5-sonnet',
    supportsStreaming: true,
    supportsOAuth: false,
    supportsProxy: true
  },

  [ServiceType.OPENAI]: {
    id: ServiceType.OPENAI,
    name: 'openai',
    displayName: 'OpenAI',
    description: 'OpenAI GPT系列模型',
    icon: '🧠',
    category: 'international',
    supportedAuthTypes: [AuthType.API_KEY, AuthType.BEARER_TOKEN],
    defaultAuthType: AuthType.API_KEY,
    apiEndpoint: 'https://api.openai.com',
    documentationUrl: 'https://platform.openai.com/docs',
    requiredFields: ['apiKey'],
    optionalFields: ['organization'],
    supportedModels: [
      'gpt-4o',
      'gpt-4o-mini',
      'gpt-4-turbo',
      'gpt-4',
      'gpt-3.5-turbo'
    ],
    defaultModel: 'gpt-4o',
    supportsStreaming: true,
    supportsOAuth: false,
    supportsProxy: true,
    rateLimits: {
      requestsPerMinute: 60,
      tokensPerMinute: 90000
    }
  },

  [ServiceType.GEMINI]: {
    id: ServiceType.GEMINI,
    name: 'gemini',
    displayName: 'Gemini',
    description: 'Google Gemini AI模型',
    icon: '💎',
    category: 'international',
    supportedAuthTypes: [AuthType.API_KEY, AuthType.OAUTH, AuthType.PROJECT_KEY],
    defaultAuthType: AuthType.API_KEY,
    apiEndpoint: 'https://generativelanguage.googleapis.com',
    documentationUrl: 'https://ai.google.dev/docs',
    requiredFields: ['apiKey'],
    optionalFields: ['projectId'],
    supportedModels: [
      'gemini-1.5-pro',
      'gemini-1.5-flash',
      'gemini-1.0-pro'
    ],
    defaultModel: 'gemini-1.5-pro',
    supportsStreaming: true,
    supportsOAuth: true,
    supportsProxy: true,
    rateLimits: {
      requestsPerMinute: 60,
      tokensPerMinute: 32000
    }
  },

  [ServiceType.QWEN]: {
    id: ServiceType.QWEN,
    name: 'qwen',
    displayName: '通义千问',
    description: '阿里云通义千问大模型',
    icon: '🌐',
    category: 'domestic',
    supportedAuthTypes: [AuthType.API_KEY, AuthType.ACCESS_KEY],
    defaultAuthType: AuthType.API_KEY,
    apiEndpoint: 'https://dashscope.aliyuncs.com',
    documentationUrl: 'https://help.aliyun.com/zh/dashscope/',
    requiredFields: ['apiKey'],
    optionalFields: ['region', 'accessKeyId', 'accessKeySecret'],
    supportedModels: [
      'qwen-turbo',
      'qwen-plus',
      'qwen-max',
      'qwen-max-longcontext'
    ],
    defaultModel: 'qwen-turbo',
    supportsStreaming: true,
    supportsOAuth: false,
    supportsProxy: true,
    rateLimits: {
      requestsPerMinute: 100,
      tokensPerMinute: 300000
    }
  },

  [ServiceType.GLM]: {
    id: ServiceType.GLM,
    name: 'glm',
    displayName: '智谱AI',
    description: '智谱AI GLM系列模型',
    icon: '🧪',
    category: 'domestic',
    supportedAuthTypes: [AuthType.API_KEY],
    defaultAuthType: AuthType.API_KEY,
    apiEndpoint: 'https://open.bigmodel.cn',
    documentationUrl: 'https://open.bigmodel.cn/doc',
    requiredFields: ['apiKey'],
    optionalFields: [],
    supportedModels: [
      'glm-4',
      'glm-4v',
      'glm-3-turbo'
    ],
    defaultModel: 'glm-4',
    supportsStreaming: true,
    supportsOAuth: false,
    supportsProxy: true,
    rateLimits: {
      requestsPerMinute: 60,
      tokensPerMinute: 150000
    }
  },

  [ServiceType.KIMI]: {
    id: ServiceType.KIMI,
    name: 'kimi',
    displayName: 'Kimi',
    description: '月之暗面 Kimi AI助手',
    icon: '🌙',
    category: 'domestic',
    supportedAuthTypes: [AuthType.API_KEY],
    defaultAuthType: AuthType.API_KEY,
    apiEndpoint: 'https://api.moonshot.cn',
    documentationUrl: 'https://platform.moonshot.cn/docs',
    requiredFields: ['apiKey'],
    optionalFields: [],
    supportedModels: [
      'moonshot-v1-8k',
      'moonshot-v1-32k',
      'moonshot-v1-128k'
    ],
    defaultModel: 'moonshot-v1-8k',
    supportsStreaming: true,
    supportsOAuth: false,
    supportsProxy: true,
    rateLimits: {
      requestsPerMinute: 60,
      tokensPerMinute: 200000
    }
  },

  [ServiceType.WENXIN]: {
    id: ServiceType.WENXIN,
    name: 'wenxin',
    displayName: '文心一言',
    description: '百度文心一言大模型',
    icon: '🎯',
    category: 'domestic',
    supportedAuthTypes: [AuthType.API_KEY, AuthType.ACCESS_KEY],
    defaultAuthType: AuthType.API_KEY,
    apiEndpoint: 'https://aip.baidubce.com',
    documentationUrl: 'https://cloud.baidu.com/doc/WENXINWORKSHOP/',
    requiredFields: ['apiKey', 'secretKey'],
    optionalFields: [],
    supportedModels: [
      'ernie-4.0-8k',
      'ernie-3.5-8k',
      'ernie-turbo-8k'
    ],
    defaultModel: 'ernie-4.0-8k',
    supportsStreaming: true,
    supportsOAuth: false,
    supportsProxy: true,
    rateLimits: {
      requestsPerMinute: 300,
      tokensPerMinute: 300000
    }
  },

  [ServiceType.SPARK]: {
    id: ServiceType.SPARK,
    name: 'spark',
    displayName: '讯飞星火',
    description: '科大讯飞星火认知大模型',
    icon: '⚡',
    category: 'domestic',
    supportedAuthTypes: [AuthType.APP_KEY],
    defaultAuthType: AuthType.APP_KEY,
    apiEndpoint: 'https://spark-api.xf-yun.com',
    documentationUrl: 'https://www.xfyun.cn/doc/spark/',
    requiredFields: ['appId', 'apiKey', 'apiSecret'],
    optionalFields: [],
    supportedModels: [
      'spark-3.5',
      'spark-3.1',
      'spark-2.1'
    ],
    defaultModel: 'spark-3.5',
    supportsStreaming: true,
    supportsOAuth: false,
    supportsProxy: true,
    rateLimits: {
      requestsPerMinute: 200,
      tokensPerMinute: 400000
    }
  },

  [ServiceType.HUNYUAN]: {
    id: ServiceType.HUNYUAN,
    name: 'hunyuan',
    displayName: '腾讯混元',
    description: '腾讯混元大模型',
    icon: '🔮',
    category: 'domestic',
    supportedAuthTypes: [AuthType.API_KEY],
    defaultAuthType: AuthType.API_KEY,
    apiEndpoint: 'https://hunyuan.tencentcloudapi.com',
    documentationUrl: 'https://cloud.tencent.com/document/product/1729',
    requiredFields: ['secretId', 'secretKey'],
    optionalFields: ['region'],
    supportedModels: [
      'hunyuan-pro',
      'hunyuan-standard',
      'hunyuan-lite'
    ],
    defaultModel: 'hunyuan-pro',
    supportsStreaming: true,
    supportsOAuth: false,
    supportsProxy: true,
    rateLimits: {
      requestsPerMinute: 60,
      tokensPerMinute: 600000
    }
  },

  [ServiceType.MINIMAX]: {
    id: ServiceType.MINIMAX,
    name: 'minimax',
    displayName: 'MiniMax',
    description: 'MiniMax海螺AI大模型',
    icon: '🐚',
    category: 'domestic',
    supportedAuthTypes: [AuthType.API_KEY],
    defaultAuthType: AuthType.API_KEY,
    apiEndpoint: 'https://api.minimax.chat',
    documentationUrl: 'https://www.minimaxi.com/document',
    requiredFields: ['apiKey', 'groupId'],
    optionalFields: [],
    supportedModels: [
      'abab6.5s-chat',
      'abab6.5-chat',
      'abab5.5s-chat'
    ],
    defaultModel: 'abab6.5s-chat',
    supportsStreaming: true,
    supportsOAuth: false,
    supportsProxy: true,
    rateLimits: {
      requestsPerMinute: 60,
      tokensPerMinute: 150000
    }
  },

  [ServiceType.BAICHUAN]: {
    id: ServiceType.BAICHUAN,
    name: 'baichuan',
    displayName: '百川AI',
    description: '百川智能大模型',
    icon: '🏔️',
    category: 'domestic',
    supportedAuthTypes: [AuthType.API_KEY],
    defaultAuthType: AuthType.API_KEY,
    apiEndpoint: 'https://api.baichuan-ai.com',
    documentationUrl: 'https://platform.baichuan-ai.com/docs',
    requiredFields: ['apiKey'],
    optionalFields: [],
    supportedModels: [
      'baichuan2-turbo',
      'baichuan2-turbo-192k'
    ],
    defaultModel: 'baichuan2-turbo',
    supportsStreaming: true,
    supportsOAuth: false,
    supportsProxy: true,
    rateLimits: {
      requestsPerMinute: 60,
      tokensPerMinute: 100000
    }
  },

  [ServiceType.SENSETIME]: {
    id: ServiceType.SENSETIME,
    name: 'sensetime',
    displayName: '商汤',
    description: '商汤科技日日新大模型',
    icon: '🎭',
    category: 'domestic',
    supportedAuthTypes: [AuthType.API_KEY],
    defaultAuthType: AuthType.API_KEY,
    apiEndpoint: 'https://api.sensenova.cn',
    documentationUrl: 'https://platform.sensenova.cn/doc',
    requiredFields: ['apiKey'],
    optionalFields: [],
    supportedModels: [
      'nova-ptc-xl-v1',
      'nova-ptc-xs-v1'
    ],
    defaultModel: 'nova-ptc-xl-v1',
    supportsStreaming: true,
    supportsOAuth: false,
    supportsProxy: true,
    rateLimits: {
      requestsPerMinute: 60,
      tokensPerMinute: 100000
    }
  },

  [ServiceType.DOUBAO]: {
    id: ServiceType.DOUBAO,
    name: 'doubao',
    displayName: '豆包',
    description: '字节跳动豆包大模型',
    icon: '🫘',
    category: 'domestic',
    supportedAuthTypes: [AuthType.API_KEY],
    defaultAuthType: AuthType.API_KEY,
    apiEndpoint: 'https://ark.cn-beijing.volces.com',
    documenturationUrl: 'https://www.volcengine.com/docs/82379',
    requiredFields: ['apiKey', 'endpoint'],
    optionalFields: [],
    supportedModels: [
      'doubao-pro-4k',
      'doubao-pro-32k',
      'doubao-lite-4k'
    ],
    defaultModel: 'doubao-pro-4k',
    supportsStreaming: true,
    supportsOAuth: false,
    supportsProxy: true,
    rateLimits: {
      requestsPerMinute: 200,
      tokensPerMinute: 300000
    }
  }
};

/**
 * 根据服务类型获取平台配置
 */
export function getPlatformConfig(serviceType: ServiceType): PlatformConfig {
  return PLATFORM_CONFIGS[serviceType];
}

/**
 * 获取所有平台配置
 */
export function getAllPlatformConfigs(): PlatformConfig[] {
  return Object.values(PLATFORM_CONFIGS);
}

/**
 * 根据分类获取平台配置
 */
export function getPlatformsByCategory(category: 'international' | 'domestic'): PlatformConfig[] {
  return getAllPlatformConfigs().filter(config => config.category === category);
}

/**
 * 获取支持OAuth的平台
 */
export function getOAuthSupportedPlatforms(): PlatformConfig[] {
  return getAllPlatformConfigs().filter(config => config.supportsOAuth);
}

/**
 * 获取支持流式输出的平台
 */
export function getStreamingSupportedPlatforms(): PlatformConfig[] {
  return getAllPlatformConfigs().filter(config => config.supportsStreaming);
}
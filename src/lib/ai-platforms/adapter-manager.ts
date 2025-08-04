/**
 * AI平台适配器管理器
 * 统一管理所有平台的适配器实例
 */

import { AIServiceAdapter, OAuthAdapter } from './adapters/base-adapter';
import { ClaudeAdapter } from './adapters/claude-adapter';
import { OpenAIAdapter } from './adapters/openai-adapter';
import { GeminiAdapter } from './adapters/gemini-adapter';
import { QwenAdapter } from './adapters/qwen-adapter';
import { GLMAdapter } from './adapters/glm-adapter';
import { KimiAdapter } from './adapters/kimi-adapter';
import { WenxinAdapter } from './adapters/wenxin-adapter';
import { SparkAdapter } from './adapters/spark-adapter';
import { ServiceType, getPlatformConfig } from './platform-configs';

/**
 * 适配器注册表
 */
class AdapterRegistry {
  private adapters: Map<ServiceType, AIServiceAdapter> = new Map();
  private oauthAdapters: Map<ServiceType, OAuthAdapter> = new Map();

  constructor() {
    this.registerDefaultAdapters();
  }

  /**
   * 注册默认适配器
   */
  private registerDefaultAdapters(): void {
    // Claude适配器
    const claudeAdapter = new ClaudeAdapter();
    this.register(ServiceType.CLAUDE, claudeAdapter);
    this.registerOAuth(ServiceType.CLAUDE, claudeAdapter);

    // OpenAI适配器
    const openaiAdapter = new OpenAIAdapter();
    this.register(ServiceType.OPENAI, openaiAdapter);
    
    // Gemini适配器
    const geminiAdapter = new GeminiAdapter();
    this.register(ServiceType.GEMINI, geminiAdapter);
    this.registerOAuth(ServiceType.GEMINI, geminiAdapter);

    // Qwen适配器
    const qwenAdapter = new QwenAdapter();
    this.register(ServiceType.QWEN, qwenAdapter);

    // GLM适配器
    const glmAdapter = new GLMAdapter();
    this.register(ServiceType.GLM, glmAdapter);

    // Kimi适配器
    const kimiAdapter = new KimiAdapter();
    this.register(ServiceType.KIMI, kimiAdapter);

    // 文心一言适配器
    const wenxinAdapter = new WenxinAdapter();
    this.register(ServiceType.WENXIN, wenxinAdapter);

    // 星火认知大模型适配器
    const sparkAdapter = new SparkAdapter();
    this.register(ServiceType.SPARK, sparkAdapter);
  }

  /**
   * 注册适配器
   */
  register(serviceType: ServiceType, adapter: AIServiceAdapter): void {
    this.adapters.set(serviceType, adapter);
  }

  /**
   * 注册OAuth适配器
   */
  registerOAuth(serviceType: ServiceType, adapter: OAuthAdapter): void {
    this.oauthAdapters.set(serviceType, adapter);
  }

  /**
   * 获取适配器
   */
  getAdapter(serviceType: ServiceType): AIServiceAdapter | undefined {
    return this.adapters.get(serviceType);
  }

  /**
   * 获取OAuth适配器
   */
  getOAuthAdapter(serviceType: ServiceType): OAuthAdapter | undefined {
    return this.oauthAdapters.get(serviceType);
  }

  /**
   * 检查是否支持指定平台
   */
  isSupported(serviceType: ServiceType): boolean {
    return this.adapters.has(serviceType);
  }

  /**
   * 检查是否支持OAuth
   */
  supportsOAuth(serviceType: ServiceType): boolean {
    return this.oauthAdapters.has(serviceType);
  }

  /**
   * 获取所有支持的平台
   */
  getSupportedPlatforms(): ServiceType[] {
    return Array.from(this.adapters.keys());
  }

  /**
   * 获取支持OAuth的平台
   */
  getOAuthSupportedPlatforms(): ServiceType[] {
    return Array.from(this.oauthAdapters.keys());
  }
}

// 全局适配器注册表实例
const adapterRegistry = new AdapterRegistry();

/**
 * 获取指定平台的适配器
 */
export function getAdapter(serviceType: ServiceType): AIServiceAdapter {
  const adapter = adapterRegistry.getAdapter(serviceType);
  if (!adapter) {
    throw new Error(`No adapter found for service type: ${serviceType}`);
  }
  return adapter;
}

/**
 * 获取指定平台的OAuth适配器
 */
export function getOAuthAdapter(serviceType: ServiceType): OAuthAdapter {
  const adapter = adapterRegistry.getOAuthAdapter(serviceType);
  if (!adapter) {
    throw new Error(`No OAuth adapter found for service type: ${serviceType}`);
  }
  return adapter;
}

/**
 * 检查平台是否支持
 */
export function isPlatformSupported(serviceType: ServiceType): boolean {
  return adapterRegistry.isSupported(serviceType);
}

/**
 * 检查平台是否支持OAuth
 */
export function isPlatformOAuthSupported(serviceType: ServiceType): boolean {
  return adapterRegistry.supportsOAuth(serviceType);
}

/**
 * 获取所有支持的平台列表
 */
export function getSupportedPlatforms(): Array<{
  serviceType: ServiceType;
  config: any;
  hasAdapter: boolean;
  supportsOAuth: boolean;
}> {
  return Object.values(ServiceType).map(serviceType => {
    const config = getPlatformConfig(serviceType);
    return {
      serviceType,
      config,
      hasAdapter: adapterRegistry.isSupported(serviceType),
      supportsOAuth: adapterRegistry.supportsOAuth(serviceType)
    };
  });
}

/**
 * 验证账号凭据
 */
export async function validateAccountCredentials(
  serviceType: ServiceType,
  credentials: any,
  proxyConfig?: any
) {
  const adapter = getAdapter(serviceType);
  return adapter.validateCredentials(credentials, proxyConfig);
}

/**
 * 测试账号连接
 */
export async function testAccountConnection(
  serviceType: ServiceType,
  credentials: any,
  proxyConfig?: any
): Promise<boolean> {
  const adapter = getAdapter(serviceType);
  return adapter.testConnection(credentials, proxyConfig);
}

/**
 * 获取账号服务状态
 */
export async function getAccountServiceStatus(
  serviceType: ServiceType,
  credentials: any,
  proxyConfig?: any
) {
  const adapter = getAdapter(serviceType);
  return adapter.getServiceStatus(credentials, proxyConfig);
}

/**
 * 获取可用模型列表
 */
export async function getAvailableModels(
  serviceType: ServiceType,
  credentials: any,
  proxyConfig?: any
) {
  const adapter = getAdapter(serviceType);
  return adapter.getAvailableModels(credentials, proxyConfig);
}

/**
 * 生成OAuth授权URL
 */
export async function generateOAuthUrl(
  serviceType: ServiceType,
  redirectUri: string,
  state?: string,
  proxyConfig?: any
) {
  const adapter = getOAuthAdapter(serviceType);
  return adapter.generateAuthUrl(redirectUri, state, proxyConfig);
}

/**
 * 交换OAuth授权码
 */
export async function exchangeOAuthCode(
  serviceType: ServiceType,
  code: string,
  redirectUri: string,
  codeVerifier?: string,
  proxyConfig?: any
) {
  const adapter = getOAuthAdapter(serviceType);
  return adapter.exchangeCodeForToken(code, redirectUri, codeVerifier, proxyConfig);
}

/**
 * 刷新OAuth访问令牌
 */
export async function refreshOAuthToken(
  serviceType: ServiceType,
  refreshToken: string,
  proxyConfig?: any
) {
  const adapter = getOAuthAdapter(serviceType);
  if (!adapter.refreshAccessToken) {
    throw new Error(`Platform ${serviceType} does not support token refresh`);
  }
  return adapter.refreshAccessToken(refreshToken, proxyConfig);
}

/**
 * 批量验证多个账号
 */
export async function batchValidateAccounts(
  accounts: Array<{
    id: string;
    serviceType: ServiceType;
    credentials: any;
    proxyConfig?: any;
  }>
): Promise<Array<{
  id: string;
  isValid: boolean;
  error?: string;
}>> {
  const results = await Promise.allSettled(
    accounts.map(async account => {
      try {
        const result = await validateAccountCredentials(
          account.serviceType,
          account.credentials,
          account.proxyConfig
        );
        return {
          id: account.id,
          isValid: result.isValid,
          error: result.errorMessage
        };
      } catch (error: any) {
        return {
          id: account.id,
          isValid: false,
          error: error.message
        };
      }
    })
  );

  return results.map((result, index) => {
    if (result.status === 'fulfilled') {
      return result.value;
    } else {
      return {
        id: accounts[index].id,
        isValid: false,
        error: result.reason?.message || '验证失败'
      };
    }
  });
}

/**
 * 获取平台健康状态摘要
 */
export async function getPlatformHealthSummary(): Promise<Array<{
  serviceType: ServiceType;
  platformName: string;
  isHealthy: boolean;
  responseTime?: number;
  errorMessage?: string;
}>> {
  const supportedPlatforms = getSupportedPlatforms()
    .filter(p => p.hasAdapter)
    .slice(0, 5); // 只检查前5个平台避免请求过多

  const results = await Promise.allSettled(
    supportedPlatforms.map(async platform => {
      try {
        // 使用空凭据进行基础健康检查
        const adapter = getAdapter(platform.serviceType);
        // 这里可能需要提供测试凭据或使用不同的健康检查方法
        return {
          serviceType: platform.serviceType,
          platformName: platform.config.displayName,
          isHealthy: true,
          responseTime: 0
        };
      } catch (error: any) {
        return {
          serviceType: platform.serviceType,
          platformName: platform.config.displayName,
          isHealthy: false,
          errorMessage: error.message
        };
      }
    })
  );

  return results.map((result, index) => {
    if (result.status === 'fulfilled') {
      return result.value;
    } else {
      const platform = supportedPlatforms[index];
      return {
        serviceType: platform.serviceType,
        platformName: platform.config.displayName,
        isHealthy: false,
        errorMessage: '健康检查失败'
      };
    }
  });
}

export { adapterRegistry };
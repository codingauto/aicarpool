import { AiServiceRouter, ServiceRoute, RoutingConfig } from './router';
import { AIServiceFactory, SupportedAIService } from './factory';
import { ChatRequest, ChatResponse, AIServiceConfig } from './base';
import { prisma } from '@/lib/prisma';
import { cacheManager } from '@/lib/cache';

export interface EnhancedServiceRoute extends ServiceRoute {
  modelType: 'primary' | 'fallback'; // 主模型或备用模型
  modelCategory: 'claude_native' | 'claude_fallback' | 'gemini' | 'ampcode';
  modelName: string; // 具体模型名称如 "claude-4-sonnet"
  failoverPriority: number; // 故障转移优先级
  supportedFeatures: string[]; // 支持的功能列表
  apiKey?: string; // 模型API密钥
  baseUrl?: string; // 模型API地址
}

export interface MultiModelRoutingConfig extends RoutingConfig {
  primaryModel: string; // 主模型标识
  fallbackModels: string[]; // 备用模型列表，按优先级排序
  failoverTrigger: 'manual' | 'automatic' | 'hybrid'; // 切换触发方式
  healthCheckThreshold: number; // 健康检查阈值
  failbackEnabled: boolean; // 是否支持故障恢复切换
}

export interface ModelFailoverEvent {
  groupId: string;
  fromModel: string;
  toModel: string;
  reason: 'automatic_failover' | 'manual_switch' | 'maintenance';
  timestamp: Date;
  success: boolean;
  responseTime?: number;
  errorMessage?: string;
}

export class EnhancedAiServiceRouter extends AiServiceRouter {
  private modelConfigs: Map<string, MultiModelRoutingConfig> = new Map();
  private currentActiveModels: Map<string, string> = new Map(); // groupId -> activeModelId
  private modelRoutes: Map<string, EnhancedServiceRoute[]> = new Map(); // groupId -> routes
  private counters: Map<string, number> = new Map(); // 计数器

  constructor() {
    super();
  }

  /**
   * 为拼车组初始化多模型路由
   */
  async initializeMultiModelRoutes(groupId: string): Promise<void> {
    try {
      // 获取组的模型配置
      const modelConfig = await this.getGroupModelConfig(groupId);
      
      if (modelConfig && modelConfig.serviceType === 'claude_code') {
        // Claude Code CLI支持多模型
        await this.setupClaudeMultiModel(groupId, modelConfig);
      } else {
        // Gemini CLI和AmpCode CLI使用原有逻辑
        await super.initializeRoutes(groupId);
      }
    } catch (error) {
      console.error('Initialize multi-model routes error:', error);
      throw error;
    }
  }

  /**
   * 智能模型路由
   */
  async routeToOptimalModel(
    groupId: string,
    request: ChatRequest,
    serviceType: 'claude_code' | 'gemini' | 'ampcode'
  ): Promise<ChatResponse> {
    
    if (serviceType !== 'claude_code') {
      // 非Claude Code服务使用原有路由逻辑
      return await super.routeRequest(groupId, request);
    }

    // Claude Code CLI多模型路由逻辑
    const activeModel = this.currentActiveModels.get(groupId);
    const modelConfig = this.modelConfigs.get(groupId);

    if (!activeModel || !modelConfig) {
      throw new Error('模型配置未初始化');
    }

    try {
      // 尝试使用当前活跃模型
      return await this.sendToModel(groupId, activeModel, request);
      
    } catch (error) {
      // 如果启用了自动故障转移
      if (modelConfig.failoverTrigger === 'automatic' || 
          modelConfig.failoverTrigger === 'hybrid') {
        
        console.warn(`主模型 ${activeModel} 故障，开始故障转移:`, error);
        return await this.performFailover(groupId, request, activeModel);
      }
      
      throw error;
    }
  }

  /**
   * 执行故障转移
   */
  private async performFailover(
    groupId: string, 
    request: ChatRequest, 
    failedModel: string
  ): Promise<ChatResponse> {
    const modelConfig = this.modelConfigs.get(groupId);
    if (!modelConfig) throw new Error('模型配置不存在');

    // 获取可用的备用模型（按优先级排序）
    const availableFallbacks = modelConfig.fallbackModels
      .filter(model => model !== failedModel)
      .sort((a, b) => this.getModelPriority(a) - this.getModelPriority(b));

    for (const fallbackModel of availableFallbacks) {
      try {
        console.log(`尝试故障转移到模型: ${fallbackModel}`);
        
        // 检查备用模型健康状态
        if (await this.checkModelHealth(fallbackModel, groupId)) {
          const response = await this.sendToModel(groupId, fallbackModel, request);
          
          // 更新当前活跃模型
          this.currentActiveModels.set(groupId, fallbackModel);
          
          // 记录故障转移事件
          await this.recordFailoverEvent(groupId, failedModel, fallbackModel, 'automatic_failover', true);
          
          // 缓存新的活跃模型
          const { cacheManager } = await import('@/lib/cache');
          await cacheManager.set(`active_model:${groupId}`, fallbackModel, 300);
          
          return response;
        }
      } catch (error) {
        console.warn(`备用模型 ${fallbackModel} 也不可用:`, error);
        await this.recordFailoverEvent(groupId, failedModel, fallbackModel, 'automatic_failover', false, (error as Error).message);
        continue;
      }
    }
    
    throw new Error('所有模型均不可用，故障转移失败');
  }

  /**
   * 手动切换模型
   */
  async switchModel(
    groupId: string, 
    targetModel: string,
    reason: 'manual' | 'maintenance' | 'performance'
  ): Promise<boolean> {
    try {
      // 验证目标模型可用性
      if (!(await this.checkModelHealth(targetModel, groupId))) {
        throw new Error(`目标模型 ${targetModel} 不健康`);
      }

      const previousModel = this.currentActiveModels.get(groupId);
      
      // 切换到目标模型
      this.currentActiveModels.set(groupId, targetModel);
      
      // 记录切换事件
      await this.recordFailoverEvent(groupId, previousModel || 'unknown', targetModel, 'manual_switch', true);
      
      // 缓存新的活跃模型
      const { cacheManager } = await import('@/lib/cache');
      await cacheManager.set(`active_model:${groupId}`, targetModel, 300);
      
      console.log(`成功切换模型: ${previousModel} -> ${targetModel}`);
      return true;
      
    } catch (error) {
      console.error(`模型切换失败:`, error);
      await this.recordFailoverEvent(groupId, 'unknown', targetModel, 'manual_switch', false, (error as Error).message);
      return false;
    }
  }

  /**
   * 模型健康检查 - 使用HealthChecker实例
   */
  private async checkModelHealth(modelId: string, groupId?: string): Promise<boolean> {
    try {
      // 导入并使用HealthChecker
      const { healthChecker } = await import('@/lib/enterprise/health-checker');
      const healthResult = await healthChecker.checkModelHealth(modelId, groupId);
      
      // 健康检查通过条件：分数 >= 50 且当前状态健康
      return healthResult.isHealthy && healthResult.score >= 50;
      
    } catch (error) {
      console.warn(`模型健康检查失败 ${modelId}:`, error);
      return false;
    }
  }

  /**
   * 获取当前活跃模型状态
   */
  getActiveModelStatus(groupId: string): {
    activeModel: string;
    availableModels: string[];
    failoverHistory: ModelFailoverEvent[];
  } {
    const activeModel = this.currentActiveModels.get(groupId) || 'unknown';
    const modelConfig = this.modelConfigs.get(groupId);
    
    return {
      activeModel,
      availableModels: modelConfig ? [
        modelConfig.primaryModel,
        ...modelConfig.fallbackModels
      ] : [],
      failoverHistory: [] // 从数据库获取
    };
  }

  /**
   * 设置Claude多模型路由
   */
  private async setupClaudeMultiModel(groupId: string, config: any): Promise<void> {
    // 设置Claude多模型路由配置
    const multiModelConfig: MultiModelRoutingConfig = {
      strategy: 'priority',
      failoverEnabled: true,
      healthCheckInterval: 60000,
      maxRetries: 3,
      timeout: 30000,
      primaryModel: 'claude-4-sonnet',
      fallbackModels: ['claude-4-opus', 'kimi-k2', 'glm-4.5', 'qwen-max'],
      failoverTrigger: config.failoverTrigger || 'automatic',
      healthCheckThreshold: config.healthThreshold || 80,
      failbackEnabled: config.failbackEnabled !== false
    };
    
    this.modelConfigs.set(groupId, multiModelConfig);
    
    // 设置初始活跃模型
    this.currentActiveModels.set(groupId, multiModelConfig.primaryModel);
    
    // 设置模型路由
    const routes: EnhancedServiceRoute[] = [
      // 主模型
      {
        serviceId: 'claude-4-sonnet',
        serviceName: 'Claude 4 Sonnet',
        priority: 1,
        isEnabled: true,
        healthScore: 100,
        responseTime: 0,
        errorRate: 0,
        lastHealthCheck: new Date(),
        modelType: 'primary',
        modelCategory: 'claude_native',
        modelName: 'claude-3.5-sonnet-20241022',
        failoverPriority: 1,
        supportedFeatures: ['chat', 'code', 'analysis'],
        baseUrl: 'https://api.anthropic.com'
      },
      {
        serviceId: 'claude-4-opus',
        serviceName: 'Claude 4 Opus',
        priority: 2,
        isEnabled: true,
        healthScore: 100,
        responseTime: 0,
        errorRate: 0,
        lastHealthCheck: new Date(),
        modelType: 'primary',
        modelCategory: 'claude_native',
        modelName: 'claude-3-opus-20240229',
        failoverPriority: 2,
        supportedFeatures: ['chat', 'code', 'analysis'],
        baseUrl: 'https://api.anthropic.com'
      },
      // 备用模型
      {
        serviceId: 'kimi-k2',
        serviceName: 'Kimi K2',
        priority: 3,
        isEnabled: true,
        healthScore: 100,
        responseTime: 0,
        errorRate: 0,
        lastHealthCheck: new Date(),
        modelType: 'fallback',
        modelCategory: 'claude_fallback',
        modelName: 'moonshot-v1-128k',
        failoverPriority: 3,
        supportedFeatures: ['chat', 'long-context', 'code'],
        baseUrl: 'https://api.moonshot.cn'
      },
      {
        serviceId: 'glm-4.5',
        serviceName: 'GLM 4.5',
        priority: 4,
        isEnabled: true,
        healthScore: 100,
        responseTime: 0,
        errorRate: 0,
        lastHealthCheck: new Date(),
        modelType: 'fallback',
        modelCategory: 'claude_fallback',
        modelName: 'glm-4-plus',
        failoverPriority: 4,
        supportedFeatures: ['chat', 'chinese', 'code'],
        baseUrl: 'https://open.bigmodel.cn'
      },
      {
        serviceId: 'qwen-max',
        serviceName: 'Qwen Max',
        priority: 5,
        isEnabled: true,
        healthScore: 100,
        responseTime: 0,
        errorRate: 0,
        lastHealthCheck: new Date(),
        modelType: 'fallback',
        modelCategory: 'claude_fallback',
        modelName: 'qwen-max',
        failoverPriority: 5,
        supportedFeatures: ['chat', 'code', 'analysis'],
        baseUrl: 'https://dashscope.aliyuncs.com'
      }
    ];
    
    this.modelRoutes.set(groupId, routes);
    
    // 缓存路由配置
    await cacheManager.set(`enhanced_routes:${groupId}`, {
      config: multiModelConfig,
      routes,
      activeModel: multiModelConfig.primaryModel
    }, 300);
  }

  /**
   * 发送请求到指定模型
   */
  private async sendToModel(
    groupId: string, 
    modelId: string, 
    request: ChatRequest
  ): Promise<ChatResponse> {
    // 根据模型ID创建对应的服务实例并发送请求
    const service = await this.createModelService(modelId);
    return await service.chat(request);
  }

  /**
   * 创建模型服务实例
   */
  private async createModelService(modelId: string) {
    const modelMap: Record<string, { service: SupportedAIService, config: any }> = {
      'claude-4-sonnet': { 
        service: 'claude', 
        config: { model: 'claude-3.5-sonnet-20241022' }
      },
      'claude-4-opus': { 
        service: 'claude', 
        config: { model: 'claude-3-opus-20240229' }
      },
      'kimi-k2': { 
        service: 'kimi', 
        config: { model: 'moonshot-v1-128k' }
      },
      'glm-4.5': { 
        service: 'zhipu', 
        config: { model: 'glm-4-plus' }
      },
      'qwen-max': { 
        service: 'qwen', 
        config: { model: 'qwen-max' }
      }
    };

    const modelInfo = modelMap[modelId];
    if (!modelInfo) {
      throw new Error(`不支持的模型: ${modelId}`);
    }

    // 获取API密钥
    const apiKeyEnv = `${modelInfo.service.toUpperCase()}_API_KEY`;
    const apiKey = process.env[apiKeyEnv];
    if (!apiKey) {
      throw new Error(`缺少API密钥: ${apiKeyEnv}`);
    }

    // 创建对应的服务实例
    const serviceConfig: AIServiceConfig = {
      apiKey,
      baseUrl: this.getServiceBaseUrl(modelInfo.service),
      ...modelInfo.config
    };

    return AIServiceFactory.create(modelInfo.service, serviceConfig);
  }

  /**
   * 获取服务基础URL
   */
  private getServiceBaseUrl(service: SupportedAIService): string {
    const serviceUrls: Record<SupportedAIService, string> = {
      'claude': 'https://api.anthropic.com',
      'gemini': 'https://generativelanguage.googleapis.com',
      'kimi': 'https://api.moonshot.cn',
      'zhipu': 'https://open.bigmodel.cn',
      'qwen': 'https://dashscope.aliyuncs.com',
      'ampcode': 'https://api.ampcode.com'
    };
    return serviceUrls[service];
  }

  /**
   * 获取模型优先级
   */
  private getModelPriority(modelId: string): number {
    const priorities: Record<string, number> = {
      'claude-4-sonnet': 1,
      'claude-4-opus': 2,
      'kimi-k2': 3,
      'glm-4.5': 4,
      'qwen-max': 5
    };
    return priorities[modelId] || 999;
  }

  /**
   * 获取组的模型配置
   */
  private async getGroupModelConfig(groupId: string): Promise<any> {
    try {
      // 尝试从数据库获取模型配置
      const modelConfig = await prisma.modelConfiguration?.findFirst({
        where: { groupId }
      });
      
      if (modelConfig) {
        return modelConfig;
      }
      
      // 如果没有找到，返回默认配置
      return {
        serviceType: 'claude_code',
        failoverTrigger: 'automatic',
        healthThreshold: 80,
        failbackEnabled: true
      };
    } catch (error) {
      // 如果表不存在，返回默认配置
      console.warn('Model configuration table not found, using default config');
      return {
        serviceType: 'claude_code',
        failoverTrigger: 'automatic',
        healthThreshold: 80,
        failbackEnabled: true
      };
    }
  }

  /**
   * 记录故障转移事件
   */
  private async recordFailoverEvent(
    groupId: string, 
    fromModel: string, 
    toModel: string,
    reason: 'automatic_failover' | 'manual_switch' | 'maintenance',
    success: boolean,
    errorMessage?: string,
    responseTime?: number
  ): Promise<void> {
    try {
      // 尝试记录到数据库
      await prisma.modelFailoverLog?.create({
        data: {
          groupId,
          fromModel,
          toModel,
          reason,
          success,
          errorMsg: errorMessage,
          responseTime,
          timestamp: new Date()
        }
      });
    } catch (error) {
      // 如果表不存在，只记录到日志
      console.log(`Failover event: ${groupId} ${fromModel} -> ${toModel} (${reason}) success: ${success}`);
      if (errorMessage) {
        console.log(`Error: ${errorMessage}`);
      }
    }
  }
}
import { prisma } from '@/lib/prisma';
import { cacheManager } from '@/lib/cache';

export interface HealthCheckResult {
  modelId: string;
  isHealthy: boolean;
  responseTime: number;
  errorRate: number;
  lastChecked: Date;
  score: number;
  details?: {
    endpoint: string;
    statusCode?: number;
    errorMessage?: string;
    successfulRequests: number;
    totalRequests: number;
  };
}

export interface PerformanceMetrics {
  modelId: string;
  metricType: 'response_time' | 'success_rate' | 'error_rate' | 'health_score';
  value: number;
  unit: string;
  windowStart: Date;
  windowEnd: Date;
  sampleCount: number;
}

export class HealthChecker {
  private unhealthyModels = new Set<string>();
  private healthScores = new Map<string, number>();
  private performanceMetrics = new Map<string, PerformanceMetrics[]>();
  
  // 健康检查间隔（毫秒）
  private readonly HEALTH_CHECK_INTERVAL = 60000; // 1分钟
  private readonly PERFORMANCE_WINDOW = 300000; // 5分钟性能窗口
  
  constructor() {
    this.startHealthCheckScheduler();
    this.startPerformanceMetricsCollector();
  }

  /**
   * 检查单个模型的健康状态
   */
  async checkModelHealth(modelId: string, groupId?: string): Promise<HealthCheckResult> {
    const startTime = Date.now();
    let isHealthy = false;
    let statusCode: number | undefined;
    let errorMessage: string | undefined;

    try {
      // 从缓存获取历史性能数据
      const recentMetrics = await this.getRecentPerformanceMetrics(modelId);
      const successRate = this.calculateSuccessRate(recentMetrics);
      const avgResponseTime = this.calculateAverageResponseTime(recentMetrics);
      
      // 发送健康检查请求
      const healthCheckResult = await this.performHealthCheckRequest(modelId);
      
      isHealthy = healthCheckResult.success;
      statusCode = healthCheckResult.statusCode;
      errorMessage = healthCheckResult.errorMessage;
      
      const responseTime = Date.now() - startTime;
      
      // 计算健康分数 (0-100)
      const score = this.calculateHealthScore({
        responseTime,
        successRate,
        avgResponseTime,
        isCurrentRequestSuccessful: isHealthy
      });
      
      // 更新健康分数缓存
      this.healthScores.set(modelId, score);
      await cacheManager.setAccountHealthScore(modelId, score);
      
      // 更新模型状态
      if (isHealthy) {
        this.unhealthyModels.delete(modelId);
      } else {
        this.unhealthyModels.add(modelId);
        // 30秒后重新检查
        setTimeout(() => this.recheckModel(modelId), 30000);
      }

      const result: HealthCheckResult = {
        modelId,
        isHealthy,
        responseTime,
        errorRate: 100 - successRate,
        lastChecked: new Date(),
        score,
        details: {
          endpoint: this.getModelEndpoint(modelId),
          statusCode,
          errorMessage,
          successfulRequests: Math.floor(successRate * recentMetrics.length / 100),
          totalRequests: recentMetrics.length
        }
      };

      // 记录到数据库（异步）
      this.recordHealthCheckResult(groupId, result).catch(console.error);
      
      return result;
      
    } catch (error: any) {
      const responseTime = Date.now() - startTime;
      
      // 标记为不健康
      this.unhealthyModels.add(modelId);
      this.healthScores.set(modelId, 0);
      await cacheManager.setAccountHealthScore(modelId, 0);
      
      return {
        modelId,
        isHealthy: false,
        responseTime,
        errorRate: 100,
        lastChecked: new Date(),
        score: 0,
        details: {
          endpoint: this.getModelEndpoint(modelId),
          errorMessage: error.message,
          successfulRequests: 0,
          totalRequests: 1
        }
      };
    }
  }

  /**
   * 批量检查多个模型的健康状态
   */
  async checkMultipleModels(modelIds: string[], groupId?: string): Promise<HealthCheckResult[]> {
    const promises = modelIds.map(modelId => this.checkModelHealth(modelId, groupId));
    return Promise.all(promises);
  }

  /**
   * 获取模型健康分数
   */
  async getModelHealthScore(modelId: string): Promise<number> {
    // 优先从缓存获取
    const cachedScore = await cacheManager.getAccountHealthScore(modelId);
    if (cachedScore !== null) {
      return cachedScore;
    }
    
    // 如果缓存中没有，从内存获取
    return this.healthScores.get(modelId) || 100;
  }

  /**
   * 获取模型性能指标
   */
  async getPerformanceMetrics(
    modelId: string, 
    metricType?: 'response_time' | 'success_rate' | 'error_rate' | 'health_score',
    timeRange: string = '1h'
  ): Promise<PerformanceMetrics[]> {
    try {
      const timeRangeMap = {
        '1h': 1 * 60 * 60 * 1000,
        '6h': 6 * 60 * 60 * 1000,
        '24h': 24 * 60 * 60 * 1000,
        '7d': 7 * 24 * 60 * 60 * 1000,
      };

      const timeRangeMs = timeRangeMap[timeRange as keyof typeof timeRangeMap] || timeRangeMap['1h'];
      const startTime = new Date(Date.now() - timeRangeMs);

      const whereCondition: any = {
        modelId,
        windowStart: { gte: startTime },
      };

      if (metricType) {
        whereCondition.metricType = metricType;
      }

      const metrics = await prisma.modelPerformanceMetric.findMany({
        where: whereCondition,
        orderBy: { windowStart: 'desc' },
        take: 100,
      });

      return metrics.map(metric => ({
        modelId: metric.modelId,
        metricType: metric.metricType as any,
        value: Number(metric.value),
        unit: metric.unit,
        windowStart: metric.windowStart,
        windowEnd: metric.windowEnd,
        sampleCount: metric.sampleCount,
      }));
      
    } catch (error) {
      console.error('Get performance metrics error:', error);
      return [];
    }
  }

  /**
   * 启动健康检查调度器
   */
  private startHealthCheckScheduler(): void {
    setInterval(async () => {
      try {
        // 获取需要监控的模型列表
        const modelsToCheck = await this.getModelsToMonitor();
        
        // 并发执行健康检查
        const promises = modelsToCheck.map(async (model) => {
          try {
            await this.checkModelHealth(model.modelId, model.groupId);
          } catch (error) {
            console.error(`Health check failed for model ${model.modelId}:`, error);
          }
        });
        
        await Promise.allSettled(promises);
        
        console.log(`Completed health check for ${modelsToCheck.length} models`);
        
      } catch (error) {
        console.error('Health check scheduler error:', error);
      }
    }, this.HEALTH_CHECK_INTERVAL);
  }

  /**
   * 启动性能指标收集器
   */
  private startPerformanceMetricsCollector(): void {
    setInterval(async () => {
      try {
        await this.collectAndStorePerformanceMetrics();
      } catch (error) {
        console.error('Performance metrics collection error:', error);
      }
    }, this.PERFORMANCE_WINDOW);
  }

  /**
   * 执行健康检查请求
   */
  private async performHealthCheckRequest(modelId: string): Promise<{
    success: boolean;
    statusCode?: number;
    errorMessage?: string;
  }> {
    try {
      const endpoint = this.getModelEndpoint(modelId);
      
      // 构建健康检查请求
      const healthCheckPayload = this.buildHealthCheckPayload(modelId);
      const headers = this.buildHeaders(modelId);
      
      if (!headers) {
        return {
          success: false,
          statusCode: 401,
          errorMessage: 'Missing API key for model'
        };
      }
      
      // 发送真实的HTTP请求
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10秒超时
      
      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers,
          body: JSON.stringify(healthCheckPayload),
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (response.ok) {
          return {
            success: true,
            statusCode: response.status
          };
        } else {
          const errorText = await response.text().catch(() => 'Unknown error');
          return {
            success: false,
            statusCode: response.status,
            errorMessage: `HTTP ${response.status}: ${errorText}`
          };
        }
        
      } catch (fetchError: any) {
        clearTimeout(timeoutId);
        
        if (fetchError.name === 'AbortError') {
          return {
            success: false,
            statusCode: 408,
            errorMessage: 'Health check timeout'
          };
        }
        
        return {
          success: false,
          errorMessage: fetchError.message
        };
      }
      
    } catch (error: any) {
      return {
        success: false,
        errorMessage: error.message
      };
    }
  }
  
  /**
   * 构建健康检查请求负载
   */
  private buildHealthCheckPayload(modelId: string): any {
    const basePayload = {
      max_tokens: 10,
      temperature: 0
    };
    
    if (modelId.includes('claude')) {
      return {
        ...basePayload,
        model: this.getActualModelName(modelId),
        messages: [{ role: 'user', content: 'ping' }]
      };
    } else if (modelId.includes('kimi')) {
      return {
        ...basePayload,
        model: 'moonshot-v1-8k',
        messages: [{ role: 'user', content: 'ping' }]
      };
    } else if (modelId.includes('glm')) {
      return {
        ...basePayload,
        model: 'glm-4',
        messages: [{ role: 'user', content: 'ping' }]
      };
    } else if (modelId.includes('qwen')) {
      return {
        model: 'qwen-max',
        input: {
          messages: [{ role: 'user', content: 'ping' }]
        },
        parameters: {
          max_tokens: 10
        }
      };
    }
    
    return basePayload;
  }
  
  /**
   * 构建请求头
   */
  private buildHeaders(modelId: string): Record<string, string> | null {
    const commonHeaders = {
      'Content-Type': 'application/json',
      'User-Agent': 'AiCarpool-HealthChecker/1.0'
    };
    
    if (modelId.includes('claude')) {
      const apiKey = process.env.CLAUDE_API_KEY;
      if (!apiKey) return null;
      
      return {
        ...commonHeaders,
        'Authorization': `Bearer ${apiKey}`,
        'anthropic-version': '2023-06-01'
      };
    } else if (modelId.includes('kimi')) {
      const apiKey = process.env.KIMI_API_KEY;
      if (!apiKey) return null;
      
      return {
        ...commonHeaders,
        'Authorization': `Bearer ${apiKey}`
      };
    } else if (modelId.includes('glm')) {
      const apiKey = process.env.ZHIPU_API_KEY;
      if (!apiKey) return null;
      
      return {
        ...commonHeaders,
        'Authorization': `Bearer ${apiKey}`
      };
    } else if (modelId.includes('qwen')) {
      const apiKey = process.env.QWEN_API_KEY;
      if (!apiKey) return null;
      
      return {
        ...commonHeaders,
        'Authorization': `Bearer ${apiKey}`
      };
    }
    
    return commonHeaders;
  }
  
  /**
   * 获取实际模型名称
   */
  private getActualModelName(modelId: string): string {
    const modelMap: Record<string, string> = {
      'claude-4-sonnet': 'claude-3-5-sonnet-20241022',
      'claude-4-opus': 'claude-3-opus-20240229',
      'kimi-k2': 'moonshot-v1-128k',
      'glm-4.5': 'glm-4-plus',
      'qwen-max': 'qwen-max'
    };
    
    return modelMap[modelId] || modelId;
  }

  /**
   * 计算健康分数
   */
  private calculateHealthScore(metrics: {
    responseTime: number;
    successRate: number;
    avgResponseTime: number;
    isCurrentRequestSuccessful: boolean;
  }): number {
    let score = 100;
    
    // 当前请求失败扣分
    if (!metrics.isCurrentRequestSuccessful) {
      score -= 30;
    }
    
    // 响应时间评分（超过5秒开始扣分）
    if (metrics.responseTime > 5000) {
      score -= Math.min(30, (metrics.responseTime - 5000) / 1000 * 5);
    }
    
    // 成功率评分
    if (metrics.successRate < 95) {
      score -= (95 - metrics.successRate) * 2;
    }
    
    // 平均响应时间评分
    if (metrics.avgResponseTime > 3000) {
      score -= Math.min(20, (metrics.avgResponseTime - 3000) / 1000 * 3);
    }
    
    return Math.max(0, Math.min(100, score));
  }

  /**
   * 获取最近的性能指标
   */
  private async getRecentPerformanceMetrics(modelId: string): Promise<any[]> {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    
    try {
      const recentRequests = await prisma.enhancedUsageStat.findMany({
        where: {
          aiServiceId: modelId,
          requestTime: { gte: fiveMinutesAgo }
        },
        select: {
          status: true,
          responseTime: true,
          requestTime: true
        },
        orderBy: { requestTime: 'desc' },
        take: 100
      });
      
      return recentRequests;
    } catch (error) {
      // 如果表不存在或查询失败，返回空数组
      console.warn('Could not fetch recent metrics:', error);
      return [];
    }
  }

  /**
   * 计算成功率
   */
  private calculateSuccessRate(metrics: any[]): number {
    if (metrics.length === 0) return 100;
    
    const successfulRequests = metrics.filter(m => m.status === 'success').length;
    return (successfulRequests / metrics.length) * 100;
  }

  /**
   * 计算平均响应时间
   */
  private calculateAverageResponseTime(metrics: any[]): number {
    if (metrics.length === 0) return 0;
    
    const totalResponseTime = metrics.reduce((sum, m) => sum + (m.responseTime || 0), 0);
    return totalResponseTime / metrics.length;
  }

  /**
   * 获取需要监控的模型列表
   */
  private async getModelsToMonitor(): Promise<Array<{ modelId: string; groupId: string }>> {
    try {
      const activeConfigurations = await prisma.modelConfiguration.findMany({
        where: { isEnabled: true },
        select: {
          groupId: true,
          primaryModel: true,
          fallbackModels: true
        }
      });

      const modelsToCheck: Array<{ modelId: string; groupId: string }> = [];

      activeConfigurations.forEach(config => {
        // 添加主模型
        modelsToCheck.push({
          modelId: config.primaryModel,
          groupId: config.groupId
        });

        // 添加备用模型
        if (Array.isArray(config.fallbackModels)) {
          config.fallbackModels.forEach((fallbackModel: string) => {
            modelsToCheck.push({
              modelId: fallbackModel,
              groupId: config.groupId
            });
          });
        }
      });

      return modelsToCheck;
      
    } catch (error) {
      console.warn('Could not get models to monitor:', error);
      return [
        // 默认监控的模型
        { modelId: 'claude-4-sonnet', groupId: 'default' },
        { modelId: 'claude-4-opus', groupId: 'default' },
        { modelId: 'kimi-k2', groupId: 'default' },
        { modelId: 'glm-4.5', groupId: 'default' },
        { modelId: 'qwen-max', groupId: 'default' }
      ];
    }
  }

  /**
   * 获取模型端点
   */
  private getModelEndpoint(modelId: string): string {
    const endpointMap: Record<string, string> = {
      'claude-4-sonnet': 'https://api.anthropic.com/v1/messages',
      'claude-4-opus': 'https://api.anthropic.com/v1/messages',
      'kimi-k2': 'https://api.moonshot.cn/v1/chat/completions',
      'glm-4.5': 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
      'qwen-max': 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation'
    };
    
    return endpointMap[modelId] || 'unknown';
  }

  /**
   * 重新检查模型
   */
  private async recheckModel(modelId: string): Promise<void> {
    try {
      const result = await this.checkModelHealth(modelId);
      if (result.isHealthy) {
        console.log(`Model ${modelId} recovered`);
      }
    } catch (error) {
      console.error(`Recheck failed for model ${modelId}:`, error);
    }
  }

  /**
   * 记录健康检查结果
   */
  private async recordHealthCheckResult(groupId: string | undefined, result: HealthCheckResult): Promise<void> {
    try {
      if (!groupId) return;

      // 记录性能指标
      const now = new Date();
      const windowStart = new Date(now.getTime() - this.PERFORMANCE_WINDOW);

      await prisma.modelPerformanceMetric.create({
        data: {
          groupId,
          modelId: result.modelId,
          metricType: 'health_score',
          value: result.score,
          unit: 'score',
          windowStart,
          windowEnd: now,
          sampleCount: 1,
          tags: {
            isHealthy: result.isHealthy,
            responseTime: result.responseTime,
            errorRate: result.errorRate
          }
        }
      });

      // 记录响应时间指标
      await prisma.modelPerformanceMetric.create({
        data: {
          groupId,
          modelId: result.modelId,
          metricType: 'response_time',
          value: result.responseTime,
          unit: 'ms',
          windowStart,
          windowEnd: now,
          sampleCount: 1
        }
      });

    } catch (error) {
      console.warn('Could not record health check result:', error);
    }
  }

  /**
   * 收集并存储性能指标
   */
  private async collectAndStorePerformanceMetrics(): Promise<void> {
    try {
      const modelsToCheck = await this.getModelsToMonitor();
      
      for (const model of modelsToCheck) {
        const recentMetrics = await this.getRecentPerformanceMetrics(model.modelId);
        
        if (recentMetrics.length > 0) {
          const successRate = this.calculateSuccessRate(recentMetrics);
          const avgResponseTime = this.calculateAverageResponseTime(recentMetrics);
          const errorRate = 100 - successRate;
          
          const now = new Date();
          const windowStart = new Date(now.getTime() - this.PERFORMANCE_WINDOW);
          
          // 存储聚合的性能指标
          await Promise.all([
            prisma.modelPerformanceMetric.create({
              data: {
                groupId: model.groupId,
                modelId: model.modelId,
                metricType: 'success_rate',
                value: successRate,
                unit: 'percent',
                windowStart,
                windowEnd: now,
                sampleCount: recentMetrics.length
              }
            }),
            prisma.modelPerformanceMetric.create({
              data: {
                groupId: model.groupId,
                modelId: model.modelId,
                metricType: 'response_time',
                value: avgResponseTime,
                unit: 'ms',
                windowStart,
                windowEnd: now,
                sampleCount: recentMetrics.length
              }
            }),
            prisma.modelPerformanceMetric.create({
              data: {
                groupId: model.groupId,
                modelId: model.modelId,
                metricType: 'error_rate',
                value: errorRate,
                unit: 'percent',
                windowStart,
                windowEnd: now,
                sampleCount: recentMetrics.length
              }
            })
          ]);
        }
      }
      
    } catch (error) {
      console.warn('Could not collect performance metrics:', error);
    }
  }
}

// 创建单例健康检查器
export const healthChecker = new HealthChecker();
export default healthChecker;
/**
 * 优化的SmartAiRouter - 高并发性能优化版本
 * v2.7 高并发优化 - 缓存集成、异步处理、预计算账号池
 */

import { PrismaClient, ServiceType, AuthType } from '@prisma/client';
import { cacheService, ResourceBindingConfig, PreComputedAccountPool } from '../cache/cache-service';
import { usageQueueProcessor, UsageRecord } from '../queue/usage-queue-processor';
import { LoadBalancer, LoadBalanceAccount, LoadBalanceStrategy } from './load-balancer';

const prisma = new PrismaClient();

// 功能开关配置
const OptimizationFlags = {
  ENABLE_CACHE_OPTIMIZATION: process.env.ENABLE_SMART_ROUTER_OPTIMIZATION !== 'false',
  ENABLE_PRECOMPUTED_ACCOUNT_POOL: process.env.ENABLE_PRECOMPUTED_ACCOUNT_POOL !== 'false',
  ENABLE_ASYNC_USAGE_RECORDING: process.env.ENABLE_ASYNC_USAGE_RECORDING !== 'false',
  ENABLE_PARALLEL_PROCESSING: process.env.ENABLE_PARALLEL_PROCESSING !== 'false',
  FALLBACK_TO_ORIGINAL: process.env.FALLBACK_TO_ORIGINAL_ROUTER === 'true',
} as const;

// 请求接口定义
export interface AiRequest {
  messages: {
    role: 'user' | 'assistant' | 'system';
    content: string;
  }[];
  serviceType?: 'claude' | 'gemini' | 'openai' | 'qwen';
  model?: string;
  maxTokens?: number;
  temperature?: number;
  stream?: boolean;
  apiKeyId?: string; // 添加API Key追踪
}

export interface AiResponse {
  message: {
    role: 'assistant';
    content: string;
  };
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  cost: number;
  accountUsed: {
    id: string;
    name: string;
    serviceType: string;
  };
  metadata?: any;
  performance?: {
    routingTime: number;
    executionTime: number;
    cacheHit: boolean;
    dbQueries: number;
  };
}

// 使用Prisma生成的类型
type AiServiceAccount = {
  id: string;
  name: string;
  serviceType: ServiceType;
  authType: AuthType;
  encryptedCredentials: string;
  apiEndpoint?: string | null;
  proxyType?: string | null;
  proxyHost?: string | null;
  proxyPort?: number | null;
  proxyUsername?: string | null;
  proxyPassword?: string | null;
  supportedModels: any; // JSON type from Prisma
  currentModel?: string | null;
  costPerToken: any; // Decimal type from Prisma
  currentLoad: number;
  isEnabled: boolean;
  status: string;
  totalRequests: any; // BigInt type from Prisma
  description?: string | null;
  accountType: string;
  dailyLimit: number;
  totalTokens: any; // BigInt type from Prisma
  totalCost: any; // Decimal type from Prisma
  lastUsedAt?: Date | null;
  errorMessage?: string | null;
  createdAt: Date;
  updatedAt: Date;
  enterpriseId: string;
  ownerType: string;
  maxConcurrentGroups: number;
  platformConfig?: any; // JSON type
  region?: string | null;
  endpointUrl?: string | null;
  modelVersion?: string | null;
  rateLimitConfig?: any; // JSON type
  headerConfig?: any; // JSON type
  timeout?: number | null;
  oauthAccessToken?: string | null;
  oauthRefreshToken?: string | null;
  oauthExpiresAt?: Date | null;
  oauthScopes?: string | null;
};

// 临时AI服务客户端类（实际应该从AI服务适配器中导入）
class AiServiceClient {
  constructor(private account: AiServiceAccount) {}

  async executeRequest(request: AiRequest): Promise<AiResponse> {
    // 模拟AI请求执行
    const delay = Math.random() * 1000 + 500; // 500-1500ms
    await new Promise(resolve => setTimeout(resolve, delay));

    const promptTokens = request.messages.reduce((acc, msg) => acc + msg.content.length, 0) / 4;
    const completionTokens = Math.floor(Math.random() * 500) + 100;
    const totalTokens = promptTokens + completionTokens;

    return {
      message: {
        role: 'assistant',
        content: `Mock response from ${this.account.name} for ${request.serviceType} service`
      },
      usage: {
        promptTokens: Math.floor(promptTokens),
        completionTokens,
        totalTokens: Math.floor(totalTokens)
      },
      cost: totalTokens * Number(this.account.costPerToken),
      accountUsed: {
        id: this.account.id,
        name: this.account.name,
        serviceType: this.account.serviceType
      }
    };
  }

  async healthCheck(): Promise<{ isHealthy: boolean; responseTime: number; error?: string }> {
    const startTime = Date.now();
    const isHealthy = Math.random() > 0.1; // 90%健康率
    const responseTime = Date.now() - startTime + Math.random() * 100;
    
    return {
      isHealthy,
      responseTime,
      error: isHealthy ? undefined : 'Health check failed'
    };
  }
}

/**
 * 优化的SmartAiRouter类
 */
export class OptimizedSmartAiRouter {
  private loadBalancer: LoadBalancer;
  private accountClients: Map<string, AiServiceClient> = new Map();

  constructor() {
    this.loadBalancer = new LoadBalancer();
  }

  /**
   * 优化的智能路由方法 - 主入口
   */
  async routeRequestOptimized(groupId: string, request: AiRequest): Promise<AiResponse> {
    const startTime = Date.now();
    let cacheHit = false;
    let dbQueries = 0;

    try {
      console.log(`🎯 OptimizedSmartAiRouter: 处理拼车组 ${groupId} 的AI请求`);

      // 检查是否启用优化
      if (!OptimizationFlags.ENABLE_CACHE_OPTIMIZATION || OptimizationFlags.FALLBACK_TO_ORIGINAL) {
        console.log('⚠️ 优化已禁用，使用原始路由逻辑');
        return this.routeRequestOriginal(groupId, request);
      }

      // 1. 并行获取缓存数据（最关键的优化点）
      const [binding, quotaValid, accountPool] = await Promise.all([
        this.getGroupBindingOptimized(groupId),
        this.checkQuotaOptimized(groupId, request),
        this.getAccountPoolOptimized(request.serviceType || 'claude')
      ]);

      // 更新缓存命中状态
      cacheHit = !!(binding && accountPool);

      // 2. 快速配额检查
      if (!quotaValid.isValid) {
        throw new Error(quotaValid.error || '配额检查失败');
      }

      // 3. 基于预计算结果选择账号
      const account = await this.selectOptimalAccountOptimized(binding, accountPool, request);
      if (!account) {
        throw new Error('暂无可用的AI账号');
      }

      console.log(`🔄 OptimizedSmartAiRouter: 选择账号 ${account.name} (负载: ${account.currentLoad}%)`);

      // 4. 执行AI请求
      const executionStartTime = Date.now();
      const response = await this.executeAiRequestOptimized(account, request);
      const executionTime = Date.now() - executionStartTime;

      // 5. 异步记录使用统计（不阻塞响应）
      if (OptimizationFlags.ENABLE_ASYNC_USAGE_RECORDING) {
        this.recordUsageAsync(groupId, account.id, request, response);
      }

      // 6. 异步更新缓存统计
      this.updateCacheAsync(groupId, account.id, response);

      const totalTime = Date.now() - startTime;
      console.log(`✅ OptimizedSmartAiRouter: 请求完成 ${totalTime}ms (路由:${totalTime - executionTime}ms, 执行:${executionTime}ms)`);

      // 添加性能指标
      response.performance = {
        routingTime: totalTime - executionTime,
        executionTime,
        cacheHit,
        dbQueries
      };

      return response;

    } catch (error) {
      const totalTime = Date.now() - startTime;
      console.error(`❌ OptimizedSmartAiRouter: 路由失败 (${totalTime}ms):`, error);
      throw error;
    }
  }

  /**
   * 优化的资源绑定获取
   */
  private async getGroupBindingOptimized(groupId: string): Promise<ResourceBindingConfig | null> {
    try {
      // 1. 尝试从缓存获取
      let binding = await cacheService.getGroupBinding(groupId);
      
      if (binding) {
        console.log(`✅ 资源绑定缓存命中: ${groupId}`);
        return binding;
      }

      // 2. 缓存未命中，查询数据库
      console.log(`🔍 资源绑定缓存未命中，查询数据库: ${groupId}`);
      const group = await prisma.group.findUnique({
        where: { id: groupId },
        include: {
          resourceBinding: true,
          accountBindings: {
            include: {
              account: {
                select: {
                  id: true,
                  serviceType: true,
                }
              }
            }
          }
        }
      });

      if (!group || !group.resourceBinding) {
        return null;
      }

      // 转换为缓存格式
      const bindingConfig: ResourceBindingConfig = {
        mode: group.resourceBinding.bindingMode as 'dedicated' | 'shared' | 'hybrid',
        dedicatedAccounts: group.accountBindings?.map(binding => ({
          accountId: binding.account.id,
          serviceType: binding.account.serviceType,
          priority: 1 // 默认优先级
        })) || [],
        sharedPools: [] // 暂时禁用池绑定
      };

      // 异步设置缓存
      setImmediate(() => {
        cacheService.setGroupBinding(groupId, bindingConfig).catch(error => {
          console.error('设置资源绑定缓存失败:', error);
        });
      });

      return bindingConfig;

    } catch (error) {
      console.error('获取资源绑定失败:', error);
      return null;
    }
  }

  /**
   * 优化的配额检查
   */
  private async checkQuotaOptimized(groupId: string, request: AiRequest): Promise<{
    isValid: boolean;
    error?: string;
  }> {
    try {
      // 1. 尝试从缓存获取每日配额
      const today = new Date().toISOString().split('T')[0];
      const dailyQuota = await cacheService.getDailyQuota(groupId, today);

      if (dailyQuota) {
        // 简单检查缓存中的配额
        if (dailyQuota.used >= dailyQuota.limit) {
          return {
            isValid: false,
            error: '已达到每日使用量限制'
          };
        }
        return { isValid: true };
      }

      // 2. 缓存未命中，查询数据库
      const binding = await prisma.groupResourceBinding.findUnique({
        where: { groupId }
      });

      if (!binding) {
        return { isValid: true }; // 无限制
      }

      // 简化的配额检查，避免复杂聚合查询
      return { isValid: true };

    } catch (error) {
      console.error('配额检查失败:', error);
      return {
        isValid: false,
        error: '配额检查失败'
      };
    }
  }

  /**
   * 优化的账号池获取
   */
  private async getAccountPoolOptimized(serviceType: string): Promise<PreComputedAccountPool | null> {
    try {
      if (!OptimizationFlags.ENABLE_PRECOMPUTED_ACCOUNT_POOL) {
        return null;
      }

      // 1. 尝试从缓存获取预计算账号池
      let accountPool = await cacheService.getAccountPool(serviceType);
      
      if (accountPool) {
        console.log(`✅ 账号池缓存命中: ${serviceType} (v${accountPool.version})`);
        
        // 检查数据是否过于陈旧
        const age = (Date.now() - accountPool.lastUpdate) / 1000;
        if (age < 60) { // 1分钟内的数据认为是新鲜的
          return accountPool;
        }
      }

      // 2. 缓存未命中或数据过旧，查询数据库并计算
      console.log(`🔍 重新计算账号池: ${serviceType}`);
      const accounts = await prisma.aiServiceAccount.findMany({
        where: {
          serviceType: serviceType as ServiceType,
          isEnabled: true,
          status: 'active'
        },
        select: {
          id: true,
          name: true,
          serviceType: true,
          currentLoad: true,
          totalRequests: true,
          lastUsedAt: true
        }
      });

      if (accounts.length === 0) {
        return null;
      }

      // 计算账号评分
      const now = Date.now();
      const computedAccounts = accounts.map(account => {
        const lastUsedAge = account.lastUsedAt 
          ? (now - account.lastUsedAt.getTime()) / 1000 / 60 // 分钟
          : 999999;
        
        // 综合评分算法
        let score = 100;
        score -= account.currentLoad * 0.5; // 负载影响
        score -= Math.min(lastUsedAge / 60, 50); // 最近使用时间影响
        score = Math.max(0, Math.min(100, score));

        return {
          id: account.id,
          name: account.name,
          serviceType: account.serviceType,
          currentLoad: account.currentLoad,
          priority: 1,
          isHealthy: true, // 简化处理，假设都健康
          score
        };
      }).sort((a, b) => b.score - a.score); // 按评分降序排列

      accountPool = {
        serviceType,
        accounts: computedAccounts,
        lastUpdate: now,
        version: (accountPool?.version || 0) + 1
      };

      // 异步设置缓存
      setImmediate(() => {
        cacheService.setAccountPool(serviceType, accountPool!).catch(error => {
          console.error('设置账号池缓存失败:', error);
        });
      });

      return accountPool;

    } catch (error) {
      console.error('获取账号池失败:', error);
      return null;
    }
  }

  /**
   * 优化的账号选择
   */
  private async selectOptimalAccountOptimized(
    binding: ResourceBindingConfig | null,
    accountPool: PreComputedAccountPool | null,
    request: AiRequest
  ): Promise<AiServiceAccount | null> {
    try {
      const serviceType = request.serviceType || 'claude';

      // 1. 如果有预计算账号池，优先使用
      if (accountPool && OptimizationFlags.ENABLE_PRECOMPUTED_ACCOUNT_POOL) {
        const candidates = accountPool.accounts.filter(acc => acc.score > 50); // 评分阈值
        
        if (candidates.length > 0) {
          const selectedAccount = candidates[0]; // 选择评分最高的
          
          // 获取完整账号信息
          const fullAccount = await prisma.aiServiceAccount.findUnique({
            where: { id: selectedAccount.id }
          });
          
          if (fullAccount && fullAccount.isEnabled) {
            console.log(`🎯 从预计算池选择账号: ${fullAccount.name} (评分: ${selectedAccount.score})`);
            return fullAccount;
          }
        }
      }

      // 2. 回退到传统选择方式（简化版）
      console.log(`🔄 回退到传统账号选择: ${serviceType}`);
      const fallbackAccounts = await prisma.aiServiceAccount.findMany({
        where: {
          serviceType,
          isEnabled: true,
          status: 'active',
          currentLoad: { lt: 80 } // 负载小于80%
        },
        orderBy: {
          currentLoad: 'asc' // 按负载升序
        },
        take: 1
      });

      return fallbackAccounts[0] || null;

    } catch (error) {
      console.error('选择最佳账号失败:', error);
      return null;
    }
  }

  /**
   * 优化的AI请求执行
   */
  private async executeAiRequestOptimized(account: AiServiceAccount, request: AiRequest): Promise<AiResponse> {
    try {
      // 1. 获取或创建AI服务客户端
      let client = this.accountClients.get(account.id);
      if (!client) {
        client = new AiServiceClient(account);
        this.accountClients.set(account.id, client);
      }

      // 2. 执行AI请求
      const response = await client.executeRequest(request);

      // 3. 异步更新账号负载（不阻塞响应）
      setImmediate(() => {
        this.updateAccountLoadAsync(account.id, response).catch(error => {
          console.error('更新账号负载失败:', error);
        });
      });

      return response;

    } catch (error) {
      console.error('执行AI请求失败:', error);
      throw error;
    }
  }

  /**
   * 异步记录使用统计
   */
  private recordUsageAsync(
    groupId: string,
    accountId: string,
    request: AiRequest,
    response: AiResponse
  ): void {
    try {
      const usageRecord: UsageRecord = {
        groupId,
        userId: 'system', // TODO: 从上下文获取真实用户ID
        accountId,
        apiKeyId: request.apiKeyId,
        serviceType: request.serviceType || 'claude',
        modelName: request.model || 'default',
        requestType: 'chat',
        requestTokens: response.usage.promptTokens,
        responseTokens: response.usage.completionTokens,
        totalTokens: response.usage.totalTokens,
        cost: response.cost,
        requestTime: Date.now(),
        responseTime: response.performance?.executionTime || 0,
        metadata: {
          apiKeyName: request.apiKeyId ? `key_${request.apiKeyId.substring(0, 8)}` : undefined,
          userAgent: 'cli-client', // TODO: 从请求头获取
          clientVersion: '1.0.0'
        }
      };

      // 发送到异步队列
      usageQueueProcessor.addUsageRecord(usageRecord).catch(error => {
        console.error('发送使用记录到队列失败:', error);
      });

      console.log(`📊 使用记录已发送到异步队列: ${response.usage.totalTokens} tokens, $${response.cost}`);

    } catch (error) {
      console.error('创建使用记录失败:', error);
    }
  }

  /**
   * 异步更新缓存统计
   */
  private updateCacheAsync(groupId: string, accountId: string, response: AiResponse): void {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      // 更新每日配额缓存
      cacheService.getDailyQuota(groupId, today).then(async (existing) => {
        const newUsed = (existing?.used || 0) + response.cost;
        const limit = existing?.limit || 1000;
        
        await cacheService.setDailyQuota(groupId, newUsed, limit, today);
      }).catch(error => {
        console.error('更新每日配额缓存失败:', error);
      });

      // 使账号池缓存（触发重新计算）
      const serviceType = response.accountUsed.serviceType;
      cacheService.getAccountPool(serviceType).then(async (pool) => {
        if (pool) {
          // 触发重新计算
          const age = (Date.now() - pool.lastUpdate) / 1000;
          if (age > 30) { // 30秒后触发更新
            this.getAccountPoolOptimized(serviceType);
          }
        }
      }).catch(error => {
        console.error('检查账号池缓存失败:', error);
      });

    } catch (error) {
      console.error('更新缓存统计失败:', error);
    }
  }

  /**
   * 异步更新账号负载
   */
  private async updateAccountLoadAsync(accountId: string, response: AiResponse): Promise<void> {
    try {
      // 计算负载增量（基于响应时间和Token数量）
      const executionTime = response.performance?.executionTime || 1000;
      const loadIncrement = Math.min(10, Math.max(1, Math.floor(executionTime / 200))); // 1-10%

      await prisma.aiServiceAccount.update({
        where: { id: accountId },
        data: {
          currentLoad: {
            increment: loadIncrement
          },
          lastUsedAt: new Date(),
          totalRequests: { increment: 1 },
          totalTokens: { increment: response.usage.totalTokens },
          totalCost: { increment: response.cost }
        }
      });

      // 定时减少负载（模拟负载恢复）
      setTimeout(async () => {
        try {
          await prisma.aiServiceAccount.update({
            where: { id: accountId },
            data: {
              currentLoad: {
                decrement: Math.min(loadIncrement, 5)
              }
            }
          });
        } catch (error) {
          console.error('减少账号负载失败:', error);
        }
      }, 60000); // 1分钟后减少负载

      console.log(`📈 账号负载已更新: ${accountId} (+${loadIncrement}%)`);

    } catch (error) {
      console.error('更新账号负载失败:', error);
    }
  }

  /**
   * 原始路由方法（回退选项）
   */
  private async routeRequestOriginal(groupId: string, request: AiRequest): Promise<AiResponse> {
    // TODO: 实现原始路由逻辑
    throw new Error('原始路由方法未实现');
  }

  /**
   * 获取路由性能统计
   */
  async getRoutingStats(): Promise<{
    totalRequests: number;
    avgRoutingTime: number;
    cacheHitRate: number;
    avgDbQueries: number;
    accountPoolVersion: { [serviceType: string]: number };
  }> {
    try {
      // TODO: 实现性能统计收集
      const accountPools = await Promise.all([
        cacheService.getAccountPool('claude'),
        cacheService.getAccountPool('openai'),
        cacheService.getAccountPool('gemini'),
        cacheService.getAccountPool('qwen')
      ]);

      const accountPoolVersion: { [serviceType: string]: number } = {};
      accountPools.forEach(pool => {
        if (pool) {
          accountPoolVersion[pool.serviceType] = pool.version;
        }
      });

      return {
        totalRequests: 0,
        avgRoutingTime: 0,
        cacheHitRate: 0,
        avgDbQueries: 0,
        accountPoolVersion
      };

    } catch (error) {
      console.error('获取路由统计失败:', error);
      return {
        totalRequests: 0,
        avgRoutingTime: 0,
        cacheHitRate: 0,
        avgDbQueries: 0,
        accountPoolVersion: {}
      };
    }
  }

  /**
   * 手动刷新账号池缓存
   */
  async refreshAccountPools(): Promise<void> {
    try {
      const serviceTypes = ['claude', 'openai', 'gemini', 'qwen'];
      
      const refreshPromises = serviceTypes.map(async (serviceType) => {
        try {
          await this.getAccountPoolOptimized(serviceType);
          console.log(`✅ 账号池已刷新: ${serviceType}`);
        } catch (error) {
          console.error(`刷新账号池失败 ${serviceType}:`, error);
        }
      });

      await Promise.allSettled(refreshPromises);
      console.log(`🔄 所有账号池刷新完成`);

    } catch (error) {
      console.error('批量刷新账号池失败:', error);
    }
  }
}

// 导出优化版本的路由器
export const optimizedSmartAiRouter = new OptimizedSmartAiRouter();
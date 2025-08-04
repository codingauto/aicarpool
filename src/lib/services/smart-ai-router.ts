/**
 * SmartAiRouter - 智能AI服务路由器
 * 
 * 核心功能：
 * 1. 统一的AI服务调用接口
 * 2. 三种资源绑定模式支持（专属、共享、混合）
 * 3. 负载均衡和故障转移
 * 4. 使用量统计和成本计算
 */

import { PrismaClient } from '@prisma/client';
// 暂时注释掉，将使用新的适配器架构  
// import { AiServiceClient, AiServiceAccount } from '@/lib/ai-services/client';

// 临时接口定义，之后会迁移到新架构
interface AiServiceAccount {
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
import { LoadBalancer, LoadBalanceAccount, LoadBalanceStrategy } from '@/lib/services/load-balancer';

const prisma = new PrismaClient();

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
}

// 资源绑定配置接口
export interface ResourceBindingConfig {
  mode: 'dedicated' | 'shared' | 'hybrid';
  
  // 专属模式配置
  dedicatedAccounts?: {
    accountId: string;
    serviceType: string;
    priority: number;
  }[];
  
  // 共享模式配置
  sharedPools?: {
    serviceType: string;
    priority: number;
    maxUsagePercent: number;
  }[];
  
  // 混合模式配置
  hybridConfig?: {
    primaryAccounts: string[];
    fallbackPools: string[];
  };
}

export class SmartAiRouter {
  private loadBalancer: LoadBalancer;
  private accountClients: Map<string, AiServiceClient> = new Map();
  private accountLoads: Map<string, number> = new Map();
  private lastHealthCheck: Map<string, number> = new Map();
  private failoverHistory: Map<string, number> = new Map();

  constructor() {
    this.loadBalancer = new LoadBalancer();
  }

  /**
   * 智能路由AI请求到最佳账号（支持重试和故障转移）
   */
  async routeRequest(groupId: string, request: AiRequest): Promise<AiResponse> {
    console.log(`🎯 SmartAiRouter: 处理拼车组 ${groupId} 的AI请求`);
    
    const maxRetries = 3;
    const retryDelay = 1000; // 1秒
    let lastError: any;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // 1. 获取拼车组资源绑定配置
        const binding = await this.getGroupResourceBinding(groupId);
        if (!binding) {
          throw new Error(`拼车组 ${groupId} 没有配置资源绑定`);
        }

        // 2. 检查使用配额
        await this.checkUsageQuota(groupId, request);

        // 3. 选择最佳账号（每次重试都重新选择）
        const account = await this.selectOptimalAccount(binding, request);
        if (!account) {
          throw new Error('暂无可用的AI账号');
        }

        console.log(`🔄 SmartAiRouter: 尝试 ${attempt}/${maxRetries} - 使用账号 ${account.name}`);

        // 4. 执行AI请求
        const response = await this.executeAiRequest(account, request);

        // 5. 记录使用统计
        await this.recordUsage(groupId, account.id, request, response);

        console.log(`✅ SmartAiRouter: 成功使用账号 ${account.name} 处理请求 (尝试 ${attempt}/${maxRetries})`);
        return response;

      } catch (error) {
        lastError = error;
        
        console.error(`❌ SmartAiRouter: 尝试 ${attempt}/${maxRetries} 失败:`, error);

        // 记录故障转移历史
        this.failoverHistory.set(`${groupId}_${Date.now()}`, attempt);

        // 如果不是最后一次尝试，等待后重试
        if (attempt < maxRetries) {
          console.log(`⏱️  SmartAiRouter: ${retryDelay * attempt}ms 后重试...`);
          await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
          
          // 清理可能失效的客户端缓存
          if (error instanceof Error && error.message.includes('API')) {
            this.accountClients.clear();
          }
        }
      }
    }

    // 所有重试都失败了
    console.error(`💥 SmartAiRouter: 所有重试都失败了，拼车组 ${groupId}`);
    throw new Error(`AI服务暂时不可用，已尝试 ${maxRetries} 次: ${lastError?.message || '未知错误'}`);
  }

  /**
   * 获取拼车组资源绑定配置
   */
  private async getGroupResourceBinding(groupId: string): Promise<ResourceBindingConfig | null> {
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      include: {
        resourceBinding: true,
        accountBindings: {
          include: {
            account: true
          }
        },
        poolBindings: {
          include: {
            pool: {
              include: {
                accountBindings: {
                  include: {
                    account: true
                  }
                }
              }
            }
          }
        }
      }
    });

    if (!group || !group.resourceBinding) {
      return null;
    }

    const bindingConfig = group.resourceBinding.bindingConfig as any;
    
    return {
      mode: group.resourceBinding.bindingMode as 'dedicated' | 'shared' | 'hybrid',
      ...bindingConfig
    };
  }

  /**
   * 检查使用配额
   */
  private async checkUsageQuota(groupId: string, request: AiRequest): Promise<void> {
    const binding = await prisma.groupResourceBinding.findUnique({
      where: { groupId }
    });

    if (!binding) return;

    // 检查日使用量限制
    const today = new Date().toISOString().split('T')[0];
    const todayUsage = await prisma.usageStat.aggregate({
      _sum: {
        totalTokens: true
      },
      where: {
        groupId,
        requestTime: {
          gte: new Date(today)
        }
      }
    });

    const dailyUsed = Number(todayUsage._sum.totalTokens || 0);
    if (dailyUsed >= binding.dailyTokenLimit) {
      throw new Error('已达到每日使用量限制');
    }

    // 检查月预算限制
    if (binding.monthlyBudget) {
      const thisMonth = new Date().toISOString().substring(0, 7);
      const monthlyUsage = await prisma.usageStat.aggregate({
        _sum: {
          cost: true
        },
        where: {
          groupId,
          requestTime: {
            gte: new Date(thisMonth + '-01')
          }
        }
      });

      const monthlyUsed = Number(monthlyUsage._sum.cost || 0);
      if (monthlyUsed >= Number(binding.monthlyBudget)) {
        throw new Error('已达到月预算限制');
      }
    }
  }

  /**
   * 根据绑定模式选择最佳账号
   */
  private async selectOptimalAccount(
    binding: ResourceBindingConfig,
    request: AiRequest
  ): Promise<any> {
    switch (binding.mode) {
      case 'dedicated':
        return this.selectDedicatedAccount(binding.dedicatedAccounts || [], request);
      
      case 'shared':
        return this.selectFromSharedPool(binding.sharedPools || [], request);
      
      case 'hybrid':
        // 优先使用专属账号，不可用时切换到共享池
        try {
          return await this.selectDedicatedAccount(
            (binding.hybridConfig?.primaryAccounts || []).map(id => ({
              accountId: id,
              serviceType: request.serviceType || 'claude',
              priority: 1
            })),
            request
          );
        } catch (error) {
          console.log('专属账号不可用，切换到共享池');
          // 这里应该根据fallbackPools选择共享池账号
          // 简化处理，使用默认共享配置
          return this.selectFromSharedPool([{
            serviceType: request.serviceType || 'claude',
            priority: 1,
            maxUsagePercent: 80
          }], request);
        }
      
      default:
        throw new Error(`不支持的绑定模式: ${binding.mode}`);
    }
  }

  /**
   * 从专属账号中选择
   */
  private async selectDedicatedAccount(
    accounts: { accountId: string; serviceType: string; priority: number }[],
    request: AiRequest
  ): Promise<AiServiceAccount> {
    // 筛选符合服务类型的账号
    const serviceType = request.serviceType || 'claude';
    const candidateConfigs = accounts.filter(acc => acc.serviceType === serviceType);
    
    if (candidateConfigs.length === 0) {
      throw new Error(`没有可用的 ${serviceType} 专属账号`);
    }

    // 获取完整的账号信息
    const accountIds = candidateConfigs.map(acc => acc.accountId);
    const candidateAccounts = await prisma.aiServiceAccount.findMany({
      where: { 
        id: { in: accountIds },
        isEnabled: true 
      }
    });

    if (candidateAccounts.length === 0) {
      throw new Error('所有专属账号都已禁用');
    }

    // 转换为负载均衡器格式
    const loadBalanceAccounts: LoadBalanceAccount[] = candidateAccounts.map(account => {
      const config = candidateConfigs.find(c => c.accountId === account.id);
      return {
        id: account.id,
        name: account.name,
        serviceType: account.serviceType,
        currentLoad: account.currentLoad,
        isEnabled: account.isEnabled,
        status: account.status,
        priority: config?.priority || 999,
        totalRequests: Number(account.totalRequests)
      };
    });

    // 使用负载均衡器选择最佳账号
    const selectedAccount = this.loadBalancer.selectAccount(
      this.loadBalancer.sortByPriority(loadBalanceAccounts),
      'least_connections'
    );

    if (!selectedAccount) {
      throw new Error('所有专属账号都不可用');
    }

    // 返回完整的账号对象
    const fullAccount = candidateAccounts.find(acc => acc.id === selectedAccount.id);
    if (!fullAccount) {
      throw new Error('账号数据不一致');
    }

    return fullAccount;
  }

  /**
   * 从共享池中选择账号
   */
  private async selectFromSharedPool(
    poolConfigs: { serviceType: string; priority: number; maxUsagePercent: number }[],
    request: AiRequest
  ): Promise<AiServiceAccount> {
    const serviceType = request.serviceType || 'claude';
    const targetConfig = poolConfigs.find(config => config.serviceType === serviceType);
    
    if (!targetConfig) {
      throw new Error(`没有配置 ${serviceType} 服务的共享池`);
    }

    // 查找可用的共享账号
    const availableAccounts = await prisma.aiServiceAccount.findMany({
      where: {
        serviceType: serviceType,
        isEnabled: true,
        status: 'active',
        accountType: 'shared',
        currentLoad: { lt: targetConfig.maxUsagePercent }
      }
    });

    if (availableAccounts.length === 0) {
      throw new Error(`共享池中没有可用的 ${serviceType} 账号`);
    }

    // 转换为负载均衡器格式
    const loadBalanceAccounts: LoadBalanceAccount[] = availableAccounts.map(account => ({
      id: account.id,
      name: account.name,
      serviceType: account.serviceType,
      currentLoad: account.currentLoad,
      isEnabled: account.isEnabled,
      status: account.status,
      priority: targetConfig.priority,
      totalRequests: Number(account.totalRequests)
    }));

    // 使用负载均衡器选择最佳账号
    const strategy = this.loadBalancer.getRecommendedStrategy(loadBalanceAccounts);
    const selectedAccount = this.loadBalancer.selectAccount(loadBalanceAccounts, strategy);

    if (!selectedAccount) {
      throw new Error('共享池中没有可用账号');
    }

    // 最终健康检查
    const isHealthy = await this.isAccountHealthy(selectedAccount.id);
    if (!isHealthy) {
      // 如果选中的账号不健康，尝试其他账号
      const otherAccounts = loadBalanceAccounts.filter(acc => acc.id !== selectedAccount.id);
      for (const account of otherAccounts) {
        if (await this.isAccountHealthy(account.id)) {
          const fullAccount = availableAccounts.find(acc => acc.id === account.id);
          if (fullAccount) return fullAccount;
        }
      }
      throw new Error('共享池中所有账号都不健康');
    }

    // 返回完整的账号对象
    const fullAccount = availableAccounts.find(acc => acc.id === selectedAccount.id);
    if (!fullAccount) {
      throw new Error('账号数据不一致');
    }

    return fullAccount;
  }

  /**
   * 检查账号健康状态
   */
  private async isAccountHealthy(accountId: string): Promise<boolean> {
    const lastCheck = this.lastHealthCheck.get(accountId) || 0;
    const now = Date.now();
    
    // 如果最近检查过（5分钟内），使用缓存结果
    if (now - lastCheck < 5 * 60 * 1000) {
      // 检查最近的健康检查记录
      const lastHealthCheck = await prisma.accountHealthCheck.findFirst({
        where: { accountId },
        orderBy: { checkedAt: 'desc' }
      });
      
      return lastHealthCheck?.isHealthy ?? true;
    }

    try {
      // 获取账号信息
      const account = await prisma.aiServiceAccount.findUnique({
        where: { id: accountId }
      });

      if (!account || !account.isEnabled || account.status !== 'active') {
        return false;
      }

      // 执行真实的健康检查
      let client = this.accountClients.get(accountId);
      if (!client) {
        client = new AiServiceClient(account);
        this.accountClients.set(accountId, client);
      }

      const healthResult = await client.healthCheck();
      this.lastHealthCheck.set(accountId, now);
      
      // 记录健康检查结果
      await prisma.accountHealthCheck.create({
        data: {
          accountId,
          isHealthy: healthResult.isHealthy,
          responseTime: healthResult.responseTime,
          errorMessage: healthResult.error,
          checkedAt: new Date()
        }
      });

      // 更新账号状态
      if (!healthResult.isHealthy) {
        await prisma.aiServiceAccount.update({
          where: { id: accountId },
          data: {
            status: 'error',
            errorMessage: healthResult.error
          }
        });
      } else if (account.status === 'error') {
        await prisma.aiServiceAccount.update({
          where: { id: accountId },
          data: {
            status: 'active',
            errorMessage: null
          }
        });
      }
      
      return healthResult.isHealthy;
    } catch (error) {
      console.error(`账号 ${accountId} 健康检查失败:`, error);
      
      await prisma.accountHealthCheck.create({
        data: {
          accountId,
          isHealthy: false,
          errorMessage: error instanceof Error ? error.message : String(error),
          checkedAt: new Date()
        }
      });
      
      return false;
    }
  }

  /**
   * 执行AI请求
   */
  private async executeAiRequest(account: AiServiceAccount, request: AiRequest): Promise<AiResponse> {
    const startTime = Date.now();
    
    try {
      // 获取或创建AI服务客户端
      let client = this.accountClients.get(account.id);
      if (!client) {
        client = new AiServiceClient(account);
        this.accountClients.set(account.id, client);
      }

      // 执行AI请求
      const response = await client.executeRequest(request);
      const responseTime = Date.now() - startTime;

      // 更新账号负载和统计信息
      await this.updateAccountMetrics(account.id, response, responseTime, true);

      console.log(`✅ AI请求成功: 账号 ${account.name}, 响应时间 ${responseTime}ms, 成本 ${response.cost}`);
      return response;

    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      // 更新账号状态为错误
      await this.updateAccountMetrics(account.id, null, responseTime, false, error);
      
      console.error(`❌ AI请求失败: 账号 ${account.name}, 响应时间 ${responseTime}ms, 错误: ${error}`);
      throw error;
    }
  }

  /**
   * 更新账号指标和统计信息
   */
  private async updateAccountMetrics(
    accountId: string, 
    response: AiResponse | null, 
    responseTime: number, 
    success: boolean,
    error?: any
  ): Promise<void> {
    try {
      if (success && response) {
        // 成功请求：更新负载和统计
        const loadIncrement = Math.max(1, Math.floor(responseTime / 100)); // 基于响应时间计算负载增量
        
        await prisma.aiServiceAccount.update({
          where: { id: accountId },
          data: {
            currentLoad: {
              increment: Math.min(loadIncrement, 10) // 最多增加10%负载
            },
            lastUsedAt: new Date(),
            totalRequests: { increment: 1 },
            totalTokens: { increment: response.usage.totalTokens },
            totalCost: { increment: response.cost },
            status: 'active',
            errorMessage: null
          }
        });
      } else {
        // 失败请求：标记错误状态
        const errorMessage = error instanceof Error ? error.message : String(error);
        
        await prisma.aiServiceAccount.update({
          where: { id: accountId },
          data: {
            status: 'error',
            errorMessage: errorMessage.substring(0, 500), // 限制错误消息长度
            totalRequests: { increment: 1 } // 仍然计入总请求数
          }
        });
      }

      // 缓存中更新负载
      if (success) {
        const currentLoad = this.accountLoads.get(accountId) || 0;
        this.accountLoads.set(accountId, Math.min(100, currentLoad + 5));
        
        // 定时减少负载
        setTimeout(() => {
          const load = this.accountLoads.get(accountId) || 0;
          this.accountLoads.set(accountId, Math.max(0, load - 5));
        }, 60000); // 1分钟后减少负载
      }

    } catch (updateError) {
      console.error(`Failed to update account metrics for ${accountId}:`, updateError);
    }
  }

  /**
   * 记录使用统计
   */
  private async recordUsage(
    groupId: string,
    accountId: string,
    request: AiRequest,
    response: AiResponse
  ): Promise<void> {
    await prisma.usageStat.create({
      data: {
        userId: 'system', // 暂时使用系统用户，实际应该传入用户ID
        groupId,
        accountId,
        aiServiceId: response.accountUsed.serviceType,
        requestType: 'chat',
        requestTokens: response.usage.promptTokens,
        responseTokens: response.usage.completionTokens,
        totalTokens: BigInt(response.usage.totalTokens),
        cost: response.cost,
        requestTime: new Date(),
        responseTime: Math.floor(Math.random() * 2000), // 模拟响应时间
        status: 'success'
      }
    });
  }

  /**
   * 获取拼车组当前状态
   */
  async getGroupStatus(groupId: string): Promise<any> {
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      include: {
        resourceBinding: true,
        accountBindings: {
          include: {
            account: true
          }
        },
        poolBindings: {
          include: {
            pool: {
              include: {
                accountBindings: {
                  include: {
                    account: true
                  }
                }
              }
            }
          }
        }
      }
    });

    if (!group) {
      throw new Error(`拼车组 ${groupId} 不存在`);
    }

    // 计算今日使用统计
    const today = new Date().toISOString().split('T')[0];
    const todayUsage = await prisma.usageStat.aggregate({
      _sum: {
        totalTokens: true,
        cost: true
      },
      _count: true,
      where: {
        groupId,
        requestTime: {
          gte: new Date(today)
        }
      }
    });

    return {
      group: {
        id: group.id,
        name: group.name,
        bindingMode: group.resourceBinding?.bindingMode,
        dailyLimit: group.resourceBinding?.dailyTokenLimit,
        monthlyBudget: group.resourceBinding?.monthlyBudget
      },
      usage: {
        todayTokens: Number(todayUsage._sum.totalTokens || 0),
        todayCost: Number(todayUsage._sum.cost || 0),
        todayRequests: todayUsage._count
      },
      accounts: group.accountBindings.map(binding => ({
        id: binding.account.id,
        name: binding.account.name,
        serviceType: binding.account.serviceType,
        currentLoad: binding.account.currentLoad,
        status: binding.account.status
      }))
    };
  }
}

export default SmartAiRouter;
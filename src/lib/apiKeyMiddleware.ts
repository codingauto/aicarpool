/**
 * API Key 中间件 - 处理配额和速率限制检查
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface RateLimit {
  windowMinutes: number;
  maxRequests: number;
  maxTokens: number;
}

interface ApiKeyMetadata {
  rateLimit: RateLimit;
  servicePermissions: string[];
  resourceBinding: string;
  dailyCostLimit?: number;
  createdBy: string;
}

interface ApiKeyValidationResult {
  isValid: boolean;
  apiKey?: any;
  error?: string;
  remainingQuota?: number;
  rateLimitStatus?: {
    requestsRemaining: number;
    tokensRemaining: number;
    resetTime: Date;
  };
}

/**
 * 验证和检查API Key
 */
export async function validateApiKey(keyValue: string): Promise<ApiKeyValidationResult> {
  try {
    // 查找API Key
    const apiKey = await prisma.apiKey.findFirst({
      where: {
        key: keyValue,
        status: 'active'
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        group: {
          select: {
            id: true,
            name: true,
            status: true
          }
        }
      }
    });

    if (!apiKey) {
      return {
        isValid: false,
        error: 'API Key 不存在或已禁用'
      };
    }

    // 检查过期时间
    if (apiKey.expiresAt && new Date() > apiKey.expiresAt) {
      return {
        isValid: false,
        error: 'API Key 已过期'
      };
    }

    // 检查拼车组状态
    if (apiKey.group.status !== 'active') {
      return {
        isValid: false,
        error: '拼车组不可用'
      };
    }

    const metadata = apiKey.metadata as ApiKeyMetadata;
    
    // 检查配额限制
    const quotaCheck = await checkQuotaLimit(apiKey, metadata);
    if (!quotaCheck.isValid) {
      return quotaCheck;
    }

    // 检查速率限制
    const rateLimitCheck = await checkRateLimit(apiKey, metadata);
    if (!rateLimitCheck.isValid) {
      return rateLimitCheck;
    }

    // 更新最后使用时间
    await prisma.apiKey.update({
      where: { id: apiKey.id },
      data: { lastUsedAt: new Date() }
    });

    return {
      isValid: true,
      apiKey,
      remainingQuota: quotaCheck.remainingQuota,
      rateLimitStatus: rateLimitCheck.rateLimitStatus
    };

  } catch (error) {
    console.error('API Key 验证失败:', error);
    return {
      isValid: false,
      error: 'API Key 验证失败'
    };
  }
}

/**
 * 检查配额限制
 */
async function checkQuotaLimit(apiKey: any, metadata: ApiKeyMetadata): Promise<ApiKeyValidationResult> {
  try {
    // 检查每日费用限制
    if (metadata.dailyCostLimit) {
      const today = new Date().toISOString().split('T')[0];
      
      // 计算今日使用费用
      const todayUsage = await prisma.usageStat.aggregate({
        _sum: {
          cost: true
        },
        where: {
          groupId: apiKey.groupId,
          // TODO: 添加API Key追踪字段
          requestTime: {
            gte: new Date(today)
          }
        }
      });

      const todayCost = Number(todayUsage._sum.cost || 0);
      const dailyLimit = metadata.dailyCostLimit;
      
      if (todayCost >= dailyLimit) {
        return {
          isValid: false,
          error: `已达到每日费用限制 $${dailyLimit}`
        };
      }

      return {
        isValid: true,
        remainingQuota: dailyLimit - todayCost
      };
    }

    // 检查Token配额限制
    if (apiKey.quotaLimit) {
      const quotaUsed = Number(apiKey.quotaUsed);
      const quotaLimit = Number(apiKey.quotaLimit);
      
      if (quotaUsed >= quotaLimit) {
        return {
          isValid: false,
          error: '已达到配额限制'
        };
      }

      return {
        isValid: true,
        remainingQuota: quotaLimit - quotaUsed
      };
    }

    return { isValid: true };

  } catch (error) {
    console.error('检查配额限制失败:', error);
    return {
      isValid: false,
      error: '配额检查失败'
    };
  }
}

/**
 * 检查速率限制
 */
async function checkRateLimit(apiKey: any, metadata: ApiKeyMetadata): Promise<ApiKeyValidationResult> {
  try {
    if (!metadata.rateLimit) {
      return { isValid: true };
    }

    const { windowMinutes, maxRequests, maxTokens } = metadata.rateLimit;
    const windowStart = new Date(Date.now() - windowMinutes * 60 * 1000);

    // 查询时间窗口内的使用量
    const windowUsage = await prisma.usageStat.aggregate({
      _sum: {
        totalTokens: true
      },
      _count: true,
      where: {
        groupId: apiKey.groupId,
        // TODO: 添加API Key追踪字段
        requestTime: {
          gte: windowStart
        }
      }
    });

    const requestCount = windowUsage._count;
    const tokenCount = Number(windowUsage._sum.totalTokens || 0);

    // 检查请求数限制
    if (requestCount >= maxRequests) {
      const resetTime = new Date(Date.now() + windowMinutes * 60 * 1000);
      return {
        isValid: false,
        error: `请求频率过高，请在 ${windowMinutes} 分钟后重试`,
        rateLimitStatus: {
          requestsRemaining: 0,
          tokensRemaining: Math.max(0, maxTokens - tokenCount),
          resetTime
        }
      };
    }

    // 检查Token数限制
    if (tokenCount >= maxTokens) {
      const resetTime = new Date(Date.now() + windowMinutes * 60 * 1000);
      return {
        isValid: false,
        error: `Token使用量过高，请在 ${windowMinutes} 分钟后重试`,
        rateLimitStatus: {
          requestsRemaining: Math.max(0, maxRequests - requestCount),
          tokensRemaining: 0,
          resetTime
        }
      };
    }

    return {
      isValid: true,
      rateLimitStatus: {
        requestsRemaining: maxRequests - requestCount,
        tokensRemaining: maxTokens - tokenCount,
        resetTime: new Date(Date.now() + windowMinutes * 60 * 1000)
      }
    };

  } catch (error) {
    console.error('检查速率限制失败:', error);
    return {
      isValid: false,
      error: '速率限制检查失败'
    };
  }
}

/**
 * 记录API使用统计
 */
export async function recordApiUsage(
  apiKey: any,
  serviceType: string,
  modelName: string,
  tokens: number,
  cost: number
): Promise<void> {
  try {
    // 创建使用统计记录
    await prisma.usageStat.create({
      data: {
        groupId: apiKey.groupId,
        userId: apiKey.userId,
        serviceType,
        modelName,
        totalTokens: BigInt(tokens),
        cost,
        requestTime: new Date(),
        // TODO: 添加API Key ID关联
        metadata: {
          apiKeyId: apiKey.id,
          apiKeyName: apiKey.name
        }
      }
    });

    // 更新API Key使用量
    if (apiKey.quotaLimit) {
      await prisma.apiKey.update({
        where: { id: apiKey.id },
        data: {
          quotaUsed: {
            increment: BigInt(tokens)
          }
        }
      });
    }

    console.log(`📊 记录API使用: ${apiKey.name} 使用了 ${tokens} tokens，费用 $${cost}`);

  } catch (error) {
    console.error('记录API使用统计失败:', error);
  }
}

/**
 * 检查服务权限
 */
export function checkServicePermission(metadata: ApiKeyMetadata, serviceType: string): boolean {
  if (!metadata.servicePermissions || metadata.servicePermissions.length === 0) {
    return true; // 默认允许所有服务
  }

  const permissions = metadata.servicePermissions;
  
  // 检查是否有全部服务权限
  if (permissions.includes('all')) {
    return true;
  }

  // 检查特定服务权限
  const normalizedServiceType = serviceType.toLowerCase();
  return permissions.some(permission => 
    permission.toLowerCase() === normalizedServiceType ||
    normalizedServiceType.includes(permission.toLowerCase())
  );
}
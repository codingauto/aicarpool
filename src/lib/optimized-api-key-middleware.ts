/**
 * 优化的API Key中间件 - 集成缓存机制
 * v2.7 高并发优化 - 大幅减少数据库查询，提升验证性能
 */

import { PrismaClient } from '@prisma/client';
import { cacheService, CachedApiKey, QuotaInfo, RateInfo } from './cache/cache-service';

const prisma = new PrismaClient();

// 功能开关配置
const FeatureFlags = {
  ENABLE_API_KEY_CACHE: process.env.ENABLE_API_KEY_CACHE !== 'false', // 默认启用
  ENABLE_QUOTA_CACHE: process.env.ENABLE_QUOTA_CACHE !== 'false',
  ENABLE_RATE_LIMIT_CACHE: process.env.ENABLE_RATE_LIMIT_CACHE !== 'false',
  CACHE_FALLBACK_TO_DB: process.env.CACHE_FALLBACK_TO_DB !== 'false', // 缓存失败时回退到数据库
} as const;

interface RateLimit {
  windowMinutes: number;
  maxRequests: number;
  maxTokens: number;
}

interface ApiKeyMetadata {
  rateLimit?: RateLimit;
  servicePermissions?: string[];
  resourceBinding?: string;
  dailyCostLimit?: number;
  createdBy: string;
}

export interface ApiKeyValidationResult {
  isValid: boolean;
  apiKey?: CachedApiKey;
  error?: string;
  remainingQuota?: number;
  rateLimitStatus?: {
    requestsRemaining: number;
    tokensRemaining: number;
    resetTime: Date;
  };
  performance?: {
    validationTime: number;
    cacheHit: boolean;
    dbQueries: number;
  };
}

/**
 * 优化的API Key验证函数 - 主入口
 */
export async function validateApiKeyOptimized(keyValue: string): Promise<ApiKeyValidationResult> {
  const startTime = Date.now();
  let cacheHit = false;
  let dbQueries = 0;

  try {
    console.log(`🔍 开始验证API Key: ${keyValue.substring(0, 12)}...`);

    // 1. 尝试从缓存获取API Key信息
    let cachedApiKey: CachedApiKey | null = null;
    
    if (FeatureFlags.ENABLE_API_KEY_CACHE) {
      cachedApiKey = await cacheService.getApiKey(keyValue);
      cacheHit = !!cachedApiKey;
      
      if (cachedApiKey) {
        console.log(`✅ API Key缓存命中: ${keyValue.substring(0, 12)}...`);
      }
    }

    // 2. 缓存未命中，从数据库查询
    if (!cachedApiKey) {
      if (FeatureFlags.CACHE_FALLBACK_TO_DB) {
        console.log(`🔍 缓存未命中，查询数据库: ${keyValue.substring(0, 12)}...`);
        cachedApiKey = await getApiKeyFromDatabase(keyValue);
        dbQueries++;
        
        if (cachedApiKey && FeatureFlags.ENABLE_API_KEY_CACHE) {
          // 异步设置缓存，不阻塞请求
          setImmediate(() => {
            cacheService.setApiKey(keyValue, cachedApiKey!).catch(error => {
              console.error('设置API Key缓存失败:', error);
            });
          });
        }
      } else {
        return {
          isValid: false,
          error: '缓存服务不可用，API Key验证失败',
          performance: {
            validationTime: Date.now() - startTime,
            cacheHit: false,
            dbQueries: 0
          }
        };
      }
    }

    // 3. API Key不存在
    if (!cachedApiKey) {
      return {
        isValid: false,
        error: 'API Key不存在或已禁用',
        performance: {
          validationTime: Date.now() - startTime,
          cacheHit,
          dbQueries
        }
      };
    }

    // 4. 基础状态检查
    const basicValidation = validateBasicStatus(cachedApiKey);
    if (!basicValidation.isValid) {
      return {
        ...basicValidation,
        performance: {
          validationTime: Date.now() - startTime,
          cacheHit,
          dbQueries
        }
      };
    }

    // 5. 配额检查（优先使用缓存）
    const quotaResult = await checkQuotaOptimized(cachedApiKey);
    if (!quotaResult.isValid) {
      return {
        ...quotaResult,
        performance: {
          validationTime: Date.now() - startTime,
          cacheHit,
          dbQueries: dbQueries + quotaResult.dbQueries
        }
      };
    }

    // 6. 速率限制检查（优先使用缓存）
    const rateLimitResult = await checkRateLimitOptimized(cachedApiKey);
    if (!rateLimitResult.isValid) {
      return {
        ...rateLimitResult,
        performance: {
          validationTime: Date.now() - startTime,
          cacheHit,
          dbQueries: dbQueries + rateLimitResult.dbQueries
        }
      };
    }

    // 7. 异步更新最后使用时间（不阻塞请求）
    setImmediate(() => {
      updateLastUsedTimeAsync(cachedApiKey!.id).catch(error => {
        console.error('更新最后使用时间失败:', error);
      });
    });

    // 8. 返回验证成功结果
    const validationTime = Date.now() - startTime;
    console.log(`✅ API Key验证成功: ${validationTime}ms (缓存${cacheHit ? '命中' : '未命中'}, DB查询:${dbQueries}次)`);

    return {
      isValid: true,
      apiKey: cachedApiKey,
      remainingQuota: quotaResult.remainingQuota,
      rateLimitStatus: rateLimitResult.rateLimitStatus,
      performance: {
        validationTime,
        cacheHit,
        dbQueries
      }
    };

  } catch (error) {
    const validationTime = Date.now() - startTime;
    console.error(`❌ API Key验证失败 (${validationTime}ms):`, error);
    
    return {
      isValid: false,
      error: error instanceof Error ? error.message : 'API Key验证失败',
      performance: {
        validationTime,
        cacheHit,
        dbQueries
      }
    };
  }
}

/**
 * 从数据库获取API Key信息
 */
async function getApiKeyFromDatabase(keyValue: string): Promise<CachedApiKey | null> {
  try {
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
      return null;
    }

    // 转换为缓存格式
    const cachedApiKey: CachedApiKey = {
      id: apiKey.id,
      key: apiKey.key,
      groupId: apiKey.groupId,
      userId: apiKey.userId,
      status: apiKey.status as 'active' | 'inactive' | 'deleted',
      quotaLimit: apiKey.quotaLimit ? Number(apiKey.quotaLimit) : null,
      quotaUsed: Number(apiKey.quotaUsed),
      expiresAt: apiKey.expiresAt,
      metadata: (apiKey.metadata as ApiKeyMetadata) || { createdBy: 'system' },
      user: apiKey.user,
      group: apiKey.group,
      lastValidated: Date.now()
    };

    return cachedApiKey;
  } catch (error) {
    console.error('从数据库获取API Key失败:', error);
    return null;
  }
}

/**
 * 基础状态验证
 */
function validateBasicStatus(apiKey: CachedApiKey): { isValid: boolean; error?: string } {
  // 检查API Key状态
  if (apiKey.status !== 'active') {
    return {
      isValid: false,
      error: 'API Key已禁用'
    };
  }

  // 检查过期时间
  if (apiKey.expiresAt && new Date() > new Date(apiKey.expiresAt)) {
    return {
      isValid: false,
      error: 'API Key已过期'
    };
  }

  // 检查拼车组状态
  if (apiKey.group.status !== 'active') {
    return {
      isValid: false,
      error: '拼车组不可用'
    };
  }

  return { isValid: true };
}

/**
 * 优化的配额检查
 */
async function checkQuotaOptimized(apiKey: CachedApiKey): Promise<{
  isValid: boolean;
  error?: string;
  remainingQuota?: number;
  dbQueries: number;
}> {
  let dbQueries = 0;
  const metadata = apiKey.metadata;

  try {
    // 1. 检查每日费用限制
    if (metadata.dailyCostLimit) {
      let quotaInfo: QuotaInfo | null = null;
      
      if (FeatureFlags.ENABLE_QUOTA_CACHE) {
        quotaInfo = await cacheService.getQuotaInfo(apiKey.id);
      }

      if (!quotaInfo) {
        // 从数据库计算今日使用量
        const today = new Date().toISOString().split('T')[0];
        const todayUsage = await prisma.usageStat.aggregate({
          _sum: {
            cost: true
          },
          where: {
            groupId: apiKey.groupId,
            requestTime: {
              gte: new Date(today)
            }
          }
        });
        
        dbQueries++;
        
        const dailyUsed = Number(todayUsage._sum.cost || 0);
        quotaInfo = {
          dailyUsed,
          dailyLimit: metadata.dailyCostLimit,
          monthlyUsed: 0, // TODO: 实现月度统计
          monthlyLimit: null,
          remainingQuota: metadata.dailyCostLimit - dailyUsed,
          lastUpdated: Date.now()
        };

        // 异步设置缓存
        if (FeatureFlags.ENABLE_QUOTA_CACHE) {
          setImmediate(() => {
            cacheService.setQuotaInfo(apiKey.id, quotaInfo!).catch(error => {
              console.error('设置配额缓存失败:', error);
            });
          });
        }
      }

      if (quotaInfo.dailyUsed >= quotaInfo.dailyLimit) {
        return {
          isValid: false,
          error: `已达到每日费用限制 $${quotaInfo.dailyLimit}`,
          dbQueries
        };
      }

      return {
        isValid: true,
        remainingQuota: quotaInfo.remainingQuota,
        dbQueries
      };
    }

    // 2. 检查Token配额限制
    if (apiKey.quotaLimit) {
      const quotaUsed = apiKey.quotaUsed;
      const quotaLimit = apiKey.quotaLimit;
      
      if (quotaUsed >= quotaLimit) {
        return {
          isValid: false,
          error: '已达到配额限制',
          dbQueries
        };
      }

      return {
        isValid: true,
        remainingQuota: quotaLimit - quotaUsed,
        dbQueries
      };
    }

    return { isValid: true, dbQueries };

  } catch (error) {
    console.error('配额检查失败:', error);
    return {
      isValid: false,
      error: '配额检查失败',
      dbQueries
    };
  }
}

/**
 * 优化的速率限制检查
 */
async function checkRateLimitOptimized(apiKey: CachedApiKey): Promise<{
  isValid: boolean;
  error?: string;
  rateLimitStatus?: {
    requestsRemaining: number;
    tokensRemaining: number;
    resetTime: Date;
  };
  dbQueries: number;
}> {
  let dbQueries = 0;
  const metadata = apiKey.metadata;

  try {
    if (!metadata.rateLimit) {
      return { isValid: true, dbQueries };
    }

    const { windowMinutes, maxRequests, maxTokens } = metadata.rateLimit;
    let rateInfo: RateInfo | null = null;

    if (FeatureFlags.ENABLE_RATE_LIMIT_CACHE) {
      rateInfo = await cacheService.getRateLimit(apiKey.id, windowMinutes);
    }

    if (!rateInfo) {
      // 从数据库查询时间窗口内的使用量
      const windowStart = new Date(Date.now() - windowMinutes * 60 * 1000);
      const windowUsage = await prisma.usageStat.aggregate({
        _sum: {
          totalTokens: true
        },
        _count: true,
        where: {
          groupId: apiKey.groupId,
          requestTime: {
            gte: windowStart
          }
        }
      });

      dbQueries++;

      const requestCount = windowUsage._count;
      const tokenCount = Number(windowUsage._sum.totalTokens || 0);
      const resetTime = Date.now() + windowMinutes * 60 * 1000;

      rateInfo = {
        windowStart: windowStart.getTime(),
        requestCount,
        tokenCount,
        maxRequests,
        maxTokens,
        windowMinutes,
        resetTime
      };

      // 异步设置缓存
      if (FeatureFlags.ENABLE_RATE_LIMIT_CACHE) {
        setImmediate(() => {
          cacheService.setRateLimit(apiKey.id, rateInfo!).catch(error => {
            console.error('设置速率限制缓存失败:', error);
          });
        });
      }
    }

    // 检查请求数限制
    if (rateInfo.requestCount >= rateInfo.maxRequests) {
      return {
        isValid: false,
        error: `请求频率过高，请在 ${windowMinutes} 分钟后重试`,
        rateLimitStatus: {
          requestsRemaining: 0,
          tokensRemaining: Math.max(0, rateInfo.maxTokens - rateInfo.tokenCount),
          resetTime: new Date(rateInfo.resetTime)
        },
        dbQueries
      };
    }

    // 检查Token数限制
    if (rateInfo.tokenCount >= rateInfo.maxTokens) {
      return {
        isValid: false,
        error: `Token使用量过高，请在 ${windowMinutes} 分钟后重试`,
        rateLimitStatus: {
          requestsRemaining: Math.max(0, rateInfo.maxRequests - rateInfo.requestCount),
          tokensRemaining: 0,
          resetTime: new Date(rateInfo.resetTime)
        },
        dbQueries
      };
    }

    return {
      isValid: true,
      rateLimitStatus: {
        requestsRemaining: rateInfo.maxRequests - rateInfo.requestCount,
        tokensRemaining: rateInfo.maxTokens - rateInfo.tokenCount,
        resetTime: new Date(rateInfo.resetTime)
      },
      dbQueries
    };

  } catch (error) {
    console.error('速率限制检查失败:', error);
    return {
      isValid: false,
      error: '速率限制检查失败',
      dbQueries
    };
  }
}

/**
 * 异步更新最后使用时间
 */
async function updateLastUsedTimeAsync(apiKeyId: string): Promise<void> {
  try {
    await prisma.apiKey.update({
      where: { id: apiKeyId },
      data: { lastUsedAt: new Date() }
    });
  } catch (error) {
    console.error('更新API Key最后使用时间失败:', error);
  }
}

/**
 * 优化的API使用记录函数
 */
export async function recordApiUsageOptimized(
  apiKey: CachedApiKey,
  serviceType: string,
  modelName: string, 
  tokens: number,
  cost: number
): Promise<void> {
  try {
    // 1. 异步记录到消息队列（不阻塞请求）
    setImmediate(async () => {
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
            metadata: {
              apiKeyId: apiKey.id,
              apiKeyName: apiKey.key.substring(0, 12) + '...'
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

        // 更新缓存中的速率限制计数
        if (FeatureFlags.ENABLE_RATE_LIMIT_CACHE && apiKey.metadata.rateLimit) {
          await cacheService.incrementRateLimit(
            apiKey.id,
            apiKey.metadata.rateLimit.windowMinutes,
            1, // 请求数增加1
            tokens // Token数增加
          );
        }

        console.log(`📊 API使用记录成功: ${apiKey.key.substring(0, 12)}... 使用了 ${tokens} tokens，费用 $${cost}`);
        
      } catch (error) {
        console.error('记录API使用统计失败:', error);
      }
    });

    // 2. 立即返回，不等待异步操作完成
    return;
    
  } catch (error) {
    console.error('启动API使用记录失败:', error);
    throw error;
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

/**
 * 获取API Key验证性能统计
 */
export async function getValidationStats(): Promise<{
  totalValidations: number;
  cacheHitRate: number;
  avgValidationTime: number;
  avgDbQueries: number;
}> {
  // TODO: 实现性能统计收集
  return {
    totalValidations: 0,
    cacheHitRate: 0,
    avgValidationTime: 0,
    avgDbQueries: 0
  };
}
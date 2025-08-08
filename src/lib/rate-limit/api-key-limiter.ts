/**
 * API密钥限流中间件
 * 
 * 基于API密钥的速率限制和配额管理
 */

import { NextRequest, NextResponse } from 'next/server';
import { rateLimiter, RateLimitConfig, QuotaConfig } from './rate-limiter';
import { redisClient } from '@/lib/redis';
import { prisma } from '@/lib/prisma';
import { createApiResponse } from '@/lib/middleware';

export interface ApiKeyLimitConfig {
  rateLimit?: {
    windowMinutes: number;
    maxRequests: number;
  };
  quotaLimit?: {
    dailyTokens: number;
    dailyCost: number;
  };
}

/**
 * 检查API密钥的限流和配额
 */
export async function checkApiKeyLimits(
  apiKeyId: string,
  apiKey: any,
  estimatedTokens: number = 0,
  estimatedCost: number = 0
): Promise<{ allowed: boolean; reason?: string; headers?: Record<string, string> }> {
  const headers: Record<string, string> = {};

  // 1. 检查速率限制
  if (apiKey.rateLimitWindow && apiKey.rateLimitRequests) {
    const rateLimitConfig: RateLimitConfig = {
      windowMs: apiKey.rateLimitWindow * 60 * 1000, // 分钟转毫秒
      maxRequests: apiKey.rateLimitRequests,
      keyPrefix: 'apikey:rate'
    };

    const rateLimitResult = await rateLimiter.checkRateLimit(apiKeyId, rateLimitConfig);
    
    // 添加标准的限流响应头
    headers['X-RateLimit-Limit'] = rateLimitResult.limit.toString();
    headers['X-RateLimit-Remaining'] = rateLimitResult.remaining.toString();
    headers['X-RateLimit-Reset'] = rateLimitResult.resetAt.toISOString();

    if (!rateLimitResult.allowed) {
      headers['Retry-After'] = (rateLimitResult.retryAfter || 60).toString();
      return {
        allowed: false,
        reason: `速率限制：超过了 ${apiKey.rateLimitWindow} 分钟内 ${apiKey.rateLimitRequests} 次的请求限制`,
        headers
      };
    }
  }

  // 2. 检查Token配额
  if (apiKey.tokenLimit && estimatedTokens > 0) {
    const tokenQuotaConfig: QuotaConfig = {
      dailyLimit: apiKey.tokenLimit,
      keyPrefix: 'apikey:tokens'
    };

    const tokenQuotaResult = await rateLimiter.checkQuota(
      apiKeyId,
      estimatedTokens,
      tokenQuotaConfig
    );

    headers['X-Token-Limit'] = tokenQuotaResult.limit.toString();
    headers['X-Token-Used'] = tokenQuotaResult.used.toString();
    headers['X-Token-Remaining'] = tokenQuotaResult.remaining.toString();

    if (!tokenQuotaResult.allowed) {
      return {
        allowed: false,
        reason: `Token配额不足：今日已使用 ${tokenQuotaResult.used}/${tokenQuotaResult.limit} tokens`,
        headers
      };
    }
  }

  // 3. 检查费用配额
  if (apiKey.dailyCostLimit && estimatedCost > 0) {
    const costQuotaConfig: QuotaConfig = {
      dailyLimit: Number(apiKey.dailyCostLimit),
      keyPrefix: 'apikey:cost'
    };

    const costQuotaResult = await rateLimiter.checkQuota(
      apiKeyId,
      estimatedCost,
      costQuotaConfig
    );

    headers['X-Cost-Limit'] = `$${costQuotaResult.limit.toFixed(2)}`;
    headers['X-Cost-Used'] = `$${costQuotaResult.used.toFixed(2)}`;
    headers['X-Cost-Remaining'] = `$${costQuotaResult.remaining.toFixed(2)}`;

    if (!costQuotaResult.allowed) {
      return {
        allowed: false,
        reason: `费用配额不足：今日已使用 $${costQuotaResult.used.toFixed(2)}/$${costQuotaResult.limit.toFixed(2)}`,
        headers
      };
    }
  }

  return { allowed: true, headers };
}

/**
 * 更新API密钥的使用统计（Redis + 异步数据库）
 */
export async function updateApiKeyUsage(
  apiKeyId: string,
  usage: {
    tokens?: number;
    cost?: number;
    requests?: number;
  }
): Promise<void> {
  try {
    // 1. 更新Redis计数器（实时）
    const today = new Date().toISOString().split('T')[0];
    const month = today.substring(0, 7);

    const promises: Promise<any>[] = [];

    if (usage.tokens) {
      promises.push(
        redisClient.incrbyfloat(`apikey:tokens:daily:${apiKeyId}:${today}`, usage.tokens),
        redisClient.incrbyfloat(`apikey:tokens:monthly:${apiKeyId}:${month}`, usage.tokens)
      );
    }

    if (usage.cost) {
      promises.push(
        redisClient.incrbyfloat(`apikey:cost:daily:${apiKeyId}:${today}`, usage.cost),
        redisClient.incrbyfloat(`apikey:cost:monthly:${apiKeyId}:${month}`, usage.cost)
      );
    }

    await Promise.all(promises);

    // 2. 异步更新数据库（批量写入，降低压力）
    // 使用后台任务队列或定时任务批量更新，这里简化为直接更新
    setImmediate(async () => {
      try {
        await prisma.apiKey.update({
          where: { id: apiKeyId },
          data: {
            totalTokens: { increment: usage.tokens || 0 },
            totalCost: { increment: usage.cost || 0 },
            totalRequests: { increment: usage.requests || 1 },
            lastUsedAt: new Date()
          }
        });
      } catch (error) {
        console.error('Failed to update API key usage in database:', error);
      }
    });

  } catch (error) {
    console.error('Failed to update API key usage:', error);
    // 不影响主流程
  }
}

/**
 * 创建限流中间件
 */
export function createRateLimitMiddleware(
  defaultConfig?: Partial<ApiKeyLimitConfig>
) {
  return async function rateLimitMiddleware(
    request: NextRequest,
    apiKey: any,
    apiKeyId: string
  ): Promise<NextResponse | null> {
    // 从API密钥或使用默认配置
    const config: ApiKeyLimitConfig = {
      rateLimit: apiKey.rateLimitWindow && apiKey.rateLimitRequests ? {
        windowMinutes: apiKey.rateLimitWindow,
        maxRequests: apiKey.rateLimitRequests
      } : defaultConfig?.rateLimit,
      quotaLimit: apiKey.tokenLimit || apiKey.dailyCostLimit ? {
        dailyTokens: apiKey.tokenLimit || 100000,
        dailyCost: Number(apiKey.dailyCostLimit) || 10
      } : defaultConfig?.quotaLimit
    };

    // 预估使用量（可以从请求体中解析）
    let estimatedTokens = 100; // 默认估算
    let estimatedCost = 0.002; // 默认估算

    try {
      const body = await request.clone().json();
      if (body.messages) {
        // 简单估算：每条消息约50 tokens
        estimatedTokens = body.messages.length * 50;
      }
      if (body.model) {
        // 根据模型调整费用估算
        if (body.model.includes('gpt-4')) {
          estimatedCost = estimatedTokens * 0.00003;
        } else if (body.model.includes('claude')) {
          estimatedCost = estimatedTokens * 0.00002;
        } else {
          estimatedCost = estimatedTokens * 0.000002;
        }
      }
    } catch {
      // 解析失败使用默认值
    }

    const result = await checkApiKeyLimits(
      apiKeyId,
      apiKey,
      estimatedTokens,
      estimatedCost
    );

    if (!result.allowed) {
      return NextResponse.json(
        createApiResponse(false, null, result.reason || '请求被限流', 429),
        { 
          status: 429,
          headers: result.headers
        }
      );
    }

    // 如果通过，添加响应头但返回null让请求继续
    if (result.headers) {
      Object.entries(result.headers).forEach(([key, value]) => {
        request.headers.set(key, value);
      });
    }

    return null;
  };
}
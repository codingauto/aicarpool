/**
 * 拼车组级别限流
 * 
 * 管理拼车组的整体资源使用限制
 */

import { rateLimiter, QuotaConfig } from './rate-limiter';
import { prisma } from '@/lib/prisma';
import { redisClient } from '@/lib/redis';

export interface GroupQuotaConfig {
  groupId: string;
  dailyTokenLimit?: number;
  monthlyTokenLimit?: number;
  dailyCostLimit?: number;
  monthlyCostLimit?: number;
}

/**
 * 检查拼车组配额
 */
export async function checkGroupQuota(
  groupId: string,
  estimatedTokens: number = 0,
  estimatedCost: number = 0
): Promise<{ allowed: boolean; reason?: string; usage?: any }> {
  try {
    // 获取拼车组的资源绑定配置
    const resourceBinding = await prisma.groupResourceBinding.findUnique({
      where: { groupId }
    });

    if (!resourceBinding) {
      // 没有配置限制，默认允许
      return { allowed: true };
    }

    const results: { allowed: boolean; reason?: string }[] = [];

    // 检查Token限制
    if (resourceBinding.dailyTokenLimit && estimatedTokens > 0) {
      const tokenConfig: QuotaConfig = {
        dailyLimit: resourceBinding.dailyTokenLimit,
        keyPrefix: 'group:tokens'
      };

      const tokenResult = await rateLimiter.checkQuota(
        groupId,
        estimatedTokens,
        tokenConfig
      );

      if (!tokenResult.allowed) {
        results.push({
          allowed: false,
          reason: `拼车组Token配额不足：今日已使用 ${tokenResult.used}/${tokenResult.limit} tokens`
        });
      }
    }

    // 检查费用限制
    if (resourceBinding.monthlyBudget && estimatedCost > 0) {
      const costConfig: QuotaConfig = {
        dailyLimit: Number(resourceBinding.monthlyBudget) / 30, // 简化：月预算除以30天
        keyPrefix: 'group:cost'
      };

      const costResult = await rateLimiter.checkQuota(
        groupId,
        estimatedCost,
        costConfig
      );

      if (!costResult.allowed) {
        results.push({
          allowed: false,
          reason: `拼车组费用配额不足：今日已使用 $${costResult.used.toFixed(2)}/${costResult.limit.toFixed(2)}`
        });
      }
    }

    // 检查是否有任何限制未通过
    const failed = results.find(r => !r.allowed);
    if (failed) {
      return failed;
    }

    // 获取当前使用统计
    const usage = await rateLimiter.getUsageStats(groupId, 'group');

    return {
      allowed: true,
      usage
    };

  } catch (error) {
    console.error('Group quota check failed:', error);
    // 失败时默认允许，避免服务中断
    return { allowed: true };
  }
}

/**
 * 更新拼车组使用统计
 */
export async function updateGroupUsage(
  groupId: string,
  usage: {
    tokens?: number;
    cost?: number;
  }
): Promise<void> {
  try {
    const today = new Date().toISOString().split('T')[0];
    const month = today.substring(0, 7);

    const promises: Promise<any>[] = [];

    if (usage.tokens) {
      promises.push(
        redisClient.incrbyfloat(`group:tokens:daily:${groupId}:${today}`, usage.tokens),
        redisClient.incrbyfloat(`group:tokens:monthly:${groupId}:${month}`, usage.tokens)
      );
    }

    if (usage.cost) {
      promises.push(
        redisClient.incrbyfloat(`group:cost:daily:${groupId}:${today}`, usage.cost),
        redisClient.incrbyfloat(`group:cost:monthly:${groupId}:${month}`, usage.cost)
      );
    }

    await Promise.all(promises);

  } catch (error) {
    console.error('Failed to update group usage:', error);
  }
}

/**
 * 获取拼车组的实时使用统计
 */
export async function getGroupUsageStats(groupId: string): Promise<{
  daily: {
    tokens: number;
    cost: number;
  };
  monthly: {
    tokens: number;
    cost: number;
  };
  limits?: {
    dailyTokenLimit?: number;
    monthlyBudget?: number;
  };
}> {
  try {
    // 从Redis获取实时统计
    const tokenStats = await rateLimiter.getUsageStats(groupId, 'group:tokens');
    const costStats = await rateLimiter.getUsageStats(groupId, 'group:cost');

    // 获取配置的限制
    const resourceBinding = await prisma.groupResourceBinding.findUnique({
      where: { groupId },
      select: {
        dailyTokenLimit: true,
        monthlyBudget: true
      }
    });

    return {
      daily: {
        tokens: tokenStats.daily,
        cost: costStats.daily
      },
      monthly: {
        tokens: tokenStats.monthly,
        cost: costStats.monthly
      },
      limits: resourceBinding ? {
        dailyTokenLimit: resourceBinding.dailyTokenLimit,
        monthlyBudget: resourceBinding.monthlyBudget ? Number(resourceBinding.monthlyBudget) : undefined
      } : undefined
    };

  } catch (error) {
    console.error('Failed to get group usage stats:', error);
    return {
      daily: { tokens: 0, cost: 0 },
      monthly: { tokens: 0, cost: 0 }
    };
  }
}

/**
 * 检查拼车组是否接近配额限制（用于预警）
 */
export async function checkGroupQuotaWarning(
  groupId: string,
  warningThreshold: number = 80
): Promise<{
  hasWarning: boolean;
  warnings: string[];
}> {
  try {
    const stats = await getGroupUsageStats(groupId);
    const warnings: string[] = [];

    if (stats.limits?.dailyTokenLimit) {
      const usagePercent = (stats.daily.tokens / stats.limits.dailyTokenLimit) * 100;
      if (usagePercent >= warningThreshold) {
        warnings.push(`Token使用量已达 ${usagePercent.toFixed(1)}%`);
      }
    }

    if (stats.limits?.monthlyBudget) {
      const dailyBudget = stats.limits.monthlyBudget / 30;
      const usagePercent = (stats.daily.cost / dailyBudget) * 100;
      if (usagePercent >= warningThreshold) {
        warnings.push(`费用使用量已达 ${usagePercent.toFixed(1)}%`);
      }
    }

    return {
      hasWarning: warnings.length > 0,
      warnings
    };

  } catch (error) {
    console.error('Failed to check group quota warning:', error);
    return { hasWarning: false, warnings: [] };
  }
}
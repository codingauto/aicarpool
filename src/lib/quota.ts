import { prisma } from './db';
import { emailQueue } from './email';

export interface QuotaConfig {
  id: string;
  groupId: string;
  aiServiceId: string;
  dailyTokenLimit: bigint;
  monthlyTokenLimit: bigint;
  dailyCostLimit: number;
  monthlyCostLimit: number;
  warningThreshold: number; // 百分比，如 80
  userDailyTokenLimit?: bigint;
  userMonthlyTokenLimit?: bigint;
  resetTime: string; // HH:mm 格式，如 "00:00"
  timezone: string; // 时区，如 "Asia/Shanghai"
  isEnabled: boolean;
}

export interface QuotaUsage {
  dailyTokens: bigint;
  monthlyTokens: bigint;
  dailyCost: number;
  monthlyCost: number;
  lastResetDate: Date;
  warningsSent: {
    daily80: boolean;
    daily95: boolean;
    monthly80: boolean;
    monthly95: boolean;
  };
}

export interface QuotaStatus {
  config: QuotaConfig;
  usage: QuotaUsage;
  limits: {
    dailyTokensRemaining: bigint;
    monthlyTokensRemaining: bigint;
    dailyCostRemaining: number;
    monthlyCostRemaining: number;
  };
  percentages: {
    dailyTokens: number;
    monthlyTokens: number;
    dailyCost: number;
    monthlyCost: number;
  };
  isBlocked: boolean;
  blockedReason?: string;
}

export class QuotaManager {
  // 检查配额状态
  async checkQuota(
    groupId: string, 
    aiServiceId: string, 
    userId?: string
  ): Promise<QuotaStatus> {
    const config = await this.getQuotaConfig(groupId, aiServiceId);
    const usage = await this.getQuotaUsage(groupId, aiServiceId);
    
    // 计算剩余配额
    const limits = {
      dailyTokensRemaining: config.dailyTokenLimit - usage.dailyTokens,
      monthlyTokensRemaining: config.monthlyTokenLimit - usage.monthlyTokens,
      dailyCostRemaining: config.dailyCostLimit - usage.dailyCost,
      monthlyCostRemaining: config.monthlyCostLimit - usage.monthlyCost,
    };

    // 计算使用百分比
    const percentages = {
      dailyTokens: Number(usage.dailyTokens) / Number(config.dailyTokenLimit) * 100,
      monthlyTokens: Number(usage.monthlyTokens) / Number(config.monthlyTokenLimit) * 100,
      dailyCost: usage.dailyCost / config.dailyCostLimit * 100,
      monthlyCost: usage.monthlyCost / config.monthlyCostLimit * 100,
    };

    // 检查是否被阻止
    let isBlocked = false;
    let blockedReason: string | undefined;

    if (limits.dailyTokensRemaining <= 0) {
      isBlocked = true;
      blockedReason = '今日Token配额已用完';
    } else if (limits.monthlyTokensRemaining <= 0) {
      isBlocked = true;
      blockedReason = '本月Token配额已用完';
    } else if (limits.dailyCostRemaining <= 0) {
      isBlocked = true;
      blockedReason = '今日成本配额已用完';
    } else if (limits.monthlyCostRemaining <= 0) {
      isBlocked = true;
      blockedReason = '本月成本配额已用完';
    }

    return {
      config,
      usage,
      limits,
      percentages,
      isBlocked,
      blockedReason,
    };
  }

  // 记录使用量
  async recordUsage(
    groupId: string,
    aiServiceId: string,
    userId: string,
    tokens: number,
    cost: number
  ): Promise<void> {
    const now = new Date();
    const dateKey = this.getDateKey(now);
    const monthKey = this.getMonthKey(now);

    await prisma.$transaction(async (tx) => {
      // 更新或创建配额使用记录
      await tx.$executeRaw`
        INSERT INTO quota_usage (group_id, ai_service_id, date_key, month_key, daily_tokens, monthly_tokens, daily_cost, monthly_cost, updated_at)
        VALUES (${groupId}, ${aiServiceId}, ${dateKey}, ${monthKey}, ${BigInt(tokens)}, ${BigInt(tokens)}, ${cost}, ${cost}, ${now})
        ON DUPLICATE KEY UPDATE
        daily_tokens = IF(date_key = VALUES(date_key), daily_tokens + VALUES(daily_tokens), VALUES(daily_tokens)),
        monthly_tokens = monthly_tokens + VALUES(monthly_tokens),
        daily_cost = IF(date_key = VALUES(date_key), daily_cost + VALUES(daily_cost), VALUES(daily_cost)),
        monthly_cost = monthly_cost + VALUES(monthly_cost),
        updated_at = VALUES(updated_at)
      `;

      // 记录用户级别的使用统计
      if (userId) {
        await tx.$executeRaw`
          INSERT INTO user_quota_usage (user_id, group_id, ai_service_id, date_key, month_key, daily_tokens, monthly_tokens, daily_cost, monthly_cost, updated_at)
          VALUES (${userId}, ${groupId}, ${aiServiceId}, ${dateKey}, ${monthKey}, ${BigInt(tokens)}, ${BigInt(tokens)}, ${cost}, ${cost}, ${now})
          ON DUPLICATE KEY UPDATE
          daily_tokens = IF(date_key = VALUES(date_key), daily_tokens + VALUES(daily_tokens), VALUES(daily_tokens)),
          monthly_tokens = monthly_tokens + VALUES(monthly_tokens),
          daily_cost = IF(date_key = VALUES(date_key), daily_cost + VALUES(daily_cost), VALUES(daily_cost)),
          monthly_cost = monthly_cost + VALUES(monthly_cost),
          updated_at = VALUES(updated_at)
        `;
      }
    });

    // 检查是否需要发送警告
    await this.checkAndSendWarnings(groupId, aiServiceId);
  }

  // 获取配额配置
  private async getQuotaConfig(groupId: string, aiServiceId: string): Promise<QuotaConfig> {
    const config = await prisma.$queryRaw<QuotaConfig[]>`
      SELECT * FROM quota_configs 
      WHERE group_id = ${groupId} AND ai_service_id = ${aiServiceId} AND is_enabled = true
      LIMIT 1
    `;

    if (config.length === 0) {
      // 返回默认配置
      return {
        id: 'default',
        groupId,
        aiServiceId,
        dailyTokenLimit: BigInt(100000),
        monthlyTokenLimit: BigInt(3000000),
        dailyCostLimit: 10.0,
        monthlyCostLimit: 300.0,
        warningThreshold: 80,
        resetTime: '00:00',
        timezone: 'Asia/Shanghai',
        isEnabled: true,
      };
    }

    return config[0];
  }

  // 获取配额使用情况
  private async getQuotaUsage(groupId: string, aiServiceId: string): Promise<QuotaUsage> {
    const now = new Date();
    const dateKey = this.getDateKey(now);
    const monthKey = this.getMonthKey(now);

    const usage = await prisma.$queryRaw<QuotaUsage[]>`
      SELECT 
        COALESCE(daily_tokens, 0) as dailyTokens,
        COALESCE(monthly_tokens, 0) as monthlyTokens,
        COALESCE(daily_cost, 0) as dailyCost,
        COALESCE(monthly_cost, 0) as monthlyCost,
        COALESCE(last_reset_date, ${now}) as lastResetDate,
        COALESCE(warnings_sent, '{}') as warningsSent
      FROM quota_usage 
      WHERE group_id = ${groupId} 
        AND ai_service_id = ${aiServiceId}
        AND date_key = ${dateKey}
        AND month_key = ${monthKey}
      LIMIT 1
    `;

    if (usage.length === 0) {
      return {
        dailyTokens: BigInt(0),
        monthlyTokens: BigInt(0),
        dailyCost: 0,
        monthlyCost: 0,
        lastResetDate: now,
        warningsSent: {
          daily80: false,
          daily95: false,
          monthly80: false,
          monthly95: false,
        },
      };
    }

    const result = usage[0];
    return {
      ...result,
      warningsSent: typeof result.warningsSent === 'string' 
        ? JSON.parse(result.warningsSent as string)
        : result.warningsSent,
    };
  }

  // 检查并发送警告
  private async checkAndSendWarnings(groupId: string, aiServiceId: string): Promise<void> {
    const status = await this.checkQuota(groupId, aiServiceId);
    const { config, usage, percentages } = status;

    const warnings: Array<{
      type: keyof QuotaUsage['warningsSent'];
      threshold: number;
      current: number;
      message: string;
    }> = [
      {
        type: 'daily80',
        threshold: 80,
        current: percentages.dailyTokens,
        message: '今日Token使用量已达到80%',
      },
      {
        type: 'daily95',
        threshold: 95,
        current: percentages.dailyTokens,
        message: '今日Token使用量已达到95%',
      },
      {
        type: 'monthly80',
        threshold: 80,
        current: percentages.monthlyTokens,
        message: '本月Token使用量已达到80%',
      },
      {
        type: 'monthly95',
        threshold: 95,
        current: percentages.monthlyTokens,
        message: '本月Token使用量已达到95%',
      },
    ];

    for (const warning of warnings) {
      if (warning.current >= warning.threshold && !usage.warningsSent[warning.type]) {
        await this.sendQuotaWarning(groupId, aiServiceId, warning.message, warning.current);
        
        // 更新警告发送状态
        await this.updateWarningStatus(groupId, aiServiceId, warning.type);
      }
    }
  }

  // 发送配额警告
  private async sendQuotaWarning(
    groupId: string,
    aiServiceId: string,
    message: string,
    percentage: number
  ): Promise<void> {
    try {
      // 获取组管理员邮箱列表
      const admins = await prisma.groupMember.findMany({
        where: {
          groupId,
          role: { in: ['admin', 'owner'] },
          status: 'active',
        },
        include: {
          user: {
            select: {
              email: true,
              name: true,
            },
          },
          group: {
            select: {
              name: true,
            },
          },
        },
      });

      const aiService = await prisma.aiService.findUnique({
        where: { id: aiServiceId },
        select: { displayName: true },
      });

      // 向每个管理员发送警告邮件
      for (const admin of admins) {
        await emailQueue.addToQueue('alert', {
          to: admin.user.email,
          alertType: 'quota_warning',
          details: {
            groupName: admin.group.name,
            serviceName: aiService?.displayName || 'Unknown Service',
            currentUsage: Math.round(percentage),
            limit: 100,
            message,
          },
        });
      }
    } catch (error) {
      console.error('Failed to send quota warning:', error);
    }
  }

  // 更新警告发送状态
  private async updateWarningStatus(
    groupId: string,
    aiServiceId: string,
    warningType: keyof QuotaUsage['warningsSent']
  ): Promise<void> {
    const now = new Date();
    const dateKey = this.getDateKey(now);
    const monthKey = this.getMonthKey(now);

    await prisma.$executeRaw`
      UPDATE quota_usage 
      SET warnings_sent = JSON_SET(COALESCE(warnings_sent, '{}'), $.${warningType}, true)
      WHERE group_id = ${groupId} 
        AND ai_service_id = ${aiServiceId}
        AND date_key = ${dateKey}
        AND month_key = ${monthKey}
    `;
  }

  // 重置配额（通常在每日/每月重置时调用）
  async resetQuota(groupId: string, aiServiceId: string, resetType: 'daily' | 'monthly'): Promise<void> {
    const now = new Date();
    const dateKey = this.getDateKey(now);
    const monthKey = this.getMonthKey(now);

    if (resetType === 'daily') {
      await prisma.$executeRaw`
        UPDATE quota_usage 
        SET daily_tokens = 0, daily_cost = 0, 
            warnings_sent = JSON_SET(warnings_sent, '$.daily80', false, '$.daily95', false),
            updated_at = ${now}
        WHERE group_id = ${groupId} AND ai_service_id = ${aiServiceId}
      `;
    } else if (resetType === 'monthly') {
      await prisma.$executeRaw`
        UPDATE quota_usage 
        SET monthly_tokens = 0, monthly_cost = 0,
            warnings_sent = JSON_SET(warnings_sent, '$.monthly80', false, '$.monthly95', false),
            updated_at = ${now}
        WHERE group_id = ${groupId} AND ai_service_id = ${aiServiceId}
      `;
    }
  }

  // 获取用户级别的配额状态
  async getUserQuotaStatus(
    userId: string,
    groupId: string,
    aiServiceId: string
  ): Promise<QuotaStatus | null> {
    const config = await this.getQuotaConfig(groupId, aiServiceId);
    
    if (!config.userDailyTokenLimit && !config.userMonthlyTokenLimit) {
      return null; // 没有设置用户级别限制
    }

    const now = new Date();
    const dateKey = this.getDateKey(now);
    const monthKey = this.getMonthKey(now);

    const userUsage = await prisma.$queryRaw<{
      dailyTokens: bigint;
      monthlyTokens: bigint;
      dailyCost: number;
      monthlyCost: number;
    }[]>`
      SELECT 
        COALESCE(daily_tokens, 0) as dailyTokens,
        COALESCE(monthly_tokens, 0) as monthlyTokens,
        COALESCE(daily_cost, 0) as dailyCost,
        COALESCE(monthly_cost, 0) as monthlyCost
      FROM user_quota_usage 
      WHERE user_id = ${userId}
        AND group_id = ${groupId} 
        AND ai_service_id = ${aiServiceId}
        AND date_key = ${dateKey}
        AND month_key = ${monthKey}
      LIMIT 1
    `;

    const usage = userUsage[0] || {
      dailyTokens: BigInt(0),
      monthlyTokens: BigInt(0),
      dailyCost: 0,
      monthlyCost: 0,
    };

    const userLimits = {
      dailyTokensRemaining: (config.userDailyTokenLimit || BigInt(0)) - usage.dailyTokens,
      monthlyTokensRemaining: (config.userMonthlyTokenLimit || BigInt(0)) - usage.monthlyTokens,
      dailyCostRemaining: config.dailyCostLimit - usage.dailyCost,
      monthlyCostRemaining: config.monthlyCostLimit - usage.monthlyCost,
    };

    const percentages = {
      dailyTokens: config.userDailyTokenLimit 
        ? Number(usage.dailyTokens) / Number(config.userDailyTokenLimit) * 100 
        : 0,
      monthlyTokens: config.userMonthlyTokenLimit 
        ? Number(usage.monthlyTokens) / Number(config.userMonthlyTokenLimit) * 100 
        : 0,
      dailyCost: usage.dailyCost / config.dailyCostLimit * 100,
      monthlyCost: usage.monthlyCost / config.monthlyCostLimit * 100,
    };

    let isBlocked = false;
    let blockedReason: string | undefined;

    if (config.userDailyTokenLimit && userLimits.dailyTokensRemaining <= 0) {
      isBlocked = true;
      blockedReason = '您的今日Token配额已用完';
    } else if (config.userMonthlyTokenLimit && userLimits.monthlyTokensRemaining <= 0) {
      isBlocked = true;
      blockedReason = '您的本月Token配额已用完';
    }

    return {
      config,
      usage: {
        dailyTokens: usage.dailyTokens,
        monthlyTokens: usage.monthlyTokens,
        dailyCost: usage.dailyCost,
        monthlyCost: usage.monthlyCost,
        lastResetDate: now,
        warningsSent: {
          daily80: false,
          daily95: false,
          monthly80: false,
          monthly95: false,
        },
      },
      limits: userLimits,
      percentages,
      isBlocked,
      blockedReason,
    };
  }

  // 工具方法
  private getDateKey(date: Date): string {
    return date.toISOString().split('T')[0]; // YYYY-MM-DD
  }

  private getMonthKey(date: Date): string {
    return date.toISOString().slice(0, 7); // YYYY-MM
  }
}

// 单例配额管理器
export const quotaManager = new QuotaManager();
import { prisma } from '@/lib/prisma';
import { cacheManager } from '@/lib/cache';

export interface CostUsageRecord {
  groupId: string;
  departmentId?: string;
  enterpriseId?: string;
  modelId: string;
  serviceType: string;
  userId: string;
  requestTokens: number;
  responseTokens: number;
  totalTokens: number;
  cost: number;
  currency: string;
  requestTime: Date;
  responseTime?: number;
  status: 'success' | 'error' | 'timeout';
  metadata?: Record<string, any>;
}

export interface CostSummary {
  totalCost: number;
  totalTokens: number;
  totalRequests: number;
  costByModel: Record<string, number>;
  costByDepartment: Record<string, number>;
  costByTimeRange: Array<{
    date: string;
    cost: number;
    tokens: number;
    requests: number;
  }>;
}

export interface BudgetAlert {
  id: string;
  type: 'department' | 'group' | 'enterprise';
  entityId: string;
  entityName: string;
  budgetLimit: number;
  currentSpend: number;
  percentage: number;
  alertType: 'warning' | 'critical' | 'exceeded';
  period: 'daily' | 'weekly' | 'monthly';
  triggeredAt: Date;
}

export class CostTracker {
  // 模型成本配置 (每1K tokens的成本，单位：USD)
  private readonly MODEL_COSTS = {
    'claude-4-sonnet': { input: 0.003, output: 0.015 },
    'claude-4-opus': { input: 0.015, output: 0.075 },
    'kimi-k2': { input: 0.001, output: 0.002 },
    'glm-4.5': { input: 0.001, output: 0.002 },
    'qwen-max': { input: 0.0008, output: 0.002 }
  };

  // 汇率 (USD to CNY)
  private readonly USD_TO_CNY = 7.2;

  /**
   * 记录API调用成本
   */
  async recordUsageCost(record: CostUsageRecord): Promise<void> {
    try {
      // 计算成本
      const cost = this.calculateCost(record.modelId, record.requestTokens, record.responseTokens);
      const costInCNY = cost * this.USD_TO_CNY;

      // 获取部门ID（如果未提供）
      let departmentId = record.departmentId;
      if (!departmentId && record.groupId) {
        const group = await prisma.carpoolGroup.findUnique({
          where: { id: record.groupId },
          select: { departmentId: true }
        });
        departmentId = group?.departmentId || undefined;
      }

      // 记录到数据库
      await prisma.enhancedUsageStat.create({
        data: {
          groupId: record.groupId,
          departmentId,
          enterpriseId: record.enterpriseId,
          aiServiceId: record.modelId,
          serviceType: record.serviceType,
          userId: record.userId,
          requestTokens: record.requestTokens,
          responseTokens: record.responseTokens,
          totalTokens: record.totalTokens,
          cost: costInCNY,
          currency: 'CNY',
          requestTime: record.requestTime,
          responseTime: record.responseTime,
          status: record.status,
          metadata: record.metadata || {}
        }
      });

      // 更新缓存统计
      await this.updateCacheStats(record.groupId, departmentId, record.enterpriseId, costInCNY);

      // 检查预算预警
      if (departmentId) {
        await this.checkBudgetAlerts(departmentId, 'department');
      }
      if (record.enterpriseId) {
        await this.checkBudgetAlerts(record.enterpriseId, 'enterprise');
      }

    } catch (error) {
      console.error('Record usage cost error:', error);
      throw error;
    }
  }

  /**
   * 计算API调用成本
   */
  private calculateCost(modelId: string, inputTokens: number, outputTokens: number): number {
    const costs = this.MODEL_COSTS[modelId as keyof typeof this.MODEL_COSTS];
    if (!costs) {
      console.warn(`Unknown model cost for ${modelId}, using default`);
      return (inputTokens + outputTokens) * 0.001 / 1000; // 默认成本
    }

    const inputCost = (inputTokens / 1000) * costs.input;
    const outputCost = (outputTokens / 1000) * costs.output;
    
    return inputCost + outputCost;
  }

  /**
   * 获取成本汇总
   */
  async getCostSummary(
    entityType: 'enterprise' | 'department' | 'group',
    entityId: string,
    timeRange: '7d' | '30d' | '90d' | '1y' = '30d'
  ): Promise<CostSummary> {
    try {
      const days = this.getTimeRangeDays(timeRange);
      const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

      // 构建查询条件
      const whereCondition: any = {
        requestTime: { gte: startDate }
      };

      switch (entityType) {
        case 'enterprise':
          whereCondition.enterpriseId = entityId;
          break;
        case 'department':
          whereCondition.departmentId = entityId;
          break;
        case 'group':
          whereCondition.groupId = entityId;
          break;
      }

      // 查询使用统计
      const usageStats = await prisma.enhancedUsageStat.findMany({
        where: whereCondition,
        select: {
          aiServiceId: true,
          departmentId: true,
          cost: true,
          totalTokens: true,
          requestTime: true,
          status: true
        }
      });

      // 计算汇总数据
      const summary: CostSummary = {
        totalCost: 0,
        totalTokens: 0,
        totalRequests: usageStats.length,
        costByModel: {},
        costByDepartment: {},
        costByTimeRange: []
      };

      // 按日期分组统计
      const dailyStats = new Map<string, { cost: number; tokens: number; requests: number }>();

      usageStats.forEach(stat => {
        const cost = Number(stat.cost);
        const tokens = stat.totalTokens;

        // 总计
        summary.totalCost += cost;
        summary.totalTokens += tokens;

        // 按模型统计
        if (!summary.costByModel[stat.aiServiceId]) {
          summary.costByModel[stat.aiServiceId] = 0;
        }
        summary.costByModel[stat.aiServiceId] += cost;

        // 按部门统计
        if (stat.departmentId) {
          if (!summary.costByDepartment[stat.departmentId]) {
            summary.costByDepartment[stat.departmentId] = 0;
          }
          summary.costByDepartment[stat.departmentId] += cost;
        }

        // 按日期统计
        const dateKey = stat.requestTime.toISOString().split('T')[0];
        if (!dailyStats.has(dateKey)) {
          dailyStats.set(dateKey, { cost: 0, tokens: 0, requests: 0 });
        }
        const dailyStat = dailyStats.get(dateKey)!;
        dailyStat.cost += cost;
        dailyStat.tokens += tokens;
        dailyStat.requests += 1;
      });

      // 转换日期统计
      summary.costByTimeRange = Array.from(dailyStats.entries())
        .map(([date, stats]) => ({
          date,
          cost: stats.cost,
          tokens: stats.tokens,
          requests: stats.requests
        }))
        .sort((a, b) => a.date.localeCompare(b.date));

      return summary;

    } catch (error) {
      console.error('Get cost summary error:', error);
      throw error;
    }
  }

  /**
   * 获取预算使用情况
   */
  async getBudgetUsage(
    entityType: 'enterprise' | 'department' | 'group',
    entityId: string,
    period: 'daily' | 'weekly' | 'monthly' = 'monthly'
  ): Promise<{
    budgetLimit: number;
    currentSpend: number;
    remainingBudget: number;
    percentage: number;
    isOverBudget: boolean;
    projectedSpend: number;
  }> {
    try {
      // 获取预算限制
      let budgetLimit = 0;
      
      switch (entityType) {
        case 'department':
          const department = await prisma.department.findUnique({
            where: { id: entityId },
            select: { budgetLimit: true }
          });
          budgetLimit = Number(department?.budgetLimit || 0);
          break;
        case 'enterprise':
          // 企业预算从配置或数据库获取
          budgetLimit = 50000; // 默认企业预算
          break;
        case 'group':
          // 拼车组预算从组设置获取
          budgetLimit = 5000; // 默认组预算
          break;
      }

      if (budgetLimit === 0) {
        return {
          budgetLimit: 0,
          currentSpend: 0,
          remainingBudget: 0,
          percentage: 0,
          isOverBudget: false,
          projectedSpend: 0
        };
      }

      // 获取当前周期的支出
      const { startDate, endDate } = this.getPeriodRange(period);
      const costSummary = await this.getCostSummaryForPeriod(entityType, entityId, startDate, endDate);

      const currentSpend = costSummary.totalCost;
      const remainingBudget = Math.max(0, budgetLimit - currentSpend);
      const percentage = (currentSpend / budgetLimit) * 100;
      const isOverBudget = currentSpend > budgetLimit;

      // 预测支出（基于当前趋势）
      const daysElapsed = Math.max(1, Math.floor((Date.now() - startDate.getTime()) / (24 * 60 * 60 * 1000)));
      const dailyAverage = currentSpend / daysElapsed;
      const remainingDays = this.getRemainingDaysInPeriod(period);
      const projectedSpend = currentSpend + (dailyAverage * remainingDays);

      return {
        budgetLimit,
        currentSpend,
        remainingBudget,
        percentage,
        isOverBudget,
        projectedSpend
      };

    } catch (error) {
      console.error('Get budget usage error:', error);
      throw error;
    }
  }

  /**
   * 检查预算预警
   */
  private async checkBudgetAlerts(entityId: string, entityType: 'department' | 'enterprise'): Promise<void> {
    try {
      const budgetUsage = await this.getBudgetUsage(entityType, entityId, 'monthly');
      
      if (budgetUsage.budgetLimit === 0) return;

      const alerts: BudgetAlert[] = [];

      // 检查不同预警阈值
      if (budgetUsage.percentage >= 100) {
        alerts.push(this.createBudgetAlert(entityId, entityType, budgetUsage, 'exceeded'));
      } else if (budgetUsage.percentage >= 90) {
        alerts.push(this.createBudgetAlert(entityId, entityType, budgetUsage, 'critical'));
      } else if (budgetUsage.percentage >= 80) {
        alerts.push(this.createBudgetAlert(entityId, entityType, budgetUsage, 'warning'));
      }

      // 保存预警到缓存
      if (alerts.length > 0) {
        await cacheManager.set(`budget_alerts:${entityType}:${entityId}`, alerts, 3600);
      }

    } catch (error) {
      console.error('Check budget alerts error:', error);
    }
  }

  /**
   * 创建预算预警
   */
  private createBudgetAlert(
    entityId: string, 
    entityType: 'department' | 'enterprise',
    budgetUsage: any,
    alertType: 'warning' | 'critical' | 'exceeded'
  ): BudgetAlert {
    return {
      id: `${entityType}_${entityId}_${alertType}_${Date.now()}`,
      type: entityType,
      entityId,
      entityName: entityId, // 实际应该从数据库获取名称
      budgetLimit: budgetUsage.budgetLimit,
      currentSpend: budgetUsage.currentSpend,
      percentage: budgetUsage.percentage,
      alertType,
      period: 'monthly',
      triggeredAt: new Date()
    };
  }

  /**
   * 更新缓存统计
   */
  private async updateCacheStats(
    groupId: string, 
    departmentId?: string, 
    enterpriseId?: string, 
    cost: number
  ): Promise<void> {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      // 更新组级别统计
      await cacheManager.incrementCounter(`daily_cost:group:${groupId}:${today}`, cost);
      
      // 更新部门级别统计
      if (departmentId) {
        await cacheManager.incrementCounter(`daily_cost:department:${departmentId}:${today}`, cost);
      }
      
      // 更新企业级别统计
      if (enterpriseId) {
        await cacheManager.incrementCounter(`daily_cost:enterprise:${enterpriseId}:${today}`, cost);
      }

    } catch (error) {
      console.warn('Update cache stats error:', error);
    }
  }

  /**
   * 获取时间范围天数
   */
  private getTimeRangeDays(timeRange: string): number {
    switch (timeRange) {
      case '7d': return 7;
      case '30d': return 30;
      case '90d': return 90;
      case '1y': return 365;
      default: return 30;
    }
  }

  /**
   * 获取周期范围
   */
  private getPeriodRange(period: 'daily' | 'weekly' | 'monthly'): { startDate: Date; endDate: Date } {
    const now = new Date();
    let startDate: Date;
    
    switch (period) {
      case 'daily':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case 'weekly':
        const dayOfWeek = now.getDay();
        startDate = new Date(now.getTime() - dayOfWeek * 24 * 60 * 60 * 1000);
        startDate.setHours(0, 0, 0, 0);
        break;
      case 'monthly':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    }
    
    return { startDate, endDate: now };
  }

  /**
   * 获取周期内剩余天数
   */
  private getRemainingDaysInPeriod(period: 'daily' | 'weekly' | 'monthly'): number {
    const now = new Date();
    
    switch (period) {
      case 'daily':
        return 0; // 当天没有剩余
      case 'weekly':
        return 6 - now.getDay();
      case 'monthly':
        const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
        return lastDay - now.getDate();
      default:
        return 0;
    }
  }

  /**
   * 获取特定时间段的成本汇总
   */
  private async getCostSummaryForPeriod(
    entityType: 'enterprise' | 'department' | 'group',
    entityId: string,
    startDate: Date,
    endDate: Date
  ): Promise<{ totalCost: number; totalTokens: number; totalRequests: number }> {
    const whereCondition: any = {
      requestTime: { gte: startDate, lte: endDate }
    };

    switch (entityType) {
      case 'enterprise':
        whereCondition.enterpriseId = entityId;
        break;
      case 'department':
        whereCondition.departmentId = entityId;
        break;
      case 'group':
        whereCondition.groupId = entityId;
        break;
    }

    const result = await prisma.enhancedUsageStat.aggregate({
      where: whereCondition,
      _sum: {
        cost: true,
        totalTokens: true
      },
      _count: true
    });

    return {
      totalCost: Number(result._sum.cost || 0),
      totalTokens: result._sum.totalTokens || 0,
      totalRequests: result._count
    };
  }
}

// 创建单例成本追踪器
export const costTracker = new CostTracker();
export default costTracker;
import { prisma } from '@/lib/prisma';
import { costTracker } from './cost-tracker';

export interface AllocationRule {
  id: string;
  name: string;
  type: 'equal' | 'usage_based' | 'user_count' | 'custom_weight';
  description: string;
  isActive: boolean;
  parameters: Record<string, any>;
}

export interface CostAllocation {
  targetType: 'department' | 'group' | 'user';
  targetId: string;
  targetName: string;
  allocatedCost: number;
  percentage: number;
  basis: 'usage' | 'users' | 'equal' | 'weight';
  basisValue: number;
  period: string;
  createdAt: Date;
}

export interface AllocationReport {
  period: string;
  totalCost: number;
  allocationRule: AllocationRule;
  allocations: CostAllocation[];
  summary: {
    totalAllocated: number;
    unallocatedCost: number;
    allocationAccuracy: number;
  };
}

export class CostAllocator {
  /**
   * 执行成本分摊
   */
  async allocateCosts(
    enterpriseId: string,
    allocationRule: AllocationRule,
    period: 'monthly' | 'weekly' | 'daily' = 'monthly'
  ): Promise<AllocationReport> {
    try {
      // 获取企业总成本
      const costSummary = await costTracker.getCostSummary('enterprise', enterpriseId, '30d');
      const totalCost = costSummary.totalCost;

      if (totalCost === 0) {
        return {
          period: this.getCurrentPeriod(period),
          totalCost: 0,
          allocationRule,
          allocations: [],
          summary: {
            totalAllocated: 0,
            unallocatedCost: 0,
            allocationAccuracy: 100
          }
        };
      }

      let allocations: CostAllocation[] = [];

      switch (allocationRule.type) {
        case 'usage_based':
          allocations = await this.allocateByUsage(enterpriseId, totalCost, period);
          break;
        case 'user_count':
          allocations = await this.allocateByUserCount(enterpriseId, totalCost, period);
          break;
        case 'equal':
          allocations = await this.allocateEqually(enterpriseId, totalCost, period);
          break;
        case 'custom_weight':
          allocations = await this.allocateByCustomWeight(enterpriseId, totalCost, allocationRule.parameters, period);
          break;
      }

      // 计算汇总信息
      const totalAllocated = allocations.reduce((sum, allocation) => sum + allocation.allocatedCost, 0);
      const unallocatedCost = totalCost - totalAllocated;
      const allocationAccuracy = totalCost > 0 ? (totalAllocated / totalCost) * 100 : 100;

      const report: AllocationReport = {
        period: this.getCurrentPeriod(period),
        totalCost,
        allocationRule,
        allocations,
        summary: {
          totalAllocated,
          unallocatedCost,
          allocationAccuracy
        }
      };

      // 保存分摊结果到数据库
      await this.saveAllocationReport(enterpriseId, report);

      return report;

    } catch (error) {
      console.error('Allocate costs error:', error);
      throw error;
    }
  }

  /**
   * 基于使用量分摊
   */
  private async allocateByUsage(
    enterpriseId: string,
    totalCost: number,
    period: string
  ): Promise<CostAllocation[]> {
    // 获取各部门的实际使用成本
    const departments = await prisma.department.findMany({
      where: { enterpriseId },
      select: {
        id: true,
        name: true,
        groups: {
          select: { id: true }
        }
      }
    });

    const allocations: CostAllocation[] = [];
    let totalUsage = 0;

    // 先计算各部门的实际使用量
    const departmentUsage = new Map<string, number>();
    
    for (const department of departments) {
      const departmentCost = await costTracker.getCostSummary('department', department.id, '30d');
      const usage = departmentCost.totalCost;
      departmentUsage.set(department.id, usage);
      totalUsage += usage;
    }

    // 按实际使用量分摊
    for (const department of departments) {
      const usage = departmentUsage.get(department.id) || 0;
      const percentage = totalUsage > 0 ? (usage / totalUsage) * 100 : 0;
      const allocatedCost = totalUsage > 0 ? (usage / totalUsage) * totalCost : 0;

      allocations.push({
        targetType: 'department',
        targetId: department.id,
        targetName: department.name,
        allocatedCost,
        percentage,
        basis: 'usage',
        basisValue: usage,
        period: this.getCurrentPeriod(period),
        createdAt: new Date()
      });
    }

    return allocations;
  }

  /**
   * 基于用户数量分摊
   */
  private async allocateByUserCount(
    enterpriseId: string,
    totalCost: number,
    period: string
  ): Promise<CostAllocation[]> {
    const departments = await prisma.department.findMany({
      where: { enterpriseId },
      select: {
        id: true,
        name: true,
        groups: {
          select: {
            id: true,
            members: {
              select: { id: true }
            }
          }
        }
      }
    });

    const allocations: CostAllocation[] = [];
    let totalUsers = 0;

    // 计算各部门用户数
    const departmentUsers = new Map<string, number>();
    
    for (const department of departments) {
      const userCount = department.groups.reduce((sum, group) => sum + group.members.length, 0);
      departmentUsers.set(department.id, userCount);
      totalUsers += userCount;
    }

    // 按用户数分摊
    for (const department of departments) {
      const userCount = departmentUsers.get(department.id) || 0;
      const percentage = totalUsers > 0 ? (userCount / totalUsers) * 100 : 0;
      const allocatedCost = totalUsers > 0 ? (userCount / totalUsers) * totalCost : 0;

      allocations.push({
        targetType: 'department',
        targetId: department.id,
        targetName: department.name,
        allocatedCost,
        percentage,
        basis: 'users',
        basisValue: userCount,
        period: this.getCurrentPeriod(period),
        createdAt: new Date()
      });
    }

    return allocations;
  }

  /**
   * 平均分摊
   */
  private async allocateEqually(
    enterpriseId: string,
    totalCost: number,
    period: string
  ): Promise<CostAllocation[]> {
    const departments = await prisma.department.findMany({
      where: { enterpriseId },
      select: {
        id: true,
        name: true
      }
    });

    const allocations: CostAllocation[] = [];
    const departmentCount = departments.length;

    if (departmentCount === 0) return allocations;

    const costPerDepartment = totalCost / departmentCount;
    const percentage = 100 / departmentCount;

    for (const department of departments) {
      allocations.push({
        targetType: 'department',
        targetId: department.id,
        targetName: department.name,
        allocatedCost: costPerDepartment,
        percentage,
        basis: 'equal',
        basisValue: 1,
        period: this.getCurrentPeriod(period),
        createdAt: new Date()
      });
    }

    return allocations;
  }

  /**
   * 基于自定义权重分摊
   */
  private async allocateByCustomWeight(
    enterpriseId: string,
    totalCost: number,
    parameters: Record<string, any>,
    period: string
  ): Promise<CostAllocation[]> {
    const departments = await prisma.department.findMany({
      where: { enterpriseId },
      select: {
        id: true,
        name: true
      }
    });

    const weights = parameters.weights || {};
    const allocations: CostAllocation[] = [];
    
    // 计算总权重
    let totalWeight = 0;
    for (const department of departments) {
      const weight = weights[department.id] || 1;
      totalWeight += weight;
    }

    // 按权重分摊
    for (const department of departments) {
      const weight = weights[department.id] || 1;
      const percentage = totalWeight > 0 ? (weight / totalWeight) * 100 : 0;
      const allocatedCost = totalWeight > 0 ? (weight / totalWeight) * totalCost : 0;

      allocations.push({
        targetType: 'department',
        targetId: department.id,
        targetName: department.name,
        allocatedCost,
        percentage,
        basis: 'weight',
        basisValue: weight,
        period: this.getCurrentPeriod(period),
        createdAt: new Date()
      });
    }

    return allocations;
  }

  /**
   * 获取历史分摊报告
   */
  async getAllocationHistory(
    enterpriseId: string,
    limit: number = 12
  ): Promise<AllocationReport[]> {
    try {
      // 从数据库获取历史分摊记录
      const records = await prisma.budgetAllocation.findMany({
        where: { enterpriseId },
        select: {
          id: true,
          departmentId: true,
          period: true,
          allocatedAmount: true,
          allocationBasis: true,
          basisValue: true,
          createdAt: true,
          department: {
            select: {
              name: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        take: limit * 10 // 获取更多记录以便按期间分组
      });

      // 按期间分组
      const reportsByPeriod = new Map<string, AllocationReport>();
      
      for (const record of records) {
        if (!reportsByPeriod.has(record.period)) {
          reportsByPeriod.set(record.period, {
            period: record.period,
            totalCost: 0,
            allocationRule: {
              id: 'historical',
              name: '历史分摊',
              type: record.allocationBasis as any,
              description: '历史分摊记录',
              isActive: false,
              parameters: {}
            },
            allocations: [],
            summary: {
              totalAllocated: 0,
              unallocatedCost: 0,
              allocationAccuracy: 100
            }
          });
        }

        const report = reportsByPeriod.get(record.period)!;
        
        report.allocations.push({
          targetType: 'department',
          targetId: record.departmentId,
          targetName: record.department.name,
          allocatedCost: Number(record.allocatedAmount),
          percentage: 0, // 需要重新计算
          basis: record.allocationBasis as any,
          basisValue: Number(record.basisValue),
          period: record.period,
          createdAt: record.createdAt
        });

        report.summary.totalAllocated += Number(record.allocatedAmount);
      }

      // 计算百分比
      for (const report of reportsByPeriod.values()) {
        report.totalCost = report.summary.totalAllocated;
        for (const allocation of report.allocations) {
          allocation.percentage = report.totalCost > 0 ? 
            (allocation.allocatedCost / report.totalCost) * 100 : 0;
        }
      }

      return Array.from(reportsByPeriod.values())
        .sort((a, b) => b.period.localeCompare(a.period))
        .slice(0, limit);

    } catch (error) {
      console.error('Get allocation history error:', error);
      return [];
    }
  }

  /**
   * 保存分摊报告
   */
  private async saveAllocationReport(
    enterpriseId: string,
    report: AllocationReport
  ): Promise<void> {
    try {
      // 保存分摊记录到数据库
      for (const allocation of report.allocations) {
        if (allocation.targetType === 'department') {
          await prisma.budgetAllocation.create({
            data: {
              enterpriseId,
              departmentId: allocation.targetId,
              period: report.period,
              allocatedAmount: allocation.allocatedCost,
              allocationBasis: allocation.basis,
              basisValue: allocation.basisValue,
              metadata: {
                percentage: allocation.percentage,
                totalCost: report.totalCost,
                ruleName: report.allocationRule.name
              }
            }
          });
        }
      }
    } catch (error) {
      console.warn('Save allocation report error:', error);
    }
  }

  /**
   * 获取当前期间
   */
  private getCurrentPeriod(periodType: 'monthly' | 'weekly' | 'daily'): string {
    const now = new Date();
    
    switch (periodType) {
      case 'monthly':
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      case 'weekly':
        const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay()));
        return `${startOfWeek.getFullYear()}-W${Math.ceil(startOfWeek.getDate() / 7)}`;
      case 'daily':
        return now.toISOString().split('T')[0];
      default:
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    }
  }
}

// 创建单例成本分摊器
export const costAllocator = new CostAllocator();
export default costAllocator;
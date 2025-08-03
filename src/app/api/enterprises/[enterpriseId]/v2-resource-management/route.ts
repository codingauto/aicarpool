/**
 * 企业资源管理API - v2.4简化版
 * 移除复杂的账号池，改为直接的账号管理和分配
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

interface EnterpriseResourceSummary {
  enterprise: {
    id: string;
    name: string;
    planType: string;
    organizationType: string;
  };
  
  // v2.4简化：直接账号管理
  accounts: {
    total: number;
    byServiceType: Record<string, number>;
    byStatus: {
      active: number;
      inactive: number;
      error: number;
    };
  };
  
  // 拼车组绑定概览
  groupBindings: {
    total: number;
    exclusiveBindings: number; // 专属绑定
    sharedBindings: number;    // 共享绑定
    unboundGroups: number;     // 未绑定的组
  };
  
  // 简化的使用统计
  usageOverview: {
    totalGroups: number;
    activeGroups: number;
    totalRequests: number;
    totalCost: number;
    averageCostPerGroup: number;
  };
}

interface AccountAllocationRequest {
  groupId: string;
  serviceType: string;
  bindingType: 'exclusive' | 'shared';
  preferredAccountId?: string;
}

interface AccountAllocationResponse {
  success: boolean;
  data?: {
    allocatedAccount: {
      id: string;
      name: string;
      serviceType: string;
    };
    bindingType: string;
    message: string;
  };
  error?: string;
}

// GET /api/enterprises/[enterpriseId]/v2-resource-management
export async function GET(
  request: NextRequest,
  { params }: { params: { enterpriseId: string } }
): Promise<NextResponse<{ success: boolean; data?: EnterpriseResourceSummary; error?: string }>> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: '未授权访问' },
        { status: 401 }
      );
    }

    const { enterpriseId } = params;

    // 检查企业权限
    const userEnterprise = await prisma.userEnterprise.findFirst({
      where: {
        enterpriseId,
        userId: session.user.id,
        role: { in: ['owner', 'admin'] }
      },
      include: {
        enterprise: {
          select: {
            id: true,
            name: true,
            planType: true,
            organizationType: true
          }
        }
      }
    });

    if (!userEnterprise) {
      return NextResponse.json(
        { success: false, error: '无权限访问此企业' },
        { status: 403 }
      );
    }

    const enterprise = userEnterprise.enterprise;

    // 获取企业的AI账号
    const accounts = await prisma.aiServiceAccount.findMany({
      where: { enterpriseId },
      select: {
        id: true,
        name: true,
        serviceType: true,
        isEnabled: true,
        status: true,
        groupBindings: {
          where: { isActive: true },
          select: {
            bindingType: true,
            groupId: true
          }
        }
      }
    });

    // 统计账号信息
    const accountStats = {
      total: accounts.length,
      byServiceType: {} as Record<string, number>,
      byStatus: {
        active: 0,
        inactive: 0,
        error: 0
      }
    };

    accounts.forEach(account => {
      // 按服务类型统计
      accountStats.byServiceType[account.serviceType] = 
        (accountStats.byServiceType[account.serviceType] || 0) + 1;

      // 按状态统计
      if (account.isEnabled && account.status === 'active') {
        accountStats.byStatus.active++;
      } else if (!account.isEnabled) {
        accountStats.byStatus.inactive++;
      } else {
        accountStats.byStatus.error++;
      }
    });

    // 获取企业的拼车组
    const groups = await prisma.group.findMany({
      where: { enterpriseId },
      select: {
        id: true,
        name: true,
        status: true,
        accountBindings: {
          where: { isActive: true },
          select: {
            bindingType: true
          }
        }
      }
    });

    // 统计绑定信息
    let exclusiveBindings = 0;
    let sharedBindings = 0;
    let unboundGroups = 0;

    groups.forEach(group => {
      if (group.accountBindings.length === 0) {
        unboundGroups++;
      } else {
        group.accountBindings.forEach(binding => {
          if (binding.bindingType === 'exclusive') {
            exclusiveBindings++;
          } else {
            sharedBindings++;
          }
        });
      }
    });

    // 计算最近30天的使用统计
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentUsage = await prisma.usageStat.findMany({
      where: {
        enterpriseId,
        requestTime: { gte: thirtyDaysAgo }
      },
      select: {
        groupId: true,
        cost: true
      }
    });

    // 聚合使用数据
    const activeGroups = new Set(recentUsage.map(u => u.groupId)).size;
    const totalRequests = recentUsage.length;
    const totalCost = recentUsage.reduce((sum, u) => sum + Number(u.cost), 0);
    const averageCostPerGroup = activeGroups > 0 ? totalCost / activeGroups : 0;

    const result: EnterpriseResourceSummary = {
      enterprise,
      accounts: accountStats,
      groupBindings: {
        total: exclusiveBindings + sharedBindings,
        exclusiveBindings,
        sharedBindings,
        unboundGroups
      },
      usageOverview: {
        totalGroups: groups.length,
        activeGroups,
        totalRequests,
        totalCost: Math.round(totalCost * 100) / 100,
        averageCostPerGroup: Math.round(averageCostPerGroup * 100) / 100
      }
    };

    return NextResponse.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('获取企业资源管理信息失败:', error);
    return NextResponse.json(
      { success: false, error: '获取资源信息失败' },
      { status: 500 }
    );
  }
}

// POST /api/enterprises/[enterpriseId]/v2-resource-management/allocate
export async function POST(
  request: NextRequest,
  { params }: { params: { enterpriseId: string } }
): Promise<NextResponse<AccountAllocationResponse>> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: '未授权访问' },
        { status: 401 }
      );
    }

    const { enterpriseId } = params;
    const body: AccountAllocationRequest = await request.json();
    const { groupId, serviceType, bindingType, preferredAccountId } = body;

    // 检查企业权限
    const userEnterprise = await prisma.userEnterprise.findFirst({
      where: {
        enterpriseId,
        userId: session.user.id,
        role: { in: ['owner', 'admin'] }
      }
    });

    if (!userEnterprise) {
      return NextResponse.json(
        { success: false, error: '无权限操作此企业' },
        { status: 403 }
      );
    }

    // 验证拼车组属于该企业
    const group = await prisma.group.findFirst({
      where: {
        id: groupId,
        enterpriseId
      },
      select: {
        id: true,
        name: true,
        organizationType: true,
        bindingMode: true
      }
    });

    if (!group) {
      return NextResponse.json(
        { success: false, error: '拼车组不存在或不属于该企业' },
        { status: 404 }
      );
    }

    // 查找可用账号
    let targetAccount;
    
    if (preferredAccountId) {
      // 使用指定账号
      targetAccount = await prisma.aiServiceAccount.findFirst({
        where: {
          id: preferredAccountId,
          enterpriseId,
          serviceType,
          isEnabled: true,
          status: 'active'
        }
      });
      
      if (!targetAccount) {
        return NextResponse.json(
          { success: false, error: '指定的账号不可用' },
          { status: 400 }
        );
      }
    } else {
      // 智能选择账号
      const availableAccounts = await prisma.aiServiceAccount.findMany({
        where: {
          enterpriseId,
          serviceType,
          isEnabled: true,
          status: 'active'
        },
        include: {
          groupBindings: {
            where: { isActive: true },
            select: { bindingType: true }
          }
        }
      });

      if (availableAccounts.length === 0) {
        return NextResponse.json(
          { success: false, error: `没有可用的${serviceType}账号` },
          { status: 400 }
        );
      }

      // 简化的分配策略：优先选择负载最少的账号
      targetAccount = availableAccounts.reduce((best, current) => {
        const currentLoad = current.groupBindings.length;
        const bestLoad = best.groupBindings.length;
        return currentLoad < bestLoad ? current : best;
      });
    }

    // 创建绑定
    const binding = await prisma.groupAccountBinding.upsert({
      where: {
        groupId_accountId: {
          groupId,
          accountId: targetAccount.id
        }
      },
      update: {
        bindingType,
        isActive: true,
        updatedAt: new Date()
      },
      create: {
        groupId,
        accountId: targetAccount.id,
        bindingType,
        isActive: true
      }
    });

    console.log(`[v2.4 Enterprise Allocation] Allocated account ${targetAccount.id} to group ${groupId} with ${bindingType} binding`);

    return NextResponse.json({
      success: true,
      data: {
        allocatedAccount: {
          id: targetAccount.id,
          name: targetAccount.name,
          serviceType: targetAccount.serviceType
        },
        bindingType,
        message: `成功为拼车组分配${serviceType}账号，绑定模式：${bindingType === 'exclusive' ? '专属' : '共享'}`
      }
    });

  } catch (error) {
    console.error('企业账号分配失败:', error);
    return NextResponse.json(
      { success: false, error: '账号分配失败' },
      { status: 500 }
    );
  }
}
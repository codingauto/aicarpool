/**
 * 拼车组资源管理API - v2.4简化版
 * 支持一对一专属绑定和企业内共享绑定两种模式
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

interface GroupResourceInfo {
  group: {
    id: string;
    name: string;
    description: string;
    organizationType: string; // v2.4新增
    bindingMode: string;      // v2.4新增
    memberCount: number;
  };
  
  // v2.4简化：直接绑定信息
  accountBindings: {
    id: string;
    bindingType: 'exclusive' | 'shared';
    dailyLimit?: number;
    monthlyBudget?: number;
    account: {
      id: string;
      name: string;
      platform: string;
      status: string;
      isEnabled: boolean;
      lastUsedAt?: string;
    };
    createdAt: string;
  }[];
  
  // 可用账号列表（用于绑定）
  availableAccounts: {
    id: string;
    name: string;
    platform: string;
    status: string;
    isEnabled: boolean;
    currentBindings: number; // v2.4新增：当前绑定数
    maxConcurrentGroups: number; // v2.4新增：最大并发绑定数
  }[];
  
  // 简化的使用统计
  usageSummary: {
    last30Days: {
      totalRequests: number;
      totalCost: number;
      averageDailyCost: number;
    };
  };
}

/**
 * GET /api/groups/[groupId]/resources
 * 获取拼车组资源配置信息
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { groupId: string } }
): Promise<NextResponse<{ success: boolean; data?: GroupResourceInfo; error?: string }>> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: '未授权访问' },
        { status: 401 }
      );
    }

    const { groupId } = params;

    // 验证用户权限
    const groupMember = await prisma.groupMember.findFirst({
      where: {
        groupId,
        userId: session.user.id
      },
      include: {
        group: {
          select: {
            id: true,
            name: true,
            description: true,
            organizationType: true,
            bindingMode: true,
            enterpriseId: true,
            _count: {
              select: { members: true }
            }
          }
        }
      }
    });

    if (!groupMember) {
      return NextResponse.json(
        { success: false, error: '无权限访问该拼车组' },
        { status: 403 }
      );
    }

    const group = groupMember.group;

    // 获取当前账号绑定
    const accountBindings = await prisma.groupAccountBinding.findMany({
      where: {
        groupId,
        isActive: true
      },
      include: {
        account: {
          select: {
            id: true,
            name: true,
            platform: true,
            status: true,
            isEnabled: true,
            lastUsedAt: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    // 获取可用账号（根据组织类型）
    let availableAccounts: any[] = [];
    
    if (group.enterpriseId) {
      // 企业模式：显示企业内所有账号
      const enterpriseAccounts = await prisma.aiServiceAccount.findMany({
        where: {
          enterpriseId: group.enterpriseId,
          isEnabled: true
        },
        select: {
          id: true,
          name: true,
          platform: true,
          status: true,
          isEnabled: true,
          maxConcurrentGroups: true,
          groupBindings: {
            where: { isActive: true },
            select: { id: true }
          }
        }
      });

      availableAccounts = enterpriseAccounts.map(account => ({
        id: account.id,
        name: account.name,
        platform: account.platform,
        status: account.status,
        isEnabled: account.isEnabled,
        currentBindings: account.groupBindings.length,
        maxConcurrentGroups: account.maxConcurrentGroups
      }));
    }

    // 获取最近30天使用统计
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentUsage = await prisma.usageStat.findMany({
      where: {
        groupId,
        requestTime: { gte: thirtyDaysAgo }
      },
      select: {
        cost: true,
        requestTime: true
      }
    });

    const totalRequests = recentUsage.length;
    const totalCost = recentUsage.reduce((sum, stat) => sum + Number(stat.cost), 0);
    const averageDailyCost = totalCost / 30;

    const result: GroupResourceInfo = {
      group: {
        id: group.id,
        name: group.name,
        description: group.description || '',
        organizationType: group.organizationType,
        bindingMode: group.bindingMode,
        memberCount: group._count.members
      },
      
      accountBindings: accountBindings.map(binding => ({
        id: binding.id,
        bindingType: binding.bindingType as 'exclusive' | 'shared',
        dailyLimit: binding.dailyLimit,
        monthlyBudget: binding.monthlyBudget ? Number(binding.monthlyBudget) : undefined,
        account: {
          id: binding.account.id,
          name: binding.account.name,
          platform: binding.account.platform,
          status: binding.account.status,
          isEnabled: binding.account.isEnabled,
          lastUsedAt: binding.account.lastUsedAt?.toISOString()
        },
        createdAt: binding.createdAt.toISOString()
      })),
      
      availableAccounts,
      
      usageSummary: {
        last30Days: {
          totalRequests,
          totalCost: Math.round(totalCost * 100) / 100,
          averageDailyCost: Math.round(averageDailyCost * 100) / 100
        }
      }
    };

    return NextResponse.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('获取拼车组资源配置失败:', error);
    return NextResponse.json(
      { success: false, error: '获取资源配置失败' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/groups/[groupId]/resources
 * 更新拼车组资源配置（v2.4简化版）
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { groupId: string } }
): Promise<NextResponse> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: '未授权访问' },
        { status: 401 }
      );
    }

    const { groupId } = params;
    const body = await request.json();
    const { bindingMode, organizationType } = body;

    // 验证管理员权限
    const groupMember = await prisma.groupMember.findFirst({
      where: {
        groupId,
        userId: session.user.id,
        role: { in: ['owner', 'admin'] }
      }
    });

    if (!groupMember) {
      return NextResponse.json(
        { success: false, error: '无权限修改该拼车组配置' },
        { status: 403 }
      );
    }

    // 更新组配置
    const updatedGroup = await prisma.group.update({
      where: { id: groupId },
      data: {
        bindingMode: bindingMode || undefined,
        organizationType: organizationType || undefined,
        updatedAt: new Date()
      }
    });

    console.log(`[v2.4 Group Config] Updated group ${groupId} configuration`);

    return NextResponse.json({
      success: true,
      data: {
        groupId: updatedGroup.id,
        bindingMode: updatedGroup.bindingMode,
        organizationType: updatedGroup.organizationType,
        message: '拼车组配置更新成功'
      }
    });

  } catch (error) {
    console.error('更新拼车组资源配置失败:', error);
    return NextResponse.json(
      { success: false, error: '更新配置失败' },
      { status: 500 }
    );
  }
}
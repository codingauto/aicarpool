import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { createApiResponse } from '@/lib/middleware';
import { getUserFromRequest } from '@/lib/auth';
import { EnterpriseAccountAllocator } from '@/lib/enterprise/account-allocator';
import { cacheManager } from '@/lib/cache';

const allocationRequestSchema = z.object({
  serviceType: z.enum(['claude', 'gemini', 'ampcode', 'kimi', 'zhipu', 'qwen']),
  estimatedTokens: z.number().optional(),
  priority: z.enum(['high', 'normal', 'low']).default('normal')
});

// POST /api/groups/[id]/ai-allocation - 智能分配AI账号
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return createApiResponse(false, null, '未授权', 401);
    }

    const resolvedParams = await params;
    const groupId = resolvedParams.id;

    // 检查用户是否为组成员
    const membership = await prisma.groupMember.findFirst({
      where: {
        groupId,
        userId: user.id,
        status: 'active',
      },
    });

    if (!membership) {
      return createApiResponse(false, null, '无权访问该拼车组', 403);
    }

    const body = await request.json();
    const { serviceType, estimatedTokens, priority } = allocationRequestSchema.parse(body);

    const allocator = new EnterpriseAccountAllocator();
    
    const account = await allocator.allocateAccount({
      groupId,
      serviceType,
      estimatedTokens,
      priority
    });

    if (!account) {
      return createApiResponse(false, null, '暂无可用账号', 503);
    }

    // 记录分配日志
    await this.recordAllocationLog(groupId, user.id, account.id, serviceType);

    return createApiResponse(true, {
      accountId: account.id,
      accountName: account.name,
      serviceType: account.serviceType,
      allocatedAt: new Date().toISOString()
    }, '账号分配成功', 200);
    
  } catch (error) {
    if (error instanceof z.ZodError) {
      return createApiResponse(false, null, error.issues[0].message, 400);
    }
    
    console.error('Account allocation error:', error);
    return createApiResponse(false, null, '账号分配失败', 500);
  }
}

// GET /api/groups/[id]/ai-allocation/status - 获取分配状态和统计
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return createApiResponse(false, null, '未授权', 401);
    }

    const resolvedParams = await params;
    const groupId = resolvedParams.id;

    // 检查用户是否为组成员
    const membership = await prisma.groupMember.findFirst({
      where: {
        groupId,
        userId: user.id,
        status: 'active',
      },
    });

    if (!membership) {
      return createApiResponse(false, null, '无权访问该拼车组', 403);
    }

    // 获取可用账号池统计
    const poolBindings = await prisma.groupPoolBinding.findMany({
      where: { groupId, isActive: true },
      include: {
        pool: {
          include: {
            accountBindings: {
              where: { isActive: true },
              include: {
                account: {
                  where: { isEnabled: true, status: 'active' }
                }
              }
            }
          }
        }
      }
    });

    const allocationStatus = {
      totalPools: poolBindings.length,
      totalAccounts: poolBindings.reduce((sum, binding) => sum + binding.pool.accountBindings.length, 0),
      serviceBreakdown: {} as Record<string, number>,
      poolStatus: [] as any[]
    };

    // 统计各服务类型的账号数量
    for (const binding of poolBindings) {
      for (const accountBinding of binding.pool.accountBindings) {
        const serviceType = accountBinding.account?.serviceType;
        if (serviceType) {
          allocationStatus.serviceBreakdown[serviceType] = 
            (allocationStatus.serviceBreakdown[serviceType] || 0) + 1;
        }
      }
      
      // 获取池的负载状态
      const poolLoad = await this.getPoolLoadStatus(binding.poolId);
      allocationStatus.poolStatus.push({
        poolId: binding.poolId,
        poolName: binding.pool.name,
        poolType: binding.pool.poolType,
        bindingType: binding.bindingType,
        priority: binding.priority,
        accountCount: binding.pool.accountBindings.length,
        currentLoad: poolLoad.averageLoad,
        usageLimits: {
          hourly: binding.usageLimitHourly,
          daily: binding.usageLimitDaily,
          monthly: binding.usageLimitMonthly
        }
      });
    }

    return createApiResponse(true, allocationStatus, '获取分配状态成功', 200);
    
  } catch (error) {
    console.error('Get allocation status error:', error);
    return createApiResponse(false, null, '获取分配状态失败', 500);
  }
}

// 辅助方法
async function recordAllocationLog(
  groupId: string,
  userId: string,
  accountId: string,
  serviceType: string
): Promise<void> {
  try {
    // 这里可以记录到专门的分配日志表或使用现有的统计表
    console.log(`Account allocated - Group: ${groupId}, User: ${userId}, Account: ${accountId}, Service: ${serviceType}`);
  } catch (error) {
    console.error('Record allocation log error:', error);
  }
}

async function getPoolLoadStatus(poolId: string): Promise<{ averageLoad: number }> {
  try {
    // 从缓存获取池的平均负载
    const load = await cacheManager.get<number>(`pool:load:${poolId}`) || 0;
    return { averageLoad: load };
  } catch (error) {
    console.error('Get pool load error:', error);
    return { averageLoad: 0 };
  }
}
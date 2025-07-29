import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAuth, createApiResponse } from '@/lib/middleware';
import { ipPackageManager } from '@/lib/ip-packages';
import { prisma } from '@/lib/prisma';

const createSubscriptionSchema = z.object({
  packageId: z.string(),
  serverId: z.string().optional(),
  autoRenew: z.boolean().default(true),
  customEndDate: z.string().datetime().optional(),
});

// 获取拼车组的IP套餐订阅列表
async function getHandler(req: { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: groupId } = await params;

    // 验证用户权限
    const membership = await prisma.groupMember.findFirst({
      where: {
        groupId,
        userId: req.user.id,
        status: 'active',
      },
    });

    if (!membership) {
      return createApiResponse(false, null, '权限不足', 403);
    }

    const subscriptions = await ipPackageManager.getGroupSubscriptions(groupId);
    
    return createApiResponse(true(subscriptions), '获取订阅列表成功');
  } catch (error) {
    console.error('Get IP subscriptions error:', error);
    return createApiResponse(false, null, '获取订阅列表失败', 500);
  }
}

// 创建新的IP套餐订阅
async function postHandler(req: { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: groupId } = await params;
    const body = await req.json();
    const validatedData = createSubscriptionSchema.parse(body);

    // 验证用户是否为管理员
    const membership = await prisma.groupMember.findFirst({
      where: {
        groupId,
        userId: req.user.id,
        role: { in: ['admin', 'owner'] },
        status: 'active',
      },
    });

    if (!membership) {
      return createApiResponse(false, null, '只有管理员可以创建订阅', 403);
    }

    const { packageId, serverId, autoRenew, customEndDate } = validatedData;

    const subscription = await ipPackageManager.createSubscription(
      groupId,
      packageId,
      serverId,
      {
        autoRenew,
        customEndDate: customEndDate ? new Date(customEndDate) : undefined,
      }
    );

    return createApiResponse(true(subscription), '订阅创建成功');
  } catch (error) {
    if (error instanceof z.ZodError) {
      return createApiResponse(false, null, error.errors[0].message, 400);
    }

    console.error('Create IP subscription error:', error);
    const errorMessage = error instanceof Error ? error.message : '创建订阅失败';
    return createApiResponse(false, null, errorMessage, 500);
  }
}

export const GET = withAuth(getHandler);
export const POST = withAuth(postHandler);
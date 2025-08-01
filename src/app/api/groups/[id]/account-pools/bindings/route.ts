import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { createApiResponse } from '@/lib/middleware';
import { getUserFromRequest } from '@/lib/auth';
import { cacheManager } from '@/lib/cache';

const createPoolBindingSchema = z.object({
  poolId: z.string().min(1, '账号池ID不能为空'),
  bindingType: z.enum(['primary', 'fallback', 'shared']).default('shared'),
  usageLimitHourly: z.number().min(0).default(0),
  usageLimitDaily: z.number().min(0).default(0),
  usageLimitMonthly: z.number().min(0).default(0),
  priority: z.number().min(1).default(1)
});

// GET /api/groups/[id]/account-pools/bindings - 获取拼车组绑定的账号池
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
    
    const bindings = await cacheManager.getOrSet(
      `group:pool_bindings:${groupId}`,
      async () => {
        return await prisma.groupPoolBinding.findMany({
          where: { groupId, isActive: true },
          include: {
            pool: {
              include: {
                accountBindings: {
                  where: { isActive: true },
                  include: {
                    account: {
                      select: {
                        id: true,
                        name: true,
                        serviceType: true,
                        status: true,
                        lastUsedAt: true
                      }
                    }
                  }
                }
              }
            }
          },
          orderBy: { priority: 'asc' }
        });
      },
      { ttl: 300 } // 5分钟缓存
    );

    return createApiResponse(true, bindings, '获取账号池绑定成功', 200);
    
  } catch (error) {
    console.error('Get group pool bindings error:', error);
    return createApiResponse(false, null, '获取账号池绑定失败', 500);
  }
}

// POST /api/groups/[id]/account-pools/bindings - 创建拼车组与账号池绑定
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

    // 检查用户是否为组管理员
    const membership = await prisma.groupMember.findFirst({
      where: {
        groupId,
        userId: user.id,
        role: { in: ['admin', 'owner'] },
        status: 'active',
      },
    });

    if (!membership) {
      return createApiResponse(false, null, '无权限管理该拼车组', 403);
    }

    const body = await request.json();
    const validatedData = createPoolBindingSchema.parse(body);

    // 检查账号池是否存在
    const pool = await prisma.accountPool.findUnique({
      where: { id: validatedData.poolId }
    });

    if (!pool) {
      return createApiResponse(false, null, '账号池不存在', 404);
    }

    // 创建绑定关系
    const binding = await prisma.groupPoolBinding.create({
      data: {
        groupId,
        poolId: validatedData.poolId,
        bindingType: validatedData.bindingType,
        usageLimitHourly: validatedData.usageLimitHourly,
        usageLimitDaily: validatedData.usageLimitDaily,
        usageLimitMonthly: validatedData.usageLimitMonthly,
        priority: validatedData.priority
      },
      include: {
        pool: {
          include: {
            accountBindings: {
              include: {
                account: true
              }
            }
          }
        }
      }
    });

    // 清除相关缓存
    await cacheManager.del(`group:pool_bindings:${groupId}`);

    return createApiResponse(true, binding, '账号池绑定创建成功', 201);
    
  } catch (error) {
    if (error instanceof z.ZodError) {
      return createApiResponse(false, null, error.issues[0].message, 400);
    }
    
    console.error('Create group pool binding error:', error);
    return createApiResponse(false, null, '创建账号池绑定失败', 500);
  }
}

// DELETE /api/groups/[id]/account-pools/bindings - 删除账号池绑定
export async function DELETE(
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

    // 检查用户是否为组管理员
    const membership = await prisma.groupMember.findFirst({
      where: {
        groupId,
        userId: user.id,
        role: { in: ['admin', 'owner'] },
        status: 'active',
      },
    });

    if (!membership) {
      return createApiResponse(false, null, '无权限管理该拼车组', 403);
    }

    const { searchParams } = new URL(request.url);
    const poolId = searchParams.get('poolId');

    if (!poolId) {
      return createApiResponse(false, null, '缺少poolId参数', 400);
    }

    // 删除绑定关系
    const deletedBinding = await prisma.groupPoolBinding.delete({
      where: {
        groupId_poolId: {
          groupId,
          poolId
        }
      }
    });

    // 清除相关缓存
    await cacheManager.del(`group:pool_bindings:${groupId}`);

    return createApiResponse(true, deletedBinding, '账号池绑定删除成功', 200);
    
  } catch (error) {
    console.error('Delete group pool binding error:', error);
    return createApiResponse(false, null, '删除账号池绑定失败', 500);
  }
}
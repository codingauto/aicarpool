import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { createApiResponse } from '@/lib/middleware';
import { getUserFromRequest } from '@/lib/auth';
import { cacheManager } from '@/lib/cache';

const updateAccountPoolSchema = z.object({
  name: z.string().min(1, '账号池名称不能为空').optional(),
  description: z.string().optional(),
  poolType: z.enum(['shared', 'dedicated']).optional(),
  loadBalanceStrategy: z.enum(['round_robin', 'least_connections', 'weighted']).optional(),
  maxLoadPerAccount: z.number().min(1).max(100).optional(),
  priority: z.number().min(1).optional(),
  isActive: z.boolean().optional()
});

// GET /api/enterprises/[enterpriseId]/account-pools/[poolId] - 获取账号池详情
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ enterpriseId: string; poolId: string }> }
) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return createApiResponse(false, null, '未授权', 401);
    }

    const resolvedParams = await params;
    const { enterpriseId, poolId } = resolvedParams;

    const pool = await prisma.accountPool.findFirst({
      where: { 
        id: poolId,
        enterpriseId 
      },
      include: {
        accountBindings: {
          include: {
            account: {
              select: {
                id: true,
                name: true,
                serviceType: true,
                status: true,
                isEnabled: true
              }
            }
          }
        },
        groupBindings: {
          include: {
            group: {
              select: {
                id: true,
                name: true
              }
            }
          }
        },
        _count: {
          select: {
            accountBindings: true,
            groupBindings: true
          }
        }
      }
    });

    if (!pool) {
      return createApiResponse(false, null, '账号池不存在', 404);
    }

    return createApiResponse(true, pool, '获取账号池详情成功', 200);
    
  } catch (error) {
    console.error('Get account pool error:', error);
    return createApiResponse(false, null, '获取账号池详情失败', 500);
  }
}

// PUT /api/enterprises/[enterpriseId]/account-pools/[poolId] - 更新账号池
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ enterpriseId: string; poolId: string }> }
) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return createApiResponse(false, null, '未授权', 401);
    }

    const resolvedParams = await params;
    const { enterpriseId, poolId } = resolvedParams;

    // 检查账号池是否存在
    const existingPool = await prisma.accountPool.findFirst({
      where: { 
        id: poolId,
        enterpriseId 
      }
    });

    if (!existingPool) {
      return createApiResponse(false, null, '账号池不存在', 404);
    }

    const body = await request.json();
    const validatedData = updateAccountPoolSchema.parse(body);

    // 更新账号池
    const updatedPool = await prisma.accountPool.update({
      where: { id: poolId },
      data: validatedData,
      include: {
        accountBindings: {
          include: {
            account: {
              select: {
                id: true,
                name: true,
                serviceType: true,
                status: true,
                isEnabled: true
              }
            }
          }
        },
        groupBindings: {
          include: {
            group: {
              select: {
                id: true,
                name: true
              }
            }
          }
        },
        _count: {
          select: {
            accountBindings: true,
            groupBindings: true
          }
        }
      }
    });

    // 清理相关缓存
    await cacheManager.del(`enterprise:pools:${enterpriseId}`);
    await cacheManager.del(`pool:${poolId}`);

    return createApiResponse(true, updatedPool, '账号池更新成功', 200);
    
  } catch (error) {
    if (error instanceof z.ZodError) {
      return createApiResponse(false, null, error.issues[0].message, 400);
    }
    
    console.error('Update account pool error:', error);
    return createApiResponse(false, null, '更新账号池失败', 500);
  }
}

// DELETE /api/enterprises/[enterpriseId]/account-pools/[poolId] - 删除账号池
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ enterpriseId: string; poolId: string }> }
) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return createApiResponse(false, null, '未授权', 401);
    }

    const resolvedParams = await params;
    const { enterpriseId, poolId } = resolvedParams;

    // 检查账号池是否存在
    const pool = await prisma.accountPool.findFirst({
      where: { 
        id: poolId,
        enterpriseId 
      },
      include: {
        groupBindings: true
      }
    });

    if (!pool) {
      return createApiResponse(false, null, '账号池不存在', 404);
    }

    // 检查是否有关联的拼车组
    if (pool.groupBindings.length > 0) {
      return createApiResponse(false, null, '该账号池还有关联的拼车组，请先解除绑定', 400);
    }

    // 删除账号池（会级联删除账号绑定）
    await prisma.accountPool.delete({
      where: { id: poolId }
    });

    // 清理相关缓存
    await cacheManager.del(`enterprise:pools:${enterpriseId}`);
    await cacheManager.del(`pool:${poolId}`);

    return createApiResponse(true, { id: poolId }, '账号池删除成功', 200);
    
  } catch (error) {
    console.error('Delete account pool error:', error);
    return createApiResponse(false, null, '删除账号池失败', 500);
  }
}
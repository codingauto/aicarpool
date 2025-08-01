import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { createApiResponse } from '@/lib/middleware';
import { getUserFromRequest } from '@/lib/auth';
import { cacheManager } from '@/lib/cache';

const createAccountPoolSchema = z.object({
  name: z.string().min(1, '账号池名称不能为空'),
  description: z.string().optional(),
  poolType: z.enum(['shared', 'dedicated']).default('shared'),
  loadBalanceStrategy: z.enum(['round_robin', 'least_connections', 'weighted']).default('round_robin'),
  maxLoadPerAccount: z.number().min(1).max(100).default(80),
  priority: z.number().min(1).default(1),
  accountIds: z.array(z.string()).default([])
});

// GET /api/enterprises/[enterpriseId]/account-pools - 获取企业账号池列表
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ enterpriseId: string }> }
) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return createApiResponse(false, null, '未授权', 401);
    }

    const resolvedParams = await params;
    const { enterpriseId } = resolvedParams;

    // 检查用户是否有企业管理权限
    // TODO: 实现企业权限验证逻辑
    
    const pools = await prisma.accountPool.findMany({
      where: { enterpriseId },
      include: {
        accountBindings: {
          include: {
            account: {
              select: {
                id: true,
                name: true,
                serviceType: true,
                status: true
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
      },
      orderBy: { priority: 'asc' }
    });

    return createApiResponse(true, pools, '获取账号池列表成功', 200);
    
  } catch (error) {
    console.error('Get account pools error:', error);
    return createApiResponse(false, null, '获取账号池列表失败', 500);
  }
}

// POST /api/enterprises/[enterpriseId]/account-pools - 创建账号池
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ enterpriseId: string }> }
) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return createApiResponse(false, null, '未授权', 401);
    }

    const resolvedParams = await params;
    const { enterpriseId } = resolvedParams;

    // 检查用户是否有企业管理权限
    // TODO: 实现企业权限验证逻辑

    const body = await request.json();
    const validatedData = createAccountPoolSchema.parse(body);

    // 创建账号池
    const pool = await prisma.accountPool.create({
      data: {
        enterpriseId,
        name: validatedData.name,
        description: validatedData.description,
        poolType: validatedData.poolType,
        loadBalanceStrategy: validatedData.loadBalanceStrategy,
        maxLoadPerAccount: validatedData.maxLoadPerAccount,
        priority: validatedData.priority,
        accountBindings: {
          create: validatedData.accountIds.map((accountId: string) => ({
            accountId,
            weight: 1,
            maxLoadPercentage: validatedData.maxLoadPerAccount
          }))
        }
      },
      include: {
        accountBindings: {
          include: {
            account: true
          }
        }
      }
    });

    // 清理相关缓存
    await cacheManager.del(`enterprise:pools:${enterpriseId}`);

    return createApiResponse(true, pool, '账号池创建成功', 201);
    
  } catch (error) {
    if (error instanceof z.ZodError) {
      return createApiResponse(false, null, error.issues[0].message, 400);
    }
    
    console.error('Create account pool error:', error);
    return createApiResponse(false, null, '创建账号池失败', 500);
  }
}
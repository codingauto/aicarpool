import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { createNextResponse } from '@/lib/middleware';
import { getUserFromRequest } from '@/lib/auth';
import { cacheManager } from '@/lib/cache';

const updateEnterpriseSchema = z.object({
  name: z.string().min(1, '企业名称不能为空').optional(),
  planType: z.enum(['basic', 'enterprise', 'custom']).optional(),
  settings: z.record(z.any()).optional()
});

// GET /api/enterprises/[enterpriseId] - 获取企业详情
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ enterpriseId: string }> }
) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return createNextResponse(false, null, '未授权', 401);
    }

    const resolvedParams = await params;
    const { enterpriseId } = resolvedParams;

    // 验证用户是否有权限访问此企业
    const userEnterprise = await prisma.userEnterprise.findFirst({
      where: {
        userId: user.id,
        enterpriseId: enterpriseId,
        isActive: true
      }
    });

    if (!userEnterprise) {
      return createNextResponse(false, null, '没有权限访问该企业', 403);
    }

    const enterprise = await prisma.enterprise.findUnique({
      where: { id: enterpriseId },
      include: {
        departments: {
          include: {
            _count: {
              select: {
                children: true,
                groups: true
              }
            }
          }
        },
        accountPools: {
          include: {
            _count: {
              select: {
                accountBindings: true,
                groupBindings: true
              }
            }
          }
        },
        _count: {
          select: {
            departments: true,
            accountPools: true,
            userEnterprises: true,
            groups: true
          }
        }
      }
    });

    if (!enterprise) {
      return createNextResponse(false, null, '企业不存在', 404);
    }

    // 添加用户在该企业的角色信息
    const enterpriseData = {
      ...enterprise,
      userRole: userEnterprise.role
    };

    return createNextResponse(true, enterpriseData, '获取企业详情成功', 200);
    
  } catch (error) {
    console.error('Get enterprise error:', error);
    return createNextResponse(false, null, '获取企业详情失败', 500);
  }
}

// PUT /api/enterprises/[enterpriseId] - 更新企业信息
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ enterpriseId: string }> }
) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return createNextResponse(false, null, '未授权', 401);
    }

    const resolvedParams = await params;
    const { enterpriseId } = resolvedParams;

    // 检查企业是否存在
    const existingEnterprise = await prisma.enterprise.findUnique({
      where: { id: enterpriseId }
    });

    if (!existingEnterprise) {
      return createNextResponse(false, null, '企业不存在', 404);
    }

    const body = await request.json();
    const validatedData = updateEnterpriseSchema.parse(body);

    const updatedEnterprise = await prisma.enterprise.update({
      where: { id: enterpriseId },
      data: validatedData,
      include: {
        departments: {
          include: {
            _count: {
              select: {
                children: true,
                groups: true
              }
            }
          }
        },
        accountPools: {
          include: {
            _count: {
              select: {
                accountBindings: true,
                groupBindings: true
              }
            }
          }
        },
        _count: {
          select: {
            departments: true,
            accountPools: true
          }
        }
      }
    });

    // 清理相关缓存
    await cacheManager.invalidateEnterpriseCache(enterpriseId);

    return createNextResponse(true, updatedEnterprise, '企业信息更新成功', 200);
    
  } catch (error) {
    if (error instanceof z.ZodError) {
      return createNextResponse(false, null, error.issues[0].message, 400);
    }
    
    console.error('Update enterprise error:', error);
    return createNextResponse(false, null, '更新企业信息失败', 500);
  }
}

// DELETE /api/enterprises/[enterpriseId] - 删除企业
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ enterpriseId: string }> }
) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return createNextResponse(false, null, '未授权', 401);
    }

    const resolvedParams = await params;
    const { enterpriseId } = resolvedParams;

    // 检查企业是否存在
    const enterprise = await prisma.enterprise.findUnique({
      where: { id: enterpriseId },
      include: {
        departments: true,
        accountPools: true
      }
    });

    if (!enterprise) {
      return createNextResponse(false, null, '企业不存在', 404);
    }

    // 检查是否有关联的部门或账号池
    if (enterprise.departments.length > 0) {
      return createNextResponse(false, null, '该企业下还有部门，请先删除所有部门', 400);
    }

    if (enterprise.accountPools.length > 0) {
      return createNextResponse(false, null, '该企业下还有账号池，请先删除所有账号池', 400);
    }

    await prisma.enterprise.delete({
      where: { id: enterpriseId }
    });

    // 清理相关缓存
    await cacheManager.invalidateEnterpriseCache(enterpriseId);

    return createNextResponse(true, { id: enterpriseId }, '企业删除成功', 200);
    
  } catch (error) {
    console.error('Delete enterprise error:', error);
    return createNextResponse(false, null, '删除企业失败', 500);
  }
}
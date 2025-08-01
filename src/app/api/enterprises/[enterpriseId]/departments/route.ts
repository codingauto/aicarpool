import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { createApiResponse } from '@/lib/middleware';
import { getUserFromRequest } from '@/lib/auth';
import { cacheManager } from '@/lib/cache';

const createDepartmentSchema = z.object({
  name: z.string().min(1, '部门名称不能为空'),
  description: z.string().optional(),
  parentId: z.string().optional(),
  budgetLimit: z.number().min(0).optional()
});

// GET /api/enterprises/[enterpriseId]/departments - 获取企业部门列表
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

    // 检查企业是否存在
    const enterprise = await prisma.enterprise.findUnique({
      where: { id: enterpriseId }
    });

    if (!enterprise) {
      return createApiResponse(false, null, '企业不存在', 404);
    }

    // 获取部门列表（层级结构）
    const departments = await prisma.department.findMany({
      where: { enterpriseId },
      include: {
        parent: {
          select: {
            id: true,
            name: true,
          }
        },
        children: {
          select: {
            id: true,
            name: true,
            description: true,
          }
        },
        groups: {
          select: {
            id: true,
            name: true,
            description: true,
            maxMembers: true,
            status: true,
          }
        },
        _count: {
          select: {
            children: true,
            groups: true,
          }
        }
      },
      orderBy: [
        { parentId: 'asc' },
        { name: 'asc' }
      ]
    });

    // 构建层级结构
    const departmentMap = new Map();
    const rootDepartments: any[] = [];

    // 先创建所有部门的映射
    departments.forEach(dept => {
      departmentMap.set(dept.id, {
        ...dept,
        children: []
      });
    });

    // 构建层级关系
    departments.forEach(dept => {
      if (dept.parentId) {
        const parent = departmentMap.get(dept.parentId);
        if (parent) {
          parent.children.push(departmentMap.get(dept.id));
        }
      } else {
        rootDepartments.push(departmentMap.get(dept.id));
      }
    });

    return createApiResponse(true, {
      enterprise: {
        id: enterprise.id,
        name: enterprise.name,
        planType: enterprise.planType,
      },
      departments: rootDepartments,
      totalCount: departments.length
    }, '获取企业部门列表成功', 200);
    
  } catch (error) {
    console.error('Get enterprise departments error:', error);
    return createApiResponse(false, null, '获取企业部门失败', 500);
  }
}

// POST /api/enterprises/[enterpriseId]/departments - 创建部门
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

    // 检查企业是否存在
    const enterprise = await prisma.enterprise.findUnique({
      where: { id: enterpriseId }
    });

    if (!enterprise) {
      return createApiResponse(false, null, '企业不存在', 404);
    }

    const body = await request.json();
    const validatedData = createDepartmentSchema.parse(body);

    // 如果指定了父部门，检查父部门是否存在
    if (validatedData.parentId) {
      const parentDepartment = await prisma.department.findFirst({
        where: {
          id: validatedData.parentId,
          enterpriseId
        }
      });

      if (!parentDepartment) {
        return createApiResponse(false, null, '父部门不存在', 404);
      }
    }

    const department = await prisma.department.create({
      data: {
        enterpriseId,
        name: validatedData.name,
        description: validatedData.description,
        parentId: validatedData.parentId,
        budgetLimit: validatedData.budgetLimit,
      },
      include: {
        parent: {
          select: {
            id: true,
            name: true,
          }
        },
        _count: {
          select: {
            children: true,
            groups: true,
          }
        }
      }
    });

    // 清理相关缓存
    await cacheManager.invalidateEnterpriseCache(enterpriseId);

    return createApiResponse(true, department, '部门创建成功', 201);
    
  } catch (error) {
    if (error instanceof z.ZodError) {
      return createApiResponse(false, null, error.issues[0].message, 400);
    }
    
    console.error('Create department error:', error);
    return createApiResponse(false, null, '创建部门失败', 500);
  }
}

// PUT /api/enterprises/[enterpriseId]/departments - 更新部门
export async function PUT(
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

    const { searchParams } = new URL(request.url);
    const departmentId = searchParams.get('departmentId');

    if (!departmentId) {
      return createApiResponse(false, null, '缺少departmentId参数', 400);
    }

    // 检查部门是否存在
    const existingDepartment = await prisma.department.findFirst({
      where: {
        id: departmentId,
        enterpriseId
      }
    });

    if (!existingDepartment) {
      return createApiResponse(false, null, '部门不存在', 404);
    }

    const body = await request.json();
    const validatedData = createDepartmentSchema.partial().parse(body);

    // 如果更新父部门，检查不会造成循环引用
    if (validatedData.parentId && validatedData.parentId !== existingDepartment.parentId) {
      if (validatedData.parentId === departmentId) {
        return createApiResponse(false, null, '不能将部门设置为自己的父部门', 400);
      }

      // 检查是否会造成循环引用
      const isCircular = await checkCircularReference(departmentId, validatedData.parentId);
      if (isCircular) {
        return createApiResponse(false, null, '不能设置循环引用的父部门', 400);
      }
    }

    const updatedDepartment = await prisma.department.update({
      where: { id: departmentId },
      data: validatedData,
      include: {
        parent: {
          select: {
            id: true,
            name: true,
          }
        },
        children: {
          select: {
            id: true,
            name: true,
          }
        },
        _count: {
          select: {
            children: true,
            groups: true,
          }
        }
      }
    });

    // 清理相关缓存
    await cacheManager.invalidateEnterpriseCache(enterpriseId);

    return createApiResponse(true, updatedDepartment, '部门更新成功', 200);
    
  } catch (error) {
    if (error instanceof z.ZodError) {
      return createApiResponse(false, null, error.issues[0].message, 400);
    }
    
    console.error('Update department error:', error);
    return createApiResponse(false, null, '更新部门失败', 500);
  }
}

// DELETE /api/enterprises/[enterpriseId]/departments - 删除部门
export async function DELETE(
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

    const { searchParams } = new URL(request.url);
    const departmentId = searchParams.get('departmentId');

    if (!departmentId) {
      return createApiResponse(false, null, '缺少departmentId参数', 400);
    }

    // 检查部门是否存在
    const department = await prisma.department.findFirst({
      where: {
        id: departmentId,
        enterpriseId
      },
      include: {
        children: true,
        groups: true,
      }
    });

    if (!department) {
      return createApiResponse(false, null, '部门不存在', 404);
    }

    // 检查是否有子部门
    if (department.children.length > 0) {
      return createApiResponse(false, null, '请先删除子部门', 400);
    }

    // 检查是否有关联的拼车组
    if (department.groups.length > 0) {
      return createApiResponse(false, null, '该部门下还有拼车组，请先移除', 400);
    }

    await prisma.department.delete({
      where: { id: departmentId }
    });

    // 清理相关缓存
    await cacheManager.invalidateEnterpriseCache(enterpriseId);

    return createApiResponse(true, { id: departmentId }, '部门删除成功', 200);
    
  } catch (error) {
    console.error('Delete department error:', error);
    return createApiResponse(false, null, '删除部门失败', 500);
  }
}

// 辅助函数：检查循环引用
async function checkCircularReference(departmentId: string, parentId: string): Promise<boolean> {
  let currentParentId = parentId;
  const visited = new Set<string>();

  while (currentParentId && currentParentId !== '') {
    if (visited.has(currentParentId)) {
      return true; // 发现循环
    }
    
    if (currentParentId === departmentId) {
      return true; // 会造成循环引用
    }
    
    visited.add(currentParentId);
    
    const parent = await prisma.department.findUnique({
      where: { id: currentParentId },
      select: { parentId: true }
    });
    
    currentParentId = parent?.parentId || '';
  }
  
  return false;
}
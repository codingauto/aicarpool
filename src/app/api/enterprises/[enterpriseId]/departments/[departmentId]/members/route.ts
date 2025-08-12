import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { createApiResponse } from '@/lib/middleware';
import { getUserFromRequest } from '@/lib/auth';

const addMemberSchema = z.object({
  userId: z.string().min(1, '用户ID不能为空'),
  role: z.enum(['member', 'admin', 'owner']).default('member')
});

const updateMemberSchema = z.object({
  role: z.enum(['member', 'admin', 'owner']).optional()
});

// GET /api/enterprises/[enterpriseId]/departments/[departmentId]/members - 获取部门成员列表
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ enterpriseId: string; departmentId: string }> }
) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return createApiResponse(false, null, '未授权', 401);
    }

    const resolvedParams = await params;
    const { enterpriseId, departmentId } = resolvedParams;

    // 检查部门是否存在
    const department = await prisma.department.findFirst({
      where: {
        id: departmentId,
        enterpriseId
      }
    });

    if (!department) {
      return createApiResponse(false, null, '部门不存在', 404);
    }

    // 获取部门成员
    const members = await prisma.userDepartment.findMany({
      where: { 
        departmentId,
        isActive: true 
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
            status: true
          }
        }
      },
      orderBy: [
        { role: 'asc' },
        { joinedAt: 'desc' }
      ]
    });

    return createApiResponse(true, {
      department: {
        id: department.id,
        name: department.name,
        description: department.description
      },
      members,
      totalCount: members.length
    }, '获取部门成员成功', 200);
    
  } catch (error) {
    console.error('Get department members error:', error);
    return createApiResponse(false, null, '获取部门成员失败', 500);
  }
}

// POST /api/enterprises/[enterpriseId]/departments/[departmentId]/members - 添加部门成员
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ enterpriseId: string; departmentId: string }> }
) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return createApiResponse(false, null, '未授权', 401);
    }

    const resolvedParams = await params;
    const { enterpriseId, departmentId } = resolvedParams;

    // 检查部门是否存在
    const department = await prisma.department.findFirst({
      where: {
        id: departmentId,
        enterpriseId
      }
    });

    if (!department) {
      return createApiResponse(false, null, '部门不存在', 404);
    }

    const body = await request.json();
    const validatedData = addMemberSchema.parse(body);

    // 检查用户是否存在
    const targetUser = await prisma.user.findUnique({
      where: { id: validatedData.userId }
    });

    if (!targetUser) {
      return createApiResponse(false, null, '用户不存在', 404);
    }

    // 检查用户是否已经是部门成员
    const existingMember = await prisma.userDepartment.findFirst({
      where: {
        departmentId,
        userId: validatedData.userId,
        isActive: true
      }
    });

    if (existingMember) {
      return createApiResponse(false, null, '用户已经是部门成员', 400);
    }

    // 添加部门成员
    const member = await prisma.userDepartment.create({
      data: {
        departmentId,
        userId: validatedData.userId,
        role: validatedData.role,
        isActive: true
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
            status: true
          }
        }
      }
    });

    return createApiResponse(true, member, '添加部门成员成功', 201);
    
  } catch (error) {
    if (error instanceof z.ZodError) {
      return createApiResponse(false, null, error.issues[0].message, 400);
    }
    
    console.error('Add department member error:', error);
    return createApiResponse(false, null, '添加部门成员失败', 500);
  }
}
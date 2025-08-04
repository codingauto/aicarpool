import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { createApiResponse } from '@/lib/middleware';
import { getUserFromRequest } from '@/lib/auth';

const updateMemberSchema = z.object({
  role: z.enum(['member', 'admin', 'owner']).optional()
});

// PUT /api/enterprises/[enterpriseId]/departments/[departmentId]/members/[memberId] - 更新部门成员
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ enterpriseId: string; departmentId: string; memberId: string }> }
) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return createApiResponse(false, null, '未授权', 401);
    }

    const resolvedParams = await params;
    const { enterpriseId, departmentId, memberId } = resolvedParams;

    // 检查部门成员是否存在
    const member = await prisma.departmentMember.findFirst({
      where: {
        id: memberId,
        departmentId,
        department: {
          enterpriseId
        }
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        department: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    if (!member) {
      return createApiResponse(false, null, '部门成员不存在', 404);
    }

    const body = await request.json();
    const validatedData = updateMemberSchema.parse(body);

    // 更新部门成员
    const updatedMember = await prisma.departmentMember.update({
      where: { id: memberId },
      data: validatedData,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true
          }
        }
      }
    });

    return createApiResponse(true, updatedMember, '更新部门成员成功', 200);
    
  } catch (error) {
    if (error instanceof z.ZodError) {
      return createApiResponse(false, null, error.issues[0].message, 400);
    }
    
    console.error('Update department member error:', error);
    return createApiResponse(false, null, '更新部门成员失败', 500);
  }
}

// DELETE /api/enterprises/[enterpriseId]/departments/[departmentId]/members/[memberId] - 移除部门成员
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ enterpriseId: string; departmentId: string; memberId: string }> }
) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return createApiResponse(false, null, '未授权', 401);
    }

    const resolvedParams = await params;
    const { enterpriseId, departmentId, memberId } = resolvedParams;

    // 检查部门成员是否存在
    const member = await prisma.departmentMember.findFirst({
      where: {
        id: memberId,
        departmentId,
        department: {
          enterpriseId
        }
      },
      include: {
        user: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    if (!member) {
      return createApiResponse(false, null, '部门成员不存在', 404);
    }

    // 删除部门成员
    await prisma.departmentMember.delete({
      where: { id: memberId }
    });

    return createApiResponse(true, { 
      id: memberId,
      userName: member.user.name 
    }, '移除部门成员成功', 200);
    
  } catch (error) {
    console.error('Remove department member error:', error);
    return createApiResponse(false, null, '移除部门成员失败', 500);
  }
}
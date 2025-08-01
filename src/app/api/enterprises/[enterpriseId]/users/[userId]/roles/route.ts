import { NextRequest } from 'next/server';
import { z } from 'zod';
import { createApiResponse } from '@/lib/middleware';
import { getUserFromRequest } from '@/lib/auth';
import { permissionManager } from '@/lib/enterprise/permission-manager';

const assignRoleSchema = z.object({
  roleId: z.string().min(1, '角色ID不能为空'),
  departmentId: z.string().optional(),
  groupId: z.string().optional(),
  expiresAt: z.string().optional().transform(val => val ? new Date(val) : undefined)
});

// GET /api/enterprises/[enterpriseId]/users/[userId]/roles - 获取用户角色
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ enterpriseId: string; userId: string }> }
) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return createApiResponse(false, null, '未授权', 401);
    }

    const resolvedParams = await params;
    const { enterpriseId, userId } = resolvedParams;

    // 检查权限
    const permissionCheck = await permissionManager.checkPermission(
      user.id,
      'user.read',
      undefined,
      enterpriseId
    );

    if (!permissionCheck.hasPermission) {
      return createApiResponse(false, null, '权限不足', 403);
    }

    // 获取用户权限
    const userPermissions = await permissionManager.getUserPermissions(userId, enterpriseId);

    return createApiResponse(true, {
      userId,
      enterpriseId,
      permissions: userPermissions,
      effectiveRoles: userPermissions.map(p => ({
        roleId: p.roleId,
        roleName: p.role.displayName,
        scope: p.scope,
        resourceId: p.resourceId,
        isActive: p.isActive
      }))
    }, '获取用户角色成功', 200);

  } catch (error) {
    console.error('Get user roles error:', error);
    return createApiResponse(false, null, '获取用户角色失败', 500);
  }
}

// POST /api/enterprises/[enterpriseId]/users/[userId]/roles - 分配角色
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ enterpriseId: string; userId: string }> }
) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return createApiResponse(false, null, '未授权', 401);
    }

    const resolvedParams = await params;
    const { enterpriseId, userId } = resolvedParams;

    // 检查权限
    const permissionCheck = await permissionManager.checkPermission(
      user.id,
      'user.manage',
      undefined,
      enterpriseId
    );

    if (!permissionCheck.hasPermission) {
      return createApiResponse(false, null, '权限不足', 403);
    }

    const body = await request.json();
    const validatedData = assignRoleSchema.parse(body);

    // 分配角色
    const success = await permissionManager.assignRole(
      userId,
      validatedData.roleId,
      user.id,
      {
        enterpriseId,
        departmentId: validatedData.departmentId,
        groupId: validatedData.groupId,
        expiresAt: validatedData.expiresAt
      }
    );

    if (success) {
      // 获取更新后的用户权限
      const updatedPermissions = await permissionManager.getUserPermissions(userId, enterpriseId);
      
      return createApiResponse(true, {
        userId,
        enterpriseId,
        assignedRole: validatedData.roleId,
        permissions: updatedPermissions
      }, '角色分配成功', 200);
    } else {
      return createApiResponse(false, null, '角色分配失败', 400);
    }

  } catch (error) {
    if (error instanceof z.ZodError) {
      return createApiResponse(false, null, error.issues[0].message, 400);
    }
    
    console.error('Assign role error:', error);
    return createApiResponse(false, null, '分配角色失败', 500);
  }
}

// DELETE /api/enterprises/[enterpriseId]/users/[userId]/roles - 撤销角色
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ enterpriseId: string; userId: string }> }
) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return createApiResponse(false, null, '未授权', 401);
    }

    const resolvedParams = await params;
    const { enterpriseId, userId } = resolvedParams;

    // 检查权限
    const permissionCheck = await permissionManager.checkPermission(
      user.id,
      'user.manage',
      undefined,
      enterpriseId
    );

    if (!permissionCheck.hasPermission) {
      return createApiResponse(false, null, '权限不足', 403);
    }

    const { searchParams } = new URL(request.url);
    const roleId = searchParams.get('roleId');
    const departmentId = searchParams.get('departmentId') || undefined;
    const groupId = searchParams.get('groupId') || undefined;

    if (!roleId) {
      return createApiResponse(false, null, '缺少roleId参数', 400);
    }

    // 撤销角色
    const success = await permissionManager.revokeRole(userId, roleId, {
      enterpriseId,
      departmentId,
      groupId
    });

    if (success) {
      return createApiResponse(true, {
        userId,
        enterpriseId,
        revokedRole: roleId
      }, '角色撤销成功', 200);
    } else {
      return createApiResponse(false, null, '角色撤销失败', 400);
    }

  } catch (error) {
    console.error('Revoke role error:', error);
    return createApiResponse(false, null, '撤销角色失败', 500);
  }
}
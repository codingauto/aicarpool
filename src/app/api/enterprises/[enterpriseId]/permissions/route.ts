import { NextRequest } from 'next/server';
import { createApiResponse } from '@/lib/middleware';
import { getUserFromRequest } from '@/lib/auth';
import { permissionManager } from '@/lib/enterprise/permission-manager';

// GET /api/enterprises/[enterpriseId]/permissions - 获取权限列表
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

    // 获取所有内置权限
    const builtInPermissions = permissionManager.getBuiltInPermissions();
    
    // 获取所有内置角色
    const builtInRoles = permissionManager.getBuiltInRoles();

    return createApiResponse(true, {
      enterpriseId,
      permissions: builtInPermissions,
      roles: builtInRoles,
      userScope: permissionCheck.scope
    }, '获取权限列表成功', 200);

  } catch (error) {
    console.error('Get permissions error:', error);
    return createApiResponse(false, null, '获取权限列表失败', 500);
  }
}
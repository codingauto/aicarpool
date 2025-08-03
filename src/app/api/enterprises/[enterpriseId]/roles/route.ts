import { NextRequest, NextResponse } from 'next/server';
import { createPermissionManager } from '@/lib/permission/simple-permission-manager';
import { getUserFromRequest } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

/**
 * 企业角色管理API
 * 
 * 功能：
 * - 创建自定义角色
 * - 更新角色权限
 * - 删除自定义角色
 * - 角色权限管理
 */

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ enterpriseId: string }> }
) {
  try {
    const { enterpriseId } = await params;
    const user = await getUserFromRequest(request);

    if (!user) {
      return NextResponse.json({
        success: false,
        message: '用户未认证',
        code: 401
      }, { status: 401 });
    }

    const body = await request.json();
    const { action, roleKey, roleName, permissions } = body;

    // 创建权限管理器
    const permissionManager = createPermissionManager();

    // 检查用户是否有企业权限管理权限
    const hasAccess = await permissionManager.hasPermission(
      { userId: user.id, scope: 'enterprise', resourceId: enterpriseId }, 
      'enterprise.admin'
    );

    // 开发模式：如果没有企业权限，检查是否有全局权限或者直接允许访问
    if (!hasAccess && process.env.NODE_ENV === 'development') {
      console.log('🔐 开发模式：检查全局权限或允许测试访问');
      const hasGlobalAccess = await permissionManager.hasPermission(
        { userId: user.id }, 
        'system.admin'
      );
      if (!hasGlobalAccess) {
        // 开发模式下允许测试访问
        console.log('🔐 开发模式：允许测试访问角色管理');
      }
    } else if (!hasAccess) {
      return NextResponse.json({
        success: false,
        message: '没有权限管理企业角色',
        code: 403
      }, { status: 403 });
    }

    switch (action) {
      case 'create':
        return await createRole(enterpriseId, roleKey, roleName, permissions);
      
      case 'update':
        return await updateRole(enterpriseId, roleKey, permissions);
      
      case 'delete':
        return await deleteRole(enterpriseId, roleKey);
      
      default:
        return NextResponse.json({
          success: false,
          message: '无效的操作类型',
          code: 400
        }, { status: 400 });
    }

  } catch (error) {
    console.error('角色管理API错误:', error);
    return NextResponse.json({
      success: false,
      message: '服务器内部错误',
      code: 500
    }, { status: 500 });
  }
}

async function createRole(enterpriseId: string, roleKey: string, roleName: string, permissions: string[]) {
  try {
    // 检查角色键是否已存在
    const existingRole = await prisma.userEnterpriseRole.findFirst({
      where: {
        enterpriseId,
        role: roleKey
      }
    });

    if (existingRole) {
      return NextResponse.json({
        success: false,
        message: '角色标识已存在',
        code: 400
      }, { status: 400 });
    }

    // 验证权限是否有效
    const validPermissions = [
      'system.admin', 'system.view',
      'enterprise.admin', 'enterprise.manage', 'enterprise.view',
      'group.admin', 'group.manage', 'group.create', 'group.view',
      'ai.admin', 'ai.manage', 'ai.use',
      'user.admin', 'user.manage', 'user.invite', 'user.view'
    ];

    const invalidPermissions = permissions.filter(p => !validPermissions.includes(p));
    if (invalidPermissions.length > 0) {
      return NextResponse.json({
        success: false,
        message: `无效的权限: ${invalidPermissions.join(', ')}`,
        code: 400
      }, { status: 400 });
    }

    // 创建角色记录 (使用自定义表存储角色定义)
    await prisma.$executeRaw`
      INSERT INTO CustomRole (id, enterpriseId, roleKey, roleName, permissions, createdAt, updatedAt)
      VALUES (${generateId()}, ${enterpriseId}, ${roleKey}, ${roleName}, ${JSON.stringify(permissions)}, NOW(), NOW())
      ON DUPLICATE KEY UPDATE
      roleName = VALUES(roleName),
      permissions = VALUES(permissions),
      updatedAt = NOW()
    `;

    return NextResponse.json({
      success: true,
      message: '角色创建成功',
      data: {
        roleKey,
        roleName,
        permissions
      }
    });

  } catch (error) {
    console.error('创建角色失败:', error);
    return NextResponse.json({
      success: false,
      message: '创建角色失败',
      code: 500
    }, { status: 500 });
  }
}

async function updateRole(enterpriseId: string, roleKey: string, permissions: string[]) {
  try {
    // 检查是否为内置角色
    const builtInRoles = ['owner', 'admin', 'member'];
    if (builtInRoles.includes(roleKey)) {
      return NextResponse.json({
        success: false,
        message: '无法修改系统内置角色',
        code: 400
      }, { status: 400 });
    }

    // 验证权限是否有效
    const validPermissions = [
      'system.admin', 'system.view',
      'enterprise.admin', 'enterprise.manage', 'enterprise.view',
      'group.admin', 'group.manage', 'group.create', 'group.view',
      'ai.admin', 'ai.manage', 'ai.use',
      'user.admin', 'user.manage', 'user.invite', 'user.view'
    ];

    const invalidPermissions = permissions.filter(p => !validPermissions.includes(p));
    if (invalidPermissions.length > 0) {
      return NextResponse.json({
        success: false,
        message: `无效的权限: ${invalidPermissions.join(', ')}`,
        code: 400
      }, { status: 400 });
    }

    // 更新自定义角色
    await prisma.$executeRaw`
      UPDATE CustomRole 
      SET permissions = ${JSON.stringify(permissions)}, updatedAt = NOW()
      WHERE enterpriseId = ${enterpriseId} AND roleKey = ${roleKey}
    `;

    return NextResponse.json({
      success: true,
      message: '角色更新成功',
      data: {
        roleKey,
        permissions
      }
    });

  } catch (error) {
    console.error('更新角色失败:', error);
    return NextResponse.json({
      success: false,
      message: '更新角色失败',
      code: 500
    }, { status: 500 });
  }
}

async function deleteRole(enterpriseId: string, roleKey: string) {
  try {
    // 检查是否为内置角色
    const builtInRoles = ['owner', 'admin', 'member'];
    if (builtInRoles.includes(roleKey)) {
      return NextResponse.json({
        success: false,
        message: '无法删除系统内置角色',
        code: 400
      }, { status: 400 });
    }

    // 检查是否有用户使用此角色
    const usersWithRole = await prisma.userEnterprise.count({
      where: {
        enterpriseId,
        role: roleKey,
        isActive: true
      }
    });

    if (usersWithRole > 0) {
      return NextResponse.json({
        success: false,
        message: `无法删除角色，还有 ${usersWithRole} 个用户使用此角色`,
        code: 400
      }, { status: 400 });
    }

    // 删除自定义角色
    await prisma.$executeRaw`
      DELETE FROM CustomRole 
      WHERE enterpriseId = ${enterpriseId} AND roleKey = ${roleKey}
    `;

    return NextResponse.json({
      success: true,
      message: '角色删除成功'
    });

  } catch (error) {
    console.error('删除角色失败:', error);
    return NextResponse.json({
      success: false,
      message: '删除角色失败',
      code: 500
    }, { status: 500 });
  }
}

function generateId(): string {
  return `role_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}
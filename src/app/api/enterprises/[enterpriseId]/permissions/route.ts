/**
 * 企业级权限管理API - v2.5简化版
 * 
 * 提供企业用户权限和角色管理功能
 */

import { NextRequest, NextResponse } from 'next/server';
import { createPermissionManager } from '@/lib/permission/simple-permission-manager';
import { prisma } from '@/lib/prisma';
import { 
  getCurrentUser, 
  createUnauthorizedResponse, 
  createForbiddenResponse,
  isUserInEnterprise 
} from '@/lib/auth/auth-utils';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ enterpriseId: string }> }
) {
  try {
    const { enterpriseId } = await params;
    
    // 开发模式下的 mock 用户
    let user = await getCurrentUser(request);
    
    // 如果没有用户且是开发环境，使用 mock 用户
    if (!user && process.env.NODE_ENV === 'development') {
      // 查找管理员用户作为 mock
      const adminUser = await prisma.user.findFirst({
        where: { 
          email: 'admin@aicarpool.com'
        }
      });
      
      if (adminUser) {
        user = {
          id: adminUser.id,
          email: adminUser.email,
          name: adminUser.name || '系统管理员',
          role: 'admin'
        };
      }
    }
    
    if (!user) {
      return createUnauthorizedResponse('请先登录');
    }

    const permissionManager = createPermissionManager();

    // 检查企业访问权限
    const context = { userId: user.id, enterpriseId };
    
    // 检查权限层级：企业查看 -> 企业管理 -> 系统管理员
    const hasViewPermission = await permissionManager.hasPermission(context, 'enterprise.view');
    const hasManagePermission = await permissionManager.hasPermission(context, 'enterprise.manage');
    const hasSystemAdmin = await permissionManager.hasPermission({ userId: user.id }, 'system.admin');
    
    // 检查用户是否是企业成员
    const isMember = await isUserInEnterprise(user.id, enterpriseId);
    
    // 综合判断是否有访问权限
    const hasAccess = hasViewPermission || hasManagePermission || hasSystemAdmin || isMember;
    
    if (!hasAccess) {
      console.log('🔐 用户无权限访问企业:', enterpriseId, '用户ID:', user.id);
      return createForbiddenResponse('您没有权限访问此企业');
    }

    // 获取企业信息和用户列表
    const enterprise = await prisma.enterprise.findUnique({
      where: { id: enterpriseId },
      include: {
        userEnterprises: {
          include: {
            user: {
              select: { id: true, name: true, email: true }
            }
          }
        }
      }
    });

    if (!enterprise) {
      return NextResponse.json(
        { success: false, message: '企业不存在' }, 
        { status: 404 }
      );
    }

    // 获取企业用户的详细权限
    const usersWithPermissions = await Promise.all(
      enterprise.userEnterprises.map(async (ue) => {
        const userContext = { userId: ue.user.id, enterpriseId };
        const permissions = await permissionManager.getUserPermissions(userContext);
        const userRole = await permissionManager.getUserRole(ue.user.id, enterpriseId);
        
        return {
          ...ue.user,
          role: userRole || ue.role,
          permissions,
          joinedAt: ue.joinedAt
        };
      })
    );

    // 获取当前用户在此企业的权限
    const currentUserPermissions = await permissionManager.getUserPermissions(context);
    const currentUserRole = await permissionManager.getUserRole(user.id, enterpriseId);

    return NextResponse.json({
      success: true,
      data: {
        enterprise: {
          id: enterprise.id,
          name: enterprise.name
        },
        users: usersWithPermissions,
        currentUser: {
          id: user.id,
          role: currentUserRole,
          permissions: currentUserPermissions
        },
        availableRoles: permissionManager.getAllRoles().map(role => ({
          key: role,
          ...permissionManager.getRoleInfo(role)
        })),
        availablePermissions: permissionManager.getAllPermissions()
      }
    });

  } catch (error) {
    console.error('Get enterprise permissions error:', error);
    return NextResponse.json(
      { success: false, message: '获取企业权限失败' }, 
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ enterpriseId: string }> }
) {
  try {
    const { enterpriseId } = await params;
    
    // 开发模式下的 mock 用户
    let user = await getCurrentUser(request);
    
    // 如果没有用户且是开发环境，使用 mock 用户
    if (!user && process.env.NODE_ENV === 'development') {
      // 查找管理员用户作为 mock
      const adminUser = await prisma.user.findFirst({
        where: { 
          email: 'admin@aicarpool.com'
        }
      });
      
      if (adminUser) {
        user = {
          id: adminUser.id,
          email: adminUser.email,
          name: adminUser.name || '系统管理员',
          role: 'admin'
        };
      }
    }
    
    if (!user) {
      return createUnauthorizedResponse('请先登录');
    }

    const body = await request.json();
    const { action, targetUserId, userIds, role, scope, resourceId, status, permissions } = body;

    const permissionManager = createPermissionManager();
    const context = { userId: user.id, enterpriseId };

    // 检查操作权限
    const canManage = await permissionManager.hasPermission(context, 'user.manage');
    if (!canManage) {
      return createForbiddenResponse('您没有权限管理用户');
    }

    switch (action) {
      case 'assign_role':
        if (!targetUserId || !role) {
          return NextResponse.json(
            { success: false, message: '缺少必要参数' }, 
            { status: 400 }
          );
        }

        if (!permissionManager.isValidRole(role)) {
          return NextResponse.json(
            { success: false, message: '无效的角色' }, 
            { status: 400 }
          );
        }

        const success = await permissionManager.assignRole(
          context,
          targetUserId,
          role,
          scope || 'enterprise',
          resourceId
        );

        if (success) {
          return NextResponse.json({
            success: true,
            message: '角色分配成功'
          });
        } else {
          return NextResponse.json(
            { success: false, message: '角色分配失败' }, 
            { status: 500 }
          );
        }

      case 'remove_role':
        const { roleId } = body;
        if (!roleId) {
          return NextResponse.json(
            { success: false, message: '缺少角色ID' }, 
            { status: 400 }
          );
        }

        const removeSuccess = await permissionManager.removeRole(
          context,
          targetUserId,
          roleId
        );

        if (removeSuccess) {
          return NextResponse.json({
            success: true,
            message: '角色移除成功'
          });
        } else {
          return NextResponse.json(
            { success: false, message: '角色移除失败' }, 
            { status: 500 }
          );
        }

      case 'update_user_legacy':
        if (!targetUserId) {
          return NextResponse.json(
            { success: false, message: '缺少用户ID' }, 
            { status: 400 }
          );
        }
        
        // 更新用户角色
        if (role) {
          await prisma.userEnterprise.updateMany({
            where: {
              userId: targetUserId,
              enterpriseId,
              isActive: true
            },
            data: { role }
          });
        }
        
        // 更新用户状态  
        if (status) {
          await prisma.userEnterprise.updateMany({
            where: {
              userId: targetUserId,
              enterpriseId,
              isActive: true
            },
            data: { 
              isActive: status === 'active'
            }
          });
        }
        
        // 更新用户权限
        if (permissions) {
          await prisma.userEnterprise.updateMany({
            where: {
              userId: targetUserId,
              enterpriseId,
              isActive: true
            },
            data: {
              permissions: JSON.stringify(permissions)
            }
          });
        }
        
        return NextResponse.json({
          success: true,
          message: '用户信息更新成功'
        });
        
      case 'batch_update':
        if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
          return NextResponse.json(
            { success: false, message: '缺少用户ID列表' }, 
            { status: 400 }
          );
        }
        
        const batchUpdateData: any = {};
        if (role) batchUpdateData.role = role;
        if (status) batchUpdateData.isActive = status === 'active';
        if (permissions) batchUpdateData.permissions = JSON.stringify(permissions);
        
        if (Object.keys(batchUpdateData).length > 0) {
          await prisma.userEnterprise.updateMany({
            where: {
              userId: { in: userIds },
              enterpriseId,
              isActive: true
            },
            data: batchUpdateData
          });
        }
        
        return NextResponse.json({
          success: true,
          message: `批量更新 ${userIds.length} 个用户成功`
        });
        
      case 'batch_delete':
        if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
          return NextResponse.json(
            { success: false, message: '缺少用户ID列表' }, 
            { status: 400 }
          );
        }
        
        // 软删除：设置为非活跃状态
        await prisma.userEnterprise.updateMany({
          where: {
            userId: { in: userIds },
            enterpriseId
          },
          data: {
            isActive: false
          }
        });
        
        return NextResponse.json({
          success: true,
          message: `批量删除 ${userIds.length} 个用户成功`
        });

      case 'check_permission':
        const { permission } = body;
        if (!permission) {
          return NextResponse.json(
            { success: false, message: '缺少权限名称' }, 
            { status: 400 }
          );
        }

        if (!permissionManager.isValidPermission(permission)) {
          return NextResponse.json(
            { success: false, message: '无效的权限' }, 
            { status: 400 }
          );
        }

        const hasPermission = await permissionManager.hasPermission(
          { userId: targetUserId || user.id, enterpriseId },
          permission
        );

        return NextResponse.json({
          success: true,
          data: {
            hasPermission,
            permission,
            userId: targetUserId || user.id
          }
        });

      case 'update_user':
        if (!targetUserId) {
          return NextResponse.json(
            { success: false, message: '缺少用户ID' }, 
            { status: 400 }
          );
        }

        // 检查用户是否在企业中
        const userEnterprise = await prisma.userEnterprise.findFirst({
          where: {
            userId: targetUserId,
            enterpriseId: enterpriseId,
            isActive: true
          }
        });

        if (!userEnterprise) {
          return NextResponse.json(
            { success: false, message: '用户不在企业中' }, 
            { status: 404 }
          );
        }

        const userUpdateData: any = {};

        // 更新角色
        if (role && role !== userEnterprise.role) {
          if (!permissionManager.isValidRole(role)) {
            return NextResponse.json(
              { success: false, message: '无效的角色' }, 
              { status: 400 }
            );
          }
          userUpdateData.role = role;
        }

        // 更新状态
        if (status && status !== userEnterprise.isActive) {
          userUpdateData.isActive = status === 'active';
        }

        // 更新用户企业关系
        if (Object.keys(userUpdateData).length > 0) {
          await prisma.userEnterprise.update({
            where: { id: userEnterprise.id },
            data: userUpdateData
          });
        }

        // TODO: 处理直接权限分配
        if (permissions && Array.isArray(permissions)) {
          // 这里将来可以实现直接权限分配功能
          console.log('直接权限分配功能待实现:', permissions);
        }

        return NextResponse.json({
          success: true,
          message: '用户信息更新成功'
        });

      default:
        return NextResponse.json(
          { success: false, message: '不支持的操作' }, 
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('Enterprise permission operation error:', error);
    if (error instanceof Error) {
      return NextResponse.json(
        { success: false, message: error.message }, 
        { status: 403 }
      );
    }
    return NextResponse.json(
      { success: false, message: '操作失败' }, 
      { status: 500 }
    );
  }
}
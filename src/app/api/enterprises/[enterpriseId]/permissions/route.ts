/**
 * 企业级权限管理API - v2.5简化版
 * 
 * 提供企业用户权限和角色管理功能
 */

import { NextRequest, NextResponse } from 'next/server';
import { createPermissionManager } from '@/lib/permission/simple-permission-manager';
import { prisma } from '@/lib/prisma';

// 获取当前用户的函数（支持开发模式和真实认证）
async function getCurrentUser(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const url = new URL(request.url);
  const testUser = url.searchParams.get('test_user');
  
  // 开发模式：支持通过查询参数切换用户
  if (process.env.NODE_ENV === 'development') {
    if (testUser === 'admin') {
      // 返回系统管理员
      const adminUser = await prisma.user.findUnique({
        where: { email: 'admin@aicarpool.com' }
      });
      if (adminUser) {
        console.log('🔐 开发模式：使用系统管理员账号');
        return {
          id: adminUser.id,
          name: adminUser.name,
          email: adminUser.email
        };
      }
    }
    
    console.log('🔐 开发模式：使用默认测试用户');
  }

  // 生产环境：从JWT token获取用户信息
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      // TODO: 实现JWT token解析
      // const token = authHeader.substring(7);
      // const decoded = jwt.verify(token, process.env.JWT_SECRET!);
      // return decoded.user;
    } catch (error) {
      console.error('JWT token验证失败:', error);
      return null;
    }
  }

  // 返回测试用户数据（开发模式）
  return {
    id: 'user_test_001',
    name: '测试用户',
    email: 'test@example.com'
  };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ enterpriseId: string }> }
) {
  try {
    const { enterpriseId } = await params;
    const user = await getCurrentUser(request);
    
    if (!user) {
      return NextResponse.json(
        { success: false, message: '未登录' }, 
        { status: 401 }
      );
    }

    const permissionManager = createPermissionManager();

    // 检查企业访问权限
    const context = { userId: user.id, enterpriseId };
    let hasAccess = false;

    // 首先检查是否有企业查看权限
    hasAccess = await permissionManager.hasPermission(context, 'enterprise.view');
    
    // 如果没有企业权限，检查是否有企业管理权限
    if (!hasAccess) {
      hasAccess = await permissionManager.hasPermission(context, 'enterprise.manage');
    }
    
    // 如果还没有权限，检查是否有全局系统管理员权限
    if (!hasAccess) {
      hasAccess = await permissionManager.hasPermission({ userId: user.id }, 'system.admin');
    }
    
    // 开发模式：如果用户是管理员邮箱，直接允许访问
    if (!hasAccess && process.env.NODE_ENV === 'development') {
      if (user.email === 'admin@aicarpool.com') {
        console.log('🔐 开发模式：管理员邮箱，允许访问');
        hasAccess = true;
      }
    }

    // 如果仍然没有权限，检查用户是否是企业成员
    if (!hasAccess) {
      const userEnterprise = await prisma.userEnterprise.findFirst({
        where: {
          userId: user.id,
          enterpriseId,
          isActive: true
        }
      });
      
      if (userEnterprise) {
        console.log('🔐 用户是企业成员，允许查看权限');
        hasAccess = true;
      }
    }

    // 开发模式：为测试用户强制允许访问
    if (!hasAccess && process.env.NODE_ENV === 'development') {
      if (user.id === 'user_test_001' || user.email === 'test@example.com') {
        console.log('🔐 开发模式：测试用户强制允许访问');
        hasAccess = true;
      }
    }

    if (!hasAccess) {
      console.log('🔐 用户无权限访问企业:', enterpriseId, '用户ID:', user.id);
      return NextResponse.json(
        { success: false, message: '无访问权限' }, 
        { status: 403 }
      );
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
    const user = await getCurrentUser(request);
    
    if (!user) {
      return NextResponse.json(
        { success: false, message: '未登录' }, 
        { status: 401 }
      );
    }

    const body = await request.json();
    const { action, targetUserId, userIds, role, scope, resourceId, status, permissions } = body;

    const permissionManager = createPermissionManager();
    const context = { userId: user.id, enterpriseId };

    // 检查操作权限
    const canManage = await permissionManager.hasPermission(context, 'user.manage');
    if (!canManage) {
      return NextResponse.json(
        { success: false, message: '权限不足' }, 
        { status: 403 }
      );
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
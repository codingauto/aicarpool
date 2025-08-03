import { NextRequest, NextResponse } from 'next/server';
import { createPermissionManager } from '@/lib/permission/simple-permission-manager';
import { prisma } from '@/lib/prisma';

// 模拟获取当前用户的函数（实际应该从认证系统获取）
async function getCurrentUser(request: NextRequest) {
  // 这里应该从JWT token或session中获取用户信息
  // 暂时返回模拟数据
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

  // 返回测试用户数据
  return {
    id: 'user_test_001',
    name: '测试用户',
    email: 'test@example.com'
  };
}

export async function GET(request: NextRequest) {
  try {
    console.log('🔐 API 权限: 开始处理权限请求');
    
    const user = await getCurrentUser(request);
    console.log('🔐 API 权限: 获取用户信息', user);
    
    if (!user) {
      return NextResponse.json(
        { success: false, message: '未登录' }, 
        { status: 401 }
      );
    }

    const permissionManager = createPermissionManager();
    console.log('🔐 API 权限: 权限管理器创建成功');

    // 获取用户权限
    const context = { userId: user.id };
    console.log('🔐 API 权限: 获取用户权限，上下文:', context);
    
    const permissions = await permissionManager.getUserPermissions(context);
    console.log('🔐 API 权限: 用户权限:', permissions);

    // 获取用户企业
    const userEnterprises = await prisma.userEnterprise.findMany({
      where: { userId: user.id, isActive: true },
      include: { enterprise: true }
    });
    console.log('🔐 API 权限: 用户企业:', userEnterprises);

    // 获取用户的企业角色信息
    const enterpriseRoles = await permissionManager.getUserEnterpriseRoles(user.id);
    console.log('🔐 API 权限: 企业角色:', enterpriseRoles);

    const result = {
      success: true,
      data: {
        user: {
          id: user.id,
          name: user.name,
          email: user.email
        },
        permissions,
        enterprises: userEnterprises.map(ue => ({
          id: ue.enterprise.id,
          name: ue.enterprise.name,
          role: ue.role
        })),
        roles: enterpriseRoles,
        allPermissions: permissionManager.getAllPermissions(),
        allRoles: permissionManager.getAllRoles()
      }
    };
    
    console.log('🔐 API 权限: 请求处理成功，返回数据');
    return NextResponse.json(result);

  } catch (error) {
    console.error('❌ Get permissions error:', error);
    return NextResponse.json(
      { success: false, message: '获取权限失败' }, 
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json(
        { success: false, message: '未登录' }, 
        { status: 401 }
      );
    }

    const body = await request.json();
    const { action, targetUserId, role, scope, resourceId, enterpriseId } = body;

    const permissionManager = createPermissionManager();
    const context = { userId: user.id, enterpriseId };

    switch (action) {
      case 'assign_role':
        if (!targetUserId || !role) {
          return NextResponse.json(
            { success: false, message: '缺少必要参数' }, 
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

      default:
        return NextResponse.json(
          { success: false, message: '不支持的操作' }, 
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('Permission operation error:', error);
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
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

export interface EnterpriseContext {
  user: {
    id: string;
    email: string;
    name: string;
  };
  enterprise: {
    id: string;
    name: string;
    planType: string;
  };
  userRole: string;
  permissions: string[];
}

// 验证JWT token
export async function verifyToken(request: NextRequest): Promise<any> {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.substring(7);
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    return decoded;
  } catch (error) {
    return null;
  }
}

// 验证企业访问权限
export async function verifyEnterpriseAccess(
  userId: string, 
  enterpriseId: string
): Promise<{
  hasAccess: boolean;
  userEnterprise?: any;
  enterprise?: any;
}> {
  try {
    const userEnterprise = await prisma.userEnterprise.findFirst({
      where: {
        userId: userId,
        enterpriseId: enterpriseId,
        isActive: true
      },
      include: {
        enterprise: true
      }
    });

    if (!userEnterprise) {
      return { hasAccess: false };
    }

    return {
      hasAccess: true,
      userEnterprise,
      enterprise: userEnterprise.enterprise
    };
  } catch (error) {
    console.error('验证企业访问权限失败:', error);
    return { hasAccess: false };
  }
}

// 获取用户在企业中的权限
export function getRolePermissions(role: string): string[] {
  const permissions: Record<string, string[]> = {
    owner: [
      'enterprise.manage',
      'enterprise.delete',
      'groups.create',
      'groups.manage',
      'groups.delete',
      'members.invite',
      'members.manage',
      'resources.manage',
      'budget.manage',
      'analytics.view',
      'settings.manage'
    ],
    admin: [
      'groups.create',
      'groups.manage',
      'members.invite',
      'members.manage',
      'resources.manage',
      'analytics.view',
      'settings.view'
    ],
    member: [
      'groups.view',
      'resources.use',
      'analytics.view.own'
    ],
    viewer: [
      'groups.view',
      'analytics.view.own'
    ]
  };
  
  return permissions[role] || [];
}

// 企业中间件工厂
export function createEnterpriseMiddleware(options: {
  requiredRoles?: string[];
  requiredPermissions?: string[];
}) {
  return async function enterpriseMiddleware(
    request: NextRequest,
    context: { params: { enterpriseId: string } }
  ): Promise<NextResponse | { context: EnterpriseContext }> {
    // 验证用户认证
    const user = await verifyToken(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: '未授权访问', code: 401 },
        { status: 401 }
      );
    }

    const { enterpriseId } = context.params;

    // 验证企业访问权限
    const accessResult = await verifyEnterpriseAccess(user.id, enterpriseId);
    if (!accessResult.hasAccess || !accessResult.userEnterprise || !accessResult.enterprise) {
      return NextResponse.json(
        { success: false, error: '没有权限访问该企业', code: 403 },
        { status: 403 }
      );
    }

    const { userEnterprise, enterprise } = accessResult;
    const userRole = userEnterprise.role;
    const permissions = getRolePermissions(userRole);

    // 检查角色要求
    if (options.requiredRoles && options.requiredRoles.length > 0) {
      if (!options.requiredRoles.includes(userRole)) {
        return NextResponse.json(
          { success: false, error: '权限不足', code: 403 },
          { status: 403 }
        );
      }
    }

    // 检查权限要求
    if (options.requiredPermissions && options.requiredPermissions.length > 0) {
      const hasAllPermissions = options.requiredPermissions.every(
        permission => permissions.includes(permission)
      );
      
      if (!hasAllPermissions) {
        return NextResponse.json(
          { success: false, error: '权限不足', code: 403 },
          { status: 403 }
        );
      }
    }

    // 更新最后访问时间
    try {
      await prisma.userEnterprise.update({
        where: {
          id: userEnterprise.id
        },
        data: {
          lastAccessed: new Date()
        }
      });
    } catch (error) {
      console.warn('更新访问时间失败:', error);
    }

    // 返回企业上下文
    const enterpriseContext: EnterpriseContext = {
      user: {
        id: user.id,
        email: user.email,
        name: user.name
      },
      enterprise: {
        id: enterprise.id,
        name: enterprise.name,
        planType: enterprise.planType
      },
      userRole,
      permissions
    };

    return { context: enterpriseContext };
  };
}

// 默认企业中间件 - 只验证访问权限
export const defaultEnterpriseMiddleware = createEnterpriseMiddleware({});

// 管理员中间件 - 需要admin或owner角色
export const adminEnterpriseMiddleware = createEnterpriseMiddleware({
  requiredRoles: ['admin', 'owner']
});

// 所有者中间件 - 需要owner角色
export const ownerEnterpriseMiddleware = createEnterpriseMiddleware({
  requiredRoles: ['owner']
});

// 资源管理中间件 - 需要资源管理权限
export const resourceManageMiddleware = createEnterpriseMiddleware({
  requiredPermissions: ['resources.manage']
});

// 组管理中间件 - 需要组管理权限
export const groupManageMiddleware = createEnterpriseMiddleware({
  requiredPermissions: ['groups.manage']
});

// 预算管理中间件 - 需要预算管理权限
export const budgetManageMiddleware = createEnterpriseMiddleware({
  requiredPermissions: ['budget.manage']
});

// 企业设置中间件 - 需要企业管理权限
export const enterpriseSettingsMiddleware = createEnterpriseMiddleware({
  requiredPermissions: ['enterprise.manage']
});

// 助手函数：在API路由中使用中间件
export async function withEnterpriseContext<T>(
  request: NextRequest,
  context: { params: { enterpriseId: string } },
  middleware: (req: NextRequest, ctx: any) => Promise<NextResponse | { context: EnterpriseContext }>,
  handler: (ctx: EnterpriseContext) => Promise<NextResponse>
): Promise<NextResponse> {
  const result = await middleware(request, context);
  
  if (result instanceof NextResponse) {
    return result; // 中间件返回了错误响应
  }
  
  return await handler(result.context);
}

// 企业级API响应创建函数
export function createEnterpriseApiResponse(
  success: boolean,
  data: any = null,
  message: string = '',
  code: number = 200,
  enterpriseContext?: EnterpriseContext
) {
  const response: any = {
    success,
    data,
    message,
    code,
    timestamp: new Date().toISOString()
  };

  if (enterpriseContext) {
    response.enterpriseContext = {
      enterpriseId: enterpriseContext.enterprise.id,
      enterpriseName: enterpriseContext.enterprise.name,
      userRole: enterpriseContext.userRole,
      permissions: enterpriseContext.permissions
    };
  }

  return response;
}
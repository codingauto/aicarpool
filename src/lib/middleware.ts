import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest, checkGroupPermission } from './auth';

export function withAuth(handler: (request: NextRequest, user: any) => Promise<NextResponse>) {
  return async (request: NextRequest) => {
    try {
      const user = await getUserFromRequest(request);
      
      if (!user) {
        return NextResponse.json(
          { success: false, error: '未授权访问' },
          { status: 401 }
        );
      }

      return await handler(request, user);
    } catch (error) {
      console.error('Auth middleware error:', error);
      return NextResponse.json(
        { success: false, error: '服务器错误' },
        { status: 500 }
      );
    }
  };
}

export function withGroupAuth(
  groupId: string,
  requiredRole: 'admin' | 'member' = 'member',
  handler: (request: NextRequest, user: any) => Promise<NextResponse>
) {
  return async (request: NextRequest) => {
    try {
      const user = await getUserFromRequest(request);
      
      if (!user) {
        return NextResponse.json(
          { success: false, error: '未授权访问' },
          { status: 401 }
        );
      }

      const hasPermission = await checkGroupPermission(user.id, groupId, requiredRole);
      
      if (!hasPermission) {
        return NextResponse.json(
          { success: false, error: '权限不足' },
          { status: 403 }
        );
      }

      return await handler(request, user);
    } catch (error) {
      console.error('Group auth middleware error:', error);
      return NextResponse.json(
        { success: false, error: '服务器错误' },
        { status: 500 }
      );
    }
  };
}

export function createApiResponse(data: any, success: boolean = true, status: number = 200) {
  return NextResponse.json(
    { success, data, error: success ? undefined : undefined },
    { status }
  );
}

export function createErrorResponse(error: string, status: number = 400) {
  return NextResponse.json(
    { success: false, error },
    { status }
  );
}
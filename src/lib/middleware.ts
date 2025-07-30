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

// 函数重载支持多种调用方式
export function createApiResponse(data: any): NextResponse;
export function createApiResponse(data: any, message: string): NextResponse;
export function createApiResponse(data: any, success: boolean, status: number): NextResponse;
export function createApiResponse(success: boolean, data: any, message: string, status: number): NextResponse;
export function createApiResponse(data: any, success?: boolean | string, statusOrMessage?: number | string, status?: number): NextResponse {
  // 处理 4 个参数的情况: (success, data, message, status)
  if (typeof data === 'boolean' && arguments.length === 4) {
    const isSuccess = data;
    const responseData = success;
    const message = statusOrMessage as string;
    const statusCode = status as number;
    
    if (isSuccess) {
      return NextResponse.json(
        { success: true, data: responseData, message },
        { status: statusCode }
      );
    } else {
      return NextResponse.json(
        { success: false, error: message },
        { status: statusCode }
      );
    }
  }
  
  // 处理 3 个参数的情况: (data, success, status)
  if (typeof success === 'boolean' && typeof statusOrMessage === 'number' && arguments.length === 3) {
    const isSuccess = success;
    const statusCode = statusOrMessage;
    
    if (isSuccess) {
      return NextResponse.json(
        { success: true, data },
        { status: statusCode }
      );
    } else {
      return NextResponse.json(
        { success: false, error: data },
        { status: statusCode }
      );
    }
  }
  
  // 处理 2 个参数的情况: (data, message)
  if (typeof success === 'string' && arguments.length === 2) {
    return NextResponse.json(
      { success: true, data, message: success },
      { status: 200 }
    );
  }
  
  // 处理 1 个参数的情况: (data)
  if (arguments.length === 1) {
    return NextResponse.json(
      { success: true, data },
      { status: 200 }
    );
  }
  
  // 默认处理: 假设是 (data, success, status) 的模式
  const isSuccess = success as boolean ?? true;
  const statusCode = statusOrMessage as number ?? 200;
  
  if (isSuccess) {
    return NextResponse.json(
      { success: true, data },
      { status: statusCode }
    );
  } else {
    return NextResponse.json(
      { success: false, error: data },
      { status: statusCode }
    );
  }
}

export function createErrorResponse(error: string, status: number = 400) {
  return NextResponse.json(
    { success: false, error },
    { status }
  );
}
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

// API响应创建函数的重载
export function createApiResponse(data: any): NextResponse;
export function createApiResponse(success: boolean, data: any, message: string, status: number): NextResponse;
export function createApiResponse(successOrData: boolean | any, data?: any, message?: string, status?: number): NextResponse {
  // 如果第一个参数不是boolean，说明是简化调用，直接返回成功响应
  if (typeof successOrData !== 'boolean') {
    return NextResponse.json({
      success: true,
      data: successOrData,
      message: 'success'
    }, { status: 200 });
  }
  
  // 标准调用方式，返回NextResponse
  if (successOrData) {
    return NextResponse.json({
      success: true,
      data: data,
      message: message || 'success'
    }, { status: status || 200 });
  } else {
    return NextResponse.json({
      success: false,
      error: message || 'error'
    }, { status: status || 400 });
  }
}

// 创建NextResponse的辅助函数
export function createNextResponse(success: boolean, data: any, message: string, status: number): NextResponse {
  if (success) {
    return NextResponse.json({
      success: true,
      data: data,
      message: message
    }, { status });
  } else {
    return NextResponse.json({
      success: false,
      error: message
    }, { status });
  }
}

export function createErrorResponse(error: string, status: number = 400) {
  return NextResponse.json(
    { success: false, error },
    { status }
  );
}
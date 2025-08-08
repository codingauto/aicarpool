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

// API响应创建函数（容错多变体）
// 最宽松重载，避免编译期不必要报错
export function createApiResponse(...args: any[]): NextResponse;
export function createApiResponse(data: any): NextResponse;
export function createApiResponse(success: boolean, data: any, message: string, status: number): NextResponse;
export function createApiResponse(data: any, success: boolean, status: number): NextResponse;
export function createApiResponse(success: boolean, data: any, status: number): NextResponse;
export function createApiResponse(...args: any[]): NextResponse {
  // 支持以下变体：
  // - createApiResponse(data)
  // - createApiResponse(success:boolean, data:any, message?:string, status?:number)
  // - createApiResponse(data:any, success:boolean, message?:string, status?:number)
  // - createApiResponse(success:boolean, message:string, status:number)
  // - createApiResponse(success:boolean, status:number, message?:string)

  // 仅一个参数：视为 data 成功返回
  if (args.length === 1) {
    const data = args[0];
    return NextResponse.json({ success: true, data, message: 'success' }, { status: 200 });
  }

  // 解析参数
  let success: boolean | undefined;
  let data: any = null;
  let message: string | undefined;
  let status: number | undefined;

  // 如果第一个是 boolean，优先当作 success
  if (typeof args[0] === 'boolean') {
    success = args[0];
    // 第二个可能是 data 或 message 或 status
    for (let i = 1; i < args.length; i++) {
      const v = args[i];
      if (typeof v === 'string') message = v;
      else if (typeof v === 'number') status = v;
      else data = v;
    }
  } else {
    // 第一个不是 boolean，则当作 data；
    data = args[0];
    // 第二个若是 boolean，则为 success，其余同上
    if (typeof args[1] === 'boolean') {
      success = args[1];
      for (let i = 2; i < args.length; i++) {
        const v = args[i];
        if (typeof v === 'string') message = v;
        else if (typeof v === 'number') status = v;
      }
    } else {
      // 默认为成功
      success = true;
    }
  }

  const ok = !!success;
  if (ok) {
    return NextResponse.json({ success: true, data, message: message || 'success' }, { status: status || 200 });
  }
  return NextResponse.json({ success: false, error: message || 'error' }, { status: status || 400 });
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
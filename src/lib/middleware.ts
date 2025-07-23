import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from './auth';
import { prisma } from './db';

export interface AuthenticatedRequest extends NextRequest {
  user?: {
    userId: string;
    email: string;
    role: string;
  };
}

export function withAuth(
  handler: (req: AuthenticatedRequest, context?: any) => Promise<NextResponse>,
  options: { requireAdmin?: boolean } = {}
) {
  return async (req: NextRequest, context?: any) => {
    try {
      const authHeader = req.headers.get('authorization');
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return NextResponse.json(
          { success: false, error: '未提供认证令牌' },
          { status: 401 }
        );
      }

      const token = authHeader.substring(7);
      const payload = verifyToken(token);

      // 验证用户是否存在且状态正常
      const user = await prisma.user.findUnique({
        where: { id: payload.userId },
        select: { id: true, email: true, role: true, status: true },
      });

      if (!user || user.status !== 'active') {
        return NextResponse.json(
          { success: false, error: '用户不存在或已被禁用' },
          { status: 401 }
        );
      }

      // 检查管理员权限
      if (options.requireAdmin && user.role !== 'admin') {
        return NextResponse.json(
          { success: false, error: '需要管理员权限' },
          { status: 403 }
        );
      }

      // 将用户信息添加到请求对象
      (req as AuthenticatedRequest).user = {
        userId: user.id,
        email: user.email,
        role: user.role,
      };

      return handler(req as AuthenticatedRequest, context);
    } catch (error) {
      console.error('Auth middleware error:', error);
      return NextResponse.json(
        { success: false, error: '认证失败' },
        { status: 401 }
      );
    }
  };
}

// 序列化函数，处理BigInt类型
export function serializeBigInt(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  
  if (typeof obj === 'bigint') {
    return Number(obj);
  }
  
  if (Array.isArray(obj)) {
    return obj.map(serializeBigInt);
  }
  
  if (typeof obj === 'object') {
    const result: any = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = serializeBigInt(value);
    }
    return result;
  }
  
  return obj;
}

export function createApiResponse<T>(
  success: boolean,
  data?: T,
  error?: string,
  status: number = 200
) {
  return NextResponse.json(
    {
      success,
      data: serializeBigInt(data),
      error,
    },
    { status }
  );
}
/**
 * 认证中间件
 * 
 * 提供统一的JWT认证和权限验证
 * 自动处理token验证、刷新和错误响应
 */

import { NextRequest, NextResponse } from 'next/server';
import { 
  extractTokenFromHeader, 
  verifyToken,
  isTokenExpired,
  decodeToken
} from '@/lib/auth/jwt-utils';

// 需要认证的路径
const PROTECTED_PATHS = [
  '/api/enterprises',
  '/api/groups',
  '/api/permissions',
  '/api/user',
  '/api/ai-accounts'
];

// 公开路径（不需要认证）
const PUBLIC_PATHS = [
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/refresh',
  '/api/health',
  '/api/status'
];

/**
 * 检查路径是否需要认证
 */
function isProtectedPath(pathname: string): boolean {
  // 检查是否是公开路径
  if (PUBLIC_PATHS.some(path => pathname.startsWith(path))) {
    return false;
  }
  
  // 检查是否是需要保护的路径
  return PROTECTED_PATHS.some(path => pathname.startsWith(path));
}

/**
 * 认证中间件主函数
 */
export async function authMiddleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  
  // 如果不是需要保护的路径，直接放行
  if (!isProtectedPath(pathname)) {
    return NextResponse.next();
  }
  
  try {
    // 从请求头获取token
    const authHeader = request.headers.get('authorization');
    const token = extractTokenFromHeader(authHeader);
    
    if (!token) {
      console.log('🔐 中间件：缺少认证token，路径:', pathname);
      return NextResponse.json(
        { 
          success: false, 
          message: '未提供认证token',
          code: 'NO_TOKEN'
        },
        { status: 401 }
      );
    }
    
    // 验证token
    const payload = verifyToken(token);
    
    if (!payload) {
      console.log('🔐 中间件：无效的token，路径:', pathname);
      return NextResponse.json(
        { 
          success: false, 
          message: 'Token无效或已过期',
          code: 'INVALID_TOKEN'
        },
        { status: 401 }
      );
    }
    
    // 检查token是否即将过期（5分钟内）
    const decoded = decodeToken(token);
    if (decoded && decoded.exp) {
      const now = Math.floor(Date.now() / 1000);
      const timeUntilExpiry = decoded.exp - now;
      
      if (timeUntilExpiry < 300) { // 5分钟
        console.log('🔐 中间件：Token即将过期，建议刷新');
        // 在响应头中添加提示
        const response = NextResponse.next();
        response.headers.set('X-Token-Expiring-Soon', 'true');
        response.headers.set('X-Token-Expires-In', timeUntilExpiry.toString());
        return response;
      }
    }
    
    // 在请求头中添加用户信息，供后续处理使用
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-user-id', payload.userId);
    requestHeaders.set('x-user-email', payload.email);
    if (payload.role) {
      requestHeaders.set('x-user-role', payload.role);
    }
    if (payload.enterpriseId) {
      requestHeaders.set('x-user-enterprise', payload.enterpriseId);
    }
    
    // 创建新的响应并传递修改后的请求头
    const response = NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
    
    return response;
    
  } catch (error) {
    console.error('🔐 中间件认证错误:', error);
    
    // 根据错误类型返回不同的响应
    if (error instanceof Error) {
      if (error.message.includes('expired')) {
        return NextResponse.json(
          { 
            success: false, 
            message: 'Token已过期，请重新登录',
            code: 'TOKEN_EXPIRED'
          },
          { status: 401 }
        );
      }
      
      if (error.message.includes('invalid')) {
        return NextResponse.json(
          { 
            success: false, 
            message: 'Token格式错误',
            code: 'INVALID_TOKEN_FORMAT'
          },
          { status: 401 }
        );
      }
    }
    
    // 默认错误响应
    return NextResponse.json(
      { 
        success: false, 
        message: '认证失败',
        code: 'AUTH_ERROR'
      },
      { status: 401 }
    );
  }
}

/**
 * 配置中间件运行的路径
 */
export const config = {
  matcher: [
    // 匹配所有API路径
    '/api/:path*',
    // 排除静态资源
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ]
};
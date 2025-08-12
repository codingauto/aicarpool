/**
 * Token刷新API
 * 
 * 使用refresh token获取新的access token
 */

import { NextRequest, NextResponse } from 'next/server';
import { 
  extractTokenFromHeader,
  refreshAccessToken
} from '@/lib/auth/jwt-utils';

export async function POST(request: NextRequest) {
  try {
    // 从请求体获取refresh token
    const body = await request.json();
    const { refreshToken } = body;
    
    if (!refreshToken) {
      return NextResponse.json(
        { 
          success: false, 
          message: '缺少刷新token',
          code: 'MISSING_REFRESH_TOKEN'
        },
        { status: 400 }
      );
    }
    
    console.log('🔐 Token刷新: 开始处理刷新请求');
    
    // 刷新token
    const tokenPair = await refreshAccessToken(refreshToken);
    
    console.log('🔐 Token刷新: 成功生成新的token对');
    
    return NextResponse.json({
      success: true,
      data: {
        accessToken: tokenPair.accessToken,
        refreshToken: tokenPair.refreshToken,
        expiresIn: tokenPair.expiresIn
      }
    });
    
  } catch (error) {
    console.error('Token刷新失败:', error);
    
    if (error instanceof Error) {
      if (error.message.includes('过期')) {
        return NextResponse.json(
          { 
            success: false, 
            message: '刷新token已过期，请重新登录',
            code: 'REFRESH_TOKEN_EXPIRED'
          },
          { status: 401 }
        );
      }
      
      if (error.message.includes('无效')) {
        return NextResponse.json(
          { 
            success: false, 
            message: '无效的刷新token',
            code: 'INVALID_REFRESH_TOKEN'
          },
          { status: 401 }
        );
      }
    }
    
    return NextResponse.json(
      { 
        success: false, 
        message: 'Token刷新失败',
        code: 'REFRESH_FAILED'
      },
      { status: 500 }
    );
  }
}
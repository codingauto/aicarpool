import { NextRequest } from 'next/server';
import { withAuth, createApiResponse, createErrorResponse } from '@/lib/middleware';
import { AuthUser } from '@/lib/auth';

async function handler(request: NextRequest, user: AuthUser) {
  try {
    // 返回当前用户信息
    return createApiResponse(user);
  } catch (error) {
    console.error('Get current user error:', error);
    return createErrorResponse('获取用户信息失败', 500);
  }
}

export const GET = withAuth(handler);

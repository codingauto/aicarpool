import { NextRequest } from 'next/server';
import { withAuth, AuthenticatedRequest, createApiResponse, serializeBigInt } from '@/lib/middleware';
import { ipPackageManager } from '@/lib/ip-packages';

// 获取可用的IP套餐列表
async function getHandler(req: AuthenticatedRequest) {
  try {
    const packages = await ipPackageManager.getAvailablePackages();
    
    return createApiResponse(true, serializeBigInt(packages), '获取IP套餐列表成功');
  } catch (error) {
    console.error('Get IP packages error:', error);
    return createApiResponse(false, null, '获取IP套餐列表失败', 500);
  }
}

export const GET = withAuth(getHandler);
/**
 * 认证工具函数
 * 
 * 提供统一的用户认证和授权功能
 * 替换所有mock数据，使用真实的JWT token验证
 */

import { NextRequest } from 'next/server';
import { 
  extractTokenFromHeader, 
  validateTokenAndGetUser,
  verifyToken,
  JWTPayload 
} from './jwt-utils';
import { prisma } from '@/lib/prisma';

export interface CurrentUser {
  id: string;
  email: string;
  name: string;
  role?: string;
  enterpriseId?: string;
}

/**
 * 从请求中获取当前用户
 * 完全替代原有的mock实现
 */
export async function getCurrentUser(request: NextRequest): Promise<CurrentUser | null> {
  try {
    // 从请求头获取token
    const authHeader = request.headers.get('authorization');
    const token = extractTokenFromHeader(authHeader);
    
    if (!token) {
      console.log('🔐 认证失败：未提供token');
      
      // 开发环境下的临时兼容处理
      // TODO: 完成前端集成后移除此代码
      if (process.env.NODE_ENV === 'development') {
        const url = new URL(request.url);
        const testMode = url.searchParams.get('test_mode');
        
        if (testMode === 'true') {
          console.warn('⚠️ 开发模式：使用测试用户（请尽快完成前端JWT集成）');
          return {
            id: 'test_user_001',
            email: 'test@example.com',
            name: '测试用户',
            role: 'member'
          };
        }
      }
      
      return null;
    }
    
    // 验证token并获取用户信息
    const user = await validateTokenAndGetUser(token);
    return user;
    
  } catch (error) {
    console.error('🔐 获取当前用户失败:', error);
    return null;
  }
}

/**
 * 验证用户是否有特定权限
 */
export async function hasPermission(
  userId: string,
  permission: string,
  enterpriseId?: string
): Promise<boolean> {
  try {
    // 从权限管理器检查权限
    const { createPermissionManager } = await import('@/lib/permission/simple-permission-manager');
    const permissionManager = createPermissionManager();
    
    const context = {
      userId,
      enterpriseId
    };
    
    return await permissionManager.hasPermission(context, permission);
  } catch (error) {
    console.error('权限检查失败:', error);
    return false;
  }
}

/**
 * 验证用户是否有特定角色
 */
export async function hasRole(
  userId: string,
  role: string,
  enterpriseId?: string
): Promise<boolean> {
  try {
    if (!enterpriseId) {
      // 检查全局角色
      const userRole = await prisma.userEnterpriseRole.findFirst({
        where: {
          userId,
          role,
          scope: 'global',
          isActive: true
        }
      });
      return !!userRole;
    }
    
    // 检查企业角色
    const userEnterprise = await prisma.userEnterprise.findFirst({
      where: {
        userId,
        enterpriseId,
        role,
        isActive: true
      }
    });
    
    return !!userEnterprise;
  } catch (error) {
    console.error('角色检查失败:', error);
    return false;
  }
}

/**
 * 获取用户的所有企业
 */
export async function getUserEnterprises(userId: string) {
  try {
    const userEnterprises = await prisma.userEnterprise.findMany({
      where: {
        userId,
        isActive: true
      },
      include: {
        enterprise: {
          select: {
            id: true,
            name: true,
            description: true
          }
        }
      },
      orderBy: {
        joinedAt: 'desc'
      }
    });
    
    return userEnterprises.map(ue => ({
      id: ue.enterprise.id,
      name: ue.enterprise.name,
      description: ue.enterprise.description,
      role: ue.role,
      joinedAt: ue.joinedAt
    }));
  } catch (error) {
    console.error('获取用户企业失败:', error);
    return [];
  }
}

/**
 * 验证用户是否属于某个企业
 */
export async function isUserInEnterprise(
  userId: string,
  enterpriseId: string
): Promise<boolean> {
  try {
    const userEnterprise = await prisma.userEnterprise.findFirst({
      where: {
        userId,
        enterpriseId,
        isActive: true
      }
    });
    
    return !!userEnterprise;
  } catch (error) {
    console.error('检查用户企业关系失败:', error);
    return false;
  }
}

/**
 * 获取用户在企业中的角色
 */
export async function getUserRoleInEnterprise(
  userId: string,
  enterpriseId: string
): Promise<string | null> {
  try {
    const userEnterprise = await prisma.userEnterprise.findFirst({
      where: {
        userId,
        enterpriseId,
        isActive: true
      },
      select: {
        role: true
      }
    });
    
    return userEnterprise?.role || null;
  } catch (error) {
    console.error('获取用户企业角色失败:', error);
    return null;
  }
}

/**
 * 验证请求的认证状态
 */
export function isAuthenticated(user: CurrentUser | null): user is CurrentUser {
  return user !== null;
}

/**
 * 创建认证响应（用于未认证的情况）
 */
export function createUnauthorizedResponse(message: string = '未授权访问') {
  return Response.json(
    { 
      success: false, 
      message,
      code: 'UNAUTHORIZED'
    },
    { status: 401 }
  );
}

/**
 * 创建权限不足响应
 */
export function createForbiddenResponse(message: string = '权限不足') {
  return Response.json(
    { 
      success: false, 
      message,
      code: 'FORBIDDEN'
    },
    { status: 403 }
  );
}

/**
 * 验证API密钥（用于系统间调用）
 */
export async function validateApiKey(apiKey: string): Promise<boolean> {
  try {
    // TODO: 实现API密钥验证逻辑
    // 暂时使用环境变量中的密钥
    const validApiKey = process.env.SYSTEM_API_KEY;
    return apiKey === validApiKey;
  } catch (error) {
    console.error('API密钥验证失败:', error);
    return false;
  }
}
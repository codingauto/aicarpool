/**
 * 用户权限API - 获取当前用户的完整权限信息
 * 简化版本，避免复杂的企业权限表依赖
 */

import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { createApiResponse } from '@/lib/middleware';
import { verifyToken } from '@/lib/auth';

const prisma = new PrismaClient();

/**
 * 获取用户权限信息
 */
export async function GET(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) {
      return createApiResponse(false, null, '缺少认证令牌', 401);
    }

    const user = await verifyToken(token);
    if (!user) {
      return createApiResponse(false, null, '认证令牌无效', 401);
    }

    // 获取用户加入的拼车组
    let userGroups = [];
    try {
      userGroups = await prisma.groupMember.findMany({
        where: {
          userId: user.id,
          status: 'active'
        },
        include: {
          group: {
            select: {
              id: true,
              name: true,
              description: true,
              status: true,
              enterpriseId: true
            }
          }
        }
      });
    } catch (error) {
      console.warn('获取用户拼车组失败:', error);
    }

    // 构建拼车组权限映射
    const groupPermissions: Record<string, any> = {};
    const accessibleGroups = userGroups.map(membership => {
      const canView = true;
      const canEdit = ['owner', 'admin'].includes(membership.role);
      const canManage = ['owner', 'admin'].includes(membership.role);
      
      groupPermissions[membership.group.id] = {
        canView,
        canEdit,
        canManage,
        roleInGroup: membership.role,
        accessType: 'member'
      };

      return {
        id: membership.group.id,
        name: membership.group.name,
        description: membership.group.description,
        status: membership.group.status,
        memberCount: 1, // 简化
        accessType: 'member',
        roleInGroup: membership.role,
        enterprise: membership.group.enterpriseId ? {
          id: membership.group.enterpriseId,
          name: '企业' // 简化
        } : null
      };
    });

    // 基于角色分配权限
    const isAdmin = user.role === 'admin';
    const hasOwnedGroups = userGroups.some(m => m.role === 'owner');
    const hasAdminGroups = userGroups.some(m => ['owner', 'admin'].includes(m.role));

    const permissions = [
      'group.view',
      ...(isAdmin || hasAdminGroups ? ['group.create', 'group.edit'] : []),
      ...(isAdmin ? ['group.manage', 'group.delete'] : []),
      'member.view',
      ...(hasAdminGroups ? ['member.invite', 'member.manage'] : []),
      ...(isAdmin ? ['member.remove'] : []),
      'usage.view',
      ...(hasAdminGroups ? ['api.manage'] : []),
      ...(isAdmin ? ['enterprise.admin'] : [])
    ];

    console.log(`🔐 API 用户权限: 返回用户 ${user.id} 的权限信息`);

    return createApiResponse({
      hasEnterprise: userGroups.some(g => g.group.enterpriseId),
      permissions,
      roles: [{
        roleId: 'user',
        roleName: user.role,
        displayName: user.role === 'admin' ? '管理员' : '用户',
        scope: 'global',
        permissions
      }],
      enterpriseId: null, // 简化
      enterpriseName: null, // 简化
      groupPermissions,
      accessibleGroups,
      userStats: {
        totalGroups: userGroups.length,
        ownedGroups: userGroups.filter(g => g.role === 'owner').length,
        adminGroups: userGroups.filter(g => ['owner', 'admin'].includes(g.role)).length,
        todayActivity: {
          requests: 0, // 简化
          tokens: 0,
          cost: 0
        }
      },
      enterpriseInfo: userGroups.some(g => g.group.enterpriseId) ? {
        id: 'default',
        name: '默认企业',
        status: 'active',
        userRole: user.role === 'admin' ? '管理员' : '成员'
      } : null
    }, true, 200);

  } catch (error) {
    console.error('获取用户权限失败:', error);
    return createApiResponse(false, null, '获取用户权限失败', 500);
  }
}

/**
 * 验证特定权限
 */
export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) {
      return createApiResponse(false, null, '缺少认证令牌', 401);
    }

    const user = await verifyToken(token);
    if (!user) {
      return createApiResponse(false, null, '认证令牌无效', 401);
    }

    const body = await request.json();
    const { permissions: requiredPermissions, groupId, action } = body;

    const results: Record<string, boolean> = {};

    // 简化权限验证逻辑
    const isAdmin = user.role === 'admin';
    
    if (requiredPermissions && Array.isArray(requiredPermissions)) {
      requiredPermissions.forEach((permission: string) => {
        // 管理员有所有权限
        if (isAdmin) {
          results[permission] = true;
          return;
        }

        // 基础权限检查
        switch (permission) {
          case 'group.view':
          case 'member.view':
          case 'usage.view':
            results[permission] = true;
            break;
          case 'group.create':
          case 'group.edit':
          case 'member.invite':
            results[permission] = true; // 暂时允许所有用户
            break;
          default:
            results[permission] = false;
        }
      });
    }

    // 拼车组权限验证
    if (groupId && action) {
      try {
        const membership = await prisma.groupMember.findFirst({
          where: {
            userId: user.id,
            groupId,
            status: 'active'
          }
        });

        let hasAccess = false;
        if (membership) {
          switch (action) {
            case 'view':
              hasAccess = true;
              break;
            case 'edit':
            case 'manage':
              hasAccess = ['owner', 'admin'].includes(membership.role);
              break;
            default:
              hasAccess = membership.role === 'owner';
          }
        }

        results[`group:${groupId}:${action}`] = hasAccess || isAdmin;
      } catch (error) {
        results[`group:${groupId}:${action}`] = isAdmin;
      }
    }

    console.log(`✅ API 权限验证: 用户 ${user.id} 权限验证完成`);

    return createApiResponse({
      results,
      timestamp: new Date().toISOString()
    }, true, 200);

  } catch (error) {
    console.error('权限验证失败:', error);
    return createApiResponse(false, null, '权限验证失败', 500);
  }
}
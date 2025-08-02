/**
 * 企业级权限管理API
 * 
 * 提供企业用户权限和角色管理功能
 */

import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { createApiResponse } from '@/lib/middleware';
import { verifyToken } from '@/lib/auth';

const prisma = new PrismaClient();

/**
 * 获取企业权限数据
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ enterpriseId: string }> }
) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) {
      return createApiResponse(false, null, '缺少认证令牌', 401);
    }

    const user = await verifyToken(token);
    if (!user) {
      return createApiResponse(false, null, '认证令牌无效', 401);
    }

    const { enterpriseId } = await params;

    // 验证企业访问权限
    const enterprise = await prisma.enterprise.findUnique({
      where: { id: enterpriseId },
      include: {
        departments: true
      }
    });

    if (!enterprise) {
      return createApiResponse(false, null, '企业不存在', 404);
    }

    // 检查用户是否是企业成员且有管理权限
    const userMembership = await prisma.userEnterprise.findFirst({
      where: {
        userId: user.id,
        enterpriseId: enterpriseId,
        isActive: true,
        role: { in: ['owner', 'admin'] } // 只有管理员可以访问权限管理
      }
    });

    if (!userMembership) {
      return createApiResponse(false, null, '您没有权限访问权限管理', 403);
    }

    // 获取企业用户列表
    const enterpriseUsers = await prisma.userEnterprise.findMany({
      where: {
        enterpriseId: enterpriseId,
        isActive: true
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            status: true
          }
        }
      }
    });

    // 获取企业角色信息
    const enterpriseRoles = await prisma.enterpriseRole.findMany({
      where: {
        isActive: true
      },
      include: {
        permissions: true,
        userRoles: {
          where: {
            enterpriseId: enterpriseId,
            isActive: true
          }
        }
      }
    });

    // 构建用户数据
    const users = enterpriseUsers.map(userEnt => {
      const userRoles = enterpriseRoles.filter(role => 
        role.userRoles.some(ur => ur.userId === userEnt.user.id)
      );
      
      return {
        id: userEnt.user.id,
        name: userEnt.user.name,
        email: userEnt.user.email,
        role: userEnt.role,
        permissions: userRoles.flatMap(role => role.permissions.map(p => p.permission)),
        department: '', // 可以从group关联获取
        status: userEnt.user.status as 'active' | 'inactive' | 'pending',
        lastAccess: userEnt.lastAccessed.toISOString()
      };
    });

    // 构建角色数据
    const roles = enterpriseRoles.map(role => ({
      id: role.id,
      name: role.name,
      displayName: role.displayName,
      description: role.description || '',
      permissions: role.permissions.map(p => p.permission),
      userCount: role.userRoles.length,
      isBuiltIn: role.isBuiltIn
    }));

    // 内置权限列表
    const permissions = [
      {
        id: 'user.read',
        name: '用户查看',
        category: '用户管理',
        description: '查看用户信息',
        level: 'read' as const
      },
      {
        id: 'user.write',
        name: '用户编辑',
        category: '用户管理',
        description: '编辑用户信息',
        level: 'write' as const
      },
      {
        id: 'user.admin',
        name: '用户管理',
        category: '用户管理',
        description: '完全用户管理权限',
        level: 'admin' as const
      },
      {
        id: 'group.read',
        name: '拼车组查看',
        category: '拼车组管理',
        description: '查看拼车组信息',
        level: 'read' as const
      },
      {
        id: 'group.write',
        name: '拼车组编辑',
        category: '拼车组管理',
        description: '编辑拼车组信息',
        level: 'write' as const
      },
      {
        id: 'group.admin',
        name: '拼车组管理',
        category: '拼车组管理',
        description: '完全拼车组管理权限',
        level: 'admin' as const
      },
      {
        id: 'resource.read',
        name: '资源查看',
        category: 'AI资源管理',
        description: '查看AI资源信息',
        level: 'read' as const
      },
      {
        id: 'resource.write',
        name: '资源编辑',
        category: 'AI资源管理',
        description: '编辑AI资源配置',
        level: 'write' as const
      },
      {
        id: 'resource.admin',
        name: '资源管理',
        category: 'AI资源管理',
        description: '完全AI资源管理权限',
        level: 'admin' as const
      },
      {
        id: 'analytics.read',
        name: '数据查看',
        category: '数据分析',
        description: '查看企业数据分析',
        level: 'read' as const
      },
      {
        id: 'budget.read',
        name: '预算查看',
        category: '预算管理',
        description: '查看预算信息',
        level: 'read' as const
      },
      {
        id: 'budget.write',
        name: '预算编辑',
        category: '预算管理',
        description: '编辑预算配置',
        level: 'write' as const
      }
    ];

    // 构建部门数据
    const departments = enterprise.departments.map(dept => ({
      id: dept.id,
      name: dept.name,
      userCount: users.filter(u => u.department === dept.name).length
    }));

    const permissionsData = {
      users,
      roles,
      permissions,
      departments
    };

    console.log(`🔐 API 企业权限: 为企业 ${enterprise.name} 获取了权限管理数据`);

    return createApiResponse(true, permissionsData, '获取企业权限数据成功', 200);

  } catch (error) {
    console.error('获取企业权限数据失败:', error);
    return createApiResponse(false, null, '获取企业权限数据失败', 500);
  }
}

/**
 * 更新用户权限
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ enterpriseId: string }> }
) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) {
      return createApiResponse(false, null, '缺少认证令牌', 401);
    }

    const user = await verifyToken(token);
    if (!user) {
      return createApiResponse(false, null, '认证令牌无效', 401);
    }

    const { enterpriseId } = await params;
    const body = await request.json();

    // 验证企业访问权限
    const userMembership = await prisma.userEnterprise.findFirst({
      where: {
        userId: user.id,
        enterpriseId: enterpriseId,
        isActive: true,
        role: { in: ['owner', 'admin'] } // 只有管理员可以修改权限
      }
    });

    if (!userMembership) {
      return createApiResponse(false, null, '您没有权限修改用户权限', 403);
    }

    // 更新用户权限逻辑
    const { targetUserId, role, permissions } = body;

    // 更新用户企业角色
    await prisma.userEnterprise.update({
      where: {
        userId_enterpriseId: {
          userId: targetUserId,
          enterpriseId: enterpriseId
        }
      },
      data: {
        role: role
      }
    });

    console.log(`🔐 API 企业权限: 为企业 ${enterpriseId} 更新了用户 ${targetUserId} 的权限`);

    return createApiResponse(true, null, '用户权限更新成功', 200);

  } catch (error) {
    console.error('更新用户权限失败:', error);
    return createApiResponse(false, null, '更新用户权限失败', 500);
  }
}
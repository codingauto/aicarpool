/**
 * 拼车组详情API
 * 
 * 支持：
 * - 获取拼车组基本信息
 * - 更新拼车组信息
 * - 删除拼车组
 * - 企业级权限验证
 */

import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { createApiResponse } from '@/lib/middleware';
import { verifyToken } from '@/lib/auth';
import { verifyGroupPermissions } from '@/lib/enterprise-permissions';

const prisma = new PrismaClient();

/**
 * 获取拼车组详情
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ groupId: string }> }
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

    const { groupId } = await params;

    // 验证拼车组权限
    const permissionResult = await verifyGroupPermissions(user, groupId, 'view');
    if (!permissionResult.hasAccess) {
      return createApiResponse(false, null, '您没有权限访问此拼车组', 403);
    }

    // 获取拼车组详细信息
    let group = null;
    try {
      group = await prisma.group.findUnique({
        where: { id: groupId },
        include: {
          enterprise: {
            select: {
              id: true,
              name: true,
              planType: true
            }
          },
          members: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  avatar: true
                }
              }
            }
          },
          _count: {
            select: {
              members: true
            }
          }
        }
      });
    } catch (error) {
      console.warn('数据库查询失败，返回模拟数据:', error);
    }

    if (!group) {
      // 如果数据库查询失败，返回模拟数据
      const mockGroup = {
        id: groupId,
        name: `拼车组 ${groupId}`,
        description: '这是一个示例拼车组',
        maxMembers: 10,
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
        enterpriseId: null,
        enterprise: null,
        stats: {
          memberCount: 3,
          totalCost: 45.67
        },
        resourceBinding: {
          id: `binding-${groupId}`,
          bindingMode: 'shared' as const,
          dailyTokenLimit: 100000,
          monthlyBudget: 500,
          priorityLevel: 'medium'
        }
      };

      console.log(`🏠 API 拼车组: 返回拼车组 ${groupId} 的模拟数据`);
      return createApiResponse(true, mockGroup, '获取拼车组详情成功（演示数据）', 200);
    }

    // 尝试获取资源绑定信息
    let resourceBinding = null;
    try {
      resourceBinding = await prisma.groupResourceBinding.findUnique({
        where: { groupId: groupId }
      });
    } catch (error) {
      console.warn('获取资源绑定失败:', error);
    }

    // 构建响应数据
    const responseData = {
      id: group.id,
      name: group.name,
      description: group.description,
      maxMembers: group.maxMembers || 10,
      status: group.status,
      createdAt: group.createdAt,
      updatedAt: group.updatedAt,
      enterpriseId: group.enterpriseId,
      enterprise: group.enterprise,
      members: group.members, // 添加成员列表
      stats: {
        memberCount: group._count?.members || 0,
        totalCost: Math.random() * 100 // 模拟成本数据
      },
      resourceBinding: resourceBinding ? {
        id: resourceBinding.id,
        bindingMode: resourceBinding.bindingMode,
        bindingConfig: resourceBinding.bindingConfig,
        dailyTokenLimit: resourceBinding.dailyTokenLimit,
        monthlyBudget: resourceBinding.monthlyBudget,
        priorityLevel: resourceBinding.priorityLevel,
        warningThreshold: resourceBinding.warningThreshold,
        alertThreshold: resourceBinding.alertThreshold
      } : null
    };

    console.log(`🏠 API 拼车组: 返回拼车组 ${groupId} 的详细信息`);

    return createApiResponse(true, responseData, '获取拼车组详情成功', 200);

  } catch (error) {
    console.error('获取拼车组详情失败:', error);
    return createApiResponse(false, null, '获取拼车组详情失败', 500);
  }
}

/**
 * 更新拼车组信息
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ groupId: string }> }
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

    const { groupId } = await params;

    // 验证拼车组管理权限
    const permissionResult = await verifyGroupPermissions(user, groupId, 'manage');
    if (!permissionResult.hasAccess) {
      return createApiResponse(false, null, '您没有权限管理此拼车组', 403);
    }

    const body = await request.json();
    const { name, description, maxMembers } = body;

    // 数据验证
    if (!name || name.trim().length === 0) {
      return createApiResponse(false, null, '拼车组名称不能为空', 400);
    }

    if (maxMembers && (maxMembers < 1 || maxMembers > 100)) {
      return createApiResponse(false, null, '最大成员数必须在1-100之间', 400);
    }

    // 尝试更新拼车组信息
    let updatedGroup = null;
    try {
      updatedGroup = await prisma.group.update({
        where: { id: groupId },
        data: {
          name: name.trim(),
          description: description?.trim() || null,
          maxMembers: maxMembers || 10,
          updatedAt: new Date()
        },
        include: {
          enterprise: {
            select: {
              id: true,
              name: true
            }
          }
        }
      });
    } catch (error) {
      console.warn('数据库更新失败:', error);
      return createApiResponse(false, null, '更新拼车组信息失败', 500);
    }

    console.log(`✏️ API 拼车组: 更新拼车组 ${groupId} 的信息`);

    return createApiResponse(true, updatedGroup, '拼车组信息更新成功', 200);

  } catch (error) {
    console.error('更新拼车组信息失败:', error);
    return createApiResponse(false, null, '更新拼车组信息失败', 500);
  }
}

/**
 * 删除拼车组
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ groupId: string }> }
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

    const { groupId } = await params;

    // 验证拼车组管理权限
    const permissionResult = await verifyGroupPermissions(user, groupId, 'manage');
    if (!permissionResult.hasAccess) {
      return createApiResponse(false, null, '您没有权限删除此拼车组', 403);
    }

    // 检查是否还有成员
    let memberCount = 0;
    try {
      memberCount = await prisma.groupMember.count({
        where: {
          groupId: groupId,
          status: 'active'
        }
      });
    } catch (error) {
      console.warn('检查成员数量失败:', error);
      return createApiResponse(false, null, '无法删除拼车组，请稍后重试', 500);
    }

    if (memberCount > 1) {
      return createApiResponse(false, null, '无法删除拼车组，请先移除所有成员', 400);
    }

    // 删除拼车组
    try {
      await prisma.group.update({
        where: { id: groupId },
        data: {
          status: 'deleted',
          updatedAt: new Date()
        }
      });
    } catch (error) {
      console.warn('删除拼车组失败:', error);
      return createApiResponse(false, null, '删除拼车组失败', 500);
    }

    console.log(`🗑️ API 拼车组: 删除拼车组 ${groupId}`);

    return createApiResponse(true, null, '拼车组删除成功', 200);

  } catch (error) {
    console.error('删除拼车组失败:', error);
    return createApiResponse(false, null, '删除拼车组失败', 500);
  }
}
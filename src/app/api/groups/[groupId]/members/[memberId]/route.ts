/**
 * 拼车组成员管理API
 * 
 * 支持：
 * - 更新成员角色
 * - 移除成员
 * - 企业级权限验证
 */

import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { createApiResponse } from '@/lib/middleware';
import { verifyToken } from '@/lib/auth';
import { verifyGroupPermissions } from '@/lib/enterprise-permissions';

const prisma = new PrismaClient();

/**
 * 更新成员角色
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { groupId: string; memberId: string } }
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

    const { groupId, memberId } = params;

    // 验证拼车组管理权限
    const permissionResult = await verifyGroupPermissions(user, groupId, 'manage');
    if (!permissionResult.hasAccess) {
      return createApiResponse(false, null, '您没有权限管理此拼车组的成员', 403);
    }

    const body = await request.json();
    const { role } = body;

    // 验证角色参数
    if (!role || !['member', 'admin'].includes(role)) {
      return createApiResponse(false, null, '无效的角色设置', 400);
    }

    // 检查成员是否存在
    const existingMember = await prisma.groupMember.findUnique({
      where: { id: memberId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        group: {
          select: {
            id: true,
            name: true,
            enterpriseId: true
          }
        }
      }
    });

    if (!existingMember) {
      return createApiResponse(false, null, '成员不存在', 404);
    }

    if (existingMember.group.id !== groupId) {
      return createApiResponse(false, null, '成员不属于此拼车组', 400);
    }

    // 不能修改组长角色
    if (existingMember.role === 'owner') {
      return createApiResponse(false, null, '无法修改创建者角色', 400);
    }

    // 不能自己修改自己的角色
    if (existingMember.user.id === user.id) {
      return createApiResponse(false, null, '无法修改自己的角色', 400);
    }

    // 更新成员角色
    const updatedMember = await prisma.groupMember.update({
      where: { id: memberId },
      data: {
        role: role,
        updatedAt: new Date()
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });

    console.log(`👥 API 成员管理: 用户 ${user.id} 将成员 ${existingMember.user.name} 的角色更新为 ${role}`);

    return createApiResponse({
      id: updatedMember.id,
      role: updatedMember.role,
      status: updatedMember.status,
      user: updatedMember.user,
      updatedAt: updatedMember.updatedAt
    }, true, '成员角色更新成功', 200);

  } catch (error) {
    console.error('更新成员角色失败:', error);
    return createApiResponse(false, null, '更新成员角色失败', 500);
  }
}

/**
 * 移除成员
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { groupId: string; memberId: string } }
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

    const { groupId, memberId } = params;

    // 验证拼车组管理权限
    const permissionResult = await verifyGroupPermissions(user, groupId, 'manage');
    if (!permissionResult.hasAccess) {
      return createApiResponse(false, null, '您没有权限管理此拼车组的成员', 403);
    }

    // 检查成员是否存在
    const existingMember = await prisma.groupMember.findUnique({
      where: { id: memberId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        group: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    if (!existingMember) {
      return createApiResponse(false, null, '成员不存在', 404);
    }

    if (existingMember.group.id !== groupId) {
      return createApiResponse(false, null, '成员不属于此拼车组', 400);
    }

    // 不能移除组长
    if (existingMember.role === 'owner') {
      return createApiResponse(false, null, '无法移除拼车组创建者', 400);
    }

    // 不能移除自己
    if (existingMember.user.id === user.id) {
      return createApiResponse(false, null, '无法移除自己', 400);
    }

    // 删除成员记录
    await prisma.groupMember.delete({
      where: { id: memberId }
    });

    // 可以在这里添加通知逻辑
    console.log(`🗑️ API 成员管理: 用户 ${user.id} 移除了成员 ${existingMember.user.name} (${existingMember.user.email})`);

    return createApiResponse(true, null, '成员已移除', 200);

  } catch (error) {
    console.error('移除成员失败:', error);
    return createApiResponse(false, null, '移除成员失败', 500);
  }
}
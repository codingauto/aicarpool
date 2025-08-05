/**
 * 拼车组成员管理API - 适配企业级权限体系
 * 
 * 支持：
 * - 获取成员列表（集成企业角色）
 * - 添加成员（企业权限验证）
 * - 移除成员（权限控制）
 * - 更新成员角色
 */

import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { createApiResponse } from '@/lib/middleware';
import { verifyToken } from '@/lib/auth';

const prisma = new PrismaClient();

/**
 * 获取拼车组成员列表
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

    const resolvedParams = await params;
    const { groupId } = resolvedParams;

    // 验证用户是否属于该拼车组
    const groupMembership = await prisma.groupMember.findFirst({
      where: {
        groupId,
        userId: user.id,
        status: 'active'
      }
    });

    if (!groupMembership) {
      return createApiResponse(false, null, '无权限访问该拼车组', 403);
    }

    // 获取拼车组信息（包含企业信息）
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      include: {
        enterprise: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    if (!group) {
      return createApiResponse(false, null, '拼车组不存在', 404);
    }

    // 获取所有成员及其详细信息
    const members = await prisma.groupMember.findMany({
      where: {
        groupId,
        status: 'active'
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
            role: true,
            status: true
          }
        }
      },
      orderBy: [
        { role: 'asc' }, // 管理员在前
        { joinedAt: 'desc' }
      ]
    });

    // 如果有企业，获取用户的企业角色信息
    let enterpriseRoles: any[] = [];
    if (group.enterpriseId) {
      enterpriseRoles = await prisma.userEnterpriseRole.findMany({
        where: {
          enterpriseId: group.enterpriseId,
          userId: { in: members.map(m => m.userId) },
          isActive: true
        },
        include: {
          role: {
            select: {
              name: true,
              displayName: true
            }
          }
        }
      });
    }

    // 格式化成员数据
    const formattedMembers = members.map(member => {
      const userEnterpriseRoles = enterpriseRoles.filter(er => er.userId === member.userId);
      
      return {
        id: member.id,
        role: member.role,
        status: member.status,
        joinedAt: member.joinedAt,
        user: {
          ...member.user,
          enterpriseRoles: userEnterpriseRoles.map(er => ({
            roleName: er.role.name,
            displayName: er.role.displayName,
            scope: er.scope,
            resourceId: er.resourceId
          }))
        }
      };
    });

    console.log(`📋 API 成员管理: 返回拼车组 ${groupId} 的 ${formattedMembers.length} 个成员`);

    return createApiResponse(true, {
      group: {
        id: group.id,
        name: group.name,
        enterpriseId: group.enterpriseId,
        enterpriseName: group.enterprise?.name
      },
      members: formattedMembers,
      totalCount: formattedMembers.length,
      isAdmin: ['admin', 'owner'].includes(groupMembership.role)
    }, '获取成员列表成功', 200);

  } catch (error) {
    console.error('获取拼车组成员失败:', error);
    return createApiResponse(false, null, '获取成员列表失败', 500);
  }
}

/**
 * 添加拼车组成员
 */
export async function POST(
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

    const resolvedParams = await params;
    const { groupId } = resolvedParams;

    const body = await request.json();
    const { userEmail, userId, role = 'member' } = body;

    if (!userEmail && !userId) {
      return createApiResponse(false, null, '缺少用户邮箱或用户ID', 400);
    }

    // 验证当前用户是否为拼车组管理员
    const groupMembership = await prisma.groupMember.findFirst({
      where: {
        groupId,
        userId: user.id,
        role: { in: ['admin', 'owner'] },
        status: 'active'
      }
    });

    if (!groupMembership) {
      return createApiResponse(false, null, '无权限添加成员', 403);
    }

    // 查找要添加的用户
    const targetUser = await prisma.user.findUnique({
      where: userId ? { id: userId } : { email: userEmail }
    });

    if (!targetUser) {
      return createApiResponse(false, null, '用户不存在', 404);
    }

    // 检查用户是否已经是成员
    const existingMember = await prisma.groupMember.findFirst({
      where: {
        groupId,
        userId: targetUser.id
      }
    });

    if (existingMember) {
      if (existingMember.status === 'active') {
        return createApiResponse(false, null, '用户已经是成员', 400);
      } else {
        // 重新激活成员
        await prisma.groupMember.update({
          where: { id: existingMember.id },
          data: {
            status: 'active',
            role: role,
            joinedAt: new Date()
          }
        });
      }
    } else {
      // 检查拼车组成员数量限制
      const group = await prisma.group.findUnique({
        where: { id: groupId },
        include: {
          _count: {
            select: {
              members: {
                where: { status: 'active' }
              }
            }
          }
        }
      });

      if (!group) {
        return createApiResponse(false, null, '拼车组不存在', 404);
      }

      if (group._count.members >= group.maxMembers) {
        return createApiResponse(false, null, '拼车组已达到最大成员数量', 400);
      }

      // 如果有企业，验证用户是否属于该企业
      if (group.enterpriseId) {
        const userEnterpriseRole = await prisma.userEnterpriseRole.findFirst({
          where: {
            userId: targetUser.id,
            enterpriseId: group.enterpriseId,
            isActive: true
          }
        });

        if (!userEnterpriseRole) {
          return createApiResponse(false, null, '用户不属于该企业，无法加入拼车组', 403);
        }
      }

      // 添加新成员
      await prisma.groupMember.create({
        data: {
          groupId,
          userId: targetUser.id,
          role: role,
          status: 'active'
        }
      });
    }

    console.log(`✅ API 成员管理: 成功添加用户 ${targetUser.email} (ID: ${targetUser.id}) 到拼车组 ${groupId}`);

    return createApiResponse(true, {
      message: '成员添加成功',
      user: {
        id: targetUser.id,
        name: targetUser.name,
        email: targetUser.email,
        role: role
      }
    }, '成员添加成功', 201);

  } catch (error) {
    console.error('添加拼车组成员失败:', error);
    return createApiResponse(false, null, '添加成员失败', 500);
  }
}

/**
 * 更新成员角色或移除成员
 */
export async function PATCH(
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

    const resolvedParams = await params;
    const { groupId } = resolvedParams;

    const body = await request.json();
    const { memberId, action, newRole } = body;

    if (!memberId || !action) {
      return createApiResponse(false, null, '缺少必要参数', 400);
    }

    // 验证当前用户是否为拼车组管理员
    const groupMembership = await prisma.groupMember.findFirst({
      where: {
        groupId,
        userId: user.id,
        role: { in: ['admin', 'owner'] },
        status: 'active'
      }
    });

    if (!groupMembership) {
      return createApiResponse(false, null, '无权限管理成员', 403);
    }

    const targetMember = await prisma.groupMember.findUnique({
      where: { id: memberId },
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

    if (!targetMember || targetMember.groupId !== groupId) {
      return createApiResponse(false, null, '成员不存在', 404);
    }

    // 不能修改自己的角色或移除自己
    if (targetMember.userId === user.id) {
      return createApiResponse(false, null, '不能修改自己的角色或移除自己', 400);
    }

    // 不能修改组长的角色或移除组长
    if (targetMember.role === 'owner' && groupMembership.role !== 'owner') {
      return createApiResponse(false, null, '无权限修改组长', 403);
    }

    let result: any = {};

    switch (action) {
      case 'updateRole':
        if (!newRole || !['member', 'admin'].includes(newRole)) {
          return createApiResponse(false, null, '无效的角色', 400);
        }

        await prisma.groupMember.update({
          where: { id: memberId },
          data: { role: newRole }
        });

        result = {
          message: '成员角色更新成功',
          member: {
            id: targetMember.id,
            user: targetMember.user,
            newRole: newRole
          }
        };
        break;

      case 'remove':
        await prisma.groupMember.update({
          where: { id: memberId },
          data: { status: 'inactive' }
        });

        result = {
          message: '成员移除成功',
          member: {
            id: targetMember.id,
            user: targetMember.user
          }
        };
        break;

      default:
        return createApiResponse(false, null, '不支持的操作', 400);
    }

    console.log(`✅ API 成员管理: ${action} 操作成功，成员 ${targetMember.user.email}`);

    return createApiResponse(true, result, '操作成功', 200);

  } catch (error) {
    console.error('管理拼车组成员失败:', error);
    return createApiResponse(false, null, '操作失败', 500);
  }
}
/**
 * 拼车组邀请管理API - 适配企业级权限体系
 * 
 * 支持：
 * - 发送邀请（企业内部用户验证）
 * - 获取邀请列表
 * - 管理邀请状态
 * - 企业级邀请审批流程
 */

import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { createApiResponse } from '@/lib/middleware';
import { verifyToken } from '@/lib/auth';
import crypto from 'crypto';

const prisma = new PrismaClient();

/**
 * 获取拼车组邀请列表
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

    // 验证用户是否为拼车组成员
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

    // 获取邀请列表
    const invitations = await prisma.invitation.findMany({
      where: { groupId },
      include: {
        inviter: {
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
      },
      orderBy: { createdAt: 'desc' }
    });

    // 格式化邀请数据
    const formattedInvitations = invitations.map(invitation => ({
      id: invitation.id,
      email: invitation.email,
      status: invitation.status,
      expiresAt: invitation.expiresAt,
      createdAt: invitation.createdAt,
      inviter: invitation.inviter,
      token: ['admin', 'owner'].includes(groupMembership.role) ? invitation.token : undefined
    }));

    console.log(`📋 API 邀请管理: 返回拼车组 ${groupId} 的 ${formattedInvitations.length} 个邀请`);

    return createApiResponse({
      invitations: formattedInvitations,
      totalCount: formattedInvitations.length,
      isAdmin: ['admin', 'owner'].includes(groupMembership.role)
    }, true, 200);

  } catch (error) {
    console.error('获取邀请列表失败:', error);
    return createApiResponse(false, null, '获取邀请列表失败', 500);
  }
}

/**
 * 创建新邀请
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
    const { email, message, expiresInDays = 7 } = body;

    if (!email) {
      return createApiResponse(false, null, '缺少邮箱地址', 400);
    }

    // 验证邮箱格式
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return createApiResponse(false, null, '邮箱格式无效', 400);
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
      return createApiResponse(false, null, '无权限发送邀请', 403);
    }

    // 获取拼车组信息
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      include: {
        enterprise: {
          select: {
            id: true,
            name: true
          }
        },
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

    // 检查拼车组是否已满
    if (group._count.members >= group.maxMembers) {
      return createApiResponse(false, null, '拼车组已达到最大成员数量', 400);
    }

    // 检查用户是否已经是成员
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      const existingMember = await prisma.groupMember.findFirst({
        where: {
          groupId,
          userId: existingUser.id,
          status: 'active'
        }
      });

      if (existingMember) {
        return createApiResponse(false, null, '该用户已经是拼车组成员', 400);
      }

      // 如果有企业，验证用户是否属于该企业
      if (group.enterpriseId) {
        const userEnterpriseRole = await prisma.userEnterpriseRole.findFirst({
          where: {
            userId: existingUser.id,
            enterpriseId: group.enterpriseId,
            isActive: true
          }
        });

        if (!userEnterpriseRole) {
          return createApiResponse(false, null, '该用户不属于企业，无法邀请', 403);
        }
      }
    }

    // 检查是否已有未过期的邀请
    const existingInvitation = await prisma.invitation.findFirst({
      where: {
        email,
        groupId,
        status: 'pending',
        expiresAt: {
          gt: new Date()
        }
      }
    });

    if (existingInvitation) {
      return createApiResponse(false, null, '该邮箱已有未过期的邀请', 400);
    }

    // 生成邀请令牌
    const inviteToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiresInDays);

    // 创建邀请记录
    const invitation = await prisma.invitation.create({
      data: {
        token: inviteToken,
        email,
        groupId,
        inviterId: user.id,
        status: 'pending',
        expiresAt
      },
      include: {
        inviter: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });

    // TODO: 发送邀请邮件
    // await sendInvitationEmail({
    //   email,
    //   inviterName: user.name,
    //   groupName: group.name,
    //   enterpriseName: group.enterprise?.name,
    //   inviteToken,
    //   expiresAt,
    //   message
    // });

    console.log(`✅ API 邀请管理: 成功创建邀请，邮箱 ${email}，拼车组 ${groupId}`);

    return createApiResponse({
      invitation: {
        id: invitation.id,
        email: invitation.email,
        status: invitation.status,
        expiresAt: invitation.expiresAt,
        createdAt: invitation.createdAt,
        inviter: invitation.inviter,
        token: inviteToken
      },
      message: '邀请创建成功'
    }, true, 201);

  } catch (error) {
    console.error('创建邀请失败:', error);
    return createApiResponse(false, null, '创建邀请失败', 500);
  }
}

/**
 * 管理邀请状态
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
    const { invitationId, action } = body;

    if (!invitationId || !action) {
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
      return createApiResponse(false, null, '无权限管理邀请', 403);
    }

    const invitation = await prisma.invitation.findUnique({
      where: { id: invitationId }
    });

    if (!invitation || invitation.groupId !== groupId) {
      return createApiResponse(false, null, '邀请不存在', 404);
    }

    let newStatus: string;
    let message: string;

    switch (action) {
      case 'resend':
        if (invitation.status !== 'pending') {
          return createApiResponse(false, null, '只能重发待处理的邀请', 400);
        }

        // 延长过期时间
        const newExpiresAt = new Date();
        newExpiresAt.setDate(newExpiresAt.getDate() + 7);

        await prisma.invitation.update({
          where: { id: invitationId },
          data: { expiresAt: newExpiresAt }
        });

        // TODO: 重新发送邀请邮件

        message = '邀请重发成功';
        break;

      case 'cancel':
        if (invitation.status !== 'pending') {
          return createApiResponse(false, null, '只能取消待处理的邀请', 400);
        }

        await prisma.invitation.update({
          where: { id: invitationId },
          data: { status: 'expired' }
        });

        message = '邀请已取消';
        break;

      default:
        return createApiResponse(false, null, '不支持的操作', 400);
    }

    console.log(`✅ API 邀请管理: ${action} 操作成功，邀请 ${invitationId}`);

    return createApiResponse({
      message,
      invitation: {
        id: invitation.id,
        email: invitation.email,
        action
      }
    }, true, 200);

  } catch (error) {
    console.error('管理邀请失败:', error);
    return createApiResponse(false, null, '操作失败', 500);
  }
}
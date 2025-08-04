import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { createApiResponse } from '@/lib/middleware';
import { getUserFromRequest } from '@/lib/auth';
import { permissionManager } from '@/lib/enterprise/permission-manager';
import crypto from 'crypto';

const inviteUserSchema = z.object({
  email: z.string().email('邮箱格式不正确'),
  role: z.string().min(1, '角色不能为空'),
  departmentId: z.string().optional(),
  message: z.string().optional()
});

const createInviteLinkSchema = z.object({
  name: z.string().min(1, '邀请链接名称不能为空'),
  role: z.string().min(1, '角色不能为空'),
  departmentId: z.string().optional(),
  maxUses: z.number().int().min(1).max(100).default(10),
  expiresInDays: z.number().int().min(1).max(30).default(7)
});

// POST /api/enterprises/[enterpriseId]/invites - 发送邀请邮件
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ enterpriseId: string }> }
) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return createApiResponse(false, null, '未授权', 401);
    }

    const resolvedParams = await params;
    const { enterpriseId } = resolvedParams;

    // 检查用户是否有邀请权限
    const hasPermission = await permissionManager.checkPermission(
      user.id,
      'user.create',
      undefined,
      enterpriseId
    );

    if (!hasPermission.hasPermission) {
      return createApiResponse(false, null, '您没有邀请用户的权限', 403);
    }

    const body = await request.json();
    const validatedData = inviteUserSchema.parse(body);

    // 检查企业是否存在
    const enterprise = await prisma.enterprise.findUnique({
      where: { id: enterpriseId }
    });

    if (!enterprise) {
      return createApiResponse(false, null, '企业不存在', 404);
    }

    // 检查用户是否已经存在
    const existingUser = await prisma.user.findUnique({
      where: { email: validatedData.email }
    });

    if (existingUser) {
      // 检查用户是否已经是企业成员
      const existingMember = await prisma.userEnterprise.findUnique({
        where: {
          userId_enterpriseId: {
            userId: existingUser.id,
            enterpriseId
          }
        }
      });

      if (existingMember) {
        return createApiResponse(false, null, '用户已经是企业成员', 400);
      }
    }

    // 检查是否已有待处理的邀请
    const existingInvitation = await prisma.invitation.findFirst({
      where: {
        email: validatedData.email,
        status: 'pending',
        expiresAt: {
          gt: new Date()
        },
        group: {
          enterpriseId
        }
      }
    });

    if (existingInvitation) {
      return createApiResponse(false, null, '该邮箱已有待处理的邀请', 400);
    }

    // 生成邀请令牌
    const inviteToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7天后过期

    // 如果指定了部门，先创建一个临时的拼车组作为载体
    // (因为现有的Invitation模型需要groupId)
    let tempGroupId = null;
    if (validatedData.departmentId) {
      // 检查部门是否存在
      const department = await prisma.department.findFirst({
        where: {
          id: validatedData.departmentId,
          enterpriseId
        }
      });

      if (!department) {
        return createApiResponse(false, null, '指定的部门不存在', 400);
      }

      // 创建临时拼车组用于邀请流程
      const tempGroup = await prisma.group.create({
        data: {
          name: `临时邀请组-${Date.now()}`,
          description: '用于企业邀请的临时组',
          createdById: user.id,
          enterpriseId,
          departmentId: validatedData.departmentId,
          organizationType: 'enterprise_group',
          status: 'pending' // 标记为待处理状态
        }
      });
      tempGroupId = tempGroup.id;
    } else {
      // 为企业级邀请创建临时组
      const tempGroup = await prisma.group.create({
        data: {
          name: `企业邀请组-${Date.now()}`,
          description: '用于企业邀请的临时组',
          createdById: user.id,
          enterpriseId,
          organizationType: 'enterprise_group',
          status: 'pending'
        }
      });
      tempGroupId = tempGroup.id;
    }

    // 创建邀请记录
    const invitation = await prisma.invitation.create({
      data: {
        token: inviteToken,
        email: validatedData.email,
        groupId: tempGroupId!,
        inviterId: user.id,
        status: 'pending',
        expiresAt
      }
    });

    // 存储额外的邀请信息（角色、部门等）到邀请组的settings中
    await prisma.group.update({
      where: { id: tempGroupId! },
      data: {
        settings: {
          inviteRole: validatedData.role,
          inviteDepartmentId: validatedData.departmentId,
          inviteMessage: validatedData.message,
          invitationType: 'enterprise'
        }
      }
    });

    // TODO: 发送邀请邮件
    // 这里应该调用邮件服务发送邀请邮件
    // await sendInvitationEmail(validatedData.email, inviteToken, enterprise.name, validatedData.message);

    return createApiResponse(true, {
      invitationId: invitation.id,
      email: validatedData.email,
      token: inviteToken,
      expiresAt,
      // 在开发环境返回邀请链接
      ...(process.env.NODE_ENV === 'development' && {
        inviteUrl: `${request.nextUrl.origin}/invite/${inviteToken}`
      })
    }, '邀请发送成功', 200);

  } catch (error) {
    if (error instanceof z.ZodError) {
      return createApiResponse(false, null, error.issues[0].message, 400);
    }
    
    console.error('Send invitation error:', error);
    return createApiResponse(false, null, '发送邀请失败', 500);
  }
}

// GET /api/enterprises/[enterpriseId]/invites - 获取企业邀请列表
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ enterpriseId: string }> }
) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return createApiResponse(false, null, '未授权', 401);
    }

    const resolvedParams = await params;
    const { enterpriseId } = resolvedParams;

    // 检查用户是否有查看权限
    const hasPermission = await permissionManager.checkPermission(
      user.id,
      'user.read',
      undefined,
      enterpriseId
    );

    if (!hasPermission.hasPermission) {
      return createApiResponse(false, null, '您没有查看邀请的权限', 403);
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || undefined;
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '20');

    // 构建查询条件
    const whereClause: any = {
      group: {
        enterpriseId,
        organizationType: 'enterprise_group',
        status: 'pending' // 只查询邀请用的临时组
      }
    };

    if (status) {
      whereClause.status = status;
    }

    // 获取邀请总数
    const totalCount = await prisma.invitation.count({
      where: whereClause
    });

    // 获取邀请列表
    const invitations = await prisma.invitation.findMany({
      where: whereClause,
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
            settings: true,
            departmentId: true,
            department: {
              select: {
                id: true,
                name: true
              }
            }
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      skip: (page - 1) * pageSize,
      take: pageSize
    });

    // 格式化邀请数据
    const formattedInvitations = invitations.map(invitation => ({
      id: invitation.id,
      email: invitation.email,
      status: invitation.status,
      expiresAt: invitation.expiresAt,
      createdAt: invitation.createdAt,
      inviter: invitation.inviter,
      role: (invitation.group.settings as any)?.inviteRole || 'member',
      department: invitation.group.department,
      message: (invitation.group.settings as any)?.inviteMessage
    }));

    return createApiResponse(true, {
      invitations: formattedInvitations,
      totalCount,
      page,
      pageSize,
      totalPages: Math.ceil(totalCount / pageSize)
    }, '获取邀请列表成功', 200);

  } catch (error) {
    console.error('Get invitations error:', error);
    return createApiResponse(false, null, '获取邀请列表失败', 500);
  }
}
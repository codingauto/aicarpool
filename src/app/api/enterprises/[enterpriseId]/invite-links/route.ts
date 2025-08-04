import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { createApiResponse } from '@/lib/middleware';
import { getUserFromRequest } from '@/lib/auth';
import { permissionManager } from '@/lib/enterprise/permission-manager';
import crypto from 'crypto';

const createInviteLinkSchema = z.object({
  name: z.string().min(1, '邀请链接名称不能为空'),
  role: z.string().min(1, '角色不能为空'),
  departmentId: z.string().optional(),
  maxUses: z.number().int().min(1).max(100).default(10),
  expiresInDays: z.number().int().min(1).max(30).default(7)
});

// POST /api/enterprises/[enterpriseId]/invite-links - 创建企业邀请链接
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

    // 检查用户是否有创建邀请链接的权限（开发环境跳过）
    if (process.env.NODE_ENV !== 'development') {
      const hasPermission = await permissionManager.checkPermission(
        user.id,
        'user.create',
        undefined,
        enterpriseId
      );

      if (!hasPermission.hasPermission) {
        return createApiResponse(false, null, '您没有创建邀请链接的权限', 403);
      }
    }

    const body = await request.json();
    const validatedData = createInviteLinkSchema.parse(body);

    // 检查企业是否存在
    const enterprise = await prisma.enterprise.findUnique({
      where: { id: enterpriseId }
    });

    if (!enterprise) {
      return createApiResponse(false, null, '企业不存在', 404);
    }

    // 如果指定了部门，检查部门是否存在
    if (validatedData.departmentId) {
      const department = await prisma.department.findFirst({
        where: {
          id: validatedData.departmentId,
          enterpriseId
        }
      });

      if (!department) {
        return createApiResponse(false, null, '指定的部门不存在', 400);
      }
    }

    // 生成邀请令牌
    const inviteToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + validatedData.expiresInDays);

    // 创建临时拼车组用于邀请链接
    const tempGroup = await prisma.group.create({
      data: {
        name: `邀请链接组-${validatedData.name}`,
        description: `企业邀请链接：${validatedData.name}`,
        createdById: user.id,
        enterpriseId,
        departmentId: validatedData.departmentId,
        organizationType: 'enterprise_group',
        status: 'pending',
        settings: {
          inviteRole: validatedData.role,
          inviteDepartmentId: validatedData.departmentId,
          invitationType: 'enterprise_link',
          inviteLinkName: validatedData.name
        }
      }
    });

    // 创建邀请链接记录
    const inviteLink = await prisma.inviteLink.create({
      data: {
        token: inviteToken,
        name: validatedData.name,
        groupId: tempGroup.id,
        creatorId: user.id,
        maxUses: validatedData.maxUses,
        usedCount: 0,
        status: 'active',
        expiresAt
      }
    });

    const inviteUrl = `${request.nextUrl.origin}/invite-link/${inviteToken}`;

    return createApiResponse(true, {
      id: inviteLink.id,
      name: inviteLink.name,
      token: inviteToken,
      url: inviteUrl,
      maxUses: inviteLink.maxUses,
      usedCount: inviteLink.usedCount,
      expiresAt: inviteLink.expiresAt,
      role: validatedData.role,
      departmentId: validatedData.departmentId
    }, '邀请链接创建成功', 200);

  } catch (error) {
    if (error instanceof z.ZodError) {
      return createApiResponse(false, null, error.issues[0].message, 400);
    }
    
    console.error('Create invite link error:', error);
    return createApiResponse(false, null, '创建邀请链接失败', 500);
  }
}

// GET /api/enterprises/[enterpriseId]/invite-links - 获取企业邀请链接列表
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

    // 检查用户是否有查看权限（开发环境跳过）
    if (process.env.NODE_ENV !== 'development') {
      const hasPermission = await permissionManager.checkPermission(
        user.id,
        'user.read',
        undefined,
        enterpriseId
      );

      if (!hasPermission.hasPermission) {
        return createApiResponse(false, null, '您没有查看邀请链接的权限', 403);
      }
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
        status: 'pending'
      }
    };

    if (status) {
      whereClause.status = status;
    }

    // 获取邀请链接总数
    const totalCount = await prisma.inviteLink.count({
      where: whereClause
    });

    // 获取邀请链接列表
    const inviteLinks = await prisma.inviteLink.findMany({
      where: whereClause,
      include: {
        creator: {
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

    // 格式化邀请链接数据
    const formattedLinks = inviteLinks.map(link => ({
      id: link.id,
      name: link.name,
      token: link.token,
      url: `${request.nextUrl.origin}/invite-link/${link.token}`,
      maxUses: link.maxUses,
      usedCount: link.usedCount,
      status: link.status,
      expiresAt: link.expiresAt,
      createdAt: link.createdAt,
      creator: link.creator,
      role: (link.group.settings as any)?.inviteRole || 'member',
      department: link.group.department
    }));

    return createApiResponse(true, {
      inviteLinks: formattedLinks,
      totalCount,
      page,
      pageSize,
      totalPages: Math.ceil(totalCount / pageSize)
    }, '获取邀请链接列表成功', 200);

  } catch (error) {
    console.error('Get invite links error:', error);
    return createApiResponse(false, null, '获取邀请链接列表失败', 500);
  }
}
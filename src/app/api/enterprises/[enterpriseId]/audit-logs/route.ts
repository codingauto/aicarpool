import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth/auth-utils';
import { createApiResponse, createErrorResponse } from '@/lib/middleware';

// GET /api/enterprises/[enterpriseId]/audit-logs
export async function GET(
  request: NextRequest,
  { params }: { params: { enterpriseId: string } }
) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return createErrorResponse('未授权访问', 401);
    }

    const { enterpriseId } = params;
    const { searchParams } = new URL(request.url);
    
    // 获取查询参数
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '20');
    const action = searchParams.get('action');
    const userId = searchParams.get('userId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    // 检查用户权限（只有管理员可以查看审计日志）
    const userRole = await prisma.userEnterpriseRole.findFirst({
      where: {
        userId: user.id,
        enterpriseId,
        isActive: true,
        role: {
          in: ['enterprise_owner', 'enterprise_admin', 'system_admin']
        }
      }
    });

    if (!userRole) {
      return createErrorResponse('无权限查看审计日志', 403);
    }

    // 构建查询条件
    const where: any = {
      enterpriseId
    };

    if (action) {
      where.action = action;
    }

    if (userId) {
      where.userId = userId;
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        where.createdAt.gte = new Date(startDate);
      }
      if (endDate) {
        where.createdAt.lte = new Date(endDate);
      }
    }

    // 获取审计日志总数
    const total = await prisma.auditLog.count({ where });

    // 获取审计日志列表
    const logs = await prisma.auditLog.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      skip: (page - 1) * pageSize,
      take: pageSize
    });

    // 格式化审计日志
    const formattedLogs = logs.map(log => ({
      id: log.id,
      action: log.action,
      entityType: log.entityType,
      entityId: log.entityId,
      details: log.details,
      ipAddress: log.ipAddress,
      userAgent: log.userAgent,
      user: log.user,
      createdAt: log.createdAt
    }));

    return createApiResponse(true, {
      logs: formattedLogs,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize)
      }
    }, '获取审计日志成功');

  } catch (error) {
    console.error('获取审计日志失败:', error);
    return createErrorResponse('获取审计日志失败', 500);
  }
}

// 记录审计日志的辅助函数
export async function logAuditEvent(
  userId: string,
  enterpriseId: string,
  action: string,
  entityType: string,
  entityId: string,
  details: any,
  request?: NextRequest
) {
  try {
    const ipAddress = request?.headers.get('x-forwarded-for') || 
                      request?.headers.get('x-real-ip') || 
                      'unknown';
    const userAgent = request?.headers.get('user-agent') || 'unknown';

    await prisma.auditLog.create({
      data: {
        userId,
        enterpriseId,
        action,
        entityType,
        entityId,
        details,
        ipAddress,
        userAgent
      }
    });
  } catch (error) {
    console.error('记录审计日志失败:', error);
  }
}
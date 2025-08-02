import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createApiResponse } from '@/lib/middleware';
import { getUserFromRequest } from '@/lib/auth';

// GET /api/user/enterprises - 获取用户的企业列表
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return createApiResponse(false, null, '未授权访问', 401);
    }

    // 获取用户的企业关联关系
    const userEnterprises = await prisma.userEnterprise.findMany({
      where: {
        userId: user.id,
        isActive: true
      },
      include: {
        enterprise: {
          include: {
            _count: {
              select: {
                userEnterprises: true,
                groups: true
              }
            }
          }
        }
      },
      orderBy: {
        lastAccessed: 'desc'
      }
    });

    const formattedData = userEnterprises.map(userEnt => ({
      role: userEnt.role,
      joinedAt: userEnt.joinedAt,
      lastAccessed: userEnt.lastAccessed,
      isActive: userEnt.isActive,
      enterprise: {
        id: userEnt.enterprise.id,
        name: userEnt.enterprise.name,
        planType: userEnt.enterprise.planType,
        organizationType: userEnt.enterprise.organizationType || 'enterprise',
        creationTemplate: userEnt.enterprise.creationTemplate,
        uiTheme: userEnt.enterprise.uiTheme || 'professional',
        featureSet: userEnt.enterprise.featureSet,
        createdAt: userEnt.enterprise.createdAt,
        _count: {
          members: userEnt.enterprise._count.userEnterprises,
          groups: userEnt.enterprise._count.groups
        }
      }
    }));

    return createApiResponse(true, formattedData, '获取用户企业列表成功', 200);

  } catch (error) {
    console.error('获取用户企业列表失败:', error);
    return createApiResponse(false, null, '服务器内部错误', 500);
  }
}
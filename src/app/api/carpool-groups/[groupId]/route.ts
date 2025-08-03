import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createApiResponse, createErrorResponse } from '@/lib/middleware';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// 验证JWT token
async function verifyToken(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.substring(7);
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    return decoded;
  } catch (error) {
    return null;
  }
}

// GET /api/carpool-groups/[groupId] - 获取拼车组详情
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ groupId: string }> }
) {
  try {
    const user = await verifyToken(request);
    if (!user) {
      return NextResponse.json(
        createErrorResponse('未授权访问', 401),
        { status: 401 }
      );
    }

    const { groupId } = await params;

    // 验证用户是否有访问此拼车组的权限
    const userEnterprise = await prisma.userEnterprise.findFirst({
      where: {
        userId: user.id,
        enterpriseId: groupId,
        isActive: true,
        enterprise: {
          organizationType: 'carpool_group'
        }
      },
      include: {
        enterprise: {
          include: {
            enterpriseSettings: true,
            _count: {
              select: {
                userEnterprises: true
              }
            }
          }
        }
      }
    });

    if (!userEnterprise) {
      return NextResponse.json(
        createErrorResponse('没有权限访问该拼车组', 403),
        { status: 403 }
      );
    }

    const enterprise = userEnterprise.enterprise;
    const enterpriseSettings = enterprise.enterpriseSettings;

    // 构造返回数据
    const carpoolGroup = {
      id: enterprise.id,
      name: enterprise.name,
      organizationType: enterprise.organizationType,
      creationTemplate: enterprise.creationTemplate,
      uiTheme: enterprise.uiTheme,
      featureSet: enterprise.featureSet,
      settings: enterprise.settings,
      createdAt: enterprise.createdAt,
      updatedAt: enterprise.updatedAt,
      memberCount: enterprise._count.userEnterprises,
      userRole: userEnterprise.role,
      permissions: userEnterprise.permissions,
      lastAccessed: userEnterprise.lastAccessed,
      enterpriseSettings: enterpriseSettings ? {
        theme: enterpriseSettings.theme,
        features: enterpriseSettings.features,
        security: enterpriseSettings.security,
        notifications: enterpriseSettings.notifications,
        budgetSettings: enterpriseSettings.budgetSettings
      } : null
    };

    return NextResponse.json(
      createApiResponse(true, carpoolGroup, '获取拼车组详情成功', 200)
    );

  } catch (error) {
    console.error('获取拼车组详情失败:', error);
    return NextResponse.json(
      createApiResponse(false, null, '服务器内部错误', 500),
      { status: 500 }
    );
  }
}

// PUT /api/carpool-groups/[groupId] - 更新拼车组信息
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ groupId: string }> }
) {
  try {
    const user = await verifyToken(request);
    if (!user) {
      return NextResponse.json(
        createErrorResponse('未授权访问', 401),
        { status: 401 }
      );
    }

    const { groupId } = await params;
    const body = await request.json();

    // 验证用户是否是拼车组长
    const userEnterprise = await prisma.userEnterprise.findFirst({
      where: {
        userId: user.id,
        enterpriseId: groupId,
        role: 'owner',
        isActive: true,
        enterprise: {
          organizationType: 'carpool_group'
        }
      }
    });

    if (!userEnterprise) {
      return NextResponse.json(
        createErrorResponse('只有拼车组长可以修改拼车组信息', 403),
        { status: 403 }
      );
    }

    // 更新拼车组信息
    const updatedEnterprise = await prisma.enterprise.update({
      where: { id: groupId },
      data: {
        name: body.name,
        settings: body.settings,
        featureSet: body.featureSet,
        updatedAt: new Date()
      }
    });

    // 如果有企业设置更新
    if (body.enterpriseSettings) {
      await prisma.enterpriseSettings.upsert({
        where: { enterpriseId: groupId },
        update: {
          theme: body.enterpriseSettings.theme,
          features: body.enterpriseSettings.features,
          security: body.enterpriseSettings.security,
          notifications: body.enterpriseSettings.notifications,
          budgetSettings: body.enterpriseSettings.budgetSettings
        },
        create: {
          enterpriseId: groupId,
          theme: body.enterpriseSettings.theme || {},
          features: body.enterpriseSettings.features || {},
          security: body.enterpriseSettings.security || {},
          notifications: body.enterpriseSettings.notifications || {},
          budgetSettings: body.enterpriseSettings.budgetSettings || {}
        }
      });
    }

    return NextResponse.json(
      createApiResponse(true, {
        id: updatedEnterprise.id,
        name: updatedEnterprise.name,
        featureSet: updatedEnterprise.featureSet,
        settings: updatedEnterprise.settings
      }, '拼车组信息更新成功', 200)
    );

  } catch (error) {
    console.error('更新拼车组信息失败:', error);
    return NextResponse.json(
      createApiResponse(false, null, '服务器内部错误', 500),
      { status: 500 }
    );
  }
}

// DELETE /api/carpool-groups/[groupId] - 删除拼车组
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ groupId: string }> }
) {
  try {
    const user = await verifyToken(request);
    if (!user) {
      return NextResponse.json(
        createErrorResponse('未授权访问', 401),
        { status: 401 }
      );
    }

    const { groupId } = await params;

    // 验证用户是否是拼车组长
    const userEnterprise = await prisma.userEnterprise.findFirst({
      where: {
        userId: user.id,
        enterpriseId: groupId,
        role: 'owner',
        isActive: true,
        enterprise: {
          organizationType: 'carpool_group'
        }
      }
    });

    if (!userEnterprise) {
      return NextResponse.json(
        createErrorResponse('只有拼车组长可以删除拼车组', 403),
        { status: 403 }
      );
    }

    // 删除拼车组（企业记录）
    await prisma.enterprise.delete({
      where: { id: groupId }
    });

    return NextResponse.json(
      createApiResponse(true, null, '拼车组删除成功', 200)
    );

  } catch (error) {
    console.error('删除拼车组失败:', error);
    return NextResponse.json(
      createApiResponse(false, null, '服务器内部错误', 500),
      { status: 500 }
    );
  }
}
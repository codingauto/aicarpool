import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createApiResponse } from '@/lib/middleware';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

interface RouteContext {
  params: Promise<{ enterpriseId: string }>;
}

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

// GET /api/enterprises/[enterpriseId]/groups - 获取企业下的拼车组列表
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const user = await verifyToken(request);
    if (!user) {
      return NextResponse.json(
        createApiResponse(false, null, '未授权访问', 401),
        { status: 401 }
      );
    }

    const { enterpriseId } = await context.params;

    // 验证企业是否存在且用户有权限访问
    const enterprise = await prisma.enterprise.findFirst({
      where: {
        id: enterpriseId,
        // 这里可以添加更多权限验证逻辑
      }
    });

    if (!enterprise) {
      return NextResponse.json(
        createApiResponse(false, null, '企业不存在或无权限访问', 404),
        { status: 404 }
      );
    }

    // 获取企业下的拼车组
    const groups = await prisma.group.findMany({
      where: {
        enterpriseId: enterpriseId
      },
      include: {
        _count: {
          select: {
            members: true
          }
        },
        resourceBinding: {
          select: {
            bindingMode: true,
            dailyTokenLimit: true,
            monthlyBudget: true,
            priorityLevel: true,
            warningThreshold: true,
            alertThreshold: true
          }
        },
        usageStats: {
          select: {
            totalTokens: true,
            cost: true
          },
          take: 10,
          orderBy: {
            requestTime: 'desc'
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    // 处理数据格式，添加统计信息
    const formattedGroups = groups.map(group => ({
      id: group.id,
      name: group.name,
      description: group.description,
      maxMembers: group.maxMembers,
      status: group.status,
      enterpriseId: group.enterpriseId,
      memberCount: group._count.members,
      resourceBinding: group.resourceBinding,
      usageStats: group.usageStats.length > 0 ? {
        totalRequests: group.usageStats.length,
        totalTokens: group.usageStats.reduce((sum, stat) => sum + stat.totalTokens, 0),
        totalCost: group.usageStats.reduce((sum, stat) => sum + Number(stat.cost), 0)
      } : null,
      createdAt: group.createdAt
    }));

    return NextResponse.json(
      createApiResponse(true, formattedGroups, '获取拼车组列表成功', 200)
    );

  } catch (error) {
    console.error('获取企业拼车组列表失败:', error);
    return NextResponse.json(
      createApiResponse(false, null, '服务器内部错误', 500),
      { status: 500 }
    );
  }
}

// POST /api/enterprises/[enterpriseId]/groups - 为企业创建新的拼车组
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const user = await verifyToken(request);
    if (!user) {
      return NextResponse.json(
        createApiResponse(false, null, '未授权访问', 401),
        { status: 401 }
      );
    }

    const { enterpriseId } = await context.params;
    const body = await request.json();

    // 验证必需字段
    const { name, description, maxMembers } = body;
    if (!name?.trim()) {
      return NextResponse.json(
        createApiResponse(false, null, '拼车组名称不能为空', 400),
        { status: 400 }
      );
    }

    // 验证企业是否存在且用户有权限
    const enterprise = await prisma.enterprise.findFirst({
      where: {
        id: enterpriseId,
        // 这里可以添加更多权限验证逻辑
      }
    });

    if (!enterprise) {
      return NextResponse.json(
        createApiResponse(false, null, '企业不存在或无权限访问', 404),
        { status: 404 }
      );
    }

    // 检查拼车组名称是否在企业内唯一
    const existingGroup = await prisma.group.findFirst({
      where: {
        name: name.trim(),
        enterpriseId: enterpriseId
      }
    });

    if (existingGroup) {
      return NextResponse.json(
        createApiResponse(false, null, '拼车组名称已存在', 400),
        { status: 400 }
      );
    }

    // 创建拼车组
    const newGroup = await prisma.group.create({
      data: {
        name: name.trim(),
        description: description?.trim() || null,
        maxMembers: Math.max(1, Math.min(50, parseInt(maxMembers) || 5)),
        status: 'active',
        enterpriseId: enterpriseId
      },
      include: {
        _count: {
          select: {
            members: true
          }
        }
      }
    });

    const formattedGroup = {
      id: newGroup.id,
      name: newGroup.name,
      description: newGroup.description,
      maxMembers: newGroup.maxMembers,
      status: newGroup.status,
      enterpriseId: newGroup.enterpriseId,
      memberCount: newGroup._count.members,
      createdAt: newGroup.createdAt
    };

    return NextResponse.json(
      createApiResponse(true, formattedGroup, '拼车组创建成功', 201),
      { status: 201 }
    );

  } catch (error) {
    console.error('创建企业拼车组失败:', error);
    return NextResponse.json(
      createApiResponse(false, null, '服务器内部错误', 500),
      { status: 500 }
    );
  }
}
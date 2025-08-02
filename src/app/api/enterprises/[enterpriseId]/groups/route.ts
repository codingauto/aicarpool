import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { createApiResponse } from '@/lib/middleware';
import { verifyToken } from '@/lib/auth';

const prisma = new PrismaClient();

interface RouteContext {
  params: Promise<{ enterpriseId: string }>;
}

// GET /api/enterprises/[enterpriseId]/groups - 获取企业下的拼车组列表
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) {
      return createApiResponse(false, null, '缺少认证令牌', 401);
    }

    const user = await verifyToken(token);
    if (!user) {
      return createApiResponse(false, null, '认证令牌无效', 401);
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
      return createApiResponse(false, null, '企业不存在或无权限访问', 404);
    }

    // 获取企业下的拼车组 - 逐步调试
    console.log(`🔍 正在查询企业 ${enterpriseId} 的拼车组`);
    
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
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
    
    console.log(`✅ 找到 ${groups.length} 个拼车组`);

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
      usageStats: null, // 暂时设为null调试
      createdAt: group.createdAt
    }));

    return createApiResponse(true, formattedGroups, '获取拼车组列表成功', 200);

  } catch (error) {
    console.error('获取企业拼车组列表失败:', error);
    return createApiResponse(false, null, '服务器内部错误', 500);
  }
}

// POST /api/enterprises/[enterpriseId]/groups - 为企业创建新的拼车组
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) {
      return createApiResponse(false, null, '缺少认证令牌', 401);
    }

    const user = await verifyToken(token);
    if (!user) {
      return createApiResponse(false, null, '认证令牌无效', 401);
    }

    const { enterpriseId } = await context.params;
    const body = await request.json();

    // 验证必需字段
    const { name, description, maxMembers } = body;
    if (!name?.trim()) {
      return createApiResponse(false, null, '拼车组名称不能为空', 400);
    }

    // 验证企业是否存在且用户有权限
    const enterprise = await prisma.enterprise.findFirst({
      where: {
        id: enterpriseId,
        // 这里可以添加更多权限验证逻辑
      }
    });

    if (!enterprise) {
      return createApiResponse(false, null, '企业不存在或无权限访问', 404);
    }

    // 检查拼车组名称是否在企业内唯一
    const existingGroup = await prisma.group.findFirst({
      where: {
        name: name.trim(),
        enterpriseId: enterpriseId
      }
    });

    if (existingGroup) {
      return createApiResponse(false, null, '拼车组名称已存在', 400);
    }

    // 创建拼车组
    const newGroup = await prisma.group.create({
      data: {
        name: name.trim(),
        description: description?.trim() || null,
        maxMembers: Math.max(1, Math.min(50, parseInt(maxMembers) || 5)),
        status: 'active',
        enterpriseId: enterpriseId,
        createdById: user.id
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

    return createApiResponse(true, formattedGroup, '拼车组创建成功', 201);

  } catch (error) {
    console.error('创建企业拼车组失败:', error);
    return createApiResponse(false, null, '服务器内部错误', 500);
  }
}
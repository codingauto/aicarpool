import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { verifyToken } from '@/lib/auth/jwt-utils';

const prisma = new PrismaClient();

/**
 * 获取拼车组资源配置
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ groupId: string }> }
) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ success: false, error: '未提供认证令牌' }, { status: 401 });
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ success: false, error: '无效的认证令牌' }, { status: 401 });
    }

    const { groupId } = await params;

    // 验证用户是否有权限访问该拼车组
    const membership = await prisma.groupMember.findFirst({
      where: {
        groupId,
        userId: decoded.userId
      }
    });

    if (!membership) {
      return NextResponse.json({ success: false, error: '无权限访问该拼车组' }, { status: 403 });
    }

    // 获取拼车组基本信息
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      select: {
        id: true,
        name: true,
        description: true,
        _count: {
          select: { members: true }
        }
      }
    });

    if (!group) {
      return NextResponse.json({ success: false, error: '拼车组不存在' }, { status: 404 });
    }

    // 获取资源绑定配置
    const resourceBinding = await prisma.groupResourceBinding.findUnique({
      where: { groupId }
    });

    // 获取使用统计（模拟数据）
    const usageStats = {
      dailyTokens: 12340,
      dailyCost: 23.45,
      requestCount: 156,
      avgResponseTime: 1234
    };

    const config = {
      groupId,
      groupName: group.name,
      bindingMode: resourceBinding?.bindingMode || 'shared',
      bindingConfig: resourceBinding?.bindingConfig || {},
      usageQuota: {
        dailyTokenLimit: resourceBinding?.dailyTokenLimit || 50000,
        monthlyCostLimit: resourceBinding?.monthlyBudget ? Number(resourceBinding.monthlyBudget) : 500,
        priorityLevel: resourceBinding?.priorityLevel === 'high' ? 3 : 
                      resourceBinding?.priorityLevel === 'medium' ? 2 : 1
      },
      isActive: true // 默认为激活状态
    };

    return NextResponse.json({
      success: true,
      data: {
        config,
        usageStats
      }
    });

  } catch (error) {
    console.error('获取拼车组资源配置失败:', {
      error,
      groupId: params.groupId,
      message: error instanceof Error ? error.message : '未知错误',
      stack: error instanceof Error ? error.stack : undefined
    });
    return NextResponse.json(
      { success: false, error: '获取资源配置失败', details: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    );
  }
}

/**
 * 更新拼车组资源配置
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ groupId: string }> }
) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ success: false, error: '未提供认证令牌' }, { status: 401 });
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ success: false, error: '无效的认证令牌' }, { status: 401 });
    }

    const { groupId } = await params;
    const body = await request.json();

    // 验证用户是否是该拼车组的管理员
    const membership = await prisma.groupMember.findFirst({
      where: {
        groupId,
        userId: decoded.userId,
        role: 'admin'
      }
    });

    if (!membership) {
      return NextResponse.json({ success: false, error: '无权限修改该拼车组配置' }, { status: 403 });
    }

    // 验证输入数据
    const {
      bindingMode,
      bindingConfig,
      usageQuota,
      isActive
    } = body;

    if (!bindingMode || !['dedicated', 'shared', 'hybrid'].includes(bindingMode)) {
      return NextResponse.json({ success: false, error: '无效的绑定模式' }, { status: 400 });
    }

    // 将优先级数字转换为字符串
    const priorityLevelStr = usageQuota?.priorityLevel === 3 ? 'high' : 
                            usageQuota?.priorityLevel === 2 ? 'medium' : 'low';

    // 更新或创建资源绑定配置
    const resourceBinding = await prisma.groupResourceBinding.upsert({
      where: { groupId },
      update: {
        bindingMode,
        bindingConfig: bindingConfig || {},
        dailyTokenLimit: usageQuota?.dailyTokenLimit || 50000,
        monthlyBudget: usageQuota?.monthlyCostLimit || 500,
        priorityLevel: priorityLevelStr
      },
      create: {
        groupId,
        bindingMode,
        bindingConfig: bindingConfig || {},
        dailyTokenLimit: usageQuota?.dailyTokenLimit || 50000,
        monthlyBudget: usageQuota?.monthlyCostLimit || 500,
        priorityLevel: priorityLevelStr
      }
    });

    return NextResponse.json({
      success: true,
      data: resourceBinding
    });

  } catch (error) {
    console.error('更新拼车组资源配置失败:', error);
    return NextResponse.json(
      { success: false, error: '更新资源配置失败' },
      { status: 500 }
    );
  }
}

/**
 * 删除拼车组资源配置
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ groupId: string }> }
) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ success: false, error: '未提供认证令牌' }, { status: 401 });
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ success: false, error: '无效的认证令牌' }, { status: 401 });
    }

    const { groupId } = await params;

    // 验证用户是否是该拼车组的管理员
    const membership = await prisma.groupMember.findFirst({
      where: {
        groupId,
        userId: decoded.userId,
        role: 'admin'
      }
    });

    if (!membership) {
      return NextResponse.json({ success: false, error: '无权限修改该拼车组配置' }, { status: 403 });
    }

    // 删除资源绑定配置（重置为默认）
    await prisma.groupResourceBinding.delete({
      where: { groupId }
    });

    return NextResponse.json({
      success: true,
      message: '资源配置已重置为默认'
    });

  } catch (error) {
    console.error('删除拼车组资源配置失败:', error);
    return NextResponse.json(
      { success: false, error: '删除资源配置失败' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
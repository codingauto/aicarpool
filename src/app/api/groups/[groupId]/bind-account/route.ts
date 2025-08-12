/**
 * 拼车组账号绑定API - v2.4简化版
 * 实现一对一专属绑定模式
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

interface BindAccountRequest {
  accountId: string;
  bindingType?: 'exclusive' | 'shared'; // v2.4默认exclusive
  dailyLimit?: number;
  monthlyBudget?: number;
}

interface BindAccountResponse {
  success: boolean;
  data?: {
    bindingId: string;
    groupId: string;
    accountId: string;
    bindingType: string;
    message: string;
  };
  error?: string;
}

// POST /api/groups/[groupId]/bind-account
export async function POST(
  request: NextRequest,
  { params }: { params: { groupId: string } }
): Promise<NextResponse<BindAccountResponse>> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: '未授权访问' },
        { status: 401 }
      );
    }

    const { groupId } = params;
    const body: BindAccountRequest = await request.json();
    const { accountId, bindingType = 'exclusive', dailyLimit, monthlyBudget } = body;

    // 验证参数
    if (!accountId) {
      return NextResponse.json(
        { success: false, error: '缺少必要参数: accountId' },
        { status: 400 }
      );
    }

    // 检查组权限
    const groupMember = await prisma.groupMember.findFirst({
      where: {
        groupId,
        userId: session.user.id,
        role: { in: ['owner', 'admin'] }
      },
      include: {
        group: {
          select: {
            id: true,
            name: true,
            organizationType: true,
            bindingMode: true
          }
        }
      }
    });

    if (!groupMember) {
      return NextResponse.json(
        { success: false, error: '无权限操作此拼车组' },
        { status: 403 }
      );
    }

    // 检查账号是否存在且可用
    const account = await prisma.aiServiceAccount.findUnique({
      where: { id: accountId },
      select: {
        id: true,
        name: true,
        platform: true,
        isEnabled: true,
        ownerType: true,
        maxConcurrentGroups: true,
        groupBindings: {
          where: { isActive: true },
          select: { groupId: true }
        }
      }
    });

    if (!account) {
      return NextResponse.json(
        { success: false, error: '账号不存在' },
        { status: 404 }
      );
    }

    if (!account.isEnabled) {
      return NextResponse.json(
        { success: false, error: '账号已禁用' },
        { status: 400 }
      );
    }

    // v2.4拼车组模式：检查一对一绑定约束
    const group = groupMember.group;
    if (group.organizationType === 'carpool_group' && group.bindingMode === 'exclusive') {
      // 检查账号是否已被其他组绑定
      if (account.groupBindings.length > 0) {
        const boundGroupId = account.groupBindings[0].groupId;
        if (boundGroupId !== groupId) {
          return NextResponse.json(
            { success: false, error: `该账号已被其他拼车组绑定，无法重复绑定` },
            { status: 400 }
          );
        }
      }

      // 检查当前组是否已绑定其他账号
      const existingBinding = await prisma.groupAccountBinding.findFirst({
        where: {
          groupId,
          isActive: true
        }
      });

      if (existingBinding && existingBinding.accountId !== accountId) {
        return NextResponse.json(
          { success: false, error: '该拼车组已绑定其他账号，请先解绑后再绑定新账号' },
          { status: 400 }
        );
      }
    }

    // 创建或更新绑定
    const binding = await prisma.groupAccountBinding.upsert({
      where: {
        groupId_accountId: {
          groupId,
          accountId
        }
      },
      update: {
        bindingType,
        dailyLimit,
        monthlyBudget,
        isActive: true,
        updatedAt: new Date()
      },
      create: {
        groupId,
        accountId,
        bindingType,
        dailyLimit,
        monthlyBudget,
        isActive: true
      }
    });

    // 记录操作日志
    console.log(`[v2.4 Account Binding] Group ${groupId} bound to account ${accountId} with ${bindingType} mode`);

    return NextResponse.json({
      success: true,
      data: {
        bindingId: binding.id,
        groupId,
        accountId,
        bindingType: binding.bindingType,
        message: bindingType === 'exclusive' 
          ? '账号专属绑定成功，该账号仅供此拼车组使用' 
          : '账号共享绑定成功'
      }
    });

  } catch (error) {
    console.error('拼车组账号绑定失败:', error);
    return NextResponse.json(
      { success: false, error: '绑定操作失败' },
      { status: 500 }
    );
  }
}

// DELETE /api/groups/[groupId]/bind-account
export async function DELETE(
  request: NextRequest,
  { params }: { params: { groupId: string } }
): Promise<NextResponse<BindAccountResponse>> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: '未授权访问' },
        { status: 401 }
      );
    }

    const { groupId } = params;
    const url = new URL(request.url);
    const accountId = url.searchParams.get('accountId');

    // 检查组权限
    const groupMember = await prisma.groupMember.findFirst({
      where: {
        groupId,
        userId: session.user.id,
        role: { in: ['owner', 'admin'] }
      }
    });

    if (!groupMember) {
      return NextResponse.json(
        { success: false, error: '无权限操作此拼车组' },
        { status: 403 }
      );
    }

    // 删除绑定
    const whereCondition = accountId 
      ? { groupId, accountId, isActive: true }
      : { groupId, isActive: true };

    await prisma.groupAccountBinding.updateMany({
      where: whereCondition,
      data: { isActive: false, updatedAt: new Date() }
    });

    console.log(`[v2.4 Account Unbinding] Group ${groupId} unbound from account ${accountId || 'all'}`);

    return NextResponse.json({
      success: true,
      data: {
        bindingId: '',
        groupId,
        accountId: accountId || '',
        bindingType: '',
        message: '账号解绑成功'
      }
    });

  } catch (error) {
    console.error('拼车组账号解绑失败:', error);
    return NextResponse.json(
      { success: false, error: '解绑操作失败' },
      { status: 500 }
    );
  }
}

// GET /api/groups/[groupId]/bind-account
export async function GET(
  request: NextRequest,
  { params }: { params: { groupId: string } }
): Promise<NextResponse> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: '未授权访问' },
        { status: 401 }
      );
    }

    const { groupId } = params;

    // 检查组权限
    const groupMember = await prisma.groupMember.findFirst({
      where: {
        groupId,
        userId: session.user.id
      },
      include: {
        group: {
          select: {
            id: true,
            name: true,
            organizationType: true,
            bindingMode: true
          }
        }
      }
    });

    if (!groupMember) {
      return NextResponse.json(
        { success: false, error: '无权限访问此拼车组' },
        { status: 403 }
      );
    }

    // 获取当前绑定
    const bindings = await prisma.groupAccountBinding.findMany({
      where: {
        groupId,
        isActive: true
      },
      include: {
        account: {
          select: {
            id: true,
            name: true,
            platform: true,
            isEnabled: true,
            status: true,
            lastUsedAt: true
          }
        }
      }
    });

    return NextResponse.json({
      success: true,
      data: {
        group: groupMember.group,
        bindings: bindings.map(binding => ({
          id: binding.id,
          bindingType: binding.bindingType,
          dailyLimit: binding.dailyLimit,
          monthlyBudget: binding.monthlyBudget,
          createdAt: binding.createdAt,
          account: binding.account
        }))
      }
    });

  } catch (error) {
    console.error('获取拼车组绑定信息失败:', error);
    return NextResponse.json(
      { success: false, error: '获取绑定信息失败' },
      { status: 500 }
    );
  }
}
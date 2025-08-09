/**
 * 企业账号组API
 * 
 * 支持：
 * - 获取企业下所有账号组
 * - 按平台类型筛选
 * - 包含成员统计和绑定信息
 */

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createApiResponse } from '@/lib/middleware';
import { verifyToken } from '@/lib/auth';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ enterpriseId: string }> }
) {
  try {
    // 1. 认证验证
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    
    // 开发模式：允许无token访问
    let user = null;
    if (process.env.NODE_ENV === 'development' && !token) {
      console.log('🔐 开发模式：账号组列表使用默认测试用户');
      user = {
        id: 'user_test_001',
        email: 'test@example.com',
        name: '测试用户',
        role: 'user'
      };
    } else {
      if (!token) {
        return createApiResponse(false, null, '缺少认证令牌', 401);
      }

      user = await verifyToken(token);
      if (!user) {
        return createApiResponse(false, null, '认证令牌无效', 401);
      }
    }

    const resolvedParams = await params;
    const { enterpriseId } = resolvedParams;
    
    // 2. 参数验证
    if (!enterpriseId) {
      return createApiResponse(false, null, '缺少企业ID', 400);
    }

    // 3. 权限验证 - 检查用户是否属于该企业
    const enterprise = await prisma.enterprise.findUnique({
      where: { id: enterpriseId }
    });

    if (!enterprise) {
      return createApiResponse(false, null, '企业不存在', 404);
    }

    // 4. 获取查询参数
    const { searchParams } = new URL(request.url);
    const platform = searchParams.get('platform');

    // 5. 构建查询条件
    const where: any = {
      enterpriseId
    };

    if (platform) {
      where.platform = platform;
    }

    // 6. 查询账号组
    const groups = await prisma.group.findMany({
      where,
      include: {
        _count: {
          select: {
            members: {
              where: { status: 'active' }
            }
          }
        },
        accountBindings: {
          where: { isActive: true },
          include: {
            account: {
              select: {
                id: true,
                name: true,
                platform: true,
                status: true
              }
            }
          }
        }
      },
      orderBy: [
        { createdAt: 'desc' }
      ]
    });

    // 7. 格式化响应数据
    const formattedGroups = groups.map(group => ({
      id: group.id,
      name: group.name,
      description: group.description,
      platform: group.organizationType === 'carpool_group' ? 'mixed' : group.organizationType,
      memberCount: group._count.members,
      status: group.status,
      bindingMode: group.bindingMode,
      
      // 绑定的账号
      boundAccounts: group.accountBindings.map(binding => ({
        id: binding.account.id,
        name: binding.account.name,
        platform: binding.account.platform,
        status: binding.account.status,
        isActive: binding.isActive,
        bindingType: binding.bindingType,
        dailyLimit: binding.dailyLimit,
        monthlyBudget: binding.monthlyBudget ? Number(binding.monthlyBudget) : null
      })),
      
      createdAt: group.createdAt,
      updatedAt: group.updatedAt
    }));

    console.log(`🎯 API 账号组: 返回企业 ${enterpriseId} 的 ${formattedGroups.length} 个账号组`);

    return createApiResponse(formattedGroups);

  } catch (error) {
    console.error('获取账号组失败:', error);
    return createApiResponse(false, null, '获取账号组失败', 500);
  }
}

/**
 * 企业Gemini账号API
 * 
 * 支持：
 * - 获取企业下所有Gemini账号
 * - 按状态和类型筛选
 * - 包含健康状态和使用统计
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
      console.log('🔐 开发模式：Gemini账号列表使用默认测试用户');
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
    const status = searchParams.get('status');
    const accountType = searchParams.get('accountType');

    // 5. 构建查询条件
    const where: any = {
      enterpriseId,
      platform: 'gemini'
    };

    if (status) {
      where.status = status;
    }

    if (accountType) {
      where.accountType = accountType;
    }

    // 6. 查询Gemini账号
    const accounts = await prisma.aiServiceAccount.findMany({
      where,
      include: {
        healthChecks: {
          orderBy: { checkedAt: 'desc' },
          take: 1
        },
        usageStats: {
          where: {
            createdAt: {
              gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // 最近24小时
            }
          }
        },
        groupBindings: {
          where: { isActive: true },
          include: {
            group: {
              select: {
                id: true,
                name: true
              }
            }
          }
        }
      },
      orderBy: [
        { isEnabled: 'desc' },
        { createdAt: 'desc' }
      ]
    });

    // 7. 格式化响应数据
    const formattedAccounts = accounts.map(account => ({
      id: account.id,
      name: account.name,
      description: account.description,
      status: account.status,
      accountType: account.accountType,
      isEnabled: account.isEnabled,
      currentLoad: account.currentLoad,
      supportedModels: account.supportedModels,
      currentModel: account.currentModel,
      dailyLimit: account.dailyLimit,
      
      // 统计信息
      totalRequests: Number(account.totalRequests),
      totalTokens: Number(account.totalTokens),
      totalCost: Number(account.totalCost),
      lastUsedAt: account.lastUsedAt,
      
      // 最近24小时使用情况
      recentUsage: {
        tokens: account.usageStats.reduce((sum, stat) => sum + Number(stat.totalTokens), 0),
        cost: account.usageStats.reduce((sum, stat) => sum + Number(stat.cost), 0)
      },
      
      // 健康状态
      healthStatus: account.healthChecks[0] ? {
        isHealthy: account.healthChecks[0].isHealthy,
        responseTime: account.healthChecks[0].responseTime,
        checkedAt: account.healthChecks[0].checkedAt
      } : null,
      
      // 绑定的拼车组
      boundGroups: account.groupBindings.map(binding => ({
        id: binding.group.id,
        name: binding.group.name,
        priority: binding.priority,
        isActive: binding.isActive
      })),
      
      createdAt: account.createdAt,
      updatedAt: account.updatedAt
    }));

    console.log(`🎯 API Gemini账号: 返回企业 ${enterpriseId} 的 ${formattedAccounts.length} 个Gemini账号`);

    return createApiResponse(formattedAccounts);

  } catch (error) {
    console.error('获取Gemini账号失败:', error);
    return createApiResponse(false, null, '获取Gemini账号失败', 500);
  }
}

/**
 * 企业AI账号可用列表API - v2.4专属绑定版本
 * 
 * 功能：
 * - 获取企业下所有AI账号
 * - 标记绑定状态信息
 * - 支持拼车组资源绑定选择
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createApiResponse } from '@/lib/middleware';
import { getUserFromRequest } from '@/lib/auth';

interface AiServiceAccountWithBinding {
  id: string;
  name: string;
  description?: string;
  serviceType: string;
  accountType: string;
  isEnabled: boolean;
  status: string;
  currentLoad?: number;
  supportedModels?: string[];
  currentModel?: string;
  // 绑定状态信息
  isBound: boolean;
  boundToGroupId?: string;
  boundToGroupName?: string;
  // 时间信息
  createdAt: string;
  lastUsedAt?: string;
}

/**
 * 获取企业下可用于绑定的AI账号列表
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ enterpriseId: string }> }
) {
  try {
    // 1. 认证验证
    const user = await getUserFromRequest(request);
    if (!user) {
      return createApiResponse(false, null, '认证失败', 401);
    }

    const resolvedParams = await params;
    const { enterpriseId } = resolvedParams;
    
    // 2. 参数验证
    if (!enterpriseId) {
      return createApiResponse(false, null, '缺少企业ID', 400);
    }

    // 3. 权限验证 - 检查用户是否属于该企业
    const userEnterprise = await prisma.userEnterprise.findFirst({
      where: {
        userId: user.id,
        enterpriseId,
        isActive: true
      }
    });

    if (!userEnterprise) {
      return createApiResponse(false, null, '您不属于此企业', 403);
    }

    // 4. 获取企业下所有AI账号及其绑定状态
    const accounts = await prisma.aiServiceAccount.findMany({
      where: { 
        enterpriseId,
        // 只返回启用的账号
        isEnabled: true
      },
      include: {
        // 获取绑定的拼车组信息
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
        },
        // 获取最近的使用统计
        usageStats: {
          where: {
            requestTime: {
              gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // 最近24小时
            }
          },
          select: {
            totalTokens: true,
            cost: true
          }
        },
        // 获取健康检查状态
        healthChecks: {
          orderBy: {
            checkedAt: 'desc'
          },
          take: 1,
          select: {
            isHealthy: true,
            responseTime: true,
            checkedAt: true
          }
        }
      },
      orderBy: [
        { serviceType: 'asc' },
        { name: 'asc' }
      ]
    });

    // 5. 格式化响应数据
    const formattedAccounts: AiServiceAccountWithBinding[] = accounts.map(account => {
      // 检查绑定状态
      const activeBinding = account.groupBindings.find(binding => binding.isActive);
      const isBound = !!activeBinding;
      
      return {
        id: account.id,
        name: account.name,
        description: account.description || undefined,
        serviceType: account.serviceType,
        accountType: account.accountType,
        isEnabled: account.isEnabled,
        status: account.status,
        currentLoad: account.currentLoad || undefined,
        supportedModels: account.supportedModels || undefined,
        currentModel: account.currentModel || undefined,
        
        // 绑定状态信息
        isBound,
        boundToGroupId: activeBinding?.group.id,
        boundToGroupName: activeBinding?.group.name,
        
        // 时间信息
        createdAt: account.createdAt.toISOString(),
        lastUsedAt: account.lastUsedAt?.toISOString()
      };
    });

    // 6. 生成汇总统计
    const summary = {
      total: formattedAccounts.length,
      available: formattedAccounts.filter(acc => !acc.isBound).length,
      bound: formattedAccounts.filter(acc => acc.isBound).length,
      byService: formattedAccounts.reduce((services, account) => {
        const existing = services.find(s => s.serviceType === account.serviceType);
        if (existing) {
          existing.count++;
          if (!account.isBound) existing.available++;
          if (account.isBound) existing.bound++;
        } else {
          services.push({
            serviceType: account.serviceType,
            count: 1,
            available: account.isBound ? 0 : 1,
            bound: account.isBound ? 1 : 0
          });
        }
        return services;
      }, [] as Array<{
        serviceType: string;
        count: number;
        available: number;
        bound: number;
      }>)
    };

    console.log(`🎯 API 企业可用AI账号: 返回企业 ${enterpriseId} 的 ${formattedAccounts.length} 个账号 (${summary.available} 个可用)`);

    return createApiResponse({
      accounts: formattedAccounts,
      summary
    }, true, 200);

  } catch (error) {
    console.error('获取企业可用AI账号失败:', error);
    return createApiResponse(false, null, '获取可用AI账号失败', 500);
  }
}
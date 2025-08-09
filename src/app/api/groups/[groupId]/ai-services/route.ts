/**
 * 拼车组AI服务配置API - 适配新的企业级架构
 * 
 * 基于SmartAiRouter和ResourceBinding，替代原有的GroupAiService模式
 * 支持：
 * - 获取可用AI服务和资源绑定状态
 * - 配置资源绑定模式
 * - 管理AI服务使用策略
 */

import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { createApiResponse } from '@/lib/middleware';
import { verifyToken } from '@/lib/auth';

const prisma = new PrismaClient();

/**
 * 获取拼车组AI服务配置状态
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ groupId: string }> }
) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) {
      return createApiResponse(false, null, '缺少认证令牌', 401);
    }

    const user = await verifyToken(token);
    if (!user) {
      return createApiResponse(false, null, '认证令牌无效', 401);
    }

    const resolvedParams = await params;
    const { groupId } = resolvedParams;

    // 验证用户是否属于该拼车组
    const groupMembership = await prisma.groupMember.findFirst({
      where: {
        groupId,
        userId: user.id,
        status: 'active'
      }
    });

    if (!groupMembership) {
      return createApiResponse(false, null, '无权限访问该拼车组', 403);
    }

    // 获取拼车组和企业信息
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      include: {
        enterprise: {
          select: {
            id: true,
            name: true,
            aiAccounts: {
              where: {
                isEnabled: true,
                status: 'active'
              },
              select: {
                id: true,
                name: true,
                serviceType: true,
                accountType: true,
                currentLoad: true,
                dailyLimit: true,
                supportedModels: true,
                currentModel: true,
                totalRequests: true,
                totalTokens: true,
                totalCost: true,
                lastUsedAt: true
              }
            }
          }
        },
        resourceBinding: true,
        accountBindings: {
          include: {
            account: {
              select: {
                id: true,
                name: true,
                serviceType: true,
                currentLoad: true,
                status: true
              }
            }
          }
        }
      }
    });

    if (!group) {
      return createApiResponse(false, null, '拼车组不存在', 404);
    }

    // 如果没有关联企业，返回提示信息
    if (!group.enterpriseId) {
      return createApiResponse({
        message: '该拼车组未关联企业，无法使用AI服务',
        hasEnterprise: false,
        services: []
      }, true, 200);
    }

    // 按服务类型分组可用账号
    const accountsByService: Record<string, any[]> = {};
    const allAccounts = group.enterprise?.aiAccounts || [];
    
    allAccounts.forEach(account => {
      if (!accountsByService[account.serviceType]) {
        accountsByService[account.serviceType] = [];
      }
      accountsByService[account.serviceType].push({
        ...account,
        totalRequests: Number(account.totalRequests),
        totalTokens: Number(account.totalTokens),
        totalCost: Number(account.totalCost)
      });
    });

    // 构建AI服务配置状态
    const services = Object.keys(accountsByService).map(serviceType => {
      const accounts = accountsByService[serviceType];
      const totalAccounts = accounts.length;
      const activeAccounts = accounts.filter(acc => acc.status === 'active').length;
      const averageLoad = activeAccounts > 0 
        ? accounts.reduce((sum, acc) => sum + acc.currentLoad, 0) / activeAccounts 
        : 0;

      // 检查该服务是否在资源绑定中
      let isConfigured = false;
      let bindingType = 'none';
      let accountsInUse: any[] = [];

      if (group.resourceBinding) {
        const config = group.resourceBinding.bindingConfig as any;
        
        switch (group.resourceBinding.bindingMode) {
          case 'dedicated':
            if (config.accounts) {
              const dedicatedAccounts = config.accounts.filter((acc: any) => acc.serviceType === serviceType);
              if (dedicatedAccounts.length > 0) {
                isConfigured = true;
                bindingType = 'dedicated';
                accountsInUse = dedicatedAccounts.map((acc: any) => 
                  accounts.find(a => a.id === acc.accountId)
                ).filter(Boolean);
              }
            }
            break;
            
          case 'shared':
            if (config.poolConfig) {
              const poolConfig = config.poolConfig.find((pc: any) => pc.serviceType === serviceType);
              if (poolConfig) {
                isConfigured = true;
                bindingType = 'shared';
                accountsInUse = accounts.filter(acc => acc.accountType === 'shared');
              }
            }
            break;
            
          case 'hybrid':
            const hasPrimary = config.primaryAccounts && 
              accounts.some(acc => config.primaryAccounts.includes(acc.id));
            const hasFallback = config.fallbackPools && 
              config.fallbackPools.some((fp: any) => fp.serviceType === serviceType);
            
            if (hasPrimary || hasFallback) {
              isConfigured = true;
              bindingType = 'hybrid';
              accountsInUse = accounts.filter(acc => 
                config.primaryAccounts?.includes(acc.id) || acc.accountType === 'shared'
              );
            }
            break;
        }
      }

      return {
        serviceType,
        displayName: getServiceDisplayName(serviceType),
        isConfigured,
        bindingType,
        totalAccounts,
        activeAccounts,
        averageLoad: Math.round(averageLoad),
        accountsInUse: accountsInUse.length,
        accounts: accounts,
        healthStatus: getServiceHealthStatus(accounts),
        usage: {
          totalRequests: accounts.reduce((sum, acc) => sum + acc.totalRequests, 0),
          totalTokens: accounts.reduce((sum, acc) => sum + acc.totalTokens, 0),
          totalCost: accounts.reduce((sum, acc) => sum + acc.totalCost, 0),
          lastUsedAt: getLatestUsageTime(accounts)
        }
      };
    });

    // 获取使用统计
    const today = new Date().toISOString().split('T')[0];
    const todayUsage = await prisma.usageStat.aggregate({
      _sum: {
        totalTokens: true,
        cost: true
      },
      _count: true,
      where: {
        groupId,
        requestTime: {
          gte: new Date(today)
        }
      }
    });

    console.log(`📋 API AI服务: 返回拼车组 ${groupId} 的 ${services.length} 个AI服务配置`);

    return createApiResponse({
      group: {
        id: group.id,
        name: group.name,
        enterpriseId: group.enterpriseId,
        enterpriseName: group.enterprise?.name
      },
      resourceBinding: group.resourceBinding,
      services,
      totalAccounts: allAccounts.length,
      todayUsage: {
        tokens: Number(todayUsage._sum.totalTokens || 0),
        cost: Number(todayUsage._sum.cost || 0),
        requests: todayUsage._count
      },
      isAdmin: ['admin', 'owner'].includes(groupMembership.role),
      hasEnterprise: true
    }, true, 200);

  } catch (error) {
    console.error('获取AI服务配置失败:', error);
    return createApiResponse(false, null, '获取AI服务配置失败', 500);
  }
}

/**
 * 快速配置AI服务（创建基础资源绑定）
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ groupId: string }> }
) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) {
      return createApiResponse(false, null, '缺少认证令牌', 401);
    }

    const user = await verifyToken(token);
    if (!user) {
      return createApiResponse(false, null, '认证令牌无效', 401);
    }

    const resolvedParams = await params;
    const { groupId } = resolvedParams;

    const body = await request.json();
    const { serviceType, bindingMode = 'shared', quickSetup = true } = body;

    if (!serviceType) {
      return createApiResponse(false, null, '缺少服务类型', 400);
    }

    // 验证当前用户是否为拼车组管理员
    const groupMembership = await prisma.groupMember.findFirst({
      where: {
        groupId,
        userId: user.id,
        role: { in: ['admin', 'owner'] },
        status: 'active'
      }
    });

    if (!groupMembership) {
      return createApiResponse(false, null, '无权限配置AI服务', 403);
    }

    // 获取拼车组和企业信息
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      include: {
        enterprise: {
          include: {
            aiAccounts: {
              where: {
                serviceType,
                isEnabled: true,
                status: 'active'
              }
            }
          }
        }
      }
    });

    if (!group || !group.enterpriseId) {
      return createApiResponse(false, null, '拼车组未关联企业', 400);
    }

    const availableAccounts = group.enterprise?.aiAccounts || [];
    if (availableAccounts.length === 0) {
      return createApiResponse(false, null, `企业没有可用的 ${serviceType} 账号`, 400);
    }

    // 构建绑定配置
    let bindingConfig: any = {};
    
    if (bindingMode === 'dedicated') {
      // 选择负载最低的账号
      const bestAccount = availableAccounts.sort((a, b) => a.currentLoad - b.currentLoad)[0];
      bindingConfig = {
        accounts: [{
          accountId: bestAccount.id,
          serviceType: serviceType,
          priority: 1
        }]
      };
    } else {
      // 共享模式
      bindingConfig = {
        poolConfig: [{
          serviceType: serviceType,
          priority: 1,
          maxUsagePercent: 80
        }]
      };
    }

    // 创建或更新资源绑定
    await prisma.groupResourceBinding.upsert({
      where: { groupId },
      create: {
        groupId,
        bindingMode,
        bindingConfig,
        dailyTokenLimit: 10000,
        priorityLevel: 'medium',
        warningThreshold: 80,
        alertThreshold: 95
      },
      update: {
        bindingMode,
        bindingConfig,
        updatedAt: new Date()
      }
    });

    // 如果是专属模式，创建账号绑定
    if (bindingMode === 'dedicated') {
      await prisma.groupAccountBinding.deleteMany({
        where: { groupId }
      });

      await prisma.groupAccountBinding.createMany({
        data: bindingConfig.accounts.map((acc: any) => ({
          groupId,
          accountId: acc.accountId,
          priority: acc.priority,
          weight: 1,
          isActive: true
        }))
      });
    }

    console.log(`✅ API AI服务: 快速配置 ${serviceType} 服务，拼车组 ${groupId}，模式 ${bindingMode}`);

    return createApiResponse({
      message: 'AI服务配置成功',
      serviceType,
      bindingMode,
      accountsConfigured: bindingConfig.accounts?.length || availableAccounts.length
    }, true, 201);

  } catch (error) {
    console.error('配置AI服务失败:', error);
    return createApiResponse(false, null, '配置AI服务失败', 500);
  }
}

// 辅助函数
function getServiceDisplayName(serviceType: string): string {
  const displayNames: Record<string, string> = {
    'claude': 'Claude',
    'gemini': 'Gemini',
    'openai': 'OpenAI',
    'qwen': '通义千问',
    'zhipu': '智谱AI',
    'kimi': 'Kimi'
  };
  return displayNames[serviceType] || serviceType;
}

function getServiceHealthStatus(accounts: any[]): string {
  const activeAccounts = accounts.filter(acc => acc.status === 'active');
  if (activeAccounts.length === 0) return 'error';
  
  const averageLoad = activeAccounts.reduce((sum, acc) => sum + acc.currentLoad, 0) / activeAccounts.length;
  if (averageLoad > 90) return 'warning';
  if (averageLoad > 70) return 'caution';
  return 'healthy';
}

function getLatestUsageTime(accounts: any[]): string | null {
  const usageTimes = accounts
    .map(acc => acc.lastUsedAt)
    .filter(time => time)
    .sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
  
  return usageTimes.length > 0 ? usageTimes[0] : null;
}
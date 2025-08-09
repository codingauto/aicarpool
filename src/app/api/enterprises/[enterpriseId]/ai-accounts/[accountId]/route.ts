/**
 * 单个AI账号管理API
 * 
 * 支持：
 * - 获取AI账号详细信息
 * - 更新AI账号配置
 * - 删除AI账号
 * - 健康检查
 */

import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { createApiResponse } from '@/lib/middleware';
import { verifyToken } from '@/lib/auth';

const prisma = new PrismaClient();

/**
 * 获取AI账号详细信息
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ enterpriseId: string; accountId: string }> }
) {
  try {
    // 1. 认证验证
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) {
      return createApiResponse(false, null, '缺少认证令牌', 401);
    }

    const user = await verifyToken(token);
    if (!user) {
      return createApiResponse(false, null, '认证令牌无效', 401);
    }

    const resolvedParams = await params;
    const { enterpriseId, accountId } = resolvedParams;

    // 2. 参数验证
    if (!enterpriseId || !accountId) {
      return createApiResponse(false, null, '缺少必要参数', 400);
    }

    // 3. 获取AI账号详细信息
    const account = await prisma.aiServiceAccount.findFirst({
      where: {
        id: accountId,
        enterpriseId
      },
      include: {
        groupBindings: {
          include: {
            group: {
              select: {
                id: true,
                name: true
              }
            }
          }
        },
        usageStats: {
          orderBy: {
            requestTime: 'desc'
          },
          take: 100, // 最近100条使用记录
          select: {
            requestTime: true,
            totalTokens: true,
            cost: true,
            responseTime: true,
            status: true,
            group: {
              select: {
                name: true
              }
            }
          }
        },
        healthChecks: {
          orderBy: {
            checkedAt: 'desc'
          },
          take: 10 // 最近10次健康检查
        }
      }
    });

    if (!account) {
      return createApiResponse(false, null, 'AI账号不存在', 404);
    }

    // 4. 计算统计数据
    const now = new Date();
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [stats24h, stats7d, statsMonth] = await Promise.all([
      // 最近24小时统计
      prisma.usageStat.aggregate({
        _sum: {
          totalTokens: true,
          cost: true
        },
        _count: true,
        _avg: {
          responseTime: true
        },
        where: {
          accountId,
          requestTime: { gte: last24h }
        }
      }),

      // 最近7天统计
      prisma.usageStat.aggregate({
        _sum: {
          totalTokens: true,
          cost: true
        },
        _count: true,
        _avg: {
          responseTime: true
        },
        where: {
          accountId,
          requestTime: { gte: last7d }
        }
      }),

      // 本月统计
      prisma.usageStat.aggregate({
        _sum: {
          totalTokens: true,
          cost: true
        },
        _count: true,
        _avg: {
          responseTime: true
        },
        where: {
          accountId,
          requestTime: { gte: thisMonth }
        }
      })
    ]);

    // 5. 格式化响应数据
    const accountDetails = {
      id: account.id,
      name: account.name,
      description: account.description,
      platform: account.platform,
      accountType: account.accountType,
      authType: account.authType,
      apiEndpoint: account.apiEndpoint,
      
      // 代理配置
      proxyConfig: account.proxyType ? {
        type: account.proxyType,
        host: account.proxyHost,
        port: account.proxyPort
      } : null,
      
      // 能力信息
      supportedModels: account.supportedModels,
      currentModel: account.currentModel,
      dailyLimit: account.dailyLimit,
      costPerToken: Number(account.costPerToken),
      
      // 状态信息
      isEnabled: account.isEnabled,
      status: account.status,
      currentLoad: account.currentLoad,
      errorMessage: account.errorMessage,
      
      // 统计信息
      totalRequests: Number(account.totalRequests),
      totalTokens: Number(account.totalTokens),
      totalCost: Number(account.totalCost),
      lastUsedAt: account.lastUsedAt,
      
      // 绑定的拼车组
      boundGroups: account.groupBindings.map(binding => ({
        id: binding.group.id,
        name: binding.group.name,
        priority: binding.priority,
        weight: binding.weight,
        isActive: binding.isActive,
        createdAt: binding.createdAt
      })),
      
      // 使用统计
      usageStats: {
        last24h: {
          requests: stats24h._count,
          tokens: Number(stats24h._sum.totalTokens || 0),
          cost: Number(stats24h._sum.cost || 0),
          avgResponseTime: Math.round(Number(stats24h._avg.responseTime || 0))
        },
        last7d: {
          requests: stats7d._count,
          tokens: Number(stats7d._sum.totalTokens || 0),
          cost: Number(stats7d._sum.cost || 0),
          avgResponseTime: Math.round(Number(stats7d._avg.responseTime || 0))
        },
        thisMonth: {
          requests: statsMonth._count,
          tokens: Number(statsMonth._sum.totalTokens || 0),
          cost: Number(statsMonth._sum.cost || 0),
          avgResponseTime: Math.round(Number(statsMonth._avg.responseTime || 0))
        }
      },
      
      // 最近使用记录
      recentUsage: account.usageStats.map(stat => ({
        requestTime: stat.requestTime,
        tokens: Number(stat.totalTokens),
        cost: Number(stat.cost),
        responseTime: stat.responseTime,
        status: stat.status,
        groupName: stat.group?.name
      })),
      
      // 健康检查历史
      healthHistory: account.healthChecks.map(check => ({
        isHealthy: check.isHealthy,
        responseTime: check.responseTime,
        errorMessage: check.errorMessage,
        checkedAt: check.checkedAt
      })),
      
      createdAt: account.createdAt,
      updatedAt: account.updatedAt
    };

    console.log(`🎯 API AI账号详情: 返回账号 ${account.name} 的详细信息`);

    return createApiResponse({
      account: accountDetails
    }, true, 200);

  } catch (error) {
    console.error('获取AI账号详情失败:', error);
    return createApiResponse(false, null, '获取账号详情失败', 500);
  }
}

/**
 * 更新AI账号配置
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ enterpriseId: string; accountId: string }> }
) {
  try {
    // 1. 认证验证
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) {
      return createApiResponse(false, null, '缺少认证令牌', 401);
    }

    const user = await verifyToken(token);
    if (!user) {
      return createApiResponse(false, null, '认证令牌无效', 401);
    }

    const resolvedParams = await params;
    const { enterpriseId, accountId } = resolvedParams;

    // 2. 解析请求体
    const body = await request.json();
    const {
      name,
      description,
      credentials,
      apiEndpoint,
      proxyConfig,
      supportedModels,
      currentModel,
      dailyLimit,
      costPerToken,
      isEnabled
    } = body;

    // 3. 权限验证
    const existingAccount = await prisma.aiServiceAccount.findFirst({
      where: {
        id: accountId,
        enterpriseId
      }
    });

    if (!existingAccount) {
      return createApiResponse(false, null, 'AI账号不存在', 404);
    }

    // 4. 检查名称冲突
    if (name && name !== existingAccount.name) {
      const duplicateName = await prisma.aiServiceAccount.findFirst({
        where: {
          enterpriseId,
          name,
          id: { not: accountId }
        }
      });

      if (duplicateName) {
        return createApiResponse(false, null, '账号名称已存在', 409);
      }
    }

    // 5. 更新账号信息
    const updatedAccount = await prisma.aiServiceAccount.update({
      where: { id: accountId },
      data: {
        ...(name && { name }),
        ...(description !== undefined && { description }),
        ...(credentials && { 
          encryptedCredentials: JSON.stringify(credentials) // 实际应该加密存储
        }),
        ...(apiEndpoint !== undefined && { apiEndpoint }),
        ...(proxyConfig && {
          proxyType: proxyConfig.type,
          proxyHost: proxyConfig.host,
          proxyPort: proxyConfig.port,
          proxyUsername: proxyConfig.username,
          proxyPassword: proxyConfig.password
        }),
        ...(supportedModels && { supportedModels }),
        ...(currentModel && { currentModel }),
        ...(dailyLimit && { dailyLimit }),
        ...(costPerToken && { costPerToken }),
        ...(isEnabled !== undefined && { 
          isEnabled,
          status: isEnabled ? 'active' : 'inactive'
        }),
        updatedAt: new Date()
      }
    });

    console.log(`✅ API AI账号更新: 成功更新账号 ${updatedAccount.name}`);

    return createApiResponse({
      account: {
        id: updatedAccount.id,
        name: updatedAccount.name,
        description: updatedAccount.description,
        platform: updatedAccount.serviceType,
        accountType: updatedAccount.accountType,
        isEnabled: updatedAccount.isEnabled,
        status: updatedAccount.status,
        updatedAt: updatedAccount.updatedAt
      }
    }, true, 200);

  } catch (error) {
    console.error('更新AI账号失败:', error);
    return createApiResponse(false, null, '更新账号失败', 500);
  }
}

/**
 * 删除AI账号
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ enterpriseId: string; accountId: string }> }
) {
  try {
    // 1. 认证验证
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) {
      return createApiResponse(false, null, '缺少认证令牌', 401);
    }

    const user = await verifyToken(token);
    if (!user) {
      return createApiResponse(false, null, '认证令牌无效', 401);
    }

    const resolvedParams = await params;
    const { enterpriseId, accountId } = resolvedParams;

    // 2. 权限验证
    const account = await prisma.aiServiceAccount.findFirst({
      where: {
        id: accountId,
        enterpriseId
      },
      include: {
        groupBindings: {
          include: {
            group: { select: { name: true } }
          }
        }
      }
    });

    if (!account) {
      return createApiResponse(false, null, 'AI账号不存在', 404);
    }

    // 3. 检查是否有绑定的拼车组
    if (account.groupBindings.length > 0) {
      const boundGroupNames = account.groupBindings.map(binding => binding.group.name).join(', ');
      return createApiResponse(false, null, `账号正在被拼车组使用: ${boundGroupNames}`, 409);
    }

    // 4. 删除账号（级联删除相关数据）
    await prisma.aiServiceAccount.delete({
      where: { id: accountId }
    });

    console.log(`✅ API AI账号删除: 成功删除账号 ${account.name}`);

    return createApiResponse({
      message: `账号 ${account.name} 已成功删除`
    }, true, 200);

  } catch (error) {
    console.error('删除AI账号失败:', error);
    return createApiResponse(false, null, '删除账号失败', 500);
  }
}

/**
 * 执行账号健康检查
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ enterpriseId: string; accountId: string }> }
) {
  try {
    // 1. 认证验证
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) {
      return createApiResponse(false, null, '缺少认证令牌', 401);
    }

    const user = await verifyToken(token);
    if (!user) {
      return createApiResponse(false, null, '认证令牌无效', 401);
    }

    const resolvedParams = await params;
    const { enterpriseId, accountId } = resolvedParams;

    // 2. 权限验证
    const account = await prisma.aiServiceAccount.findFirst({
      where: {
        id: accountId,
        enterpriseId
      }
    });

    if (!account) {
      return createApiResponse(false, null, 'AI账号不存在', 404);
    }

    // 3. 执行健康检查
    const startTime = Date.now();
    let isHealthy = false;
    let errorMessage: string | null = null;

    try {
      // 这里应该实现实际的健康检查逻辑
      // 暂时模拟健康检查
      await new Promise(resolve => setTimeout(resolve, Math.random() * 1000));
      isHealthy = Math.random() > 0.1; // 90%成功率
      
      if (!isHealthy) {
        errorMessage = '模拟健康检查失败';
      }
    } catch (error) {
      isHealthy = false;
      errorMessage = error instanceof Error ? error.message : '健康检查异常';
    }

    const responseTime = Date.now() - startTime;

    // 4. 记录健康检查结果
    const healthCheck = await prisma.accountHealthCheck.create({
      data: {
        accountId,
        isHealthy,
        responseTime,
        errorMessage,
        checkedAt: new Date()
      }
    });

    // 5. 更新账号状态
    if (!isHealthy && account.status === 'active') {
      await prisma.aiServiceAccount.update({
        where: { id: accountId },
        data: {
          status: 'error',
          errorMessage,
          updatedAt: new Date()
        }
      });
    } else if (isHealthy && account.status === 'error') {
      await prisma.aiServiceAccount.update({
        where: { id: accountId },
        data: {
          status: 'active',
          errorMessage: null,
          updatedAt: new Date()
        }
      });
    }

    console.log(`🔍 API 健康检查: 账号 ${account.name} 健康状态: ${isHealthy ? '正常' : '异常'}, 响应时间: ${responseTime}ms`);

    return createApiResponse({
      healthCheck: {
        isHealthy,
        responseTime,
        errorMessage,
        checkedAt: healthCheck.checkedAt
      },
      accountStatus: {
        id: account.id,
        name: account.name,
        status: isHealthy ? 'active' : 'error'
      }
    }, true, 200);

  } catch (error) {
    console.error('执行健康检查失败:', error);
    return createApiResponse(false, null, '健康检查失败', 500);
  }
}
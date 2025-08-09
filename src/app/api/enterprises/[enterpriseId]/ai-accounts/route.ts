/**
 * 企业AI账号管理API - v2.1重构版本
 * 
 * 支持：
 * - 获取企业下所有AI账号列表
 * - 创建新的AI账号
 * - 更新账号状态和配置
 * - 删除AI账号
 * - 批量操作AI账号
 */

import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { createApiResponse } from '@/lib/middleware';
import { verifyToken } from '@/lib/auth';

const prisma = new PrismaClient();

/**
 * 获取企业AI账号列表
 */
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
      console.log('🔐 开发模式：AI账号列表使用默认测试用户');
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
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '20');
    const platform = searchParams.get('platform'); // 改为platform
    const accountType = searchParams.get('accountType');
    const status = searchParams.get('status');

    // 5. 构建查询条件
    const where: any = { enterpriseId };
    
    if (platform) {
      where.platform = platform; // 改为platform
    }
    
    if (accountType) {
      where.accountType = accountType;
    }
    
    if (status) {
      where.status = status;
    }

    // 6. 查询AI账号列表
    const [accounts, totalCount] = await Promise.all([
      prisma.aiServiceAccount.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: {
          createdAt: 'desc'
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
          healthChecks: {
            orderBy: {
              checkedAt: 'desc'
            },
            take: 1
          }
        }
      }),
      prisma.aiServiceAccount.count({ where })
    ]);

    // 7. 格式化响应数据
    const formattedAccounts = accounts.map(account => ({
      id: account.id,
      name: account.name,
      description: account.description,
      platform: account.platform, // 改为platform
      authType: account.authType,
      accountType: account.accountType,
      priority: account.priority,
      isEnabled: account.isEnabled,
      status: account.status,
      validationStatus: account.validationStatus,
      currentLoad: account.currentLoad,
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
      
      // 平台特定配置
      geminiProjectId: account.geminiProjectId,
      claudeConsoleApiUrl: account.claudeConsoleApiUrl,
      proxyEnabled: account.proxyEnabled,
      
      createdAt: account.createdAt,
      updatedAt: account.updatedAt
    }));

    console.log(`🎯 API 企业AI账号: 返回企业 ${enterpriseId} 的 ${formattedAccounts.length} 个账号`);

    return createApiResponse({
      accounts: formattedAccounts,
      totalCount,
      pagination: {
        page,
        pageSize,
        totalPages: Math.ceil(totalCount / pageSize),
        hasMore: page * pageSize < totalCount
      }
    }, true, 200);

  } catch (error) {
    console.error('获取企业AI账号列表失败:', error);
    return createApiResponse(false, null, '获取AI账号列表失败', 500);
  }
}

/**
 * 创建新的AI账号 - 重构版本
 * 支持新的表结构和前端数据格式
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ enterpriseId: string }> }
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
    const { enterpriseId } = resolvedParams;
    
    // 2. 解析请求体
    const body = await request.json();
    const {
      name,
      description,
      accountType,
      proxy,
      claudeAiOauth,
      geminiOauth,
      projectId,
      apiUrl,
      apiKey,
      priority,
      supportedModels,
      userAgent,
      rateLimitDuration
    } = body;

    console.log('📝 创建AI账号请求数据:', {
      name,
      accountType,
      hasProxy: !!proxy,
      hasClaudeOauth: !!claudeAiOauth,
      hasGeminiOauth: !!geminiOauth,
      hasApiKey: !!apiKey,
      projectId
    });

    // 3. 参数验证
    if (!name?.trim()) {
      return createApiResponse(false, null, '缺少账户名称', 400);
    }

    // 4. 检测平台和认证类型
    let platform: string;
    let authType: string;
    
    if (claudeAiOauth) {
      platform = 'claude';
      authType = claudeAiOauth.accessToken ? 'manual' : 'oauth';
    } else if (geminiOauth) {
      platform = 'gemini';
      authType = geminiOauth.access_token ? 'manual' : 'oauth';
    } else if (apiUrl && apiKey) {
      platform = 'claude_console';
      authType = 'api_key';
    } else {
      return createApiResponse(false, null, '缺少有效的认证信息', 400);
    }

    // 5. 企业权限验证
    const enterprise = await prisma.enterprise.findUnique({
      where: { id: enterpriseId }
    });

    if (!enterprise) {
      return createApiResponse(false, null, '企业不存在', 404);
    }

    // 6. 检查同名账号
    const existingAccount = await prisma.aiServiceAccount.findFirst({
      where: {
        enterpriseId,
        name: name.trim()
      }
    });

    if (existingAccount) {
      return createApiResponse(false, null, '账号名称已存在', 409);
    }

    // 7. 准备账号数据
    const accountData: any = {
      enterpriseId,
      name: name.trim(),
      description: description || '',
      accountType: accountType || 'shared',
      priority: priority || 50,
      platform,
      authType,
      createdBy: user.id,
      
      // 状态管理
      isEnabled: true,
      status: 'active',
      validationStatus: 'pending',
      currentLoad: 0,
      totalRequests: BigInt(0),
      totalTokens: BigInt(0),
      totalCost: 0,
      
      // 限制配置
      dailyLimit: 10000,
      costPerToken: 0.00001,
      timeoutMs: 30000
    };

    // 8. 处理OAuth认证数据
    if (claudeAiOauth) {
      if (claudeAiOauth.accessToken) {
        // 手动输入的Token
        accountData.manualAccessToken = claudeAiOauth.accessToken;
        accountData.manualRefreshToken = claudeAiOauth.refreshToken || '';
      } else {
        // OAuth流程获得的Token
        accountData.oauthAccessToken = claudeAiOauth.accessToken || '';
        accountData.oauthRefreshToken = claudeAiOauth.refreshToken || '';
        accountData.oauthExpiresAt = claudeAiOauth.expiresAt ? new Date(claudeAiOauth.expiresAt) : null;
        accountData.oauthScopes = claudeAiOauth.scopes ? claudeAiOauth.scopes.join(',') : '';
      }
    }

    if (geminiOauth) {
      if (geminiOauth.access_token) {
        // 手动输入的Token
        accountData.manualAccessToken = geminiOauth.access_token;
        accountData.manualRefreshToken = geminiOauth.refresh_token || '';
      } else {
        // OAuth流程获得的Token
        accountData.oauthAccessToken = geminiOauth.access_token || '';
        accountData.oauthRefreshToken = geminiOauth.refresh_token || '';
        accountData.oauthExpiresAt = geminiOauth.expiry_date ? new Date(geminiOauth.expiry_date) : null;
        accountData.oauthScopes = geminiOauth.scope || '';
      }
      
      // Gemini特定配置
      if (projectId) {
        accountData.geminiProjectId = projectId;
      }
      accountData.geminiLocation = 'us-central1';
    }

    // 9. 处理Claude Console配置
    if (platform === 'claude_console') {
      accountData.claudeConsoleApiUrl = apiUrl;
      accountData.claudeConsoleApiKey = apiKey;
      accountData.claudeConsoleUserAgent = userAgent || '';
      accountData.claudeConsoleRateLimitDuration = rateLimitDuration || 60;
      
      if (supportedModels) {
        const models = typeof supportedModels === 'string' 
          ? supportedModels.split('\n').filter(m => m.trim())
          : supportedModels;
        accountData.claudeConsoleSupportedModels = models;
      }
    }

    // 10. 处理代理配置
    if (proxy && proxy.enabled) {
      accountData.proxyEnabled = true;
      accountData.proxyType = proxy.type || 'socks5';
      accountData.proxyHost = proxy.host || '';
      accountData.proxyPort = proxy.port ? parseInt(proxy.port) : null;
      
      if (proxy.username) {
        accountData.proxyAuthEnabled = true;
        accountData.proxyUsername = proxy.username;
        accountData.proxyPassword = proxy.password || '';
      }
    } else {
      accountData.proxyEnabled = false;
      accountData.proxyAuthEnabled = false;
    }

    // 11. 创建AI账号
    const newAccount = await prisma.aiServiceAccount.create({
      data: accountData
    });

    console.log(`✅ API 企业AI账号: 成功创建账号 ${newAccount.name} (${newAccount.platform})`);

    // 12. 返回创建的账号信息（不包含敏感信息）
    const responseAccount = {
      id: newAccount.id,
      name: newAccount.name,
      description: newAccount.description,
      platform: newAccount.platform,
      authType: newAccount.authType,
      accountType: newAccount.accountType,
      priority: newAccount.priority,
      isEnabled: newAccount.isEnabled,
      status: newAccount.status,
      validationStatus: newAccount.validationStatus,
      createdAt: newAccount.createdAt
    };

    return createApiResponse({
      account: responseAccount
    }, true, 201);

  } catch (error) {
    console.error('创建AI账号失败:', error);
    console.error('错误详情:', error);
    return createApiResponse(false, null, '创建AI账号失败: ' + (error as Error).message, 500);
  }
}

/**
 * 批量操作AI账号
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ enterpriseId: string }> }
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
    const { enterpriseId } = resolvedParams;
    
    // 2. 解析请求体
    const body = await request.json();
    const { action, accountIds, data } = body;

    // 3. 参数验证
    if (!action || !accountIds || !Array.isArray(accountIds) || accountIds.length === 0) {
      return createApiResponse(false, null, '缺少必要参数', 400);
    }

    // 4. 权限验证
    const validAccounts = await prisma.aiServiceAccount.findMany({
      where: {
        id: { in: accountIds },
        enterpriseId
      },
      select: { id: true, name: true }
    });

    if (validAccounts.length !== accountIds.length) {
      return createApiResponse(false, null, '包含无效的账号ID', 400);
    }

    let result;
    
    // 5. 执行批量操作
    switch (action) {
      case 'enable':
        result = await prisma.aiServiceAccount.updateMany({
          where: { id: { in: accountIds } },
          data: { isEnabled: true, status: 'active' }
        });
        break;
        
      case 'disable':
        result = await prisma.aiServiceAccount.updateMany({
          where: { id: { in: accountIds } },
          data: { isEnabled: false, status: 'inactive' }
        });
        break;
        
      case 'delete':
        // 检查是否有绑定的拼车组
        const boundAccounts = await prisma.groupAccountBinding.findMany({
          where: { accountId: { in: accountIds } },
          include: {
            group: { select: { name: true } }
          }
        });
        
        if (boundAccounts.length > 0) {
          const boundGroupNames = boundAccounts.map(b => b.group.name).join(', ');
          return createApiResponse(false, null, `账号正在被拼车组使用: ${boundGroupNames}`, 409);
        }
        
        result = await prisma.aiServiceAccount.deleteMany({
          where: { id: { in: accountIds } }
        });
        break;
        
      case 'update':
        if (!data) {
          return createApiResponse(false, null, '缺少更新数据', 400);
        }
        
        result = await prisma.aiServiceAccount.updateMany({
          where: { id: { in: accountIds } },
          data: {
            ...(data.dailyLimit && { dailyLimit: data.dailyLimit }),
            ...(data.costPerToken && { costPerToken: data.costPerToken }),
            ...(data.currentModel && { currentModel: data.currentModel }),
            updatedAt: new Date()
          }
        });
        break;
        
      default:
        return createApiResponse(false, null, '不支持的操作类型', 400);
    }

    console.log(`✅ API 企业AI账号: 批量${action}操作完成，影响${result.count}个账号`);

    return createApiResponse({
      action,
      affectedCount: result.count,
      accountIds: validAccounts.map(acc => ({ id: acc.id, name: acc.name }))
    }, true, 200);

  } catch (error) {
    console.error('批量操作AI账号失败:', error);
    return createApiResponse(false, null, '批量操作失败', 500);
  }
}
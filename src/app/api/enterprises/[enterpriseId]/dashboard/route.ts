/**
 * 企业仪表板统计数据API
 * 
 * 功能：
 * - 获取企业成员统计
 * - 获取拼车组统计
 * - 获取AI资源统计
 * - 获取成本和使用率统计
 */

import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { createApiResponse } from '@/lib/middleware';
import { verifyToken } from '@/lib/auth';

const prisma = new PrismaClient();

interface DashboardStats {
  enterprise: {
    id: string;
    name: string;
    planType: string;
  };
  members: {
    total: number;
    active: number;
  };
  groups: {
    total: number;
    active: number;
  };
  aiResources: {
    accounts: number;
    pools: number;
    usage: number;
  };
  costs: {
    today: number;
    month: number;
    efficiency: number;
  };
  systemStatus: {
    aiAvailability: number;
    responseTime: number;
    currentModel: string;
    loadBalance: string;
  };
  resourceUsage: {
    poolUtilization: number;
    apiCallsPerDay: number;
    monthCost: number;
    storage: number;
  };
}

/**
 * 获取企业仪表板统计数据
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
      console.log('🔐 开发模式：使用默认测试用户');
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

    // 2. 验证企业是否存在
    const enterprise = await prisma.enterprise.findUnique({
      where: { id: enterpriseId }
    });

    if (!enterprise) {
      return createApiResponse(false, null, '企业不存在', 404);
    }

    // 3. 权限验证 - 检查用户是否属于该企业
    const userEnterprise = await prisma.userEnterprise.findFirst({
      where: {
        userId: user.id,
        enterpriseId: enterpriseId
      }
    });

    // 开发模式下跳过权限检查
    if (process.env.NODE_ENV !== 'development' && !userEnterprise) {
      return createApiResponse(false, null, '您没有权限访问此企业', 403);
    }

    // 4. 并发获取各项统计数据
    const [
      membersData,
      groupsData,
      aiAccountsData,
      usageData,
      departmentsCount
    ] = await Promise.all([
      // 获取成员统计
      prisma.userEnterprise.aggregate({
        where: { enterpriseId },
        _count: true
      }),
      
      // 获取拼车组统计
      prisma.group.findMany({
        where: { enterpriseId },
        select: {
          id: true,
          status: true,
          _count: {
            select: { members: true }
          }
        }
      }),
      
      // 获取AI账号统计
      prisma.aiServiceAccount.findMany({
        where: { enterpriseId },
        select: {
          id: true,
          platform: true,
          status: true
        }
      }),
      
      // 获取使用统计（最近30天）
      prisma.usageStat.aggregate({
        where: {
          groupId: {
            in: await prisma.group.findMany({
              where: { enterpriseId },
              select: { id: true }
            }).then(groups => groups.map(g => g.id))
          },
          requestTime: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
          }
        },
        _sum: {
          requestTokens: true,
          responseTokens: true,
          cost: true
        },
        _avg: {
          responseTime: true
        }
      }),
      
      // 获取部门数量
      prisma.department.count({
        where: { enterpriseId }
      })
    ]);

    // 5. 计算活跃成员数（最近7天有访问记录）
    const activeMembersCount = await prisma.userEnterprise.count({
      where: {
        enterpriseId,
        lastAccessed: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
        }
      }
    });

    // 6. 计算统计数据
    const totalGroups = groupsData.length;
    const activeGroups = groupsData.filter(g => g.status === 'active').length;
    const totalMembers = groupsData.reduce((sum, g) => sum + g._count.members, 0);
    
    // AI账号统计
    const totalAccounts = aiAccountsData.length;
    const activeAccounts = aiAccountsData.filter(a => a.status === 'active').length;
    
    // 账号池统计（按平台分组）
    const accountPools = new Set(aiAccountsData.map(a => a.platform)).size;
    
    // 使用率计算（活跃账号/总账号）
    const usage = totalAccounts > 0 ? Math.round((activeAccounts / totalAccounts) * 100) : 0;
    
    // 成本计算（基于使用统计）
    const totalRequests = (usageData._sum.requestTokens || 0) + (usageData._sum.responseTokens || 0);
    const totalCost = parseFloat((usageData._sum.cost || 0).toString());
    const avgResponseTime = usageData._avg.responseTime || 0;
    
    // 今日数据（模拟，实际应从数据库获取）
    const todayRequests = Math.floor(totalRequests / 30); // 平均每日请求
    const todayCost = parseFloat((totalCost / 30).toFixed(2)); // 平均每日成本
    
    // 效率计算（基于响应时间和成功率）
    const efficiency = avgResponseTime > 0 && avgResponseTime < 2000 ? 95 : 
                      avgResponseTime < 3000 ? 85 : 75;

    // 7. 构建响应数据
    const dashboardStats: DashboardStats = {
      enterprise: {
        id: enterprise.id,
        name: enterprise.name,
        planType: enterprise.planType || 'basic'
      },
      members: {
        total: membersData._count,
        active: activeMembersCount
      },
      groups: {
        total: totalGroups,
        active: activeGroups
      },
      aiResources: {
        accounts: totalAccounts,
        pools: accountPools,
        usage: usage
      },
      costs: {
        today: todayCost,
        month: parseFloat(totalCost.toFixed(2)),
        efficiency: efficiency
      },
      systemStatus: {
        aiAvailability: 99.9,
        responseTime: avgResponseTime / 1000, // 转换为秒
        currentModel: 'claude-4-sonnet',
        loadBalance: '正常'
      },
      resourceUsage: {
        poolUtilization: usage,
        apiCallsPerDay: todayRequests,
        monthCost: parseFloat(totalCost.toFixed(2)),
        storage: 2.1 // GB，模拟数据
      }
    };

    return createApiResponse(true, dashboardStats, '获取仪表板数据成功');
  } catch (error) {
    console.error('获取仪表板数据失败:', error);
    return createApiResponse(
      false, 
      null, 
      error instanceof Error ? error.message : '获取仪表板数据失败', 
      500
    );
  }
}
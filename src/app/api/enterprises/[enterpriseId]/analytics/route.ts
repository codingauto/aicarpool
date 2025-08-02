/**
 * 企业级数据分析API
 * 
 * 提供企业所有拼车组的综合使用统计和分析数据
 */

import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { createApiResponse } from '@/lib/middleware';
import { verifyToken } from '@/lib/auth';

const prisma = new PrismaClient();

/**
 * 获取企业级使用分析数据
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ enterpriseId: string }> }
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

    const { enterpriseId } = await params;
    const { searchParams } = new URL(request.url);
    const timeRange = searchParams.get('timeRange') || '30d';

    // 验证企业访问权限
    const enterprise = await prisma.enterprise.findUnique({
      where: { id: enterpriseId },
      include: {
        members: {
          where: { userId: user.id },
          select: { role: true }
        }
      }
    });

    if (!enterprise) {
      return createApiResponse(false, null, '企业不存在', 404);
    }

    const userMembership = enterprise.members[0];
    if (!userMembership) {
      return createApiResponse(false, null, '您不是该企业的成员', 403);
    }

    // 获取企业下所有拼车组
    const groups = await prisma.group.findMany({
      where: { enterpriseId },
      include: {
        members: {
          include: {
            user: {
              select: { id: true, name: true, email: true }
            }
          }
        },
        resourceBinding: true,
        _count: {
          select: { members: true }
        }
      }
    });

    // 生成模拟使用数据
    const days = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90;
    const usageData = [];
    
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      
      // 为每个拼车组生成使用数据
      let totalTokens = 0;
      let totalCost = 0;
      let totalRequests = 0;
      
      groups.forEach(group => {
        const memberCount = group._count.members;
        const baseUsage = memberCount * (Math.random() * 1000 + 500);
        
        totalTokens += baseUsage;
        totalCost += baseUsage * 0.002; // 模拟token价格
        totalRequests += Math.floor(baseUsage / 50);
      });
      
      usageData.push({
        date: date.toISOString().split('T')[0],
        tokens: Math.floor(totalTokens),
        cost: Math.floor(totalCost * 100) / 100,
        requests: totalRequests,
        responseTime: Math.floor(Math.random() * 1000) + 500,
        successRate: Math.floor(Math.random() * 10) + 90
      });
    }

    // 生成服务使用分布数据
    const serviceUsage = [
      { 
        serviceType: 'Claude', 
        tokens: Math.floor(usageData.reduce((sum, day) => sum + day.tokens, 0) * 0.45),
        cost: Math.floor(usageData.reduce((sum, day) => sum + day.cost, 0) * 0.45 * 100) / 100,
        requests: Math.floor(usageData.reduce((sum, day) => sum + day.requests, 0) * 0.45),
        percentage: 45 
      },
      { 
        serviceType: 'OpenAI', 
        tokens: Math.floor(usageData.reduce((sum, day) => sum + day.tokens, 0) * 0.32),
        cost: Math.floor(usageData.reduce((sum, day) => sum + day.cost, 0) * 0.32 * 100) / 100,
        requests: Math.floor(usageData.reduce((sum, day) => sum + day.requests, 0) * 0.32),
        percentage: 32 
      },
      { 
        serviceType: 'Gemini', 
        tokens: Math.floor(usageData.reduce((sum, day) => sum + day.tokens, 0) * 0.15),
        cost: Math.floor(usageData.reduce((sum, day) => sum + day.cost, 0) * 0.15 * 100) / 100,
        requests: Math.floor(usageData.reduce((sum, day) => sum + day.requests, 0) * 0.15),
        percentage: 15 
      },
      { 
        serviceType: '千帆', 
        tokens: Math.floor(usageData.reduce((sum, day) => sum + day.tokens, 0) * 0.08),
        cost: Math.floor(usageData.reduce((sum, day) => sum + day.cost, 0) * 0.08 * 100) / 100,
        requests: Math.floor(usageData.reduce((sum, day) => sum + day.requests, 0) * 0.08),
        percentage: 8 
      }
    ];

    // 生成拼车组使用统计
    const groupStats = groups.map(group => {
      const dailyAvgTokens = Math.floor(Math.random() * 5000) + 2000;
      const dailyAvgCost = dailyAvgTokens * 0.002;
      
      return {
        groupId: group.id,
        groupName: group.name,
        memberCount: group._count.members,
        resourceMode: group.resourceBinding?.bindingMode || 'shared',
        dailyTokens: dailyAvgTokens,
        dailyCost: Math.floor(dailyAvgCost * 100) / 100,
        utilizationRate: Math.floor(Math.random() * 40) + 60, // 60-100%
        efficiency: Math.floor(Math.random() * 20) + 80 // 80-100%
      };
    });

    // 生成部门统计（通过group所属department聚合）
    const departmentStats = await prisma.department.findMany({
      where: { enterpriseId },
      include: {
        groups: {
          include: {
            _count: {
              select: { members: true }
            }
          }
        }
      }
    });

    const deptAnalytics = departmentStats.map(dept => {
      const deptGroups = dept.groups;
      const totalMembers = deptGroups.reduce((sum, group) => sum + group._count.members, 0);
      const avgTokensPerMember = 1000; // 模拟每成员日均token使用
      const totalDailyTokens = totalMembers * avgTokensPerMember;
      const totalDailyCost = totalDailyTokens * 0.002;
      
      return {
        departmentId: dept.id,
        departmentName: dept.name,
        groupCount: deptGroups.length,
        memberCount: totalMembers,
        dailyTokens: totalDailyTokens,
        dailyCost: Math.floor(totalDailyCost * 100) / 100,
        efficiency: Math.floor(Math.random() * 20) + 80
      };
    });

    const analyticsData = {
      enterprise: {
        id: enterprise.id,
        name: enterprise.name
      },
      timeRange,
      summary: {
        totalGroups: groups.length,
        totalMembers: groups.reduce((sum, group) => sum + group._count.members, 0),
        totalTokens: usageData.reduce((sum, day) => sum + day.tokens, 0),
        totalCost: Math.floor(usageData.reduce((sum, day) => sum + day.cost, 0) * 100) / 100,
        totalRequests: usageData.reduce((sum, day) => sum + day.requests, 0),
        avgResponseTime: Math.floor(usageData.reduce((sum, day) => sum + day.responseTime, 0) / usageData.length),
        avgSuccessRate: Math.floor(usageData.reduce((sum, day) => sum + day.successRate, 0) / usageData.length)
      },
      usageData,
      serviceUsage,
      groupStats,
      departmentStats: deptAnalytics
    };

    console.log(`📊 API 企业分析: 为企业 ${enterprise.name} 生成了 ${days} 天的使用分析数据`);

    return createApiResponse(true, analyticsData, '获取企业分析数据成功', 200);

  } catch (error) {
    console.error('获取企业分析数据失败:', error);
    return createApiResponse(false, null, '获取企业分析数据失败', 500);
  }
}
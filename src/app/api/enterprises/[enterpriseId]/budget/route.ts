/**
 * 企业级预算管理API
 * 
 * 提供企业预算配置、监控和分析功能
 */

import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { createApiResponse } from '@/lib/middleware';
import { verifyToken } from '@/lib/auth';

const prisma = new PrismaClient();

/**
 * 获取企业预算数据
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

    // 验证企业访问权限
    const enterprise = await prisma.enterprise.findUnique({
      where: { id: enterpriseId },
      include: {
        departments: {
          include: {
            groups: {
              include: {
                _count: {
                  select: { members: true }
                }
              }
            }
          }
        }
      }
    });

    if (!enterprise) {
      return createApiResponse(false, null, '企业不存在', 404);
    }

    // 检查用户是否是企业成员
    const userMembership = await prisma.userEnterprise.findFirst({
      where: {
        userId: user.id,
        enterpriseId: enterpriseId,
        isActive: true
      }
    });

    if (!userMembership) {
      return createApiResponse(false, null, '您不是该企业的成员', 403);
    }

    // 获取预算分配数据
    const budgetAllocations = await prisma.budgetAllocation.findMany({
      where: {
        entityType: 'enterprise',
        entityId: enterpriseId,
        isActive: true
      }
    });

    // 获取当前月份的预算使用情况
    const currentDate = new Date();
    const currentMonth = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
    
    // 计算各部门预算使用情况
    const departmentBudgets = enterprise.departments.map(dept => {
      const totalGroups = dept.groups.length;
      const totalMembers = dept.groups.reduce((sum, group) => sum + group._count.members, 0);
      
      // 模拟预算和使用数据
      const monthlyBudget = 5000 + totalMembers * 200; // 基础预算 + 按成员计算
      const usedBudget = monthlyBudget * (0.3 + Math.random() * 0.5); // 30-80% 使用率
      const utilization = (usedBudget / monthlyBudget) * 100;
      
      return {
        id: dept.id,
        name: dept.name,
        budget: monthlyBudget,
        used: usedBudget,
        utilization: utilization,
        status: utilization > 90 ? 'critical' : utilization > 75 ? 'warning' : 'normal'
      };
    });

    // 计算总体预算概览
    const totalBudget = departmentBudgets.reduce((sum, dept) => sum + dept.budget, 0);
    const usedBudget = departmentBudgets.reduce((sum, dept) => sum + dept.used, 0);
    const remainingBudget = totalBudget - usedBudget;
    const budgetUtilization = (usedBudget / totalBudget) * 100;

    // 生成预算告警
    const alerts = [];
    departmentBudgets.forEach(dept => {
      if (dept.status === 'critical') {
        alerts.push({
          id: `alert_${dept.id}`,
          type: 'budget_exceeded',
          message: `${dept.name} 部门预算使用率已超过90%`,
          department: dept.name,
          threshold: dept.budget * 0.9,
          current: dept.used,
          timestamp: new Date().toISOString()
        });
      } else if (dept.status === 'warning') {
        alerts.push({
          id: `warning_${dept.id}`,
          type: 'budget_warning',
          message: `${dept.name} 部门预算使用率已超过75%`,
          department: dept.name,
          threshold: dept.budget * 0.75,
          current: dept.used,
          timestamp: new Date().toISOString()
        });
      }
    });

    // 生成近期交易记录
    const recentTransactions = [];
    for (let i = 0; i < 15; i++) {
      const transactionDate = new Date();
      transactionDate.setDate(transactionDate.getDate() - i);
      
      const randomDept = departmentBudgets[Math.floor(Math.random() * departmentBudgets.length)];
      const services = ['Claude', 'OpenAI', 'Gemini', '千帆'];
      const randomService = services[Math.floor(Math.random() * services.length)];
      
      recentTransactions.push({
        id: `tx_${i}`,
        date: transactionDate.toISOString(),
        description: `${randomService} API调用费用`,
        amount: Math.floor(Math.random() * 200) + 50,
        department: randomDept.name,
        service: randomService
      });
    }

    const budgetData = {
      overview: {
        totalBudget: Math.floor(totalBudget),
        usedBudget: Math.floor(usedBudget),
        remainingBudget: Math.floor(remainingBudget),
        monthlyBudget: Math.floor(totalBudget),
        currentMonthUsed: Math.floor(usedBudget),
        budgetUtilization: Math.floor(budgetUtilization * 100) / 100
      },
      departments: departmentBudgets.map(dept => ({
        ...dept,
        budget: Math.floor(dept.budget),
        used: Math.floor(dept.used),
        utilization: Math.floor(dept.utilization * 100) / 100
      })),
      alerts,
      recentTransactions
    };

    console.log(`💰 API 企业预算: 为企业 ${enterprise.name} 生成了预算管理数据`);

    return createApiResponse(true, budgetData, '获取企业预算数据成功', 200);

  } catch (error) {
    console.error('获取企业预算数据失败:', error);
    return createApiResponse(false, null, '获取企业预算数据失败', 500);
  }
}

/**
 * 更新企业预算配置
 */
export async function PUT(
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
    const body = await request.json();

    // 验证企业访问权限
    const userMembership = await prisma.userEnterprise.findFirst({
      where: {
        userId: user.id,
        enterpriseId: enterpriseId,
        isActive: true,
        role: { in: ['owner', 'admin'] } // 只有管理员可以修改预算
      }
    });

    if (!userMembership) {
      return createApiResponse(false, null, '您没有权限修改预算配置', 403);
    }

    // 更新或创建预算分配记录
    const { entityType, budgetAmount, budgetPeriod } = body;

    const currentDate = new Date();
    const periodStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const periodEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);

    const budgetAllocation = await prisma.budgetAllocation.upsert({
      where: {
        entityType_entityId: {
          entityType: entityType || 'enterprise',
          entityId: enterpriseId
        }
      },
      update: {
        budgetAmount: budgetAmount,
        budgetPeriod: budgetPeriod || 'monthly',
        periodStart,
        periodEnd,
        updatedAt: new Date()
      },
      create: {
        entityType: entityType || 'enterprise',
        entityId: enterpriseId,
        budgetPeriod: budgetPeriod || 'monthly',
        budgetAmount: budgetAmount,
        usedAmount: 0,
        periodStart,
        periodEnd,
        isActive: true
      }
    });

    console.log(`💰 API 企业预算: 为企业 ${enterpriseId} 更新了预算配置`);

    return createApiResponse(true, budgetAllocation, '预算配置更新成功', 200);

  } catch (error) {
    console.error('更新企业预算配置失败:', error);
    return createApiResponse(false, null, '更新企业预算配置失败', 500);
  }
}
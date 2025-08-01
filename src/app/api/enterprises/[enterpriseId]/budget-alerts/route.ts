import { NextRequest } from 'next/server';
import { createApiResponse } from '@/lib/middleware';
import { getUserFromRequest } from '@/lib/auth';
import { cacheManager } from '@/lib/cache';
import { prisma } from '@/lib/prisma';
import { costTracker } from '@/lib/enterprise/cost-tracker';

// GET /api/enterprises/[enterpriseId]/budget-alerts - 获取预算预警
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ enterpriseId: string }> }
) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return createApiResponse(false, null, '未授权', 401);
    }

    const resolvedParams = await params;
    const { enterpriseId } = resolvedParams;

    const { searchParams } = new URL(request.url);
    const alertLevel = searchParams.get('alertLevel'); // warning, critical, exceeded
    const entityType = searchParams.get('entityType'); // department, group, enterprise

    // 获取企业下所有部门
    const departments = await prisma.department.findMany({
      where: { enterpriseId },
      select: {
        id: true,
        name: true,
        budgetLimit: true,
        groups: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    const alerts = [];

    // 检查企业级预算预警
    try {
      const enterpriseAlerts = await cacheManager.get(`budget_alerts:enterprise:${enterpriseId}`);
      if (enterpriseAlerts) {
        alerts.push(...enterpriseAlerts);
      }
    } catch (error) {
      console.warn('Failed to get enterprise alerts from cache');
    }

    // 检查各部门预算预警
    for (const department of departments) {
      if (!department.budgetLimit) continue;

      try {
        // 从缓存获取预警
        const departmentAlerts = await cacheManager.get(`budget_alerts:department:${department.id}`);
        if (departmentAlerts) {
          alerts.push(...departmentAlerts.map((alert: any) => ({
            ...alert,
            entityName: department.name
          })));
        }

        // 如果缓存中没有，实时计算
        if (!departmentAlerts) {
          const budgetUsage = await costTracker.getBudgetUsage('department', department.id, 'monthly');
          
          if (budgetUsage.percentage >= 80) {
            let alertType = 'warning';
            if (budgetUsage.percentage >= 100) alertType = 'exceeded';
            else if (budgetUsage.percentage >= 90) alertType = 'critical';

            alerts.push({
              id: `dept_${department.id}_${alertType}_${Date.now()}`,
              type: 'department',
              entityId: department.id,
              entityName: department.name,
              budgetLimit: budgetUsage.budgetLimit,
              currentSpend: budgetUsage.currentSpend,
              percentage: budgetUsage.percentage,
              alertType,
              period: 'monthly',
              triggeredAt: new Date()
            });
          }
        }
      } catch (error) {
        console.warn(`Failed to check budget for department ${department.id}:`, error);
      }
    }

    // 过滤预警
    let filteredAlerts = alerts;
    if (alertLevel) {
      filteredAlerts = alerts.filter(alert => alert.alertType === alertLevel);
    }
    if (entityType) {
      filteredAlerts = filteredAlerts.filter(alert => alert.type === entityType);
    }

    // 按严重程度排序
    const severityOrder = { 'exceeded': 3, 'critical': 2, 'warning': 1 };
    filteredAlerts.sort((a, b) => {
      const severityA = severityOrder[a.alertType as keyof typeof severityOrder] || 0;
      const severityB = severityOrder[b.alertType as keyof typeof severityOrder] || 0;
      return severityB - severityA;
    });

    return createApiResponse(true, {
      enterpriseId,
      alerts: filteredAlerts,
      summary: {
        total: filteredAlerts.length,
        exceeded: filteredAlerts.filter(a => a.alertType === 'exceeded').length,
        critical: filteredAlerts.filter(a => a.alertType === 'critical').length,
        warning: filteredAlerts.filter(a => a.alertType === 'warning').length
      },
      generatedAt: new Date()
    }, '获取预算预警成功', 200);

  } catch (error) {
    console.error('Get budget alerts error:', error);
    return createApiResponse(false, null, '获取预算预警失败', 500);
  }
}
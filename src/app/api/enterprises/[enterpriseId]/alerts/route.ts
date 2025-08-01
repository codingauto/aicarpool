import { NextRequest } from 'next/server';
import { createApiResponse } from '@/lib/middleware';
import { getUserFromRequest } from '@/lib/auth';
import { alertManager } from '@/lib/enterprise/alert-manager';

// GET /api/enterprises/[enterpriseId]/alerts - 获取告警信息
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
    const summary = searchParams.get('summary') === 'true';

    if (summary) {
      // 获取告警汇总
      const alertSummary = await alertManager.getAlertSummary(enterpriseId);
      
      return createApiResponse(true, {
        enterpriseId,
        summary: alertSummary,
        generatedAt: new Date()
      }, '获取告警汇总成功', 200);
    } else {
      // 获取详细告警列表
      const alerts = await alertManager.checkAlerts(enterpriseId);
      
      return createApiResponse(true, {
        enterpriseId,
        alerts,
        total: alerts.length,
        generatedAt: new Date()
      }, '获取告警列表成功', 200);
    }

  } catch (error) {
    console.error('Get alerts error:', error);
    return createApiResponse(false, null, '获取告警信息失败', 500);
  }
}
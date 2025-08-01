import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createApiResponse } from '@/lib/middleware';
import { getUserFromRequest } from '@/lib/auth';

// GET /api/enterprises/[enterpriseId]/ai-accounts - 获取企业可用的AI账号
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

    // 检查企业是否存在
    const enterprise = await prisma.enterprise.findUnique({
      where: { id: enterpriseId }
    });

    if (!enterprise) {
      return createApiResponse(false, null, '企业不存在', 404);
    }

    // 获取企业下所有拼车组的AI账号
    const accounts = await prisma.aiServiceAccount.findMany({
      where: {
        group: {
          departmentId: {
            in: await prisma.department.findMany({
              where: { enterpriseId },
              select: { id: true }
            }).then(depts => depts.map(d => d.id))
          }
        }
      },
      select: {
        id: true,
        name: true,
        serviceType: true,
        status: true,
        isEnabled: true,
        modelId: true,
        modelVersion: true,
        lastUsedAt: true,
        createdAt: true,
        group: {
          select: {
            id: true,
            name: true,
            department: {
              select: {
                id: true,
                name: true
              }
            }
          }
        }
      },
      orderBy: [
        { serviceType: 'asc' },
        { name: 'asc' }
      ]
    });

    // 获取已绑定的账号ID列表
    const boundAccountIds = await prisma.accountPoolBinding.findMany({
      where: {
        pool: {
          enterpriseId
        }
      },
      select: {
        accountId: true
      }
    }).then(bindings => bindings.map(b => b.accountId));

    // 标记账号是否已绑定
    const accountsWithBindingStatus = accounts.map(account => ({
      ...account,
      isBound: boundAccountIds.includes(account.id)
    }));

    return createApiResponse(true, accountsWithBindingStatus, '获取企业AI账号成功', 200);
    
  } catch (error) {
    console.error('Get enterprise AI accounts error:', error);
    return createApiResponse(false, null, '获取企业AI账号失败', 500);
  }
}
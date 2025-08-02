import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { createApiResponse } from '@/lib/middleware';
import { getUserFromRequest } from '@/lib/auth';
import { cacheManager } from '@/lib/cache';

const createEnterpriseSchema = z.object({
  name: z.string().min(1, '企业名称不能为空').max(100, '企业名称不能超过100个字符'),
  description: z.string().optional(),
  industry: z.string().optional(),
  expectedSize: z.string().transform(val => parseInt(val)).pipe(
    z.number().min(10, '企业规模至少10人').max(10000, '企业规模不能超过10000人')
  ).optional(),
  planType: z.enum(['basic', 'professional', 'enterprise', 'custom']).default('professional'),
  features: z.array(z.string()).default([]),
  organizationType: z.literal('enterprise').optional(),
  creationTemplate: z.literal('full_enterprise').optional(),
  settings: z.record(z.any()).optional()
});

// GET /api/enterprises - 获取企业列表
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return createApiResponse(false, null, '未授权', 401);
    }

    // TODO: 实现企业权限验证，暂时返回所有企业
    const enterprises = await prisma.enterprise.findMany({
      include: {
        departments: {
          select: {
            id: true,
            name: true,
            description: true,
            budgetLimit: true,
          }
        },
        accountPools: {
          select: {
            id: true,
            name: true,
            poolType: true,
            isActive: true,
          }
        },
        _count: {
          select: {
            departments: true,
            accountPools: true,
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return createApiResponse(true, enterprises, '获取企业列表成功', 200);
    
  } catch (error) {
    console.error('Get enterprises error:', error);
    return createApiResponse(false, null, '获取企业列表失败', 500);
  }
}

// POST /api/enterprises - 创建企业
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return createApiResponse(false, null, '未授权', 401);
    }

    // TODO: 检查用户是否有创建企业的权限

    const body = await request.json();
    const validatedData = createEnterpriseSchema.parse(body);

    const enterprise = await prisma.enterprise.create({
      data: {
        name: validatedData.name,
        planType: validatedData.planType,
        settings: validatedData.settings || {},
      }
    });

    return createApiResponse(true, enterprise, '企业创建成功', 201);
    
  } catch (error) {
    if (error instanceof z.ZodError) {
      return createApiResponse(false, null, error.issues[0].message, 400);
    }
    
    console.error('Create enterprise error:', error);
    return createApiResponse(false, null, '创建企业失败', 500);
  }
}
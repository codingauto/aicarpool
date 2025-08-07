/**
 * 批量创建API Key API
 * 
 * 支持：
 * - 批量创建多个API Keys
 * - 自动命名和序号管理
 * - 批量验证和错误处理
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { createApiResponse } from '@/lib/middleware';
import { verifyToken } from '@/lib/auth';
import { generateApiKey } from '@/lib/utils';

// 批量创建API Key验证模式 - 基于新的数据库schema
const batchCreateApiKeySchema = z.object({
  createType: z.literal('batch'),
  baseName: z.string().min(1, '基础名称不能为空').max(50, '基础名称不能超过50个字符'),
  count: z.number().min(2, '批量创建数量至少为2').max(500, '批量创建数量不能超过500'),
  
  // 基本信息
  description: z.string().max(500, '描述不能超过500个字符').optional(),
  tags: z.array(z.string()).optional(),
  
  // 限制配置
  tokenLimit: z.number().min(0).nullable().optional(),
  rateLimitWindow: z.number().min(1).nullable().optional(),
  rateLimitRequests: z.number().min(1).nullable().optional(),
  concurrencyLimit: z.number().min(0).nullable().optional(),
  dailyCostLimit: z.number().min(0).nullable().optional(),
  
  // 过期设置
  expiresAt: z.string().datetime().nullable().optional(),
  
  // 权限配置
  permissions: z.enum(['all', 'claude', 'gemini']).default('all'),
  claudeAccountId: z.string().nullable().optional(),
  geminiAccountId: z.string().nullable().optional(),
  
  // 高级限制
  enableModelRestriction: z.boolean().default(false),
  restrictedModels: z.array(z.string()).default([]),
  enableClientRestriction: z.boolean().default(false),
  allowedClients: z.array(z.string()).default([]),
  
  // 所属拼车组
  groupId: z.string().min(1, '必须选择拼车组')
});

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
    const validatedData = batchCreateApiKeySchema.parse(body);

    // 3. 权限验证
    const enterprise = await prisma.enterprise.findUnique({
      where: { id: enterpriseId }
    });

    if (!enterprise) {
      return createApiResponse(false, null, '企业不存在', 404);
    }

    // 4. 验证拼车组权限
    const group = await prisma.group.findFirst({
      where: {
        id: validatedData.groupId,
        enterpriseId
      }
    });

    if (!group) {
      return createApiResponse(false, null, '拼车组不存在或无权限', 404);
    }

    // 5. 检查基础名称是否已存在
    const existingApiKeys = await prisma.apiKey.findMany({
      where: {
        name: {
          startsWith: validatedData.baseName + '_'
        },
        groupId: validatedData.groupId,
        status: { not: 'deleted' }
      },
      select: { name: true }
    });

    if (existingApiKeys.length > 0) {
      return createApiResponse(false, null, `基础名称 "${validatedData.baseName}" 已存在，请使用其他名称`, 409);
    }

    // 6. 批量创建API Keys
    const createdApiKeys = [];
    const errors = [];

    for (let i = 1; i <= validatedData.count; i++) {
      try {
        const apiKeyName = `${validatedData.baseName}_${i}`;
        const apiKeyValue = generateApiKey();

        const newApiKey = await prisma.apiKey.create({
          data: {
            name: apiKeyName,
            description: validatedData.description || '',
            key: apiKeyValue,
            tags: validatedData.tags || [],
            
            // 限制配置
            tokenLimit: validatedData.tokenLimit,
            rateLimitWindow: validatedData.rateLimitWindow,
            rateLimitRequests: validatedData.rateLimitRequests,
            concurrencyLimit: validatedData.concurrencyLimit || 0,
            dailyCostLimit: validatedData.dailyCostLimit || 0,
            
            // 过期设置
            expiresAt: validatedData.expiresAt ? new Date(validatedData.expiresAt) : null,
            
            // 权限配置
            permissions: validatedData.permissions,
            claudeAccountId: validatedData.claudeAccountId,
            geminiAccountId: validatedData.geminiAccountId,
            
            // 高级限制
            enableModelRestriction: validatedData.enableModelRestriction,
            restrictedModels: validatedData.restrictedModels,
            enableClientRestriction: validatedData.enableClientRestriction,
            allowedClients: validatedData.allowedClients,
            
            // 关联信息
            groupId: validatedData.groupId,
            userId: user.id,
            
            // 初始状态
            status: 'active',
            totalRequests: BigInt(0),
            totalTokens: BigInt(0),
            totalCost: 0
          }
        });

        createdApiKeys.push({
          id: newApiKey.id,
          name: newApiKey.name,
          key: newApiKey.key,
          status: newApiKey.status,
          createdAt: newApiKey.createdAt
        });

      } catch (error) {
        console.error(`创建第 ${i} 个API Key失败:`, error);
        errors.push({
          index: i,
          name: `${validatedData.baseName}_${i}`,
          error: error instanceof Error ? error.message : '未知错误'
        });
      }
    }

    // 7. 处理结果
    if (errors.length > 0) {
      console.warn(`⚠️ 批量创建API Key: 成功 ${createdApiKeys.length} 个，失败 ${errors.length} 个`);
      
      return createApiResponse({
        success: createdApiKeys.length > 0,
        created: createdApiKeys,
        errors: errors,
        summary: {
          total: validatedData.count,
          success: createdApiKeys.length,
          failed: errors.length
        }
      });
    }

    console.log(`✅ API 批量创建API Key: 成功创建 ${createdApiKeys.length} 个API Keys`);

    return createApiResponse({
      success: true,
      created: createdApiKeys,
      summary: {
        total: validatedData.count,
        success: createdApiKeys.length,
        failed: 0
      }
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return createApiResponse(false, null, error.issues[0].message, 400);
    }

    console.error('批量创建API Key失败:', error);
    return createApiResponse(false, null, '批量创建API Key失败', 500);
  }
}

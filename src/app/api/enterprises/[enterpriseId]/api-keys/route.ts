/**
 * 企业API Key管理API
 * 
 * 支持：
 * - 获取企业下所有API Keys
 * - 创建单个API Key
 * - 更新API Key配置
 * - 删除API Key
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { createApiResponse } from '@/lib/middleware';
import { verifyToken } from '@/lib/auth';
import { generateApiKey } from '@/lib/utils';

// API Key创建验证模式 - 基于新的数据库schema
const createApiKeySchema = z.object({
  name: z.string().min(1, 'API Key名称不能为空').max(100, '名称不能超过100个字符'),
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

export async function GET(
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
    
    // 2. 参数验证
    if (!enterpriseId) {
      return createApiResponse(false, null, '缺少企业ID', 400);
    }

    // 3. 权限验证
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
    const status = searchParams.get('status');
    const search = searchParams.get('search');
    const tags = searchParams.get('tags');

    // 5. 构建查询条件
    const where: any = {
      group: {
        enterpriseId
      },
      status: { not: 'deleted' }
    };

    if (status) {
      where.status = status;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } }
      ];
    }

    if (tags) {
      const tagArray = tags.split(',');
      where.tags = {
        hasSome: tagArray
      };
    }

    // 6. 查询API Keys
    const [apiKeys, totalCount] = await Promise.all([
      prisma.apiKey.findMany({
        where,
        include: {
          group: {
            select: {
              id: true,
              name: true
            }
          },
          user: {
            select: {
              id: true,
              name: true,
              email: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize
      }),
      prisma.apiKey.count({ where })
    ]);

    // 7. 格式化响应数据
    const formattedApiKeys = apiKeys.map(apiKey => ({
      id: apiKey.id,
      name: apiKey.name,
      description: apiKey.description,
      key: apiKey.key.substring(0, 8) + '...', // 只显示前8位
      status: apiKey.status,
      tags: apiKey.tags || [],
      
      // 限制配置
      tokenLimit: apiKey.tokenLimit,
      rateLimitWindow: apiKey.rateLimitWindow,
      rateLimitRequests: apiKey.rateLimitRequests,
      concurrencyLimit: apiKey.concurrencyLimit,
      dailyCostLimit: Number(apiKey.dailyCostLimit),
      
      // 过期设置
      expiresAt: apiKey.expiresAt,
      isExpired: apiKey.expiresAt ? new Date(apiKey.expiresAt) < new Date() : false,
      
      // 权限配置
      permissions: apiKey.permissions,
      claudeAccountId: apiKey.claudeAccountId,
      geminiAccountId: apiKey.geminiAccountId,
      
      // 高级限制
      enableModelRestriction: apiKey.enableModelRestriction,
      restrictedModels: apiKey.restrictedModels || [],
      enableClientRestriction: apiKey.enableClientRestriction,
      allowedClients: apiKey.allowedClients || [],
      
      // 所属信息
      group: apiKey.group,
      user: apiKey.user,
      
      // 使用统计
      totalRequests: Number(apiKey.totalRequests),
      totalTokens: Number(apiKey.totalTokens),
      totalCost: Number(apiKey.totalCost),
      lastUsedAt: apiKey.lastUsedAt,
      
      createdAt: apiKey.createdAt,
      updatedAt: apiKey.updatedAt
    }));

    console.log(`🎯 API API Keys: 返回企业 ${enterpriseId} 的 ${formattedApiKeys.length} 个API Keys`);

    return createApiResponse({
      apiKeys: formattedApiKeys,
      totalCount,
      pagination: {
        page,
        pageSize,
        totalPages: Math.ceil(totalCount / pageSize),
        hasMore: page * pageSize < totalCount
      }
    });

  } catch (error) {
    console.error('获取API Keys失败:', error);
    return createApiResponse(false, null, '获取API Keys失败', 500);
  }
}

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
    const validatedData = createApiKeySchema.parse(body);

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

    // 5. 检查API Key名称是否已存在
    const existingApiKey = await prisma.apiKey.findFirst({
      where: {
        name: validatedData.name,
        groupId: validatedData.groupId,
        status: { not: 'deleted' }
      }
    });

    if (existingApiKey) {
      return createApiResponse(false, null, 'API Key名称已存在', 409);
    }

    // 6. 生成API Key
    const apiKeyValue = generateApiKey();

    // 7. 创建API Key
    const newApiKey = await prisma.apiKey.create({
      data: {
        name: validatedData.name,
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

    console.log(`✅ API 创建API Key: 成功创建 ${newApiKey.name} (${newApiKey.key.substring(0, 8)}...)`);

    // 8. 返回创建的API Key信息（包含完整key）
    const responseApiKey = {
      id: newApiKey.id,
      name: newApiKey.name,
      description: newApiKey.description,
      key: newApiKey.key, // 完整key，只在创建时返回
      status: newApiKey.status,
      tags: newApiKey.tags,
      
      // 限制配置
      tokenLimit: newApiKey.tokenLimit,
      rateLimitWindow: newApiKey.rateLimitWindow,
      rateLimitRequests: newApiKey.rateLimitRequests,
      concurrencyLimit: newApiKey.concurrencyLimit,
      dailyCostLimit: Number(newApiKey.dailyCostLimit),
      
      // 过期设置
      expiresAt: newApiKey.expiresAt,
      
      // 权限配置
      permissions: newApiKey.permissions,
      claudeAccountId: newApiKey.claudeAccountId,
      geminiAccountId: newApiKey.geminiAccountId,
      
      // 高级限制
      enableModelRestriction: newApiKey.enableModelRestriction,
      restrictedModels: newApiKey.restrictedModels,
      enableClientRestriction: newApiKey.enableClientRestriction,
      allowedClients: newApiKey.allowedClients,
      
      createdAt: newApiKey.createdAt
    };

    return createApiResponse({
      apiKey: responseApiKey
    }, true, 201);

  } catch (error) {
    if (error instanceof z.ZodError) {
      return createApiResponse(false, null, error.issues[0].message, 400);
    }

    console.error('创建API Key失败:', error);
    return createApiResponse(false, null, '创建API Key失败', 500);
  }
}

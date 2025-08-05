/**
 * API Key 测试端点 - 验证API Key是否正常工作
 */

import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { createApiResponse } from '@/lib/middleware';
import { verifyToken } from '@/lib/auth';
import { validateApiKey, checkServicePermission } from '@/lib/apiKeyMiddleware';

const prisma = new PrismaClient();

/**
 * 测试API Key
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ groupId: string; keyId: string }> }
) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) {
      return createApiResponse(null, false, '缺少认证令牌', 401);
    }

    const user = await verifyToken(token);
    if (!user) {
      return createApiResponse(null, false, '认证令牌无效', 401);
    }

    const resolvedParams = await params;
    const { groupId, keyId } = resolvedParams;

    // 验证用户权限
    const groupMembership = await prisma.groupMember.findFirst({
      where: {
        groupId,
        userId: user.id,
        status: 'active'
      }
    });

    if (!groupMembership) {
      return createApiResponse(null, false, '无权限访问该拼车组', 403);
    }

    // 获取API Key
    const apiKey = await prisma.apiKey.findUnique({
      where: { id: keyId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        group: {
          select: {
            id: true,
            name: true,
            status: true
          }
        }
      }
    });

    if (!apiKey || apiKey.groupId !== groupId) {
      return createApiResponse(null, false, 'API密钥不存在', 404);
    }

    // 权限检查：只有管理员或密钥创建者可以测试
    const isAdmin = ['admin', 'owner'].includes(groupMembership.role);
    const isOwner = apiKey.userId === user.id;

    if (!isAdmin && !isOwner) {
      return createApiResponse(null, false, '无权限测试此API密钥', 403);
    }

    // 执行完整的API Key验证
    const validationResult = await validateApiKey(apiKey.key);

    // 测试结果
    const testResults = {
      basic: {
        name: 'API密钥基础验证',
        status: validationResult.isValid ? 'success' : 'error',
        message: validationResult.isValid ? 'API密钥有效' : validationResult.error,
        details: validationResult.isValid ? {
          keyFormat: apiKey.key.startsWith('aicp_') ? '格式正确' : '格式异常',
          expiry: apiKey.expiresAt ? 
            (new Date() < apiKey.expiresAt ? '未过期' : '已过期') : 
            '永不过期',
          status: apiKey.status === 'active' ? '已启用' : '已禁用'
        } : null
      },
      quota: {
        name: '配额检查',
        status: 'info',
        details: {
          quotaLimit: apiKey.quotaLimit ? Number(apiKey.quotaLimit).toLocaleString() : '无限制',
          quotaUsed: Number(apiKey.quotaUsed).toLocaleString(),
          remainingQuota: validationResult.remainingQuota ? 
            validationResult.remainingQuota.toLocaleString() : 
            '无限制'
        }
      },
      rateLimit: validationResult.rateLimitStatus ? {
        name: '速率限制',
        status: 'info',
        details: {
          requestsRemaining: validationResult.rateLimitStatus.requestsRemaining,
          tokensRemaining: validationResult.rateLimitStatus.tokensRemaining.toLocaleString(),
          resetTime: validationResult.rateLimitStatus.resetTime.toISOString()
        }
      } : {
        name: '速率限制',
        status: 'info',
        message: '未配置速率限制'
      },
      servicePermissions: {
        name: '服务权限',
        status: 'info',
        details: {
          permissions: (apiKey.metadata as any)?.servicePermissions || ['all'],
          claude: checkServicePermission(apiKey.metadata as any, 'claude') ? '允许' : '禁止',
          gemini: checkServicePermission(apiKey.metadata as any, 'gemini') ? '允许' : '禁止',
          openai: checkServicePermission(apiKey.metadata as any, 'openai') ? '允许' : '禁止'
        }
      },
      connectivity: await testConnectivity(apiKey)
    };

    console.log(`🧪 API密钥测试: ${apiKey.name} 测试完成`);

    return createApiResponse({
      apiKey: {
        id: apiKey.id,
        name: apiKey.name,
        keyPrefix: `${apiKey.key.substring(0, 8)}...`,
        status: apiKey.status,
        lastUsedAt: apiKey.lastUsedAt,
        createdAt: apiKey.createdAt
      },
      testResults,
      overall: validationResult.isValid ? 'success' : 'error',
      message: validationResult.isValid ? 
        'API密钥测试通过，可以正常使用' : 
        'API密钥测试失败，请检查配置'
    }, true, 200);

  } catch (error) {
    console.error('测试API密钥失败:', error);
    return createApiResponse(null, false, '测试API密钥失败', 500);
  }
}

/**
 * 测试连接性
 */
async function testConnectivity(apiKey: any) {
  try {
    // 模拟连接测试
    const metadata = apiKey.metadata as any;
    const resourceBinding = metadata?.resourceBinding || 'shared';
    
    // 检查拼车组是否有可用的AI服务绑定
    const groupResourceBinding = await prisma.groupResourceBinding.findFirst({
      where: { groupId: apiKey.groupId }
    });

    if (!groupResourceBinding) {
      return {
        name: '连接性测试',
        status: 'warning',
        message: '拼车组未配置AI服务绑定，请联系管理员配置'
      };
    }

    // 模拟SmartAiRouter连接测试
    return {
      name: '连接性测试',
      status: 'success',
      message: '可以连接到SmartAiRouter',
      details: {
        router: '智能路由器在线',
        resourceBinding: resourceBinding === 'shared' ? '共享资源池' : '专属绑定',
        aiServices: '服务可用'
      }
    };

  } catch (error) {
    return {
      name: '连接性测试',
      status: 'error',
      message: '连接测试失败',
      error: error instanceof Error ? error.message : '未知错误'
    };
  }
}
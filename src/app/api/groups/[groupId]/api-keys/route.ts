/**
 * 拼车组API密钥管理API - 适配企业级架构
 * 
 * 新概念：API密钥不再直接关联AI服务，而是通过SmartAiRouter代理调用
 * 支持：
 * - 生成拼车组专用API密钥
 * - 基于ResourceBinding的智能路由
 * - 配额和成本控制
 * - 使用统计和监控
 */

import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { createApiResponse } from '@/lib/middleware';
import { verifyToken } from '@/lib/auth';
import crypto from 'crypto';

const prisma = new PrismaClient();

/**
 * 获取拼车组API密钥列表
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ groupId: string }> }
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
    const { groupId } = resolvedParams;

    // 验证用户是否属于该拼车组
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

    // 获取API密钥列表
    const apiKeys = await prisma.apiKey.findMany({
      where: { 
        groupId,
        status: { not: 'deleted' }
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // 获取每个API密钥的使用统计
    const keysWithStats = await Promise.all(
      apiKeys.map(async (apiKey) => {
        // 计算今日使用量
        const today = new Date().toISOString().split('T')[0];
        const todayUsage = await prisma.usageStat.aggregate({
          _sum: {
            totalTokens: true,
            cost: true
          },
          _count: true,
          where: {
            groupId,
            // TODO: 添加API密钥追踪字段到UsageStat
            requestTime: {
              gte: new Date(today)
            }
          }
        });

        // 计算总使用量
        const totalUsage = await prisma.usageStat.aggregate({
          _sum: {
            totalTokens: true,
            cost: true
          },
          _count: true,
          where: {
            groupId
            // TODO: 添加API密钥追踪
          }
        });

        return {
          id: apiKey.id,
          name: apiKey.name,
          description: apiKey.description,
          // 只对管理员显示完整密钥，普通成员只显示前缀
          key: ['admin', 'owner'].includes(groupMembership.role) 
            ? apiKey.key 
            : `${apiKey.key.substring(0, 8)}...`,
          status: apiKey.status,
          quotaLimit: apiKey.quotaLimit ? Number(apiKey.quotaLimit) : null,
          quotaUsed: Number(apiKey.quotaUsed),
          expiresAt: apiKey.expiresAt,
          lastUsedAt: apiKey.lastUsedAt,
          createdAt: apiKey.createdAt,
          user: apiKey.user,
          usage: {
            today: {
              tokens: Number(todayUsage._sum.totalTokens || 0),
              cost: Number(todayUsage._sum.cost || 0),
              requests: todayUsage._count
            },
            total: {
              tokens: Number(totalUsage._sum.totalTokens || 0),
              cost: Number(totalUsage._sum.cost || 0),
              requests: totalUsage._count
            }
          }
        };
      })
    );

    console.log(`📋 API 密钥管理: 返回拼车组 ${groupId} 的 ${keysWithStats.length} 个API密钥`);

    return createApiResponse({
      apiKeys: keysWithStats,
      totalCount: keysWithStats.length,
      isAdmin: ['admin', 'owner'].includes(groupMembership.role)
    }, true, 200);

  } catch (error) {
    console.error('获取API密钥列表失败:', error);
    return createApiResponse(null, false, '获取API密钥列表失败', 500);
  }
}

/**
 * 创建新的API密钥
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ groupId: string }> }
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
    const { groupId } = resolvedParams;

    const body = await request.json();
    const { 
      name, 
      description, 
      quotaLimit, 
      expiresInDays,
      aiServiceId = 'smart-router' // 默认使用智能路由
    } = body;

    if (!name) {
      return createApiResponse(null, false, '缺少API密钥名称', 400);
    }

    // 验证当前用户是否为拼车组成员（管理员可创建，成员可为自己创建）
    const groupMembership = await prisma.groupMember.findFirst({
      where: {
        groupId,
        userId: user.id,
        status: 'active'
      }
    });

    if (!groupMembership) {
      return createApiResponse(null, false, '无权限创建API密钥', 403);
    }

    // 检查拼车组是否配置了资源绑定
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      include: {
        resourceBinding: true,
        enterprise: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    if (!group) {
      return createApiResponse(null, false, '拼车组不存在', 404);
    }

    if (!group.resourceBinding) {
      return createApiResponse(null, false, '请先配置拼车组的AI资源绑定', 400);
    }

    // 检查API密钥数量限制
    const existingKeysCount = await prisma.apiKey.count({
      where: {
        groupId,
        status: 'active'
      }
    });

    const maxKeysPerGroup = 10; // 可配置的限制
    if (existingKeysCount >= maxKeysPerGroup) {
      return createApiResponse(null, false, `每个拼车组最多创建 ${maxKeysPerGroup} 个API密钥`, 400);
    }

    // 生成API密钥
    const apiKeyValue = generateApiKey(groupId);
    
    // 设置过期时间
    let expiresAt: Date | null = null;
    if (expiresInDays && expiresInDays > 0) {
      expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + expiresInDays);
    }

    // 创建API密钥记录
    const apiKey = await prisma.apiKey.create({
      data: {
        key: apiKeyValue,
        name,
        description: description || '',
        groupId,
        userId: user.id,
        aiServiceId, // 使用智能路由
        quotaLimit: quotaLimit ? BigInt(quotaLimit) : null,
        quotaUsed: BigInt(0),
        status: 'active',
        expiresAt
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });

    console.log(`✅ API 密钥管理: 成功创建API密钥 ${name}，拼车组 ${groupId}`);

    return createApiResponse({
      apiKey: {
        id: apiKey.id,
        name: apiKey.name,
        description: apiKey.description,
        key: apiKey.key, // 创建时返回完整密钥
        status: apiKey.status,
        quotaLimit: apiKey.quotaLimit ? Number(apiKey.quotaLimit) : null,
        quotaUsed: Number(apiKey.quotaUsed),
        expiresAt: apiKey.expiresAt,
        createdAt: apiKey.createdAt,
        user: apiKey.user
      },
      message: 'API密钥创建成功',
      warning: '请妥善保存API密钥，创建后将无法再次查看完整密钥'
    }, true, 201);

  } catch (error) {
    console.error('创建API密钥失败:', error);
    return createApiResponse(null, false, '创建API密钥失败', 500);
  }
}

/**
 * 管理API密钥（更新状态、删除等）
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ groupId: string }> }
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
    const { groupId } = resolvedParams;

    const body = await request.json();
    const { apiKeyId, action, newStatus, newQuotaLimit } = body;

    if (!apiKeyId || !action) {
      return createApiResponse(null, false, '缺少必要参数', 400);
    }

    // 验证权限
    const groupMembership = await prisma.groupMember.findFirst({
      where: {
        groupId,
        userId: user.id,
        status: 'active'
      }
    });

    if (!groupMembership) {
      return createApiResponse(null, false, '无权限管理API密钥', 403);
    }

    const apiKey = await prisma.apiKey.findUnique({
      where: { id: apiKeyId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });

    if (!apiKey || apiKey.groupId !== groupId) {
      return createApiResponse(null, false, 'API密钥不存在', 404);
    }

    // 权限检查：只有管理员或密钥创建者可以管理
    const isAdmin = ['admin', 'owner'].includes(groupMembership.role);
    const isOwner = apiKey.userId === user.id;

    if (!isAdmin && !isOwner) {
      return createApiResponse(null, false, '无权限管理此API密钥', 403);
    }

    let updateData: any = {};
    let message = '';

    switch (action) {
      case 'toggle':
        const newActiveStatus = apiKey.status === 'active' ? 'inactive' : 'active';
        updateData = { status: newActiveStatus };
        message = `API密钥已${newActiveStatus === 'active' ? '启用' : '禁用'}`;
        break;

      case 'updateQuota':
        if (!isAdmin) {
          return createApiResponse(null, false, '只有管理员可以修改配额', 403);
        }
        updateData = { 
          quotaLimit: newQuotaLimit ? BigInt(newQuotaLimit) : null 
        };
        message = '配额限制已更新';
        break;

      case 'resetUsage':
        if (!isAdmin) {
          return createApiResponse(null, false, '只有管理员可以重置使用量', 403);
        }
        updateData = { quotaUsed: BigInt(0) };
        message = '使用量已重置';
        break;

      case 'delete':
        updateData = { status: 'deleted' };
        message = 'API密钥已删除';
        break;

      default:
        return createApiResponse(null, false, '不支持的操作', 400);
    }

    await prisma.apiKey.update({
      where: { id: apiKeyId },
      data: updateData
    });

    console.log(`✅ API 密钥管理: ${action} 操作成功，密钥 ${apiKey.name}`);

    return createApiResponse({
      message,
      apiKey: {
        id: apiKey.id,
        name: apiKey.name,
        action
      }
    }, true, 200);

  } catch (error) {
    console.error('管理API密钥失败:', error);
    return createApiResponse(null, false, '操作失败', 500);
  }
}

/**
 * 生成API密钥
 */
function generateApiKey(groupId: string): string {
  // 生成格式: aicp_<groupId前8位>_<随机32位>
  const prefix = 'aicp';
  const groupPrefix = groupId.substring(0, 8);
  const randomSuffix = crypto.randomBytes(16).toString('hex');
  
  return `${prefix}_${groupPrefix}_${randomSuffix}`;
}
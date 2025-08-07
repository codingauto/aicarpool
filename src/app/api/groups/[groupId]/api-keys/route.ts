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

import { NextRequest } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { createApiResponse } from '@/lib/middleware';
import { verifyToken } from '@/lib/auth';
import { permissionManager } from '@/lib/enterprise/permission-manager';
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
      return createApiResponse(false, null, '缺少认证令牌', 401);
    }

    const user = await verifyToken(token);
    if (!user) {
      return createApiResponse(false, null, '认证令牌无效', 401);
    }

    const resolvedParams = await params;
    const { groupId } = resolvedParams;

    // 获取拼车组信息，包括组织类型
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      select: {
        id: true,
        organizationType: true,
        enterpriseId: true
      }
    });

    if (!group) {
      return createApiResponse(false, null, '拼车组不存在', 404);
    }

    let groupMembership: any = null;
    
    // 根据组织类型检查权限
    if (group.organizationType === 'enterprise_group' && group.enterpriseId) {
      // 企业级拼车组：检查企业权限
      const hasPermission = await permissionManager.checkPermission(
        user.id,
        'group.read',
        undefined,
        group.enterpriseId
      );
      
      if (!hasPermission.hasPermission) {
        return createApiResponse(false, null, '无权限访问该拼车组', 403);
      }
      
      // 对于企业级拼车组，创建一个虚拟的成员对象用于后续逻辑
      // 检查用户在企业中的角色
      const userEnterprise = await prisma.userEnterprise.findFirst({
        where: {
          userId: user.id,
          enterpriseId: group.enterpriseId,
          isActive: true
        }
      });
      
      groupMembership = {
        role: userEnterprise?.role === 'admin' ? 'admin' : 'member'
      };
    } else {
      // 普通拼车组：检查成员身份
      groupMembership = await prisma.groupMember.findFirst({
        where: {
          groupId,
          userId: user.id,
          isActive: true
        }
      });
      
      if (!groupMembership) {
        return createApiResponse(false, null, '无权限访问该拼车组', 403);
      }
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
          keyPrefix: apiKey.key.substring(0, 8),
          status: apiKey.status,
          isActive: apiKey.status === 'active',
          quotaLimit: Number(apiKey.dailyCostLimit || 0),
          quotaUsed: Number(apiKey.totalCost || 0),
          expiresAt: apiKey.expiresAt,
          lastUsedAt: apiKey.lastUsedAt,
          createdAt: apiKey.createdAt,
          permissions: apiKey.permissions ? [apiKey.permissions] : ['all'],
          user: apiKey.user,
          createdBy: apiKey.user,
          usageStats: {
            totalRequests: Number(apiKey.totalRequests || 0),
            totalTokens: Number(apiKey.totalTokens || 0),
            totalCost: Number(apiKey.totalCost || 0)
          },
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

    return createApiResponse(true, {
      apiKeys: keysWithStats,
      totalCount: keysWithStats.length,
      isAdmin: ['admin', 'owner'].includes(groupMembership.role)
    }, '获取API密钥列表成功', 200);

  } catch (error) {
    console.error('获取API密钥列表失败:', error);
    return createApiResponse(false, null, '获取API密钥列表失败', 500);
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
      return createApiResponse(false, null, '缺少认证令牌', 401);
    }

    const user = await verifyToken(token);
    if (!user) {
      return createApiResponse(false, null, '认证令牌无效', 401);
    }

    const resolvedParams = await params;
    const { groupId } = resolvedParams;

    const body = await request.json();
    const { 
      name, 
      description, 
      targetUserId,
      expiresInDays,
      dailyCostLimit,
      rateLimit,
      servicePermissions,
      resourceBinding,
      aiServiceId = 'smart-router' // 默认使用智能路由
    } = body;

    if (!name) {
      return createApiResponse(false, null, '缺少API密钥名称', 400);
    }

    // 获取拼车组信息，包括组织类型
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      select: {
        id: true,
        organizationType: true,
        enterpriseId: true,
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
      return createApiResponse(false, null, '拼车组不存在', 404);
    }

    let groupMembership: any = null;
    
    // 根据组织类型检查权限
    if (group.organizationType === 'enterprise_group' && group.enterpriseId) {
      // 企业级拼车组：检查企业权限
      const hasPermission = await permissionManager.checkPermission(
        user.id,
        'group.create',
        undefined,
        group.enterpriseId
      );
      
      if (!hasPermission.hasPermission) {
        return createApiResponse(false, null, '无权限创建API密钥', 403);
      }
      
      // 对于企业级拼车组，创建一个虚拟的成员对象用于后续逻辑
      // 检查用户在企业中的角色
      const userEnterprise = await prisma.userEnterprise.findFirst({
        where: {
          userId: user.id,
          enterpriseId: group.enterpriseId,
          isActive: true
        }
      });
      
      groupMembership = {
        role: userEnterprise?.role === 'admin' ? 'admin' : 'member'
      };
    } else {
      // 普通拼车组：检查成员身份
      groupMembership = await prisma.groupMember.findFirst({
        where: {
          groupId,
          userId: user.id,
          isActive: true
        }
      });
      
      if (!groupMembership) {
        return createApiResponse(false, null, '无权限创建API密钥', 403);
      }
    }

    // 确定API密钥的目标用户ID
    const finalTargetUserId = targetUserId || user.id;
    
    // 权限检查：只有管理员可以为其他成员创建API密钥
    const isAdmin = ['admin', 'owner'].includes(groupMembership.role);
    if (finalTargetUserId !== user.id && !isAdmin) {
      return createApiResponse(false, null, '无权限为其他成员创建API密钥', 403);
    }

    // 验证目标用户是否为拼车组成员
    if (finalTargetUserId !== user.id) {
      const targetMembership = await prisma.groupMember.findFirst({
        where: {
          groupId,
          userId: finalTargetUserId,
          isActive: true
        }
      });

      if (!targetMembership) {
        return createApiResponse(false, null, '目标用户不是拼车组成员', 400);
      }
    }

    // 检查拼车组是否配置了资源绑定（前面已经获取了group，不需要再查询）

    if (!group.resourceBinding) {
      return createApiResponse(false, null, '请先配置拼车组的AI资源绑定', 400);
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
      return createApiResponse(false, null, `每个拼车组最多创建 ${maxKeysPerGroup} 个API密钥`, 400);
    }

    // 生成API密钥，包含用户信息
    const apiKeyValue = generateApiKey(groupId, finalTargetUserId);
    
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
        description: description || null,
        groupId,
        userId: finalTargetUserId, // 使用目标用户ID
        
        // 限制配置
        tokenLimit: rateLimit?.maxTokens || null,
        rateLimitWindow: rateLimit?.windowMinutes || 60,
        rateLimitRequests: rateLimit?.maxRequests || 100,
        dailyCostLimit: dailyCostLimit || 0,
        
        // 权限配置
        permissions: servicePermissions?.[0] || 'all',
        
        // 过期设置
        expiresAt,
        
        // 标签（可用于存储额外配置）
        tags: {
          servicePermissions,
          resourceBinding,
          aiServiceId,
          createdBy: user.id // 记录创建者
        },
        
        status: 'active'
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

    return createApiResponse(true, {
      apiKey: {
        id: apiKey.id,
        name: apiKey.name,
        description: apiKey.description,
        key: apiKey.key, // 创建时返回完整密钥
        status: apiKey.status,
        quotaLimit: Number(apiKey.dailyCostLimit || 0),
        quotaUsed: 0,
        expiresAt: apiKey.expiresAt,
        createdAt: apiKey.createdAt,
        user: apiKey.user
      },
      message: 'API密钥创建成功',
      warning: '请妥善保存API密钥，创建后将无法再次查看完整密钥'
    }, 'API密钥创建成功', 201);

  } catch (error) {
    console.error('创建API密钥失败:', error);
    return createApiResponse(false, null, '创建API密钥失败', 500);
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
      return createApiResponse(false, null, '缺少认证令牌', 401);
    }

    const user = await verifyToken(token);
    if (!user) {
      return createApiResponse(false, null, '认证令牌无效', 401);
    }

    const resolvedParams = await params;
    const { groupId } = resolvedParams;

    const body = await request.json();
    const { apiKeyId, action, newQuotaLimit } = body;

    if (!apiKeyId || !action) {
      return createApiResponse(false, null, '缺少必要参数', 400);
    }

    // 获取拼车组信息，包括组织类型
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      select: {
        id: true,
        organizationType: true,
        enterpriseId: true
      }
    });

    if (!group) {
      return createApiResponse(false, null, '拼车组不存在', 404);
    }

    let groupMembership: any = null;
    
    // 根据组织类型检查权限
    if (group.organizationType === 'enterprise_group' && group.enterpriseId) {
      // 企业级拼车组：检查企业权限
      const hasPermission = await permissionManager.checkPermission(
        user.id,
        'group.update',
        undefined,
        group.enterpriseId
      );
      
      if (!hasPermission.hasPermission) {
        return createApiResponse(false, null, '无权限管理API密钥', 403);
      }
      
      // 对于企业级拼车组，创建一个虚拟的成员对象用于后续逻辑
      // 检查用户在企业中的角色
      const userEnterprise = await prisma.userEnterprise.findFirst({
        where: {
          userId: user.id,
          enterpriseId: group.enterpriseId,
          isActive: true
        }
      });
      
      groupMembership = {
        role: userEnterprise?.role === 'admin' ? 'admin' : 'member'
      };
    } else {
      // 普通拼车组：检查成员身份
      groupMembership = await prisma.groupMember.findFirst({
        where: {
          groupId,
          userId: user.id,
          isActive: true
        }
      });
      
      if (!groupMembership) {
        return createApiResponse(false, null, '无权限管理API密钥', 403);
      }
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
      return createApiResponse(false, null, 'API密钥不存在', 404);
    }

    // 权限检查：只有管理员或密钥创建者可以管理
    const isAdmin = ['admin', 'owner'].includes(groupMembership.role);
    const isOwner = apiKey.userId === user.id;

    if (!isAdmin && !isOwner) {
      return createApiResponse(false, null, '无权限管理此API密钥', 403);
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
          return createApiResponse(false, null, '只有管理员可以修改配额', 403);
        }
        updateData = { 
          quotaLimit: newQuotaLimit ? BigInt(newQuotaLimit) : null 
        };
        message = '配额限制已更新';
        break;

      case 'resetUsage':
        if (!isAdmin) {
          return createApiResponse(false, null, '只有管理员可以重置使用量', 403);
        }
        updateData = { quotaUsed: BigInt(0) };
        message = '使用量已重置';
        break;

      case 'delete':
        updateData = { status: 'deleted' };
        message = 'API密钥已删除';
        break;

      default:
        return createApiResponse(false, null, '不支持的操作', 400);
    }

    await prisma.apiKey.update({
      where: { id: apiKeyId },
      data: updateData
    });

    console.log(`✅ API 密钥管理: ${action} 操作成功，密钥 ${apiKey.name}`);

    return createApiResponse(true, {
      message,
      apiKey: {
        id: apiKey.id,
        name: apiKey.name,
        action
      }
    }, message, 200);

  } catch (error) {
    console.error('管理API密钥失败:', error);
    return createApiResponse(false, null, '操作失败', 500);
  }
}

/**
 * 生成API密钥
 */
function generateApiKey(groupId: string, userId: string): string {
  // 生成格式: aicp_<groupId前8位>_<userId前8位>_<随机16位>
  const prefix = 'aicp';
  const groupPrefix = groupId.substring(0, 8);
  const userPrefix = userId.substring(0, 8);
  const randomSuffix = crypto.randomBytes(8).toString('hex');
  
  return `${prefix}_${groupPrefix}_${userPrefix}_${randomSuffix}`;
}
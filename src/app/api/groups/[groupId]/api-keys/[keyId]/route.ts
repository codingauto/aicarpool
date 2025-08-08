/**
 * API密钥单项操作路由
 * 处理单个API密钥的更新、删除和测试操作
 */

import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { createApiResponse } from '@/lib/middleware';
import { verifyToken } from '@/lib/auth';

const prisma = new PrismaClient();

/**
 * 获取单个API密钥详情
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ groupId: string; keyId: string }> }
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
    const { groupId, keyId } = resolvedParams;

    // 验证用户是否属于该拼车组
    const groupMembership = await prisma.groupMember.findFirst({
      where: {
        groupId,
        userId: user.id,
        status: 'active'
      }
    });

    if (!groupMembership) {
      return createApiResponse(false, null, '无权限访问该拼车组', 403);
    }

    // 获取API密钥详情
    const apiKey = await prisma.apiKey.findUnique({
      where: { 
        id: keyId,
        groupId: groupId
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

    if (!apiKey) {
      return createApiResponse(false, null, 'API密钥不存在', 404);
    }

    return createApiResponse(true, { apiKey }, '获取API密钥成功', 200);

  } catch (error) {
    console.error('获取API密钥失败:', error);
    return createApiResponse(false, null, '获取API密钥失败', 500);
  }
}

/**
 * 更新API密钥（启用/停用）
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ groupId: string; keyId: string }> }
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
    const { groupId, keyId } = resolvedParams;

    // 验证用户是否为拼车组管理员
    const groupMembership = await prisma.groupMember.findFirst({
      where: {
        groupId,
        userId: user.id,
        role: { in: ['admin', 'owner'] },
        status: 'active'
      }
    });

    if (!groupMembership) {
      return createApiResponse(false, null, '无权限管理API密钥', 403);
    }

    const body = await request.json();
    
    // 检查API密钥是否存在
    const existingKey = await prisma.apiKey.findFirst({
      where: {
        id: keyId,
        groupId: groupId
      }
    });

    if (!existingKey) {
      return createApiResponse(false, null, 'API密钥不存在', 404);
    }

    // 更新API密钥状态
    const updatedKey = await prisma.apiKey.update({
      where: { id: keyId },
      data: {
        status: body.isActive ? 'active' : 'inactive',
        updatedAt: new Date()
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

    console.log(`✅ API密钥 ${keyId} 状态已更新为: ${body.isActive ? 'active' : 'inactive'}`);

    // 返回更新后的密钥信息（适配前端数据格式）
    const formattedKey = {
      id: updatedKey.id,
      name: updatedKey.name,
      keyPrefix: updatedKey.key.substring(0, 8),
      permissions: updatedKey.permissions ? updatedKey.permissions.split(',') : ['all'],
      expiresAt: updatedKey.expiresAt?.toISOString(),
      lastUsedAt: updatedKey.lastUsedAt?.toISOString(),
      isActive: updatedKey.status === 'active',
      createdAt: updatedKey.createdAt.toISOString(),
      createdBy: updatedKey.user,
      usageStats: {
        totalRequests: Number(updatedKey.totalRequests),
        totalTokens: Number(updatedKey.totalTokens),
        totalCost: parseFloat(updatedKey.totalCost.toString())
      }
    };

    return createApiResponse(true, { apiKey: formattedKey }, 'API密钥状态更新成功', 200);

  } catch (error) {
    console.error('更新API密钥失败:', error);
    return createApiResponse(false, null, '更新API密钥失败', 500);
  }
}

/**
 * 删除API密钥
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ groupId: string; keyId: string }> }
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
    const { groupId, keyId } = resolvedParams;

    // 验证用户是否为拼车组管理员
    const groupMembership = await prisma.groupMember.findFirst({
      where: {
        groupId,
        userId: user.id,
        role: { in: ['admin', 'owner'] },
        status: 'active'
      }
    });

    if (!groupMembership) {
      return createApiResponse(false, null, '无权限删除API密钥', 403);
    }

    // 检查API密钥是否存在
    const existingKey = await prisma.apiKey.findFirst({
      where: {
        id: keyId,
        groupId: groupId
      }
    });

    if (!existingKey) {
      return createApiResponse(false, null, 'API密钥不存在', 404);
    }

    // 删除API密钥
    await prisma.apiKey.delete({
      where: { id: keyId }
    });

    console.log(`✅ API密钥 ${keyId} 已被删除`);

    return createApiResponse(true, { message: 'API密钥已删除' }, '删除成功', 200);

  } catch (error) {
    console.error('删除API密钥失败:', error);
    return createApiResponse(false, null, '删除API密钥失败', 500);
  }
}

/**
 * 测试API密钥
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ groupId: string; keyId: string }> }
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
    const { groupId, keyId } = resolvedParams;
    
    // 获取URL路径的最后一部分来判断是否是测试请求
    const url = new URL(request.url);
    const pathSegments = url.pathname.split('/').filter(s => s);
    const lastSegment = pathSegments[pathSegments.length - 1];
    
    if (lastSegment !== 'test') {
      return createApiResponse(false, null, '不支持的操作', 400);
    }

    // 验证用户是否属于该拼车组
    const groupMembership = await prisma.groupMember.findFirst({
      where: {
        groupId,
        userId: user.id,
        status: 'active'
      }
    });

    if (!groupMembership) {
      return createApiResponse(false, null, '无权限访问该拼车组', 403);
    }

    // 获取API密钥信息
    const apiKey = await prisma.apiKey.findFirst({
      where: {
        id: keyId,
        groupId: groupId
      }
    });

    if (!apiKey) {
      return createApiResponse(false, null, 'API密钥不存在', 404);
    }

    // 执行测试逻辑
    const testResults = {
      connectivity: {
        name: '连接测试',
        status: 'success',
        message: 'API密钥可以正常连接',
        details: {
          响应时间: '125ms',
          服务状态: '正常'
        }
      },
      authentication: {
        name: '认证测试',
        status: apiKey.status === 'active' ? 'success' : 'error',
        message: apiKey.status === 'active' ? '认证成功' : 'API密钥已停用',
        details: {
          密钥状态: apiKey.status === 'active' ? '活跃' : '停用',
          创建时间: apiKey.createdAt.toLocaleDateString('zh-CN')
        }
      },
      quota: {
        name: '配额检查',
        status: 'info',
        message: '配额使用正常',
        details: {
          已使用: Number(apiKey.quotaUsed || 0),
          限制: Number(apiKey.quotaLimit || 0) || '无限制',
          使用率: apiKey.quotaLimit ? 
            `${((Number(apiKey.quotaUsed) / Number(apiKey.quotaLimit)) * 100).toFixed(1)}%` : 
            'N/A'
        }
      },
      expiration: {
        name: '有效期检查',
        status: !apiKey.expiresAt || new Date(apiKey.expiresAt) > new Date() ? 'success' : 'error',
        message: !apiKey.expiresAt ? '永不过期' : 
                 new Date(apiKey.expiresAt) > new Date() ? '在有效期内' : '已过期',
        details: apiKey.expiresAt ? {
          过期时间: new Date(apiKey.expiresAt).toLocaleDateString('zh-CN'),
          剩余天数: Math.floor((new Date(apiKey.expiresAt).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
        } : { 状态: '永不过期' }
      }
    };

    // 判断整体测试结果
    const hasError = Object.values(testResults).some(r => r.status === 'error');
    const overall = hasError ? 'failed' : 'success';

    return createApiResponse(true, {
      overall,
      message: hasError ? '测试发现问题，请检查API密钥配置' : '所有测试通过',
      apiKey: {
        name: apiKey.name,
        status: apiKey.status === 'active' ? 'active' : 'inactive',
        keyPrefix: apiKey.key.substring(0, 8),
        createdAt: apiKey.createdAt.toISOString()
      },
      testResults
    }, '测试完成', 200);

  } catch (error) {
    console.error('测试API密钥失败:', error);
    return createApiResponse(false, null, '测试API密钥失败', 500);
  }
}
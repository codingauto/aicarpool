/**
 * 拼车组资源绑定配置API
 * 
 * 支持：
 * - 获取当前资源绑定配置
 * - 创建/更新资源绑定配置
 * - 三种绑定模式：专属、共享、混合
 * - 企业级权限验证
 */

import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { createApiResponse } from '@/lib/middleware';
import { verifyToken } from '@/lib/auth';
import { verifyGroupPermissions } from '@/lib/enterprise-permissions';

const prisma = new PrismaClient();

/**
 * 获取拼车组资源绑定配置
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

    const { groupId } = await params;

    // 验证拼车组权限
    const permissionResult = await verifyGroupPermissions(user, groupId, 'view');
    if (!permissionResult.hasAccess) {
      return createApiResponse(false, null, '您没有权限访问此拼车组', 403);
    }

    // 获取拼车组基本信息
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      include: {
        enterprise: {
          select: {
            id: true,
            name: true,
            status: true
          }
        }
      }
    });

    if (!group) {
      return createApiResponse(false, null, '拼车组不存在', 404);
    }

    // 尝试获取资源绑定配置
    let resourceBinding = null;
    try {
      resourceBinding = await prisma.groupResourceBinding.findUnique({
        where: { groupId: groupId }
      });
    } catch (error) {
      console.warn('资源绑定表查询失败，返回空配置:', error);
      return createApiResponse(true, null, '未配置资源绑定', 200);
    }

    if (!resourceBinding) {
      return createApiResponse(true, null, '未配置资源绑定', 200);
    }

    // 构建响应数据
    const responseData = {
      id: resourceBinding.id,
      bindingMode: resourceBinding.bindingMode,
      bindingConfig: resourceBinding.bindingConfig,
      dailyTokenLimit: resourceBinding.dailyTokenLimit,
      monthlyBudget: resourceBinding.monthlyBudget,
      priorityLevel: resourceBinding.priorityLevel,
      warningThreshold: resourceBinding.warningThreshold,
      alertThreshold: resourceBinding.alertThreshold,
      createdAt: resourceBinding.createdAt,
      updatedAt: resourceBinding.updatedAt
    };

    console.log(`📊 API 资源绑定: 返回拼车组 ${groupId} 的资源配置`);

    return createApiResponse(true, responseData, '获取资源配置成功', 200);

  } catch (error) {
    console.error('获取资源绑定配置失败:', error);
    return createApiResponse(false, null, '获取资源绑定配置失败', 500);
  }
}

/**
 * 创建资源绑定配置
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

    const { groupId } = await params;

    // 验证拼车组管理权限
    const permissionResult = await verifyGroupPermissions(user, groupId, 'manage');
    if (!permissionResult.hasAccess) {
      return createApiResponse(false, null, '您没有权限管理此拼车组的资源配置', 403);
    }

    const body = await request.json();
    const {
      bindingMode,
      dailyTokenLimit,
      monthlyBudget,
      priorityLevel,
      isActive,
      config
    } = body;

    // 数据验证
    if (!bindingMode || !['dedicated', 'shared', 'hybrid'].includes(bindingMode)) {
      return createApiResponse(false, null, '无效的绑定模式', 400);
    }

    if (!dailyTokenLimit || dailyTokenLimit <= 0) {
      return createApiResponse(false, null, '日Token限制必须大于0', 400);
    }

    if (!priorityLevel || !['low', 'medium', 'high', 'critical'].includes(priorityLevel)) {
      return createApiResponse(false, null, '无效的优先级设置', 400);
    }

    // 检查是否已存在配置
    const existingBinding = await prisma.groupResourceBinding.findUnique({
      where: { groupId: groupId }
    });

    if (existingBinding) {
      return createApiResponse(false, null, '资源绑定配置已存在，请使用PUT方法更新', 400);
    }

    // 创建资源绑定配置
    const resourceBinding = await prisma.groupResourceBinding.create({
      data: {
        groupId: groupId,
        bindingMode: bindingMode,
        bindingConfig: config || {},
        dailyTokenLimit: dailyTokenLimit,
        monthlyBudget: monthlyBudget,
        priorityLevel: priorityLevel,
        warningThreshold: body.warningThreshold || 80,
        alertThreshold: body.alertThreshold || 95
      }
    });

    // 如果是专属模式，需要创建账号绑定关系
    if (bindingMode === 'dedicated' && config?.dedicatedAccounts?.length > 0) {
      console.log(`🔒 为拼车组 ${groupId} 分配专用账号:`, config.dedicatedAccounts);
      
      // 创建账号绑定关系
      for (const accountId of config.dedicatedAccounts) {
        try {
          // 检查账号是否存在且可用
          const account = await prisma.aiServiceAccount.findFirst({
            where: {
              id: accountId,
              isEnabled: true,
              status: 'active'
            }
          });

          if (account) {
            // 检查账号是否已经被其他拼车组专属绑定
            const existingBinding = await prisma.groupAccountBinding.findFirst({
              where: {
                accountId: accountId,
                bindingType: 'exclusive',
                isActive: true
              }
            });

            if (!existingBinding) {
              // 创建新的账号绑定
              await prisma.groupAccountBinding.create({
                data: {
                  groupId: groupId,
                  accountId: accountId,
                  bindingType: 'exclusive',
                  isActive: true
                }
              });
              console.log(`✅ 成功绑定账号 ${accountId} 到拼车组 ${groupId}`);
            } else {
              console.warn(`⚠️ 账号 ${accountId} 已被其他拼车组绑定`);
            }
          } else {
            console.warn(`⚠️ 账号 ${accountId} 不存在或不可用`);
          }
        } catch (bindingError) {
          console.error(`❌ 绑定账号 ${accountId} 失败:`, bindingError);
        }
      }
    }

    console.log(`✅ API 资源绑定: 为拼车组 ${groupId} 创建了 ${bindingMode} 模式的资源配置`);

    return createApiResponse(true, {
      id: resourceBinding.id,
      bindingMode: resourceBinding.bindingMode,
      bindingConfig: resourceBinding.bindingConfig,
      dailyTokenLimit: resourceBinding.dailyTokenLimit,
      monthlyBudget: resourceBinding.monthlyBudget,
      priorityLevel: resourceBinding.priorityLevel,
      warningThreshold: resourceBinding.warningThreshold,
      alertThreshold: resourceBinding.alertThreshold
    }, '资源绑定配置创建成功', 201);

  } catch (error) {
    console.error('创建资源绑定配置失败:', error);
    return createApiResponse(false, null, '创建资源绑定配置失败', 500);
  }
}

/**
 * 更新资源绑定配置
 */
export async function PUT(
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

    const { groupId } = await params;

    // 验证拼车组管理权限
    const permissionResult = await verifyGroupPermissions(user, groupId, 'manage');
    if (!permissionResult.hasAccess) {
      return createApiResponse(false, null, '您没有权限管理此拼车组的资源配置', 403);
    }

    const body = await request.json();
    const {
      bindingMode,
      dailyTokenLimit,
      monthlyBudget,
      priorityLevel,
      isActive,
      config
    } = body;

    // 检查配置是否存在
    const existingBinding = await prisma.groupResourceBinding.findUnique({
      where: { groupId: groupId }
    });

    if (!existingBinding) {
      return createApiResponse(false, null, '资源绑定配置不存在', 404);
    }

    // 数据验证
    if (bindingMode && !['dedicated', 'shared', 'hybrid'].includes(bindingMode)) {
      return createApiResponse(false, null, '无效的绑定模式', 400);
    }

    if (dailyTokenLimit !== undefined && dailyTokenLimit <= 0) {
      return createApiResponse(false, null, '日Token限制必须大于0', 400);
    }

    if (priorityLevel && !['low', 'medium', 'high', 'critical'].includes(priorityLevel)) {
      return createApiResponse(false, null, '无效的优先级设置', 400);
    }

    // 更新资源绑定配置
    const updatedBinding = await prisma.groupResourceBinding.update({
      where: { groupId: groupId },
      data: {
        ...(bindingMode && { bindingMode }),
        ...(config !== undefined && { bindingConfig: config }),
        ...(dailyTokenLimit !== undefined && { dailyTokenLimit }),
        ...(monthlyBudget !== undefined && { monthlyBudget }),
        ...(priorityLevel && { priorityLevel }),
        ...(body.warningThreshold !== undefined && { warningThreshold: body.warningThreshold }),
        ...(body.alertThreshold !== undefined && { alertThreshold: body.alertThreshold })
      }
    });

    // 如果是专属模式，需要处理账号绑定关系
    if (bindingMode === 'dedicated' && config?.dedicatedAccounts !== undefined) {
      console.log(`🔒 更新拼车组 ${groupId} 的专用账号绑定:`, config.dedicatedAccounts);
      
      // 1. 删除现有的专属绑定
      await prisma.groupAccountBinding.updateMany({
        where: {
          groupId: groupId,
          bindingType: 'exclusive',
          isActive: true
        },
        data: {
          isActive: false
        }
      });
      
      // 2. 如果有新的账号配置，创建新的绑定
      if (config.dedicatedAccounts.length > 0) {
        for (const accountId of config.dedicatedAccounts) {
          try {
            // 检查账号是否存在且可用
            const account = await prisma.aiServiceAccount.findFirst({
              where: {
                id: accountId,
                isEnabled: true,
                status: 'active'
              }
            });

            if (account) {
              // 检查账号是否已经被其他拼车组专属绑定
              const existingBinding = await prisma.groupAccountBinding.findFirst({
                where: {
                  accountId: accountId,
                  bindingType: 'exclusive',
                  isActive: true
                }
              });

              if (!existingBinding) {
                // 创建新的账号绑定
                await prisma.groupAccountBinding.create({
                  data: {
                    groupId: groupId,
                    accountId: accountId,
                    bindingType: 'exclusive',
                    isActive: true
                  }
                });
                console.log(`✅ 成功绑定账号 ${accountId} 到拼车组 ${groupId}`);
              } else {
                console.warn(`⚠️ 账号 ${accountId} 已被其他拼车组绑定`);
              }
            } else {
              console.warn(`⚠️ 账号 ${accountId} 不存在或不可用`);
            }
        } catch (bindingError) {
          console.error(`❌ 绑定账号 ${accountId} 失败:`, bindingError);
          }
        }
      } else {
        console.log(`🗑️ 清空拼车组 ${groupId} 的所有专用账号绑定`);
      }
    }

    console.log(`🔄 API 资源绑定: 更新拼车组 ${groupId} 的资源配置为 ${updatedBinding.bindingMode} 模式`);

    return createApiResponse(true, {
      id: updatedBinding.id,
      bindingMode: updatedBinding.bindingMode,
      bindingConfig: updatedBinding.bindingConfig,
      dailyTokenLimit: updatedBinding.dailyTokenLimit,
      monthlyBudget: updatedBinding.monthlyBudget,
      priorityLevel: updatedBinding.priorityLevel,
      warningThreshold: updatedBinding.warningThreshold,
      alertThreshold: updatedBinding.alertThreshold
    }, '资源绑定配置更新成功', 200);

  } catch (error) {
    console.error('更新资源绑定配置失败:', error);
    return createApiResponse(false, null, '更新资源绑定配置失败', 500);
  }
}

/**
 * 删除资源绑定配置
 */
export async function DELETE(
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

    const { groupId } = await params;

    // 验证拼车组管理权限
    const permissionResult = await verifyGroupPermissions(user, groupId, 'manage');
    if (!permissionResult.hasAccess) {
      return createApiResponse(false, null, '您没有权限管理此拼车组的资源配置', 403);
    }

    // 检查配置是否存在
    const existingBinding = await prisma.groupResourceBinding.findUnique({
      where: { groupId: groupId }
    });

    if (!existingBinding) {
      return createApiResponse(false, null, '资源绑定配置不存在', 404);
    }

    // 删除资源绑定配置（同时会删除相关的账号绑定）
    await prisma.groupResourceBinding.delete({
      where: { groupId: groupId }
    });

    console.log(`🗑️ API 资源绑定: 删除拼车组 ${groupId} 的资源配置`);

    return createApiResponse(true, null, '资源绑定配置删除成功', 200);

  } catch (error) {
    console.error('删除资源绑定配置失败:', error);
    return createApiResponse(false, null, '删除资源绑定配置失败', 500);
  }
}
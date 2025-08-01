import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { createApiResponse } from '@/lib/middleware';
import { getUserFromRequest } from '@/lib/auth';
import { EnhancedAiServiceRouter } from '@/lib/ai-services/enhanced-router';
import { cacheManager } from '@/lib/cache';

const switchModelSchema = z.object({
  targetModel: z.string().min(1, '目标模型不能为空'),
  reason: z.enum(['manual', 'maintenance', 'performance']).default('manual'),
  serviceType: z.enum(['claude_code', 'gemini', 'ampcode']).optional(),
});

// POST /api/groups/[id]/model-switch - 手动切换模型
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return createApiResponse(false, null, '未授权', 401);
    }

    const resolvedParams = await params;
    const groupId = resolvedParams.id;

    // 检查用户是否为组管理员
    const membership = await prisma.groupMember.findFirst({
      where: {
        groupId,
        userId: user.id,
        role: { in: ['admin', 'owner'] },
        status: 'active',
      },
    });

    if (!membership) {
      return createApiResponse(false, null, '无权限管理该拼车组', 403);
    }

    const body = await request.json();
    const { targetModel, reason, serviceType } = switchModelSchema.parse(body);

    // 只有Claude Code CLI支持多模型切换
    const modelConfig = await prisma.modelConfiguration.findFirst({
      where: {
        groupId,
        serviceType: serviceType || 'claude_code',
        isEnabled: true,
      },
    });

    if (!modelConfig) {
      return createApiResponse(false, null, '未找到多模型配置', 404);
    }

    if (modelConfig.serviceType !== 'claude_code') {
      return createApiResponse(false, null, '只有Claude Code CLI支持多模型切换', 400);
    }

    // 验证目标模型是否在支持列表中
    const supportedModels = [
      modelConfig.primaryModel,
      ...(Array.isArray(modelConfig.fallbackModels) ? modelConfig.fallbackModels : []),
    ];

    if (!supportedModels.includes(targetModel)) {
      return createApiResponse(false, null, `不支持的目标模型: ${targetModel}`, 400);
    }

    // 执行模型切换
    const enhancedRouter = new EnhancedAiServiceRouter();
    
    try {
      // 初始化路由
      await enhancedRouter.initializeMultiModelRoutes(groupId);
      
      // 执行切换
      const switchResult = await enhancedRouter.switchModel(groupId, targetModel, reason);
      
      if (switchResult) {
        // 清理相关缓存
        await cacheManager.invalidateModelCache(groupId);
        
        // 获取当前活跃模型状态
        const modelStatus = enhancedRouter.getActiveModelStatus(groupId);
        
        return createApiResponse(true, {
          success: true,
          message: `成功切换到模型: ${targetModel}`,
          activeModel: modelStatus.activeModel,
          availableModels: modelStatus.availableModels,
          timestamp: new Date().toISOString(),
        }, '模型切换成功', 200);
      } else {
        return createApiResponse(false, null, '模型切换失败，请检查目标模型状态', 500);
      }
      
    } catch (switchError) {
      console.error('Model switch error:', switchError);
      return createApiResponse(false, null, `模型切换失败: ${switchError instanceof Error ? switchError.message : '未知错误'}`, 500);
    }

  } catch (error) {
    if (error instanceof z.ZodError) {
      return createApiResponse(false, null, error.issues[0].message, 400);
    }

    console.error('Switch model error:', error);
    return createApiResponse(false, null, '模型切换请求处理失败', 500);
  }
}

// GET /api/groups/[id]/model-switch - 获取当前模型状态
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return createApiResponse(false, null, '未授权', 401);
    }

    const resolvedParams = await params;
    const groupId = resolvedParams.id;

    // 检查用户是否为组成员
    const membership = await prisma.groupMember.findFirst({
      where: {
        groupId,
        userId: user.id,
        status: 'active',
      },
    });

    if (!membership) {
      return createApiResponse(false, null, '无权访问该拼车组', 403);
    }

    // 从缓存获取模型状态
    const statusData = await cacheManager.getModelSwitchStatus(groupId);
    
    if (!statusData) {
      return createApiResponse(false, null, '未找到Claude Code多模型配置', 404);
    }

    try {
      // 获取实时模型状态
      const enhancedRouter = new EnhancedAiServiceRouter();
      await enhancedRouter.initializeMultiModelRoutes(groupId);
      const modelStatus = enhancedRouter.getActiveModelStatus(groupId);

      return createApiResponse(true, {
        ...statusData,
        currentStatus: {
          activeModel: modelStatus.activeModel,
          availableModels: modelStatus.availableModels,
          lastUpdated: new Date().toISOString(),
        },
      }, '获取模型状态成功', 200);

    } catch (routerError) {
      console.error('Router status error:', routerError);
      
      // 如果路由器出错，返回缓存的基本信息
      return createApiResponse(true, {
        ...statusData,
        currentStatus: {
          activeModel: 'unknown',
          availableModels: [],
          lastUpdated: new Date().toISOString(),
          error: '无法获取实时状态',
        },
      }, '获取模型状态成功', 200);
    }

  } catch (error) {
    console.error('Get model status error:', error);
    return createApiResponse(false, null, '获取模型状态失败', 500);
  }
}
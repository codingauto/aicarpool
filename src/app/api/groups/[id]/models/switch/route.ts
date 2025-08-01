import { NextRequest } from 'next/server';
import { z } from 'zod';
import { createApiResponse } from '@/lib/middleware';
import { getUserFromRequest } from '@/lib/auth';
import { EnhancedAiServiceRouter } from '@/lib/ai-services/enhanced-router';

const switchModelSchema = z.object({
  targetModel: z.string().min(1, '目标模型不能为空'),
  reason: z.enum(['manual', 'maintenance', 'performance']).default('manual'),
  force: z.boolean().default(false)
});

// 创建路由器实例
const enhancedRouter = new EnhancedAiServiceRouter();

// POST /api/groups/[id]/models/switch - 手动切换模型
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
    const { id: groupId } = resolvedParams;

    const body = await request.json();
    const validatedData = switchModelSchema.parse(body);

    // 执行模型切换
    const switchResult = await enhancedRouter.switchModel(
      groupId, 
      validatedData.targetModel, 
      validatedData.reason
    );

    if (switchResult) {
      return createApiResponse(true, {
        groupId,
        previousModel: 'unknown', // 可以从路由器获取
        newModel: validatedData.targetModel,
        reason: validatedData.reason,
        switchedAt: new Date()
      }, '模型切换成功', 200);
    } else {
      return createApiResponse(false, null, '模型切换失败', 400);
    }

  } catch (error) {
    if (error instanceof z.ZodError) {
      return createApiResponse(false, null, error.issues[0].message, 400);
    }
    
    console.error('Switch model error:', error);
    return createApiResponse(false, null, '模型切换失败', 500);
  }
}

// GET /api/groups/[id]/models/switch - 获取当前活跃模型状态
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
    const { id: groupId } = resolvedParams;

    // 获取当前活跃模型状态
    const modelStatus = enhancedRouter.getActiveModelStatus(groupId);

    return createApiResponse(true, {
      groupId,
      ...modelStatus
    }, '获取活跃模型状态成功', 200);

  } catch (error) {
    console.error('Get active model status error:', error);
    return createApiResponse(false, null, '获取活跃模型状态失败', 500);
  }
}
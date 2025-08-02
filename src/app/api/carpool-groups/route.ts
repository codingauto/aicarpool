import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { withAuth, createApiResponse, createErrorResponse } from '@/lib/middleware';

const createCarpoolGroupSchema = z.object({
  name: z.string().min(1, '拼车组名称不能为空').max(50, '拼车组名称不能超过50个字符'),
  description: z.string().optional(),
  expectedMembers: z.string().transform(val => parseInt(val)).pipe(
    z.number().min(2, '至少需要2个成员').max(15, '拼车组最多支持15个成员')
  ),
  aiServices: z.array(z.string()).min(1, '至少选择一个AI服务'),
  budget: z.string().optional(),
  organizationType: z.literal('carpool_group'),
  creationTemplate: z.literal('quick_carpool'),
});

// POST /api/carpool-groups - 创建拼车组
async function createCarpoolGroupHandler(request: NextRequest, user: any) {
  try {
    console.log('[DEBUG] 开始创建拼车组');
    console.log('[DEBUG] 用户验证成功:', user.id);

    const body = await request.json();
    console.log('[DEBUG] 请求数据:', body);
    
    const validatedData = createCarpoolGroupSchema.parse(body);
    console.log('[DEBUG] 数据验证成功:', validatedData);

    // 创建拼车组（作为特殊类型的Enterprise）
    console.log('[DEBUG] 开始创建企业记录');
    const carpoolGroup = await prisma.enterprise.create({
      data: {
        name: validatedData.name,
        planType: 'basic',
        organizationType: 'carpool_group',
        creationTemplate: 'quick_carpool',
        uiTheme: 'simple',
        featureSet: {
          maxMembers: validatedData.expectedMembers,
          selectedServices: validatedData.aiServices,
          budget: validatedData.budget || '100',
          features: [
            'ai_usage',
            'member_management', 
            'basic_stats',
            'cost_sharing'
          ]
        },
        settings: {
          description: validatedData.description,
          isPublic: false,
          autoAcceptInvites: false,
          allowMemberInvite: true
        }
      }
    });
    console.log('[DEBUG] 企业记录创建成功:', carpoolGroup.id);

    // 创建用户企业关系，设置为拼车组长
    console.log('[DEBUG] 开始创建用户企业关系');
    await prisma.userEnterprise.create({
      data: {
        userId: user.id,
        enterpriseId: carpoolGroup.id,
        role: 'owner', // 拼车组长
        permissions: JSON.stringify([
          'group.manage',
          'member.invite', 
          'member.remove',
          'account.bind',
          'stats.view',
          'settings.manage'
        ]),
        isActive: true
      }
    });
    console.log('[DEBUG] 用户企业关系创建成功');

    return createApiResponse(true, {
      id: carpoolGroup.id,
      name: carpoolGroup.name,
      organizationType: carpoolGroup.organizationType,
      creationTemplate: carpoolGroup.creationTemplate,
      featureSet: carpoolGroup.featureSet
    }, '拼车组创建成功', 201);

  } catch (error) {
    if (error instanceof z.ZodError) {
      return createApiResponse(false, null, error.issues[0].message, 400);
    }

    console.error('创建拼车组失败:', error);
    return createApiResponse(false, null, '服务器内部错误', 500);
  }
}

// GET /api/carpool-groups - 获取用户的拼车组列表
export async function GET(request: NextRequest) {
  try {
    const user = await verifyToken(request);
    if (!user) {
      return NextResponse.json(
        createErrorResponse('未授权访问', 401),
        { status: 401 }
      );
    }

    // 获取用户的拼车组
    const userEnterprises = await prisma.userEnterprise.findMany({
      where: {
        userId: user.id,
        isActive: true,
        enterprise: {
          organizationType: 'carpool_group'
        }
      },
      include: {
        enterprise: {
          include: {
            _count: {
              select: {
                userEnterprises: true,
                groups: true
              }
            }
          }
        }
      },
      orderBy: {
        lastAccessed: 'desc'
      }
    });

    const formattedData = userEnterprises.map(userEnt => ({
      role: userEnt.role,
      joinedAt: userEnt.joinedAt,
      lastAccessed: userEnt.lastAccessed,
      isActive: userEnt.isActive,
      carpoolGroup: {
        id: userEnt.enterprise.id,
        name: userEnt.enterprise.name,
        organizationType: userEnt.enterprise.organizationType,
        creationTemplate: userEnt.enterprise.creationTemplate,
        uiTheme: userEnt.enterprise.uiTheme,
        featureSet: userEnt.enterprise.featureSet,
        createdAt: userEnt.enterprise.createdAt,
        _count: {
          members: userEnt.enterprise._count.userEnterprises,
          groups: userEnt.enterprise._count.groups
        }
      }
    }));

    return NextResponse.json(
      createApiResponse(true, formattedData, '获取拼车组列表成功', 200)
    );

  } catch (error) {
    console.error('获取拼车组列表失败:', error);
    return NextResponse.json(
      createApiResponse(false, null, '服务器内部错误', 500),
      { status: 500 }
    );
  }
}

export const POST = withAuth(createCarpoolGroupHandler);
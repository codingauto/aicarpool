import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createApiResponse } from '@/lib/middleware';
import { getUserFromRequest } from '@/lib/auth';

// GET /api/enterprises/[enterpriseId]/users - 获取企业用户列表
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ enterpriseId: string }> }
) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return createApiResponse(false, null, '未授权', 401);
    }

    const resolvedParams = await params;
    const { enterpriseId } = resolvedParams;

    const { searchParams } = new URL(request.url);
    const notInDepartment = searchParams.get('not_in_department');
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '20');
    const search = searchParams.get('search') || '';

    // 检查企业是否存在
    const enterprise = await prisma.enterprise.findUnique({
      where: { id: enterpriseId }
    });

    if (!enterprise) {
      return createApiResponse(false, null, '企业不存在', 404);
    }

    // 构建查询条件
    let whereClause: any = {
      userEnterprises: {
        some: {
          enterpriseId: enterpriseId
        }
      }
    };

    // 添加搜索条件
    if (search) {
      whereClause.OR = [
        { name: { contains: search } },
        { email: { contains: search } }
      ];
    }

    // 如果指定了排除特定部门的参数
    if (notInDepartment) {
      whereClause.departmentMembers = {
        none: {
          departmentId: notInDepartment
        }
      };
    }

    // 获取用户总数
    const totalCount = await prisma.user.count({
      where: whereClause
    });

    // 获取用户列表
    const users = await prisma.user.findMany({
      where: whereClause,
      select: {
        id: true,
        name: true,
        email: true,
        avatar: true,
        status: true,
        createdAt: true,
        departmentMembers: {
          include: {
            department: {
              select: {
                id: true,
                name: true
              }
            }
          }
        },
        userEnterprises: {
          where: { enterpriseId },
          include: {
            role: {
              select: {
                name: true,
                displayName: true
              }
            }
          }
        }
      },
      orderBy: [
        { name: 'asc' }
      ],
      skip: (page - 1) * pageSize,
      take: pageSize
    });

    // 格式化用户数据
    const formattedUsers = users.map(user => ({
      id: user.id,
      name: user.name,
      email: user.email,
      avatar: user.avatar,
      status: user.status,
      createdAt: user.createdAt,
      departments: user.departmentMembers.map(dm => ({
        id: dm.department.id,
        name: dm.department.name,
        role: dm.role,
        status: dm.status
      })),
      enterpriseRole: user.userEnterprises[0]?.role ? {
        name: user.userEnterprises[0].role.name,
        displayName: user.userEnterprises[0].role.displayName
      } : null
    }));

    return createApiResponse(true, {
      users: formattedUsers,
      totalCount,
      page,
      pageSize,
      totalPages: Math.ceil(totalCount / pageSize)
    }, '获取企业用户列表成功', 200);
    
  } catch (error) {
    console.error('Get enterprise users error:', error);
    return createApiResponse(false, null, '获取企业用户列表失败', 500);
  }
}
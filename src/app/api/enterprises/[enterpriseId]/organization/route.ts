/**
 * 企业级组织架构管理API
 * 
 * 提供企业部门结构、人员分配和拼车组管理功能
 */

import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { createApiResponse } from '@/lib/middleware';
import { verifyToken } from '@/lib/auth';

const prisma = new PrismaClient();

/**
 * 获取企业组织架构数据
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ enterpriseId: string }> }
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

    const { enterpriseId } = await params;

    // 验证企业访问权限
    const enterprise = await prisma.enterprise.findUnique({
      where: { id: enterpriseId },
      include: {
        departments: {
          include: {
            groups: {
              include: {
                members: {
                  include: {
                    user: {
                      select: {
                        id: true,
                        name: true,
                        email: true
                      }
                    }
                  }
                },
                _count: {
                  select: { members: true }
                }
              }
            }
          }
        }
      }
    });

    if (!enterprise) {
      return createApiResponse(false, null, '企业不存在', 404);
    }

    // 检查用户是否是企业成员
    const userMembership = await prisma.userEnterprise.findFirst({
      where: {
        userId: user.id,
        enterpriseId: enterpriseId,
        isActive: true
      }
    });

    if (!userMembership) {
      return createApiResponse(false, null, '您不是该企业的成员', 403);
    }

    // 获取企业成员信息
    const enterpriseUsers = await prisma.userEnterprise.findMany({
      where: {
        enterpriseId: enterpriseId,
        isActive: true
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            status: true
          }
        }
      }
    });

    // 构建部门数据
    const departments = enterprise.departments.map(dept => {
      // 获取部门下所有拼车组的成员数量
      const totalMembers = dept.groups.reduce((sum, group) => sum + group._count.members, 0);
      
      // 随机分配一个部门经理（实际应从数据库获取）
      const deptMembers = enterpriseUsers.filter(userEnt => 
        dept.groups.some(group => 
          group.members.some(member => member.userId === userEnt.user.id)
        )
      );
      const manager = deptMembers.length > 0 ? deptMembers[0] : null;

      return {
        id: dept.id,
        name: dept.name,
        description: dept.description,
        parentId: dept.parentId,
        memberCount: totalMembers,
        groupCount: dept.groups.length,
        budgetLimit: dept.budgetLimit ? Number(dept.budgetLimit) : undefined,
        manager: manager ? {
          id: manager.user.id,
          name: manager.user.name,
          email: manager.user.email
        } : undefined
      };
    });

    // 构建成员数据
    const members = enterpriseUsers.map(userEnt => {
      // 查找用户所属的部门
      const userDepartment = enterprise.departments.find(dept =>
        dept.groups.some(group =>
          group.members.some(member => member.userId === userEnt.user.id)
        )
      );

      return {
        id: userEnt.user.id,
        name: userEnt.user.name,
        email: userEnt.user.email,
        role: userEnt.role,
        department: userDepartment?.name || '未分配',
        title: userEnt.role === 'owner' ? '企业拥有者' : 
               userEnt.role === 'admin' ? '管理员' : '成员',
        joinedAt: userEnt.joinedAt.toISOString(),
        status: userEnt.user.status as 'active' | 'inactive'
      };
    });

    // 构建拼车组数据
    const groups = enterprise.departments.flatMap(dept =>
      dept.groups.map(group => ({
        id: group.id,
        name: group.name,
        department: dept.name,
        memberCount: group._count.members,
        aiResourcesUsed: Math.floor(Math.random() * 100), // 模拟AI资源使用率
        status: group.status as 'active' | 'inactive'
      }))
    );

    // 统计数据
    const stats = {
      totalDepartments: departments.length,
      totalMembers: members.length,
      totalGroups: groups.length,
      activeDepartments: departments.length // 假设所有部门都是活跃的
    };

    const organizationData = {
      departments,
      members,
      groups,
      stats
    };

    console.log(`🏢 API 企业组织: 为企业 ${enterprise.name} 获取了组织架构数据`);

    return createApiResponse(true, organizationData, '获取企业组织架构数据成功', 200);

  } catch (error) {
    console.error('获取企业组织架构数据失败:', error);
    return createApiResponse(false, null, '获取企业组织架构数据失败', 500);
  }
}

/**
 * 创建新部门
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ enterpriseId: string }> }
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

    const { enterpriseId } = await params;
    const body = await request.json();

    // 验证企业访问权限
    const userMembership = await prisma.userEnterprise.findFirst({
      where: {
        userId: user.id,
        enterpriseId: enterpriseId,
        isActive: true,
        role: { in: ['owner', 'admin'] } // 只有管理员可以创建部门
      }
    });

    if (!userMembership) {
      return createApiResponse(false, null, '您没有权限创建部门', 403);
    }

    // 创建新部门
    const { name, description, parentId, budgetLimit } = body;

    const newDepartment = await prisma.department.create({
      data: {
        enterpriseId: enterpriseId,
        name: name,
        description: description,
        parentId: parentId || null,
        budgetLimit: budgetLimit || null
      }
    });

    console.log(`🏢 API 企业组织: 为企业 ${enterpriseId} 创建了新部门 ${name}`);

    return createApiResponse(true, newDepartment, '部门创建成功', 201);

  } catch (error) {
    console.error('创建部门失败:', error);
    return createApiResponse(false, null, '创建部门失败', 500);
  }
}

/**
 * 更新部门信息
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ enterpriseId: string }> }
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

    const { enterpriseId } = await params;
    const body = await request.json();

    // 验证企业访问权限
    const userMembership = await prisma.userEnterprise.findFirst({
      where: {
        userId: user.id,
        enterpriseId: enterpriseId,
        isActive: true,
        role: { in: ['owner', 'admin'] } // 只有管理员可以更新部门
      }
    });

    if (!userMembership) {
      return createApiResponse(false, null, '您没有权限更新部门信息', 403);
    }

    // 更新部门信息
    const { departmentId, name, description, budgetLimit } = body;

    const updatedDepartment = await prisma.department.update({
      where: {
        id: departmentId,
        enterpriseId: enterpriseId
      },
      data: {
        name: name,
        description: description,
        budgetLimit: budgetLimit || null
      }
    });

    console.log(`🏢 API 企业组织: 为企业 ${enterpriseId} 更新了部门 ${departmentId}`);

    return createApiResponse(true, updatedDepartment, '部门更新成功', 200);

  } catch (error) {
    console.error('更新部门信息失败:', error);
    return createApiResponse(false, null, '更新部门信息失败', 500);
  }
}
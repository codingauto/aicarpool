import { NextRequest, NextResponse } from 'next/server';
import { createPermissionManager } from '@/lib/permission/simple-permission-manager';
import { getUserFromRequest } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

/**
 * 企业批量操作API
 * 
 * 功能：
 * - 批量角色分配
 * - 批量权限修改
 * - 批量状态管理
 * - 用户数据导出
 * - 批量用户导入
 */

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ enterpriseId: string }> }
) {
  try {
    const { enterpriseId } = await params;
    const user = await getUserFromRequest(request);

    if (!user) {
      return NextResponse.json({
        success: false,
        message: '用户未认证',
        code: 401
      }, { status: 401 });
    }

    const body = await request.json();
    const { userIds, action, data } = body;

    // 创建权限管理器
    const permissionManager = createPermissionManager();

    // 检查用户是否有企业权限管理权限
    const hasAccess = await permissionManager.hasPermission(
      { userId: user.id, scope: 'enterprise', resourceId: enterpriseId }, 
      'enterprise.admin'
    );

    // 开发模式：如果没有企业权限，检查是否有全局权限或者直接允许访问
    if (!hasAccess && process.env.NODE_ENV === 'development') {
      console.log('🔐 开发模式：检查全局权限或允许测试访问');
      const hasGlobalAccess = await permissionManager.hasPermission(
        { userId: user.id }, 
        'system.admin'
      );
      if (!hasGlobalAccess) {
        console.log('🔐 开发模式：允许测试访问批量操作');
      }
    } else if (!hasAccess) {
      return NextResponse.json({
        success: false,
        message: '没有权限进行批量操作',
        code: 403
      }, { status: 403 });
    }

    switch (action) {
      case 'role':
        return await batchUpdateRole(enterpriseId, userIds, data);
      
      case 'permissions':
        return await batchUpdatePermissions(enterpriseId, userIds, data);
      
      case 'status':
        return await batchUpdateStatus(enterpriseId, userIds, data);
      
      case 'export':
        return await exportUsers(enterpriseId, userIds, data);
      
      case 'import':
        return await importUsers(enterpriseId, data);
      
      default:
        return NextResponse.json({
          success: false,
          message: '无效的操作类型',
          code: 400
        }, { status: 400 });
    }

  } catch (error) {
    console.error('批量操作API错误:', error);
    return NextResponse.json({
      success: false,
      message: '服务器内部错误',
      code: 500
    }, { status: 500 });
  }
}

async function batchUpdateRole(enterpriseId: string, userIds: string[], data: { role: string }) {
  try {
    const { role } = data;

    // 验证角色是否存在
    const validRoles = ['owner', 'admin', 'member'];
    // 还需要检查自定义角色
    const customRoles = await prisma.$queryRaw`
      SELECT roleKey FROM CustomRole WHERE enterpriseId = ${enterpriseId}
    ` as any[];
    
    const allValidRoles = [...validRoles, ...customRoles.map((r: any) => r.roleKey)];
    
    if (!allValidRoles.includes(role)) {
      return NextResponse.json({
        success: false,
        message: '无效的角色',
        code: 400
      }, { status: 400 });
    }

    // 批量更新用户角色
    await prisma.userEnterprise.updateMany({
      where: {
        userId: { in: userIds },
        enterpriseId,
        isActive: true
      },
      data: {
        role,
        updatedAt: new Date()
      }
    });

    return NextResponse.json({
      success: true,
      message: `成功更新 ${userIds.length} 个用户的角色`,
      data: {
        updatedCount: userIds.length,
        role
      }
    });

  } catch (error) {
    console.error('批量更新角色失败:', error);
    return NextResponse.json({
      success: false,
      message: '批量更新角色失败',
      code: 500
    }, { status: 500 });
  }
}

async function batchUpdatePermissions(enterpriseId: string, userIds: string[], data: { permissions: string[], mode: 'add' | 'remove' | 'replace' }) {
  try {
    const { permissions, mode } = data;

    // 验证权限是否有效
    const validPermissions = [
      'system.admin', 'system.view',
      'enterprise.admin', 'enterprise.manage', 'enterprise.view',
      'group.admin', 'group.manage', 'group.create', 'group.view',
      'ai.admin', 'ai.manage', 'ai.use',
      'user.admin', 'user.manage', 'user.invite', 'user.view'
    ];

    const invalidPermissions = permissions.filter(p => !validPermissions.includes(p));
    if (invalidPermissions.length > 0) {
      return NextResponse.json({
        success: false,
        message: `无效的权限: ${invalidPermissions.join(', ')}`,
        code: 400
      }, { status: 400 });
    }

    // 获取用户当前权限
    const users = await prisma.userEnterprise.findMany({
      where: {
        userId: { in: userIds },
        enterpriseId,
        isActive: true
      }
    });

    // 根据模式更新权限
    for (const user of users) {
      let currentPermissions: string[] = [];
      try {
        currentPermissions = user.permissions ? JSON.parse(user.permissions as string) : [];
      } catch {
        currentPermissions = [];
      }

      let newPermissions = [...currentPermissions];

      switch (mode) {
        case 'add':
          permissions.forEach(p => {
            if (!newPermissions.includes(p)) {
              newPermissions.push(p);
            }
          });
          break;
        case 'remove':
          newPermissions = newPermissions.filter(p => !permissions.includes(p));
          break;
        case 'replace':
          newPermissions = [...permissions];
          break;
      }

      await prisma.userEnterprise.update({
        where: {
          id: user.id
        },
        data: {
          permissions: JSON.stringify(newPermissions),
          updatedAt: new Date()
        }
      });
    }

    return NextResponse.json({
      success: true,
      message: `成功${mode === 'add' ? '添加' : mode === 'remove' ? '移除' : '替换'}权限`,
      data: {
        updatedCount: users.length,
        mode,
        permissions
      }
    });

  } catch (error) {
    console.error('批量更新权限失败:', error);
    return NextResponse.json({
      success: false,
      message: '批量更新权限失败',
      code: 500
    }, { status: 500 });
  }
}

async function batchUpdateStatus(enterpriseId: string, userIds: string[], data: { status: 'active' | 'inactive' | 'pending' }) {
  try {
    const { status } = data;

    // 批量更新用户状态
    await prisma.userEnterprise.updateMany({
      where: {
        userId: { in: userIds },
        enterpriseId
      },
      data: {
        isActive: status === 'active',
        updatedAt: new Date()
      }
    });

    return NextResponse.json({
      success: true,
      message: `成功更新 ${userIds.length} 个用户的状态`,
      data: {
        updatedCount: userIds.length,
        status
      }
    });

  } catch (error) {
    console.error('批量更新状态失败:', error);
    return NextResponse.json({
      success: false,
      message: '批量更新状态失败',
      code: 500
    }, { status: 500 });
  }
}

async function exportUsers(enterpriseId: string, userIds: string[], data: { format: 'csv' }) {
  try {
    // 获取用户详细信息
    const users = await prisma.userEnterprise.findMany({
      where: {
        userId: { in: userIds },
        enterpriseId
      },
      include: {
        user: true,
        enterprise: true
      }
    });

    // 生成CSV数据
    const csvHeaders = '用户ID,姓名,邮箱,角色,状态,权限数量,加入时间,最后访问时间\n';
    const csvRows = users.map(userEnterprise => {
      const user = userEnterprise.user;
      const permissions = userEnterprise.permissions ? JSON.parse(userEnterprise.permissions as string) : [];
      const status = userEnterprise.isActive ? 'active' : 'inactive';
      
      return [
        user.id,
        user.name || '未设置',
        user.email,
        userEnterprise.role,
        status,
        permissions.length,
        userEnterprise.joinedAt.toLocaleDateString('zh-CN'),
        userEnterprise.lastAccessed ? userEnterprise.lastAccessed.toLocaleDateString('zh-CN') : '从未访问'
      ].join(',');
    }).join('\n');

    const csvData = csvHeaders + csvRows;

    return NextResponse.json({
      success: true,
      message: `成功导出 ${users.length} 个用户的数据`,
      data: {
        csvData,
        userCount: users.length
      }
    });

  } catch (error) {
    console.error('导出用户失败:', error);
    return NextResponse.json({
      success: false,
      message: '导出用户失败',
      code: 500
    }, { status: 500 });
  }
}

async function importUsers(enterpriseId: string, data: { importData: string }) {
  try {
    const { importData } = data;
    
    const lines = importData.trim().split('\n');
    if (lines.length < 2) {
      return NextResponse.json({
        success: false,
        message: 'CSV数据格式不正确',
        code: 400
      }, { status: 400 });
    }

    const headers = lines[0].split(',').map(h => h.trim());
    const expectedHeaders = ['邮箱', '姓名', '角色', '部门'];
    
    if (!expectedHeaders.every(h => headers.includes(h))) {
      return NextResponse.json({
        success: false,
        message: `CSV标题行必须包含: ${expectedHeaders.join(', ')}`,
        code: 400
      }, { status: 400 });
    }

    const importResults = {
      total: 0,
      success: 0,
      failed: 0,
      errors: [] as string[]
    };

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim());
      if (values.length < headers.length) continue;

      importResults.total++;

      try {
        const rowData: Record<string, string> = {};
        headers.forEach((header, index) => {
          rowData[header] = values[index] || '';
        });

        const email = rowData['邮箱'];
        const name = rowData['姓名'];
        const role = rowData['角色'];
        const department = rowData['部门'];

        if (!email || !name || !role) {
          importResults.failed++;
          importResults.errors.push(`第${i+1}行：邮箱、姓名、角色为必填字段`);
          continue;
        }

        // 检查用户是否已存在
        let user = await prisma.user.findUnique({
          where: { email }
        });

        if (!user) {
          // 创建新用户
          user = await prisma.user.create({
            data: {
              id: `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              email,
              name,
              passwordHash: '', // 导入的用户需要重置密码
              createdAt: new Date(),
              updatedAt: new Date()
            }
          });
        }

        // 检查是否已加入企业
        const existingUserEnterprise = await prisma.userEnterprise.findFirst({
          where: {
            userId: user.id,
            enterpriseId
          }
        });

        if (!existingUserEnterprise) {
          // 添加到企业
          await prisma.userEnterprise.create({
            data: {
              id: `ue_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              userId: user.id,
              enterpriseId,
              role,
              permissions: null,
              joinedAt: new Date(),
              lastAccessed: new Date(),
              isActive: false, // 导入的用户默认为待激活状态
              updatedAt: new Date()
            }
          });

          importResults.success++;
        } else {
          importResults.failed++;
          importResults.errors.push(`第${i+1}行：用户 ${email} 已存在于企业中`);
        }

      } catch (error) {
        importResults.failed++;
        importResults.errors.push(`第${i+1}行：处理失败 - ${error}`);
      }
    }

    return NextResponse.json({
      success: true,
      message: `导入完成：成功 ${importResults.success} 个，失败 ${importResults.failed} 个`,
      data: importResults
    });

  } catch (error) {
    console.error('导入用户失败:', error);
    return NextResponse.json({
      success: false,
      message: '导入用户失败',
      code: 500
    }, { status: 500 });
  }
}
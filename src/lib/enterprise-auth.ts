/**
 * 企业级权限验证和授权模块
 * 
 * 提供：
 * - 企业成员身份验证
 * - 多层级权限控制
 * - 资源访问权限验证
 * - 拼车组企业关联权限
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface EnterprisePermission {
  userId: string;
  enterpriseId: string;
  roles: EnterpriseRole[];
  hasGroupAccess: boolean;
  canManageGroups: boolean;
  canManageMembers: boolean;
  canManageResources: boolean;
  canViewAnalytics: boolean;
}

export interface EnterpriseRole {
  id: string;
  name: string;
  displayName: string;
  scope: 'global' | 'department' | 'group';
  resourceId?: string;
  permissions: string[];
}

/**
 * 获取用户在企业中的权限
 */
export async function getUserEnterprisePermissions(
  userId: string, 
  enterpriseId: string
): Promise<EnterprisePermission | null> {
  try {
    // 获取用户的企业角色
    const userRoles = await prisma.userEnterpriseRole.findMany({
      where: {
        userId,
        enterpriseId,
        isActive: true
      },
      include: {
        role: {
          include: {
            permissions: {
              include: {
                permission: true
              }
            }
          }
        }
      }
    });

    if (userRoles.length === 0) {
      return null;
    }

    // 聚合所有权限
    const allPermissions = new Set<string>();
    const roles: EnterpriseRole[] = [];

    userRoles.forEach(userRole => {
      const role = userRole.role;
      const rolePermissions = role.permissions.map(rp => rp.permission.name);
      
      roles.push({
        id: role.id,
        name: role.name,
        displayName: role.displayName,
        scope: userRole.scope as 'global' | 'department' | 'group',
        resourceId: userRole.resourceId || undefined,
        permissions: rolePermissions
      });

      rolePermissions.forEach(permission => allPermissions.add(permission));
    });

    // 分析具体权限
    const permissions: EnterprisePermission = {
      userId,
      enterpriseId,
      roles,
      hasGroupAccess: allPermissions.has('group.view') || allPermissions.has('group.manage'),
      canManageGroups: allPermissions.has('group.manage') || allPermissions.has('group.create'),
      canManageMembers: allPermissions.has('member.manage') || allPermissions.has('group.manage'),
      canManageResources: allPermissions.has('resource.manage') || allPermissions.has('enterprise.admin'),
      canViewAnalytics: allPermissions.has('analytics.view') || allPermissions.has('enterprise.admin')
    };

    return permissions;

  } catch (error) {
    console.error('获取企业权限失败:', error);
    return null;
  }
}

/**
 * 验证用户对特定拼车组的访问权限
 */
export async function verifyGroupAccess(
  userId: string,
  groupId: string,
  requiredAction: 'view' | 'edit' | 'manage' | 'delete' = 'view'
): Promise<{ hasAccess: boolean; reason?: string; roleInGroup?: string }> {
  try {
    // 首先检查是否是拼车组成员
    const groupMember = await prisma.groupMember.findFirst({
      where: {
        userId,
        groupId,
        status: 'active'
      }
    });

    if (groupMember) {
      // 检查组内角色权限
      const hasPermission = checkGroupRolePermission(groupMember.role, requiredAction);
      return {
        hasAccess: hasPermission,
        reason: hasPermission ? undefined : '拼车组角色权限不足',
        roleInGroup: groupMember.role
      };
    }

    // 不是成员，检查企业级权限
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      select: { enterpriseId: true }
    });

    if (!group?.enterpriseId) {
      return { hasAccess: false, reason: '拼车组未关联企业' };
    }

    const enterprisePermissions = await getUserEnterprisePermissions(userId, group.enterpriseId);
    if (!enterprisePermissions) {
      return { hasAccess: false, reason: '不属于该企业' };
    }

    // 检查企业级权限
    const hasEnterprisePermission = checkEnterprisePermission(enterprisePermissions, requiredAction);
    return {
      hasAccess: hasEnterprisePermission,
      reason: hasEnterprisePermission ? undefined : '企业权限不足',
      roleInGroup: 'enterprise_member'
    };

  } catch (error) {
    console.error('验证拼车组访问权限失败:', error);
    return { hasAccess: false, reason: '权限验证失败' };
  }
}

/**
 * 验证用户对企业资源的访问权限
 */
export async function verifyResourceAccess(
  userId: string,
  enterpriseId: string,
  resourceType: 'ai_account' | 'group' | 'member' | 'analytics',
  action: 'view' | 'create' | 'edit' | 'delete' = 'view'
): Promise<{ hasAccess: boolean; reason?: string }> {
  try {
    const enterprisePermissions = await getUserEnterprisePermissions(userId, enterpriseId);
    if (!enterprisePermissions) {
      return { hasAccess: false, reason: '不属于该企业' };
    }

    const requiredPermission = `${resourceType}.${action}`;
    const hasPermission = enterprisePermissions.roles.some(role =>
      role.permissions.includes(requiredPermission) ||
      role.permissions.includes('enterprise.admin')
    );

    return {
      hasAccess: hasPermission,
      reason: hasPermission ? undefined : `缺少 ${requiredPermission} 权限`
    };

  } catch (error) {
    console.error('验证企业资源权限失败:', error);
    return { hasAccess: false, reason: '权限验证失败' };
  }
}

/**
 * 获取用户可访问的拼车组列表
 */
export async function getUserAccessibleGroups(userId: string): Promise<any[]> {
  try {
    // 获取用户直接加入的拼车组
    const memberGroups = await prisma.groupMember.findMany({
      where: {
        userId,
        status: 'active'
      },
      include: {
        group: {
          include: {
            enterprise: {
              select: {
                id: true,
                name: true
              }
            }
          }
        }
      }
    });

    // 获取用户通过企业权限可访问的拼车组
    const userEnterprises = await prisma.userEnterpriseRole.findMany({
      where: {
        userId,
        isActive: true
      },
      include: {
        enterprise: {
          include: {
            groups: {
              where: {
                status: 'active'
              },
              include: {
                _count: {
                  select: {
                    members: {
                      where: { status: 'active' }
                    }
                  }
                }
              }
            }
          }
        },
        role: {
          include: {
            permissions: {
              include: {
                permission: true
              }
            }
          }
        }
      }
    });

    const accessibleGroups = new Map<string, any>();

    // 添加直接加入的拼车组
    memberGroups.forEach(membership => {
      accessibleGroups.set(membership.group.id, {
        ...membership.group,
        accessType: 'member',
        roleInGroup: membership.role,
        memberCount: 0 // 需要单独查询
      });
    });

    // 添加企业权限可访问的拼车组
    userEnterprises.forEach(userEnterprise => {
      const hasGroupViewPermission = userEnterprise.role.permissions.some(rp =>
        ['group.view', 'group.manage', 'enterprise.admin'].includes(rp.permission.name)
      );

      if (hasGroupViewPermission) {
        userEnterprise.enterprise.groups.forEach(group => {
          if (!accessibleGroups.has(group.id)) {
            accessibleGroups.set(group.id, {
              ...group,
              enterprise: {
                id: userEnterprise.enterprise.id,
                name: userEnterprise.enterprise.name
              },
              accessType: 'enterprise',
              roleInGroup: 'enterprise_member',
              memberCount: group._count.members
            });
          }
        });
      }
    });

    return Array.from(accessibleGroups.values());

  } catch (error) {
    console.error('获取可访问拼车组失败:', error);
    return [];
  }
}

/**
 * 批量验证权限
 */
export async function batchVerifyPermissions(
  userId: string,
  permissions: Array<{
    type: 'group' | 'enterprise';
    resourceId: string;
    action: string;
  }>
): Promise<Record<string, boolean>> {
  const results: Record<string, boolean> = {};

  for (const permission of permissions) {
    const key = `${permission.type}:${permission.resourceId}:${permission.action}`;
    
    try {
      if (permission.type === 'group') {
        const result = await verifyGroupAccess(userId, permission.resourceId, permission.action as any);
        results[key] = result.hasAccess;
      } else if (permission.type === 'enterprise') {
        // 这里需要更多的上下文来确定具体的资源类型
        results[key] = false;
      }
    } catch (error) {
      results[key] = false;
    }
  }

  return results;
}

// 辅助函数
function checkGroupRolePermission(role: string, action: string): boolean {
  const rolePermissions: Record<string, string[]> = {
    'owner': ['view', 'edit', 'manage', 'delete'],
    'admin': ['view', 'edit', 'manage'],
    'member': ['view'],
    'readonly': ['view']
  };

  return rolePermissions[role]?.includes(action) || false;
}

function checkEnterprisePermission(permissions: EnterprisePermission, action: string): boolean {
  const actionPermissionMap: Record<string, keyof EnterprisePermission> = {
    'view': 'hasGroupAccess',
    'edit': 'canManageMembers',
    'manage': 'canManageGroups',
    'delete': 'canManageGroups'
  };

  const permissionKey = actionPermissionMap[action];
  return permissionKey ? permissions[permissionKey] as boolean : false;
}

/**
 * Express中间件：验证拼车组访问权限
 */
export function requireGroupAccess(action: 'view' | 'edit' | 'manage' | 'delete' = 'view') {
  return async (req: any, res: any, next: any) => {
    try {
      const userId = req.user?.id;
      const groupId = req.params.groupId;

      if (!userId) {
        return res.status(401).json({ error: '用户未认证' });
      }

      if (!groupId) {
        return res.status(400).json({ error: '缺少拼车组ID' });
      }

      const accessResult = await verifyGroupAccess(userId, groupId, action);

      if (!accessResult.hasAccess) {
        return res.status(403).json({ 
          error: '权限不足', 
          reason: accessResult.reason 
        });
      }

      req.groupAccess = accessResult;
      next();

    } catch (error) {
      console.error('权限验证中间件错误:', error);
      res.status(500).json({ error: '权限验证失败' });
    }
  };
}
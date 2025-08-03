import type { PrismaClient } from '@prisma/client';
import { prisma } from '@/lib/prisma';

declare global {
  var prisma: PrismaClient;
}

export interface PermissionContext {
  userId: string;
  enterpriseId?: string;
  groupId?: string;
}

// 定义系统权限
export const PERMISSIONS = {
  // 系统管理
  'system.admin': '系统管理员权限',
  
  // 企业管理
  'enterprise.manage': '企业管理',
  'enterprise.view': '企业查看',
  
  // 拼车组管理
  'group.create': '创建拼车组',
  'group.manage': '管理拼车组',
  'group.view': '查看拼车组',
  
  // AI资源使用
  'ai.use': '使用AI服务',
  'ai.manage': '管理AI账号',
  
  // 用户管理
  'user.invite': '邀请用户',
  'user.manage': '管理用户'
} as const;

// 定义角色权限映射
export const ROLES = {
  'system_admin': {
    name: '系统管理员',
    permissions: ['system.admin', 'enterprise.manage', 'group.manage', 'ai.manage', 'user.manage']
  },
  'enterprise_owner': {
    name: '企业所有者',
    permissions: ['enterprise.manage', 'group.create', 'group.manage', 'ai.manage', 'user.invite']
  },
  'enterprise_admin': {
    name: '企业管理员',
    permissions: ['enterprise.view', 'group.create', 'group.manage', 'user.invite']
  },
  'group_owner': {
    name: '拼车组长',
    permissions: ['group.manage', 'ai.use', 'user.invite']
  },
  'group_member': {
    name: '拼车组成员',
    permissions: ['group.view', 'ai.use']
  }
} as const;

export type Permission = keyof typeof PERMISSIONS;
export type Role = keyof typeof ROLES;

export class SimplePermissionManager {
  private prisma: PrismaClient;

  constructor(prismaClient?: PrismaClient) {
    this.prisma = prismaClient || prisma;
  }

  // 权限缓存
  private permissionCache = new Map<string, { permissions: Permission[], expiry: number }>();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5分钟缓存

  /**
   * 简单的权限检查（带缓存优化）
   */
  async hasPermission(
    context: PermissionContext,
    permission: Permission
  ): Promise<boolean> {
    try {
      // 先检查缓存
      const cacheKey = `${context.userId}-${context.enterpriseId || 'global'}-${context.groupId || ''}`;
      const cached = this.permissionCache.get(cacheKey);
      
      let userPermissions: Permission[];
      
      if (cached && cached.expiry > Date.now()) {
        userPermissions = cached.permissions;
      } else {
        // 缓存过期或不存在，重新查询
        userPermissions = await this.getUserPermissions(context);
        
        // 更新缓存
        this.permissionCache.set(cacheKey, {
          permissions: userPermissions,
          expiry: Date.now() + this.CACHE_TTL
        });
      }

      // 检查权限
      return userPermissions.includes(permission) || userPermissions.includes('system.admin');
    } catch (error) {
      console.error('Permission check error:', error);
      return false;
    }
  }

  /**
   * 获取用户权限列表（优化版）
   */
  async getUserPermissions(context: PermissionContext): Promise<Permission[]> {
    try {
      // 构建优化的查询条件
      const whereConditions: any = {
        userId: context.userId,
        isActive: true
      };

      // 根据上下文确定查询范围，使用OR条件优化查询
      if (context.groupId) {
        whereConditions.OR = [
          { scope: 'group', resourceId: context.groupId },
          { scope: 'enterprise', enterpriseId: context.enterpriseId },
          { scope: 'global' }
        ];
      } else if (context.enterpriseId) {
        whereConditions.OR = [
          { scope: 'enterprise', enterpriseId: context.enterpriseId },
          { scope: 'global' }
        ];
      } else {
        whereConditions.scope = 'global';
      }

      // 批量查询用户角色，只获取必要字段
      const userRoles = await this.prisma.userEnterpriseRole.findMany({
        where: whereConditions,
        select: {
          role: true,
          scope: true
        }
      });

      const allPermissions = new Set<Permission>();
      
      // 批量处理角色权限
      userRoles.forEach(userRole => {
        const permissions = this.getRolePermissions(userRole.role as Role);
        permissions.forEach(perm => allPermissions.add(perm));
      });

      return Array.from(allPermissions);
    } catch (error) {
      console.error('Get user permissions error:', error);
      return [];
    }
  }

  /**
   * 清空权限缓存
   */
  clearPermissionCache(userId?: string): void {
    if (userId) {
      // 清空特定用户的缓存
      for (const [key] of this.permissionCache.entries()) {
        if (key.startsWith(userId)) {
          this.permissionCache.delete(key);
        }
      }
    } else {
      // 清空所有缓存
      this.permissionCache.clear();
    }
  }

  /**
   * 分配角色给用户
   */
  async assignRole(
    assignerContext: PermissionContext,
    targetUserId: string,
    role: Role,
    scope: 'global' | 'enterprise' | 'group' = 'enterprise',
    resourceId?: string
  ): Promise<boolean> {
    // 检查分配者权限
    const canAssign = await this.hasPermission(assignerContext, 'user.manage') || 
                     await this.hasPermission(assignerContext, 'user.invite');
    
    if (!canAssign) {
      throw new Error('权限不足，无法分配角色');
    }

    try {
      await this.prisma.userEnterpriseRole.create({
        data: {
          userId: targetUserId,
          enterpriseId: assignerContext.enterpriseId,
          role,
          scope,
          resourceId
        }
      });
      
      // 清空目标用户的权限缓存
      this.clearPermissionCache(targetUserId);
      
      return true;
    } catch (error) {
      console.error('Assign role error:', error);
      return false;
    }
  }

  /**
   * 获取用户在企业中的角色
   */
  async getUserRole(userId: string, enterpriseId: string): Promise<Role | null> {
    const userRole = await this.prisma.userEnterpriseRole.findFirst({
      where: {
        userId,
        enterpriseId,
        isActive: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    return userRole ? (userRole.role as Role) : null;
  }

  /**
   * 获取用户的所有企业角色
   */
  async getUserEnterpriseRoles(userId: string): Promise<Array<{
    enterpriseId: string;
    role: Role;
    scope: string;
    resourceId?: string;
  }>> {
    const roles = await this.prisma.userEnterpriseRole.findMany({
      where: {
        userId,
        isActive: true
      }
    });

    return roles.map(role => ({
      enterpriseId: role.enterpriseId || '',
      role: role.role as Role,
      scope: role.scope,
      resourceId: role.resourceId || undefined
    }));
  }

  /**
   * 移除用户角色
   */
  async removeRole(
    assignerContext: PermissionContext,
    targetUserId: string,
    roleId: string
  ): Promise<boolean> {
    // 检查分配者权限
    const canManage = await this.hasPermission(assignerContext, 'user.manage');
    
    if (!canManage) {
      throw new Error('权限不足，无法移除角色');
    }

    try {
      await this.prisma.userEnterpriseRole.update({
        where: { id: roleId },
        data: { isActive: false }
      });
      
      // 清空目标用户的权限缓存
      this.clearPermissionCache(targetUserId);
      
      return true;
    } catch (error) {
      console.error('Remove role error:', error);
      return false;
    }
  }

  /**
   * 获取角色对应的权限
   */
  private getRolePermissions(role: Role): Permission[] {
    const roleConfig = ROLES[role];
    return roleConfig ? (roleConfig.permissions as Permission[]) : [];
  }

  /**
   * 验证权限名称是否有效
   */
  isValidPermission(permission: string): permission is Permission {
    return permission in PERMISSIONS;
  }

  /**
   * 验证角色名称是否有效
   */
  isValidRole(role: string): role is Role {
    return role in ROLES;
  }

  /**
   * 获取所有可用权限
   */
  getAllPermissions(): Permission[] {
    return Object.keys(PERMISSIONS) as Permission[];
  }

  /**
   * 获取所有可用角色
   */
  getAllRoles(): Role[] {
    return Object.keys(ROLES) as Role[];
  }

  /**
   * 获取角色信息
   */
  getRoleInfo(role: Role) {
    return ROLES[role];
  }
}

// 导出默认实例（需要在使用时传入prisma实例）
export function createPermissionManager(prismaClient?: PrismaClient) {
  return new SimplePermissionManager(prismaClient);
}
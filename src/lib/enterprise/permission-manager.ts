import { prisma } from '@/lib/prisma';
import { cacheManager } from '@/lib/cache';

export interface Permission {
  id: string;
  name: string;
  resource: string;
  action: 'create' | 'read' | 'update' | 'delete' | 'manage';
  description?: string;
}

export interface Role {
  id: string;
  name: string;
  displayName: string;
  description?: string;
  permissions: string[];
  isBuiltIn: boolean;
  isActive: boolean;
}

export interface UserPermission {
  userId: string;
  enterpriseId?: string;
  roleId: string;
  role: Role;
  scope: string;
  resourceId?: string;
  isActive: boolean;
}

export interface PermissionCheck {
  hasPermission: boolean;
  reason?: string;
  scope?: 'enterprise' | 'department' | 'group';
  inheritedFrom?: string;
}

export class PermissionManager {
  // 内置权限定义
  private readonly BUILT_IN_PERMISSIONS: Permission[] = [
    // 企业管理权限
    { id: 'enterprise.manage', name: '企业管理', resource: 'enterprise', action: 'manage', description: '完整的企业管理权限' },
    { id: 'enterprise.view', name: '企业查看', resource: 'enterprise', action: 'read', description: '查看企业信息' },
    
    // 部门管理权限
    { id: 'department.create', name: '创建部门', resource: 'department', action: 'create', description: '创建新部门' },
    { id: 'department.read', name: '查看部门', resource: 'department', action: 'read', description: '查看部门信息' },
    { id: 'department.update', name: '编辑部门', resource: 'department', action: 'update', description: '编辑部门信息' },
    { id: 'department.delete', name: '删除部门', resource: 'department', action: 'delete', description: '删除部门' },
    { id: 'department.manage', name: '部门管理', resource: 'department', action: 'manage', description: '完整的部门管理权限' },
    
    // 组管理权限
    { id: 'group.create', name: '创建拼车组', resource: 'group', action: 'create', description: '创建新的拼车组' },
    { id: 'group.read', name: '查看拼车组', resource: 'group', action: 'read', description: '查看拼车组信息' },
    { id: 'group.update', name: '编辑拼车组', resource: 'group', action: 'update', description: '编辑拼车组信息' },
    { id: 'group.delete', name: '删除拼车组', resource: 'group', action: 'delete', description: '删除拼车组' },
    { id: 'group.manage', name: '拼车组管理', resource: 'group', action: 'manage', description: '完整的拼车组管理权限' },
    
    // 用户管理权限
    { id: 'user.create', name: '创建用户', resource: 'user', action: 'create', description: '创建新用户' },
    { id: 'user.read', name: '查看用户', resource: 'user', action: 'read', description: '查看用户信息' },
    { id: 'user.update', name: '编辑用户', resource: 'user', action: 'update', description: '编辑用户信息' },
    { id: 'user.delete', name: '删除用户', resource: 'user', action: 'delete', description: '删除用户' },
    { id: 'user.manage', name: '用户管理', resource: 'user', action: 'manage', description: '完整的用户管理权限' },
    
    // v2.4简化：AI账号管理权限（替代账号池）
    { id: 'account.create', name: '创建AI账号', resource: 'ai_account', action: 'create', description: '添加新的AI服务账号' },
    { id: 'account.read', name: '查看AI账号', resource: 'ai_account', action: 'read', description: '查看AI账号信息' },
    { id: 'account.update', name: '编辑AI账号', resource: 'ai_account', action: 'update', description: '编辑AI账号配置' },
    { id: 'account.delete', name: '删除AI账号', resource: 'ai_account', action: 'delete', description: '删除AI账号' },
    { id: 'account.manage', name: 'AI账号管理', resource: 'ai_account', action: 'manage', description: '完整的AI账号管理权限' },
    
    // v2.4简化：账号绑定权限（替代复杂分配）
    { id: 'binding.create', name: '创建账号绑定', resource: 'account_binding', action: 'create', description: '为拼车组绑定AI账号' },
    { id: 'binding.read', name: '查看账号绑定', resource: 'account_binding', action: 'read', description: '查看账号绑定状态' },
    { id: 'binding.update', name: '修改账号绑定', resource: 'account_binding', action: 'update', description: '修改绑定配置' },
    { id: 'binding.delete', name: '删除账号绑定', resource: 'account_binding', action: 'delete', description: '解除账号绑定' },
    
    // v2.4简化：基础成本监控（替代复杂预算管理）
    { id: 'cost.read', name: '查看成本统计', resource: 'cost', action: 'read', description: '查看基础成本统计' },
    
    // 监控权限
    { id: 'monitor.read', name: '查看监控', resource: 'monitoring', action: 'read', description: '查看系统监控数据' },
    { id: 'monitor.manage', name: '监控管理', resource: 'monitoring', action: 'manage', description: '管理监控配置' },
    
    // AI服务权限
    { id: 'ai_service.use', name: '使用AI服务', resource: 'ai_service', action: 'read', description: '使用AI服务' },
    { id: 'ai_service.manage', name: 'AI服务管理', resource: 'ai_service', action: 'manage', description: '管理AI服务配置' },
  ];

  // 内置角色定义
  private readonly BUILT_IN_ROLES: Role[] = [
    {
      id: 'system_admin',
      name: 'system_admin',
      displayName: '系统管理员',
      description: '拥有系统所有权限的超级管理员',
      permissions: [
        'system.admin',
        'enterprise.read', 'enterprise.update', 'enterprise.manage',
        'department.create', 'department.read', 'department.update', 'department.delete', 'department.manage',
        'group.create', 'group.read', 'group.update', 'group.delete', 'group.manage',
        'user.create', 'user.read', 'user.update', 'user.delete', 'user.manage',
        'account.create', 'account.read', 'account.update', 'account.delete', 'account.manage',
        'binding.create', 'binding.read', 'binding.update', 'binding.delete',
        'cost.read', 'monitor.read', 'monitor.manage',
        'ai_service.use', 'ai_service.manage'
      ],
      isBuiltIn: true,
      isActive: true
    },
    {
      id: 'enterprise_owner',
      name: 'enterprise_owner',
      displayName: '企业所有者',
      description: '企业的创建者和所有者，拥有企业所有权限',
      permissions: [
        'enterprise.read', 'enterprise.update', 'enterprise.manage',
        'department.create', 'department.read', 'department.update', 'department.delete', 'department.manage',
        'group.create', 'group.read', 'group.update', 'group.delete', 'group.manage',
        'user.create', 'user.read', 'user.update', 'user.delete', 'user.manage',
        'account.create', 'account.read', 'account.update', 'account.delete', 'account.manage',
        'binding.create', 'binding.read', 'binding.update', 'binding.delete',
        'cost.read', 'monitor.read', 'monitor.manage',
        'ai_service.use', 'ai_service.manage'
      ],
      isBuiltIn: true,
      isActive: true
    },
    {
      id: 'enterprise_admin',
      name: 'enterprise_admin',
      displayName: '企业管理员',
      description: '拥有企业所有权限的超级管理员',
      permissions: [
        'enterprise.read', 'enterprise.update', 'enterprise.manage',
        'department.create', 'department.read', 'department.update', 'department.delete', 'department.manage',
        'group.create', 'group.read', 'group.update', 'group.delete', 'group.manage',
        'user.create', 'user.read', 'user.update', 'user.delete', 'user.manage',
        'account.create', 'account.read', 'account.update', 'account.delete', 'account.manage',
        'binding.create', 'binding.read', 'binding.update', 'binding.delete',
        'cost.read', 'monitor.read', 'monitor.manage',
        'ai_service.use', 'ai_service.manage'
      ],
      isBuiltIn: true,
      isActive: true
    },
    {
      id: 'enterprise_manager',
      name: 'enterprise_manager',
      displayName: '企业经理',
      description: '企业级管理权限，但不能管理其他管理员',
      permissions: [
        'enterprise.read',
        'department.create', 'department.read', 'department.update', 'department.manage',
        'group.create', 'group.read', 'group.update', 'group.manage',
        'user.read', 'user.update',
        'account.create', 'account.read', 'account.update', 'account.manage',
        'binding.create', 'binding.read', 'binding.update',
        'cost.read', 'ai_service.use', 'ai_service.manage'
      ],
      isBuiltIn: true,
      isActive: true
    },
    {
      id: 'department_admin',
      name: 'department_admin',
      displayName: '部门管理员',
      description: '管理特定部门及其下属组',
      permissions: [
        'department.read', 'department.update',
        'group.create', 'group.read', 'group.update', 'group.delete', 'group.manage',
        'user.read', 'user.update',
        'account.read', 'account.update',
        'binding.create', 'binding.read', 'binding.update',
        'cost.read', 'ai_service.use'
      ],
      isBuiltIn: true,
      isActive: true
    },
    {
      id: 'group_admin',
      name: 'group_admin',
      displayName: '拼车组管理员',
      description: '管理特定拼车组',
      permissions: [
        'group.read', 'group.update', 'group.manage',
        'user.read',
        'binding.create', 'binding.read', 'binding.update', 'binding.delete',
        'ai_service.use', 'cost.read'
      ],
      isBuiltIn: true,
      isActive: true
    },
    {
      id: 'group_member',
      name: 'group_member',
      displayName: '拼车组成员',
      description: '拼车组的普通成员',
      permissions: [
        'group.read',
        'binding.read',
        'ai_service.use',
        'cost.read'
      ],
      isBuiltIn: true,
      isActive: true
    },
    // v2.4新增：拼车组所有者角色
    {
      id: 'carpool_group_owner',
      name: 'carpool_group_owner',
      displayName: '拼车组所有者',
      description: 'v2.4拼车组模式的组创建者，拥有完整控制权',
      permissions: [
        'group.read', 'group.update', 'group.manage', 'group.delete',
        'user.read', 'user.update',
        'account.create', 'account.read', 'account.update', 'account.delete',
        'binding.create', 'binding.read', 'binding.update', 'binding.delete',
        'ai_service.use', 'ai_service.manage',
        'cost.read', 'monitor.read'
      ],
      isBuiltIn: true,
      isActive: true
    }
  ];

  /**
   * 检查用户权限
   */
  async checkPermission(
    userId: string,
    permission: string,
    resourceId?: string,
    enterpriseId?: string
  ): Promise<PermissionCheck> {
    try {
      // 获取用户权限
      const userPermissions = await this.getUserPermissions(userId, enterpriseId);
      
      // 检查是否有直接权限
      for (const userPerm of userPermissions) {
        if (this.hasPermissionInRole(userPerm.role, permission)) {
          // 检查权限范围
          const scopeCheck = this.checkPermissionScope(userPerm, resourceId);
          if (scopeCheck.hasPermission) {
            return {
              hasPermission: true,
              scope: userPerm.scope,
              inheritedFrom: userPerm.role.displayName
            };
          }
        }
      }

      return {
        hasPermission: false,
        reason: '用户没有相应权限'
      };

    } catch (error) {
      console.error('Check permission error:', error);
      return {
        hasPermission: false,
        reason: '权限检查失败'
      };
    }
  }

  /**
   * 获取用户所有权限
   */
  async getUserPermissions(userId: string, enterpriseId?: string): Promise<UserPermission[]> {
    try {
      // 尝试从缓存获取
      const cacheKey = `user_permissions:${userId}:${enterpriseId || 'all'}`;
      const cached = await cacheManager.get<UserPermission[]>(cacheKey);
      if (cached) return cached;

      // 从数据库查询
      const whereCondition: any = { userId, isActive: true };
      if (enterpriseId) {
        whereCondition.enterpriseId = enterpriseId;
      }

      const userRoles = await prisma.userEnterpriseRole.findMany({
        where: whereCondition
      });

      const permissions: UserPermission[] = [];

      for (const userRole of userRoles) {
        // 从内置角色列表中查找角色定义
        const builtInRole = this.BUILT_IN_ROLES.find(r => r.id === userRole.role);
        
        if (!builtInRole) {
          console.warn(`Role ${userRole.role} not found in built-in roles`);
          continue;
        }

        const role: Role = {
          id: builtInRole.id,
          name: builtInRole.name,
          displayName: builtInRole.displayName,
          description: builtInRole.description,
          permissions: builtInRole.permissions,
          isBuiltIn: builtInRole.isBuiltIn,
          isActive: builtInRole.isActive
        };

        permissions.push({
          userId: userRole.userId,
          enterpriseId: userRole.enterpriseId || undefined,
          roleId: userRole.role,
          role,
          scope: userRole.scope,
          resourceId: userRole.resourceId || undefined,
          isActive: userRole.isActive
        });
      }

      // 缓存结果
      await cacheManager.set(cacheKey, permissions, 10 * 60); // 10分钟缓存

      return permissions;

    } catch (error) {
      console.error('Get user permissions error:', error);
      return [];
    }
  }

  /**
   * 获取角色信息
   */
  async getRole(roleId: string, enterpriseId?: string): Promise<Role | null> {
    try {
      // 检查是否是内置角色
      const builtInRole = this.BUILT_IN_ROLES.find(r => r.id === roleId);
      if (builtInRole) {
        return builtInRole;
      }

      // 查询自定义角色
      const customRole = await prisma.enterpriseRole.findFirst({
        where: { 
          id: roleId,
          isActive: true
        },
        include: {
          permissions: true
        }
      });

      if (!customRole) return null;

      return {
        id: customRole.id,
        name: customRole.name,
        displayName: customRole.displayName,
        description: customRole.description || '',
        permissions: customRole.permissions.map(rp => rp.permission),
        isBuiltIn: customRole.isBuiltIn,
        isActive: customRole.isActive
      };

    } catch (error) {
      console.error('Get role error:', error);
      return null;
    }
  }

  /**
   * 为用户分配角色
   */
  async assignRole(
    userId: string,
    roleId: string,
    grantedBy: string,
    options: {
      enterpriseId?: string;
      scope?: string;
      resourceId?: string;
    }
  ): Promise<boolean> {
    try {
      // 检查是否已存在相同的角色分配
      const existing = await prisma.userEnterpriseRole.findFirst({
        where: {
          userId,
          roleId,
          enterpriseId: options.enterpriseId,
          scope: options.scope || 'enterprise',
          resourceId: options.resourceId,
          isActive: true
        }
      });

      if (existing) {
        throw new Error('用户已拥有该角色');
      }

      // 创建角色分配
      await prisma.userEnterpriseRole.create({
        data: {
          userId,
          roleId,
          enterpriseId: options.enterpriseId,
          scope: options.scope || 'enterprise',
          resourceId: options.resourceId,
          isActive: true
        }
      });

      // 清除用户权限缓存
      await this.clearUserPermissionCache(userId, options.enterpriseId);

      return true;

    } catch (error) {
      console.error('Assign role error:', error);
      return false;
    }
  }

  /**
   * 撤销用户角色
   */
  async revokeRole(
    userId: string,
    roleId: string,
    options: {
      enterpriseId?: string;
      scope?: string;
      resourceId?: string;
    }
  ): Promise<boolean> {
    try {
      await prisma.userEnterpriseRole.updateMany({
        where: {
          userId,
          roleId,
          enterpriseId: options.enterpriseId,
          scope: options.scope,
          resourceId: options.resourceId,
          isActive: true
        },
        data: {
          isActive: false
        }
      });

      // 清除用户权限缓存
      await this.clearUserPermissionCache(userId, options.enterpriseId);

      return true;

    } catch (error) {
      console.error('Revoke role error:', error);
      return false;
    }
  }

  /**
   * 创建自定义角色
   */
  async createRole(
    name: string,
    displayName: string,
    permissionIds: string[],
    description?: string
  ): Promise<Role | null> {
    try {
      // 创建角色
      const role = await prisma.enterpriseRole.create({
        data: {
          name,
          displayName,
          description,
          isBuiltIn: false,
          isActive: true
        }
      });

      // 关联权限
      for (const permissionId of permissionIds) {
        await prisma.rolePermission.create({
          data: {
            roleId: role.id,
            permission: permissionId
          }
        });
      }

      // 获取完整角色信息
      return await this.getRole(role.id);

    } catch (error) {
      console.error('Create role error:', error);
      return null;
    }
  }


  /**
   * 检查角色是否拥有权限
   */
  private hasPermissionInRole(role: Role, permission: string): boolean {
    return role.permissions.includes(permission) || 
           role.permissions.includes(permission.split('.')[0] + '.manage');
  }

  /**
   * 检查权限范围
   */
  private checkPermissionScope(userPermission: UserPermission, resourceId?: string): PermissionCheck {
    // 企业级权限可以访问企业下的所有资源
    if (userPermission.scope === 'enterprise') {
      return { hasPermission: true, scope: 'enterprise' };
    }

    // 部门级权限只能访问该部门下的资源
    if (userPermission.scope === 'department') {
      if (!resourceId || resourceId === userPermission.resourceId) {
        return { hasPermission: true, scope: 'department' };
      }
      return { hasPermission: false, reason: '权限范围不匹配' };
    }

    // 组级权限只能访问该组的资源
    if (userPermission.scope === 'group') {
      if (!resourceId || resourceId === userPermission.resourceId) {
        return { hasPermission: true, scope: 'group' };
      }
      return { hasPermission: false, reason: '权限范围不匹配' };
    }

    return { hasPermission: true };
  }

  /**
   * 清除用户权限缓存
   */
  private async clearUserPermissionCache(userId: string, enterpriseId?: string): Promise<void> {
    const patterns = [
      `user_permissions:${userId}:${enterpriseId || 'all'}`,
      `user_permissions:${userId}:*`
    ];

    for (const pattern of patterns) {
      await cacheManager.delPattern(pattern);
    }
  }

  /**
   * 获取所有内置权限
   */
  getBuiltInPermissions(): Permission[] {
    return [...this.BUILT_IN_PERMISSIONS];
  }

  /**
   * 获取所有内置角色
   */
  getBuiltInRoles(): Role[] {
    return this.BUILT_IN_ROLES;
  }

  /**
   * v2.4特定：检查拼车组账号绑定权限
   * 简化权限检查，专门用于一对一绑定场景
   */
  async checkAccountBindingPermission(
    userId: string,
    groupId: string,
    action: 'create' | 'read' | 'update' | 'delete'
  ): Promise<PermissionCheck> {
    try {
      // 检查用户在该拼车组的角色
      const groupMember = await prisma.groupMember.findFirst({
        where: {
          groupId,
          userId
        },
        include: {
          group: {
            select: {
              organizationType: true,
              bindingMode: true,
              enterpriseId: true
            }
          }
        }
      });

      if (!groupMember) {
        return { hasPermission: false, reason: '不是该拼车组成员' };
      }

      // v2.4简化逻辑：拼车组所有者和管理员可以管理绑定
      if (groupMember.role === 'owner' || groupMember.role === 'admin') {
        return { 
          hasPermission: true, 
          scope: 'group',
          inheritedFrom: groupMember.role === 'owner' ? '拼车组所有者' : '拼车组管理员'
        };
      }

      // 普通成员只能查看绑定信息
      if (action === 'read') {
        return { 
          hasPermission: true, 
          scope: 'group',
          inheritedFrom: '拼车组成员'
        };
      }

      return { hasPermission: false, reason: '权限不足' };

    } catch (error) {
      console.error('Check account binding permission error:', error);
      return { hasPermission: false, reason: '权限检查失败' };
    }
  }

  /**
   * v2.4特定：检查企业资源管理权限
   * 简化企业级权限检查
   */
  async checkEnterpriseResourcePermission(
    userId: string,
    enterpriseId: string,
    action: 'create' | 'read' | 'update' | 'delete' | 'allocate'
  ): Promise<PermissionCheck> {
    try {
      // 检查用户在企业的角色
      const userEnterprise = await prisma.userEnterprise.findFirst({
        where: {
          userId,
          enterpriseId,
          isActive: true
        }
      });

      if (!userEnterprise) {
        return { hasPermission: false, reason: '不是该企业成员' };
      }

      // v2.4简化逻辑：基于角色的简单权限检查
      const role = userEnterprise.role;
      
      if (role === 'owner') {
        return { 
          hasPermission: true, 
          scope: 'enterprise',
          inheritedFrom: '企业所有者'
        };
      }

      if (role === 'admin') {
        // 管理员可以进行所有操作
        return { 
          hasPermission: true, 
          scope: 'enterprise',
          inheritedFrom: '企业管理员'
        };
      }

      if (role === 'manager') {
        // 经理可以查看和分配，但不能删除
        if (action === 'delete') {
          return { hasPermission: false, reason: '经理角色无删除权限' };
        }
        return { 
          hasPermission: true, 
          scope: 'enterprise',
          inheritedFrom: '企业经理'
        };
      }

      // 普通成员只能查看
      if (action === 'read') {
        return { 
          hasPermission: true, 
          scope: 'enterprise',
          inheritedFrom: '企业成员'
        };
      }

      return { hasPermission: false, reason: '权限不足' };

    } catch (error) {
      console.error('Check enterprise resource permission error:', error);
      return { hasPermission: false, reason: '权限检查失败' };
    }
  }

  /**
   * v2.4特定：获取用户在拼车组的权限角色
   */
  async getUserGroupRole(userId: string, groupId: string): Promise<string | null> {
    try {
      const groupMember = await prisma.groupMember.findFirst({
        where: {
          userId,
          groupId
        },
        select: {
          role: true
        }
      });

      return groupMember?.role || null;
    } catch (error) {
      console.error('Get user group role error:', error);
      return null;
    }
  }
}

// 创建单例权限管理器
export const permissionManager = new PermissionManager();
export default permissionManager;
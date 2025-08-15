import { 
  Permission, 
  Role, 
  PermissionContext,
  PERMISSIONS,
  ROLES 
} from '@/lib/permission/simple-permission-manager';

/**
 * 权限测试数据工厂
 */
export class PermissionTestFactory {
  /**
   * 创建权限上下文
   */
  static createContext(overrides: Partial<PermissionContext> = {}): PermissionContext {
    return {
      userId: 'test-user-123',
      enterpriseId: 'test-enterprise-456',
      groupId: 'test-group-789',
      ...overrides
    };
  }

  /**
   * 创建系统管理员上下文
   */
  static createAdminContext(): PermissionContext {
    return {
      userId: 'admin-user-001',
      enterpriseId: 'admin-enterprise-001'
    };
  }

  /**
   * 创建企业所有者上下文
   */
  static createOwnerContext(): PermissionContext {
    return {
      userId: 'owner-user-002',
      enterpriseId: 'owner-enterprise-002'
    };
  }

  /**
   * 创建普通成员上下文
   */
  static createMemberContext(): PermissionContext {
    return {
      userId: 'member-user-003',
      enterpriseId: 'member-enterprise-003',
      groupId: 'member-group-003'
    };
  }

  /**
   * 创建用户企业角色数据
   */
  static createUserEnterpriseRole(overrides: any = {}) {
    return {
      id: 'role-id-123',
      userId: 'test-user-123',
      enterpriseId: 'test-enterprise-456',
      role: 'enterprise_admin',
      scope: 'enterprise',
      resourceId: null,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides
    };
  }

  /**
   * 创建多个角色数据
   */
  static createMultipleRoles() {
    return [
      {
        id: 'role-1',
        userId: 'test-user-123',
        enterpriseId: 'enterprise-1',
        role: 'enterprise_owner',
        scope: 'enterprise',
        isActive: true
      },
      {
        id: 'role-2',
        userId: 'test-user-123',
        enterpriseId: 'enterprise-2',
        role: 'group_owner',
        scope: 'group',
        resourceId: 'group-1',
        isActive: true
      },
      {
        id: 'role-3',
        userId: 'test-user-123',
        enterpriseId: 'enterprise-1',
        role: 'group_member',
        scope: 'group',
        resourceId: 'group-2',
        isActive: true
      }
    ];
  }

  /**
   * 获取测试权限列表
   */
  static getTestPermissions(): Permission[] {
    return [
      'enterprise.manage',
      'enterprise.view',
      'group.create',
      'group.manage',
      'group.view',
      'ai.use',
      'user.invite'
    ] as Permission[];
  }

  /**
   * 获取测试角色列表
   */
  static getTestRoles(): Role[] {
    return [
      'system_admin',
      'enterprise_owner',
      'enterprise_admin',
      'group_owner',
      'group_member'
    ] as Role[];
  }

  /**
   * 创建权限测试场景
   */
  static createTestScenarios() {
    return {
      // 系统管理员场景
      systemAdmin: {
        context: { userId: 'admin-001', enterpriseId: 'ent-001' },
        role: 'system_admin' as Role,
        expectedPermissions: ['system.admin', 'enterprise.manage', 'group.manage', 'ai.manage', 'user.manage'] as Permission[]
      },
      
      // 企业所有者场景
      enterpriseOwner: {
        context: { userId: 'owner-001', enterpriseId: 'ent-001' },
        role: 'enterprise_owner' as Role,
        expectedPermissions: ['enterprise.manage', 'group.create', 'group.manage', 'ai.manage', 'user.invite'] as Permission[]
      },
      
      // 拼车组长场景
      groupOwner: {
        context: { userId: 'leader-001', enterpriseId: 'ent-001', groupId: 'group-001' },
        role: 'group_owner' as Role,
        expectedPermissions: ['group.manage', 'ai.use', 'user.invite'] as Permission[]
      },
      
      // 普通成员场景
      groupMember: {
        context: { userId: 'member-001', enterpriseId: 'ent-001', groupId: 'group-001' },
        role: 'group_member' as Role,
        expectedPermissions: ['group.view', 'ai.use'] as Permission[]
      },
      
      // 无权限用户场景
      noPermission: {
        context: { userId: 'guest-001' },
        role: null,
        expectedPermissions: [] as Permission[]
      }
    };
  }

  /**
   * 创建缓存测试数据
   */
  static createCacheTestData() {
    return {
      cacheKey: 'test-user-123-test-enterprise-456-test-group-789',
      permissions: ['enterprise.view', 'group.view', 'ai.use'] as Permission[],
      expiry: Date.now() + 5 * 60 * 1000 // 5分钟后过期
    };
  }

  /**
   * 创建权限继承测试数据
   */
  static createInheritanceTestData() {
    return {
      // 全局权限
      globalRole: {
        role: 'system_admin' as Role,
        scope: 'global',
        expectedAccess: ['all'] // 应该能访问所有资源
      },
      
      // 企业级权限
      enterpriseRole: {
        role: 'enterprise_admin' as Role,
        scope: 'enterprise',
        expectedAccess: ['enterprise', 'groups'] // 应该能访问企业和其下的组
      },
      
      // 组级权限
      groupRole: {
        role: 'group_owner' as Role,
        scope: 'group',
        expectedAccess: ['group'] // 只能访问特定组
      }
    };
  }
}
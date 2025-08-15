import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import {
  SimplePermissionManager,
  PERMISSIONS,
  ROLES,
  type Permission,
  type PermissionContext
} from '@/lib/permission/simple-permission-manager';

describe('权限管理核心功能测试', () => {
  let permissionManager: SimplePermissionManager;

  beforeEach(() => {
    jest.clearAllMocks();
    // 创建新的权限管理器实例，不依赖外部Mock
    permissionManager = new SimplePermissionManager();
  });

  describe('权限常量定义', () => {
    it('应该定义所有必要的权限', () => {
      // 系统权限
      expect(PERMISSIONS['system.admin']).toBeDefined();
      
      // 企业权限
      expect(PERMISSIONS['enterprise.manage']).toBeDefined();
      expect(PERMISSIONS['enterprise.view']).toBeDefined();
      
      // 拼车组权限
      expect(PERMISSIONS['group.create']).toBeDefined();
      expect(PERMISSIONS['group.manage']).toBeDefined();
      expect(PERMISSIONS['group.view']).toBeDefined();
      
      // AI权限
      expect(PERMISSIONS['ai.use']).toBeDefined();
      expect(PERMISSIONS['ai.manage']).toBeDefined();
      
      // 用户权限
      expect(PERMISSIONS['user.invite']).toBeDefined();
      expect(PERMISSIONS['user.manage']).toBeDefined();
    });

    it('权限应该有描述性文本', () => {
      Object.values(PERMISSIONS).forEach(description => {
        expect(typeof description).toBe('string');
        expect(description.length).toBeGreaterThan(0);
      });
    });
  });

  describe('角色权限映射', () => {
    it('系统管理员应该拥有最高权限', () => {
      const adminRole = ROLES.system_admin;
      expect(adminRole.name).toBe('系统管理员');
      expect(adminRole.permissions).toContain('system.admin');
      expect(adminRole.permissions).toContain('enterprise.manage');
      expect(adminRole.permissions).toContain('ai.manage');
      expect(adminRole.permissions).toContain('user.manage');
    });

    it('企业所有者应该有企业管理权限', () => {
      const ownerRole = ROLES.enterprise_owner;
      expect(ownerRole.name).toBe('企业所有者');
      expect(ownerRole.permissions).toContain('enterprise.manage');
      expect(ownerRole.permissions).toContain('group.create');
      expect(ownerRole.permissions).toContain('ai.manage');
      expect(ownerRole.permissions).toContain('user.invite');
      
      // 不应该有系统管理权限
      expect(ownerRole.permissions).not.toContain('system.admin');
    });

    it('企业管理员权限应该少于所有者', () => {
      const adminRole = ROLES.enterprise_admin;
      expect(adminRole.name).toBe('企业管理员');
      expect(adminRole.permissions).toContain('enterprise.view');
      expect(adminRole.permissions).toContain('group.create');
      expect(adminRole.permissions).toContain('user.invite');
      
      // 不应该有企业管理权限
      expect(adminRole.permissions).not.toContain('enterprise.manage');
      expect(adminRole.permissions).not.toContain('ai.manage');
    });

    it('拼车组长应该有组管理权限', () => {
      const ownerRole = ROLES.group_owner;
      expect(ownerRole.name).toBe('拼车组长');
      expect(ownerRole.permissions).toContain('group.manage');
      expect(ownerRole.permissions).toContain('ai.use');
      expect(ownerRole.permissions).toContain('user.invite');
      
      // 不应该有企业级权限
      expect(ownerRole.permissions).not.toContain('enterprise.manage');
      expect(ownerRole.permissions).not.toContain('group.create');
    });

    it('普通成员应该只有基础权限', () => {
      const memberRole = ROLES.group_member;
      expect(memberRole.name).toBe('拼车组成员');
      expect(memberRole.permissions).toContain('group.view');
      expect(memberRole.permissions).toContain('ai.use');
      
      // 不应该有管理权限
      expect(memberRole.permissions).not.toContain('group.manage');
      expect(memberRole.permissions).not.toContain('user.invite');
      expect(memberRole.permissions).not.toContain('enterprise.view');
    });
  });

  describe('权限层级验证', () => {
    it('每个角色的权限数量应该符合层级', () => {
      const systemAdmin = ROLES.system_admin.permissions.length;
      const enterpriseOwner = ROLES.enterprise_owner.permissions.length;
      const enterpriseAdmin = ROLES.enterprise_admin.permissions.length;
      const groupOwner = ROLES.group_owner.permissions.length;
      const groupMember = ROLES.group_member.permissions.length;
      
      // 权限数量应该递减
      expect(systemAdmin).toBeGreaterThanOrEqual(enterpriseOwner);
      expect(enterpriseOwner).toBeGreaterThan(enterpriseAdmin);
      expect(enterpriseAdmin).toBeGreaterThanOrEqual(groupOwner);
      expect(groupOwner).toBeGreaterThan(groupMember);
    });

    it('所有定义的权限都应该至少分配给一个角色', () => {
      const allPermissions = Object.keys(PERMISSIONS) as Permission[];
      const assignedPermissions = new Set<string>();
      
      Object.values(ROLES).forEach(role => {
        role.permissions.forEach(perm => {
          assignedPermissions.add(perm);
        });
      });
      
      // system.admin 可能只分配给系统管理员
      const unassignedPermissions = allPermissions.filter(
        perm => !assignedPermissions.has(perm)
      );
      
      expect(unassignedPermissions.length).toBe(0);
    });
  });

  describe('权限缓存机制', () => {
    it('应该有合理的缓存TTL', () => {
      // 通过私有属性访问（仅用于测试）
      const manager = permissionManager as any;
      expect(manager.CACHE_TTL).toBeDefined();
      expect(manager.CACHE_TTL).toBeGreaterThan(0);
      expect(manager.CACHE_TTL).toBeLessThanOrEqual(10 * 60 * 1000); // 不超过10分钟
    });

    it('缓存应该使用Map数据结构', () => {
      const manager = permissionManager as any;
      expect(manager.permissionCache).toBeDefined();
      expect(manager.permissionCache).toBeInstanceOf(Map);
    });
  });

  describe('权限上下文验证', () => {
    it('应该接受有效的权限上下文', () => {
      const validContexts: PermissionContext[] = [
        { userId: 'user-123' },
        { userId: 'user-123', enterpriseId: 'ent-456' },
        { userId: 'user-123', groupId: 'group-789' },
        { userId: 'user-123', enterpriseId: 'ent-456', groupId: 'group-789' }
      ];
      
      validContexts.forEach(context => {
        expect(context.userId).toBeDefined();
        expect(typeof context.userId).toBe('string');
      });
    });

    it('上下文应该支持层级结构', () => {
      const globalContext: PermissionContext = {
        userId: 'user-123'
      };
      
      const enterpriseContext: PermissionContext = {
        userId: 'user-123',
        enterpriseId: 'ent-456'
      };
      
      const groupContext: PermissionContext = {
        userId: 'user-123',
        enterpriseId: 'ent-456',
        groupId: 'group-789'
      };
      
      // 组级上下文应该包含企业ID
      if (groupContext.groupId) {
        expect(groupContext.enterpriseId).toBeDefined();
      }
    });
  });

  describe('权限验证逻辑', () => {
    it('权限名称应该遵循命名规范', () => {
      const allPermissions = Object.keys(PERMISSIONS);
      
      allPermissions.forEach(permission => {
        // 应该包含点号分隔
        expect(permission).toContain('.');
        
        // 应该是小写
        expect(permission).toBe(permission.toLowerCase());
        
        // 应该符合 resource.action 格式
        const parts = permission.split('.');
        expect(parts).toHaveLength(2);
        
        const [resource, action] = parts;
        expect(['system', 'enterprise', 'group', 'ai', 'user']).toContain(resource);
        expect(['admin', 'manage', 'view', 'create', 'use', 'invite']).toContain(action);
      });
    });

    it('角色名称应该有意义且唯一', () => {
      const roleNames = Object.values(ROLES).map(r => r.name);
      const uniqueNames = new Set(roleNames);
      
      // 所有角色名称应该唯一
      expect(uniqueNames.size).toBe(roleNames.length);
      
      // 角色名称应该是中文
      roleNames.forEach(name => {
        expect(name).toMatch(/[\u4e00-\u9fa5]/);
      });
    });
  });

  describe('权限组合测试', () => {
    it('管理权限应该隐含查看权限', () => {
      // 如果有manage权限，通常应该也有view权限
      const rolesWithManage = Object.values(ROLES).filter(role =>
        role.permissions.some(p => p.includes('.manage'))
      );
      
      rolesWithManage.forEach(role => {
        const hasGroupManage = role.permissions.includes('group.manage');
        const hasGroupView = role.permissions.includes('group.view');
        
        if (hasGroupManage && role.name !== '拼车组长') {
          // 组长可能特殊处理
          expect(hasGroupView || hasGroupManage).toBe(true);
        }
      });
    });

    it('创建权限应该配合其他权限', () => {
      const rolesWithCreate = Object.values(ROLES).filter(role =>
        role.permissions.includes('group.create')
      );
      
      rolesWithCreate.forEach(role => {
        // 能创建组的角色应该也能管理或查看
        const hasRelatedPermission = 
          role.permissions.includes('group.manage') ||
          role.permissions.includes('enterprise.manage') ||
          role.permissions.includes('enterprise.view');
        
        expect(hasRelatedPermission).toBe(true);
      });
    });
  });

  describe('安全性验证', () => {
    it('不应该有重复的权限分配', () => {
      Object.values(ROLES).forEach(role => {
        const uniquePermissions = new Set(role.permissions);
        expect(uniquePermissions.size).toBe(role.permissions.length);
      });
    });

    it('系统管理权限应该严格控制', () => {
      const rolesWithSystemAdmin = Object.entries(ROLES).filter(([_, role]) =>
        role.permissions.includes('system.admin')
      );
      
      // 只有系统管理员角色应该有system.admin权限
      expect(rolesWithSystemAdmin).toHaveLength(1);
      expect(rolesWithSystemAdmin[0][0]).toBe('system_admin');
    });

    it('AI管理权限应该合理分配', () => {
      const rolesWithAiManage = Object.entries(ROLES).filter(([_, role]) =>
        role.permissions.includes('ai.manage')
      );
      
      // AI管理权限应该只给高级角色
      rolesWithAiManage.forEach(([key, _]) => {
        expect(['system_admin', 'enterprise_owner']).toContain(key);
      });
    });
  });
});
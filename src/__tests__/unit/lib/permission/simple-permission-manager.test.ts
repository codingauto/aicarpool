import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import {
  SimplePermissionManager,
  PERMISSIONS,
  ROLES,
  type Permission,
  type Role,
  type PermissionContext
} from '@/lib/permission/simple-permission-manager';
import { createPrismaMock } from '@/test-utils/mocks/setup-prisma-mock';

// 创建Prisma Mock
const prismaMock = createPrismaMock();

// Mock Prisma模块
jest.mock('@/lib/prisma', () => ({
  prisma: prismaMock
}));

describe('SimplePermissionManager', () => {
  let permissionManager: SimplePermissionManager;
  
  beforeEach(() => {
    jest.clearAllMocks();
    permissionManager = new SimplePermissionManager();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('hasPermission', () => {
    const mockContext: PermissionContext = {
      userId: 'user-123',
      enterpriseId: 'enterprise-456',
      groupId: 'group-789'
    };

    it('应该允许系统管理员访问所有权限', async () => {
      prismaMock.user.findUnique.mockResolvedValue({
        id: 'user-123',
        role: 'system_admin'
      });

      const result = await permissionManager.hasPermission(mockContext, 'system.admin');
      expect(result).toBe(true);
      
      const result2 = await permissionManager.hasPermission(mockContext, 'enterprise.manage');
      expect(result2).toBe(true);
    });

    it('应该允许企业所有者管理企业', async () => {
      prismaMock.user.findUnique.mockResolvedValue({
        id: 'user-123',
        role: 'user'
      });
      
      prismaMock.userEnterprise.findFirst.mockResolvedValue({
        userId: 'user-123',
        enterpriseId: 'enterprise-456',
        role: 'owner'
      });

      const result = await permissionManager.hasPermission(mockContext, 'enterprise.manage');
      expect(result).toBe(true);
    });

    it('应该拒绝普通成员的管理权限', async () => {
      prismaMock.user.findUnique.mockResolvedValue({
        id: 'user-123',
        role: 'user'
      });
      
      prismaMock.userEnterprise.findFirst.mockResolvedValue({
        userId: 'user-123',
        enterpriseId: 'enterprise-456',
        role: 'member'
      });

      prismaMock.groupMember.findFirst.mockResolvedValue({
        userId: 'user-123',
        groupId: 'group-789',
        role: 'member'
      });

      const result = await permissionManager.hasPermission(mockContext, 'enterprise.manage');
      expect(result).toBe(false);
    });

    it('应该允许拼车组长管理组', async () => {
      prismaMock.user.findUnique.mockResolvedValue({
        id: 'user-123',
        role: 'user'
      });
      
      prismaMock.groupMember.findFirst.mockResolvedValue({
        userId: 'user-123',
        groupId: 'group-789',
        role: 'owner'
      });

      const result = await permissionManager.hasPermission(mockContext, 'group.manage');
      expect(result).toBe(true);
    });

    it('应该使用缓存避免重复查询', async () => {
      prismaMock.user.findUnique.mockResolvedValue({
        id: 'user-123',
        role: 'user'
      });
      
      prismaMock.userEnterprise.findFirst.mockResolvedValue({
        userId: 'user-123',
        enterpriseId: 'enterprise-456',
        role: 'admin'
      });

      // 第一次调用
      await permissionManager.hasPermission(mockContext, 'enterprise.view');
      
      // 第二次调用（应该使用缓存）
      await permissionManager.hasPermission(mockContext, 'enterprise.view');
      
      // 验证只查询了一次数据库
      expect(prismaMock.user.findUnique).toHaveBeenCalledTimes(1);
      expect(prismaMock.userEnterprise.findFirst).toHaveBeenCalledTimes(1);
    });

    it('应该在缓存过期后重新查询', async () => {
      jest.useFakeTimers();
      
      prismaMock.user.findUnique.mockResolvedValue({
        id: 'user-123',
        role: 'user'
      });
      
      prismaMock.userEnterprise.findFirst.mockResolvedValue({
        userId: 'user-123',
        enterpriseId: 'enterprise-456',
        role: 'admin'
      });

      // 第一次调用
      await permissionManager.hasPermission(mockContext, 'enterprise.view');
      
      // 快进超过缓存TTL（5分钟）
      jest.advanceTimersByTime(6 * 60 * 1000);
      
      // 第二次调用（缓存已过期）
      await permissionManager.hasPermission(mockContext, 'enterprise.view');
      
      // 验证查询了两次数据库
      expect(prismaMock.user.findUnique).toHaveBeenCalledTimes(2);
    });

    it('应该处理无效的权限名称', async () => {
      prismaMock.user.findUnique.mockResolvedValue({
        id: 'user-123',
        role: 'user'
      });

      const result = await permissionManager.hasPermission(mockContext, 'invalid.permission' as Permission);
      expect(result).toBe(false);
    });

    it('应该处理用户不存在的情况', async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);

      const result = await permissionManager.hasPermission(mockContext, 'enterprise.view');
      expect(result).toBe(false);
    });

    it('应该处理数据库错误', async () => {
      prismaMock.user.findUnique.mockRejectedValue(new Error('Database error'));

      const result = await permissionManager.hasPermission(mockContext, 'enterprise.view');
      expect(result).toBe(false);
    });
  });

  describe('getUserPermissions', () => {
    it('应该返回用户的所有权限', async () => {
      prismaMock.user.findUnique.mockResolvedValue({
        id: 'user-123',
        role: 'user'
      });
      
      prismaMock.userEnterprise.findFirst.mockResolvedValue({
        userId: 'user-123',
        enterpriseId: 'enterprise-456',
        role: 'admin'
      });

      const permissions = await permissionManager.getUserPermissions({
        userId: 'user-123',
        enterpriseId: 'enterprise-456'
      });

      expect(permissions).toContain('enterprise.view');
      expect(permissions).toContain('group.create');
      expect(permissions).toContain('group.manage');
      expect(permissions).toContain('user.invite');
    });

    it('应该合并多个角色的权限', async () => {
      prismaMock.user.findUnique.mockResolvedValue({
        id: 'user-123',
        role: 'user'
      });
      
      prismaMock.userEnterprise.findFirst.mockResolvedValue({
        userId: 'user-123',
        enterpriseId: 'enterprise-456',
        role: 'admin'
      });
      
      prismaMock.groupMember.findFirst.mockResolvedValue({
        userId: 'user-123',
        groupId: 'group-789',
        role: 'owner'
      });

      const permissions = await permissionManager.getUserPermissions({
        userId: 'user-123',
        enterpriseId: 'enterprise-456',
        groupId: 'group-789'
      });

      // 应该包含企业管理员和组长的权限
      expect(permissions).toContain('enterprise.view');
      expect(permissions).toContain('group.manage');
      expect(permissions).toContain('ai.use');
    });

    it('应该去重权限列表', async () => {
      prismaMock.user.findUnique.mockResolvedValue({
        id: 'user-123',
        role: 'user'
      });
      
      prismaMock.userEnterprise.findFirst.mockResolvedValue({
        userId: 'user-123',
        enterpriseId: 'enterprise-456',
        role: 'owner'
      });

      const permissions = await permissionManager.getUserPermissions({
        userId: 'user-123',
        enterpriseId: 'enterprise-456'
      });

      // 检查没有重复的权限
      const uniquePermissions = [...new Set(permissions)];
      expect(permissions.length).toBe(uniquePermissions.length);
    });
  });

  describe('getUserRoles', () => {
    it('应该返回用户的所有角色', async () => {
      prismaMock.user.findUnique.mockResolvedValue({
        id: 'user-123',
        role: 'system_admin'
      });
      
      prismaMock.userEnterprise.findFirst.mockResolvedValue({
        userId: 'user-123',
        enterpriseId: 'enterprise-456',
        role: 'owner'
      });

      const roles = await permissionManager.getUserRoles({
        userId: 'user-123',
        enterpriseId: 'enterprise-456'
      });

      expect(roles).toContain('system_admin');
      expect(roles).toContain('enterprise_owner');
    });

    it('应该处理只有组角色的用户', async () => {
      prismaMock.user.findUnique.mockResolvedValue({
        id: 'user-123',
        role: 'user'
      });
      
      prismaMock.userEnterprise.findFirst.mockResolvedValue(null);
      
      prismaMock.groupMember.findFirst.mockResolvedValue({
        userId: 'user-123',
        groupId: 'group-789',
        role: 'member'
      });

      const roles = await permissionManager.getUserRoles({
        userId: 'user-123',
        groupId: 'group-789'
      });

      expect(roles).toContain('group_member');
      expect(roles).not.toContain('enterprise_owner');
    });
  });

  describe('clearCache', () => {
    it('应该清除所有缓存', async () => {
      prismaMock.user.findUnique.mockResolvedValue({
        id: 'user-123',
        role: 'user'
      });
      
      prismaMock.userEnterprise.findFirst.mockResolvedValue({
        userId: 'user-123',
        enterpriseId: 'enterprise-456',
        role: 'admin'
      });

      const context: PermissionContext = {
        userId: 'user-123',
        enterpriseId: 'enterprise-456'
      };

      // 第一次调用（缓存）
      await permissionManager.hasPermission(context, 'enterprise.view');
      
      // 清除缓存
      permissionManager.clearCache();
      
      // 第二次调用（应该重新查询）
      await permissionManager.hasPermission(context, 'enterprise.view');
      
      // 验证查询了两次数据库
      expect(prismaMock.user.findUnique).toHaveBeenCalledTimes(2);
    });

    it('应该清除特定用户的缓存', async () => {
      prismaMock.user.findUnique.mockResolvedValue({
        id: 'user-123',
        role: 'user'
      });

      const context1: PermissionContext = {
        userId: 'user-123',
        enterpriseId: 'enterprise-456'
      };
      
      const context2: PermissionContext = {
        userId: 'user-456',
        enterpriseId: 'enterprise-456'
      };

      // 缓存两个用户
      await permissionManager.hasPermission(context1, 'enterprise.view');
      await permissionManager.hasPermission(context2, 'enterprise.view');
      
      // 清除第一个用户的缓存
      permissionManager.clearUserCache('user-123');
      
      // 再次查询
      await permissionManager.hasPermission(context1, 'enterprise.view');
      await permissionManager.hasPermission(context2, 'enterprise.view');
      
      // user-123 应该查询了2次，user-456 应该查询了1次（使用缓存）
      expect(prismaMock.user.findUnique).toHaveBeenCalledTimes(3);
    });
  });

  describe('角色权限映射', () => {
    it('系统管理员应该有所有权限', () => {
      const adminPermissions = ROLES.system_admin.permissions;
      expect(adminPermissions).toContain('system.admin');
      expect(adminPermissions).toContain('enterprise.manage');
      expect(adminPermissions).toContain('group.manage');
      expect(adminPermissions).toContain('ai.manage');
    });

    it('企业所有者应该有企业管理权限', () => {
      const ownerPermissions = ROLES.enterprise_owner.permissions;
      expect(ownerPermissions).toContain('enterprise.manage');
      expect(ownerPermissions).toContain('group.create');
      expect(ownerPermissions).not.toContain('system.admin');
    });

    it('普通成员应该只有基础权限', () => {
      const memberPermissions = ROLES.group_member.permissions;
      expect(memberPermissions).toContain('group.view');
      expect(memberPermissions).toContain('ai.use');
      expect(memberPermissions).not.toContain('group.manage');
      expect(memberPermissions).not.toContain('enterprise.manage');
    });
  });

  describe('边界条件', () => {
    it('应该处理空context', async () => {
      const emptyContext: PermissionContext = {
        userId: ''
      };

      const result = await permissionManager.hasPermission(emptyContext, 'enterprise.view');
      expect(result).toBe(false);
    });

    it('应该处理并发权限检查', async () => {
      prismaMock.user.findUnique.mockResolvedValue({
        id: 'user-123',
        role: 'user'
      });
      
      prismaMock.userEnterprise.findFirst.mockResolvedValue({
        userId: 'user-123',
        enterpriseId: 'enterprise-456',
        role: 'admin'
      });

      const context: PermissionContext = {
        userId: 'user-123',
        enterpriseId: 'enterprise-456'
      };

      // 并发检查多个权限
      const results = await Promise.all([
        permissionManager.hasPermission(context, 'enterprise.view'),
        permissionManager.hasPermission(context, 'group.create'),
        permissionManager.hasPermission(context, 'user.invite'),
        permissionManager.hasPermission(context, 'ai.use')
      ]);

      // 应该只查询一次数据库（使用缓存）
      expect(prismaMock.user.findUnique).toHaveBeenCalledTimes(1);
      
      // 验证权限结果
      expect(results[0]).toBe(true); // enterprise.view
      expect(results[1]).toBe(true); // group.create
      expect(results[2]).toBe(true); // user.invite
    });
  });

  describe('性能测试', () => {
    it('权限检查应该在合理时间内完成', async () => {
      prismaMock.user.findUnique.mockResolvedValue({
        id: 'user-123',
        role: 'user'
      });

      const context: PermissionContext = {
        userId: 'user-123'
      };

      const startTime = Date.now();
      
      // 执行100次权限检查
      const promises = Array(100).fill(null).map((_, i) => 
        permissionManager.hasPermission(context, 'enterprise.view')
      );
      
      await Promise.all(promises);
      
      const endTime = Date.now();
      const totalTime = endTime - startTime;
      
      // 应该在100ms内完成（利用缓存）
      expect(totalTime).toBeLessThan(100);
    });
  });
});
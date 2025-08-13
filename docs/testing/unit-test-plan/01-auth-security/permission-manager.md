# 权限管理测试计划

## 📋 模块概述

**文件路径**: 
- `src/lib/enterprise/permission-manager.ts`
- `src/lib/permission/simple-permission-manager.ts`
- `src/lib/enterprise-permissions.ts`

**功能描述**: 
权限管理系统负责控制用户对资源的访问权限，包括角色定义、权限分配、权限验证等核心功能。支持企业级的细粒度权限控制。

**重要性**: 🔴 **极高** - 直接影响系统安全性和数据隔离

## 🎯 测试范围

### 核心功能测试点

| 功能模块 | 优先级 | 测试重点 |
|---------|--------|----------|
| 权限验证 | 高 | checkPermission(), hasPermission() |
| 角色管理 | 高 | assignRole(), removeRole(), getRoles() |
| 权限分配 | 高 | grantPermission(), revokePermission() |
| 权限继承 | 中 | 角色层级，权限传递 |
| 权限缓存 | 中 | 缓存有效性，更新机制 |
| 批量操作 | 低 | 批量授权，批量撤销 |

## 📝 详细测试用例

### 1. 权限验证测试

```typescript
describe('PermissionManager - 权限验证', () => {
  describe('checkPermission', () => {
    it('应该允许有权限的用户访问资源', () => {
      // 准备: 用户有 'read:users' 权限
      // 动作: checkPermission(userId, 'read:users')
      // 期望: 返回 true
    });

    it('应该拒绝无权限的用户访问', () => {
      // 准备: 用户没有 'delete:users' 权限
      // 动作: checkPermission(userId, 'delete:users')
      // 期望: 返回 false
    });

    it('应该支持通配符权限', () => {
      // 准备: 用户有 'admin:*' 权限
      // 动作: checkPermission(userId, 'admin:users')
      // 期望: 返回 true
    });

    it('应该验证资源级权限', () => {
      // 准备: 用户有特定资源权限
      // 动作: checkPermission(userId, 'edit:user:123')
      // 期望: 正确验证资源ID
    });

    it('应该处理权限继承', () => {
      // 准备: admin角色包含所有user权限
      // 动作: 用户是admin，检查user权限
      // 期望: 继承的权限生效
    });
  });

  describe('hasPermission - 批量权限检查', () => {
    it('应该支持AND逻辑', () => {
      // 输入: ['read:users', 'write:users'], operator: 'AND'
      // 期望: 所有权限都有才返回true
    });

    it('应该支持OR逻辑', () => {
      // 输入: ['read:users', 'write:users'], operator: 'OR'
      // 期望: 有任一权限就返回true
    });
  });
});
```

### 2. 角色管理测试

```typescript
describe('角色管理', () => {
  describe('assignRole', () => {
    it('应该成功分配角色给用户', () => {
      // 动作: assignRole(userId, 'editor')
      // 期望: 用户获得editor角色
    });

    it('应该防止重复分配相同角色', () => {
      // 准备: 用户已有editor角色
      // 动作: 再次分配editor
      // 期望: 返回已存在提示
    });

    it('应该处理角色冲突', () => {
      // 准备: viewer和editor互斥
      // 动作: 同时分配两个角色
      // 期望: 检测并处理冲突
    });

    it('应该记录角色分配历史', () => {
      // 动作: 分配角色
      // 期望: 审计日志记录操作
    });
  });

  describe('removeRole', () => {
    it('应该撤销用户角色', () => {
      // 准备: 用户有admin角色
      // 动作: removeRole(userId, 'admin')
      // 期望: 角色被移除
    });

    it('应该级联删除相关权限', () => {
      // 准备: 角色关联多个权限
      // 动作: 删除角色
      // 期望: 相关权限同时清理
    });
  });
});
```

### 3. 企业级权限测试

```typescript
describe('企业权限管理', () => {
  describe('企业隔离', () => {
    it('不同企业的权限应该完全隔离', () => {
      // 准备: 两个企业的同名角色
      // 期望: 权限互不影响
    });

    it('应该支持企业级默认权限', () => {
      // 准备: 企业设置默认权限
      // 期望: 新用户自动获得
    });
  });

  describe('部门权限', () => {
    it('应该支持部门级权限继承', () => {
      // 准备: 部门有特定权限
      // 期望: 部门成员继承权限
    });

    it('应该处理部门层级', () => {
      // 准备: 多级部门结构
      // 期望: 正确处理权限传递
    });
  });
});
```

### 4. 权限缓存测试

```typescript
describe('权限缓存', () => {
  it('应该缓存频繁查询的权限', () => {
    // 第一次查询: 从数据库
    // 第二次查询: 从缓存
    // 期望: 性能提升
  });

  it('权限更新应该刷新缓存', () => {
    // 动作: 修改权限
    // 期望: 缓存自动失效
  });

  it('应该设置合理的TTL', () => {
    // 期望: 缓存5分钟后过期
  });
});
```

## 🔧 Mock策略

### 数据库Mock

```typescript
const mockPrisma = {
  userRole: {
    findMany: jest.fn(),
    create: jest.fn(),
    delete: jest.fn()
  },
  permission: {
    findMany: jest.fn(),
    create: jest.fn()
  },
  role: {
    findUnique: jest.fn(),
    findMany: jest.fn()
  }
};
```

### Redis缓存Mock

```typescript
const mockRedis = {
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
  expire: jest.fn()
};
```

## 🔍 边界条件测试

### 性能边界
- 用户有1000+权限时的查询性能
- 批量分配10000个权限
- 深度嵌套的角色继承（10层+）

### 数据边界
- 权限名称最大长度
- 特殊字符处理
- 空值和null处理

### 并发场景
- 同时修改同一用户权限
- 缓存竞态条件
- 分布式环境下的一致性

## ⚡ 性能要求

```typescript
describe('性能测试', () => {
  it('单个权限检查 < 10ms', () => {
    // 包含缓存查询
  });

  it('批量权限检查(100个) < 50ms', () => {
    // 批量优化
  });

  it('权限分配 < 100ms', () => {
    // 包含数据库写入
  });
});
```

## ✅ 验收标准

### 功能验收
- [ ] 所有权限检查准确无误
- [ ] 角色分配和撤销正常
- [ ] 权限继承逻辑正确
- [ ] 企业隔离完全有效

### 性能验收
- [ ] 查询响应时间达标
- [ ] 缓存命中率 > 90%
- [ ] 支持10000+用户规模

### 安全验收
- [ ] 无权限提升漏洞
- [ ] 无权限绕过可能
- [ ] 审计日志完整

## 📚 测试数据

```typescript
export const testRoles = {
  admin: {
    id: 'role-admin',
    name: 'admin',
    permissions: ['*']
  },
  editor: {
    id: 'role-editor',
    name: 'editor',
    permissions: ['read:*', 'write:*']
  },
  viewer: {
    id: 'role-viewer',
    name: 'viewer',
    permissions: ['read:*']
  }
};

export const testPermissions = [
  'read:users',
  'write:users',
  'delete:users',
  'read:groups',
  'manage:enterprise',
  'admin:system'
];
```

## 🚀 实施计划

| 阶段 | 任务 | 工时 |
|------|------|------|
| Day 1 | 基础权限验证测试 | 4h |
| Day 2 | 角色管理测试 | 4h |
| Day 3 | 企业级权限测试 | 6h |
| Day 4 | 缓存和性能测试 | 4h |
| Day 5 | 集成测试和优化 | 2h |

---

*创建日期: 2025-01-12*
*负责人: 权限测试小组*
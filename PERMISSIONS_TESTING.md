# AiCarpool v2.5 权限管理系统测试指南

## 系统概述

AiCarpool v2.5 权限管理系统已完全实现，支持：
- **5层角色体系**：system_admin → enterprise_owner → enterprise_admin → group_owner → group_member
- **9类基础权限**：system.admin, enterprise.manage/view, group.create/manage/view, ai.use/manage, user.invite/manage
- **3级权限范围**：global (全局) → enterprise (企业) → group (拼车组)

## 测试账号

### 1. 系统管理员
- **邮箱**: admin@aicarpool.com
- **密码**: admin123456
- **角色**: system_admin (全局范围)
- **权限**: 拥有所有系统权限

### 2. 测试用户 
- **ID**: user_test_001
- **角色**: enterprise_admin (企业范围) + group_owner (组范围)
- **权限**: enterprise.view, group.create, group.manage, ai.use, user.invite

## API 测试

### 全局权限 API

```bash
# 测试普通用户权限
curl 'http://localhost:4000/api/permissions'

# 测试系统管理员权限
curl 'http://localhost:4000/api/permissions?test_user=admin'
```

**预期结果**：
- 普通用户：返回5个权限 (enterprise.view, group.create, group.manage, ai.use, user.invite)
- 系统管理员：返回5个最高权限 (system.admin, enterprise.manage, group.manage, ai.manage, user.manage)

### 企业权限 API

```bash
# 获取企业权限信息
curl 'http://localhost:4000/api/enterprises/ent_test_001/permissions'

# 分配角色 (需要POST请求)
curl -X POST 'http://localhost:4000/api/enterprises/ent_test_001/permissions' \
  -H 'Content-Type: application/json' \
  -d '{
    "action": "assign_role",
    "targetUserId": "user_new_001",
    "role": "group_member",
    "scope": "group",
    "resourceId": "group_test_001"
  }'
```

## 前端页面测试

### 权限管理页面
- **URL**: http://localhost:4000/permissions
- **功能**: 显示当前用户的权限、角色、企业关系
- **特性**: 
  - 实时从API获取数据
  - shadcn/ui 组件界面
  - 响应式设计

### 企业权限页面  
- **URL**: http://localhost:4000/enterprise/ent_test_001/permissions
- **功能**: 企业级权限管理界面
- **特性**: 支持角色分配、权限查看

## 权限验证测试

### 权限检查函数

```typescript
import { createPermissionManager } from '@/lib/permission/simple-permission-manager';
import { prisma } from '@/lib/prisma';

const permissionManager = createPermissionManager(prisma);

// 检查用户是否有特定权限
const hasPermission = await permissionManager.hasPermission(
  { userId: 'user_test_001', enterpriseId: 'ent_test_001' },
  'group.manage'
);

// 获取用户所有权限
const permissions = await permissionManager.getUserPermissions(
  { userId: 'user_test_001' }
);

// 分配角色
const success = await permissionManager.assignRole(
  { userId: 'admin_user_id' },
  'target_user_id',
  'group_member',
  'group',
  'group_test_001'
);
```

## 数据库脚本

### 创建系统管理员
```bash
npm run db:create-admin
npm run db:assign-admin-permissions
```

### 创建测试数据
```bash
npm run db:seed
# 或者运行权限专用种子数据
tsx prisma/seed-permissions.ts
```

## 权限层级说明

### 角色继承关系
1. **system_admin**: 最高权限，可管理整个系统
2. **enterprise_owner**: 企业所有者，可管理整个企业
3. **enterprise_admin**: 企业管理员，可管理企业和创建拼车组
4. **group_owner**: 拼车组长，可管理自己的拼车组
5. **group_member**: 拼车组成员，基础使用权限

### 权限范围优先级
1. **global**: 全局权限，作用于整个系统
2. **enterprise**: 企业权限，作用于特定企业
3. **group**: 组权限，作用于特定拼车组

## 安全特性

- ✅ 权限范围隔离：不同范围的权限相互独立
- ✅ 角色级联检查：支持多级权限继承
- ✅ 数据库约束：通过索引和外键保证数据一致性
- ✅ API权限验证：所有敏感操作都需要权限检查
- ✅ 开发模式支持：便于测试不同用户权限

## 故障排除

### 常见问题

1. **权限API返回401**: 检查当前用户认证状态
2. **前端显示"加载中"**: 检查API是否正常返回数据
3. **角色分配失败**: 检查分配者是否有 `user.manage` 或 `user.invite` 权限
4. **数据库连接错误**: 检查 Prisma 配置和数据库状态

### 调试技巧

1. 查看开发日志：`tail -f dev.log`
2. 检查API响应：使用浏览器开发者工具或curl
3. 数据库查询：直接查询 `user_enterprise_roles` 表
4. 权限计算：使用 SimplePermissionManager 的调试输出

## 完成状态

✅ **数据库模型**: UserEnterpriseRole 表已优化  
✅ **权限管理器**: SimplePermissionManager 完全实现  
✅ **API接口**: 全局和企业权限API正常工作  
✅ **前端界面**: 权限页面使用真实数据  
✅ **系统管理员**: 创建和权限分配完成  
✅ **测试数据**: 种子数据和测试账号就绪  

**版本**: AiCarpool v2.5 权限管理系统  
**状态**: ✅ 生产就绪
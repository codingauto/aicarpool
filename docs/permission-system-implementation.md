# AiCarpool 权限管理系统实现文档

## 概述
本文档记录了 AiCarpool v2.5 权限管理系统的完整实现，包括 JWT 认证、RBAC 权限模型、部门管理和审计日志等核心功能。

## 系统架构

### 1. JWT 认证系统
- **位置**: `/src/lib/auth/`
- **核心文件**:
  - `jwt-utils.ts`: JWT token 生成、验证和刷新
  - `auth-utils.ts`: 统一的认证工具函数
- **特性**:
  - Access Token: 15分钟有效期
  - Refresh Token: 7天有效期
  - 自动刷新机制

### 2. RBAC 权限模型
- **角色定义**:
  - `system_admin`: 系统管理员
  - `enterprise_owner`: 企业拥有者
  - `enterprise_admin`: 企业管理员
  - `group_owner`: 拼车组拥有者
  - `group_member`: 拼车组成员
- **权限范围**:
  - `global`: 全局权限
  - `enterprise`: 企业级权限
  - `group`: 拼车组权限

### 3. 数据库设计
```sql
-- 用户企业角色表
UserEnterpriseRole {
  id String
  userId String
  enterpriseId String?
  groupId String?
  role String
  scope String
  isActive Boolean
  createdAt DateTime
  updatedAt DateTime
}

-- 部门表
Department {
  id String
  enterpriseId String
  parentId String?
  name String
  description String?
  leaderId String?
  budgetLimit Float?
}

-- 用户部门关联表
UserDepartment {
  userId String
  departmentId String
  role String
  isActive Boolean
  joinedAt DateTime
}

-- 审计日志表
AuditLog {
  id String
  userId String
  enterpriseId String
  action String
  entityType String
  entityId String
  details Json
  ipAddress String
  userAgent String
  createdAt DateTime
}
```

## API 端点

### 认证相关
- `POST /api/auth/login` - 用户登录，返回 JWT token 对
- `POST /api/auth/refresh` - 刷新 access token
- `POST /api/auth/logout` - 用户登出

### 权限管理
- `GET /api/enterprises/[enterpriseId]/permissions` - 获取企业权限数据
- `POST /api/enterprises/[enterpriseId]/permissions` - 更新用户权限
- `GET /api/enterprises/[enterpriseId]/roles` - 获取角色列表
- `POST /api/enterprises/[enterpriseId]/roles` - 创建/更新/删除角色

### 部门管理
- `GET /api/enterprises/[enterpriseId]/departments` - 获取部门列表
- `POST /api/enterprises/[enterpriseId]/departments` - 创建部门
- `PUT /api/enterprises/[enterpriseId]/departments` - 更新部门
- `DELETE /api/enterprises/[enterpriseId]/departments` - 删除部门

### 部门成员
- `GET /api/enterprises/[enterpriseId]/departments/[departmentId]/members` - 获取部门成员
- `POST /api/enterprises/[enterpriseId]/departments/[departmentId]/members` - 添加/移除成员
- `PUT /api/enterprises/[enterpriseId]/departments/[departmentId]/members/[userId]` - 更新成员角色

### 审计日志
- `GET /api/enterprises/[enterpriseId]/audit-logs` - 获取审计日志

## UI 组件

### 页面
- `/enterprise/[enterpriseId]/permissions` - 权限管理主页面
  - 用户管理 Tab
  - 角色管理 Tab
  - 权限列表 Tab
  - 部门权限 Tab

### 对话框组件
- `UserDetailsDialog` - 用户详情和权限编辑
- `RoleManagementDialog` - 角色管理
- `BatchUserManagementDialog` - 批量用户管理
- `DepartmentManagementDialog` - 部门创建/编辑
- `BatchDepartmentDialog` - 批量部门成员管理

### 展示组件
- `AuditLogViewer` - 审计日志查看器

## 初始化脚本

### 权限系统初始化
```bash
npm run init-permissions
```
执行内容：
1. 创建系统管理员账号
2. 分配全局权限
3. 创建默认企业
4. 初始化部门结构
5. 迁移现有用户权限

### 数据库迁移
```bash
npm run db:migrate-permissions
```

## 默认账号信息

### 系统管理员
- 邮箱: admin@aicarpool.com
- 密码: Admin@123456
- 权限: 全局系统管理员权限

### 默认企业
- 名称: AiCarpool默认企业
- 计划类型: professional
- 默认部门:
  - 技术部
  - 产品部
  - 运营部

## 使用示例

### 1. 用户登录获取 Token
```bash
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@aicarpool.com",
    "password": "Admin@123456"
  }'
```

### 2. 使用 Token 访问受保护的 API
```bash
curl -H "Authorization: Bearer [ACCESS_TOKEN]" \
  http://localhost:4000/api/enterprises/[enterpriseId]/permissions
```

### 3. 创建部门
```bash
curl -X POST http://localhost:4000/api/enterprises/[enterpriseId]/departments \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer [ACCESS_TOKEN]" \
  -d '{
    "name": "研发部",
    "description": "负责产品研发",
    "parentId": null
  }'
```

## 安全考虑

1. **Token 安全**
   - Access Token 短期有效（15分钟）
   - Refresh Token 长期有效（7天）
   - Token 使用 HS256 算法签名
   - 不同的密钥用于不同类型的 token

2. **权限验证**
   - 所有 API 端点都进行权限检查
   - 基于角色的访问控制
   - 细粒度的权限范围

3. **审计日志**
   - 记录所有权限相关操作
   - 包含操作者、时间、IP 地址等信息
   - 可用于安全审计和问题追踪

## 后续优化建议

1. **性能优化**
   - 实现权限缓存机制
   - 优化部门树形结构查询
   - 添加 Redis 缓存层

2. **功能扩展**
   - 添加权限模板功能
   - 实现权限继承机制
   - 添加临时权限授予功能

3. **安全增强**
   - 实现双因素认证
   - 添加 IP 白名单功能
   - 实现会话管理和强制登出

## 测试覆盖

### 已测试功能
- ✅ JWT 登录和 token 生成
- ✅ 部门 CRUD 操作
- ✅ 权限页面展示
- ✅ 初始化脚本执行

### 待测试功能
- [ ] Token 刷新机制
- [ ] 批量用户操作
- [ ] 审计日志记录
- [ ] 权限继承和传递

## 问题修复记录

1. **中间件 exports 错误**
   - 问题：Next.js 中间件报 "exports is not defined"
   - 解决：暂时禁用中间件，使用 API 级别的认证

2. **数据库字段缺失**
   - 问题：Enterprise 模型缺少 description 和 status 字段
   - 解决：将这些字段移至 settings JSON 字段

3. **User 模型缺少 lastLoginAt**
   - 问题：登录时无法更新最后登录时间
   - 解决：注释掉相关代码，考虑后续添加字段

## 版本信息
- 实现版本：v2.5
- Next.js：15.4.3
- Prisma：6.12.0
- 完成日期：2025-08-11
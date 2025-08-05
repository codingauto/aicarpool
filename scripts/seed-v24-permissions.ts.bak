/**
 * v2.4权限系统种子数据
 * 初始化简化的权限管理体系
 */

import { prisma } from '../src/lib/prisma';

async function main() {
  console.log('🔐 开始初始化v2.4权限系统...');

  try {
    // 1. 清理现有权限数据
    console.log('清理现有权限数据...');
    await prisma.rolePermission.deleteMany();
    await prisma.userEnterpriseRole.deleteMany();
    await prisma.enterpriseRole.deleteMany();

    // 2. 创建内置角色
    console.log('创建v2.4内置角色...');
    
    // 企业管理员角色
    const enterpriseAdminRole = await prisma.enterpriseRole.create({
      data: {
        id: 'enterprise_admin',
        name: 'enterprise_admin',
        displayName: '企业管理员',
        description: '拥有企业所有权限的超级管理员',
        isBuiltIn: true,
        isActive: true
      }
    });

    // 企业经理角色
    const enterpriseManagerRole = await prisma.enterpriseRole.create({
      data: {
        id: 'enterprise_manager',
        name: 'enterprise_manager', 
        displayName: '企业经理',
        description: '企业级管理权限，但不能管理其他管理员',
        isBuiltIn: true,
        isActive: true
      }
    });

    // 部门管理员角色
    const departmentAdminRole = await prisma.enterpriseRole.create({
      data: {
        id: 'department_admin',
        name: 'department_admin',
        displayName: '部门管理员', 
        description: '管理特定部门及其下属组',
        isBuiltIn: true,
        isActive: true
      }
    });

    // 拼车组管理员角色
    const groupAdminRole = await prisma.enterpriseRole.create({
      data: {
        id: 'group_admin',
        name: 'group_admin',
        displayName: '拼车组管理员',
        description: '管理特定拼车组',
        isBuiltIn: true,
        isActive: true
      }
    });

    // 拼车组成员角色
    const groupMemberRole = await prisma.enterpriseRole.create({
      data: {
        id: 'group_member',
        name: 'group_member',
        displayName: '拼车组成员',
        description: '拼车组的普通成员',
        isBuiltIn: true,
        isActive: true
      }
    });

    // v2.4新增：拼车组所有者角色
    const carpoolGroupOwnerRole = await prisma.enterpriseRole.create({
      data: {
        id: 'carpool_group_owner',
        name: 'carpool_group_owner',
        displayName: '拼车组所有者',
        description: 'v2.4拼车组模式的组创建者，拥有完整控制权',
        isBuiltIn: true,
        isActive: true
      }
    });

    // 3. 创建权限并分配给角色
    console.log('创建v2.4权限体系...');

    // v2.4简化权限定义
    const permissions = [
      // 企业管理权限
      { permission: 'enterprise.manage', roleIds: ['enterprise_admin'] },
      { permission: 'enterprise.read', roleIds: ['enterprise_admin', 'enterprise_manager', 'department_admin'] },
      
      // 部门管理权限
      { permission: 'department.create', roleIds: ['enterprise_admin', 'enterprise_manager'] },
      { permission: 'department.read', roleIds: ['enterprise_admin', 'enterprise_manager', 'department_admin'] },
      { permission: 'department.update', roleIds: ['enterprise_admin', 'enterprise_manager', 'department_admin'] },
      { permission: 'department.delete', roleIds: ['enterprise_admin', 'enterprise_manager'] },
      { permission: 'department.manage', roleIds: ['enterprise_admin', 'enterprise_manager', 'department_admin'] },
      
      // 组管理权限
      { permission: 'group.create', roleIds: ['enterprise_admin', 'enterprise_manager', 'department_admin'] },
      { permission: 'group.read', roleIds: ['enterprise_admin', 'enterprise_manager', 'department_admin', 'group_admin', 'group_member', 'carpool_group_owner'] },
      { permission: 'group.update', roleIds: ['enterprise_admin', 'enterprise_manager', 'department_admin', 'group_admin', 'carpool_group_owner'] },
      { permission: 'group.delete', roleIds: ['enterprise_admin', 'enterprise_manager', 'department_admin', 'group_admin', 'carpool_group_owner'] },
      { permission: 'group.manage', roleIds: ['enterprise_admin', 'enterprise_manager', 'department_admin', 'group_admin', 'carpool_group_owner'] },
      
      // 用户管理权限
      { permission: 'user.create', roleIds: ['enterprise_admin'] },
      { permission: 'user.read', roleIds: ['enterprise_admin', 'enterprise_manager', 'department_admin', 'group_admin', 'carpool_group_owner'] },
      { permission: 'user.update', roleIds: ['enterprise_admin', 'enterprise_manager', 'department_admin', 'carpool_group_owner'] },
      { permission: 'user.delete', roleIds: ['enterprise_admin'] },
      { permission: 'user.manage', roleIds: ['enterprise_admin'] },
      
      // v2.4简化：AI账号管理权限（替代账号池）
      { permission: 'account.create', roleIds: ['enterprise_admin', 'enterprise_manager', 'carpool_group_owner'] },
      { permission: 'account.read', roleIds: ['enterprise_admin', 'enterprise_manager', 'department_admin', 'group_admin', 'carpool_group_owner'] },
      { permission: 'account.update', roleIds: ['enterprise_admin', 'enterprise_manager', 'carpool_group_owner'] },
      { permission: 'account.delete', roleIds: ['enterprise_admin', 'carpool_group_owner'] },
      { permission: 'account.manage', roleIds: ['enterprise_admin', 'enterprise_manager'] },
      
      // v2.4简化：账号绑定权限（替代复杂分配）
      { permission: 'binding.create', roleIds: ['enterprise_admin', 'enterprise_manager', 'department_admin', 'group_admin', 'carpool_group_owner'] },
      { permission: 'binding.read', roleIds: ['enterprise_admin', 'enterprise_manager', 'department_admin', 'group_admin', 'group_member', 'carpool_group_owner'] },
      { permission: 'binding.update', roleIds: ['enterprise_admin', 'enterprise_manager', 'department_admin', 'group_admin', 'carpool_group_owner'] },
      { permission: 'binding.delete', roleIds: ['enterprise_admin', 'enterprise_manager', 'department_admin', 'group_admin', 'carpool_group_owner'] },
      
      // v2.4简化：基础成本监控（替代复杂预算管理）
      { permission: 'cost.read', roleIds: ['enterprise_admin', 'enterprise_manager', 'department_admin', 'group_admin', 'group_member', 'carpool_group_owner'] },
      
      // 监控权限
      { permission: 'monitor.read', roleIds: ['enterprise_admin', 'enterprise_manager', 'carpool_group_owner'] },
      { permission: 'monitor.manage', roleIds: ['enterprise_admin'] },
      
      // AI服务权限
      { permission: 'ai_service.use', roleIds: ['enterprise_admin', 'enterprise_manager', 'department_admin', 'group_admin', 'group_member', 'carpool_group_owner'] },
      { permission: 'ai_service.manage', roleIds: ['enterprise_admin', 'enterprise_manager', 'carpool_group_owner'] },
    ];

    // 创建角色权限关联
    for (const { permission, roleIds } of permissions) {
      for (const roleId of roleIds) {
        await prisma.rolePermission.create({
          data: {
            roleId,
            permission
          }
        });
      }
    }

    // 4. 为测试企业创建测试用户角色分配
    console.log('创建测试用户角色分配...');
    
    // 查找测试企业
    const testEnterprise = await prisma.enterprise.findFirst({
      where: { name: 'AI创新科技有限公司' }
    });

    if (testEnterprise) {
      // 创建企业管理员用户角色
      await prisma.userEnterpriseRole.upsert({
        where: {
          userId_roleId_enterpriseId: {
            userId: 'user_test_admin',
            roleId: 'enterprise_admin',
            enterpriseId: testEnterprise.id
          }
        },
        update: {},
        create: {
          userId: 'user_test_admin',
          roleId: 'enterprise_admin',
          enterpriseId: testEnterprise.id,
          scope: 'enterprise',
          isActive: true
        }
      });

      // 创建拼车组所有者用户角色
      await prisma.userEnterpriseRole.upsert({
        where: {
          userId_roleId_enterpriseId: {
            userId: 'user_test_owner',
            roleId: 'carpool_group_owner',
            enterpriseId: testEnterprise.id
          }
        },
        update: {},
        create: {
          userId: 'user_test_owner',
          roleId: 'carpool_group_owner',
          enterpriseId: testEnterprise.id,
          scope: 'group',
          resourceId: 'group_test_001',
          isActive: true
        }
      });

      // 创建拼车组成员用户角色
      await prisma.userEnterpriseRole.upsert({
        where: {
          userId_roleId_enterpriseId: {
            userId: 'user_test_member',
            roleId: 'group_member',
            enterpriseId: testEnterprise.id
          }
        },
        update: {},
        create: {
          userId: 'user_test_member',
          roleId: 'group_member',
          enterpriseId: testEnterprise.id,
          scope: 'group',
          resourceId: 'group_test_001',
          isActive: true
        }
      });

      console.log(`✅ 为企业 ${testEnterprise.name} 创建了测试用户角色分配`);
    }

    console.log('🎉 v2.4权限系统初始化完成！');
    console.log('\n📋 创建的角色:');
    console.log('- enterprise_admin: 企业管理员');
    console.log('- enterprise_manager: 企业经理');
    console.log('- department_admin: 部门管理员');
    console.log('- group_admin: 拼车组管理员');
    console.log('- group_member: 拼车组成员');
    console.log('- carpool_group_owner: 拼车组所有者 (v2.4新增)');
    
    console.log('\n🔑 测试账号:');
    console.log('- user_test_admin: 企业管理员权限');
    console.log('- user_test_owner: 拼车组所有者权限');
    console.log('- user_test_member: 拼车组成员权限');

  } catch (error) {
    console.error('❌ 权限系统初始化失败:', error);
    throw error;
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
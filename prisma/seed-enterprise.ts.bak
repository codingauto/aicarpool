import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seedEnterpriseData() {
  console.log('🌱 开始初始化企业级数据...');

  try {
    // 1. 创建示例企业
    const enterprises = await Promise.all([
      prisma.enterprise.upsert({
        where: { id: 'ent_001' },
        update: {},
        create: {
          id: 'ent_001',
          name: 'AI创新科技有限公司',
          planType: 'enterprise',
          settings: {
            allowDepartmentBudget: true,
            enableAccountPoolSharing: true,
            defaultModelPriority: ['claude-4-sonnet', 'claude-4-opus', 'kimi-k2']
          }
        }
      }),
      prisma.enterprise.upsert({
        where: { id: 'ent_002' },
        update: {},
        create: {
          id: 'ent_002',
          name: '智能科技发展有限公司',
          planType: 'professional',
          settings: {
            allowDepartmentBudget: true,
            enableAccountPoolSharing: false,
            defaultModelPriority: ['claude-4-sonnet', 'kimi-k2']
          }
        }
      })
    ]);

    console.log('✅ 创建企业数据完成');

    // 2. 创建部门层级结构
    const departments = await Promise.all([
      // AI创新科技的部门
      prisma.department.upsert({
        where: { id: 'dept_001' },
        update: {},
        create: {
          id: 'dept_001',
          enterpriseId: 'ent_001',
          name: '研发部',
          description: '负责产品研发和技术创新',
          budgetLimit: 50000.00,
          parentId: null
        }
      }),
      prisma.department.upsert({
        where: { id: 'dept_002' },
        update: {},
        create: {
          id: 'dept_002',
          enterpriseId: 'ent_001',
          name: '前端开发组',
          description: '负责前端产品开发',
          budgetLimit: 15000.00,
          parentId: 'dept_001'
        }
      }),
      prisma.department.upsert({
        where: { id: 'dept_003' },
        update: {},
        create: {
          id: 'dept_003',
          enterpriseId: 'ent_001',
          name: '后端开发组',
          description: '负责后端服务开发',
          budgetLimit: 20000.00,
          parentId: 'dept_001'
        }
      }),
      prisma.department.upsert({
        where: { id: 'dept_004' },
        update: {},
        create: {
          id: 'dept_004',
          enterpriseId: 'ent_001',
          name: '产品部',
          description: '负责产品规划和设计',
          budgetLimit: 30000.00,
          parentId: null
        }
      }),
      // 智能科技的部门
      prisma.department.upsert({
        where: { id: 'dept_005' },
        update: {},
        create: {
          id: 'dept_005',
          enterpriseId: 'ent_002',
          name: '技术部',
          description: '技术研发和维护',
          budgetLimit: 25000.00,
          parentId: null
        }
      })
    ]);

    console.log('✅ 创建部门结构完成');

    // 3. 创建账号池
    const accountPools = await Promise.all([
      prisma.accountPool.upsert({
        where: { id: 'pool_001' },
        update: {},
        create: {
          id: 'pool_001',
          enterpriseId: 'ent_001',
          name: '企业共享池',
          description: '企业级共享AI账号池，支持负载均衡',
          poolType: 'shared',
          loadBalanceStrategy: 'round_robin',
          maxLoadPerAccount: 80,
          priority: 1,
          isActive: true
        }
      }),
      prisma.accountPool.upsert({
        where: { id: 'pool_002' },
        update: {},
        create: {
          id: 'pool_002',
          enterpriseId: 'ent_001',
          name: '高优先级池',
          description: '高优先级任务专用账号池',
          poolType: 'dedicated',
          loadBalanceStrategy: 'least_connections',
          maxLoadPerAccount: 60,
          priority: 0,
          isActive: true
        }
      }),
      prisma.accountPool.upsert({
        where: { id: 'pool_003' },
        update: {},
        create: {
          id: 'pool_003',
          enterpriseId: 'ent_002',
          name: '基础服务池',
          description: '基础AI服务账号池',
          poolType: 'shared',
          loadBalanceStrategy: 'weighted',
          maxLoadPerAccount: 70,
          priority: 1,
          isActive: true
        }
      })
    ]);

    console.log('✅ 创建账号池完成');

    // 4. 创建内置角色
    const enterpriseRoles = await Promise.all([
      prisma.enterpriseRole.upsert({
        where: { id: 'enterprise_admin' },
        update: {},
        create: {
          id: 'enterprise_admin',
          name: 'enterprise_admin',
          displayName: '企业管理员',
          description: '拥有企业所有权限的超级管理员',
          isBuiltIn: true,
          isActive: true
        }
      }),
      prisma.enterpriseRole.upsert({
        where: { id: 'enterprise_manager' },
        update: {},
        create: {
          id: 'enterprise_manager',
          name: 'enterprise_manager',
          displayName: '企业经理',
          description: '企业级管理权限，但不能管理其他管理员',
          isBuiltIn: true,
          isActive: true
        }
      }),
      prisma.enterpriseRole.upsert({
        where: { id: 'department_admin' },
        update: {},
        create: {
          id: 'department_admin',
          name: 'department_admin',
          displayName: '部门管理员',
          description: '管理特定部门及其下属组',
          isBuiltIn: true,
          isActive: true
        }
      }),
      prisma.enterpriseRole.upsert({
        where: { id: 'group_admin' },
        update: {},
        create: {
          id: 'group_admin',
          name: 'group_admin',
          displayName: '拼车组管理员',
          description: '管理特定拼车组',
          isBuiltIn: true,
          isActive: true
        }
      }),
      prisma.enterpriseRole.upsert({
        where: { id: 'group_member' },
        update: {},
        create: {
          id: 'group_member',
          name: 'group_member',
          displayName: '拼车组成员',
          description: '拼车组的普通成员',
          isBuiltIn: true,
          isActive: true
        }
      })
    ]);

    console.log('✅ 创建企业角色完成');

    // 5. 创建角色权限关联
    const rolePermissions = [
      // 企业管理员权限
      { roleId: 'enterprise_admin', permission: 'enterprise.manage' },
      { roleId: 'enterprise_admin', permission: 'department.manage' },
      { roleId: 'enterprise_admin', permission: 'group.manage' },
      { roleId: 'enterprise_admin', permission: 'user.manage' },
      { roleId: 'enterprise_admin', permission: 'pool.manage' },
      { roleId: 'enterprise_admin', permission: 'budget.manage' },
      { roleId: 'enterprise_admin', permission: 'monitor.manage' },
      { roleId: 'enterprise_admin', permission: 'ai_service.manage' },
      
      // 企业经理权限
      { roleId: 'enterprise_manager', permission: 'enterprise.read' },
      { roleId: 'enterprise_manager', permission: 'department.manage' },
      { roleId: 'enterprise_manager', permission: 'group.manage' },
      { roleId: 'enterprise_manager', permission: 'user.read' },
      { roleId: 'enterprise_manager', permission: 'user.update' },
      { roleId: 'enterprise_manager', permission: 'pool.manage' },
      { roleId: 'enterprise_manager', permission: 'budget.read' },
      { roleId: 'enterprise_manager', permission: 'budget.update' },
      
      // 部门管理员权限
      { roleId: 'department_admin', permission: 'department.read' },
      { roleId: 'department_admin', permission: 'department.update' },
      { roleId: 'department_admin', permission: 'group.manage' },
      { roleId: 'department_admin', permission: 'user.read' },
      { roleId: 'department_admin', permission: 'user.update' },
      { roleId: 'department_admin', permission: 'pool.read' },
      { roleId: 'department_admin', permission: 'pool.update' },
      { roleId: 'department_admin', permission: 'budget.read' },
      
      // 拼车组管理员权限
      { roleId: 'group_admin', permission: 'group.read' },
      { roleId: 'group_admin', permission: 'group.update' },
      { roleId: 'group_admin', permission: 'user.read' },
      
      // 拼车组成员权限
      { roleId: 'group_member', permission: 'group.read' },
      { roleId: 'group_member', permission: 'ai_service.use' }
    ];

    await Promise.all(
      rolePermissions.map(rp =>
        prisma.rolePermission.upsert({
          where: {
            roleId_permission: {
              roleId: rp.roleId,
              permission: rp.permission
            }
          },
          update: {},
          create: rp
        })
      )
    );

    console.log('✅ 创建角色权限关联完成');

    // 6. 创建预算分配示例
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    // 创建预算分配示例 - 使用createMany避免重复
    const existingBudgets = await prisma.budgetAllocation.findMany({
      where: {
        OR: [
          { entityType: 'enterprise', entityId: 'ent_001' },
          { entityType: 'department', entityId: 'dept_001' },
          { entityType: 'department', entityId: 'dept_004' }
        ],
        budgetPeriod: 'monthly',
        periodStart: monthStart
      }
    });

    const budgetsToCreate = [];
    
    if (!existingBudgets.find(b => b.entityType === 'enterprise' && b.entityId === 'ent_001')) {
      budgetsToCreate.push({
        entityType: 'enterprise',
        entityId: 'ent_001',
        budgetPeriod: 'monthly',
        budgetAmount: 100000.00,
        usedAmount: 23450.80,
        periodStart: monthStart,
        periodEnd: monthEnd,
        isActive: true
      });
    }
    
    if (!existingBudgets.find(b => b.entityType === 'department' && b.entityId === 'dept_001')) {
      budgetsToCreate.push({
        entityType: 'department',
        entityId: 'dept_001',
        budgetPeriod: 'monthly',
        budgetAmount: 50000.00,
        usedAmount: 12340.50,
        periodStart: monthStart,
        periodEnd: monthEnd,
        isActive: true
      });
    }
    
    if (!existingBudgets.find(b => b.entityType === 'department' && b.entityId === 'dept_004')) {
      budgetsToCreate.push({
        entityType: 'department',
        entityId: 'dept_004',
        budgetPeriod: 'monthly',
        budgetAmount: 30000.00,
        usedAmount: 8760.20,
        periodStart: monthStart,
        periodEnd: monthEnd,
        isActive: true
      });
    }

    if (budgetsToCreate.length > 0) {
      await prisma.budgetAllocation.createMany({
        data: budgetsToCreate,
        skipDuplicates: true
      });
    }

    console.log('✅ 创建预算分配完成');

    console.log('🎉 企业级数据初始化完成！');
    
    // 输出创建的数据统计
    const stats = {
      enterprises: enterprises.length,
      departments: departments.length,
      accountPools: accountPools.length,
      roles: enterpriseRoles.length,
      rolePermissions: rolePermissions.length
    };
    
    console.log('📊 数据统计:', stats);

  } catch (error) {
    console.error('❌ 初始化企业级数据失败:', error);
    throw error;
  }
}

// 运行种子数据初始化
if (require.main === module) {
  seedEnterpriseData()
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}

export { seedEnterpriseData };
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixEnterprisePermissions() {
  console.log('🔧 开始修复企业权限数据...');

  try {
    // 1. 查找所有通过邀请链接创建的临时拼车组
    const pendingGroups = await prisma.group.findMany({
      where: {
        organizationType: 'enterprise_group',
        status: 'pending',
        name: {
          startsWith: '邀请链接组-'
        }
      },
      include: {
        enterprise: true
      }
    });

    console.log(`📋 找到 ${pendingGroups.length} 个待处理的临时拼车组`);

    // 2. 为每个临时拼车组添加资源绑定
    for (const group of pendingGroups) {
      if (!group.enterpriseId) {
        console.log(`⚠️  拼车组 ${group.id} 没有关联企业，跳过`);
        continue;
      }

      // 检查是否已有资源绑定
      const existingBinding = await prisma.groupResourceBinding.findFirst({
        where: { groupId: group.id }
      });

      if (!existingBinding) {
        console.log(`📌 为拼车组 ${group.name} 创建资源绑定...`);
        
        // 查找企业的AI账号
        const enterpriseAccounts = await prisma.aiServiceAccount.findMany({
          where: {
            enterpriseId: group.enterpriseId,
            status: 'active'
          },
          take: 1
        });

        if (enterpriseAccounts.length > 0) {
          // 创建资源绑定
          const resourceBinding = await prisma.groupResourceBinding.create({
            data: {
              groupId: group.id,
              bindingMode: 'enterprise_pool', // 企业资源池模式
              bindingConfig: {
                accountIds: [enterpriseAccounts[0].id],
                useSmartRouter: true
              },
              dailyTokenLimit: 100000, // 10万 tokens/天
              monthlyBudget: 1000, // $1000/月
              priorityLevel: 'high',
              warningThreshold: 80,
              alertThreshold: 95
            }
          });
          console.log(`✅ 创建资源绑定成功: ${resourceBinding.id}`);
        } else {
          console.log(`⚠️  企业 ${group.enterpriseId} 没有可用的AI账号`);
        }
      }

      // 更新拼车组状态为 active
      await prisma.group.update({
        where: { id: group.id },
        data: { status: 'active' }
      });
      console.log(`✅ 更新拼车组状态为 active: ${group.name}`);
    }

    // 3. 查找所有企业用户并确保他们有正确的权限
    const enterpriseUsers = await prisma.userEnterprise.findMany({
      where: {
        isActive: true
      },
      include: {
        user: true,
        enterprise: true
      }
    });

    console.log(`\n👥 检查 ${enterpriseUsers.length} 个企业用户的权限...`);

    for (const userEnt of enterpriseUsers) {
      // 检查是否有权限角色
      const existingRole = await prisma.userEnterpriseRole.findFirst({
        where: {
          userId: userEnt.userId,
          enterpriseId: userEnt.enterpriseId,
          isActive: true
        }
      });

      if (!existingRole) {
        console.log(`🔑 为用户 ${userEnt.user.name} 在企业 ${userEnt.enterprise.name} 创建权限角色...`);
        
        // 根据 UserEnterprise 的角色创建对应的权限角色
        const roleMap: Record<string, string> = {
          'admin': 'enterprise_admin',
          'manager': 'department_manager',
          'member': 'member'
        };

        const role = roleMap[userEnt.role] || 'member';

        const userRole = await prisma.userEnterpriseRole.create({
          data: {
            userId: userEnt.userId,
            enterpriseId: userEnt.enterpriseId,
            role: role,
            scope: 'enterprise',
            isActive: true
          }
        });

        console.log(`✅ 创建权限角色成功: ${userRole.role}`);
      }
    }

    // 4. 为企业创建默认的权限数据（如果不存在）
    const enterprises = await prisma.enterprise.findMany();
    
    for (const enterprise of enterprises) {
      // 检查企业设置
      const settings = await prisma.enterpriseSettings.findUnique({
        where: { enterpriseId: enterprise.id }
      });

      if (!settings) {
        console.log(`⚙️  为企业 ${enterprise.name} 创建默认设置...`);
        await prisma.enterpriseSettings.create({
          data: {
            enterpriseId: enterprise.id,
            allowMemberInvite: true,
            requireApproval: false,
            defaultRole: 'member',
            aiServiceConfig: {},
            notificationConfig: {},
            features: {} // 默认功能配置
          }
        });
        console.log(`✅ 创建企业设置成功`);
      }
    }

    console.log('\n🎉 企业权限数据修复完成！');
    
    // 5. 显示统计信息
    const stats = {
      pendingGroupsFixed: pendingGroups.length,
      usersChecked: enterpriseUsers.length,
      enterprisesChecked: enterprises.length
    };
    
    console.log('\n📊 修复统计:');
    console.log(`- 修复的临时拼车组: ${stats.pendingGroupsFixed}`);
    console.log(`- 检查的用户数: ${stats.usersChecked}`);
    console.log(`- 检查的企业数: ${stats.enterprisesChecked}`);

  } catch (error) {
    console.error('❌ 修复权限数据时出错:', error);
    throw error;
  }
}

// 执行修复
fixEnterprisePermissions()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
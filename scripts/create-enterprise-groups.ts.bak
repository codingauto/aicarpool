import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function createEnterpriseGroups() {
  console.log('🚗 创建企业拼车组...');

  try {
    // 获取用户和企业信息
    const enterprise = await prisma.enterprise.findUnique({
      where: { id: 'ent_001' }
    });

    if (!enterprise) {
      throw new Error('企业 ent_001 不存在');
    }

    const users = await prisma.user.findMany({
      where: {
        userEnterprises: {
          some: {
            enterpriseId: 'ent_001'
          }
        }
      }
    });

    if (users.length === 0) {
      throw new Error('没有找到属于企业的用户');
    }

    // 创建拼车组
    const groups = [
      {
        id: 'grp_001',
        name: '前端开发组',
        description: '前端开发团队的AI拼车组，专注于UI/UX开发',
        enterpriseId: 'ent_001',
        departmentId: 'dept_002',
        maxMembers: 8,
        createdById: users[0].id
      },
      {
        id: 'grp_002',
        name: '后端开发组',
        description: '后端开发团队的AI拼车组，专注于服务端开发',
        enterpriseId: 'ent_001',
        departmentId: 'dept_003',
        maxMembers: 10,
        createdById: users[0].id
      },
      {
        id: 'grp_003',
        name: '产品设计组',
        description: '产品设计团队的AI拼车组，专注于产品设计和用户体验',
        enterpriseId: 'ent_001',
        departmentId: 'dept_004',
        maxMembers: 6,
        createdById: users[0].id
      },
      {
        id: 'grp_004',
        name: '全栈开发组',
        description: '全栈开发团队的AI拼车组，涵盖前后端开发',
        enterpriseId: 'ent_001',
        departmentId: 'dept_001',
        maxMembers: 12,
        createdById: users[0].id
      }
    ];

    for (const groupData of groups) {
      const existingGroup = await prisma.group.findUnique({
        where: { id: groupData.id }
      });

      if (!existingGroup) {
        const group = await prisma.group.create({
          data: groupData
        });

        console.log(`✅ 创建拼车组: ${group.name}`);

        // 为拼车组添加成员
        const membersToAdd = users.slice(0, Math.min(groupData.maxMembers - 1, users.length));
        
        for (let i = 0; i < membersToAdd.length; i++) {
          const user = membersToAdd[i];
          const role = i === 0 ? 'admin' : 'member';

          await prisma.groupMember.create({
            data: {
              groupId: group.id,
              userId: user.id,
              role: role,
              status: 'active'
            }
          });

          console.log(`   添加成员: ${user.name} (${role})`);
        }

      } else {
        console.log(`⚠️  拼车组已存在: ${existingGroup.name}`);
      }
    }

    // 创建AI服务账号
    const aiServiceAccounts = [
      {
        id: 'acc_001',
        enterpriseId: 'ent_001',
        name: 'Claude主账号-1',
        description: '企业主要的Claude服务账号',
        serviceType: 'claude',
        accountType: 'shared',
        authType: 'api_key',
        encryptedCredentials: JSON.stringify({
          apiKey: 'sk-test-claude-account-1',
          endpoint: 'https://api.anthropic.com'
        }),
        supportedModels: JSON.stringify(['claude-4-sonnet', 'claude-4-opus']),
        currentModel: 'claude-4-sonnet',
        dailyLimit: 10000,
        costPerToken: 0.000015,
        isEnabled: true,
        status: 'active'
      },
      {
        id: 'acc_002',
        enterpriseId: 'ent_001',
        name: 'Claude备用账号-1',
        description: '企业备用的Claude服务账号',
        serviceType: 'claude',
        accountType: 'shared',
        authType: 'api_key',
        encryptedCredentials: JSON.stringify({
          apiKey: 'sk-test-claude-account-2',
          endpoint: 'https://api.anthropic.com'
        }),
        supportedModels: JSON.stringify(['claude-4-sonnet']),
        currentModel: 'claude-4-sonnet',
        dailyLimit: 8000,
        costPerToken: 0.000015,
        isEnabled: true,
        status: 'active'
      },
      {
        id: 'acc_003',
        enterpriseId: 'ent_001',
        name: 'Kimi专用账号',
        description: '企业的Kimi服务账号',
        serviceType: 'kimi',
        accountType: 'dedicated',
        authType: 'api_key',
        encryptedCredentials: JSON.stringify({
          apiKey: 'kimi-test-key-1',
          endpoint: 'https://api.moonshot.cn'
        }),
        supportedModels: JSON.stringify(['kimi-k2', 'kimi-k1']),
        currentModel: 'kimi-k2',
        dailyLimit: 15000,
        costPerToken: 0.000002,
        isEnabled: true,
        status: 'active'
      }
    ];

    for (const accountData of aiServiceAccounts) {
      const existingAccount = await prisma.aiServiceAccount.findUnique({
        where: { id: accountData.id }
      });

      if (!existingAccount) {
        const account = await prisma.aiServiceAccount.create({
          data: accountData
        });

        console.log(`✅ 创建AI服务账号: ${account.name} (${account.serviceType})`);
      } else {
        console.log(`⚠️  AI服务账号已存在: ${existingAccount.name}`);
      }
    }

    // 将AI服务账号绑定到账号池
    const pool = await prisma.accountPool.findUnique({
      where: { id: 'pool_001' }
    });

    if (pool) {
      for (const accountData of aiServiceAccounts) {
        const existingBinding = await prisma.accountPoolBinding.findFirst({
          where: {
            poolId: pool.id,
            accountId: accountData.id
          }
        });

        if (!existingBinding) {
          await prisma.accountPoolBinding.create({
            data: {
              poolId: pool.id,
              accountId: accountData.id,
              weight: 1,
              maxLoadPercentage: 80,
              isActive: true
            }
          });

          console.log(`✅ 绑定账号 ${accountData.name} 到账号池 ${pool.name}`);
        }
      }
    }

    // 将拼车组绑定到账号池
    const createdGroups = await prisma.group.findMany({
      where: {
        enterpriseId: 'ent_001'
      }
    });

    for (const group of createdGroups) {
      const existingBinding = await prisma.groupPoolBinding.findFirst({
        where: {
          groupId: group.id,
          poolId: 'pool_001'
        }
      });

      if (!existingBinding) {
        await prisma.groupPoolBinding.create({
          data: {
            groupId: group.id,
            poolId: 'pool_001',
            bindingType: 'shared',
            priority: 1,
            usageWeight: 1,
            isActive: true
          }
        });

        console.log(`✅ 绑定拼车组 ${group.name} 到账号池`);
      }
    }

    console.log('🎉 企业拼车组和AI服务账号创建完成');

  } catch (error) {
    console.error('❌ 创建企业拼车组失败:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// 如果直接运行此文件
if (require.main === module) {
  createEnterpriseGroups()
    .then(() => {
      console.log('🎉 完成');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 失败:', error);
      process.exit(1);
    });
}

export { createEnterpriseGroups };
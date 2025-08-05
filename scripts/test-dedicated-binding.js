const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testDedicatedBinding() {
  console.log('🧪 开始测试专享绑定功能...');

  try {
    // 1. 查看当前企业和账号状态
    const enterprise = await prisma.enterprise.findFirst();
    if (!enterprise) {
      console.error('❌ 没有找到企业');
      return;
    }

    console.log(`📊 企业: ${enterprise.name} (${enterprise.id})`);

    // 2. 查看企业下的AI账号
    const accounts = await prisma.aiServiceAccount.findMany({
      where: { enterpriseId: enterprise.id },
      include: {
        groupBindings: {
          where: { isActive: true },
          include: {
            group: {
              select: { id: true, name: true }
            }
          }
        }
      }
    });

    console.log(`\n📋 企业AI账号列表 (${accounts.length}个):`);
    accounts.forEach(account => {
      const binding = account.groupBindings.find(b => b.isActive);
      const status = binding ? `已绑定到: ${binding.group.name}` : '可用';
      console.log(`  - ${account.name} (${account.serviceType}) - ${status}`);
    });

    // 3. 查看拼车组绑定状态
    const groups = await prisma.group.findMany({
      where: { enterpriseId: enterprise.id },
      include: {
        resourceBinding: true,
        accountBindings: {
          where: { isActive: true },
          include: {
            account: {
              select: { id: true, name: true, serviceType: true }
            }
          }
        }
      }
    });

    console.log(`\n🚗 拼车组绑定状态 (${groups.length}个):`);
    groups.forEach(group => {
      const binding = group.resourceBinding;
      const accountBindings = group.accountBindings;
      
      console.log(`  📝 ${group.name}:`);
      console.log(`    - 绑定模式: ${binding?.bindingMode || '未配置'}`);
      console.log(`    - 绑定的账号: ${accountBindings.length} 个`);
      
      accountBindings.forEach(ab => {
        console.log(`      * ${ab.account.name} (${ab.account.serviceType}) - ${ab.bindingType}`);
      });
    });

    // 4. 测试可用账号API
    console.log('\n🔍 测试可用账号过滤...');
    const availableAccounts = accounts.filter(account => {
      const hasActiveBinding = account.groupBindings.some(binding => 
        binding.isActive && binding.bindingType === 'dedicated'
      );
      return account.isEnabled && account.status === 'active' && !hasActiveBinding;
    });

    console.log(`✅ 可用于绑定的账号: ${availableAccounts.length} 个`);
    availableAccounts.forEach(account => {
      console.log(`  - ${account.name} (${account.serviceType})`);
    });

  } catch (error) {
    console.error('❌ 测试失败:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testDedicatedBinding();
/**
 * 检查特定拼车组的权限配置
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkGroup(groupId: string, enterpriseId: string) {
  try {
    console.log('🔍 检查拼车组:', groupId);
    console.log('🏢 企业ID:', enterpriseId);
    
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      include: {
        enterprise: { select: { id: true, name: true } },
        members: {
          include: {
            user: { select: { id: true, name: true, email: true } }
          }
        }
      }
    });
    
    if (!group) {
      console.log('❌ 拼车组不存在');
      return;
    }
    
    console.log('\n📋 拼车组信息:');
    console.log('  名称:', group.name);
    console.log('  类型:', group.organizationType);
    console.log('  企业ID:', group.enterpriseId);
    console.log('  企业名称:', group.enterprise?.name || '无');
    console.log('  状态:', group.status);
    
    console.log('\n👥 成员列表:', group.members.length, '个');
    group.members.forEach(member => {
      console.log(`  - ${member.user.name} (${member.user.email}): ${member.role}`);
    });
    
    // 检查系统管理员的权限
    const adminUser = group.members.find(m => m.user.email === 'admin@aicarpool.com');
    
    console.log('\n🔐 权限分析:');
    if (adminUser) {
      console.log('✅ 系统管理员是该拼车组成员，角色:', adminUser.role);
      
      // 检查企业权限
      const enterpriseRole = await prisma.userEnterpriseRole.findFirst({
        where: {
          userId: adminUser.userId,
          enterpriseId: enterpriseId,
          isActive: true
        }
      });
      
      if (enterpriseRole) {
        console.log('✅ 系统管理员有企业权限角色:', enterpriseRole.role);
      } else {
        console.log('❌ 系统管理员缺少企业权限角色');
        
        // 尝试修复
        console.log('🔧 尝试添加企业权限角色...');
        
        await prisma.userEnterpriseRole.create({
          data: {
            userId: adminUser.userId,
            role: 'enterprise_admin',
            enterpriseId: enterpriseId,
            scope: 'enterprise',
            isActive: true
          }
        });
        
        console.log('✅ 已添加 enterprise_admin 角色');
      }
    } else {
      console.log('❌ 系统管理员不是该拼车组成员');
      
      // 获取系统管理员用户
      const adminUser = await prisma.user.findUnique({
        where: { email: 'admin@aicarpool.com' }
      });
      
      if (adminUser) {
        console.log('🔧 尝试添加系统管理员为拼车组管理员...');
        
        await prisma.groupMember.create({
          data: {
            groupId: groupId,
            userId: adminUser.id,
            role: 'admin',
            status: 'active'
          }
        });
        
        console.log('✅ 已添加系统管理员为拼车组管理员');
        
        // 同时确保有企业权限
        const existingEnterpriseRole = await prisma.userEnterpriseRole.findFirst({
          where: {
            userId: adminUser.id,
            enterpriseId: enterpriseId,
            isActive: true
          }
        });
        
        if (!existingEnterpriseRole) {
          await prisma.userEnterpriseRole.create({
            data: {
              userId: adminUser.id,
              role: 'enterprise_admin',
              enterpriseId: enterpriseId,
              scope: 'enterprise',
              isActive: true
            }
          });
          
          console.log('✅ 已添加企业权限角色');
        }
      }
    }
    
    console.log('\n✅ 权限检查和修复完成');
    
  } catch (error) {
    console.error('❌ 检查失败:', error);
  } finally {
    await prisma.$disconnect();
  }
}

async function main() {
  const groupId = 'cmdyads960003rf4h5xz9jexj';
  const enterpriseId = 'cmdvk08gt0000rfsvwbj5o9oe';
  
  await checkGroup(groupId, enterpriseId);
}

if (require.main === module) {
  main();
}
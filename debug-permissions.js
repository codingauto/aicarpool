// 调试权限问题的脚本

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function debugPermissions() {
  try {
    console.log('🔍 开始调试权限问题...\n');
    
    // 查找所有用户
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true
      }
    });
    
    console.log('👥 所有用户:');
    users.forEach((user, index) => {
      console.log(`${index + 1}. ${user.name} (${user.email}) - ${user.role} - ID: ${user.id}`);
    });
    console.log();
    
    // 查找所有组
    const groups = await prisma.group.findMany({
      select: {
        id: true,
        name: true,
        createdById: true,
        createdBy: {
          select: {
            name: true,
            email: true
          }
        }
      }
    });
    
    console.log('🏢 所有组:');
    groups.forEach((group, index) => {
      console.log(`${index + 1}. ${group.name} - 创建者: ${group.createdBy.name} - ID: ${group.id}`);
    });
    console.log();
    
    // 查找组成员关系
    const groupMembers = await prisma.groupMember.findMany({
      include: {
        user: {
          select: {
            name: true,
            email: true
          }
        },
        group: {
          select: {
            name: true
          }
        }
      }
    });
    
    console.log('👥 组成员关系:');
    groupMembers.forEach((member, index) => {
      console.log(`${index + 1}. ${member.user.name} 在 "${member.group.name}" 中的角色: ${member.role} (状态: ${member.status})`);
    });
    console.log();
    
    // 特别检查特定组的权限
    const targetGroupId = 'cmdfwngcn0002fy8xzh0ag8s';
    console.log(`🎯 检查组 ${targetGroupId} 的详细信息:`);
    
    const targetGroup = await prisma.group.findFirst({
      where: { id: targetGroupId },
      include: {
        createdBy: true,
        members: {
          include: {
            user: true
          }
        }
      }
    });
    
    if (targetGroup) {
      console.log(`组名: ${targetGroup.name}`);
      console.log(`创建者: ${targetGroup.createdBy.name} (${targetGroup.createdBy.email})`);
      console.log(`创建者ID: ${targetGroup.createdById}`);
      console.log(`成员数量: ${targetGroup.members.length}`);
      
      targetGroup.members.forEach((member, index) => {
        console.log(`  ${index + 1}. ${member.user.name} - 角色: ${member.role} - 状态: ${member.status}`);
      });
    } else {
      console.log('❌ 未找到目标组');
    }
    
  } catch (error) {
    console.error('❌ 调试失败:', error);
  } finally {
    await prisma.$disconnect();
  }
}

debugPermissions();
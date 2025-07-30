// 修复权限问题的脚本

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixPermissions() {
  try {
    console.log('🔧 开始修复权限问题...\n');
    
    const targetGroupId = 'cmdfwngcn0002fy8xzh0ag8s';
    
    // 首先找到所有用户和组成员关系
    console.log('📋 查找所有相关信息...');
    const allUsers = await prisma.user.findMany({
      select: { id: true, name: true, email: true }
    });
    console.log('用户列表:', allUsers);
    
    const allGroups = await prisma.group.findMany({
      select: { id: true, name: true, createdById: true }
    });
    console.log('所有组:', allGroups);
    
    // 使用第一个找到的组ID（如果目标组ID不存在）
    const actualGroup = allGroups.find(g => g.id === targetGroupId) || allGroups[0];
    if (!actualGroup) {
      console.log('❌ 没有找到任何组');
      return;
    }
    
    const actualGroupId = actualGroup.id;
    console.log(`🎯 使用组ID: ${actualGroupId} (${actualGroup.name})`);
    
    const allMembers = await prisma.groupMember.findMany({
      where: { groupId: actualGroupId },
      include: {
        user: { select: { name: true, email: true } }
      }
    });
    console.log('组成员:', allMembers);
    
    // 找到当前用户（通过邮箱确认）
    const currentUser = allUsers.find(u => u.email === 'wutongci@gmail.com');
    if (!currentUser) {
      console.log('❌ 未找到当前用户');
      return;
    }
    
    const targetUserId = currentUser.id;
    
    // 检查当前权限
    console.log('🔍 检查当前权限...');
    const currentMembership = await prisma.groupMember.findFirst({
      where: {
        groupId: actualGroupId,
        userId: targetUserId
      },
      include: {
        user: { select: { name: true, email: true } },
        group: { select: { name: true } }
      }
    });
    
    if (currentMembership) {
      console.log(`当前权限: ${currentMembership.user.name} 在 "${currentMembership.group.name}" 中的角色是 ${currentMembership.role}`);
      
      if (currentMembership.role === 'admin' || currentMembership.role === 'owner') {
        console.log('✅ 用户已经有管理员权限，不需要修改');
        return;
      }
      
      // 将用户角色提升为admin
      console.log('🔧 将用户角色提升为admin...');
      const updatedMembership = await prisma.groupMember.update({
        where: { id: currentMembership.id },
        data: { role: 'admin' },
        include: {
          user: { select: { name: true } },
          group: { select: { name: true } }
        }
      });
      
      console.log(`✅ 权限修复成功: ${updatedMembership.user.name} 现在是 "${updatedMembership.group.name}" 的 ${updatedMembership.role}`);
      
    } else {
      console.log('❌ 未找到用户的组成员关系');
      
      // 检查用户是否是组创建者
      const group = await prisma.group.findFirst({
        where: {
          id: actualGroupId,
          createdById: targetUserId
        },
        include: {
          createdBy: { select: { name: true } }
        }
      });
      
      if (group) {
        console.log(`✅ ${group.createdBy.name} 是组创建者，已经有管理权限`);
      } else {
        console.log('❌ 用户既不是组成员也不是组创建者，正在创建admin权限...');
        
        // 创建用户的admin成员关系
        const newMembership = await prisma.groupMember.create({
          data: {
            groupId: actualGroupId,
            userId: targetUserId,
            role: 'admin',
            status: 'active'
          },
          include: {
            user: { select: { name: true } },
            group: { select: { name: true } }
          }
        });
        
        console.log(`✅ 创建权限成功: ${newMembership.user.name} 现在是 "${newMembership.group.name}" 的 ${newMembership.role}`);
      }
    }
    
  } catch (error) {
    console.error('❌ 修复权限失败:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixPermissions();
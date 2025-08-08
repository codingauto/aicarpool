/**
 * 简化权限修复脚本 - 快速修复权限问题
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixPermissions(userIdOrEmail?: string, apply: boolean = false) {
  try {
    console.log(`🔧 ${apply ? '应用' : '预览'} 权限修复...\n`);

    // 查找用户
    let users;
    if (userIdOrEmail) {
      const isEmail = userIdOrEmail.includes('@');
      users = await prisma.user.findMany({
        where: isEmail ? { email: userIdOrEmail } : { id: userIdOrEmail },
        take: 1
      });
    } else {
      users = await prisma.user.findMany({
        where: { status: 'active' },
        take: 10
      });
    }

    if (users.length === 0) {
      console.log('❌ 没有找到用户');
      return;
    }

    for (const user of users) {
      console.log(`👤 处理用户: ${user.name} (${user.email})`);
      
      // 获取用户的企业角色和拼车组信息
      const [userEnterprises, groupMemberships, enterpriseRoles] = await Promise.all([
        prisma.userEnterprise.findMany({
          where: { userId: user.id },
          include: { enterprise: { select: { id: true, name: true } } }
        }),
        prisma.groupMember.findMany({
          where: { userId: user.id },
          include: {
            group: {
              select: {
                id: true,
                name: true,
                organizationType: true,
                enterpriseId: true
              }
            }
          }
        }),
        prisma.userEnterpriseRole.findMany({
          where: { userId: user.id }
        })
      ]);

      const enterpriseIds = userEnterprises.map(ue => ue.enterpriseId);
      const roleEnterpriseIds = enterpriseRoles.filter(er => er.enterpriseId).map(er => er.enterpriseId!);
      
      let actionsTaken = 0;

      // 修复1: 为企业成员添加企业权限角色
      for (const userEnterprise of userEnterprises) {
        if (!roleEnterpriseIds.includes(userEnterprise.enterpriseId)) {
          const targetRole = userEnterprise.role === 'admin' || userEnterprise.role === 'owner' 
            ? 'enterprise_admin' 
            : 'enterprise_manager';

          console.log(`   ✅ 需要为企业 ${userEnterprise.enterprise.name} 添加角色: ${targetRole}`);

          if (apply) {
            // 检查是否已存在
            const existing = await prisma.userEnterpriseRole.findFirst({
              where: {
                userId: user.id,
                role: targetRole,
                enterpriseId: userEnterprise.enterpriseId,
                isActive: true
              }
            });

            if (!existing) {
              await prisma.userEnterpriseRole.create({
                data: {
                  userId: user.id,
                  role: targetRole,
                  enterpriseId: userEnterprise.enterpriseId,
                  scope: 'enterprise',
                  isActive: true
                }
              });
              console.log(`     ✅ 已添加 ${targetRole} 角色`);
            } else {
              console.log(`     ℹ️  角色已存在`);
            }
          }
          actionsTaken++;
        }
      }

      // 修复2: 为企业级拼车组成员添加企业权限
      const enterpriseGroups = groupMemberships.filter(gm => 
        gm.group.organizationType === 'enterprise_group' && gm.group.enterpriseId
      );

      for (const group of enterpriseGroups) {
        if (!roleEnterpriseIds.includes(group.group.enterpriseId!)) {
          const targetRole = group.role === 'admin' || group.role === 'owner' 
            ? 'enterprise_admin' 
            : 'enterprise_manager';

          console.log(`   ✅ 需要为企业级拼车组 ${group.group.name} 添加企业权限: ${targetRole}`);

          if (apply) {
            const existing = await prisma.userEnterpriseRole.findFirst({
              where: {
                userId: user.id,
                role: targetRole,
                enterpriseId: group.group.enterpriseId,
                isActive: true
              }
            });

            if (!existing) {
              await prisma.userEnterpriseRole.create({
                data: {
                  userId: user.id,
                  role: targetRole,
                  enterpriseId: group.group.enterpriseId!,
                  scope: 'enterprise',
                  isActive: true
                }
              });
              console.log(`     ✅ 已添加 ${targetRole} 角色`);
            } else {
              console.log(`     ℹ️  角色已存在`);
            }
          }
          actionsTaken++;
        }
      }

      // 修复3: 激活非活跃的权限角色
      const inactiveRoles = enterpriseRoles.filter(er => !er.isActive);
      if (inactiveRoles.length > 0) {
        console.log(`   ✅ 需要激活 ${inactiveRoles.length} 个非活跃角色`);
        
        if (apply) {
          for (const role of inactiveRoles) {
            await prisma.userEnterpriseRole.update({
              where: { id: role.id },
              data: { isActive: true }
            });
          }
          console.log(`     ✅ 已激活 ${inactiveRoles.length} 个角色`);
        }
        actionsTaken++;
      }

      if (actionsTaken === 0) {
        console.log(`   ✅ 用户权限配置正常，无需修复`);
      } else {
        console.log(`   📊 发现 ${actionsTaken} 个需要修复的权限配置`);
      }

      console.log('');
    }

    if (!apply && users.some(u => u.name)) {
      console.log(`💡 要应用这些修复，请运行: npx tsx scripts/simple-fix.ts --apply`);
    }

  } catch (error) {
    console.error('❌ 修复失败:', error);
  } finally {
    await prisma.$disconnect();
  }
}

async function main() {
  const args = process.argv.slice(2);
  const userIdOrEmail = args.find(arg => !arg.startsWith('--'));
  const apply = args.includes('--apply');
  const help = args.includes('--help') || args.includes('-h');

  if (help) {
    console.log(`
简化权限修复脚本使用说明:

npx tsx scripts/simple-fix.ts [用户ID或邮箱] [选项]

选项:
  --apply           实际应用修复（默认为预览模式）
  --help, -h        显示帮助信息

示例:
  npx tsx scripts/simple-fix.ts                         # 预览所有用户的修复
  npx tsx scripts/simple-fix.ts --apply                 # 应用所有用户的修复
  npx tsx scripts/simple-fix.ts admin@aicarpool.com     # 预览特定用户的修复
  npx tsx scripts/simple-fix.ts admin@aicarpool.com --apply  # 应用特定用户的修复
    `);
    return;
  }

  await fixPermissions(userIdOrEmail, apply);
}

if (require.main === module) {
  main();
}
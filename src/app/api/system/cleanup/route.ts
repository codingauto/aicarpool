import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createApiResponse } from '@/lib/middleware';

// 清理过期数据
export async function POST(req: NextRequest) {
  try {
    const now = new Date();
    const { searchParams } = new URL(req.url);
    const systemKey = searchParams.get('key');

    // 简单的系统key验证（在生产环境中应该使用更安全的方式）
    if (systemKey !== process.env.SYSTEM_CLEANUP_KEY) {
      return createApiResponse(false, null, '无权限执行清理任务', 403);
    }

    // 清理过期的邀请
    const expiredInvitations = await prisma.invitation.updateMany({
      where: {
        status: 'pending',
        expiresAt: { lt: now },
      },
      data: {
        status: 'expired',
      },
    });

    // 清理过期的邀请链接
    const expiredInviteLinks = await prisma.inviteLink.updateMany({
      where: {
        status: 'active',
        expiresAt: { lt: now },
      },
      data: {
        status: 'expired',
      },
    });

    // 清理达到使用上限的邀请链接
    const maxUsedInviteLinks = await prisma.inviteLink.updateMany({
      where: {
        status: 'active',
        usedCount: { gte: prisma.inviteLink.fields.maxUses },
      },
      data: {
        status: 'inactive',
      },
    });

    // 删除30天前的已过期邀请记录
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const deletedOldInvitations = await prisma.invitation.deleteMany({
      where: {
        status: { in: ['expired', 'cancelled'] },
        createdAt: { lt: thirtyDaysAgo },
      },
    });

    // 删除30天前的已失效邀请链接记录
    const deletedOldInviteLinks = await prisma.inviteLink.deleteMany({
      where: {
        status: { in: ['expired', 'inactive'] },
        updatedAt: { lt: thirtyDaysAgo },
      },
    });

    const result = {
      expiredInvitations: expiredInvitations.count,
      expiredInviteLinks: expiredInviteLinks.count,
      maxUsedInviteLinks: maxUsedInviteLinks.count,
      deletedOldInvitations: deletedOldInvitations.count,
      deletedOldInviteLinks: deletedOldInviteLinks.count,
      cleanupTime: now.toISOString(),
    };

    console.log('Cleanup completed:', result);

    return createApiResponse({ ...result, message: '清理任务执行完成' }, true, 200);

  } catch (error) {
    console.error('Cleanup error:', error);
    return createApiResponse({ error: '清理任务执行失败' }, false, 500);
  }
}

// 获取邀请统计数据
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const groupId = searchParams.get('groupId');

    const whereClause: { groupId?: string } = {};
    if (groupId) {
      whereClause.groupId = groupId;
    }

    // 邀请统计
    const invitationStats = await prisma.invitation.groupBy({
      by: ['status'],
      where: whereClause,
      _count: {
        status: true,
      },
    });

    // 邀请链接统计
    const inviteLinkStats = await prisma.inviteLink.groupBy({
      by: ['status'],
      where: whereClause,
      _count: {
        status: true,
      },
    });

    // 近7天的邀请趋势
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const recentInvitations = await prisma.invitation.findMany({
      where: {
        ...whereClause,
        createdAt: { gte: sevenDaysAgo },
      },
      select: {
        createdAt: true,
        status: true,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    // 按日期分组统计
    const dailyStats: { [key: string]: { total: number; accepted: number } } = {};
    
    recentInvitations.forEach(invitation => {
      const date = invitation.createdAt.toISOString().split('T')[0];
      if (!dailyStats[date]) {
        dailyStats[date] = { total: 0, accepted: 0 };
      }
      dailyStats[date].total++;
      if (invitation.status === 'accepted') {
        dailyStats[date].accepted++;
      }
    });

    // 总体统计
    const totalInvitations = await prisma.invitation.count({
      where: whereClause,
    });

    const acceptedInvitations = await prisma.invitation.count({
      where: {
        ...whereClause,
        status: 'accepted',
      },
    });

    const pendingInvitations = await prisma.invitation.count({
      where: {
        ...whereClause,
        status: 'pending',
        expiresAt: { gt: new Date() },
      },
    });

    const totalInviteLinks = await prisma.inviteLink.count({
      where: whereClause,
    });

    const activeInviteLinks = await prisma.inviteLink.count({
      where: {
        ...whereClause,
        status: 'active',
        expiresAt: { gt: new Date() },
      },
    });

    const result = {
      invitations: {
        total: totalInvitations,
        accepted: acceptedInvitations,
        pending: pendingInvitations,
        acceptanceRate: totalInvitations > 0 ? (acceptedInvitations / totalInvitations * 100).toFixed(2) : '0',
        byStatus: invitationStats.reduce((acc, stat) => {
          acc[stat.status] = stat._count.status;
          return acc;
        }, {} as Record<string, number>),
      },
      inviteLinks: {
        total: totalInviteLinks,
        active: activeInviteLinks,
        byStatus: inviteLinkStats.reduce((acc, stat) => {
          acc[stat.status] = stat._count.status;
          return acc;
        }, {} as Record<string, number>),
      },
      dailyTrend: Object.entries(dailyStats).map(([date, stats]) => ({
        date,
        total: stats.total,
        accepted: stats.accepted,
        acceptanceRate: stats.total > 0 ? (stats.accepted / stats.total * 100).toFixed(2) : '0',
      })),
    };

    return createApiResponse({ ...result, message: '统计数据获取成功' }, true, 200);

  } catch (error) {
    console.error('Get invitation stats error:', error);
    return createApiResponse({ error: '获取统计数据失败' }, false, 500);
  }
}
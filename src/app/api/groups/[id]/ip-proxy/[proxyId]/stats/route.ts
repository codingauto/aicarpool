import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET - 获取IP代理使用统计
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string; proxyId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 })
    }

    const { id: groupId, proxyId } = params
    const { searchParams } = new URL(request.url)
    const period = searchParams.get('period') || '7d' // 7d, 30d, 90d
    const userId = searchParams.get('userId') // 可选，获取特定用户的统计

    // 验证用户是否为该拼车组成员
    const membership = await prisma.groupMember.findFirst({
      where: {
        groupId,
        userId: session.user.id,
        status: 'active'
      }
    })

    if (!membership) {
      return NextResponse.json({ error: '无权限访问该拼车组' }, { status: 403 })
    }

    // 验证代理配置是否存在
    const proxyConfig = await prisma.ipProxyConfig.findFirst({
      where: {
        id: proxyId,
        groupId
      }
    })

    if (!proxyConfig) {
      return NextResponse.json({ error: '代理配置不存在' }, { status: 404 })
    }

    // 计算时间范围
    const now = new Date()
    let startDate: Date
    switch (period) {
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        break
      case '90d':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
        break
      default: // 7d
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    }

    // 构建查询条件
    const whereCondition: any = {
      proxyId,
      startTime: {
        gte: startDate
      }
    }

    if (userId) {
      whereCondition.userId = userId
    }

    // 获取使用日志统计
    const usageLogs = await prisma.ipUsageLog.findMany({
      where: whereCondition,
      select: {
        id: true,
        userId: true,
        sourceIp: true,
        targetHost: true,
        targetPort: true,
        bytesIn: true,
        bytesOut: true,
        duration: true,
        status: true,
        startTime: true,
        endTime: true
      },
      orderBy: { startTime: 'desc' }
    })

    // 计算总体统计
    const totalStats = {
      totalConnections: usageLogs.length,
      successfulConnections: usageLogs.filter(log => log.status === 'success').length,
      failedConnections: usageLogs.filter(log => log.status !== 'success').length,
      totalBytesIn: usageLogs.reduce((sum, log) => sum + Number(log.bytesIn), 0),
      totalBytesOut: usageLogs.reduce((sum, log) => sum + Number(log.bytesOut), 0),
      totalBytes: usageLogs.reduce((sum, log) => sum + Number(log.bytesIn) + Number(log.bytesOut), 0),
      totalDuration: usageLogs.reduce((sum, log) => sum + log.duration, 0),
      avgDuration: usageLogs.length > 0 ? Math.round(usageLogs.reduce((sum, log) => sum + log.duration, 0) / usageLogs.length) : 0,
      successRate: usageLogs.length > 0 ? Math.round((usageLogs.filter(log => log.status === 'success').length / usageLogs.length) * 100) : 0
    }

    // 按日期分组统计（用于图表）
    const dailyStats = new Map<string, any>()
    usageLogs.forEach(log => {
      const dateKey = log.startTime.toISOString().split('T')[0]
      if (!dailyStats.has(dateKey)) {
        dailyStats.set(dateKey, {
          date: dateKey,
          connections: 0,
          successfulConnections: 0,
          failedConnections: 0,
          bytesIn: 0,
          bytesOut: 0,
          totalBytes: 0,
          duration: 0
        })
      }
      
      const dayStats = dailyStats.get(dateKey)!
      dayStats.connections++
      if (log.status === 'success') {
        dayStats.successfulConnections++
      } else {
        dayStats.failedConnections++
      }
      dayStats.bytesIn += Number(log.bytesIn)
      dayStats.bytesOut += Number(log.bytesOut)
      dayStats.totalBytes += Number(log.bytesIn) + Number(log.bytesOut)
      dayStats.duration += log.duration
    })

    // 按用户分组统计
    const userStats = new Map<string, any>()
    usageLogs.forEach(log => {
      if (!log.userId) return
      
      if (!userStats.has(log.userId)) {
        userStats.set(log.userId, {
          userId: log.userId,
          connections: 0,
          successfulConnections: 0,
          failedConnections: 0,
          bytesIn: 0,
          bytesOut: 0,
          totalBytes: 0,
          duration: 0
        })
      }
      
      const stats = userStats.get(log.userId)!
      stats.connections++
      if (log.status === 'success') {
        stats.successfulConnections++
      } else {
        stats.failedConnections++
      }
      stats.bytesIn += Number(log.bytesIn)
      stats.bytesOut += Number(log.bytesOut)
      stats.totalBytes += Number(log.bytesIn) + Number(log.bytesOut)
      stats.duration += log.duration
    })

    // 获取用户信息
    const userIds = Array.from(userStats.keys())
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true, email: true, avatar: true }
    })

    const userStatsWithInfo = Array.from(userStats.values()).map(stats => ({
      ...stats,
      user: users.find(u => u.id === stats.userId)
    }))

    // 按目标主机分组统计
    const hostStats = new Map<string, any>()
    usageLogs.forEach(log => {
      const hostKey = `${log.targetHost}:${log.targetPort}`
      if (!hostStats.has(hostKey)) {
        hostStats.set(hostKey, {
          host: log.targetHost,
          port: log.targetPort,
          connections: 0,
          successfulConnections: 0,
          failedConnections: 0,
          bytesIn: 0,
          bytesOut: 0,
          totalBytes: 0
        })
      }
      
      const stats = hostStats.get(hostKey)!
      stats.connections++
      if (log.status === 'success') {
        stats.successfulConnections++
      } else {
        stats.failedConnections++
      }
      stats.bytesIn += Number(log.bytesIn)
      stats.bytesOut += Number(log.bytesOut)
      stats.totalBytes += Number(log.bytesIn) + Number(log.bytesOut)
    })

    return NextResponse.json({
      success: true,
      data: {
        period,
        startDate: startDate.toISOString(),
        endDate: now.toISOString(),
        totalStats,
        dailyStats: Array.from(dailyStats.values()).sort((a, b) => a.date.localeCompare(b.date)),
        userStats: userStatsWithInfo.sort((a, b) => b.totalBytes - a.totalBytes),
        hostStats: Array.from(hostStats.values()).sort((a, b) => b.connections - a.connections),
        recentLogs: usageLogs.slice(0, 20) // 最近20条日志
      }
    })

  } catch (error) {
    console.error('获取IP代理统计失败:', error)
    return NextResponse.json(
      { error: '获取IP代理统计失败' },
      { status: 500 }
    )
  }
}

// POST - 记录IP代理使用日志
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string; proxyId: string } }
) {
  try {
    const { id: groupId, proxyId } = params
    const body = await request.json()

    // 验证代理配置是否存在
    const proxyConfig = await prisma.ipProxyConfig.findFirst({
      where: {
        id: proxyId,
        groupId
      }
    })

    if (!proxyConfig) {
      return NextResponse.json({ error: '代理配置不存在' }, { status: 404 })
    }

    // 创建使用日志
    const usageLog = await prisma.ipUsageLog.create({
      data: {
        proxyId,
        userId: body.userId || null,
        sessionId: body.sessionId || null,
        sourceIp: body.sourceIp,
        targetHost: body.targetHost,
        targetPort: body.targetPort,
        bytesIn: BigInt(body.bytesIn || 0),
        bytesOut: BigInt(body.bytesOut || 0),
        duration: body.duration || 0,
        status: body.status || 'success',
        errorCode: body.errorCode || null,
        startTime: body.startTime ? new Date(body.startTime) : new Date(),
        endTime: body.endTime ? new Date(body.endTime) : null,
        metadata: body.metadata || null
      }
    })

    // 更新代理配置的流量使用统计
    const totalTraffic = Number(body.bytesIn || 0) + Number(body.bytesOut || 0)
    await prisma.ipProxyConfig.update({
      where: { id: proxyId },
      data: {
        trafficUsed: {
          increment: BigInt(Math.round(totalTraffic / (1024 * 1024))) // 转换为MB
        },
        lastCheckAt: new Date()
      }
    })

    return NextResponse.json({
      success: true,
      data: usageLog,
      message: '使用日志记录成功'
    })

  } catch (error) {
    console.error('记录IP代理使用日志失败:', error)
    return NextResponse.json(
      { error: '记录IP代理使用日志失败' },
      { status: 500 }
    )
  }
}
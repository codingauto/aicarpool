import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET - 获取成员配置同步状态
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

    // 获取成员配置同步状态
    const memberConfigs = await prisma.ipProxyMemberConfig.findMany({
      where: { proxyId },
      include: {
        user: {
          select: { id: true, name: true, email: true, avatar: true }
        }
      },
      orderBy: { lastSyncAt: 'desc' }
    })

    // 统计同步状态
    const syncStats = {
      total: memberConfigs.length,
      synced: memberConfigs.filter(config => config.syncStatus === 'synced').length,
      pending: memberConfigs.filter(config => config.syncStatus === 'pending').length,
      failed: memberConfigs.filter(config => config.syncStatus === 'failed').length
    }

    return NextResponse.json({
      success: true,
      data: {
        syncStats,
        memberConfigs
      }
    })

  } catch (error) {
    console.error('获取配置同步状态失败:', error)
    return NextResponse.json(
      { error: '获取配置同步状态失败' },
      { status: 500 }
    )
  }
}

// POST - 触发配置同步
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string; proxyId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 })
    }

    const { id: groupId, proxyId } = params
    const body = await request.json()
    const { userIds, forceSync = false } = body

    // 验证用户是否为该拼车组管理员
    const membership = await prisma.groupMember.findFirst({
      where: {
        groupId,
        userId: session.user.id,
        status: 'active',
        role: { in: ['admin', 'owner'] }
      }
    })

    if (!membership) {
      return NextResponse.json({ error: '无权限管理该拼车组的IP代理' }, { status: 403 })
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

    // 构建查询条件
    const whereCondition: any = { proxyId }
    if (userIds && Array.isArray(userIds) && userIds.length > 0) {
      whereCondition.userId = { in: userIds }
    }

    // 如果不是强制同步，只同步pending状态的配置
    if (!forceSync) {
      whereCondition.syncStatus = 'pending'
    }

    // 获取需要同步的成员配置
    const memberConfigs = await prisma.ipProxyMemberConfig.findMany({
      where: whereCondition,
      include: {
        user: {
          select: { id: true, name: true, email: true }
        }
      }
    })

    if (memberConfigs.length === 0) {
      return NextResponse.json({
        success: true,
        message: '没有需要同步的配置',
        data: { syncedCount: 0, failedCount: 0 }
      })
    }

    // 模拟配置同步过程
    const syncResults = []
    let syncedCount = 0
    let failedCount = 0

    for (const config of memberConfigs) {
      try {
        // 这里应该是实际的配置同步逻辑
        // 例如：调用外部API、发送配置文件、更新客户端等
        
        // 模拟同步过程
        const syncSuccess = Math.random() > 0.1 // 90%成功率

        if (syncSuccess) {
          await prisma.ipProxyMemberConfig.update({
            where: { id: config.id },
            data: {
              syncStatus: 'synced',
              lastSyncAt: new Date(),
              syncError: null
            }
          })
          syncedCount++
          syncResults.push({
            userId: config.userId,
            userName: config.user.name,
            status: 'success',
            message: '配置同步成功'
          })
        } else {
          const errorMessage = '网络连接失败，请稍后重试'
          await prisma.ipProxyMemberConfig.update({
            where: { id: config.id },
            data: {
              syncStatus: 'failed',
              lastSyncAt: new Date(),
              syncError: errorMessage
            }
          })
          failedCount++
          syncResults.push({
            userId: config.userId,
            userName: config.user.name,
            status: 'failed',
            message: errorMessage
          })
        }

        // 添加延迟模拟真实同步过程
        await new Promise(resolve => setTimeout(resolve, 100))

      } catch (error) {
        console.error(`同步用户 ${config.userId} 的配置失败:`, error)
        await prisma.ipProxyMemberConfig.update({
          where: { id: config.id },
          data: {
            syncStatus: 'failed',
            lastSyncAt: new Date(),
            syncError: '同步过程中发生错误'
          }
        })
        failedCount++
        syncResults.push({
          userId: config.userId,
          userName: config.user.name,
          status: 'failed',
          message: '同步过程中发生错误'
        })
      }
    }

    return NextResponse.json({
      success: true,
      message: `配置同步完成，成功 ${syncedCount} 个，失败 ${failedCount} 个`,
      data: {
        syncedCount,
        failedCount,
        totalCount: memberConfigs.length,
        results: syncResults
      }
    })

  } catch (error) {
    console.error('触发配置同步失败:', error)
    return NextResponse.json(
      { error: '触发配置同步失败' },
      { status: 500 }
    )
  }
}

// PUT - 更新单个成员的配置同步状态
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string; proxyId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 })
    }

    const { id: groupId, proxyId } = params
    const body = await request.json()
    const { userId, syncStatus, syncError } = body

    // 验证用户是否为该拼车组管理员或者是配置的所有者
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

    // 如果不是管理员，只能更新自己的配置状态
    if (!['admin', 'owner'].includes(membership.role) && userId !== session.user.id) {
      return NextResponse.json({ error: '无权限更新其他成员的配置状态' }, { status: 403 })
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

    // 更新成员配置同步状态
    const updatedConfig = await prisma.ipProxyMemberConfig.updateMany({
      where: {
        proxyId,
        userId
      },
      data: {
        syncStatus,
        lastSyncAt: new Date(),
        syncError: syncError || null
      }
    })

    if (updatedConfig.count === 0) {
      return NextResponse.json({ error: '成员配置不存在' }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      message: '配置同步状态更新成功'
    })

  } catch (error) {
    console.error('更新配置同步状态失败:', error)
    return NextResponse.json(
      { error: '更新配置同步状态失败' },
      { status: 500 }
    )
  }
}
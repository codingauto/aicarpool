import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

// 更新IP代理配置的验证schema
const updateIpProxySchema = z.object({
  name: z.string().min(1, '代理名称不能为空').optional(),
  description: z.string().optional(),
  proxyType: z.enum(['http', 'https', 'socks5'], {
    errorMap: () => ({ message: '代理类型必须是 http、https 或 socks5' })
  }).optional(),
  host: z.string().min(1, '主机地址不能为空').optional(),
  port: z.number().int().min(1).max(65535, '端口号必须在 1-65535 之间').optional(),
  username: z.string().optional(),
  password: z.string().optional(),
  location: z.string().optional(),
  maxConnections: z.number().int().min(1).optional(),
  trafficLimit: z.number().int().min(0).optional(),
  isEnabled: z.boolean().optional()
})

// GET - 获取单个IP代理配置详情
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

    // 获取IP代理配置详情
    const ipProxyConfig = await prisma.ipProxyConfig.findFirst({
      where: {
        id: proxyId,
        groupId
      },
      include: {
        usageLogs: {
          take: 50,
          orderBy: { startTime: 'desc' },
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
          }
        },
        memberConfigs: {
          include: {
            user: {
              select: { id: true, name: true, email: true, avatar: true }
            }
          }
        },
        _count: {
          select: {
            usageLogs: true,
            memberConfigs: true
          }
        }
      }
    })

    if (!ipProxyConfig) {
      return NextResponse.json({ error: '代理配置不存在' }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      data: ipProxyConfig
    })

  } catch (error) {
    console.error('获取IP代理配置详情失败:', error)
    return NextResponse.json(
      { error: '获取IP代理配置详情失败' },
      { status: 500 }
    )
  }
}

// PUT - 更新IP代理配置
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
    const existingProxy = await prisma.ipProxyConfig.findFirst({
      where: {
        id: proxyId,
        groupId
      }
    })

    if (!existingProxy) {
      return NextResponse.json({ error: '代理配置不存在' }, { status: 404 })
    }

    // 验证请求数据
    const validatedData = updateIpProxySchema.parse(body)

    // 如果更新名称，检查是否与其他配置冲突
    if (validatedData.name && validatedData.name !== existingProxy.name) {
      const nameConflict = await prisma.ipProxyConfig.findFirst({
        where: {
          groupId,
          name: validatedData.name,
          id: { not: proxyId }
        }
      })

      if (nameConflict) {
        return NextResponse.json({ error: '代理名称已存在' }, { status: 400 })
      }
    }

    // 准备更新数据
    const updateData: any = { ...validatedData }
    if (validatedData.trafficLimit !== undefined) {
      updateData.trafficLimit = validatedData.trafficLimit ? BigInt(validatedData.trafficLimit * 1024 * 1024) : null
    }

    // 更新IP代理配置
    const updatedProxy = await prisma.ipProxyConfig.update({
      where: { id: proxyId },
      data: updateData,
      include: {
        usageLogs: {
          take: 10,
          orderBy: { startTime: 'desc' }
        },
        memberConfigs: {
          include: {
            user: {
              select: { id: true, name: true, email: true, avatar: true }
            }
          }
        },
        _count: {
          select: {
            usageLogs: true,
            memberConfigs: true
          }
        }
      }
    })

    // 如果更新了代理配置信息，同步更新成员配置
    if (validatedData.proxyType || validatedData.host || validatedData.port || 
        validatedData.username !== undefined || validatedData.password !== undefined || 
        validatedData.location !== undefined) {
      
      const newConfigData = {
        proxyType: validatedData.proxyType || existingProxy.proxyType,
        host: validatedData.host || existingProxy.host,
        port: validatedData.port || existingProxy.port,
        username: validatedData.username !== undefined ? validatedData.username : existingProxy.username,
        password: validatedData.password !== undefined ? validatedData.password : existingProxy.password,
        location: validatedData.location !== undefined ? validatedData.location : existingProxy.location
      }

      await prisma.ipProxyMemberConfig.updateMany({
        where: { proxyId },
        data: {
          configData: newConfigData,
          syncStatus: 'pending',
          lastSyncAt: null,
          syncError: null
        }
      })
    }

    return NextResponse.json({
      success: true,
      data: updatedProxy,
      message: '代理配置更新成功'
    })

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: '数据验证失败', details: error.errors },
        { status: 400 }
      )
    }

    console.error('更新IP代理配置失败:', error)
    return NextResponse.json(
      { error: '更新IP代理配置失败' },
      { status: 500 }
    )
  }
}

// DELETE - 删除IP代理配置
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; proxyId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 })
    }

    const { id: groupId, proxyId } = params

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
    const existingProxy = await prisma.ipProxyConfig.findFirst({
      where: {
        id: proxyId,
        groupId
      }
    })

    if (!existingProxy) {
      return NextResponse.json({ error: '代理配置不存在' }, { status: 404 })
    }

    // 删除IP代理配置（级联删除相关的使用日志和成员配置）
    await prisma.ipProxyConfig.delete({
      where: { id: proxyId }
    })

    return NextResponse.json({
      success: true,
      message: '代理配置删除成功'
    })

  } catch (error) {
    console.error('删除IP代理配置失败:', error)
    return NextResponse.json(
      { error: '删除IP代理配置失败' },
      { status: 500 }
    )
  }
}
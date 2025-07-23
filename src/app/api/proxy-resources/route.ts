import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { createApiResponse } from '@/lib/middleware';
import { verifyToken } from '@/lib/auth';

const proxyResourceSchema = z.object({
  type: z.enum(['socks5', 'http', 'https']),
  host: z.string().min(1, '代理主机不能为空'),
  port: z.number().int().min(1).max(65535, '端口号必须在1-65535之间'),
  username: z.string().optional(),
  password: z.string().optional(),
  location: z.string().optional(),
  provider: z.string().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    const decoded = verifyToken(token);
    
    if (!decoded) {
      return createApiResponse(false, null, '未授权访问', 401);
    }

    const groupId = request.nextUrl.searchParams.get('groupId');
    if (!groupId) {
      return createApiResponse(false, null, '缺少组ID参数', 400);
    }

    // 验证用户是否属于该组
    const groupMember = await prisma.groupMember.findFirst({
      where: {
        userId: decoded.userId,
        groupId: groupId,
        status: 'active',
      },
    });

    if (!groupMember) {
      return createApiResponse(false, null, '无权访问该组的代理资源', 403);
    }

    // 获取组的代理资源
    const proxyResources = await prisma.proxyResource.findMany({
      include: {
        bindings: {
          where: {
            groupId: groupId,
          },
          select: {
            id: true,
            priority: true,
            isEnabled: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // 只返回绑定到该组的代理资源
    const filteredResources = proxyResources.filter(resource => 
      resource.bindings.length > 0
    ).map(resource => ({
      ...resource,
      binding: resource.bindings[0], // 每个资源对每个组只有一个绑定
    }));

    return createApiResponse(true, filteredResources);

  } catch (error) {
    console.error('Get proxy resources error:', error);
    return createApiResponse(false, null, '获取代理资源失败', 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    const decoded = verifyToken(token);
    
    if (!decoded) {
      return createApiResponse(false, null, '未授权访问', 401);
    }

    const body = await request.json();
    const { groupId, ...resourceData } = body;

    if (!groupId) {
      return createApiResponse(false, null, '缺少组ID参数', 400);
    }

    // 验证用户是否为组管理员
    const groupMember = await prisma.groupMember.findFirst({
      where: {
        userId: decoded.userId,
        groupId: groupId,
        status: 'active',
        role: { in: ['admin', 'owner'] },
      },
    });

    if (!groupMember) {
      return createApiResponse(false, null, '无权管理该组的代理资源', 403);
    }

    // 验证数据
    const validatedData = proxyResourceSchema.parse(resourceData);

    // 检查是否已存在相同的代理资源
    const existingResource = await prisma.proxyResource.findFirst({
      where: {
        host: validatedData.host,
        port: validatedData.port,
        type: validatedData.type,
      },
    });

    let proxyResource;

    if (existingResource) {
      // 如果代理资源已存在，检查是否已绑定到该组
      const existingBinding = await prisma.proxyBinding.findFirst({
        where: {
          proxyResourceId: existingResource.id,
          groupId: groupId,
        },
      });

      if (existingBinding) {
        return createApiResponse(false, null, '该代理资源已存在', 400);
      }

      // 创建新的绑定
      await prisma.proxyBinding.create({
        data: {
          groupId: groupId,
          proxyResourceId: existingResource.id,
          priority: 1,
          isEnabled: true,
        },
      });

      proxyResource = existingResource;
    } else {
      // 创建新的代理资源和绑定
      proxyResource = await prisma.$transaction(async (tx) => {
        const resource = await tx.proxyResource.create({
          data: validatedData,
        });

        await tx.proxyBinding.create({
          data: {
            groupId: groupId,
            proxyResourceId: resource.id,
            priority: 1,
            isEnabled: true,
          },
        });

        return resource;
      });
    }

    return createApiResponse(true, proxyResource);

  } catch (error) {
    if (error instanceof z.ZodError) {
      return createApiResponse(false, null, error.errors[0].message, 400);
    }

    console.error('Create proxy resource error:', error);
    return createApiResponse(false, null, '创建代理资源失败', 500);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    const decoded = verifyToken(token);
    
    if (!decoded) {
      return createApiResponse(false, null, '未授权访问', 401);
    }

    const body = await request.json();
    const { id, groupId, ...resourceData } = body;

    if (!id || !groupId) {
      return createApiResponse(false, null, '缺少必要参数', 400);
    }

    // 验证用户是否为组管理员
    const groupMember = await prisma.groupMember.findFirst({
      where: {
        userId: decoded.userId,
        groupId: groupId,
        status: 'active',
        role: { in: ['admin', 'owner'] },
      },
    });

    if (!groupMember) {
      return createApiResponse(false, null, '无权管理该组的代理资源', 403);
    }

    // 验证代理资源是否属于该组
    const binding = await prisma.proxyBinding.findFirst({
      where: {
        proxyResourceId: id,
        groupId: groupId,
      },
    });

    if (!binding) {
      return createApiResponse(false, null, '代理资源不存在或无权访问', 404);
    }

    // 验证数据
    const validatedData = proxyResourceSchema.parse(resourceData);

    // 更新代理资源
    const updatedResource = await prisma.proxyResource.update({
      where: { id },
      data: validatedData,
    });

    return createApiResponse(true, updatedResource);

  } catch (error) {
    if (error instanceof z.ZodError) {
      return createApiResponse(false, null, error.errors[0].message, 400);
    }

    console.error('Update proxy resource error:', error);
    return createApiResponse(false, null, '更新代理资源失败', 500);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    const decoded = verifyToken(token);
    
    if (!decoded) {
      return createApiResponse(false, null, '未授权访问', 401);
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const groupId = searchParams.get('groupId');

    if (!id || !groupId) {
      return createApiResponse(false, null, '缺少必要参数', 400);
    }

    // 验证用户是否为组管理员
    const groupMember = await prisma.groupMember.findFirst({
      where: {
        userId: decoded.userId,
        groupId: groupId,
        status: 'active',
        role: { in: ['admin', 'owner'] },
      },
    });

    if (!groupMember) {
      return createApiResponse(false, null, '无权管理该组的代理资源', 403);
    }

    // 验证并删除绑定
    const binding = await prisma.proxyBinding.findFirst({
      where: {
        proxyResourceId: id,
        groupId: groupId,
      },
    });

    if (!binding) {
      return createApiResponse(false, null, '代理资源不存在或无权访问', 404);
    }

    await prisma.$transaction(async (tx) => {
      // 删除绑定
      await tx.proxyBinding.delete({
        where: { id: binding.id },
      });

      // 检查是否还有其他组使用该代理资源
      const otherBindings = await tx.proxyBinding.count({
        where: {
          proxyResourceId: id,
        },
      });

      // 如果没有其他组使用，删除代理资源
      if (otherBindings === 0) {
        await tx.proxyResource.delete({
          where: { id },
        });
      }
    });

    return createApiResponse(true, { message: '代理资源删除成功' });

  } catch (error) {
    console.error('Delete proxy resource error:', error);
    return createApiResponse(false, null, '删除代理资源失败', 500);
  }
}
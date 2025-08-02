/**
 * 企业级设置管理API
 * 
 * 提供企业设置配置和管理功能
 */

import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { createApiResponse } from '@/lib/middleware';
import { verifyToken } from '@/lib/auth';

const prisma = new PrismaClient();

/**
 * 获取企业设置数据
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ enterpriseId: string }> }
) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) {
      return createApiResponse(false, null, '缺少认证令牌', 401);
    }

    const user = await verifyToken(token);
    if (!user) {
      return createApiResponse(false, null, '认证令牌无效', 401);
    }

    const { enterpriseId } = await params;

    // 验证企业访问权限 - 只有管理员可以访问设置
    const userMembership = await prisma.userEnterprise.findFirst({
      where: {
        userId: user.id,
        enterpriseId: enterpriseId,
        isActive: true,
        role: { in: ['owner', 'admin'] }
      }
    });

    if (!userMembership) {
      return createApiResponse(false, null, '您没有权限访问企业设置', 403);
    }

    // 获取企业信息
    const enterprise = await prisma.enterprise.findUnique({
      where: { id: enterpriseId }
    });

    if (!enterprise) {
      return createApiResponse(false, null, '企业不存在', 404);
    }

    // 生成完整的企业设置数据
    const settings = {
      basic: {
        name: enterprise.name,
        description: enterprise.description || '',
        planType: enterprise.planType || 'enterprise',
        organizationType: enterprise.organizationType || 'enterprise',
        uiTheme: enterprise.uiTheme || 'professional'
      },
      features: {
        aiResources: true,
        analytics: true,
        budgetManagement: true,
        permissions: true,
        organization: true,
        monitoring: true,
        alerts: true
      },
      security: {
        passwordPolicy: {
          minLength: 8,
          requireUppercase: true,
          requireNumbers: true,
          requireSymbols: false
        },
        sessionTimeout: 480, // 8小时，单位分钟
        twoFactorAuth: false,
        ipWhitelist: []
      },
      integrations: {
        email: {
          enabled: false,
          provider: 'smtp',
          smtpHost: '',
          smtpPort: 587,
          username: ''
        },
        sms: {
          enabled: false,
          provider: 'aliyun',
          apiKey: ''
        },
        webhook: {
          enabled: false,
          urls: []
        }
      },
      notifications: {
        email: true,
        sms: false,
        inApp: true,
        budgetAlerts: true,
        systemAlerts: true
      }
    };

    console.log(`⚙️ API 企业设置: 为企业 ${enterprise.name} 获取了设置数据`);

    return createApiResponse(true, settings, '获取企业设置成功', 200);

  } catch (error) {
    console.error('获取企业设置失败:', error);
    return createApiResponse(false, null, '获取企业设置失败', 500);
  }
}

/**
 * 更新企业设置
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ enterpriseId: string }> }
) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) {
      return createApiResponse(false, null, '缺少认证令牌', 401);
    }

    const user = await verifyToken(token);
    if (!user) {
      return createApiResponse(false, null, '认证令牌无效', 401);
    }

    const { enterpriseId } = await params;
    const settings = await request.json();

    // 验证企业访问权限 - 只有管理员可以修改设置
    const userMembership = await prisma.userEnterprise.findFirst({
      where: {
        userId: user.id,
        enterpriseId: enterpriseId,
        isActive: true,
        role: { in: ['owner', 'admin'] }
      }
    });

    if (!userMembership) {
      return createApiResponse(false, null, '您没有权限修改企业设置', 403);
    }

    // 更新企业基本信息
    if (settings.basic) {
      await prisma.enterprise.update({
        where: { id: enterpriseId },
        data: {
          name: settings.basic.name,
          description: settings.basic.description,
          planType: settings.basic.planType,
          organizationType: settings.basic.organizationType,
          uiTheme: settings.basic.uiTheme
        }
      });
    }

    // 这里可以添加更多设置的数据库更新逻辑
    // 例如：功能配置、安全设置、集成配置等
    // 目前只更新企业基本信息到数据库

    console.log(`⚙️ API 企业设置: 为企业 ${enterpriseId} 更新了设置`);

    return createApiResponse(true, {
      message: '设置更新成功',
      updatedAt: new Date().toISOString(),
      updatedBy: user.id
    }, '企业设置更新成功', 200);

  } catch (error) {
    console.error('更新企业设置失败:', error);
    return createApiResponse(false, null, '更新企业设置失败', 500);
  }
}

/**
 * 重置企业设置为默认值
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ enterpriseId: string }> }
) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) {
      return createApiResponse(false, null, '缺少认证令牌', 401);
    }

    const user = await verifyToken(token);
    if (!user) {
      return createApiResponse(false, null, '认证令牌无效', 401);
    }

    const { enterpriseId } = await params;

    // 验证企业访问权限 - 只有拥有者可以重置设置
    const userMembership = await prisma.userEnterprise.findFirst({
      where: {
        userId: user.id,
        enterpriseId: enterpriseId,
        isActive: true,
        role: 'owner'
      }
    });

    if (!userMembership) {
      return createApiResponse(false, null, '只有企业拥有者可以重置设置', 403);
    }

    // 重置企业设置为默认值
    await prisma.enterprise.update({
      where: { id: enterpriseId },
      data: {
        planType: 'enterprise',
        organizationType: 'enterprise',
        uiTheme: 'professional'
      }
    });

    console.log(`⚙️ API 企业设置: 为企业 ${enterpriseId} 重置了设置`);

    return createApiResponse(true, {
      message: '设置已重置为默认值',
      resetAt: new Date().toISOString(),
      resetBy: user.id
    }, '企业设置重置成功', 200);

  } catch (error) {
    console.error('重置企业设置失败:', error);
    return createApiResponse(false, null, '重置企业设置失败', 500);
  }
}
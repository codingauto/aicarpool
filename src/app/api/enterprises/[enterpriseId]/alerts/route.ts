/**
 * 企业级告警管理API
 * 
 * 提供企业告警规则、事件和通知渠道管理功能
 */

import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { createApiResponse } from '@/lib/middleware';
import { verifyToken } from '@/lib/auth';

const prisma = new PrismaClient();

/**
 * 获取企业告警数据
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

    // 验证企业访问权限
    const enterprise = await prisma.enterprise.findUnique({
      where: { id: enterpriseId }
    });

    if (!enterprise) {
      return createApiResponse(false, null, '企业不存在', 404);
    }

    // 检查用户是否是企业成员
    const userMembership = await prisma.userEnterprise.findFirst({
      where: {
        userId: user.id,
        enterpriseId: enterpriseId,
        isActive: true
      }
    });

    if (!userMembership) {
      return createApiResponse(false, null, '您不是该企业的成员', 403);
    }

    // 生成模拟告警规则数据
    const rules = [
      {
        id: 'rule_001',
        name: 'CPU使用率告警',
        description: '当CPU使用率超过80%时触发告警',
        condition: 'cpu_usage > 80%',
        severity: 'warning' as const,
        isEnabled: true,
        triggers: ['cpu_usage'],
        actions: ['email', 'sms'],
        cooldown: 300,
        createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        lastTriggered: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
      },
      {
        id: 'rule_002',
        name: '内存使用率告警',
        description: '当内存使用率超过90%时触发严重告警',
        condition: 'memory_usage > 90%',
        severity: 'error' as const,
        isEnabled: true,
        triggers: ['memory_usage'],
        actions: ['email', 'webhook'],
        cooldown: 180,
        createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()
      },
      {
        id: 'rule_003',
        name: 'API响应时间告警',
        description: '当API平均响应时间超过2秒时触发告警',
        condition: 'api_response_time > 2000ms',
        severity: 'warning' as const,
        isEnabled: true,
        triggers: ['api_response_time'],
        actions: ['email'],
        cooldown: 600,
        createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
        lastTriggered: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString()
      },
      {
        id: 'rule_004',
        name: '服务宕机告警',
        description: '当关键服务不可用时立即触发严重告警',
        condition: 'service_status = "down"',
        severity: 'critical' as const,
        isEnabled: true,
        triggers: ['service_status'],
        actions: ['email', 'sms', 'webhook'],
        cooldown: 60,
        createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString()
      },
      {
        id: 'rule_005',
        name: '磁盘空间告警',
        description: '当磁盘使用率超过85%时触发告警',
        condition: 'disk_usage > 85%',
        severity: 'warning' as const,
        isEnabled: false,
        triggers: ['disk_usage'],
        actions: ['email'],
        cooldown: 3600,
        createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString()
      }
    ];

    // 生成模拟告警事件数据
    const incidents = [
      {
        id: 'incident_001',
        ruleId: 'rule_001',
        ruleName: 'CPU使用率告警',
        severity: 'warning' as const,
        status: 'active' as const,
        title: 'CPU使用率过高',
        description: '服务器CPU使用率达到85%，超过预设阈值',
        startTime: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
        affectedServices: ['API Gateway', 'Load Balancer']
      },
      {
        id: 'incident_002',
        ruleId: 'rule_003',
        ruleName: 'API响应时间告警',
        severity: 'warning' as const,
        status: 'resolved' as const,
        title: 'API响应时间异常',
        description: 'Claude API平均响应时间达到2.5秒',
        startTime: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
        endTime: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        resolvedBy: user.id,
        affectedServices: ['Claude API']
      },
      {
        id: 'incident_003',
        ruleId: 'rule_001',
        ruleName: 'CPU使用率告警',
        severity: 'warning' as const,
        status: 'resolved' as const,
        title: 'CPU使用率告警',
        description: '数据库服务器CPU使用率超过80%',
        startTime: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(),
        endTime: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
        resolvedBy: user.id,
        affectedServices: ['Database']
      }
    ];

    // 动态生成一些随机事件
    if (Math.random() > 0.5) {
      incidents.push({
        id: `incident_${Date.now()}`,
        ruleId: 'rule_005',
        ruleName: '磁盘空间告警',
        severity: 'warning' as const,
        status: 'active' as const,
        title: '磁盘空间不足',
        description: '服务器磁盘使用率达到87%，需要及时清理',
        startTime: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
        affectedServices: ['Redis Cache', 'Database']
      });
    }

    // 生成模拟通知渠道数据
    const channels = [
      {
        id: 'channel_001',
        name: '企业邮箱通知',
        type: 'email' as const,
        isEnabled: true,
        config: {
          smtp_server: 'smtp.company.com',
          port: 587,
          use_tls: true
        },
        recipients: ['admin@company.com', 'ops@company.com']
      },
      {
        id: 'channel_002',
        name: '管理员短信',
        type: 'sms' as const,
        isEnabled: true,
        config: {
          provider: 'aliyun',
          template_id: 'SMS_123456'
        },
        recipients: ['+86138****1234', '+86139****5678']
      },
      {
        id: 'channel_003',
        name: 'Webhook通知',
        type: 'webhook' as const,
        isEnabled: true,
        config: {
          url: 'https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXXXXXX',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          }
        },
        recipients: ['#alerts', '#ops-team']
      },
      {
        id: 'channel_004',
        name: 'Slack通知',
        type: 'slack' as const,
        isEnabled: false,
        config: {
          webhook_url: 'https://hooks.slack.com/services/...',
          channel: '#alerts'
        },
        recipients: ['@admin', '@ops-team']
      }
    ];

    // 计算统计数据
    const stats = {
      totalRules: rules.length,
      activeRules: rules.filter(rule => rule.isEnabled).length,
      activeIncidents: incidents.filter(incident => incident.status === 'active').length,
      resolvedToday: incidents.filter(incident => 
        incident.status === 'resolved' && 
        new Date(incident.endTime || incident.startTime).toDateString() === new Date().toDateString()
      ).length
    };

    const alertsData = {
      rules,
      incidents,
      channels,
      stats
    };

    console.log(`🚨 API 企业告警: 为企业 ${enterprise.name} 获取了告警管理数据`);

    return createApiResponse(true, alertsData, '获取企业告警数据成功', 200);

  } catch (error) {
    console.error('获取企业告警数据失败:', error);
    return createApiResponse(false, null, '获取企业告警数据失败', 500);
  }
}

/**
 * 创建告警规则
 */
export async function POST(
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
    const body = await request.json();

    // 验证企业访问权限
    const userMembership = await prisma.userEnterprise.findFirst({
      where: {
        userId: user.id,
        enterpriseId: enterpriseId,
        isActive: true,
        role: { in: ['owner', 'admin'] } // 只有管理员可以创建规则
      }
    });

    if (!userMembership) {
      return createApiResponse(false, null, '您没有权限创建告警规则', 403);
    }

    const { name, description, condition, severity, triggers, actions, cooldown } = body;

    // 这里可以创建真实的告警规则记录到数据库
    // 目前返回模拟响应
    const newRule = {
      id: `rule_${Date.now()}`,
      name,
      description,
      condition,
      severity,
      isEnabled: true,
      triggers,
      actions,
      cooldown,
      createdAt: new Date().toISOString(),
      createdBy: user.id
    };

    console.log(`🚨 API 企业告警: 为企业 ${enterpriseId} 创建了告警规则 ${name}`);

    return createApiResponse(true, newRule, '告警规则创建成功', 201);

  } catch (error) {
    console.error('创建告警规则失败:', error);
    return createApiResponse(false, null, '创建告警规则失败', 500);
  }
}

/**
 * 更新告警规则或处理事件
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
    const body = await request.json();

    // 验证企业访问权限
    const userMembership = await prisma.userEnterprise.findFirst({
      where: {
        userId: user.id,
        enterpriseId: enterpriseId,
        isActive: true,
        role: { in: ['owner', 'admin'] }
      }
    });

    if (!userMembership) {
      return createApiResponse(false, null, '您没有权限修改告警设置', 403);
    }

    const { action, targetId, ...updateData } = body;

    if (action === 'resolve_incident') {
      // 处理告警事件
      console.log(`🚨 API 企业告警: 为企业 ${enterpriseId} 处理了告警事件 ${targetId}`);
      
      return createApiResponse(true, {
        incidentId: targetId,
        status: 'resolved',
        resolvedBy: user.id,
        resolvedAt: new Date().toISOString()
      }, '告警事件处理成功', 200);
    } else {
      // 更新告警规则
      console.log(`🚨 API 企业告警: 为企业 ${enterpriseId} 更新了告警规则 ${targetId}`);
      
      return createApiResponse(true, {
        ruleId: targetId,
        ...updateData,
        updatedBy: user.id,
        updatedAt: new Date().toISOString()
      }, '告警规则更新成功', 200);
    }

  } catch (error) {
    console.error('更新告警设置失败:', error);
    return createApiResponse(false, null, '更新告警设置失败', 500);
  }
}
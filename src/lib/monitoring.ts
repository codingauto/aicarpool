import { prisma } from './db';
import { emailQueue } from './email';

export interface AlertCondition {
  metric: string;
  operator: '>' | '<' | '>=' | '<=' | '==' | '!=';
  threshold: number;
  timeWindow?: number; // 时间窗口（秒）
  aggregation?: 'avg' | 'max' | 'min' | 'sum' | 'count';
}

export interface AlertRuleInfo {
  id: string;
  groupId?: string;
  ruleName: string;
  description?: string;
  condition: AlertCondition;
  severity: 'info' | 'warning' | 'error' | 'critical';
  isEnabled: boolean;
  cooldown: number;
  actions: {
    email?: { recipients: string[] };
    webhook?: { url: string; payload?: Record<string, any> };
    slack?: { channel: string; webhook: string };
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface AlertIncidentInfo {
  id: string;
  ruleId: string;
  status: 'active' | 'resolved' | 'suppressed';
  severity: string;
  title: string;
  description: string;
  metadata?: Record<string, any>;
  startTime: Date;
  endTime?: Date;
  resolvedBy?: string;
}

export interface MetricData {
  component: 'api' | 'database' | 'proxy' | 'edge_node' | 'quota' | 'system';
  metricName: string;
  value: number;
  unit: string;
  tags?: Record<string, string>;
  timestamp?: Date;
  groupId?: string;
}

export class MonitoringManager {
  // 记录系统指标
  async recordMetric(data: MetricData): Promise<void> {
    await prisma.systemMetric.create({
      data: {
        groupId: data.groupId,
        component: data.component,
        metricName: data.metricName,
        value: data.value,
        unit: data.unit,
        tags: data.tags || {},
        timestamp: data.timestamp || new Date(),
      },
    });

    // 检查是否触发告警
    await this.checkAlertRules(data);
  }

  // 批量记录指标
  async recordMetrics(metrics: MetricData[]): Promise<void> {
    const data = metrics.map(metric => ({
      groupId: metric.groupId,
      component: metric.component,
      metricName: metric.metricName,
      value: metric.value,
      unit: metric.unit,
      tags: metric.tags || {},
      timestamp: metric.timestamp || new Date(),
    }));

    await prisma.systemMetric.createMany({ data });

    // 批量检查告警
    for (const metric of metrics) {
      await this.checkAlertRules(metric);
    }
  }

  // 获取指标数据
  async getMetrics(
    filter: {
      component?: string;
      metricName?: string;
      groupId?: string;
      startTime?: Date;
      endTime?: Date;
      tags?: Record<string, string>;
    },
    aggregation?: {
      interval: '1m' | '5m' | '15m' | '1h' | '1d';
      function: 'avg' | 'max' | 'min' | 'sum' | 'count';
    }
  ): Promise<Array<{
    timestamp: Date;
    value: number;
    component: string;
    metricName: string;
    tags: Record<string, any>;
  }>> {
    const whereClause: Record<string, unknown> = {};

    if (filter.component) whereClause.component = filter.component;
    if (filter.metricName) whereClause.metricName = filter.metricName;
    if (filter.groupId) whereClause.groupId = filter.groupId;
    if (filter.startTime || filter.endTime) {
      whereClause.timestamp = {};
      if (filter.startTime) whereClause.timestamp.gte = filter.startTime;
      if (filter.endTime) whereClause.timestamp.lte = filter.endTime;
    }

    const metrics = await prisma.systemMetric.findMany({
      where: whereClause,
      orderBy: { timestamp: 'asc' },
    });

    // 如果需要聚合，执行聚合逻辑
    if (aggregation) {
      return this.aggregateMetrics(metrics, aggregation);
    }

    return metrics.map(metric => ({
      timestamp: metric.timestamp,
      value: Number(metric.value),
      component: metric.component,
      metricName: metric.metricName,
      tags: metric.tags as Record<string, any>,
    }));
  }

  // 创建告警规则
  async createAlertRule(rule: Omit<AlertRuleInfo, 'id' | 'createdAt' | 'updatedAt'>): Promise<AlertRuleInfo> {
    const created = await prisma.alertRule.create({
      data: {
        groupId: rule.groupId,
        ruleName: rule.ruleName,
        description: rule.description,
        condition: rule.condition as any,
        severity: rule.severity,
        isEnabled: rule.isEnabled,
        cooldown: rule.cooldown,
        actions: rule.actions as any,
      },
    });

    return {
      id: created.id,
      groupId: created.groupId || undefined,
      ruleName: created.ruleName,
      description: created.description || undefined,
      condition: created.condition as AlertCondition,
      severity: created.severity as any,
      isEnabled: created.isEnabled,
      cooldown: created.cooldown,
      actions: created.actions as any,
      createdAt: created.createdAt,
      updatedAt: created.updatedAt,
    };
  }

  // 获取告警规则列表
  async getAlertRules(groupId?: string): Promise<AlertRuleInfo[]> {
    const rules = await prisma.alertRule.findMany({
      where: groupId ? { groupId } : {},
      orderBy: { createdAt: 'desc' },
    });

    return rules.map(rule => ({
      id: rule.id,
      groupId: rule.groupId || undefined,
      ruleName: rule.ruleName,
      description: rule.description || undefined,
      condition: rule.condition as AlertCondition,
      severity: rule.severity as any,
      isEnabled: rule.isEnabled,
      cooldown: rule.cooldown,
      actions: rule.actions as any,
      createdAt: rule.createdAt,
      updatedAt: rule.updatedAt,
    }));
  }

  // 更新告警规则
  async updateAlertRule(
    ruleId: string,
    updates: Partial<Omit<AlertRuleInfo, 'id' | 'createdAt' | 'updatedAt'>>
  ): Promise<AlertRuleInfo> {
    const updated = await prisma.alertRule.update({
      where: { id: ruleId },
      data: {
        ...(updates.ruleName && { ruleName: updates.ruleName }),
        ...(updates.description !== undefined && { description: updates.description }),
        ...(updates.condition && { condition: updates.condition as any }),
        ...(updates.severity && { severity: updates.severity }),
        ...(updates.isEnabled !== undefined && { isEnabled: updates.isEnabled }),
        ...(updates.cooldown !== undefined && { cooldown: updates.cooldown }),
        ...(updates.actions && { actions: updates.actions as any }),
        updatedAt: new Date(),
      },
    });

    return {
      id: updated.id,
      groupId: updated.groupId || undefined,
      ruleName: updated.ruleName,
      description: updated.description || undefined,
      condition: updated.condition as AlertCondition,
      severity: updated.severity as any,
      isEnabled: updated.isEnabled,
      cooldown: updated.cooldown,
      actions: updated.actions as any,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    };
  }

  // 删除告警规则
  async deleteAlertRule(ruleId: string): Promise<void> {
    await prisma.alertRule.delete({
      where: { id: ruleId },
    });
  }

  // 获取告警事件
  async getAlertIncidents(
    filter: {
      ruleId?: string;
      status?: 'active' | 'resolved' | 'suppressed';
      severity?: string;
      startTime?: Date;
      endTime?: Date;
    } = {}
  ): Promise<AlertIncidentInfo[]> {
    const whereClause: Record<string, unknown> = {};

    if (filter.ruleId) whereClause.ruleId = filter.ruleId;
    if (filter.status) whereClause.status = filter.status;
    if (filter.severity) whereClause.severity = filter.severity;
    if (filter.startTime || filter.endTime) {
      whereClause.startTime = {};
      if (filter.startTime) whereClause.startTime.gte = filter.startTime;
      if (filter.endTime) whereClause.startTime.lte = filter.endTime;
    }

    const incidents = await prisma.alertIncident.findMany({
      where: whereClause,
      orderBy: { startTime: 'desc' },
    });

    return incidents.map(incident => ({
      id: incident.id,
      ruleId: incident.ruleId,
      status: incident.status as any,
      severity: incident.severity,
      title: incident.title,
      description: incident.description,
      metadata: incident.metadata as Record<string, any> || undefined,
      startTime: incident.startTime,
      endTime: incident.endTime || undefined,
      resolvedBy: incident.resolvedBy || undefined,
    }));
  }

  // 解决告警事件
  async resolveIncident(incidentId: string, resolvedBy: string): Promise<void> {
    await prisma.alertIncident.update({
      where: { id: incidentId },
      data: {
        status: 'resolved',
        endTime: new Date(),
        resolvedBy,
      },
    });
  }

  // 抑制告警事件
  async suppressIncident(incidentId: string): Promise<void> {
    await prisma.alertIncident.update({
      where: { id: incidentId },
      data: { status: 'suppressed' },
    });
  }

  // 系统健康检查
  async performHealthCheck(): Promise<{
    overall: 'healthy' | 'warning' | 'critical';
    services: Record<string, {
      status: 'healthy' | 'warning' | 'critical';
      metrics: Record<string, number>;
      message?: string;
    }>;
  }> {
    const services: any = {};

    // 检查数据库连接
    try {
      await prisma.$queryRaw`SELECT 1`;
      services.database = {
        status: 'healthy',
        metrics: { connection_time: 50 },
        message: '数据库连接正常',
      };
    } catch (error) {
      services.database = {
        status: 'critical',
        metrics: { connection_time: -1 },
        message: '数据库连接失败',
      };
    }

    // 检查API响应时间
    const apiMetrics = await this.getMetrics({
      component: 'api',
      metricName: 'response_time',
      startTime: new Date(Date.now() - 5 * 60 * 1000), // 最近5分钟
    });

    if (apiMetrics.length > 0) {
      const avgResponseTime = apiMetrics.reduce((sum, m) => sum + m.value, 0) / apiMetrics.length;
      services.api = {
        status: avgResponseTime > 1000 ? 'warning' : 'healthy',
        metrics: { avg_response_time: avgResponseTime },
        message: `平均响应时间: ${avgResponseTime.toFixed(2)}ms`,
      };
    } else {
      services.api = {
        status: 'warning',
        metrics: { avg_response_time: 0 },
        message: '无最近API指标数据',
      };
    }

    // 检查边缘节点状态
    const activeNodes = await prisma.edgeNode.count({
      where: {
        status: 'active',
        lastHeartbeat: { gte: new Date(Date.now() - 5 * 60 * 1000) },
      },
    });

    const totalNodes = await prisma.edgeNode.count();

    services.edge_nodes = {
      status: totalNodes === 0 ? 'warning' : activeNodes / totalNodes < 0.8 ? 'warning' : 'healthy',
      metrics: { active_nodes: activeNodes, total_nodes: totalNodes },
      message: `${activeNodes}/${totalNodes} 节点在线`,
    };

    // 计算整体健康状态
    const statuses = Object.values(services).map((s: any) => s.status);
    let overall: 'healthy' | 'warning' | 'critical' = 'healthy';

    if (statuses.includes('critical')) {
      overall = 'critical';
    } else if (statuses.includes('warning')) {
      overall = 'warning';
    }

    return { overall, services };
  }

  // 获取系统概览统计
  async getSystemOverview(): Promise<{
    users: { total: number; active: number };
    groups: { total: number; active: number };
    requests: { today: number; total: number };
    costs: { today: number; total: number };
    nodes: { active: number; total: number };
  }> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      totalUsers,
      activeUsers,
      totalGroups,
      activeGroups,
      todayRequests,
      totalRequests,
      activeNodes,
      totalNodes,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { status: 'active' } }),
      prisma.group.count(),
      prisma.group.count({ where: { status: 'active' } }),
      prisma.usageStat.count({ where: { requestTime: { gte: today } } }),
      prisma.usageStat.count(),
      prisma.edgeNode.count({
        where: {
          status: 'active',
          lastHeartbeat: { gte: new Date(Date.now() - 5 * 60 * 1000) },
        },
      }),
      prisma.edgeNode.count(),
    ]);

    // 计算成本
    const todayCosts = await prisma.usageStat.aggregate({
      where: { requestTime: { gte: today } },
      _sum: { cost: true },
    });

    const totalCosts = await prisma.usageStat.aggregate({
      _sum: { cost: true },
    });

    return {
      users: { total: totalUsers, active: activeUsers },
      groups: { total: totalGroups, active: activeGroups },
      requests: { today: todayRequests, total: totalRequests },
      costs: {
        today: Number(todayCosts._sum.cost || 0),
        total: Number(totalCosts._sum.cost || 0),
      },
      nodes: { active: activeNodes, total: totalNodes },
    };
  }

  // 私有方法：检查告警规则
  private async checkAlertRules(metric: MetricData): Promise<void> {
    const rules = await prisma.alertRule.findMany({
      where: {
        isEnabled: true,
        OR: [
          { groupId: metric.groupId },
          { groupId: null }, // 全局规则
        ],
      },
    });

    for (const rule of rules) {
      const condition = rule.condition as AlertCondition;
      
      // 检查指标是否匹配规则
      if (condition.metric === metric.metricName) {
        const shouldTrigger = this.evaluateCondition(condition, metric.value);
        
        if (shouldTrigger) {
          await this.triggerAlert(rule, metric);
        }
      }
    }
  }

  // 私有方法：评估告警条件
  private evaluateCondition(condition: AlertCondition, value: number): boolean {
    switch (condition.operator) {
      case '>':
        return value > condition.threshold;
      case '<':
        return value < condition.threshold;
      case '>=':
        return value >= condition.threshold;
      case '<=':
        return value <= condition.threshold;
      case '==':
        return value === condition.threshold;
      case '!=':
        return value !== condition.threshold;
      default:
        return false;
    }
  }

  // 私有方法：触发告警
  private async triggerAlert(rule: any, metric: MetricData): Promise<void> {
    // 检查冷却期
    const recentIncident = await prisma.alertIncident.findFirst({
      where: {
        ruleId: rule.id,
        status: 'active',
        startTime: { gte: new Date(Date.now() - rule.cooldown * 1000) },
      },
    });

    if (recentIncident) {
      return; // 还在冷却期内
    }

    // 创建告警事件
    const incident = await prisma.alertIncident.create({
      data: {
        ruleId: rule.id,
        status: 'active',
        severity: rule.severity,
        title: `${rule.ruleName} - ${metric.metricName} 告警`,
        description: `${metric.metricName} 值为 ${metric.value}，触发了告警规则`,
        metadata: {
          metric: metric.metricName,
          value: metric.value,
          threshold: (rule.condition as AlertCondition).threshold,
          component: metric.component,
          tags: metric.tags,
        },
      },
    });

    // 执行告警动作
    await this.executeAlertActions(rule.actions, incident, metric);
  }

  // 私有方法：执行告警动作
  private async executeAlertActions(
    actions: any,
    incident: any,
    metric: MetricData
  ): Promise<void> {
    // 发送邮件通知
    if (actions.email && actions.email.recipients) {
      for (const recipient of actions.email.recipients) {
        await emailQueue.addToQueue('alert', {
          to: recipient,
          alertType: 'service_down',
          details: {
            serviceName: metric.component,
            message: incident.description,
          },
        });
      }
    }

    // Webhook通知
    if (actions.webhook && actions.webhook.url) {
      try {
        await fetch(actions.webhook.url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            incident,
            metric,
            ...actions.webhook.payload,
          }),
        });
      } catch (error) {
        console.error('Webhook notification failed:', error);
      }
    }

    // 其他通知方式可以在此扩展
  }

  // 私有方法：聚合指标数据
  private aggregateMetrics(
    metrics: any[],
    aggregation: { interval: string; function: string }
  ): any[] {
    // 简化的聚合实现
    const intervalMs = this.parseInterval(aggregation.interval);
    const grouped = new Map<number, number[]>();

    // 按时间间隔分组
    metrics.forEach(metric => {
      const timestamp = metric.timestamp.getTime();
      const bucket = Math.floor(timestamp / intervalMs) * intervalMs;
      
      if (!grouped.has(bucket)) {
        grouped.set(bucket, []);
      }
      grouped.get(bucket)!.push(Number(metric.value));
    });

    // 聚合每个时间桶的数据
    return Array.from(grouped.entries()).map(([timestamp, values]) => {
      let aggregatedValue: number;
      
      switch (aggregation.function) {
        case 'avg':
          aggregatedValue = values.reduce((sum, v) => sum + v, 0) / values.length;
          break;
        case 'max':
          aggregatedValue = Math.max(...values);
          break;
        case 'min':
          aggregatedValue = Math.min(...values);
          break;
        case 'sum':
          aggregatedValue = values.reduce((sum, v) => sum + v, 0);
          break;
        case 'count':
          aggregatedValue = values.length;
          break;
        default:
          aggregatedValue = values[0] || 0;
      }

      return {
        timestamp: new Date(timestamp),
        value: aggregatedValue,
        component: metrics[0]?.component || '',
        metricName: metrics[0]?.metricName || '',
        tags: {},
      };
    });
  }

  // 私有方法：解析时间间隔
  private parseInterval(interval: string): number {
    const multipliers: Record<string, number> = {
      '1m': 60 * 1000,
      '5m': 5 * 60 * 1000,
      '15m': 15 * 60 * 1000,
      '1h': 60 * 60 * 1000,
      '1d': 24 * 60 * 60 * 1000,
    };

    return multipliers[interval] || 60 * 1000;
  }
}

// 单例监控管理器
export const monitoringManager = new MonitoringManager();
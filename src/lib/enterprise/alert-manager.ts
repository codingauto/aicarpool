import { prisma } from '@/lib/prisma';
import { cacheManager } from '@/lib/cache';
import { healthChecker } from './health-checker';
import { costTracker } from './cost-tracker';

export interface AlertRule {
  id: string;
  name: string;
  type: 'model_health' | 'budget_limit' | 'system_error' | 'performance';
  condition: {
    metric: string;
    operator: '>' | '<' | '>=' | '<=' | '=' | '!=';
    threshold: number;
    duration?: number; // 持续时间（秒）
  };
  targets: {
    entityType: 'enterprise' | 'department' | 'group' | 'model';
    entityIds: string[];
  };
  actions: {
    notify: boolean;
    email?: string[];
    webhook?: string;
    disable?: boolean; // 是否自动禁用有问题的资源
  };
  isActive: boolean;
  enterpriseId: string;
  createdBy: string;
  createdAt: Date;
}

export interface Alert {
  id: string;
  ruleId: string;
  ruleName: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'active' | 'resolved' | 'suppressed';
  entityType: string;
  entityId: string;
  entityName?: string;
  message: string;
  details: Record<string, any>;
  triggeredAt: Date;
  resolvedAt?: Date;
  acknowledgedBy?: string;
  acknowledgedAt?: Date;
}

export interface AlertSummary {
  total: number;
  active: number;
  resolved: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  recentAlerts: Alert[];
}

export class AlertManager {
  private alertRules: Map<string, AlertRule> = new Map();
  private activeAlerts: Map<string, Alert> = new Map();

  // 默认告警规则
  private readonly DEFAULT_RULES: Omit<AlertRule, 'id' | 'enterpriseId' | 'createdBy' | 'createdAt'>[] = [
    {
      name: '模型健康分数过低',
      type: 'model_health',
      condition: {
        metric: 'health_score',
        operator: '<',
        threshold: 50,
        duration: 300 // 5分钟
      },
      targets: {
        entityType: 'model',
        entityIds: ['claude-4-sonnet', 'claude-4-opus', 'kimi-k2', 'glm-4.5', 'qwen-max']
      },
      actions: {
        notify: true,
        disable: false
      },
      isActive: true
    },
    {
      name: '模型响应时间过长',
      type: 'performance',
      condition: {
        metric: 'response_time',
        operator: '>',
        threshold: 10000, // 10秒
        duration: 180 // 3分钟
      },
      targets: {
        entityType: 'model',
        entityIds: ['claude-4-sonnet', 'claude-4-opus', 'kimi-k2', 'glm-4.5', 'qwen-max']
      },
      actions: {
        notify: true,
        disable: false
      },
      isActive: true
    },
    {
      name: '预算使用率超限',
      type: 'budget_limit',
      condition: {
        metric: 'budget_usage_percentage',
        operator: '>=',
        threshold: 90
      },
      targets: {
        entityType: 'department',
        entityIds: []
      },
      actions: {
        notify: true,
        email: [],
        disable: false
      },
      isActive: true
    },
    {
      name: '预算已超支',
      type: 'budget_limit',
      condition: {
        metric: 'budget_usage_percentage',
        operator: '>',
        threshold: 100
      },
      targets: {
        entityType: 'department',
        entityIds: []
      },
      actions: {
        notify: true,
        email: [],
        disable: true // 自动禁用超支部门的服务
      },
      isActive: true
    }
  ];

  /**
   * 初始化告警管理器
   */
  async initialize(enterpriseId: string): Promise<void> {
    try {
      // 加载企业的告警规则
      await this.loadAlertRules(enterpriseId);
      
      // 如果没有自定义规则，创建默认规则
      if (this.alertRules.size === 0) {
        await this.createDefaultRules(enterpriseId, 'system');
      }

      // 启动告警检查循环
      this.startAlertMonitoring();

    } catch (error) {
      console.error('Initialize alert manager error:', error);
    }
  }

  /**
   * 执行告警检查
   */
  async checkAlerts(enterpriseId: string): Promise<Alert[]> {
    const triggeredAlerts: Alert[] = [];

    try {
      for (const rule of this.alertRules.values()) {
        if (!rule.isActive || rule.enterpriseId !== enterpriseId) continue;

        const alerts = await this.evaluateRule(rule);
        triggeredAlerts.push(...alerts);
      }

      // 保存新的告警
      for (const alert of triggeredAlerts) {
        await this.saveAlert(alert);
        this.activeAlerts.set(alert.id, alert);
      }

      return triggeredAlerts;

    } catch (error) {
      console.error('Check alerts error:', error);
      return [];
    }
  }

  /**
   * 评估告警规则
   */
  private async evaluateRule(rule: AlertRule): Promise<Alert[]> {
    const alerts: Alert[] = [];

    try {
      switch (rule.type) {
        case 'model_health':
          const healthAlerts = await this.checkModelHealthAlerts(rule);
          alerts.push(...healthAlerts);
          break;
          
        case 'performance':
          const perfAlerts = await this.checkPerformanceAlerts(rule);
          alerts.push(...perfAlerts);
          break;
          
        case 'budget_limit':
          const budgetAlerts = await this.checkBudgetAlerts(rule);
          alerts.push(...budgetAlerts);
          break;
      }

    } catch (error) {
      console.error(`Evaluate rule ${rule.id} error:`, error);
    }

    return alerts;
  }

  /**
   * 检查模型健康告警
   */
  private async checkModelHealthAlerts(rule: AlertRule): Promise<Alert[]> {
    const alerts: Alert[] = [];

    for (const modelId of rule.targets.entityIds) {
      try {
        const healthScore = await healthChecker.getModelHealthScore(modelId);
        
        if (this.evaluateCondition(healthScore, rule.condition)) {
          const alert: Alert = {
            id: `alert_${Date.now()}_${modelId}`,
            ruleId: rule.id,
            ruleName: rule.name,
            severity: this.calculateSeverity(healthScore, rule.condition),
            status: 'active',
            entityType: 'model',
            entityId: modelId,
            entityName: modelId,
            message: `模型 ${modelId} 健康分数为 ${healthScore}，低于阈值 ${rule.condition.threshold}`,
            details: {
              healthScore,
              threshold: rule.condition.threshold,
              condition: rule.condition
            },
            triggeredAt: new Date()
          };

          alerts.push(alert);
        }
      } catch (error) {
        console.warn(`Check health for model ${modelId} failed:`, error);
      }
    }

    return alerts;
  }

  /**
   * 检查性能告警
   */
  private async checkPerformanceAlerts(rule: AlertRule): Promise<Alert[]> {
    const alerts: Alert[] = [];

    for (const modelId of rule.targets.entityIds) {
      try {
        const metrics = await healthChecker.getPerformanceMetrics(modelId, 'response_time', '5m');
        
        if (metrics.length > 0) {
          const avgResponseTime = metrics.reduce((sum, m) => sum + m.value, 0) / metrics.length;
          
          if (this.evaluateCondition(avgResponseTime, rule.condition)) {
            const alert: Alert = {
              id: `alert_${Date.now()}_${modelId}`,
              ruleId: rule.id,
              ruleName: rule.name,
              severity: this.calculateSeverity(avgResponseTime, rule.condition),
              status: 'active',
              entityType: 'model',
              entityId: modelId,
              entityName: modelId,
              message: `模型 ${modelId} 平均响应时间为 ${avgResponseTime.toFixed(0)}ms，超过阈值 ${rule.condition.threshold}ms`,
              details: {
                responseTime: avgResponseTime,
                threshold: rule.condition.threshold,
                sampleCount: metrics.length
              },
              triggeredAt: new Date()
            };

            alerts.push(alert);
          }
        }
      } catch (error) {
        console.warn(`Check performance for model ${modelId} failed:`, error);
      }
    }

    return alerts;
  }

  /**
   * 检查预算告警
   */
  private async checkBudgetAlerts(rule: AlertRule): Promise<Alert[]> {
    const alerts: Alert[] = [];

    try {
      // 获取所有部门的预算使用情况
      const departments = await prisma.department.findMany({
        where: { enterpriseId: rule.targets.entityIds[0] || '' },
        select: { id: true, name: true, budgetLimit: true }
      });

      for (const department of departments) {
        if (!department.budgetLimit) continue;

        const budgetUsage = await costTracker.getBudgetUsage('department', department.id, 'monthly');
        
        if (this.evaluateCondition(budgetUsage.percentage, rule.condition)) {
          const alert: Alert = {
            id: `alert_${Date.now()}_${department.id}`,
            ruleId: rule.id,
            ruleName: rule.name,
            severity: budgetUsage.percentage >= 100 ? 'critical' : 'high',
            status: 'active',
            entityType: 'department',
            entityId: department.id,
            entityName: department.name,
            message: `部门 ${department.name} 预算使用率为 ${budgetUsage.percentage.toFixed(1)}%，${budgetUsage.percentage >= 100 ? '已超支' : '接近限额'}`,
            details: {
              budgetUsage,
              threshold: rule.condition.threshold
            },
            triggeredAt: new Date()
          };

          alerts.push(alert);
        }
      }
    } catch (error) {
      console.warn('Check budget alerts failed:', error);
    }

    return alerts;
  }

  /**
   * 评估条件
   */
  private evaluateCondition(value: number, condition: AlertRule['condition']): boolean {
    switch (condition.operator) {
      case '>': return value > condition.threshold;
      case '<': return value < condition.threshold;
      case '>=': return value >= condition.threshold;
      case '<=': return value <= condition.threshold;
      case '=': return value === condition.threshold;
      case '!=': return value !== condition.threshold;
      default: return false;
    }
  }

  /**
   * 计算告警严重程度
   */
  private calculateSeverity(value: number, condition: AlertRule['condition']): Alert['severity'] {
    const threshold = condition.threshold;
    const diff = Math.abs(value - threshold);
    const percentage = diff / threshold;

    if (percentage >= 0.5) return 'critical';
    if (percentage >= 0.3) return 'high';
    if (percentage >= 0.1) return 'medium';
    return 'low';
  }

  /**
   * 获取告警汇总
   */
  async getAlertSummary(enterpriseId: string): Promise<AlertSummary> {
    try {
      const alerts = Array.from(this.activeAlerts.values())
        .filter(alert => alert.status === 'active');

      const summary: AlertSummary = {
        total: alerts.length,
        active: alerts.filter(a => a.status === 'active').length,
        resolved: alerts.filter(a => a.status === 'resolved').length,
        critical: alerts.filter(a => a.severity === 'critical').length,
        high: alerts.filter(a => a.severity === 'high').length,
        medium: alerts.filter(a => a.severity === 'medium').length,
        low: alerts.filter(a => a.severity === 'low').length,
        recentAlerts: alerts
          .sort((a, b) => b.triggeredAt.getTime() - a.triggeredAt.getTime())
          .slice(0, 10)
      };

      return summary;

    } catch (error) {
      console.error('Get alert summary error:', error);
      return {
        total: 0, active: 0, resolved: 0, critical: 0, high: 0, medium: 0, low: 0,
        recentAlerts: []
      };
    }
  }

  /**
   * 启动告警监控
   */
  private startAlertMonitoring(): void {
    // 每分钟检查一次告警
    setInterval(async () => {
      try {
        // 这里应该获取所有活跃的企业ID
        const enterpriseIds = ['ent_001', 'ent_002']; // 示例
        
        for (const enterpriseId of enterpriseIds) {
          const alerts = await this.checkAlerts(enterpriseId);
          
          if (alerts.length > 0) {
            console.log(`Triggered ${alerts.length} alerts for enterprise ${enterpriseId}`);
            
            // 执行告警动作
            for (const alert of alerts) {
              await this.executeAlertActions(alert);
            }
          }
        }
      } catch (error) {
        console.error('Alert monitoring error:', error);
      }
    }, 60000); // 1分钟
  }

  /**
   * 执行告警动作
   */
  private async executeAlertActions(alert: Alert): Promise<void> {
    try {
      const rule = this.alertRules.get(alert.ruleId);
      if (!rule) return;

      // 缓存告警信息
      await cacheManager.set(`alert:${alert.id}`, alert, 24 * 60 * 60); // 24小时

      // 发送通知（这里可以集成邮件、Webhook等）
      if (rule.actions.notify) {
        console.log(`Alert notification: ${alert.message}`);
      }

      // 自动禁用资源
      if (rule.actions.disable && alert.severity === 'critical') {
        console.log(`Auto-disabling resource: ${alert.entityType}:${alert.entityId}`);
      }

    } catch (error) {
      console.error('Execute alert actions error:', error);
    }
  }

  /**
   * 加载告警规则
   */
  private async loadAlertRules(enterpriseId: string): Promise<void> {
    try {
      // 从数据库加载自定义规则（如果表存在）
      // 这里暂时使用默认规则
      await this.createDefaultRules(enterpriseId, 'system');
    } catch (error) {
      console.warn('Load alert rules error:', error);
    }
  }

  /**
   * 创建默认规则
   */
  private async createDefaultRules(enterpriseId: string, createdBy: string): Promise<void> {
    for (const ruleTemplate of this.DEFAULT_RULES) {
      const rule: AlertRule = {
        ...ruleTemplate,
        id: `rule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        enterpriseId,
        createdBy,
        createdAt: new Date()
      };

      this.alertRules.set(rule.id, rule);
    }
  }

  /**
   * 保存告警
   */
  private async saveAlert(alert: Alert): Promise<void> {
    try {
      // 如果数据库表存在，保存到数据库
      // 这里暂时只保存到内存和缓存
      await cacheManager.set(`alert:${alert.id}`, alert, 24 * 60 * 60);
    } catch (error) {
      console.warn('Save alert error:', error);
    }
  }
}

// 创建单例告警管理器
export const alertManager = new AlertManager();
export default alertManager;
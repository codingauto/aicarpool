/**
 * 健康监控器
 */
import { EdgeClient } from './EdgeClient.js';
import { HealthCheckResult, MetricData } from '@/types/index.js';
import { SystemUtil } from '@/utils/system.js';
import cron from 'node-cron';

export class HealthMonitor {
  private edgeClient: EdgeClient;
  private healthCheckTask: cron.ScheduledTask | null = null;
  private metricsCollectionTask: cron.ScheduledTask | null = null;
  private isRunning: boolean = false;
  private lastHealthResult: HealthCheckResult | null = null;
  private metricsBuffer: MetricData[] = [];
  private maxMetricsBuffer: number = 1000;

  constructor(edgeClient: EdgeClient) {
    this.edgeClient = edgeClient;
  }

  /**
   * 启动健康监控器
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      return;
    }

    console.log('启动健康监控器');

    const healthInterval = this.edgeClient.nodeConfig.monitoring.healthCheckInterval;
    const metricsInterval = this.edgeClient.nodeConfig.monitoring.metricsInterval;

    // 启动健康检查任务
    const healthCronExpression = this.intervalToCron(healthInterval);
    this.healthCheckTask = cron.schedule(healthCronExpression, async () => {
      await this.performHealthCheck();
    }, {
      scheduled: false
    });

    // 启动指标收集任务
    const metricsCronExpression = this.intervalToCron(metricsInterval);
    this.metricsCollectionTask = cron.schedule(metricsCronExpression, async () => {
      await this.collectMetrics();
    }, {
      scheduled: false
    });

    this.healthCheckTask.start();
    this.metricsCollectionTask.start();
    this.isRunning = true;

    // 立即执行一次健康检查
    await this.performHealthCheck();
  }

  /**
   * 停止健康监控器
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    console.log('停止健康监控器');

    if (this.healthCheckTask) {
      this.healthCheckTask.stop();
      this.healthCheckTask = null;
    }

    if (this.metricsCollectionTask) {
      this.metricsCollectionTask.stop();
      this.metricsCollectionTask = null;
    }

    // 发送剩余的指标数据
    if (this.metricsBuffer.length > 0) {
      await this.sendMetricsToServer();
    }

    this.isRunning = false;
  }

  /**
   * 执行健康检查
   */
  async performHealthCheck(): Promise<HealthCheckResult> {
    try {
      console.log('执行健康检查...');

      const healthResult = await SystemUtil.performHealthCheck();
      this.lastHealthResult = healthResult;

      // 上报健康状态到服务器
      await this.edgeClient.reportHealthStatus({
        nodeId: this.edgeClient.nodeId,
        healthData: healthResult
      });

      // 触发健康检查事件
      this.edgeClient.emit('health_check', healthResult);

      // 记录健康状态变化
      this.logHealthStatusChange(healthResult);

      console.log(`健康检查完成 - 状态: ${healthResult.status}, 分数: ${healthResult.score}`);

      return healthResult;

    } catch (error) {
      console.error('健康检查失败:', error);
      
      const errorResult: HealthCheckResult = {
        status: 'unhealthy',
        score: 0,
        checks: {
          cpu: { status: 'error', value: 0 },
          memory: { status: 'error', value: 0 },
          network: { status: 'error', value: 0 },
          disk: { status: 'error', value: 0 },
          services: { status: 'error', count: 0 }
        },
        timestamp: new Date()
      };

      this.lastHealthResult = errorResult;
      return errorResult;
    }
  }

  /**
   * 收集指标数据
   */
  private async collectMetrics(): Promise<void> {
    try {
      const nodeId = this.edgeClient.nodeId;
      if (!nodeId) {
        return;
      }

      const systemLoad = await SystemUtil.getSystemLoad();
      const timestamp = new Date();

      // 收集各种指标
      const metrics: MetricData[] = [
        {
          nodeId,
          metricType: 'cpu',
          value: systemLoad.cpu,
          unit: 'percent',
          timestamp,
          metadata: { source: 'system' }
        },
        {
          nodeId,
          metricType: 'memory',
          value: systemLoad.memory,
          unit: 'percent',
          timestamp,
          metadata: { source: 'system' }
        },
        {
          nodeId,
          metricType: 'network',
          value: systemLoad.requestsPerSecond,
          unit: 'rps',
          timestamp,
          metadata: { source: 'system' }
        },
        {
          nodeId,
          metricType: 'requests',
          value: systemLoad.connections,
          unit: 'count',
          timestamp,
          metadata: { source: 'system' }
        }
      ];

      // 添加到缓冲区
      this.metricsBuffer.push(...metrics);

      // 如果缓冲区达到最大容量，发送到服务器
      if (this.metricsBuffer.length >= this.maxMetricsBuffer) {
        await this.sendMetricsToServer();
      }

      console.log(`指标收集完成 - CPU: ${systemLoad.cpu}%, 内存: ${systemLoad.memory}%, 缓冲区: ${this.metricsBuffer.length}`);

    } catch (error) {
      console.error('指标收集失败:', error);
    }
  }

  /**
   * 发送指标数据到服务器
   */
  private async sendMetricsToServer(): Promise<void> {
    if (this.metricsBuffer.length === 0) {
      return;
    }

    try {
      console.log(`发送${this.metricsBuffer.length}条指标数据到服务器...`);

      // 这里可以实现批量发送指标数据的逻辑
      // 由于WebSocket连接可能不稳定，可以考虑使用HTTP API
      
      const nodeId = this.edgeClient.nodeId;
      if (!nodeId) {
        return;
      }

      // 简化实现：通过WebSocket发送
      if (this.edgeClient.isNodeConnected) {
        const message = {
          type: 'metrics_report',
          id: `metrics_${Date.now()}`,
          timestamp: new Date().toISOString(),
          data: {
            nodeId,
            metrics: this.metricsBuffer.map(metric => ({
              metricType: metric.metricType,
              value: metric.value,
              unit: metric.unit,
              timestamp: metric.timestamp.toISOString(),
              metadata: metric.metadata
            }))
          }
        };

        // 使用NetworkUtil发送消息（需要在EdgeClient中实现）
        this.edgeClient.emit('send_message', message);
      }

      // 清空缓冲区
      this.metricsBuffer = [];

      console.log('指标数据发送完成');

    } catch (error) {
      console.error('发送指标数据失败:', error);
      
      // 如果发送失败，保留部分数据（避免内存溢出）
      if (this.metricsBuffer.length > this.maxMetricsBuffer * 2) {
        this.metricsBuffer = this.metricsBuffer.slice(-this.maxMetricsBuffer);
      }
    }
  }

  /**
   * 记录健康状态变化
   */
  private logHealthStatusChange(currentResult: HealthCheckResult): void {
    if (!this.lastHealthResult) {
      console.log(`初始健康状态: ${currentResult.status} (分数: ${currentResult.score})`);
      return;
    }

    if (this.lastHealthResult.status !== currentResult.status) {
      console.log(`健康状态变化: ${this.lastHealthResult.status} -> ${currentResult.status} (分数: ${this.lastHealthResult.score} -> ${currentResult.score})`);
      
      // 触发状态变化事件
      this.edgeClient.emit('health_status_changed', {
        previous: this.lastHealthResult,
        current: currentResult
      });
    }

    // 检查各个检查项的状态变化
    Object.keys(currentResult.checks).forEach(checkName => {
      const previousCheck = this.lastHealthResult!.checks[checkName as keyof typeof this.lastHealthResult.checks];
      const currentCheck = currentResult.checks[checkName as keyof typeof currentResult.checks];
      
      if (previousCheck && previousCheck.status !== currentCheck.status) {
        console.log(`${checkName}状态变化: ${previousCheck.status} -> ${currentCheck.status}`);
      }
    });
  }

  /**
   * 将毫秒间隔转换为cron表达式
   */
  private intervalToCron(intervalMs: number): string {
    const seconds = Math.floor(intervalMs / 1000);
    
    if (seconds < 60) {
      return `*/${seconds} * * * * *`;
    } else if (seconds < 3600) {
      const minutes = Math.floor(seconds / 60);
      return `0 */${minutes} * * * *`;
    } else {
      const hours = Math.floor(seconds / 3600);
      return `0 0 */${hours} * * *`;
    }
  }

  /**
   * 获取最后的健康检查结果
   */
  getLastHealthResult(): HealthCheckResult | null {
    return this.lastHealthResult;
  }

  /**
   * 获取当前指标缓冲区大小
   */
  getMetricsBufferSize(): number {
    return this.metricsBuffer.length;
  }

  /**
   * 清空指标缓冲区
   */
  clearMetricsBuffer(): void {
    this.metricsBuffer = [];
  }

  /**
   * 手动触发健康检查
   */
  async triggerHealthCheck(): Promise<HealthCheckResult> {
    return await this.performHealthCheck();
  }

  /**
   * 手动触发指标收集
   */
  async triggerMetricsCollection(): Promise<void> {
    await this.collectMetrics();
  }

  /**
   * 获取运行状态
   */
  get isMonitorRunning(): boolean {
    return this.isRunning;
  }
}
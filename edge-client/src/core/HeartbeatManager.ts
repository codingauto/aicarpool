/**
 * 心跳管理器
 */
import { EdgeClient } from './EdgeClient.js';
import { HeartbeatData } from '@/types/index.js';
import { SystemUtil } from '@/utils/system.js';
import cron from 'node-cron';

export class HeartbeatManager {
  private edgeClient: EdgeClient;
  private heartbeatTask: cron.ScheduledTask | null = null;
  private isRunning: boolean = false;

  constructor(edgeClient: EdgeClient) {
    this.edgeClient = edgeClient;
  }

  /**
   * 启动心跳管理器
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      return;
    }

    const interval = this.edgeClient.nodeConfig.monitoring.heartbeatInterval;
    const cronExpression = this.intervalToCron(interval);

    console.log(`启动心跳管理器，间隔: ${interval}ms`);

    this.heartbeatTask = cron.schedule(cronExpression, async () => {
      await this.sendHeartbeat();
    }, {
      scheduled: false
    });

    this.heartbeatTask.start();
    this.isRunning = true;

    // 立即发送一次心跳
    await this.sendHeartbeat();
  }

  /**
   * 停止心跳管理器
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    console.log('停止心跳管理器');

    if (this.heartbeatTask) {
      this.heartbeatTask.stop();
      this.heartbeatTask = null;
    }

    this.isRunning = false;
  }

  /**
   * 发送心跳
   */
  private async sendHeartbeat(): Promise<void> {
    try {
      if (!this.edgeClient.isNodeConnected) {
        console.warn('节点未连接，跳过心跳发送');
        return;
      }

      const nodeId = this.edgeClient.nodeId;
      if (!nodeId) {
        console.warn('节点ID不存在，跳过心跳发送');
        return;
      }

      // 获取系统负载信息
      const currentLoad = await SystemUtil.getSystemLoad();

      const heartbeatData: HeartbeatData = {
        nodeId,
        timestamp: new Date(),
        currentLoad,
        status: 'active',
        metadata: {
          version: '1.0.0',
          uptime: process.uptime(),
          nodeVersion: process.version,
          platform: process.platform,
          arch: process.arch
        }
      };

      await this.edgeClient.sendHeartbeat(heartbeatData);
      
      console.log(`心跳已发送 - CPU: ${currentLoad.cpu}%, 内存: ${currentLoad.memory}%, 连接: ${currentLoad.connections}`);

    } catch (error) {
      console.error('发送心跳失败:', error);
    }
  }

  /**
   * 将毫秒间隔转换为cron表达式
   */
  private intervalToCron(intervalMs: number): string {
    const seconds = Math.floor(intervalMs / 1000);
    
    if (seconds < 60) {
      // 每N秒执行一次
      return `*/${seconds} * * * * *`;
    } else if (seconds < 3600) {
      // 每N分钟执行一次
      const minutes = Math.floor(seconds / 60);
      return `0 */${minutes} * * * *`;
    } else {
      // 每N小时执行一次
      const hours = Math.floor(seconds / 3600);
      return `0 0 */${hours} * * *`;
    }
  }

  /**
   * 手动发送心跳
   */
  async sendManualHeartbeat(): Promise<void> {
    await this.sendHeartbeat();
  }

  /**
   * 获取运行状态
   */
  get isHeartbeatRunning(): boolean {
    return this.isRunning;
  }
}
/**
 * 异步使用统计记录系统 - 消息队列处理器
 * v2.7 高并发优化 - 避免同步数据库写入阻塞API响应
 */

import { prisma } from '@/lib/prisma';
import { cacheClient } from '../cache/redis-config';
import { cacheService } from '../cache/cache-service';

// Use shared Prisma client singleton

// 使用记录接口
export interface UsageRecord {
  id?: string;
  groupId: string;
  userId: string;
  accountId: string;
  apiKeyId?: string;
  serviceType: string;
  modelName?: string;
  requestType: string;
  requestTokens: number;
  responseTokens: number;
  totalTokens: number;
  cost: number;
  requestTime: number; // 时间戳
  responseTime?: number;
  metadata?: {
    apiKeyName?: string;
    userAgent?: string;
    clientVersion?: string;
    [key: string]: any;
  };
}

// 批量处理配置
const BATCH_CONFIG = {
  BATCH_SIZE: parseInt(process.env.USAGE_BATCH_SIZE || '100'),
  FLUSH_INTERVAL: parseInt(process.env.USAGE_FLUSH_INTERVAL || '10000'), // 10秒
  MAX_RETRY_ATTEMPTS: parseInt(process.env.USAGE_MAX_RETRIES || '3'),
  RETRY_DELAY: parseInt(process.env.USAGE_RETRY_DELAY || '1000'), // 1秒
  DEAD_LETTER_TTL: parseInt(process.env.USAGE_DLQ_TTL || '86400'), // 24小时
} as const;

// 队列键名
const QUEUE_KEYS = {
  MAIN: 'usage_queue',
  DLQ: 'usage_dlq', // 死信队列
  PROCESSING: 'usage_processing',
  STATS: 'usage_stats',
} as const;

/**
 * 使用统计队列处理器
 */
export class UsageQueueProcessor {
  private static instance: UsageQueueProcessor;
  private buffer: UsageRecord[] = [];
  private flushTimer: NodeJS.Timeout | null = null;
  private isProcessing = false;
  private isShuttingDown = false;
  private retryCount = new Map<string, number>();

  private constructor() {
    this.startFlushTimer();
    this.startQueueWorker();
    this.setupGracefulShutdown();
  }

  public static getInstance(): UsageQueueProcessor {
    if (!UsageQueueProcessor.instance) {
      UsageQueueProcessor.instance = new UsageQueueProcessor();
    }
    return UsageQueueProcessor.instance;
  }

  /**
   * 添加使用记录到队列（主要入口）
   */
  async addUsageRecord(record: UsageRecord): Promise<void> {
    try {
      // 生成唯一ID
      record.id = `${record.groupId}_${record.accountId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // 添加到内存缓冲区
      this.buffer.push(record);
      
      // 检查是否需要立即刷新
      if (this.buffer.length >= BATCH_CONFIG.BATCH_SIZE) {
        await this.flushBuffer();
      }

      console.log(`📥 使用记录已加入队列: ${record.id} (缓冲区: ${this.buffer.length}/${BATCH_CONFIG.BATCH_SIZE})`);
      
    } catch (error) {
      console.error('添加使用记录到队列失败:', error);
      
      // 发送到Redis队列作为备份
      try {
        await cacheClient.lpush(QUEUE_KEYS.MAIN, JSON.stringify(record));
      } catch (redisError) {
        console.error('发送到Redis队列也失败:', redisError);
        throw new Error('使用记录队列完全失败');
      }
    }
  }

  /**
   * 批量处理使用记录
   */
  async processUsageRecord(record: UsageRecord): Promise<void> {
    return this.addUsageRecord(record);
  }

  /**
   * 刷新内存缓冲区到持久化队列
   */
  private async flushBuffer(): Promise<void> {
    if (this.buffer.length === 0 || this.isProcessing) {
      return;
    }

    const batch = [...this.buffer];
    this.buffer = [];
    this.isProcessing = true;

    try {
      console.log(`🚀 开始批量处理使用记录 (${batch.length}条)`);
      const startTime = Date.now();

      // 1. 批量写入数据库
      await this.batchInsertUsageStats(batch);
      
      // 2. 批量更新API Key配额
      await this.batchUpdateApiKeyQuotas(batch);
      
      // 3. 批量更新账号指标
      await this.batchUpdateAccountMetrics(batch);
      
      // 4. 更新缓存统计
      await this.updateCacheStats(batch);

      const processingTime = Date.now() - startTime;
      console.log(`✅ 批量处理完成: ${batch.length}条记录，耗时 ${processingTime}ms`);
      
      // 更新处理统计
      await this.updateProcessingStats(batch.length, processingTime, true);

    } catch (error) {
      console.error('批量处理使用记录失败:', error);
      
      // 发送失败的记录到死信队列
      await this.sendToDeadLetterQueue(batch, error);
      
      // 更新失败统计
      await this.updateProcessingStats(batch.length, 0, false);
      
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * 批量插入使用统计到数据库
   */
  private async batchInsertUsageStats(records: UsageRecord[]): Promise<void> {
    try {
      const usageStats = records.map(record => ({
        userId: record.userId,
        groupId: record.groupId,
        accountId: record.accountId,
        aiServiceId: record.serviceType,
        requestType: record.requestType,
        requestTokens: record.requestTokens,
        responseTokens: record.responseTokens,
        totalTokens: BigInt(record.totalTokens),
        cost: record.cost,
        requestTime: new Date(record.requestTime),
        responseTime: record.responseTime || 0,
        status: 'success' as const,
        metadata: record.metadata || {}
      }));

      // 使用 Prisma 的 createMany 进行批量插入
      const result = await prisma.usageStat.createMany({
        data: usageStats,
        skipDuplicates: true
      });

      console.log(`📊 批量插入使用统计: ${result.count}条记录`);
      
    } catch (error) {
      console.error('批量插入使用统计失败:', error);
      throw error;
    }
  }

  /**
   * 批量更新API Key配额
   */
  private async batchUpdateApiKeyQuotas(records: UsageRecord[]): Promise<void> {
    try {
      // 按API Key分组统计Token使用量
      const quotaUpdates = new Map<string, number>();
      
      records.forEach(record => {
        if (record.apiKeyId) {
          const current = quotaUpdates.get(record.apiKeyId) || 0;
          quotaUpdates.set(record.apiKeyId, current + record.totalTokens);
        }
      });

      // 批量更新
      const updatePromises = Array.from(quotaUpdates.entries()).map(([apiKeyId, tokenIncrement]) =>
        prisma.apiKey.update({
          where: { id: apiKeyId },
          data: {
            quotaUsed: {
              increment: BigInt(tokenIncrement)
            }
          }
        }).catch(error => {
          console.error(`更新API Key配额失败 ${apiKeyId}:`, error);
        })
      );

      await Promise.allSettled(updatePromises);
      console.log(`🔑 批量更新API Key配额: ${quotaUpdates.size}个密钥`);
      
    } catch (error) {
      console.error('批量更新API Key配额失败:', error);
      // 不抛出错误，避免整个批处理失败
    }
  }

  /**
   * 批量更新账号指标
   */
  private async batchUpdateAccountMetrics(records: UsageRecord[]): Promise<void> {
    try {
      // 按账号分组统计
      const accountStats = new Map<string, {
        requests: number;
        tokens: number;
        cost: number;
        avgResponseTime: number;
      }>();

      records.forEach(record => {
        const current = accountStats.get(record.accountId) || {
          requests: 0,
          tokens: 0,
          cost: 0,
          avgResponseTime: 0
        };
        
        current.requests += 1;
        current.tokens += record.totalTokens;
        current.cost += record.cost;
        current.avgResponseTime = (current.avgResponseTime + (record.responseTime || 0)) / 2;
        
        accountStats.set(record.accountId, current);
      });

      // 批量更新账号
      const updatePromises = Array.from(accountStats.entries()).map(([accountId, stats]) =>
        prisma.aiServiceAccount.update({
          where: { id: accountId },
          data: {
            totalRequests: {
              increment: stats.requests
            },
            totalTokens: {
              increment: BigInt(stats.tokens)
            },
            totalCost: {
              increment: stats.cost
            },
            lastUsedAt: new Date()
          }
        }).catch(error => {
          console.error(`更新账号指标失败 ${accountId}:`, error);
        })
      );

      await Promise.allSettled(updatePromises);
      console.log(`🏦 批量更新账号指标: ${accountStats.size}个账号`);
      
    } catch (error) {
      console.error('批量更新账号指标失败:', error);
      // 不抛出错误，避免整个批处理失败
    }
  }

  /**
   * 更新缓存统计信息
   */
  private async updateCacheStats(records: UsageRecord[]): Promise<void> {
    try {
      const today = new Date().toISOString().split('T')[0];
      const thisMonth = new Date().toISOString().substring(0, 7);

      // 按拼车组统计每日使用量
      const dailyStats = new Map<string, { tokens: number; cost: number }>();
      const monthlyStats = new Map<string, { tokens: number; cost: number }>();

      records.forEach(record => {
        // 每日统计
        const dailyKey = record.groupId;
        const dailyCurrent = dailyStats.get(dailyKey) || { tokens: 0, cost: 0 };
        dailyCurrent.tokens += record.totalTokens;
        dailyCurrent.cost += record.cost;
        dailyStats.set(dailyKey, dailyCurrent);

        // 月度统计
        const monthlyCurrent = monthlyStats.get(dailyKey) || { tokens: 0, cost: 0 };
        monthlyCurrent.tokens += record.totalTokens;
        monthlyCurrent.cost += record.cost;
        monthlyStats.set(dailyKey, monthlyCurrent);
      });

      // 批量更新每日配额缓存
      const dailyUpdatePromises = Array.from(dailyStats.entries()).map(async ([groupId, stats]) => {
        try {
          const existing = await cacheService.getDailyQuota(groupId, today);
          const newUsed = (existing?.used || 0) + stats.cost;
          const limit = existing?.limit || 1000; // 默认限制
          
          await cacheService.setDailyQuota(groupId, newUsed, limit, today);
        } catch (error) {
          console.error(`更新每日配额缓存失败 ${groupId}:`, error);
        }
      });

      await Promise.allSettled(dailyUpdatePromises);
      console.log(`📈 批量更新缓存统计: 每日${dailyStats.size}个拼车组，月度${monthlyStats.size}个拼车组`);
      
    } catch (error) {
      console.error('更新缓存统计失败:', error);
    }
  }

  /**
   * 发送到死信队列
   */
  private async sendToDeadLetterQueue(records: UsageRecord[], error: any): Promise<void> {
    try {
      const dlqRecord = {
        records,
        error: error instanceof Error ? error.message : String(error),
        timestamp: Date.now(),
        retryCount: 0
      };

      await cacheClient.lpush(QUEUE_KEYS.DLQ, JSON.stringify(dlqRecord));
      await cacheClient.expire(QUEUE_KEYS.DLQ, BATCH_CONFIG.DEAD_LETTER_TTL);
      
      console.log(`💀 ${records.length}条记录已发送到死信队列`);
      
    } catch (dlqError) {
      console.error('发送到死信队列失败:', dlqError);
    }
  }

  /**
   * 更新处理统计信息
   */
  private async updateProcessingStats(
    recordCount: number, 
    processingTime: number, 
    success: boolean
  ): Promise<void> {
    try {
      const stats = {
        timestamp: Date.now(),
        recordCount,
        processingTime,
        success,
        date: new Date().toISOString().split('T')[0]
      };

      await cacheClient.lpush(QUEUE_KEYS.STATS, JSON.stringify(stats));
      
      // 只保留最近100条统计记录
      await cacheClient.ltrim(QUEUE_KEYS.STATS, 0, 99);
      
    } catch (error) {
      console.error('更新处理统计失败:', error);
    }
  }

  /**
   * 启动定时刷新器
   */
  private startFlushTimer(): void {
    this.flushTimer = setInterval(async () => {
      if (!this.isShuttingDown) {
        await this.flushBuffer();
      }
    }, BATCH_CONFIG.FLUSH_INTERVAL);

    console.log(`⏰ 使用记录刷新定时器启动 (间隔: ${BATCH_CONFIG.FLUSH_INTERVAL}ms)`);
  }

  /**
   * 启动队列工作进程
   */
  private startQueueWorker(): void {
    // TODO: 实现从Redis队列处理积压的记录
    console.log(`👷 使用记录队列工作进程启动`);
  }

  /**
   * 设置优雅关闭
   */
  private setupGracefulShutdown(): void {
    const shutdown = async (signal: string) => {
      console.log(`📴 接收到${signal}信号，开始优雅关闭使用记录队列处理器...`);
      
      this.isShuttingDown = true;
      
      // 停止定时器
      if (this.flushTimer) {
        clearInterval(this.flushTimer);
        this.flushTimer = null;
      }
      
      // 刷新剩余的缓冲区
      if (this.buffer.length > 0) {
        console.log(`🚀 刷新剩余的${this.buffer.length}条记录...`);
        await this.flushBuffer();
      }
      
      console.log(`✅ 使用记录队列处理器已优雅关闭`);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  }

  /**
   * 获取队列统计信息
   */
  async getQueueStats(): Promise<{
    bufferSize: number;
    isProcessing: boolean;
    totalProcessed: number;
    totalFailed: number;
    avgProcessingTime: number;
    dlqSize: number;
  }> {
    try {
      const dlqSize = await cacheClient.llen(QUEUE_KEYS.DLQ);
      const statsData = await cacheClient.lrange(QUEUE_KEYS.STATS, 0, -1);
      
      let totalProcessed = 0;
      let totalFailed = 0;
      let totalTime = 0;
      let processedCount = 0;

      statsData.forEach(stat => {
        try {
          const parsed = JSON.parse(stat);
          totalProcessed += parsed.recordCount;
          if (parsed.success) {
            totalTime += parsed.processingTime;
            processedCount++;
          } else {
            totalFailed += parsed.recordCount;
          }
        } catch (error) {
          // 忽略解析错误
        }
      });

      return {
        bufferSize: this.buffer.length,
        isProcessing: this.isProcessing,
        totalProcessed,
        totalFailed,
        avgProcessingTime: processedCount > 0 ? totalTime / processedCount : 0,
        dlqSize
      };
      
    } catch (error) {
      console.error('获取队列统计失败:', error);
      return {
        bufferSize: this.buffer.length,
        isProcessing: this.isProcessing,
        totalProcessed: 0,
        totalFailed: 0,
        avgProcessingTime: 0,
        dlqSize: 0
      };
    }
  }

  /**
   * 手动刷新缓冲区
   */
  async manualFlush(): Promise<void> {
    await this.flushBuffer();
  }

  /**
   * 处理死信队列中的记录
   */
  async processDLQ(): Promise<{ processed: number; failed: number }> {
    let processed = 0;
    let failed = 0;

    try {
      const dlqSize = await cacheClient.llen(QUEUE_KEYS.DLQ);
      console.log(`🔄 开始处理死信队列: ${dlqSize}条记录`);

      for (let i = 0; i < dlqSize; i++) {
        const record = await cacheClient.rpop(QUEUE_KEYS.DLQ);
        if (!record) break;

        try {
          const dlqRecord = JSON.parse(record);
          
          // 检查重试次数
          if (dlqRecord.retryCount >= BATCH_CONFIG.MAX_RETRY_ATTEMPTS) {
            console.log(`❌ 记录已达到最大重试次数，丢弃: ${dlqRecord.records.length}条`);
            failed += dlqRecord.records.length;
            continue;
          }

          // 重试处理
          dlqRecord.retryCount++;
          await this.batchInsertUsageStats(dlqRecord.records);
          processed += dlqRecord.records.length;
          
        } catch (error) {
          console.error('处理死信队列记录失败:', error);
          
          // 重新放回队列
          await cacheClient.lpush(QUEUE_KEYS.DLQ, record);
          failed++;
        }
      }

      console.log(`✅ 死信队列处理完成: 成功${processed}条，失败${failed}条`);
      return { processed, failed };
      
    } catch (error) {
      console.error('处理死信队列失败:', error);
      return { processed, failed };
    }
  }
}

// 导出单例实例
export const usageQueueProcessor = UsageQueueProcessor.getInstance();
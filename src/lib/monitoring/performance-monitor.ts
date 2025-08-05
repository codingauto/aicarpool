/**
 * 性能监控和指标收集系统
 * v2.7 高并发优化 - 实时监控系统性能和缓存效果
 */

import { cacheClient } from '../cache/redis-config';
import { cacheService } from '../cache/cache-service';
import { usageQueueProcessor } from '../queue/usage-queue-processor';

// 性能指标接口定义
export interface PerformanceMetrics {
  timestamp: number;
  
  // API响应性能
  apiMetrics: {
    totalRequests: number;
    avgResponseTime: number;
    p50ResponseTime: number;
    p95ResponseTime: number;
    p99ResponseTime: number;
    errorRate: number;
    throughput: number; // requests per second
  };
  
  // 缓存性能
  cacheMetrics: {
    hitRate: number;
    missRate: number;
    totalOperations: number;
    avgLookupTime: number;
    memoryUsage: string;
    keyCount: number;
    evictionRate: number;
  };
  
  // 数据库性能
  databaseMetrics: {
    avgQueryTime: number;
    queriesPerRequest: number;
    connectionPoolUsage: number;
    slowQueryCount: number;
    totalQueries: number;
  };
  
  // 队列性能
  queueMetrics: {
    bufferSize: number;
    processingRate: number; // records per second
    avgProcessingTime: number;
    errorRate: number;
    backlog: number;
  };
  
  // 系统资源
  systemMetrics: {
    cpuUsage: number;
    memoryUsage: number;
    diskUsage: number;
    networkIO: number;
  };
}

// 性能事件接口
export interface PerformanceEvent {
  id: string;
  type: 'api_request' | 'cache_operation' | 'db_query' | 'queue_operation';
  startTime: number;
  endTime: number;
  duration: number;
  success: boolean;
  metadata: {
    path?: string;
    method?: string;
    cacheKey?: string;
    queryType?: string;
    operationType?: string;
    error?: string;
    [key: string]: any;
  };
}

// 监控配置
const MONITOR_CONFIG = {
  METRICS_COLLECTION_INTERVAL: parseInt(process.env.METRICS_COLLECTION_INTERVAL || '60000'), // 1分钟
  PERFORMANCE_WINDOW_SIZE: parseInt(process.env.PERFORMANCE_WINDOW_SIZE || '300'), // 5分钟窗口
  ALERT_THRESHOLDS: {
    RESPONSE_TIME_P95: parseInt(process.env.ALERT_RESPONSE_TIME_P95 || '1000'), // 1秒
    ERROR_RATE: parseFloat(process.env.ALERT_ERROR_RATE || '0.05'), // 5%
    CACHE_HIT_RATE: parseFloat(process.env.ALERT_CACHE_HIT_RATE || '0.8'), // 80%
    QUEUE_BACKLOG: parseInt(process.env.ALERT_QUEUE_BACKLOG || '1000'), // 1000条
  },
  RETENTION_DAYS: parseInt(process.env.METRICS_RETENTION_DAYS || '7'), // 保留7天
} as const;

// Redis键名
const MONITOR_KEYS = {
  METRICS: 'performance:metrics',
  EVENTS: 'performance:events',
  ALERTS: 'performance:alerts',
  STATS: 'performance:stats',
} as const;

/**
 * 性能监控器
 */
export class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private isRunning = false;
  private metricsTimer: NodeJS.Timeout | null = null;
  private eventBuffer: PerformanceEvent[] = [];
  private currentMetrics: PerformanceMetrics | null = null;

  private constructor() {}

  public static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  /**
   * 启动性能监控
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('⚠️ 性能监控器已在运行');
      return;
    }

    console.log('🚀 启动性能监控器...');
    this.isRunning = true;

    try {
      // 1. 启动指标收集定时器
      this.startMetricsCollection();

      // 2. 启动事件处理器
      this.startEventProcessor();

      // 3. 启动告警检查器
      this.startAlertChecker();

      console.log('✅ 性能监控器启动完成');

    } catch (error) {
      console.error('❌ 性能监控器启动失败:', error);
      this.isRunning = false;
      throw error;
    }
  }

  /**
   * 停止性能监控
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    console.log('📴 停止性能监控器...');
    this.isRunning = false;

    // 清理定时器
    if (this.metricsTimer) {
      clearInterval(this.metricsTimer);
      this.metricsTimer = null;
    }

    // 刷新剩余事件
    await this.flushEvents();

    console.log('✅ 性能监控器已停止');
  }

  /**
   * 记录性能事件
   */
  async recordEvent(event: Omit<PerformanceEvent, 'id' | 'endTime' | 'duration'>): Promise<string> {
    const eventId = `${event.type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const fullEvent: PerformanceEvent = {
      ...event,
      id: eventId,
      endTime: Date.now(),
      duration: Date.now() - event.startTime
    };

    // 添加到事件缓冲区
    this.eventBuffer.push(fullEvent);

    // 如果缓冲区太大，立即刷新
    if (this.eventBuffer.length > 100) {
      await this.flushEvents();
    }

    return eventId;
  }

  /**
   * 记录API请求性能
   */
  async recordApiRequest(
    method: string,
    path: string,
    startTime: number,
    success: boolean,
    error?: string
  ): Promise<string> {
    return this.recordEvent({
      type: 'api_request',
      startTime,
      success,
      metadata: {
        method,
        path,
        error
      }
    });
  }

  /**
   * 记录缓存操作性能
   */
  async recordCacheOperation(
    operation: 'get' | 'set' | 'del',
    cacheKey: string,
    startTime: number,
    hit: boolean
  ): Promise<string> {
    return this.recordEvent({
      type: 'cache_operation',
      startTime,
      success: true,
      metadata: {
        operationType: operation,
        cacheKey,
        hit
      }
    });
  }

  /**
   * 记录数据库查询性能
   */
  async recordDatabaseQuery(
    queryType: string,
    startTime: number,
    success: boolean,
    error?: string
  ): Promise<string> {
    return this.recordEvent({
      type: 'db_query',
      startTime,
      success,
      metadata: {
        queryType,
        error
      }
    });
  }

  /**
   * 启动指标收集
   */
  private startMetricsCollection(): void {
    this.metricsTimer = setInterval(async () => {
      if (this.isRunning) {
        await this.collectMetrics();
      }
    }, MONITOR_CONFIG.METRICS_COLLECTION_INTERVAL);

    console.log(`⏰ 指标收集器已启动 (间隔: ${MONITOR_CONFIG.METRICS_COLLECTION_INTERVAL}ms)`);
  }

  /**
   * 收集性能指标
   */
  private async collectMetrics(): Promise<void> {
    try {
      const timestamp = Date.now();
      
      // 并行收集各种指标
      const [apiMetrics, cacheMetrics, databaseMetrics, queueMetrics, systemMetrics] = await Promise.all([
        this.collectApiMetrics(),
        this.collectCacheMetrics(),
        this.collectDatabaseMetrics(),
        this.collectQueueMetrics(),
        this.collectSystemMetrics()
      ]);

      const metrics: PerformanceMetrics = {
        timestamp,
        apiMetrics,
        cacheMetrics,
        databaseMetrics,
        queueMetrics,
        systemMetrics
      };

      // 保存当前指标
      this.currentMetrics = metrics;

      // 存储到Redis
      await this.storeMetrics(metrics);

      console.log(`📊 性能指标已收集: API响应时间 ${apiMetrics.avgResponseTime}ms, 缓存命中率 ${(cacheMetrics.hitRate * 100).toFixed(1)}%`);

    } catch (error) {
      console.error('收集性能指标失败:', error);
    }
  }

  /**
   * 收集API性能指标
   */
  private async collectApiMetrics(): Promise<PerformanceMetrics['apiMetrics']> {
    try {
      // 从事件缓冲区和Redis中获取API请求数据
      const recentEvents = await this.getRecentEvents('api_request', 300); // 5分钟内
      
      if (recentEvents.length === 0) {
        return {
          totalRequests: 0,
          avgResponseTime: 0,
          p50ResponseTime: 0,
          p95ResponseTime: 0,
          p99ResponseTime: 0,
          errorRate: 0,
          throughput: 0
        };
      }

      // 计算响应时间分布
      const responseTimes = recentEvents.map(e => e.duration).sort((a, b) => a - b);
      const totalRequests = recentEvents.length;
      const errorCount = recentEvents.filter(e => !e.success).length;
      
      return {
        totalRequests,
        avgResponseTime: responseTimes.reduce((sum, time) => sum + time, 0) / totalRequests,
        p50ResponseTime: this.calculatePercentile(responseTimes, 50),
        p95ResponseTime: this.calculatePercentile(responseTimes, 95),
        p99ResponseTime: this.calculatePercentile(responseTimes, 99),
        errorRate: errorCount / totalRequests,
        throughput: totalRequests / 300 // 5分钟内的请求数 / 300秒
      };

    } catch (error) {
      console.error('收集API指标失败:', error);
      return {
        totalRequests: 0,
        avgResponseTime: 0,
        p50ResponseTime: 0,
        p95ResponseTime: 0,
        p99ResponseTime: 0,
        errorRate: 0,
        throughput: 0
      };
    }
  }

  /**
   * 收集缓存性能指标
   */
  private async collectCacheMetrics(): Promise<PerformanceMetrics['cacheMetrics']> {
    try {
      // 获取缓存统计
      const cacheStats = await cacheService.getCacheStats();
      
      // 从事件中获取缓存操作数据
      const cacheEvents = await this.getRecentEvents('cache_operation', 300);
      
      const totalOperations = cacheEvents.length;
      const hitCount = cacheEvents.filter(e => e.metadata.hit).length;
      const avgLookupTime = totalOperations > 0 
        ? cacheEvents.reduce((sum, e) => sum + e.duration, 0) / totalOperations 
        : 0;

      return {
        hitRate: totalOperations > 0 ? hitCount / totalOperations : 0,
        missRate: totalOperations > 0 ? (totalOperations - hitCount) / totalOperations : 0,
        totalOperations,
        avgLookupTime,
        memoryUsage: cacheStats.memoryUsage,
        keyCount: cacheStats.totalKeys,
        evictionRate: 0 // TODO: 实现从Redis获取驱逐率
      };

    } catch (error) {
      console.error('收集缓存指标失败:', error);
      return {
        hitRate: 0,
        missRate: 0,
        totalOperations: 0,
        avgLookupTime: 0,
        memoryUsage: 'N/A',
        keyCount: 0,
        evictionRate: 0
      };
    }
  }

  /**
   * 收集数据库性能指标
   */
  private async collectDatabaseMetrics(): Promise<PerformanceMetrics['databaseMetrics']> {
    try {
      // 从事件中获取数据库查询数据
      const dbEvents = await this.getRecentEvents('db_query', 300);
      
      const totalQueries = dbEvents.length;
      const avgQueryTime = totalQueries > 0 
        ? dbEvents.reduce((sum, e) => sum + e.duration, 0) / totalQueries 
        : 0;
      
      // 慢查询阈值 500ms
      const slowQueryCount = dbEvents.filter(e => e.duration > 500).length;
      
      // 从API事件中估算每请求查询数
      const apiEvents = await this.getRecentEvents('api_request', 300);
      const queriesPerRequest = apiEvents.length > 0 ? totalQueries / apiEvents.length : 0;

      return {
        avgQueryTime,
        queriesPerRequest,
        connectionPoolUsage: 0, // TODO: 从Prisma获取连接池使用率
        slowQueryCount,
        totalQueries
      };

    } catch (error) {
      console.error('收集数据库指标失败:', error);
      return {
        avgQueryTime: 0,
        queriesPerRequest: 0,
        connectionPoolUsage: 0,
        slowQueryCount: 0,
        totalQueries: 0
      };
    }
  }

  /**
   * 收集队列性能指标
   */
  private async collectQueueMetrics(): Promise<PerformanceMetrics['queueMetrics']> {
    try {
      const queueStats = await usageQueueProcessor.getQueueStats();
      
      return {
        bufferSize: queueStats.bufferSize,
        processingRate: queueStats.totalProcessed / 300, // 5分钟内的处理率
        avgProcessingTime: queueStats.avgProcessingTime,
        errorRate: queueStats.totalFailed / (queueStats.totalProcessed + queueStats.totalFailed + 1),
        backlog: queueStats.dlqSize
      };

    } catch (error) {
      console.error('收集队列指标失败:', error);
      return {
        bufferSize: 0,
        processingRate: 0,
        avgProcessingTime: 0,
        errorRate: 0,
        backlog: 0
      };
    }
  }

  /**
   * 收集系统资源指标
   */
  private async collectSystemMetrics(): Promise<PerformanceMetrics['systemMetrics']> {
    try {
      // 获取Node.js进程内存使用情况
      const memUsage = process.memoryUsage();
      const cpuUsage = process.cpuUsage();
      
      return {
        cpuUsage: 0, // TODO: 实现CPU使用率计算
        memoryUsage: memUsage.heapUsed / memUsage.heapTotal,
        diskUsage: 0, // TODO: 实现磁盘使用率获取
        networkIO: 0 // TODO: 实现网络IO统计
      };

    } catch (error) {
      console.error('收集系统指标失败:', error);
      return {
        cpuUsage: 0,
        memoryUsage: 0,
        diskUsage: 0,
        networkIO: 0
      };
    }
  }

  /**
   * 存储指标到Redis
   */
  private async storeMetrics(metrics: PerformanceMetrics): Promise<void> {
    try {
      const key = `${MONITOR_KEYS.METRICS}:${Math.floor(metrics.timestamp / 60000)}`; // 按分钟分组
      
      await cacheClient.setex(key, MONITOR_CONFIG.RETENTION_DAYS * 24 * 60 * 60, JSON.stringify(metrics));
      
      // 保存最新指标
      await cacheClient.setex(`${MONITOR_KEYS.METRICS}:latest`, 300, JSON.stringify(metrics));

    } catch (error) {
      console.error('存储指标失败:', error);
    }
  }

  /**
   * 刷新事件缓冲区
   */
  private async flushEvents(): Promise<void> {
    if (this.eventBuffer.length === 0) {
      return;
    }

    try {
      const events = [...this.eventBuffer];
      this.eventBuffer = [];

      // 将事件存储到Redis
      const pipeline = cacheClient.pipeline();
      
      events.forEach(event => {
        const key = `${MONITOR_KEYS.EVENTS}:${event.type}:${Math.floor(event.startTime / 60000)}`;
        pipeline.lpush(key, JSON.stringify(event));
        pipeline.expire(key, MONITOR_CONFIG.RETENTION_DAYS * 24 * 60 * 60);
      });

      await pipeline.exec();
      
      console.log(`📤 已刷新 ${events.length} 个性能事件`);

    } catch (error) {
      console.error('刷新事件失败:', error);
    }
  }

  /**
   * 获取最近的事件
   */
  private async getRecentEvents(type: string, windowSeconds: number): Promise<PerformanceEvent[]> {
    try {
      const now = Date.now();
      const windowStart = now - (windowSeconds * 1000);
      
      // 计算需要查询的时间键
      const keys: string[] = [];
      for (let time = windowStart; time <= now; time += 60000) { // 每分钟一个键
        keys.push(`${MONITOR_KEYS.EVENTS}:${type}:${Math.floor(time / 60000)}`);
      }

      // 并行查询所有键
      const pipeline = cacheClient.pipeline();
      keys.forEach(key => pipeline.lrange(key, 0, -1));
      
      const results = await pipeline.exec();
      
      // 解析和过滤事件
      const events: PerformanceEvent[] = [];
      
      if (results) {
        results.forEach(result => {
          if (result && result[0] === null) { // 成功的结果
            const eventStrings = result[1] as string[];
            eventStrings.forEach(eventStr => {
              try {
                const event = JSON.parse(eventStr) as PerformanceEvent;
                if (event.startTime >= windowStart) {
                  events.push(event);
                }
              } catch (error) {
                // 忽略解析错误
              }
            });
          }
        });
      }

      // 添加缓冲区中的事件
      this.eventBuffer
        .filter(e => e.type === type && e.startTime >= windowStart)
        .forEach(e => events.push(e));

      return events.sort((a, b) => a.startTime - b.startTime);

    } catch (error) {
      console.error(`获取最近事件失败 ${type}:`, error);
      return [];
    }
  }

  /**
   * 启动事件处理器
   */
  private startEventProcessor(): void {
    // 定期刷新事件缓冲区
    setInterval(async () => {
      if (this.isRunning) {
        await this.flushEvents();
      }
    }, 30000); // 30秒

    console.log('📨 事件处理器已启动');
  }

  /**
   * 启动告警检查器
   */
  private startAlertChecker(): void {
    setInterval(async () => {
      if (this.isRunning && this.currentMetrics) {
        await this.checkAlerts(this.currentMetrics);
      }
    }, 60000); // 1分钟检查一次

    console.log('🚨 告警检查器已启动');
  }

  /**
   * 检查告警条件
   */
  private async checkAlerts(metrics: PerformanceMetrics): Promise<void> {
    try {
      const alerts: string[] = [];

      // 检查响应时间告警
      if (metrics.apiMetrics.p95ResponseTime > MONITOR_CONFIG.ALERT_THRESHOLDS.RESPONSE_TIME_P95) {
        alerts.push(`API响应时间过高: P95=${metrics.apiMetrics.p95ResponseTime}ms (阈值: ${MONITOR_CONFIG.ALERT_THRESHOLDS.RESPONSE_TIME_P95}ms)`);
      }

      // 检查错误率告警
      if (metrics.apiMetrics.errorRate > MONITOR_CONFIG.ALERT_THRESHOLDS.ERROR_RATE) {
        alerts.push(`API错误率过高: ${(metrics.apiMetrics.errorRate * 100).toFixed(2)}% (阈值: ${(MONITOR_CONFIG.ALERT_THRESHOLDS.ERROR_RATE * 100).toFixed(2)}%)`);
      }

      // 检查缓存命中率告警
      if (metrics.cacheMetrics.hitRate < MONITOR_CONFIG.ALERT_THRESHOLDS.CACHE_HIT_RATE) {
        alerts.push(`缓存命中率过低: ${(metrics.cacheMetrics.hitRate * 100).toFixed(2)}% (阈值: ${(MONITOR_CONFIG.ALERT_THRESHOLDS.CACHE_HIT_RATE * 100).toFixed(2)}%)`);
      }

      // 检查队列积压告警
      if (metrics.queueMetrics.backlog > MONITOR_CONFIG.ALERT_THRESHOLDS.QUEUE_BACKLOG) {
        alerts.push(`队列积压过多: ${metrics.queueMetrics.backlog} (阈值: ${MONITOR_CONFIG.ALERT_THRESHOLDS.QUEUE_BACKLOG})`);
      }

      // 发送告警
      if (alerts.length > 0) {
        await this.sendAlerts(alerts);
      }

    } catch (error) {
      console.error('告警检查失败:', error);
    }
  }

  /**
   * 发送告警
   */
  private async sendAlerts(alerts: string[]): Promise<void> {
    try {
      console.log('🚨 性能告警:');
      alerts.forEach(alert => console.log(`  - ${alert}`));

      // 存储告警到Redis
      const alertRecord = {
        timestamp: Date.now(),
        alerts
      };

      await cacheClient.lpush(MONITOR_KEYS.ALERTS, JSON.stringify(alertRecord));
      await cacheClient.ltrim(MONITOR_KEYS.ALERTS, 0, 99); // 只保留最近100条告警

    } catch (error) {
      console.error('发送告警失败:', error);
    }
  }

  /**
   * 计算百分位数
   */
  private calculatePercentile(sortedArray: number[], percentile: number): number {
    if (sortedArray.length === 0) return 0;
    
    const index = (percentile / 100) * (sortedArray.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    
    if (lower === upper) {
      return sortedArray[lower];
    }
    
    const weight = index - lower;
    return sortedArray[lower] * (1 - weight) + sortedArray[upper] * weight;
  }

  /**
   * 获取当前性能指标
   */
  getCurrentMetrics(): PerformanceMetrics | null {
    return this.currentMetrics;
  }

  /**
   * 获取历史指标
   */
  async getHistoricalMetrics(startTime: number, endTime: number): Promise<PerformanceMetrics[]> {
    try {
      const keys: string[] = [];
      
      // 生成时间范围内的所有键
      for (let time = startTime; time <= endTime; time += 60000) {
        keys.push(`${MONITOR_KEYS.METRICS}:${Math.floor(time / 60000)}`);
      }

      // 批量获取指标
      const pipeline = cacheClient.pipeline();
      keys.forEach(key => pipeline.get(key));
      
      const results = await pipeline.exec();
      const metrics: PerformanceMetrics[] = [];

      if (results) {
        results.forEach(result => {
          if (result && result[0] === null && result[1]) {
            try {
              const metric = JSON.parse(result[1] as string) as PerformanceMetrics;
              if (metric.timestamp >= startTime && metric.timestamp <= endTime) {
                metrics.push(metric);
              }
            } catch (error) {
              // 忽略解析错误
            }
          }
        });
      }

      return metrics.sort((a, b) => a.timestamp - b.timestamp);

    } catch (error) {
      console.error('获取历史指标失败:', error);
      return [];
    }
  }

  /**
   * 获取告警历史
   */
  async getAlertHistory(limit: number = 50): Promise<Array<{ timestamp: number; alerts: string[] }>> {
    try {
      const alerts = await cacheClient.lrange(MONITOR_KEYS.ALERTS, 0, limit - 1);
      
      return alerts.map(alert => {
        try {
          return JSON.parse(alert);
        } catch (error) {
          return { timestamp: 0, alerts: [] };
        }
      }).filter(alert => alert.timestamp > 0);

    } catch (error) {
      console.error('获取告警历史失败:', error);
      return [];
    }
  }
}

// 导出单例实例
export const performanceMonitor = PerformanceMonitor.getInstance();
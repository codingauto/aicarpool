/**
 * 后台作业调度系统
 * v2.7 高并发优化 - 定期维护任务，确保系统长期稳定运行
 */

import { cacheService } from '../cache/cache-service';
import { usageQueueProcessor } from '../queue/usage-queue-processor';
import { accountPoolManager } from '../services/account-pool-manager';
import { performanceMonitor } from '../monitoring/performance-monitor';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// 作业调度配置
const JOB_CONFIG = {
  // 健康检查作业 - 每5分钟
  HEALTH_CHECK_INTERVAL: parseInt(process.env.HEALTH_CHECK_INTERVAL || '300000'),
  
  // 缓存清理作业 - 每小时
  CACHE_CLEANUP_INTERVAL: parseInt(process.env.CACHE_CLEANUP_INTERVAL || '3600000'),
  
  // 账号池刷新作业 - 每2分钟
  ACCOUNT_POOL_REFRESH_INTERVAL: parseInt(process.env.ACCOUNT_POOL_REFRESH_INTERVAL || '120000'),
  
  // 统计数据清理作业 - 每天凌晨2点
  STATS_CLEANUP_CRON: process.env.STATS_CLEANUP_CRON || '0 2 * * *',
  
  // 性能报告生成作业 - 每小时
  PERFORMANCE_REPORT_INTERVAL: parseInt(process.env.PERFORMANCE_REPORT_INTERVAL || '3600000'),
  
  // 死信队列处理作业 - 每30分钟
  DLQ_PROCESSING_INTERVAL: parseInt(process.env.DLQ_PROCESSING_INTERVAL || '1800000'),
  
  // 数据库维护作业 - 每天凌晨3点
  DB_MAINTENANCE_CRON: process.env.DB_MAINTENANCE_CRON || '0 3 * * *',
  
  // 作业并发控制
  MAX_CONCURRENT_JOBS: parseInt(process.env.MAX_CONCURRENT_JOBS || '3'),
  
  // 作业超时设置
  JOB_TIMEOUT: parseInt(process.env.JOB_TIMEOUT || '300000'), // 5分钟
} as const;

// 作业状态接口
export interface JobStatus {
  name: string;
  status: 'idle' | 'running' | 'completed' | 'failed';
  lastRun: number;
  nextRun: number;
  duration: number;
  error?: string;
  runCount: number;
  failCount: number;
}

// 作业执行结果接口
export interface JobResult {
  success: boolean;
  duration: number;
  message: string;
  error?: string;
  data?: any;
}

/**
 * 后台作业调度器
 */
export class BackgroundJobsScheduler {
  private static instance: BackgroundJobsScheduler;
  private isRunning = false;
  private jobTimers: Map<string, NodeJS.Timeout> = new Map();
  private runningJobs: Set<string> = new Set();
  private jobStatuses: Map<string, JobStatus> = new Map();

  private constructor() {}

  public static getInstance(): BackgroundJobsScheduler {
    if (!BackgroundJobsScheduler.instance) {
      BackgroundJobsScheduler.instance = new BackgroundJobsScheduler();
    }
    return BackgroundJobsScheduler.instance;
  }

  /**
   * 启动后台作业调度器
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('⚠️ 后台作业调度器已在运行');
      return;
    }

    console.log('🚀 启动后台作业调度器...');
    this.isRunning = true;

    try {
      // 初始化作业状态
      this.initializeJobStatuses();

      // 启动各种定期作业
      this.scheduleHealthCheckJob();
      this.scheduleCacheCleanupJob();
      this.scheduleAccountPoolRefreshJob();
      this.schedulePerformanceReportJob();
      this.scheduleDLQProcessingJob();
      
      // 启动基于Cron的作业
      this.scheduleStatsCleanupJob();
      this.scheduleDbMaintenanceJob();

      console.log('✅ 后台作业调度器启动完成');

    } catch (error) {
      console.error('❌ 后台作业调度器启动失败:', error);
      this.isRunning = false;
      throw error;
    }
  }

  /**
   * 停止后台作业调度器
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    console.log('📴 停止后台作业调度器...');
    this.isRunning = false;

    // 清理所有定时器
    this.jobTimers.forEach(timer => clearInterval(timer));
    this.jobTimers.clear();

    // 等待正在运行的作业完成
    if (this.runningJobs.size > 0) {
      console.log(`⏳ 等待 ${this.runningJobs.size} 个作业完成...`);
      
      let waitTime = 0;
      const maxWaitTime = 30000; // 最多等待30秒
      
      while (this.runningJobs.size > 0 && waitTime < maxWaitTime) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        waitTime += 1000;
      }
      
      if (this.runningJobs.size > 0) {
        console.log(`⚠️ 强制停止 ${this.runningJobs.size} 个未完成的作业`);
      }
    }

    console.log('✅ 后台作业调度器已停止');
  }

  /**
   * 初始化作业状态
   */
  private initializeJobStatuses(): void {
    const jobs = [
      'health-check',
      'cache-cleanup', 
      'account-pool-refresh',
      'performance-report',
      'dlq-processing',
      'stats-cleanup',
      'db-maintenance'
    ];

    jobs.forEach(jobName => {
      this.jobStatuses.set(jobName, {
        name: jobName,
        status: 'idle',
        lastRun: 0,
        nextRun: 0,
        duration: 0,
        runCount: 0,
        failCount: 0
      });
    });
  }

  /**
   * 执行作业的通用包装器
   */
  private async executeJob(
    jobName: string,
    jobFunction: () => Promise<JobResult>
  ): Promise<void> {
    // 检查并发控制
    if (this.runningJobs.size >= JOB_CONFIG.MAX_CONCURRENT_JOBS) {
      console.log(`⏸️ 作业 ${jobName} 因并发限制而延迟执行`);
      return;
    }

    // 检查作业是否已在运行
    if (this.runningJobs.has(jobName)) {
      console.log(`⏸️ 作业 ${jobName} 已在运行，跳过此次执行`);
      return;
    }

    const startTime = Date.now();
    this.runningJobs.add(jobName);
    
    const status = this.jobStatuses.get(jobName);
    if (status) {
      status.status = 'running';
      status.runCount++;
    }

    try {
      console.log(`🔧 开始执行作业: ${jobName}`);

      // 设置作业超时
      const timeoutPromise = new Promise<JobResult>((_, reject) => {
        setTimeout(() => reject(new Error('作业执行超时')), JOB_CONFIG.JOB_TIMEOUT);
      });

      // 执行作业
      const result = await Promise.race([jobFunction(), timeoutPromise]);
      
      const duration = Date.now() - startTime;
      
      if (result.success) {
        console.log(`✅ 作业完成: ${jobName} (${duration}ms) - ${result.message}`);
        
        if (status) {
          status.status = 'completed';
          status.lastRun = startTime;
          status.duration = duration;
          delete status.error;
        }
      } else {
        console.error(`❌ 作业失败: ${jobName} (${duration}ms) - ${result.message}`);
        
        if (status) {
          status.status = 'failed';
          status.lastRun = startTime;
          status.duration = duration;
          status.error = result.error || result.message;
          status.failCount++;
        }
      }

    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      console.error(`💥 作业异常: ${jobName} (${duration}ms) - ${errorMessage}`);
      
      if (status) {
        status.status = 'failed';
        status.lastRun = startTime;
        status.duration = duration;
        status.error = errorMessage;
        status.failCount++;
      }

    } finally {
      this.runningJobs.delete(jobName);
      
      if (status) {
        status.status = 'idle';
      }
    }
  }

  /**
   * 健康检查作业
   */
  private scheduleHealthCheckJob(): void {
    const jobName = 'health-check';
    
    const timer = setInterval(async () => {
      if (this.isRunning) {
        await this.executeJob(jobName, async () => {
          try {
            // 执行各种健康检查
            const results = await Promise.allSettled([
              accountPoolManager.triggerHealthCheck(),
              this.checkCacheHealth(),
              this.checkDatabaseHealth(),
              this.checkQueueHealth()
            ]);

            const failedChecks = results.filter(r => r.status === 'rejected').length;
            const totalChecks = results.length;

            return {
              success: failedChecks === 0,
              duration: 0,
              message: `健康检查完成: ${totalChecks - failedChecks}/${totalChecks} 项正常`,
              data: {
                totalChecks,
                failedChecks,
                successRate: (totalChecks - failedChecks) / totalChecks
              }
            };

          } catch (error) {
            return {
              success: false,
              duration: 0,
              message: '健康检查执行失败',
              error: error instanceof Error ? error.message : String(error)
            };
          }
        });
      }
    }, JOB_CONFIG.HEALTH_CHECK_INTERVAL);

    this.jobTimers.set(jobName, timer);
    console.log(`⏰ 健康检查作业已调度 (间隔: ${JOB_CONFIG.HEALTH_CHECK_INTERVAL}ms)`);
  }

  /**
   * 缓存清理作业
   */
  private scheduleCacheCleanupJob(): void {
    const jobName = 'cache-cleanup';
    
    const timer = setInterval(async () => {
      if (this.isRunning) {
        await this.executeJob(jobName, async () => {
          try {
            const result = await cacheService.cleanupCache();
            
            return {
              success: true,
              duration: 0,
              message: `缓存清理完成: 清理了 ${result.cleaned} 个过期缓存`,
              data: {
                cleaned: result.cleaned,
                errors: result.errors.length
              }
            };

          } catch (error) {
            return {
              success: false,
              duration: 0,
              message: '缓存清理失败',
              error: error instanceof Error ? error.message : String(error)
            };
          }
        });
      }
    }, JOB_CONFIG.CACHE_CLEANUP_INTERVAL);

    this.jobTimers.set(jobName, timer);
    console.log(`⏰ 缓存清理作业已调度 (间隔: ${JOB_CONFIG.CACHE_CLEANUP_INTERVAL}ms)`);
  }

  /**
   * 账号池刷新作业
   */
  private scheduleAccountPoolRefreshJob(): void {
    const jobName = 'account-pool-refresh';
    
    const timer = setInterval(async () => {
      if (this.isRunning) {
        await this.executeJob(jobName, async () => {
          try {
            // 刷新所有服务类型的账号池
            const serviceTypes = ['claude', 'openai', 'gemini', 'qwen'];
            
            const refreshPromises = serviceTypes.map(async (serviceType) => {
              try {
                await accountPoolManager.triggerHealthCheck(serviceType);
                return { serviceType, success: true };
              } catch (error) {
                return { 
                  serviceType, 
                  success: false, 
                  error: error instanceof Error ? error.message : String(error) 
                };
              }
            });

            const results = await Promise.allSettled(refreshPromises);
            const successful = results.filter(r => 
              r.status === 'fulfilled' && r.value.success
            ).length;

            return {
              success: successful > 0,
              duration: 0,
              message: `账号池刷新完成: ${successful}/${serviceTypes.length} 个服务类型成功`,
              data: {
                totalServices: serviceTypes.length,
                successfulServices: successful
              }
            };

          } catch (error) {
            return {
              success: false,
              duration: 0,
              message: '账号池刷新失败',
              error: error instanceof Error ? error.message : String(error)
            };
          }
        });
      }
    }, JOB_CONFIG.ACCOUNT_POOL_REFRESH_INTERVAL);

    this.jobTimers.set(jobName, timer);
    console.log(`⏰ 账号池刷新作业已调度 (间隔: ${JOB_CONFIG.ACCOUNT_POOL_REFRESH_INTERVAL}ms)`);
  }

  /**
   * 性能报告生成作业
   */
  private schedulePerformanceReportJob(): void {
    const jobName = 'performance-report';
    
    const timer = setInterval(async () => {
      if (this.isRunning) {
        await this.executeJob(jobName, async () => {
          try {
            const metrics = performanceMonitor.getCurrentMetrics();
            
            if (!metrics) {
              return {
                success: false,
                duration: 0,
                message: '没有可用的性能指标'
              };
            }

            // 生成简单的性能报告
            const report = {
              timestamp: metrics.timestamp,
              summary: {
                avgResponseTime: metrics.apiMetrics.avgResponseTime,
                p95ResponseTime: metrics.apiMetrics.p95ResponseTime,
                errorRate: metrics.apiMetrics.errorRate,
                cacheHitRate: metrics.cacheMetrics.hitRate,
                queueBacklog: metrics.queueMetrics.backlog
              }
            };

            // 这里可以将报告发送到外部系统或存储
            console.log('📊 性能报告:', report.summary);

            return {
              success: true,
              duration: 0,
              message: '性能报告生成完成',
              data: report
            };

          } catch (error) {
            return {
              success: false,
              duration: 0,
              message: '性能报告生成失败',
              error: error instanceof Error ? error.message : String(error)
            };
          }
        });
      }
    }, JOB_CONFIG.PERFORMANCE_REPORT_INTERVAL);

    this.jobTimers.set(jobName, timer);
    console.log(`⏰ 性能报告作业已调度 (间隔: ${JOB_CONFIG.PERFORMANCE_REPORT_INTERVAL}ms)`);
  }

  /**
   * 死信队列处理作业
   */
  private scheduleDLQProcessingJob(): void {
    const jobName = 'dlq-processing';
    
    const timer = setInterval(async () => {
      if (this.isRunning) {
        await this.executeJob(jobName, async () => {
          try {
            const result = await usageQueueProcessor.processDLQ();
            
            return {
              success: true,
              duration: 0,
              message: `死信队列处理完成: 成功 ${result.processed} 条，失败 ${result.failed} 条`,
              data: {
                processed: result.processed,
                failed: result.failed
              }
            };

          } catch (error) {
            return {
              success: false,
              duration: 0, 
              message: '死信队列处理失败',
              error: error instanceof Error ? error.message : String(error)
            };
          }
        });
      }
    }, JOB_CONFIG.DLQ_PROCESSING_INTERVAL);

    this.jobTimers.set(jobName, timer);
    console.log(`⏰ 死信队列处理作业已调度 (间隔: ${JOB_CONFIG.DLQ_PROCESSING_INTERVAL}ms)`);
  }

  /**
   * 统计数据清理作业（基于Cron）
   */
  private scheduleStatsCleanupJob(): void {
    const jobName = 'stats-cleanup';
    
    // 简化实现：每天凌晨2点执行
    const timer = setInterval(async () => {
      const now = new Date();
      if (now.getHours() === 2 && now.getMinutes() === 0 && this.isRunning) {
        await this.executeJob(jobName, async () => {
          try {
            // 清理30天前的使用统计数据
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - 30);

            const deletedCount = await prisma.usageStat.deleteMany({
              where: {
                requestTime: {
                  lt: cutoffDate
                }
              }
            });

            // 清理30天前的健康检查记录
            const deletedHealthChecks = await prisma.accountHealthCheck.deleteMany({
              where: {
                checkedAt: {
                  lt: cutoffDate
                }
              }
            });

            return {
              success: true,
              duration: 0,
              message: `统计数据清理完成: 使用统计 ${deletedCount.count} 条，健康检查 ${deletedHealthChecks.count} 条`,
              data: {
                usageStatsDeleted: deletedCount.count,
                healthChecksDeleted: deletedHealthChecks.count
              }
            };

          } catch (error) {
            return {
              success: false,
              duration: 0,
              message: '统计数据清理失败',
              error: error instanceof Error ? error.message : String(error)
            };
          }
        });
      }
    }, 60000); // 每分钟检查一次

    this.jobTimers.set(jobName, timer);
    console.log(`⏰ 统计数据清理作业已调度 (每天凌晨2点)`);
  }

  /**
   * 数据库维护作业（基于Cron）
   */
  private scheduleDbMaintenanceJob(): void {
    const jobName = 'db-maintenance';
    
    // 简化实现：每天凌晨3点执行
    const timer = setInterval(async () => {
      const now = new Date();
      if (now.getHours() === 3 && now.getMinutes() === 0 && this.isRunning) {
        await this.executeJob(jobName, async () => {
          try {
            // 更新表统计信息
            const tables = ['api_keys', 'usage_stats', 'ai_service_accounts', 'group_members'];
            
            for (const table of tables) {
              await prisma.$executeRawUnsafe(`ANALYZE ${table}`);
            }

            // 清理连接池
            await prisma.$disconnect();
            
            return {
              success: true,
              duration: 0,
              message: `数据库维护完成: 更新了 ${tables.length} 个表的统计信息`,
              data: {
                tablesAnalyzed: tables.length
              }
            };

          } catch (error) {
            return {
              success: false,
              duration: 0,
              message: '数据库维护失败',
              error: error instanceof Error ? error.message : String(error)
            };
          }
        });
      }
    }, 60000); // 每分钟检查一次

    this.jobTimers.set(jobName, timer);
    console.log(`⏰ 数据库维护作业已调度 (每天凌晨3点)`);
  }

  /**
   * 检查缓存健康状态
   */
  private async checkCacheHealth(): Promise<void> {
    const stats = await cacheService.getCacheStats();
    
    if (stats.totalKeys === 0) {
      throw new Error('缓存中没有任何键');
    }
    
    // 可以添加更多健康检查逻辑
  }

  /**
   * 检查数据库健康状态
   */
  private async checkDatabaseHealth(): Promise<void> {
    // 执行简单的数据库查询
    const result = await prisma.$queryRaw`SELECT 1 as health_check`;
    
    if (!result) {
      throw new Error('数据库连接检查失败');
    }
  }

  /**
   * 检查队列健康状态
   */
  private async checkQueueHealth(): Promise<void> {
    const stats = await usageQueueProcessor.getQueueStats();
    
    if (stats.dlqSize > 100) {
      throw new Error(`死信队列积压过多: ${stats.dlqSize} 条`);
    }
  }

  /**
   * 手动执行作业
   */
  async runJobManually(jobName: string): Promise<JobResult> {
    if (!this.jobStatuses.has(jobName)) {
      return {
        success: false,
        duration: 0,
        message: `未知的作业名称: ${jobName}`
      };
    }

    console.log(`🔧 手动执行作业: ${jobName}`);

    const jobFunctions: { [key: string]: () => Promise<JobResult> } = {
      'health-check': async () => {
        await accountPoolManager.triggerHealthCheck();
        return { success: true, duration: 0, message: '健康检查完成' };
      },
      'cache-cleanup': async () => {
        const result = await cacheService.cleanupCache();
        return { 
          success: true, 
          duration: 0, 
          message: `缓存清理完成: ${result.cleaned} 个`,
          data: result
        };
      },
      'account-pool-refresh': async () => {
        await accountPoolManager.triggerHealthCheck();
        return { success: true, duration: 0, message: '账号池刷新完成' };
      },
      'dlq-processing': async () => {
        const result = await usageQueueProcessor.processDLQ();
        return { 
          success: true, 
          duration: 0, 
          message: `DLQ处理完成: ${result.processed}/${result.failed}`,
          data: result
        };
      }
    };

    const jobFunction = jobFunctions[jobName];
    if (!jobFunction) {
      return {
        success: false,
        duration: 0,
        message: `作业 ${jobName} 不支持手动执行`
      };
    }

    try {
      const result = await jobFunction();
      console.log(`✅ 手动作业完成: ${jobName} - ${result.message}`);
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`❌ 手动作业失败: ${jobName} - ${errorMessage}`);
      return {
        success: false,
        duration: 0,
        message: '手动作业执行失败',
        error: errorMessage
      };
    }
  }

  /**
   * 获取所有作业状态
   */
  getJobStatuses(): JobStatus[] {
    return Array.from(this.jobStatuses.values());
  }

  /**
   * 获取特定作业状态
   */
  getJobStatus(jobName: string): JobStatus | null {
    return this.jobStatuses.get(jobName) || null;
  }

  /**
   * 获取调度器统计信息
   */
  getSchedulerStats(): {
    isRunning: boolean;
    totalJobs: number;
    runningJobs: number;
    scheduledJobs: number;
    totalRuns: number;
    totalFailures: number;
  } {
    const statuses = Array.from(this.jobStatuses.values());
    
    return {
      isRunning: this.isRunning,
      totalJobs: statuses.length,
      runningJobs: this.runningJobs.size,
      scheduledJobs: this.jobTimers.size,
      totalRuns: statuses.reduce((sum, status) => sum + status.runCount, 0),
      totalFailures: statuses.reduce((sum, status) => sum + status.failCount, 0)
    };
  }
}

// 导出单例实例
export const backgroundJobsScheduler = BackgroundJobsScheduler.getInstance();
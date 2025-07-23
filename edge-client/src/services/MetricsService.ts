/**
 * 指标收集和存储服务
 */
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs/promises';
import { UsageStats, ServiceHealthStats } from '@/types/index.js';
import { EdgeClient } from '@/core/EdgeClient.js';

interface UsageRecord {
  id?: number;
  group_id: string;
  service_name: string;
  model_name: string;
  user_api_key_hash?: string;
  stats_date: string;
  stats_hour?: number;
  request_count: number;
  success_count: number;
  error_count: number;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  total_response_time_ms: number;
  max_response_time_ms: number;
  timeout_errors: number;
  rate_limit_errors: number;
  auth_errors: number;
  other_errors: number;
  estimated_cost: number;
  created_at: string;
  updated_at: string;
}

// interface HealthRecord {
//   id?: number;
//   service_name: string;
//   check_time: string;
//   status: string;
//   response_time_ms?: number;
//   error_message?: string;
//   consecutive_successes: number;
//   consecutive_failures: number;
//   avg_response_time_ms?: number;
//   success_rate?: number;
// }

export class MetricsService {
  private _edgeClient: EdgeClient;
  private db: Database.Database | null = null;
  private dbPath: string;
  private isInitialized: boolean = false;

  constructor(edgeClient: EdgeClient) {
    this._edgeClient = edgeClient;
    this.dbPath = path.join(process.cwd(), 'data', 'metrics.db');
  }

  /**
   * 初始化指标服务
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    console.log(`初始化指标服务... (节点ID: ${this._edgeClient.nodeId || 'unknown'})`);
    
    // 确保数据目录存在
    const dataDir = path.dirname(this.dbPath);
    await fs.mkdir(dataDir, { recursive: true });

    // 初始化SQLite数据库
    this.db = new Database(this.dbPath);
    this.db.pragma('journal_mode = WAL'); // 使用WAL模式提高并发性能
    this.db.pragma('foreign_keys = ON');

    // 创建表结构
    await this.createTables();

    // 启动定期清理任务
    this.startCleanupTask();

    this.isInitialized = true;
    console.log('指标服务初始化完成');
  }

  /**
   * 创建数据库表
   */
  private async createTables(): Promise<void> {
    if (!this.db) throw new Error('数据库未初始化');

    // 创建使用统计表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS edge_usage_stats (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        group_id TEXT NOT NULL,
        service_name TEXT NOT NULL,
        model_name TEXT,
        user_api_key_hash TEXT,
        stats_date TEXT NOT NULL,
        stats_hour INTEGER,
        request_count INTEGER DEFAULT 0,
        success_count INTEGER DEFAULT 0,
        error_count INTEGER DEFAULT 0,
        input_tokens INTEGER DEFAULT 0,
        output_tokens INTEGER DEFAULT 0,
        total_tokens INTEGER DEFAULT 0,
        total_response_time_ms INTEGER DEFAULT 0,
        max_response_time_ms INTEGER DEFAULT 0,
        timeout_errors INTEGER DEFAULT 0,
        rate_limit_errors INTEGER DEFAULT 0,
        auth_errors INTEGER DEFAULT 0,
        other_errors INTEGER DEFAULT 0,
        estimated_cost REAL DEFAULT 0.0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 创建服务健康监控表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS edge_service_health (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        service_name TEXT NOT NULL,
        check_time TEXT DEFAULT CURRENT_TIMESTAMP,
        status TEXT NOT NULL,
        response_time_ms INTEGER,
        error_message TEXT,
        consecutive_successes INTEGER DEFAULT 0,
        consecutive_failures INTEGER DEFAULT 0,
        avg_response_time_ms INTEGER,
        success_rate REAL
      )
    `);

    // 创建配置缓存表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS edge_config_cache (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        config_type TEXT NOT NULL,
        config_key TEXT NOT NULL,
        config_data TEXT NOT NULL,
        config_version INTEGER DEFAULT 1,
        expires_at TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(config_type, config_key)
      )
    `);

    // 创建日志表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS edge_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        log_level TEXT NOT NULL,
        log_category TEXT,
        message TEXT NOT NULL,
        context TEXT,
        timestamp TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 创建索引
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_stats_date ON edge_usage_stats(stats_date);
      CREATE INDEX IF NOT EXISTS idx_group_date ON edge_usage_stats(group_id, stats_date);
      CREATE INDEX IF NOT EXISTS idx_service_date ON edge_usage_stats(service_name, stats_date);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_stats_dimension 
        ON edge_usage_stats(group_id, service_name, stats_date, stats_hour, user_api_key_hash, model_name);
      
      CREATE INDEX IF NOT EXISTS idx_service_check_time ON edge_service_health(service_name, check_time);
      CREATE INDEX IF NOT EXISTS idx_config_key ON edge_config_cache(config_type, config_key);
      CREATE INDEX IF NOT EXISTS idx_expires ON edge_config_cache(expires_at);
      CREATE INDEX IF NOT EXISTS idx_log_level_time ON edge_logs(log_level, timestamp);
      CREATE INDEX IF NOT EXISTS idx_category_time ON edge_logs(log_category, timestamp);
    `);

    console.log('数据库表创建完成');
  }

  /**
   * 记录API使用统计
   */
  async recordApiUsage(usage: UsageStats): Promise<void> {
    if (!this.db) throw new Error('数据库未初始化');

    const now = new Date();
    const statsDate = now.toISOString().split('T')[0]; // YYYY-MM-DD
    const statsHour = now.getHours();

    try {
      // 使用upsert模式更新或插入统计数据
      const stmt = this.db.prepare(`
        INSERT INTO edge_usage_stats (
          group_id, service_name, model_name, user_api_key_hash,
          stats_date, stats_hour, request_count, success_count, error_count,
          input_tokens, output_tokens, total_tokens, total_response_time_ms,
          max_response_time_ms, timeout_errors, rate_limit_errors, auth_errors,
          other_errors, estimated_cost, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(group_id, service_name, stats_date, stats_hour, user_api_key_hash, model_name)
        DO UPDATE SET
          request_count = request_count + ?,
          success_count = success_count + ?,
          error_count = error_count + ?,
          input_tokens = input_tokens + ?,
          output_tokens = output_tokens + ?,
          total_tokens = total_tokens + ?,
          total_response_time_ms = total_response_time_ms + ?,
          max_response_time_ms = MAX(max_response_time_ms, ?),
          timeout_errors = timeout_errors + ?,
          rate_limit_errors = rate_limit_errors + ?,
          auth_errors = auth_errors + ?,
          other_errors = other_errors + ?,
          estimated_cost = estimated_cost + ?,
          updated_at = CURRENT_TIMESTAMP
      `);

      const errorCounts = this.categorizeError(usage.errorType);
      
      stmt.run(
        usage.groupId || 'default',
        usage.service,
        usage.model,
        usage.userApiKeyHash,
        statsDate,
        statsHour,
        1, // request_count
        usage.success ? 1 : 0, // success_count  
        usage.success ? 0 : 1, // error_count
        usage.inputTokens || 0,
        usage.outputTokens || 0,
        usage.totalTokens || 0,
        usage.responseTime,
        usage.responseTime,
        errorCounts.timeout,
        errorCounts.rateLimit,
        errorCounts.auth,
        errorCounts.other,
        usage.estimatedCost || 0,
        // 重复参数用于ON CONFLICT UPDATE
        1,
        usage.success ? 1 : 0,
        usage.success ? 0 : 1,
        usage.inputTokens || 0,
        usage.outputTokens || 0,
        usage.totalTokens || 0,
        usage.responseTime,
        usage.responseTime,
        errorCounts.timeout,
        errorCounts.rateLimit,
        errorCounts.auth,
        errorCounts.other,
        usage.estimatedCost || 0
      );

    } catch (error) {
      console.error('记录API使用统计失败:', error);
    }
  }

  /**
   * 记录服务健康状态
   */
  async recordServiceHealth(health: ServiceHealthStats): Promise<void> {
    if (!this.db) throw new Error('数据库未初始化');

    try {
      const stmt = this.db.prepare(`
        INSERT INTO edge_service_health (
          service_name, status, response_time_ms, error_message,
          consecutive_successes, consecutive_failures, avg_response_time_ms, success_rate
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        health.serviceName,
        health.status,
        health.responseTime,
        health.errorMessage,
        health.consecutiveSuccesses || 0,
        health.consecutiveFailures || 0,
        health.avgResponseTime,
        health.successRate
      );

    } catch (error) {
      console.error('记录服务健康状态失败:', error);
    }
  }

  /**
   * 获取使用统计（用于上报到中央服务器）
   */
  async getUsageStats(options: {
    startDate?: string;
    endDate?: string;
    groupId?: string;
    serviceName?: string;
    granularity?: 'hour' | 'day';
  } = {}): Promise<UsageRecord[]> {
    if (!this.db) throw new Error('数据库未初始化');

    let query = 'SELECT * FROM edge_usage_stats WHERE 1=1';
    const params: any[] = [];

    if (options.startDate) {
      query += ' AND stats_date >= ?';
      params.push(options.startDate);
    }

    if (options.endDate) {
      query += ' AND stats_date <= ?';
      params.push(options.endDate);
    }

    if (options.groupId) {
      query += ' AND group_id = ?';
      params.push(options.groupId);
    }

    if (options.serviceName) {
      query += ' AND service_name = ?';
      params.push(options.serviceName);
    }

    if (options.granularity === 'day') {
      query += ' AND stats_hour IS NULL';
    }

    query += ' ORDER BY stats_date DESC, stats_hour DESC LIMIT 1000';

    const stmt = this.db.prepare(query);
    return stmt.all(...params) as UsageRecord[];
  }

  /**
   * 获取聚合统计数据
   */
  async getAggregatedStats(options: {
    startDate?: string;
    endDate?: string;
    groupBy?: 'service' | 'model' | 'date';
  } = {}): Promise<any[]> {
    if (!this.db) throw new Error('数据库未初始化');

    let groupByClause = '';
    let selectClause = `
      SUM(request_count) as total_requests,
      SUM(success_count) as total_successes,
      SUM(error_count) as total_errors,
      SUM(input_tokens) as total_input_tokens,
      SUM(output_tokens) as total_output_tokens,
      SUM(total_tokens) as total_tokens,
      AVG(total_response_time_ms / request_count) as avg_response_time,
      SUM(estimated_cost) as total_cost
    `;

    switch (options.groupBy) {
      case 'service':
        selectClause = `service_name, ${selectClause}`;
        groupByClause = 'GROUP BY service_name';
        break;
      case 'model':
        selectClause = `service_name, model_name, ${selectClause}`;
        groupByClause = 'GROUP BY service_name, model_name';
        break;
      case 'date':
        selectClause = `stats_date, ${selectClause}`;
        groupByClause = 'GROUP BY stats_date';
        break;
    }

    let query = `SELECT ${selectClause} FROM edge_usage_stats WHERE 1=1`;
    const params: any[] = [];

    if (options.startDate) {
      query += ' AND stats_date >= ?';
      params.push(options.startDate);
    }

    if (options.endDate) {
      query += ' AND stats_date <= ?';
      params.push(options.endDate);
    }

    if (groupByClause) {
      query += ` ${groupByClause}`;
    }

    query += ' ORDER BY total_requests DESC';

    const stmt = this.db.prepare(query);
    return stmt.all(...params);
  }

  /**
   * 写入日志
   */
  async writeLog(level: string, category: string, message: string, context?: any): Promise<void> {
    if (!this.db) return;

    try {
      const stmt = this.db.prepare(`
        INSERT INTO edge_logs (log_level, log_category, message, context)
        VALUES (?, ?, ?, ?)
      `);

      stmt.run(level, category, message, context ? JSON.stringify(context) : null);
    } catch (error) {
      console.error('写入日志失败:', error);
    }
  }

  /**
   * 启动清理任务
   */
  private startCleanupTask(): void {
    // 每天清理一次过期数据
    setInterval(async () => {
      await this.cleanupExpiredData();
    }, 24 * 60 * 60 * 1000); // 24小时

    // 启动后立即执行一次清理
    setTimeout(() => {
      this.cleanupExpiredData();
    }, 5000);
  }

  /**
   * 清理过期数据
   */
  private async cleanupExpiredData(): Promise<void> {
    if (!this.db) return;

    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const cutoffDate = thirtyDaysAgo.toISOString().split('T')[0];

      // 清理30天前的日志
      this.db.prepare('DELETE FROM edge_logs WHERE DATE(timestamp) < ?').run(cutoffDate);

      // 清理30天前的健康检查记录
      this.db.prepare('DELETE FROM edge_service_health WHERE DATE(check_time) < ?').run(cutoffDate);

      // 清理过期的配置缓存
      this.db.prepare('DELETE FROM edge_config_cache WHERE expires_at < CURRENT_TIMESTAMP').run();

      console.log('数据清理完成');
    } catch (error) {
      console.error('数据清理失败:', error);
    }
  }

  /**
   * 分类错误类型
   */
  private categorizeError(errorType?: string): {
    timeout: number;
    rateLimit: number;
    auth: number;
    other: number;
  } {
    const counts = { timeout: 0, rateLimit: 0, auth: 0, other: 0 };
    
    if (!errorType) return counts;

    switch (errorType) {
      case 'timeout':
        counts.timeout = 1;
        break;
      case 'rate_limit':
        counts.rateLimit = 1;
        break;
      case 'auth_error':
        counts.auth = 1;
        break;
      default:
        counts.other = 1;
    }

    return counts;
  }

  /**
   * 获取数据库统计信息
   */
  async getDatabaseStats(): Promise<{
    size: number;
    tables: Array<{ name: string; rows: number }>;
  }> {
    if (!this.db) throw new Error('数据库未初始化');

    try {
      // 获取数据库文件大小
      const stats = await fs.stat(this.dbPath);
      const size = stats.size;

      // 获取各表行数
      const tables = [];
      const tableNames = ['edge_usage_stats', 'edge_service_health', 'edge_config_cache', 'edge_logs'];
      
      for (const tableName of tableNames) {
        const result = this.db.prepare(`SELECT COUNT(*) as count FROM ${tableName}`).get() as { count: number };
        tables.push({ name: tableName, rows: result.count });
      }

      return { size, tables };
    } catch (error) {
      console.error('获取数据库统计失败:', error);
      return { size: 0, tables: [] };
    }
  }

  /**
   * 关闭数据库连接
   */
  async close(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.db = null;
      console.log('数据库连接已关闭');
    }
  }

  /**
   * 检查数据库健康状态
   */
  async checkHealth(): Promise<{ healthy: boolean; error?: string }> {
    try {
      if (!this.db) {
        return { healthy: false, error: '数据库未初始化' };
      }

      // 执行简单查询测试连接
      this.db.prepare('SELECT 1').get();
      return { healthy: true };
    } catch (error: any) {
      return { healthy: false, error: error.message };
    }
  }
}
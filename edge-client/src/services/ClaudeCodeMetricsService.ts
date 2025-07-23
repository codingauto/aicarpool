/**
 * Claude Code 专用指标监控服务
 */
import { MetricsService } from './MetricsService.js';
import { EdgeClient } from '@/core/EdgeClient.js';
import { ClaudeCodeUsage } from '@/types/index.js';

export interface ClaudeCodeMetrics {
  timestamp: Date;
  userId: string;
  version: string;
  requestType: 'chat' | 'tools' | 'files';
  model: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  responseTime: number;
  success: boolean;
  error?: string;
  tools?: string[];
  files?: string[];
  features?: {
    streaming: boolean;
    tools: boolean;
    files: boolean;
    memory: boolean;
  };
}

export interface ClaudeCodeReport {
  timeRange: string;
  summary: {
    totalRequests: number;
    totalUsers: number;
    totalTokens: number;
    averageResponseTime: number;
    successRate: number;
    errorRate: number;
  };
  usage: {
    byVersion: Record<string, number>;
    byModel: Record<string, number>;
    byHour: Record<string, number>;
    byDay: Record<string, number>;
  };
  features: {
    streaming: number;
    tools: number;
    files: number;
    memory: number;
  };
  topUsers: Array<{
    userId: string;
    requests: number;
    tokens: number;
    successRate: number;
  }>;
  errors: Array<{
    error: string;
    count: number;
    percentage: number;
  }>;
  performance: {
    averageResponseTime: number;
    medianResponseTime: number;
    p95ResponseTime: number;
    p99ResponseTime: number;
  };
}

export class ClaudeCodeMetricsService extends MetricsService {
  private claudeCodeMetrics: ClaudeCodeMetrics[] = [];
  private userMetrics: Map<string, ClaudeCodeUsage[]> = new Map();
  private readonly maxMetricsHistory = 10000; // 保留最近 10K 条记录

  constructor(edgeClient: EdgeClient) {
    super(edgeClient);
  }

  /**
   * 记录 Claude Code 请求指标
   */
  async recordClaudeCodeRequest(metrics: ClaudeCodeMetrics): Promise<void> {
    try {
      // 添加到内存缓存
      this.claudeCodeMetrics.push(metrics);
      
      // 限制内存使用
      if (this.claudeCodeMetrics.length > this.maxMetricsHistory) {
        this.claudeCodeMetrics = this.claudeCodeMetrics.slice(-this.maxMetricsHistory);
      }

      // 更新用户指标
      this.updateUserMetrics(metrics);

      // 记录到基础指标服务
      await this.recordApiUsage({
        service: 'claude-code',
        model: metrics.model,
        timestamp: metrics.timestamp,
        responseTime: metrics.responseTime,
        success: metrics.success,
        inputTokens: metrics.inputTokens,
        outputTokens: metrics.outputTokens,
        totalTokens: metrics.totalTokens,
        estimatedCost: 0,
        groupId: metrics.userId,
        userApiKeyHash: metrics.userId
      });

      // Token 使用指标已在上面记录了

      // 响应时间指标已在 UsageStats 中记录了

      // 错误指标已在 UsageStats 中记录了

    } catch (error) {
      console.error('记录 Claude Code 指标失败:', error);
    }
  }

  /**
   * 更新用户指标
   */
  private updateUserMetrics(metrics: ClaudeCodeMetrics): void {
    const userId = metrics.userId;
    
    if (!this.userMetrics.has(userId)) {
      this.userMetrics.set(userId, []);
    }

    const userUsage: ClaudeCodeUsage = {
      userId,
      requestId: `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      timestamp: metrics.timestamp,
      inputTokens: metrics.inputTokens,
      outputTokens: metrics.outputTokens,
      cacheCreationTokens: 0,
      cacheReadTokens: 0,
      totalTokens: metrics.totalTokens,
      model: metrics.model,
      requestDuration: metrics.responseTime,
      success: metrics.success,
      error: metrics.error,
      tools: metrics.tools || [],
      files: metrics.files || []
    };

    const userMetricsList = this.userMetrics.get(userId)!;
    userMetricsList.push(userUsage);

    // 限制每个用户的历史记录
    if (userMetricsList.length > 1000) {
      this.userMetrics.set(userId, userMetricsList.slice(-1000));
    }
  }

  /**
   * 生成 Claude Code 使用报告
   */
  async generateClaudeCodeReport(timeRange: string = '24h'): Promise<ClaudeCodeReport> {
    const endTime = new Date();
    const startTime = this.getStartTime(endTime, timeRange);
    
    // 过滤时间范围内的指标
    const filteredMetrics = this.claudeCodeMetrics.filter(m => 
      m.timestamp >= startTime && m.timestamp <= endTime
    );

    if (filteredMetrics.length === 0) {
      return this.getEmptyReport(timeRange);
    }

    return {
      timeRange,
      summary: this.calculateSummary(filteredMetrics),
      usage: this.calculateUsageStats(filteredMetrics),
      features: this.calculateFeatureStats(filteredMetrics),
      topUsers: this.calculateTopUsers(filteredMetrics),
      errors: this.calculateErrorStats(filteredMetrics),
      performance: this.calculatePerformanceStats(filteredMetrics)
    };
  }

  /**
   * 获取用户详细统计
   */
  async getUserDetailedStats(userId: string, timeRange: string = '7d'): Promise<any> {
    const userMetrics = this.userMetrics.get(userId) || [];
    const endTime = new Date();
    const startTime = this.getStartTime(endTime, timeRange);

    const filteredMetrics = userMetrics.filter(m => 
      m.timestamp >= startTime && m.timestamp <= endTime
    );

    if (filteredMetrics.length === 0) {
      return null;
    }

    return {
      userId,
      timeRange,
      totalRequests: filteredMetrics.length,
      totalTokens: filteredMetrics.reduce((sum, m) => sum + m.totalTokens, 0),
      inputTokens: filteredMetrics.reduce((sum, m) => sum + m.inputTokens, 0),
      outputTokens: filteredMetrics.reduce((sum, m) => sum + m.outputTokens, 0),
      averageResponseTime: filteredMetrics.reduce((sum, m) => sum + m.requestDuration, 0) / filteredMetrics.length,
      successRate: (filteredMetrics.filter(m => m.success).length / filteredMetrics.length) * 100,
      models: this.getModelDistribution(filteredMetrics),
      dailyUsage: this.getDailyUsage(filteredMetrics),
      tools: this.getToolUsage(filteredMetrics),
      files: this.getFileUsage(filteredMetrics)
    };
  }

  /**
   * 获取实时统计
   */
  getRealTimeStats(): any {
    const last5Minutes = new Date(Date.now() - 5 * 60 * 1000);
    const recentMetrics = this.claudeCodeMetrics.filter(m => m.timestamp >= last5Minutes);

    return {
      timestamp: new Date().toISOString(),
      activeUsers: new Set(recentMetrics.map(m => m.userId)).size,
      requestsPerMinute: recentMetrics.length / 5,
      tokensPerMinute: recentMetrics.reduce((sum, m) => sum + m.totalTokens, 0) / 5,
      averageResponseTime: recentMetrics.length > 0 
        ? recentMetrics.reduce((sum, m) => sum + m.responseTime, 0) / recentMetrics.length 
        : 0,
      successRate: recentMetrics.length > 0 
        ? (recentMetrics.filter(m => m.success).length / recentMetrics.length) * 100 
        : 100,
      topModels: this.getTopModels(recentMetrics, 3),
      errors: this.getRecentErrors(recentMetrics)
    };
  }

  /**
   * 计算汇总统计
   */
  private calculateSummary(metrics: ClaudeCodeMetrics[]): any {
    const uniqueUsers = new Set(metrics.map(m => m.userId)).size;
    const totalTokens = metrics.reduce((sum, m) => sum + m.totalTokens, 0);
    const successfulRequests = metrics.filter(m => m.success).length;
    const averageResponseTime = metrics.reduce((sum, m) => sum + m.responseTime, 0) / metrics.length;

    return {
      totalRequests: metrics.length,
      totalUsers: uniqueUsers,
      totalTokens,
      averageResponseTime: Math.round(averageResponseTime),
      successRate: Math.round((successfulRequests / metrics.length) * 100 * 100) / 100,
      errorRate: Math.round(((metrics.length - successfulRequests) / metrics.length) * 100 * 100) / 100
    };
  }

  /**
   * 计算使用统计
   */
  private calculateUsageStats(metrics: ClaudeCodeMetrics[]): any {
    const byVersion: Record<string, number> = {};
    const byModel: Record<string, number> = {};
    const byHour: Record<string, number> = {};
    const byDay: Record<string, number> = {};

    metrics.forEach(m => {
      // 按版本统计
      byVersion[m.version] = (byVersion[m.version] || 0) + 1;
      
      // 按模型统计
      byModel[m.model] = (byModel[m.model] || 0) + 1;
      
      // 按小时统计
      const hour = m.timestamp.toISOString().substring(0, 13);
      byHour[hour] = (byHour[hour] || 0) + 1;
      
      // 按天统计
      const day = m.timestamp.toISOString().substring(0, 10);
      byDay[day] = (byDay[day] || 0) + 1;
    });

    return { byVersion, byModel, byHour, byDay };
  }

  /**
   * 计算功能使用统计
   */
  private calculateFeatureStats(metrics: ClaudeCodeMetrics[]): any {
    return {
      streaming: metrics.filter(m => m.features?.streaming).length,
      tools: metrics.filter(m => m.features?.tools).length,
      files: metrics.filter(m => m.features?.files).length,
      memory: metrics.filter(m => m.features?.memory).length
    };
  }

  /**
   * 计算性能统计
   */
  private calculatePerformanceStats(metrics: ClaudeCodeMetrics[]): any {
    const responseTimes = metrics.map(m => m.responseTime).sort((a, b) => a - b);
    const length = responseTimes.length;

    return {
      averageResponseTime: Math.round(responseTimes.reduce((sum, rt) => sum + rt, 0) / length),
      medianResponseTime: length > 0 ? responseTimes[Math.floor(length / 2)] : 0,
      p95ResponseTime: length > 0 ? responseTimes[Math.floor(length * 0.95)] : 0,
      p99ResponseTime: length > 0 ? responseTimes[Math.floor(length * 0.99)] : 0
    };
  }

  /**
   * 计算顶级用户
   */
  private calculateTopUsers(metrics: ClaudeCodeMetrics[]): any[] {
    const userStats: Record<string, any> = {};

    metrics.forEach(m => {
      if (!userStats[m.userId]) {
        userStats[m.userId] = { requests: 0, tokens: 0, successful: 0 };
      }
      
      userStats[m.userId].requests++;
      userStats[m.userId].tokens += m.totalTokens;
      if (m.success) userStats[m.userId].successful++;
    });

    return Object.entries(userStats)
      .map(([userId, stats]) => ({
        userId,
        requests: stats.requests,
        tokens: stats.tokens,
        successRate: Math.round((stats.successful / stats.requests) * 100 * 100) / 100
      }))
      .sort((a, b) => b.requests - a.requests)
      .slice(0, 10);
  }

  /**
   * 计算错误统计
   */
  private calculateErrorStats(metrics: ClaudeCodeMetrics[]): any[] {
    const errorCounts: Record<string, number> = {};
    const totalErrors = metrics.filter(m => !m.success).length;

    metrics.forEach(m => {
      if (!m.success && m.error) {
        errorCounts[m.error] = (errorCounts[m.error] || 0) + 1;
      }
    });

    return Object.entries(errorCounts)
      .map(([error, count]) => ({
        error,
        count,
        percentage: Math.round((count / totalErrors) * 100 * 100) / 100
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }

  /**
   * 获取时间范围的开始时间
   */
  private getStartTime(endTime: Date, timeRange: string): Date {
    const duration = this.parseTimeRange(timeRange);
    return new Date(endTime.getTime() - duration);
  }

  /**
   * 解析时间范围
   */
  private parseTimeRange(timeRange: string): number {
    const match = timeRange.match(/^(\d+)([hmd])$/);
    if (!match) return 24 * 60 * 60 * 1000; // 默认 24 小时

    const value = parseInt(match[1]);
    const unit = match[2];

    switch (unit) {
      case 'h': return value * 60 * 60 * 1000;
      case 'd': return value * 24 * 60 * 60 * 1000;
      case 'm': return value * 30 * 24 * 60 * 60 * 1000; // 月
      default: return 24 * 60 * 60 * 1000;
    }
  }

  /**
   * 获取空报告
   */
  private getEmptyReport(timeRange: string): ClaudeCodeReport {
    return {
      timeRange,
      summary: {
        totalRequests: 0,
        totalUsers: 0,
        totalTokens: 0,
        averageResponseTime: 0,
        successRate: 0,
        errorRate: 0
      },
      usage: {
        byVersion: {},
        byModel: {},
        byHour: {},
        byDay: {}
      },
      features: {
        streaming: 0,
        tools: 0,
        files: 0,
        memory: 0
      },
      topUsers: [],
      errors: [],
      performance: {
        averageResponseTime: 0,
        medianResponseTime: 0,
        p95ResponseTime: 0,
        p99ResponseTime: 0
      }
    };
  }

  // 辅助方法
  private getModelDistribution(metrics: ClaudeCodeUsage[]): Record<string, number> {
    const distribution: Record<string, number> = {};
    metrics.forEach(m => {
      distribution[m.model] = (distribution[m.model] || 0) + 1;
    });
    return distribution;
  }

  private getDailyUsage(metrics: ClaudeCodeUsage[]): Record<string, number> {
    const usage: Record<string, number> = {};
    metrics.forEach(m => {
      const day = m.timestamp.toISOString().substring(0, 10);
      usage[day] = (usage[day] || 0) + m.totalTokens;
    });
    return usage;
  }

  private getToolUsage(metrics: ClaudeCodeUsage[]): Record<string, number> {
    const usage: Record<string, number> = {};
    metrics.forEach(m => {
      m.tools?.forEach(tool => {
        usage[tool] = (usage[tool] || 0) + 1;
      });
    });
    return usage;
  }

  private getFileUsage(metrics: ClaudeCodeUsage[]): Record<string, number> {
    const usage: Record<string, number> = {};
    metrics.forEach(m => {
      m.files?.forEach(file => {
        usage[file] = (usage[file] || 0) + 1;
      });
    });
    return usage;
  }

  private getTopModels(metrics: ClaudeCodeMetrics[], limit: number): Array<{model: string, count: number}> {
    const modelCounts: Record<string, number> = {};
    metrics.forEach(m => {
      modelCounts[m.model] = (modelCounts[m.model] || 0) + 1;
    });
    
    return Object.entries(modelCounts)
      .map(([model, count]) => ({ model, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }

  private getRecentErrors(metrics: ClaudeCodeMetrics[]): Array<{error: string, count: number}> {
    const errorCounts: Record<string, number> = {};
    metrics.filter(m => !m.success && m.error).forEach(m => {
      errorCounts[m.error!] = (errorCounts[m.error!] || 0) + 1;
    });
    
    return Object.entries(errorCounts)
      .map(([error, count]) => ({ error, count }))
      .sort((a, b) => b.count - a.count);
  }
}
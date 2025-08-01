/**
 * 性能监控和优化工具
 */

import { cacheManager } from './cache';

interface PerformanceMetric {
  name: string;
  duration: number;
  timestamp: number;
  metadata?: Record<string, any>;
}

class PerformanceMonitor {
  private metrics: Map<string, PerformanceMetric[]> = new Map();
  private timers: Map<string, number> = new Map();

  /**
   * 开始计时
   */
  startTimer(name: string, metadata?: Record<string, any>): void {
    this.timers.set(name, performance.now());
    if (metadata) {
      this.timers.set(`${name}_metadata`, metadata as any);
    }
  }

  /**
   * 结束计时并记录
   */
  endTimer(name: string): number {
    const startTime = this.timers.get(name);
    if (!startTime) {
      console.warn(`Timer ${name} not found`);
      return 0;
    }

    const duration = performance.now() - startTime;
    const metadata = this.timers.get(`${name}_metadata`) as Record<string, any> | undefined;
    
    const metric: PerformanceMetric = {
      name,
      duration,
      timestamp: Date.now(),
      metadata,
    };

    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }
    
    this.metrics.get(name)!.push(metric);
    
    // 清理计时器
    this.timers.delete(name);
    this.timers.delete(`${name}_metadata`);

    // 保留最近100条记录
    const metrics = this.metrics.get(name)!;
    if (metrics.length > 100) {
      metrics.splice(0, metrics.length - 100);
    }

    return duration;
  }

  /**
   * 获取性能指标
   */
  getMetrics(name?: string): Record<string, PerformanceMetric[]> | PerformanceMetric[] {
    if (name) {
      return this.metrics.get(name) || [];
    }
    return Object.fromEntries(this.metrics);
  }

  /**
   * 获取平均性能
   */
  getAveragePerformance(name: string, lastN = 10): number {
    const metrics = this.metrics.get(name);
    if (!metrics || metrics.length === 0) return 0;

    const recent = metrics.slice(-lastN);
    const sum = recent.reduce((acc, metric) => acc + metric.duration, 0);
    return sum / recent.length;
  }

  /**
   * 清理指标
   */
  clearMetrics(name?: string): void {
    if (name) {
      this.metrics.delete(name);
    } else {
      this.metrics.clear();
    }
  }
}

// 全局性能监控实例
export const performanceMonitor = new PerformanceMonitor();

/**
 * 性能监控装饰器
 */
export function measurePerformance(name?: string) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    const metricName = name || `${target.constructor.name}.${propertyKey}`;

    descriptor.value = async function (...args: any[]) {
      performanceMonitor.startTimer(metricName, {
        method: propertyKey,
        args: args.length,
      });

      try {
        const result = await originalMethod.apply(this, args);
        const duration = performanceMonitor.endTimer(metricName);
        
        // 记录慢查询
        if (duration > 1000) {
          console.warn(`Slow operation detected: ${metricName} took ${duration.toFixed(2)}ms`);
        }
        
        return result;
      } catch (error) {
        performanceMonitor.endTimer(metricName);
        throw error;
      }
    };

    return descriptor;
  };
}

/**
 * API性能监控中间件
 */
export function withPerformanceMonitoring(handler: Function, name?: string) {
  return async function (...args: any[]) {
    const metricName = name || `API.${handler.name}`;
    
    performanceMonitor.startTimer(metricName, {
      endpoint: args[0]?.url || 'unknown',
      method: args[0]?.method || 'unknown',
    });

    try {
      const result = await handler.apply(this, args);
      const duration = performanceMonitor.endTimer(metricName);
      
      // 异步保存性能数据到缓存
      if (duration > 100) {
        const key = `perf:${metricName}:${Date.now()}`;
        cacheManager.set(key, {
          name: metricName,
          duration,
          timestamp: Date.now(),
        }, 3600).catch(console.error);
      }
      
      return result;
    } catch (error) {
      performanceMonitor.endTimer(metricName);
      throw error;
    }
  };
}

/**
 * 数据库查询优化监控
 */
export class DatabaseMonitor {
  private static queryCount = 0;
  private static slowQueries: Array<{query: string, duration: number, timestamp: number}> = [];

  static logQuery(query: string, duration: number) {
    this.queryCount++;
    
    if (duration > 500) { // 超过500ms的查询
      this.slowQueries.push({
        query: query.substring(0, 200), // 截取前200个字符
        duration,
        timestamp: Date.now(),
      });
      
      // 保留最近50条慢查询
      if (this.slowQueries.length > 50) {
        this.slowQueries.shift();
      }
      
      console.warn(`Slow database query (${duration}ms):`, query.substring(0, 100));
    }
  }

  static getStats() {
    return {
      totalQueries: this.queryCount,
      slowQueries: this.slowQueries,
      averageSlowQueryTime: this.slowQueries.length > 0 
        ? this.slowQueries.reduce((sum, q) => sum + q.duration, 0) / this.slowQueries.length 
        : 0,
    };
  }

  static reset() {
    this.queryCount = 0;
    this.slowQueries = [];
  }
}

/**
 * React Hook 性能监控
 */
export function usePerformanceMonitor(name: string) {
  const startTime = performance.now();
  
  return {
    end: () => {
      const duration = performance.now() - startTime;
      performanceMonitor.startTimer(name);
      performanceMonitor.endTimer(name);
      
      if (duration > 100) {
        console.warn(`Slow React component: ${name} took ${duration.toFixed(2)}ms`);
      }
      
      return duration;
    }
  };
}
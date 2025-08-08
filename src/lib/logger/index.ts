/**
 * 统一日志系统
 * 
 * 提供结构化日志记录和错误追踪功能
 */

import { prisma } from '@/lib/prisma';

export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
  FATAL = 'fatal'
}

export interface LogContext {
  userId?: string;
  groupId?: string;
  apiKeyId?: string;
  requestId?: string;
  service?: string;
  action?: string;
  metadata?: Record<string, any>;
}

export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: Date;
  context?: LogContext;
  error?: Error | null;
  stack?: string;
}

class Logger {
  private isDevelopment = process.env.NODE_ENV === 'development';
  private logToConsole = process.env.LOG_TO_CONSOLE !== 'false';
  private logToDatabase = process.env.LOG_TO_DATABASE === 'true';

  /**
   * 格式化日志消息
   */
  private formatMessage(entry: LogEntry): string {
    const timestamp = entry.timestamp.toISOString();
    const level = entry.level.toUpperCase().padEnd(5);
    const context = entry.context ? JSON.stringify(entry.context) : '';
    
    let message = `[${timestamp}] [${level}] ${entry.message}`;
    
    if (context) {
      message += ` | Context: ${context}`;
    }
    
    if (entry.error) {
      message += ` | Error: ${entry.error.message}`;
    }
    
    return message;
  }

  /**
   * 输出日志到控制台
   */
  private logToConsoleOutput(entry: LogEntry) {
    if (!this.logToConsole) return;

    const formattedMessage = this.formatMessage(entry);
    
    switch (entry.level) {
      case LogLevel.DEBUG:
        if (this.isDevelopment) {
          console.debug(formattedMessage);
        }
        break;
      case LogLevel.INFO:
        console.log(formattedMessage);
        break;
      case LogLevel.WARN:
        console.warn(formattedMessage);
        break;
      case LogLevel.ERROR:
      case LogLevel.FATAL:
        console.error(formattedMessage);
        if (entry.stack) {
          console.error(entry.stack);
        }
        break;
    }
  }

  /**
   * 保存日志到数据库
   */
  private async saveToDatabase(entry: LogEntry) {
    if (!this.logToDatabase) return;
    
    try {
      // 异步保存，不阻塞主流程
      setImmediate(async () => {
        try {
          await prisma.systemLog.create({
            data: {
              level: entry.level,
              message: entry.message,
              context: entry.context as any,
              error: entry.error ? {
                message: entry.error.message,
                stack: entry.stack,
                name: entry.error.name
              } : undefined,
              timestamp: entry.timestamp
            }
          });
        } catch (dbError) {
          // 数据库写入失败时仅输出到控制台
          console.error('Failed to save log to database:', dbError);
        }
      });
    } catch (error) {
      console.error('Failed to queue log for database:', error);
    }
  }

  /**
   * 记录日志
   */
  private log(level: LogLevel, message: string, context?: LogContext, error?: Error | null) {
    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date(),
      context,
      error,
      stack: error?.stack
    };

    this.logToConsoleOutput(entry);
    this.saveToDatabase(entry);
  }

  // 公共方法
  debug(message: string, context?: LogContext) {
    this.log(LogLevel.DEBUG, message, context);
  }

  info(message: string, context?: LogContext) {
    this.log(LogLevel.INFO, message, context);
  }

  warn(message: string, context?: LogContext) {
    this.log(LogLevel.WARN, message, context);
  }

  error(message: string, error?: Error | null, context?: LogContext) {
    this.log(LogLevel.ERROR, message, context, error);
  }

  fatal(message: string, error?: Error | null, context?: LogContext) {
    this.log(LogLevel.FATAL, message, context, error);
  }

  /**
   * 记录API请求
   */
  logApiRequest(
    method: string,
    path: string,
    statusCode: number,
    responseTime: number,
    context?: LogContext
  ) {
    const message = `${method} ${path} - ${statusCode} - ${responseTime}ms`;
    const level = statusCode >= 500 ? LogLevel.ERROR : 
                  statusCode >= 400 ? LogLevel.WARN : 
                  LogLevel.INFO;
    
    this.log(level, message, context);
  }

  /**
   * 记录性能指标
   */
  logPerformance(
    operation: string,
    duration: number,
    context?: LogContext
  ) {
    const message = `Performance: ${operation} took ${duration}ms`;
    const level = duration > 5000 ? LogLevel.WARN : LogLevel.INFO;
    
    this.log(level, message, {
      ...context,
      metadata: {
        ...context?.metadata,
        operation,
        duration
      }
    });
  }
}

// 导出单例
export const logger = new Logger();

/**
 * 错误追踪器
 */
export class ErrorTracker {
  /**
   * 捕获并记录错误
   */
  static capture(error: Error, context?: LogContext): void {
    logger.error(`Captured error: ${error.message}`, error, context);
    
    // 如果集成了第三方错误追踪服务（如Sentry），在这里发送
    if (process.env.SENTRY_DSN) {
      // Sentry.captureException(error, { extra: context });
    }
  }

  /**
   * 创建带上下文的错误
   */
  static createError(message: string, code: string, context?: LogContext): Error {
    const error = new Error(message) as any;
    error.code = code;
    error.context = context;
    return error;
  }

  /**
   * 包装异步函数以自动捕获错误
   */
  static wrapAsync<T extends (...args: any[]) => Promise<any>>(
    fn: T,
    context?: LogContext
  ): T {
    return (async (...args: Parameters<T>) => {
      try {
        return await fn(...args);
      } catch (error) {
        ErrorTracker.capture(error as Error, context);
        throw error;
      }
    }) as T;
  }
}

/**
 * 性能监控器
 */
export class PerformanceMonitor {
  private static timers = new Map<string, number>();

  /**
   * 开始计时
   */
  static start(operation: string): void {
    this.timers.set(operation, Date.now());
  }

  /**
   * 结束计时并记录
   */
  static end(operation: string, context?: LogContext): number {
    const startTime = this.timers.get(operation);
    if (!startTime) {
      logger.warn(`No timer found for operation: ${operation}`);
      return 0;
    }

    const duration = Date.now() - startTime;
    this.timers.delete(operation);
    
    logger.logPerformance(operation, duration, context);
    
    return duration;
  }

  /**
   * 装饰器：自动监控函数性能
   */
  static monitor(operationName?: string) {
    return function (
      target: any,
      propertyKey: string,
      descriptor: PropertyDescriptor
    ) {
      const originalMethod = descriptor.value;
      const operation = operationName || `${target.constructor.name}.${propertyKey}`;

      descriptor.value = async function (...args: any[]) {
        PerformanceMonitor.start(operation);
        try {
          const result = await originalMethod.apply(this, args);
          return result;
        } finally {
          PerformanceMonitor.end(operation);
        }
      };

      return descriptor;
    };
  }
}

// 导出便捷函数
export const captureError = ErrorTracker.capture;
export const wrapAsync = ErrorTracker.wrapAsync;
export const monitor = PerformanceMonitor.monitor;
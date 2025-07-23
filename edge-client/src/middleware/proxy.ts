/**
 * 代理中间件
 */
import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './auth.js';

/**
 * 请求日志中间件
 */
export function requestLogger(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const startTime = Date.now();
  
  // 记录请求信息
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} - ${req.ip}`);
  
  // 监听响应结束事件
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} - ${res.statusCode} (${duration}ms)`);
  });
  
  next();
}

/**
 * 错误处理中间件
 */
export function errorHandler(error: Error, req: Request, res: Response, next: NextFunction): void {
  console.error('请求处理错误:', error);
  
  if (res.headersSent) {
    return next(error);
  }
  
  const statusCode = (error as any).statusCode || 500;
  const message = error.message || 'Internal Server Error';
  
  res.status(statusCode).json({
    error: message,
    timestamp: new Date().toISOString(),
    path: req.path
  });
}

/**
 * CORS中间件
 */
export function corsHandler(req: Request, res: Response, next: NextFunction): void {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Content-Length, X-Requested-With, X-API-Key');
  
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
}

/**
 * 健康检查中间件
 */
export function healthCheck(req: Request, res: Response, next: NextFunction): void {
  if (req.path === '/health') {
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      version: process.version
    });
  } else {
    next();
  }
}
/**
 * Claude Code 专用认证中间件
 * 与现有 aicarpool 系统集成，通过现有的 API Key 系统验证用户
 */
import { Request, Response, NextFunction } from 'express';
import { ClaudeCodeUser } from '@/types/index.js';

export interface ClaudeCodeRequest extends Request {
  apiKey?: string;
  claudeCodeVersion?: string;
  isClaudeCodeRequest?: boolean;
  claudeCodeUser?: ClaudeCodeUser;
}

/**
 * Claude Code API Key 认证中间件
 */
export function claudeCodeAuth(req: ClaudeCodeRequest, res: Response, next: NextFunction): void {
  const apiKey = req.headers['x-api-key'] as string;
  const userAgent = req.headers['user-agent'] as string || '';
  
  // 验证是否为 Claude Code 请求
  if (!isClaudeCodeRequest(userAgent)) {
    res.status(401).json({ 
      error: 'Invalid client',
      message: 'This endpoint is exclusively for Claude Code CLI'
    });
    return;
  }

  // 验证 API Key
  if (!apiKey) {
    res.status(401).json({ 
      error: 'Missing API key',
      message: 'X-API-Key header is required'
    });
    return;
  }

  if (!isValidApiKeyFormat(apiKey)) {
    res.status(401).json({ 
      error: 'Invalid API key format',
      message: 'API key must be at least 20 characters long'
    });
    return;
  }

  // 提取 Claude Code 版本
  const version = extractClaudeCodeVersion(userAgent);
  if (!version) {
    res.status(401).json({ 
      error: 'Invalid user agent',
      message: 'Could not extract Claude Code version from user agent'
    });
    return;
  }

  // 检查版本支持
  if (!isSupportedVersion(version)) {
    res.status(426).json({ 
      error: 'Unsupported version',
      message: `Claude Code version ${version} is not supported. Please upgrade to a supported version.`,
      supportedVersions: ['1.0.55', '1.0.56', '1.0.57', '1.0.58', '1.0.59']
    });
    return;
  }

  // 设置请求信息
  req.isClaudeCodeRequest = true;
  req.claudeCodeVersion = version;
  
  // 这里应该验证 API Key 并获取用户信息
  // 暂时创建一个模拟用户
  req.claudeCodeUser = createMockUser(apiKey, version);
  
  next();
}

/**
 * 检查是否为 Claude Code 请求
 */
function isClaudeCodeRequest(userAgent: string): boolean {
  return /claude-cli\/\d+\.\d+\.\d+/.test(userAgent);
}

/**
 * 验证 API Key 格式
 */
function isValidApiKeyFormat(apiKey: string): boolean {
  return Boolean(apiKey && apiKey.length >= 20);
}

/**
 * 提取 Claude Code 版本
 */
function extractClaudeCodeVersion(userAgent: string): string | null {
  const match = userAgent.match(/claude-cli\/(\d+\.\d+\.\d+)/);
  return match ? match[1] : null;
}

/**
 * 检查版本是否支持
 */
function isSupportedVersion(version: string): boolean {
  const supportedVersions = ['1.0.55', '1.0.56', '1.0.57', '1.0.58', '1.0.59'];
  return supportedVersions.includes(version);
}

/**
 * 创建模拟用户（实际实现中应该从数据库获取）
 */
function createMockUser(apiKey: string, version: string): ClaudeCodeUser {
  return {
    id: `cc_${Date.now()}`,
    apiKey,
    userId: `user_${apiKey.substring(apiKey.length - 8)}`,
    quotaDaily: 50000,
    quotaMonthly: 1500000,
    usedDaily: 0,
    usedMonthly: 0,
    createdAt: new Date(),
    status: 'active',
    version,
    metadata: {
      lastSeen: new Date().toISOString(),
      requestCount: 0
    }
  };
}

/**
 * Claude Code 配额检查中间件
 */
export function claudeCodeQuotaCheck(req: ClaudeCodeRequest, res: Response, next: NextFunction): void {
  if (!req.claudeCodeUser) {
    res.status(401).json({ error: 'User not authenticated' });
    return;
  }

  const user = req.claudeCodeUser;

  // 检查每日配额
  if (user.usedDaily >= user.quotaDaily) {
    res.status(429).json({
      error: 'Daily quota exceeded',
      message: `You have exceeded your daily token limit of ${user.quotaDaily.toLocaleString()}`,
      quota: {
        daily: user.quotaDaily,
        used: user.usedDaily,
        remaining: Math.max(0, user.quotaDaily - user.usedDaily)
      },
      resetTime: getNextResetTime('daily')
    });
    return;
  }

  // 检查每月配额
  if (user.usedMonthly >= user.quotaMonthly) {
    res.status(429).json({
      error: 'Monthly quota exceeded',
      message: `You have exceeded your monthly token limit of ${user.quotaMonthly.toLocaleString()}`,
      quota: {
        monthly: user.quotaMonthly,
        used: user.usedMonthly,
        remaining: Math.max(0, user.quotaMonthly - user.usedMonthly)
      },
      resetTime: getNextResetTime('monthly')
    });
    return;
  }

  next();
}

/**
 * 获取下次重置时间
 */
function getNextResetTime(period: 'daily' | 'monthly'): Date {
  const now = new Date();
  
  if (period === 'daily') {
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    return tomorrow;
  } else {
    const nextMonth = new Date(now);
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    nextMonth.setDate(1);
    nextMonth.setHours(0, 0, 0, 0);
    return nextMonth;
  }
}

/**
 * Claude Code 请求验证中间件
 */
export function claudeCodeRequestValidation(req: ClaudeCodeRequest, res: Response, next: NextFunction): void {
  // 验证请求体
  if (!req.body || typeof req.body !== 'object') {
    res.status(400).json({
      error: 'Invalid request body',
      message: 'Request body must be a valid JSON object'
    });
    return;
  }

  // 验证必要字段
  if (!req.body.messages || !Array.isArray(req.body.messages)) {
    res.status(400).json({
      error: 'Invalid messages',
      message: 'Messages field must be an array'
    });
    return;
  }

  if (req.body.messages.length === 0) {
    res.status(400).json({
      error: 'Empty messages',
      message: 'Messages array cannot be empty'
    });
    return;
  }

  // 验证模型
  if (req.body.model && !isValidModel(req.body.model)) {
    res.status(400).json({
      error: 'Invalid model',
      message: `Model '${req.body.model}' is not supported`,
      supportedModels: [
        'claude-3-5-sonnet-20241022',
        'claude-3-5-haiku-20241022',
        'claude-3-opus-20240229',
        'claude-sonnet-4-20250514'
      ]
    });
    return;
  }

  // 验证 max_tokens
  if (req.body.max_tokens && (req.body.max_tokens < 1 || req.body.max_tokens > 8192)) {
    res.status(400).json({
      error: 'Invalid max_tokens',
      message: 'max_tokens must be between 1 and 8192'
    });
    return;
  }

  // 验证 temperature
  if (req.body.temperature !== undefined && (req.body.temperature < 0 || req.body.temperature > 1)) {
    res.status(400).json({
      error: 'Invalid temperature',
      message: 'temperature must be between 0 and 1'
    });
    return;
  }

  next();
}

/**
 * 验证模型是否支持
 */
function isValidModel(model: string): boolean {
  const supportedModels = [
    'claude-3-5-sonnet-20241022',
    'claude-3-5-haiku-20241022',
    'claude-3-opus-20240229',
    'claude-sonnet-4-20250514'
  ];
  return supportedModels.includes(model);
}

/**
 * Claude Code 速率限制中间件
 */
export function claudeCodeRateLimit(maxRequests: number = 60, windowMs: number = 60000) {
  const requests = new Map<string, { count: number; resetTime: number }>();

  return (req: ClaudeCodeRequest, res: Response, next: NextFunction): void => {
    if (!req.claudeCodeUser) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    const clientId = req.claudeCodeUser.userId;
    const now = Date.now();
    
    const clientData = requests.get(clientId);
    
    if (!clientData || now > clientData.resetTime) {
      requests.set(clientId, { count: 1, resetTime: now + windowMs });
      next();
      return;
    }
    
    if (clientData.count >= maxRequests) {
      res.status(429).json({ 
        error: 'Rate limit exceeded',
        message: `Too many requests. Maximum ${maxRequests} requests per ${windowMs / 1000} seconds.`,
        retryAfter: Math.ceil((clientData.resetTime - now) / 1000),
        limits: {
          requests: maxRequests,
          window: windowMs / 1000,
          used: clientData.count
        }
      });
      return;
    }
    
    clientData.count++;
    next();
  };
}

/**
 * Claude Code 请求日志中间件
 */
export function claudeCodeRequestLogger(req: ClaudeCodeRequest, res: Response, next: NextFunction): void {
  const startTime = Date.now();
  const requestId = `cc_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  
  console.log(`[${new Date().toISOString()}] Claude Code Request Start`, {
    requestId,
    userId: req.claudeCodeUser?.userId,
    version: req.claudeCodeVersion,
    method: req.method,
    path: req.path,
    model: req.body?.model,
    stream: req.body?.stream,
    hasTools: req.body?.tools?.length > 0,
    ip: req.ip
  });
  
  // 监听响应结束事件
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    console.log(`[${new Date().toISOString()}] Claude Code Request Complete`, {
      requestId,
      userId: req.claudeCodeUser?.userId,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      success: res.statusCode < 400
    });
  });
  
  next();
}
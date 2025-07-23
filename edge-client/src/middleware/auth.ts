/**
 * 认证中间件
 */
import { Request, Response, NextFunction } from 'express';

export interface AuthenticatedRequest extends Request {
  nodeId?: string;
  userId?: string;
}

/**
 * API Key认证中间件
 */
export function apiKeyAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const apiKey = req.headers['x-api-key'] as string;
  
  if (!apiKey) {
    res.status(401).json({ error: 'API key required' });
    return;
  }

  // 这里应该验证API key的有效性
  // 暂时简单验证格式
  if (apiKey.length < 32) {
    res.status(401).json({ error: 'Invalid API key format' });
    return;
  }

  // 设置认证信息到请求对象
  req.userId = extractUserIdFromApiKey(apiKey);
  
  next();
}

/**
 * JWT认证中间件
 */
export function jwtAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    res.status(401).json({ error: 'JWT token required' });
    return;
  }

  try {
    // 这里应该验证JWT token
    // const payload = jwt.verify(token, SECRET_KEY);
    // req.nodeId = payload.nodeId;
    // req.userId = payload.userId;
    
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid JWT token' });
  }
}

/**
 * 从API Key中提取用户ID
 */
function extractUserIdFromApiKey(apiKey: string): string {
  // 这里应该实现真实的用户ID提取逻辑
  // 暂时返回API key的hash
  return Buffer.from(apiKey).toString('base64').substring(0, 16);
}

/**
 * 速率限制中间件
 */
export function rateLimiter(maxRequests: number = 100, windowMs: number = 60000) {
  const requests = new Map<string, { count: number; resetTime: number }>();

  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    const clientId = req.ip || req.userId || 'anonymous';
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
        retryAfter: Math.ceil((clientData.resetTime - now) / 1000)
      });
      return;
    }
    
    clientData.count++;
    next();
  };
}
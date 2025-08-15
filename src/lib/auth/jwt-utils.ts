import jwt from 'jsonwebtoken';
import { prisma } from '@/lib/prisma';

// JWT配置
const JWT_CONFIG = {
  SECRET: process.env.JWT_SECRET || 'fallback-secret-key-for-development',
  REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || 'fallback-refresh-secret-for-development',
  ACCESS_TOKEN_EXPIRES: '15m',  // 访问token有效期15分钟
  REFRESH_TOKEN_EXPIRES: '7d',  // 刷新token有效期7天
  DEFAULT_EXPIRES: '24h'        // 默认token有效期24小时
};

export interface JWTPayload {
  userId: string;
  email: string;
  name?: string;
  role?: string;
  enterpriseId?: string;
  iat?: number;
  exp?: number;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

/**
 * 生成JWT令牌
 */
export function generateToken(payload: Omit<JWTPayload, 'iat' | 'exp'>, expiresIn: string = JWT_CONFIG.DEFAULT_EXPIRES): string {
  return jwt.sign(payload, JWT_CONFIG.SECRET, { expiresIn });
}

/**
 * 验证JWT令牌
 */
export function verifyToken(token: string): JWTPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_CONFIG.SECRET) as JWTPayload;
    return decoded;
  } catch (error) {
    console.error('JWT验证失败:', error);
    return null;
  }
}

/**
 * 解码JWT令牌（不验证签名）
 */
export function decodeToken(token: string): JWTPayload | null {
  try {
    const decoded = jwt.decode(token) as JWTPayload;
    return decoded;
  } catch (error) {
    console.error('JWT解码失败:', error);
    return null;
  }
}

/**
 * 检查令牌是否已过期
 */
export function isTokenExpired(token: string): boolean {
  try {
    const decoded = decodeToken(token);
    if (!decoded || !decoded.exp) {
      return true;
    }
    
    const currentTime = Math.floor(Date.now() / 1000);
    return decoded.exp < currentTime;
  } catch (error) {
    return true;
  }
}

/**
 * 刷新令牌
 */
export function refreshToken(token: string, expiresIn: string = JWT_CONFIG.DEFAULT_EXPIRES): string | null {
  try {
    const decoded = verifyToken(token);
    if (!decoded) {
      return null;
    }
    
    // 移除时间戳字段
    const { iat, exp, ...payload } = decoded;
    return generateToken(payload, expiresIn);
  } catch (error) {
    console.error('令牌刷新失败:', error);
    return null;
  }
}

/**
 * 生成访问和刷新token对
 */
export function generateTokenPair(payload: Omit<JWTPayload, 'iat' | 'exp'>): TokenPair {
  const accessToken = generateToken(payload, JWT_CONFIG.ACCESS_TOKEN_EXPIRES);
  const refreshToken = jwt.sign(
    { userId: payload.userId, type: 'refresh' },
    JWT_CONFIG.REFRESH_SECRET,
    { expiresIn: JWT_CONFIG.REFRESH_TOKEN_EXPIRES }
  );
  
  return {
    accessToken,
    refreshToken,
    expiresIn: 900 // 15分钟（秒）
  };
}

/**
 * 验证刷新token
 */
export function verifyRefreshToken(token: string): { userId: string } | null {
  try {
    const decoded = jwt.verify(token, JWT_CONFIG.REFRESH_SECRET) as any;
    
    if (decoded.type !== 'refresh') {
      console.error('无效的刷新token类型');
      return null;
    }
    
    return { userId: decoded.userId };
  } catch (error) {
    console.error('刷新token验证失败:', error);
    return null;
  }
}

/**
 * 从请求头中提取token
 */
export function extractTokenFromHeader(authHeader: string | null): string | null {
  if (!authHeader || authHeader === '') {
    return null;
  }
  
  // 支持 "Bearer token" 格式
  if (authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  
  // 直接返回token
  return authHeader;
}

/**
 * 验证token并返回用户信息
 */
export async function validateTokenAndGetUser(token: string) {
  try {
    const decoded = verifyToken(token);
    if (!decoded) {
      throw new Error('Token无效');
    }
    
    // 从数据库获取最新的用户信息
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        email: true,
        name: true,
        status: true
      }
    });
    
    if (!user) {
      throw new Error('用户不存在');
    }
    
    if (user.status !== 'active') {
      throw new Error('用户账号已被禁用');
    }
    
    return {
      id: user.id,
      email: user.email,
      name: user.name || '未知用户',
      role: decoded.role,
      enterpriseId: decoded.enterpriseId
    };
  } catch (error) {
    console.error('Token验证失败:', error);
    throw error;
  }
}

/**
 * 使用刷新token生成新的token对
 */
export async function refreshAccessToken(refreshToken: string): Promise<TokenPair> {
  try {
    // 验证刷新token
    const refreshPayload = verifyRefreshToken(refreshToken);
    if (!refreshPayload) {
      throw new Error('刷新token无效');
    }
    
    // 从数据库获取用户信息
    const user = await prisma.user.findUnique({
      where: { id: refreshPayload.userId },
      select: {
        id: true,
        email: true,
        name: true,
        status: true
      }
    });
    
    if (!user || user.status !== 'active') {
      throw new Error('用户不存在或已被禁用');
    }
    
    // 获取用户的默认企业（如果有）
    const userEnterprise = await prisma.userEnterprise.findFirst({
      where: {
        userId: user.id,
        isActive: true
      },
      orderBy: {
        joinedAt: 'desc' // 使用joinedAt替代lastAccessedAt
      },
      select: {
        enterpriseId: true,
        role: true
      }
    });
    
    // 生成新的token对
    const payload: Omit<JWTPayload, 'iat' | 'exp'> = {
      userId: user.id,
      email: user.email,
      name: user.name || '未知用户',
      role: userEnterprise?.role,
      enterpriseId: userEnterprise?.enterpriseId
    };
    
    return generateTokenPair(payload);
  } catch (error) {
    console.error('Token刷新失败:', error);
    throw new Error('Token刷新失败');
  }
}
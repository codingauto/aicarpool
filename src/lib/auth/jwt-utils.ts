import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-key-for-development';

export interface JWTPayload {
  userId: string;
  email: string;
  role?: string;
  enterpriseId?: string;
  iat?: number;
  exp?: number;
}

/**
 * 生成JWT令牌
 */
export function generateToken(payload: Omit<JWTPayload, 'iat' | 'exp'>, expiresIn: string = '24h'): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn });
}

/**
 * 验证JWT令牌
 */
export function verifyToken(token: string): JWTPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;
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
export function refreshToken(token: string, expiresIn: string = '24h'): string | null {
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
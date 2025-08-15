import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import jwt from 'jsonwebtoken';
import {
  generateToken,
  verifyToken,
  decodeToken,
  isTokenExpired,
  refreshToken,
  generateTokenPair,
  verifyRefreshToken,
  type JWTPayload
} from '@/lib/auth/jwt-utils';

describe('JWT核心功能测试', () => {
  // 设置测试环境变量
  const originalEnv = process.env;
  
  beforeEach(() => {
    jest.clearAllMocks();
    process.env = {
      ...originalEnv,
      JWT_SECRET: 'test-secret-key',
      JWT_REFRESH_SECRET: 'test-refresh-secret-key'
    };
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.useRealTimers();
  });

  describe('基础令牌操作', () => {
    const mockPayload: Omit<JWTPayload, 'iat' | 'exp'> = {
      userId: 'user-123',
      email: 'test@example.com',
      name: 'Test User',
      role: 'user',
      enterpriseId: 'enterprise-456'
    };

    it('生成和验证令牌的完整流程', () => {
      // 生成令牌
      const token = generateToken(mockPayload);
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      
      // 验证令牌
      const verified = verifyToken(token);
      expect(verified).not.toBeNull();
      expect(verified?.userId).toBe(mockPayload.userId);
      expect(verified?.email).toBe(mockPayload.email);
      
      // 解码令牌（不验证）
      const decoded = decodeToken(token);
      expect(decoded).not.toBeNull();
      expect(decoded?.userId).toBe(mockPayload.userId);
    });

    it('正确处理令牌过期', () => {
      jest.useFakeTimers();
      const now = new Date('2024-01-01T00:00:00Z');
      jest.setSystemTime(now);
      
      // 创建一个10秒后过期的令牌
      const token = generateToken(mockPayload, '10s');
      
      // 5秒后 - 还未过期
      jest.setSystemTime(new Date(now.getTime() + 5000));
      expect(isTokenExpired(token)).toBe(false);
      expect(verifyToken(token)).not.toBeNull();
      
      // 11秒后 - 已过期
      jest.setSystemTime(new Date(now.getTime() + 11000));
      expect(isTokenExpired(token)).toBe(true);
      expect(verifyToken(token)).toBeNull();
    });

    it('刷新令牌功能', () => {
      jest.useFakeTimers();
      const now = Date.now();
      jest.setSystemTime(now);
      
      // 创建原始令牌
      const originalToken = generateToken(mockPayload, '1h');
      const originalDecoded = decodeToken(originalToken);
      
      // 5分钟后刷新
      jest.setSystemTime(now + 5 * 60 * 1000);
      const newToken = refreshToken(originalToken);
      
      expect(newToken).not.toBeNull();
      expect(newToken).not.toBe(originalToken);
      
      const newDecoded = decodeToken(newToken!);
      expect(newDecoded?.userId).toBe(mockPayload.userId);
      expect(newDecoded?.iat).toBeGreaterThan(originalDecoded?.iat!);
    });
  });

  describe('令牌对功能', () => {
    const mockPayload: Omit<JWTPayload, 'iat' | 'exp'> = {
      userId: 'user-456',
      email: 'user@example.com'
    };

    it('生成访问和刷新令牌对', () => {
      const tokenPair = generateTokenPair(mockPayload);
      
      expect(tokenPair).toBeDefined();
      expect(tokenPair.accessToken).toBeDefined();
      expect(tokenPair.refreshToken).toBeDefined();
      expect(tokenPair.expiresIn).toBe(900); // 15分钟
      
      // 验证访问令牌
      const accessDecoded = decodeToken(tokenPair.accessToken);
      expect(accessDecoded?.userId).toBe(mockPayload.userId);
      expect(accessDecoded?.email).toBe(mockPayload.email);
      
      // 验证刷新令牌
      const refreshDecoded = jwt.decode(tokenPair.refreshToken) as any;
      expect(refreshDecoded?.userId).toBe(mockPayload.userId);
      expect(refreshDecoded?.type).toBe('refresh');
    });

    it('验证刷新令牌', () => {
      const tokenPair = generateTokenPair(mockPayload);
      
      // 验证有效的刷新令牌
      const result = verifyRefreshToken(tokenPair.refreshToken);
      expect(result).not.toBeNull();
      expect(result?.userId).toBe(mockPayload.userId);
      
      // 拒绝普通访问令牌
      const accessResult = verifyRefreshToken(tokenPair.accessToken);
      expect(accessResult).toBeNull();
    });

    it('刷新令牌有效期比访问令牌长', () => {
      const tokenPair = generateTokenPair(mockPayload);
      
      const accessDecoded = jwt.decode(tokenPair.accessToken) as JWTPayload;
      const refreshDecoded = jwt.decode(tokenPair.refreshToken) as JWTPayload;
      
      const accessLifetime = (accessDecoded.exp! - accessDecoded.iat!);
      const refreshLifetime = (refreshDecoded.exp! - refreshDecoded.iat!);
      
      expect(refreshLifetime).toBeGreaterThan(accessLifetime);
      expect(accessLifetime).toBe(15 * 60); // 15分钟
      expect(refreshLifetime).toBe(7 * 24 * 60 * 60); // 7天
    });
  });

  describe('错误处理', () => {
    it('处理无效的令牌格式', () => {
      const invalidTokens = [
        'invalid.token',
        'a.b.c.d',
        '',
        'null',
        '123456789'
      ];
      
      invalidTokens.forEach(token => {
        expect(verifyToken(token)).toBeNull();
        expect(decodeToken(token)).toBeNull();
        expect(isTokenExpired(token)).toBe(true);
      });
    });

    it('处理错误的密钥', () => {
      // 使用错误的密钥签名
      const wrongKeyToken = jwt.sign(
        { userId: 'test' },
        'wrong-secret',
        { expiresIn: '1h' }
      );
      
      expect(verifyToken(wrongKeyToken)).toBeNull();
      // 但是decode不验证签名，所以应该能解码
      expect(decodeToken(wrongKeyToken)).not.toBeNull();
    });

    it('处理篡改的令牌', () => {
      const payload = { userId: 'user-123', email: 'test@example.com' };
      let token = generateToken(payload);
      
      // 篡改payload
      const parts = token.split('.');
      const decodedPayload = JSON.parse(
        Buffer.from(parts[1], 'base64url').toString()
      );
      decodedPayload.role = 'admin'; // 尝试提权
      parts[1] = Buffer.from(JSON.stringify(decodedPayload))
        .toString('base64url');
      
      const tamperedToken = parts.join('.');
      
      // 验证应该失败
      expect(verifyToken(tamperedToken)).toBeNull();
      // 但解码仍然可以（因为不验证）
      const decoded = decodeToken(tamperedToken);
      expect(decoded?.role).toBe('admin');
    });
  });

  describe('性能测试', () => {
    it('批量令牌生成性能', () => {
      const payload = { userId: 'perf-test', email: 'perf@test.com' };
      const startTime = Date.now();
      
      // 生成100个令牌
      const tokens = Array(100).fill(null).map(() => 
        generateToken(payload)
      );
      
      const endTime = Date.now();
      const totalTime = endTime - startTime;
      
      expect(tokens).toHaveLength(100);
      expect(totalTime).toBeLessThan(100); // 应该在100ms内完成
      
      // 验证所有令牌都有效
      const allValid = tokens.every(token => 
        verifyToken(token) !== null
      );
      expect(allValid).toBe(true);
    });

    it('批量令牌验证性能', () => {
      const payload = { userId: 'perf-test', email: 'perf@test.com' };
      const token = generateToken(payload);
      
      const startTime = Date.now();
      
      // 验证100次
      const results = Array(100).fill(null).map(() => 
        verifyToken(token)
      );
      
      const endTime = Date.now();
      const totalTime = endTime - startTime;
      
      expect(results).toHaveLength(100);
      expect(totalTime).toBeLessThan(50); // 应该在50ms内完成
      
      // 所有结果应该相同
      const allSame = results.every(result => 
        result?.userId === payload.userId
      );
      expect(allSame).toBe(true);
    });
  });

  describe('实用功能', () => {
    it('从Authorization header提取令牌', async () => {
      // 动态导入以避免循环依赖
      const { extractTokenFromHeader } = await import('@/lib/auth/jwt-utils');
      const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';
      
      // Bearer格式
      expect(extractTokenFromHeader(`Bearer ${token}`)).toBe(token);
      
      // 直接令牌
      expect(extractTokenFromHeader(token)).toBe(token);
      
      // 空值
      expect(extractTokenFromHeader(null)).toBeNull();
      expect(extractTokenFromHeader('')).toBeNull();
      
      // 只有Bearer - 修正期望值
      expect(extractTokenFromHeader('Bearer')).toBe('Bearer');
      expect(extractTokenFromHeader('Bearer ')).toBe('');
    });
  });
});
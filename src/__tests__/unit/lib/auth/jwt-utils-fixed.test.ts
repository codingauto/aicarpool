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
  extractTokenFromHeader,
  type JWTPayload,
  type TokenPair
} from '@/lib/auth/jwt-utils';
import { JWTTestFactory } from '@/test-utils/factories/jwt-factory';
import { createPrismaMock, PrismaMockScenarios } from '@/test-utils/mocks/setup-prisma-mock';

// Mock Prisma
const prismaMock = createPrismaMock();
jest.mock('@/lib/prisma', () => ({
  prisma: prismaMock
}));

// Mock validateTokenAndGetUser 和 refreshAccessToken 因为它们依赖数据库
jest.mock('@/lib/auth/jwt-utils', () => {
  const actual = jest.requireActual('@/lib/auth/jwt-utils') as any;
  return {
    ...actual,
    validateTokenAndGetUser: jest.fn(),
    refreshAccessToken: jest.fn()
  };
});

describe('JWT工具函数（改进版）', () => {
  const originalEnv = process.env;
  
  beforeEach(() => {
    jest.clearAllMocks();
    process.env = {
      ...originalEnv,
      JWT_SECRET: 'test-secret-key-for-testing',
      JWT_REFRESH_SECRET: 'test-refresh-secret-for-testing'
    };
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.useRealTimers();
  });

  describe('generateToken', () => {
    it('应该生成有效的JWT令牌', () => {
      const payload = JWTTestFactory.createPayload();
      const token = generateToken(payload);
      
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3);
    });

    it('应该包含所有必要的payload字段', () => {
      const payload = JWTTestFactory.createPayload();
      const token = generateToken(payload);
      const decoded = jwt.decode(token) as any;
      
      expect(decoded.userId).toBe(payload.userId);
      expect(decoded.email).toBe(payload.email);
      expect(decoded.role).toBe(payload.role);
      expect(decoded.iat).toBeDefined();
      expect(decoded.exp).toBeDefined();
    });

    it('应该设置正确的过期时间', () => {
      const expiresIn = '2h';
      const payload = JWTTestFactory.createPayload();
      const token = generateToken(payload, expiresIn);
      const decoded = jwt.decode(token) as any;
      
      const expectedExpiry = decoded.iat + 2 * 60 * 60;
      expect(decoded.exp).toBe(expectedExpiry);
    });

    it('应该处理最小payload', () => {
      const minimalPayload: JWTPayload = {
        userId: 'user-123',
        email: 'test@example.com',
        role: 'user'
      };
      
      const token = generateToken(minimalPayload);
      expect(token).toBeDefined();
      
      const decoded = verifyToken(token);
      expect(decoded?.userId).toBe(minimalPayload.userId);
    });
  });

  describe('verifyToken', () => {
    it('应该成功验证有效令牌', () => {
      const payload = JWTTestFactory.createPayload();
      const token = generateToken(payload);
      const verified = verifyToken(token);
      
      expect(verified).toBeDefined();
      expect(verified?.userId).toBe(payload.userId);
      expect(verified?.email).toBe(payload.email);
    });

    it('应该拒绝过期令牌', () => {
      jest.useFakeTimers();
      const now = Date.now();
      jest.setSystemTime(now);
      
      const payload = JWTTestFactory.createPayload();
      const token = generateToken(payload, '1s');
      
      jest.setSystemTime(now + 2000);
      
      const verified = verifyToken(token);
      expect(verified).toBeNull();
    });

    it('应该拒绝篡改的令牌', () => {
      const payload = JWTTestFactory.createPayload();
      const token = generateToken(payload);
      const tamperedToken = token.slice(0, -5) + 'XXXXX';
      
      const verified = verifyToken(tamperedToken);
      expect(verified).toBeNull();
    });

    it('应该处理无效的令牌格式', () => {
      expect(verifyToken('invalid.token')).toBeNull();
      expect(verifyToken('not-a-jwt')).toBeNull();
      expect(verifyToken('')).toBeNull();
    });
  });

  describe('decodeToken', () => {
    it('应该解码令牌而不验证签名', () => {
      const payload = JWTTestFactory.createPayload();
      const token = generateToken(payload);
      const decoded = decodeToken(token);
      
      expect(decoded).toBeDefined();
      expect(decoded?.userId).toBe(payload.userId);
    });

    it('应该处理无效格式', () => {
      expect(decodeToken('invalid')).toBeNull();
      expect(decodeToken('')).toBeNull();
    });

    it('应该解码过期的令牌', () => {
      jest.useFakeTimers();
      const now = Date.now();
      jest.setSystemTime(now);
      
      const payload = JWTTestFactory.createPayload();
      const token = generateToken(payload, '1s');
      
      jest.setSystemTime(now + 10000);
      
      const decoded = decodeToken(token);
      expect(decoded).toBeDefined();
      expect(decoded?.userId).toBe(payload.userId);
    });
  });

  describe('isTokenExpired', () => {
    it('应该正确判断未过期的令牌', () => {
      const payload = JWTTestFactory.createPayload();
      const token = generateToken(payload, '1h');
      
      expect(isTokenExpired(token)).toBe(false);
    });

    it('应该正确判断已过期的令牌', () => {
      jest.useFakeTimers();
      const now = Date.now();
      jest.setSystemTime(now);
      
      const payload = JWTTestFactory.createPayload();
      const token = generateToken(payload, '1s');
      
      jest.setSystemTime(now + 2000);
      
      expect(isTokenExpired(token)).toBe(true);
    });

    it('应该处理无exp字段的令牌', () => {
      const tokenWithoutExp = jwt.sign(
        { userId: 'test' },
        process.env.JWT_SECRET!,
        { noTimestamp: true }
      );
      
      expect(isTokenExpired(tokenWithoutExp)).toBe(false);
    });

    it('应该处理无效令牌', () => {
      expect(isTokenExpired('invalid.token')).toBe(true);
      expect(isTokenExpired('')).toBe(true);
    });
  });

  describe('refreshToken', () => {
    it('应该刷新有效的令牌', () => {
      jest.useFakeTimers();
      const now = Date.now();
      jest.setSystemTime(now);
      
      const payload = JWTTestFactory.createPayload();
      const originalToken = generateToken(payload);
      
      jest.setSystemTime(now + 1000);
      
      const newToken = refreshToken(originalToken);
      
      expect(newToken).toBeDefined();
      expect(newToken).not.toBe(originalToken);
      
      const decoded = verifyToken(newToken!);
      expect(decoded?.userId).toBe(payload.userId);
    });

    it('应该使用新的时间戳', () => {
      jest.useFakeTimers();
      const now = Date.now();
      jest.setSystemTime(now);
      
      const payload = JWTTestFactory.createPayload();
      const originalToken = generateToken(payload);
      const originalDecoded = decodeToken(originalToken);
      
      jest.setSystemTime(now + 5000);
      
      const newToken = refreshToken(originalToken);
      const newDecoded = decodeToken(newToken!);
      
      expect(newDecoded?.iat).toBeGreaterThan(originalDecoded!.iat!);
      expect(newDecoded?.exp).toBeGreaterThan(originalDecoded!.exp!);
    });

    it('应该拒绝无效的令牌', () => {
      expect(refreshToken('invalid.token')).toBeNull();
      expect(refreshToken('')).toBeNull();
    });
  });

  describe('generateTokenPair', () => {
    it('应该生成访问和刷新令牌对', () => {
      const payload = JWTTestFactory.createPayload();
      const tokenPair = generateTokenPair(payload);
      
      expect(tokenPair).toBeDefined();
      expect(tokenPair.accessToken).toBeDefined();
      expect(tokenPair.refreshToken).toBeDefined();
      expect(tokenPair.accessToken).not.toBe(tokenPair.refreshToken);
    });

    it('刷新令牌应该比访问令牌有效期长', () => {
      const payload = JWTTestFactory.createPayload();
      const tokenPair = generateTokenPair(payload);
      
      const accessDecoded = decodeToken(tokenPair.accessToken);
      const refreshDecoded = decodeToken(tokenPair.refreshToken);
      
      const accessExpiry = accessDecoded!.exp! - accessDecoded!.iat!;
      const refreshExpiry = refreshDecoded!.exp! - refreshDecoded!.iat!;
      
      expect(refreshExpiry).toBeGreaterThan(accessExpiry);
    });

    it('刷新令牌应该包含type字段', () => {
      const payload = JWTTestFactory.createPayload();
      const tokenPair = generateTokenPair(payload);
      
      const refreshDecoded = decodeToken(tokenPair.refreshToken);
      expect(refreshDecoded?.type).toBe('refresh');
    });
  });

  describe('verifyRefreshToken', () => {
    it('应该验证有效的刷新令牌', () => {
      const payload = JWTTestFactory.createPayload();
      const tokenPair = generateTokenPair(payload);
      
      const verified = verifyRefreshToken(tokenPair.refreshToken);
      
      expect(verified).toBeDefined();
      expect(verified?.userId).toBe(payload.userId);
      expect(verified?.type).toBe('refresh');
    });

    it('应该拒绝类型不正确的令牌', () => {
      const payload = JWTTestFactory.createPayload();
      const accessToken = generateToken(payload);
      
      const verified = verifyRefreshToken(accessToken);
      expect(verified).toBeNull();
    });

    it('应该拒绝过期的刷新令牌', () => {
      jest.useFakeTimers();
      const now = Date.now();
      jest.setSystemTime(now);
      
      const payload = { ...JWTTestFactory.createPayload(), type: 'refresh' };
      const refreshToken = jwt.sign(
        payload,
        process.env.JWT_REFRESH_SECRET!,
        { expiresIn: '1s' }
      );
      
      jest.setSystemTime(now + 2000);
      
      const verified = verifyRefreshToken(refreshToken);
      expect(verified).toBeNull();
    });
  });

  describe('extractTokenFromHeader', () => {
    it('应该从Bearer格式提取令牌', () => {
      const token = 'test-token-123';
      const header = `Bearer ${token}`;
      
      expect(extractTokenFromHeader(header)).toBe(token);
    });

    it('应该直接返回非Bearer格式的令牌', () => {
      const token = 'direct-token';
      expect(extractTokenFromHeader(token)).toBe(token);
    });

    it('应该处理null和空字符串', () => {
      expect(extractTokenFromHeader(null as any)).toBe('');
      expect(extractTokenFromHeader('')).toBe('');
      expect(extractTokenFromHeader(undefined as any)).toBe('');
    });

    it('应该处理只有Bearer的情况', () => {
      expect(extractTokenFromHeader('Bearer')).toBe('Bearer');
      expect(extractTokenFromHeader('Bearer ')).toBe('');
    });
  });

  describe('性能测试', () => {
    it('生成令牌应该在10ms内完成', () => {
      const payload = JWTTestFactory.createPayload();
      const startTime = Date.now();
      
      generateToken(payload);
      
      const endTime = Date.now();
      expect(endTime - startTime).toBeLessThan(10);
    });

    it('验证令牌应该在5ms内完成', () => {
      const payload = JWTTestFactory.createPayload();
      const token = generateToken(payload);
      
      const startTime = Date.now();
      
      verifyToken(token);
      
      const endTime = Date.now();
      expect(endTime - startTime).toBeLessThan(5);
    });

    it('应该能处理批量令牌生成', () => {
      const startTime = Date.now();
      
      const tokens = Array(100).fill(null).map((_, i) => {
        const payload = JWTTestFactory.createPayload({ userId: `user-${i}` });
        return generateToken(payload);
      });
      
      const endTime = Date.now();
      
      expect(tokens).toHaveLength(100);
      expect(endTime - startTime).toBeLessThan(100);
    });
  });

  describe('边界条件测试', () => {
    it('应该处理超长payload', () => {
      const longString = 'x'.repeat(1000);
      const payload: JWTPayload = {
        userId: 'user-123',
        email: 'test@example.com',
        role: 'user',
        metadata: longString
      };
      
      const token = generateToken(payload);
      const verified = verifyToken(token);
      
      expect(verified).toBeDefined();
      expect(verified?.metadata).toBe(longString);
    });

    it('应该处理特殊字符', () => {
      const payload: JWTPayload = {
        userId: 'user-123',
        email: 'test+special@example.com',
        role: 'user',
        name: '测试用户 Test User ñoño'
      };
      
      const token = generateToken(payload);
      const verified = verifyToken(token);
      
      expect(verified?.name).toBe(payload.name);
    });

    it('应该处理系统时间变化', () => {
      jest.useFakeTimers();
      const initialTime = Date.now();
      jest.setSystemTime(initialTime);
      
      const payload = JWTTestFactory.createPayload();
      const token = generateToken(payload, '1h');
      
      // 模拟系统时间倒退
      jest.setSystemTime(initialTime - 10000);
      const verified1 = verifyToken(token);
      expect(verified1).toBeDefined();
      
      // 模拟系统时间前进但未过期
      jest.setSystemTime(initialTime + 30 * 60 * 1000);
      const verified2 = verifyToken(token);
      expect(verified2).toBeDefined();
    });
  });
});
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
  validateTokenAndGetUser,
  refreshAccessToken,
  type JWTPayload,
  type TokenPair
} from '@/lib/auth/jwt-utils';
import { JWTTestFactory } from '@/test-utils/factories/jwt-factory';
import { createPrismaMock, PrismaMockScenarios } from '@/test-utils/mocks/setup-prisma-mock';

// 创建Prisma Mock
const prismaMock = createPrismaMock();

// Mock Prisma模块
jest.mock('@/lib/prisma', () => ({
  prisma: prismaMock
}));

describe('JWT工具函数', () => {
  // 设置测试环境变量
  const originalEnv = process.env;
  
  beforeEach(() => {
    jest.clearAllMocks();
    // 设置测试用的密钥
    process.env = {
      ...originalEnv,
      JWT_SECRET: 'test-secret-key-for-testing',
      JWT_REFRESH_SECRET: 'test-refresh-secret-for-testing'
    };
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  describe('generateToken', () => {
    it('应该生成有效的JWT令牌', () => {
      const payload = JWTTestFactory.createPayload();
      const token = generateToken(payload);
      
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      // JWT格式: header.payload.signature
      expect(token.split('.')).toHaveLength(3);
    });

    it('应该包含所有必要的payload字段', () => {
      const payload = JWTTestFactory.createPayload();
      const token = generateToken(payload);
      
      const decoded = jwt.decode(token) as JWTPayload;
      
      expect(decoded.userId).toBe(payload.userId);
      expect(decoded.email).toBe(payload.email);
      expect(decoded.name).toBe(payload.name);
      expect(decoded.role).toBe(payload.role);
      expect(decoded.enterpriseId).toBe(payload.enterpriseId);
    });

    it('应该设置正确的过期时间', () => {
      const payload = JWTTestFactory.createPayload();
      const expiresIn = '2h';
      const token = generateToken(payload, expiresIn);
      
      const decoded = jwt.decode(token) as JWTPayload;
      const now = Math.floor(Date.now() / 1000);
      
      expect(decoded.exp).toBeDefined();
      expect(decoded.iat).toBeDefined();
      // 过期时间应该在2小时后（允许1秒误差）
      expect(decoded.exp! - decoded.iat!).toBeGreaterThanOrEqual(7199);
      expect(decoded.exp! - decoded.iat!).toBeLessThanOrEqual(7201);
    });

    it('应该使用默认过期时间（24小时）', () => {
      const payload = JWTTestFactory.createPayload();
      const token = generateToken(payload);
      
      const decoded = jwt.decode(token) as JWTPayload;
      
      // 默认24小时 = 86400秒
      expect(decoded.exp! - decoded.iat!).toBeGreaterThanOrEqual(86399);
      expect(decoded.exp! - decoded.iat!).toBeLessThanOrEqual(86401);
    });

    it('应该处理最小payload', () => {
      const payload = JWTTestFactory.createMinimalPayload();
      const token = generateToken(payload);
      
      const decoded = jwt.decode(token) as JWTPayload;
      
      expect(decoded.userId).toBe(payload.userId);
      expect(decoded.email).toBe(payload.email);
      expect(decoded.name).toBeUndefined();
      expect(decoded.role).toBeUndefined();
    });

    it('应该处理空对象payload', () => {
      const payload = {} as any;
      const token = generateToken(payload);
      
      expect(token).toBeDefined();
      const decoded = jwt.decode(token) as any;
      expect(decoded.iat).toBeDefined();
      expect(decoded.exp).toBeDefined();
    });
  });

  describe('verifyToken', () => {
    it('应该成功验证有效令牌', () => {
      const payload = JWTTestFactory.createPayload();
      const token = generateToken(payload);
      
      const verified = verifyToken(token);
      
      expect(verified).not.toBeNull();
      expect(verified?.userId).toBe(payload.userId);
      expect(verified?.email).toBe(payload.email);
    });

    it('应该拒绝过期令牌', () => {
      jest.useFakeTimers();
      const payload = JWTTestFactory.createPayload();
      const token = generateToken(payload, '1s'); // 1秒过期
      
      // 快进2秒
      jest.advanceTimersByTime(2000);
      
      const verified = verifyToken(token);
      
      expect(verified).toBeNull();
    });

    it('应该拒绝篡改的令牌', () => {
      const payload = JWTTestFactory.createPayload();
      const token = generateToken(payload);
      
      // 篡改令牌
      const parts = token.split('.');
      parts[1] = Buffer.from(JSON.stringify({ ...payload, userId: 'hacker' })).toString('base64');
      const tamperedToken = parts.join('.');
      
      const verified = verifyToken(tamperedToken);
      
      expect(verified).toBeNull();
    });

    it('应该处理无效的令牌格式', () => {
      const testTokens = JWTTestFactory.getTestTokens();
      
      expect(verifyToken(testTokens.invalidFormat)).toBeNull();
      expect(verifyToken(testTokens.empty)).toBeNull();
      expect(verifyToken(testTokens.headerOnly)).toBeNull();
    });

    it('应该处理错误的签名密钥', () => {
      // 使用错误的密钥生成token
      const payload = JWTTestFactory.createPayload();
      const tokenWithWrongSecret = jwt.sign(payload, 'wrong-secret', { expiresIn: '1h' });
      
      const verified = verifyToken(tokenWithWrongSecret);
      
      expect(verified).toBeNull();
    });

    it('应该处理null和undefined', () => {
      expect(verifyToken(null as any)).toBeNull();
      expect(verifyToken(undefined as any)).toBeNull();
    });
  });

  describe('decodeToken', () => {
    it('应该解码令牌而不验证签名', () => {
      const payload = JWTTestFactory.createPayload();
      const token = jwt.sign(payload, 'any-secret', { expiresIn: '1h' });
      
      const decoded = decodeToken(token);
      
      expect(decoded).not.toBeNull();
      expect(decoded?.userId).toBe(payload.userId);
      expect(decoded?.email).toBe(payload.email);
    });

    it('应该处理无效格式', () => {
      const testTokens = JWTTestFactory.getTestTokens();
      
      expect(decodeToken(testTokens.invalidFormat)).toBeNull();
      expect(decodeToken(testTokens.empty)).toBeNull();
    });

    it('应该解码过期的令牌', () => {
      const payload = JWTTestFactory.createPayload();
      const expiredToken = jwt.sign(
        payload,
        'test-secret',
        { expiresIn: '-1h' } // 已过期
      );
      
      const decoded = decodeToken(expiredToken);
      
      expect(decoded).not.toBeNull();
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
      const payload = JWTTestFactory.createPayload();
      const expiredToken = jwt.sign(
        payload,
        process.env.JWT_SECRET!,
        { expiresIn: '-1h' }
      );
      
      expect(isTokenExpired(expiredToken)).toBe(true);
    });

    it('应该处理无exp字段的令牌', () => {
      const payload = JWTTestFactory.createPayload();
      const tokenWithoutExp = jwt.sign(payload, process.env.JWT_SECRET!);
      
      // 手动创建一个没有exp的token
      const decoded = jwt.decode(tokenWithoutExp) as any;
      delete decoded.exp;
      const modifiedToken = jwt.sign(decoded, process.env.JWT_SECRET!);
      
      expect(isTokenExpired(modifiedToken)).toBe(true);
    });

    it('应该处理无效令牌', () => {
      expect(isTokenExpired('invalid-token')).toBe(true);
      expect(isTokenExpired('')).toBe(true);
      expect(isTokenExpired(null as any)).toBe(true);
    });

    it('应该正确处理刚好过期的边界情况', () => {
      jest.useFakeTimers();
      const now = new Date('2024-01-01T00:00:00Z');
      jest.setSystemTime(now);
      
      const payload = JWTTestFactory.createPayload();
      const token = generateToken(payload, '1s');
      
      // 快进到刚好过期的时间点（1秒 + 1毫秒）
      jest.setSystemTime(new Date(now.getTime() + 1001));
      
      expect(isTokenExpired(token)).toBe(true);
    });
  });

  describe('refreshToken', () => {
    it('应该刷新有效的令牌', () => {
      jest.useFakeTimers();
      const payload = JWTTestFactory.createPayload();
      const originalToken = generateToken(payload);
      
      // 等待一下以确保新token有不同的时间戳
      jest.advanceTimersByTime(1000);
      
      const newToken = refreshToken(originalToken);
      
      expect(newToken).not.toBeNull();
      // 由于时间戳不同，token应该不同
      expect(newToken).not.toBe(originalToken);
      
      const decoded = jwt.decode(newToken!) as JWTPayload;
      expect(decoded.userId).toBe(payload.userId);
      expect(decoded.email).toBe(payload.email);
      
      jest.useRealTimers();
    });

    it('应该使用新的时间戳', () => {
      jest.useFakeTimers();
      const payload = JWTTestFactory.createPayload();
      const originalToken = generateToken(payload);
      
      // 等待1秒
      jest.advanceTimersByTime(1000);
      
      const newToken = refreshToken(originalToken);
      const originalDecoded = jwt.decode(originalToken) as JWTPayload;
      const newDecoded = jwt.decode(newToken!) as JWTPayload;
      
      expect(newDecoded.iat).toBeGreaterThan(originalDecoded.iat!);
    });

    it('应该拒绝无效的令牌', () => {
      const invalidToken = 'invalid.token.here';
      const result = refreshToken(invalidToken);
      
      expect(result).toBeNull();
    });

    it('应该拒绝过期的令牌', () => {
      const payload = JWTTestFactory.createPayload();
      const expiredToken = jwt.sign(
        payload,
        process.env.JWT_SECRET!,
        { expiresIn: '-1h' }
      );
      
      const result = refreshToken(expiredToken);
      
      expect(result).toBeNull();
    });
  });

  describe('generateTokenPair', () => {
    it('应该生成访问和刷新令牌对', () => {
      const payload = JWTTestFactory.createPayload();
      const tokenPair = generateTokenPair(payload);
      
      expect(tokenPair).toHaveProperty('accessToken');
      expect(tokenPair).toHaveProperty('refreshToken');
      expect(tokenPair).toHaveProperty('expiresIn');
      
      expect(typeof tokenPair.accessToken).toBe('string');
      expect(typeof tokenPair.refreshToken).toBe('string');
      expect(tokenPair.expiresIn).toBe(900); // 15分钟
    });

    it('刷新令牌应该比访问令牌有效期长', () => {
      const payload = JWTTestFactory.createPayload();
      const tokenPair = generateTokenPair(payload);
      
      const accessDecoded = jwt.decode(tokenPair.accessToken) as JWTPayload;
      const refreshDecoded = jwt.decode(tokenPair.refreshToken) as any;
      
      const accessExpiry = accessDecoded.exp! - accessDecoded.iat!;
      const refreshExpiry = refreshDecoded.exp - refreshDecoded.iat;
      
      expect(refreshExpiry).toBeGreaterThan(accessExpiry);
    });

    it('刷新令牌应该包含type字段', () => {
      const payload = JWTTestFactory.createPayload();
      const tokenPair = generateTokenPair(payload);
      
      const refreshDecoded = jwt.decode(tokenPair.refreshToken) as any;
      
      expect(refreshDecoded.type).toBe('refresh');
      expect(refreshDecoded.userId).toBe(payload.userId);
    });

    it('访问令牌应该包含完整的用户信息', () => {
      const payload = JWTTestFactory.createPayload();
      const tokenPair = generateTokenPair(payload);
      
      const accessDecoded = jwt.decode(tokenPair.accessToken) as JWTPayload;
      
      expect(accessDecoded.userId).toBe(payload.userId);
      expect(accessDecoded.email).toBe(payload.email);
      expect(accessDecoded.name).toBe(payload.name);
      expect(accessDecoded.role).toBe(payload.role);
      expect(accessDecoded.enterpriseId).toBe(payload.enterpriseId);
    });
  });

  describe('verifyRefreshToken', () => {
    it('应该验证有效的刷新令牌', () => {
      const payload = JWTTestFactory.createPayload();
      const tokenPair = generateTokenPair(payload);
      
      const result = verifyRefreshToken(tokenPair.refreshToken);
      
      expect(result).not.toBeNull();
      expect(result?.userId).toBe(payload.userId);
    });

    it('应该拒绝类型不正确的令牌', () => {
      // 使用普通access token
      const payload = JWTTestFactory.createPayload();
      const accessToken = generateToken(payload);
      
      const result = verifyRefreshToken(accessToken);
      
      expect(result).toBeNull();
    });

    it('应该拒绝使用错误密钥签名的令牌', () => {
      const refreshToken = jwt.sign(
        { userId: 'test-user', type: 'refresh' },
        'wrong-secret',
        { expiresIn: '7d' }
      );
      
      const result = verifyRefreshToken(refreshToken);
      
      expect(result).toBeNull();
    });

    it('应该拒绝过期的刷新令牌', () => {
      const expiredRefreshToken = jwt.sign(
        { userId: 'test-user', type: 'refresh' },
        process.env.JWT_REFRESH_SECRET!,
        { expiresIn: '-1h' }
      );
      
      const result = verifyRefreshToken(expiredRefreshToken);
      
      expect(result).toBeNull();
    });

    it('应该处理无效格式', () => {
      expect(verifyRefreshToken('invalid.token')).toBeNull();
      expect(verifyRefreshToken('')).toBeNull();
      expect(verifyRefreshToken(null as any)).toBeNull();
    });
  });

  describe('extractTokenFromHeader', () => {
    it('应该从Bearer格式提取令牌', () => {
      const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.payload.signature';
      const header = `Bearer ${token}`;
      
      const extracted = extractTokenFromHeader(header);
      
      expect(extracted).toBe(token);
    });

    it('应该直接返回非Bearer格式的令牌', () => {
      const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.payload.signature';
      
      const extracted = extractTokenFromHeader(token);
      
      expect(extracted).toBe(token);
    });

    it('应该处理null和空字符串', () => {
      expect(extractTokenFromHeader(null)).toBeNull();
      expect(extractTokenFromHeader('')).toBeNull(); // 空字符串返回null
    });

    it('应该处理只有Bearer的情况', () => {
      const result = extractTokenFromHeader('Bearer ');
      expect(result).toBe('');
    });

    it('应该处理大小写变化', () => {
      const token = 'test-token';
      
      // 标准格式应该是 "Bearer"，但测试其他情况
      expect(extractTokenFromHeader(`Bearer ${token}`)).toBe(token);
      expect(extractTokenFromHeader(`bearer ${token}`)).toBe(`bearer ${token}`); // 不匹配，原样返回
      expect(extractTokenFromHeader(`BEARER ${token}`)).toBe(`BEARER ${token}`); // 不匹配，原样返回
    });
  });

  describe('validateTokenAndGetUser', () => {
    it('应该验证令牌并返回用户信息', async () => {
      const mockUser = JWTTestFactory.createMockUser();
      prismaMock.user.findUnique.mockResolvedValue(mockUser);
      
      const payload = JWTTestFactory.createPayload();
      const token = generateToken(payload);
      
      const result = await validateTokenAndGetUser(token);
      
      expect(result).toEqual({
        id: mockUser.id,
        email: mockUser.email,
        name: mockUser.name,
        role: payload.role,
        enterpriseId: payload.enterpriseId
      });
      
      expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
        where: { id: payload.userId },
        select: {
          id: true,
          email: true,
          name: true,
          status: true
        }
      });
    });

    it('应该拒绝无效的令牌', async () => {
      const invalidToken = 'invalid.token.here';
      
      await expect(validateTokenAndGetUser(invalidToken)).rejects.toThrow('Token无效');
      
      expect(prismaMock.user.findUnique).not.toHaveBeenCalled();
    });

    it('应该拒绝用户不存在的情况', async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);
      
      const payload = JWTTestFactory.createPayload();
      const token = generateToken(payload);
      
      await expect(validateTokenAndGetUser(token)).rejects.toThrow('用户不存在');
    });

    it('应该拒绝被禁用的用户', async () => {
      const inactiveUser = JWTTestFactory.createMockUser({ status: 'inactive' });
      prismaMock.user.findUnique.mockResolvedValue(inactiveUser);
      
      const payload = JWTTestFactory.createPayload();
      const token = generateToken(payload);
      
      await expect(validateTokenAndGetUser(token)).rejects.toThrow('用户账号已被禁用');
    });

    it('应该处理用户名为null的情况', async () => {
      const userWithoutName = JWTTestFactory.createMockUser({ name: null });
      prismaMock.user.findUnique.mockResolvedValue(userWithoutName);
      
      const payload = JWTTestFactory.createPayload();
      const token = generateToken(payload);
      
      const result = await validateTokenAndGetUser(token);
      
      expect(result.name).toBe('未知用户');
    });
  });

  describe('refreshAccessToken', () => {
    it('应该使用刷新令牌生成新的令牌对', async () => {
      const mockUser = JWTTestFactory.createMockUser();
      const mockUserEnterprise = JWTTestFactory.createMockUserEnterprise();
      
      prismaMock.user.findUnique.mockResolvedValue(mockUser);
      prismaMock.userEnterprise.findFirst.mockResolvedValue(mockUserEnterprise);
      
      const payload = JWTTestFactory.createPayload();
      const tokenPair = generateTokenPair(payload);
      
      const newTokenPair = await refreshAccessToken(tokenPair.refreshToken);
      
      expect(newTokenPair).toHaveProperty('accessToken');
      expect(newTokenPair).toHaveProperty('refreshToken');
      expect(newTokenPair).toHaveProperty('expiresIn');
      
      // 验证新的访问令牌包含正确的用户信息
      const decoded = jwt.decode(newTokenPair.accessToken) as JWTPayload;
      expect(decoded.userId).toBe(mockUser.id);
      expect(decoded.email).toBe(mockUser.email);
    });

    it('应该拒绝无效的刷新令牌', async () => {
      const invalidRefreshToken = 'invalid.refresh.token';
      
      await expect(refreshAccessToken(invalidRefreshToken)).rejects.toThrow('Token刷新失败');
      
      expect(prismaMock.user.findUnique).not.toHaveBeenCalled();
    });

    it('应该拒绝用户不存在的情况', async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);
      
      const payload = JWTTestFactory.createPayload();
      const tokenPair = generateTokenPair(payload);
      
      await expect(refreshAccessToken(tokenPair.refreshToken)).rejects.toThrow('用户不存在或已被禁用');
    });

    it('应该拒绝被禁用的用户', async () => {
      const inactiveUser = JWTTestFactory.createMockUser({ status: 'inactive' });
      prismaMock.user.findUnique.mockResolvedValue(inactiveUser);
      
      const payload = JWTTestFactory.createPayload();
      const tokenPair = generateTokenPair(payload);
      
      await expect(refreshAccessToken(tokenPair.refreshToken)).rejects.toThrow('用户不存在或已被禁用');
    });

    it('应该处理用户没有企业关联的情况', async () => {
      const mockUser = JWTTestFactory.createMockUser();
      prismaMock.user.findUnique.mockResolvedValue(mockUser);
      prismaMock.userEnterprise.findFirst.mockResolvedValue(null);
      
      const payload = JWTTestFactory.createPayload();
      const tokenPair = generateTokenPair(payload);
      
      const newTokenPair = await refreshAccessToken(tokenPair.refreshToken);
      
      const decoded = jwt.decode(newTokenPair.accessToken) as JWTPayload;
      expect(decoded.role).toBeUndefined();
      expect(decoded.enterpriseId).toBeUndefined();
    });
  });

  describe('性能测试', () => {
    it('生成令牌应该在10ms内完成', () => {
      const payload = JWTTestFactory.createPayload();
      
      const start = Date.now();
      generateToken(payload);
      const end = Date.now();
      
      expect(end - start).toBeLessThan(10);
    });

    it('验证令牌应该在5ms内完成', () => {
      const payload = JWTTestFactory.createPayload();
      const token = generateToken(payload);
      
      const start = Date.now();
      verifyToken(token);
      const end = Date.now();
      
      expect(end - start).toBeLessThan(5);
    });

    it('应该能处理批量令牌生成', () => {
      const payload = JWTTestFactory.createPayload();
      
      const start = Date.now();
      const tokens: string[] = [];
      
      for (let i = 0; i < 100; i++) {
        tokens.push(generateToken({ ...payload, userId: `user-${i}` }));
      }
      
      const end = Date.now();
      
      expect(tokens).toHaveLength(100);
      expect(end - start).toBeLessThan(100); // 100个令牌应该在100ms内生成
    });

    it('应该能处理并发验证', async () => {
      const payload = JWTTestFactory.createPayload();
      const tokens = Array(50).fill(null).map((_, i) => 
        generateToken({ ...payload, userId: `user-${i}` })
      );
      
      const start = Date.now();
      const promises = tokens.map(token => 
        new Promise(resolve => resolve(verifyToken(token)))
      );
      
      const results = await Promise.all(promises);
      const end = Date.now();
      
      expect(results).toHaveLength(50);
      expect(results.every(r => r !== null)).toBe(true);
      expect(end - start).toBeLessThan(50); // 50个并发验证应该在50ms内完成
    });
  });

  describe('边界条件测试', () => {
    it('应该处理超长payload', () => {
      const longString = 'a'.repeat(1000);
      const payload = JWTTestFactory.createPayload({
        name: longString,
        role: longString
      });
      
      const token = generateToken(payload);
      const decoded = verifyToken(token);
      
      expect(decoded).not.toBeNull();
      expect(decoded?.name).toBe(longString);
    });

    it('应该处理特殊字符', () => {
      const specialChars = '!@#$%^&*()_+-=[]{}|;\':",./<>?`~';
      const payload = JWTTestFactory.createPayload({
        name: specialChars,
        email: 'test+special@example.com'
      });
      
      const token = generateToken(payload);
      const decoded = verifyToken(token);
      
      expect(decoded).not.toBeNull();
      expect(decoded?.name).toBe(specialChars);
    });

    it('应该处理Unicode字符', () => {
      const unicodePayload = JWTTestFactory.createPayload({
        name: '测试用户👨‍💻',
        role: '管理员🔐'
      });
      
      const token = generateToken(unicodePayload);
      const decoded = verifyToken(token);
      
      expect(decoded).not.toBeNull();
      expect(decoded?.name).toBe('测试用户👨‍💻');
      expect(decoded?.role).toBe('管理员🔐');
    });

    it('应该处理时间边界（刚好过期）', () => {
      jest.useFakeTimers();
      const now = Date.now();
      jest.setSystemTime(now);
      
      const payload = JWTTestFactory.createPayload();
      const token = generateToken(payload, '2s'); // 2秒过期
      
      // 前进1999ms - 还未过期
      jest.setSystemTime(now + 1999);
      expect(verifyToken(token)).not.toBeNull();
      
      // 再前进2ms - 确保过期
      jest.setSystemTime(now + 2001);
      expect(verifyToken(token)).toBeNull();
    });

    it('应该处理系统时间变化', () => {
      jest.useFakeTimers();
      const payload = JWTTestFactory.createPayload();
      
      // 设置当前时间
      const now = new Date('2024-01-01T00:00:00Z');
      jest.setSystemTime(now);
      
      const token = generateToken(payload, '1h');
      
      // 系统时间往回调（模拟时间同步问题）
      jest.setSystemTime(new Date('2023-12-31T23:00:00Z'));
      
      // 令牌应该仍然有效（因为是基于令牌中的时间戳）
      const decoded = verifyToken(token);
      expect(decoded).not.toBeNull();
    });
  });
});
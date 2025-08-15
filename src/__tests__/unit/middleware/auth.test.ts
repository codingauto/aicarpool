import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { NextRequest, NextResponse } from 'next/server';
import { createPrismaMock } from '@/test-utils/mocks/setup-prisma-mock';

// 创建Prisma Mock
const prismaMock = createPrismaMock();

// Mock Prisma模块
jest.mock('@/lib/prisma', () => ({
  prisma: prismaMock
}));

// Mock JWT工具
const mockedVerifyToken = jest.fn();
const mockedExtractToken = jest.fn();

jest.mock('@/lib/auth/jwt-utils', () => ({
  verifyToken: mockedVerifyToken,
  extractTokenFromHeader: mockedExtractToken
}));

// 简化的认证中间件实现（用于测试）
class AuthMiddleware {
  async authenticate(request: NextRequest): Promise<{ user: any } | { error: string }> {
    try {
      // 从请求头获取令牌
      const authHeader = request.headers.get('authorization');
      if (!authHeader) {
        return { error: 'No authorization header' };
      }

      // 提取令牌
      const token = mockedExtractToken(authHeader);
      if (!token) {
        return { error: 'Invalid token format' };
      }

      // 验证令牌
      const payload = mockedVerifyToken(token);
      if (!payload) {
        return { error: 'Invalid or expired token' };
      }

      // 获取用户信息
      const user = await prismaMock.user.findUnique({
        where: { id: payload.userId },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          status: true
        }
      });

      if (!user) {
        return { error: 'User not found' };
      }

      if (user.status !== 'active') {
        return { error: 'User account is inactive' };
      }

      return { user };
    } catch (error) {
      return { error: 'Authentication failed' };
    }
  }

  async requireAuth(request: NextRequest, requiredRole?: string): Promise<NextResponse | null> {
    const result = await this.authenticate(request);
    
    if ('error' in result) {
      return NextResponse.json(
        { error: result.error },
        { status: 401 }
      );
    }

    if (requiredRole && result.user.role !== requiredRole) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    return null; // 认证成功，继续处理
  }
}

describe('认证中间件', () => {
  let authMiddleware: AuthMiddleware;

  beforeEach(() => {
    jest.clearAllMocks();
    authMiddleware = new AuthMiddleware();
  });

  describe('authenticate', () => {
    it('应该成功认证有效的令牌', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        role: 'user',
        status: 'active'
      };

      const request = new NextRequest('http://localhost/api/test', {
        headers: {
          'authorization': 'Bearer valid-token'
        }
      });

      mockedExtractToken.mockReturnValue('valid-token');
      mockedVerifyToken.mockReturnValue({
        userId: 'user-123',
        email: 'test@example.com',
        role: 'user',
        iat: Date.now(),
        exp: Date.now() + 3600000
      });
      prismaMock.user.findUnique.mockResolvedValue(mockUser);

      const result = await authMiddleware.authenticate(request);

      expect('user' in result).toBe(true);
      if ('user' in result) {
        expect(result.user).toEqual(mockUser);
      }
    });

    it('应该拒绝没有授权头的请求', async () => {
      const request = new NextRequest('http://localhost/api/test');

      const result = await authMiddleware.authenticate(request);

      expect('error' in result).toBe(true);
      if ('error' in result) {
        expect(result.error).toBe('No authorization header');
      }
    });

    it('应该拒绝无效的令牌格式', async () => {
      const request = new NextRequest('http://localhost/api/test', {
        headers: {
          'authorization': 'InvalidFormat'
        }
      });

      mockedExtractToken.mockReturnValue('');

      const result = await authMiddleware.authenticate(request);

      expect('error' in result).toBe(true);
      if ('error' in result) {
        expect(result.error).toBe('Invalid token format');
      }
    });

    it('应该拒绝过期的令牌', async () => {
      const request = new NextRequest('http://localhost/api/test', {
        headers: {
          'authorization': 'Bearer expired-token'
        }
      });

      mockedExtractToken.mockReturnValue('expired-token');
      mockedVerifyToken.mockReturnValue(null);

      const result = await authMiddleware.authenticate(request);

      expect('error' in result).toBe(true);
      if ('error' in result) {
        expect(result.error).toBe('Invalid or expired token');
      }
    });

    it('应该拒绝用户不存在的情况', async () => {
      const request = new NextRequest('http://localhost/api/test', {
        headers: {
          'authorization': 'Bearer valid-token'
        }
      });

      mockedExtractToken.mockReturnValue('valid-token');
      mockedVerifyToken.mockReturnValue({
        userId: 'user-999',
        email: 'ghost@example.com',
        role: 'user',
        iat: Date.now(),
        exp: Date.now() + 3600000
      });
      prismaMock.user.findUnique.mockResolvedValue(null);

      const result = await authMiddleware.authenticate(request);

      expect('error' in result).toBe(true);
      if ('error' in result) {
        expect(result.error).toBe('User not found');
      }
    });

    it('应该拒绝被禁用的用户', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        role: 'user',
        status: 'inactive'
      };

      const request = new NextRequest('http://localhost/api/test', {
        headers: {
          'authorization': 'Bearer valid-token'
        }
      });

      mockedExtractToken.mockReturnValue('valid-token');
      mockedVerifyToken.mockReturnValue({
        userId: 'user-123',
        email: 'test@example.com',
        role: 'user',
        iat: Date.now(),
        exp: Date.now() + 3600000
      });
      prismaMock.user.findUnique.mockResolvedValue(mockUser);

      const result = await authMiddleware.authenticate(request);

      expect('error' in result).toBe(true);
      if ('error' in result) {
        expect(result.error).toBe('User account is inactive');
      }
    });
  });

  describe('requireAuth', () => {
    it('应该允许认证成功的请求通过', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        role: 'user',
        status: 'active'
      };

      const request = new NextRequest('http://localhost/api/test', {
        headers: {
          'authorization': 'Bearer valid-token'
        }
      });

      mockedExtractToken.mockReturnValue('valid-token');
      mockedVerifyToken.mockReturnValue({
        userId: 'user-123',
        email: 'test@example.com',
        role: 'user',
        iat: Date.now(),
        exp: Date.now() + 3600000
      });
      prismaMock.user.findUnique.mockResolvedValue(mockUser);

      const response = await authMiddleware.requireAuth(request);

      expect(response).toBeNull(); // 认证成功，继续处理
    });

    it('应该返回401对于未认证的请求', async () => {
      const request = new NextRequest('http://localhost/api/test');

      const response = await authMiddleware.requireAuth(request);

      expect(response).not.toBeNull();
      expect(response?.status).toBe(401);
    });

    it('应该检查角色权限', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        role: 'user',
        status: 'active'
      };

      const request = new NextRequest('http://localhost/api/test', {
        headers: {
          'authorization': 'Bearer valid-token'
        }
      });

      mockedExtractToken.mockReturnValue('valid-token');
      mockedVerifyToken.mockReturnValue({
        userId: 'user-123',
        email: 'test@example.com',
        role: 'user',
        iat: Date.now(),
        exp: Date.now() + 3600000
      });
      prismaMock.user.findUnique.mockResolvedValue(mockUser);

      const response = await authMiddleware.requireAuth(request, 'admin');

      expect(response).not.toBeNull();
      expect(response?.status).toBe(403); // 权限不足
    });

    it('应该允许正确角色的用户访问', async () => {
      const mockUser = {
        id: 'admin-123',
        email: 'admin@example.com',
        name: 'Admin User',
        role: 'admin',
        status: 'active'
      };

      const request = new NextRequest('http://localhost/api/test', {
        headers: {
          'authorization': 'Bearer admin-token'
        }
      });

      mockedExtractToken.mockReturnValue('admin-token');
      mockedVerifyToken.mockReturnValue({
        userId: 'admin-123',
        email: 'admin@example.com',
        role: 'admin',
        iat: Date.now(),
        exp: Date.now() + 3600000
      });
      prismaMock.user.findUnique.mockResolvedValue(mockUser);

      const response = await authMiddleware.requireAuth(request, 'admin');

      expect(response).toBeNull(); // 认证和授权成功
    });
  });

  describe('性能测试', () => {
    it('认证应该在合理时间内完成', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        role: 'user',
        status: 'active'
      };

      const request = new NextRequest('http://localhost/api/test', {
        headers: {
          'authorization': 'Bearer valid-token'
        }
      });

      mockedExtractToken.mockReturnValue('valid-token');
      mockedVerifyToken.mockReturnValue({
        userId: 'user-123',
        email: 'test@example.com',
        role: 'user',
        iat: Date.now(),
        exp: Date.now() + 3600000
      });
      prismaMock.user.findUnique.mockResolvedValue(mockUser);

      const startTime = Date.now();
      await authMiddleware.authenticate(request);
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(50); // 应该在50ms内完成
    });

    it('应该能处理并发认证请求', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        role: 'user',
        status: 'active'
      };

      mockedExtractToken.mockReturnValue('valid-token');
      mockedVerifyToken.mockReturnValue({
        userId: 'user-123',
        email: 'test@example.com',
        role: 'user',
        iat: Date.now(),
        exp: Date.now() + 3600000
      });
      prismaMock.user.findUnique.mockResolvedValue(mockUser);

      const requests = Array(10).fill(null).map(() => 
        new NextRequest('http://localhost/api/test', {
          headers: {
            'authorization': 'Bearer valid-token'
          }
        })
      );

      const promises = requests.map(req => authMiddleware.authenticate(req));
      const results = await Promise.all(promises);

      expect(results).toHaveLength(10);
      results.forEach(result => {
        expect('user' in result).toBe(true);
      });
    });
  });
});
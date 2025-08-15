import { JWTPayload } from '@/lib/auth/jwt-utils';

/**
 * JWT测试数据工厂
 */
export class JWTTestFactory {
  /**
   * 创建基础payload
   */
  static createPayload(overrides: Partial<JWTPayload> = {}): Omit<JWTPayload, 'iat' | 'exp'> {
    return {
      userId: 'test-user-123',
      email: 'test@example.com',
      name: 'Test User',
      role: 'user',
      enterpriseId: 'test-enterprise-456',
      ...overrides
    };
  }

  /**
   * 创建管理员payload
   */
  static createAdminPayload(overrides: Partial<JWTPayload> = {}): Omit<JWTPayload, 'iat' | 'exp'> {
    return {
      userId: 'admin-user-789',
      email: 'admin@example.com',
      name: 'Admin User',
      role: 'admin',
      enterpriseId: 'admin-enterprise-999',
      ...overrides
    };
  }

  /**
   * 创建最小payload（只包含必需字段）
   */
  static createMinimalPayload(): Omit<JWTPayload, 'iat' | 'exp'> {
    return {
      userId: 'minimal-user-001',
      email: 'minimal@example.com'
    };
  }

  /**
   * 创建测试用户数据
   */
  static createMockUser(overrides: any = {}) {
    return {
      id: 'test-user-123',
      email: 'test@example.com',
      name: 'Test User',
      status: 'active',
      ...overrides
    };
  }

  /**
   * 创建测试企业成员数据
   */
  static createMockUserEnterprise(overrides: any = {}) {
    return {
      userId: 'test-user-123',
      enterpriseId: 'test-enterprise-456',
      role: 'member',
      isActive: true,
      joinedAt: new Date(),
      ...overrides
    };
  }

  /**
   * 创建各种测试令牌
   */
  static getTestTokens() {
    return {
      // 有效的JWT格式（用于格式测试，不验证签名）
      validFormat: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIxMjMiLCJlbWFpbCI6InRlc3RAZXhhbXBsZS5jb20ifQ.signature',
      
      // 无效格式
      invalidFormat: 'not.a.jwt',
      
      // 空字符串
      empty: '',
      
      // 只有header
      headerOnly: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9',
      
      // Bearer格式
      bearerToken: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIxMjMifQ.signature',
      
      // 超长token（模拟大payload）
      longToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.' + 'a'.repeat(5000) + '.signature'
    };
  }

  /**
   * 创建过期时间测试数据
   */
  static getExpirationTestCases() {
    const now = Math.floor(Date.now() / 1000);
    
    return {
      expired: now - 3600,        // 1小时前过期
      almostExpired: now + 30,    // 30秒后过期
      valid: now + 3600,          // 1小时后过期
      farFuture: now + 86400 * 365 // 1年后过期
    };
  }
}
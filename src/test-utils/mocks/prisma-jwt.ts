import { JWTTestFactory } from '../factories/jwt-factory';

/**
 * Prisma JWT相关Mock设置
 */
export const setupPrismaJWTMocks = () => {
  const mockUser = jest.fn();
  const mockUserEnterprise = jest.fn();

  // 默认Mock实现
  mockUser.mockImplementation(() => ({
    findUnique: jest.fn().mockResolvedValue(JWTTestFactory.createMockUser()),
    findFirst: jest.fn().mockResolvedValue(JWTTestFactory.createMockUser()),
    create: jest.fn().mockResolvedValue(JWTTestFactory.createMockUser()),
    update: jest.fn().mockResolvedValue(JWTTestFactory.createMockUser())
  }));

  mockUserEnterprise.mockImplementation(() => ({
    findFirst: jest.fn().mockResolvedValue(JWTTestFactory.createMockUserEnterprise()),
    findMany: jest.fn().mockResolvedValue([JWTTestFactory.createMockUserEnterprise()]),
    create: jest.fn().mockResolvedValue(JWTTestFactory.createMockUserEnterprise())
  }));

  return {
    user: mockUser(),
    userEnterprise: mockUserEnterprise()
  };
};

/**
 * 创建Prisma Mock实例
 */
export const createPrismaMock = () => {
  const mocks = setupPrismaJWTMocks();
  
  return {
    user: mocks.user,
    userEnterprise: mocks.userEnterprise,
    
    // 添加其他可能需要的模型
    tokenBlacklist: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn()
    },
    
    // 事务支持
    $transaction: jest.fn((callback) => callback(this)),
    $disconnect: jest.fn()
  };
};
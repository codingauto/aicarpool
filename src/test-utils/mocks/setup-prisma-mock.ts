/**
 * Prisma Mock 设置工具
 * 用于在测试中正确设置 Prisma 客户端的 Mock
 */

import { jest } from '@jest/globals';

/**
 * 创建一个完整的 Prisma Mock 对象
 */
export function createPrismaMock() {
  return {
    user: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
      aggregate: jest.fn(),
      groupBy: jest.fn()
    },
    userEnterprise: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn()
    },
    enterprise: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn()
    },
    carpoolGroup: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn()
    },
    carpoolGroupMember: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn()
    },
    aiAccount: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      updateMany: jest.fn()
    },
    aiUsageLog: {
      create: jest.fn(),
      createMany: jest.fn(),
      findMany: jest.fn(),
      aggregate: jest.fn(),
      groupBy: jest.fn()
    },
    $connect: jest.fn().mockResolvedValue(undefined),
    $disconnect: jest.fn().mockResolvedValue(undefined),
    $executeRaw: jest.fn(),
    $queryRaw: jest.fn(),
    $transaction: jest.fn()
  };
}

/**
 * 设置 Prisma Mock 的辅助函数
 */
export function setupPrismaMocks() {
  const prismaMock = createPrismaMock();
  
  // 清理所有 Mock
  const clearAllMocks = () => {
    Object.values(prismaMock).forEach(model => {
      if (typeof model === 'object' && model !== null) {
        Object.values(model).forEach(method => {
          if (typeof method === 'function' && 'mockClear' in method) {
            (method as any).mockClear();
          }
        });
      }
    });
  };
  
  return {
    prismaMock,
    clearAllMocks
  };
}

/**
 * 类型安全的 Mock 设置辅助函数
 */
export function mockPrismaMethod<T>(
  mockObject: any,
  methodName: string,
  implementation: () => T | Promise<T>
) {
  if (mockObject && mockObject[methodName] && typeof mockObject[methodName].mockImplementation === 'function') {
    mockObject[methodName].mockImplementation(implementation);
  } else {
    throw new Error(`Cannot mock ${methodName} - method not found or not a mock function`);
  }
}

/**
 * 快速设置常见的 Mock 场景
 */
export const PrismaMockScenarios = {
  // 用户存在且活跃
  userActive: (prismaMock: any, userData: any) => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: userData.id || 'user-123',
      email: userData.email || 'test@example.com',
      name: userData.name || 'Test User',
      status: 'active',
      role: userData.role || 'user',
      ...userData
    });
  },
  
  // 用户不存在
  userNotFound: (prismaMock: any) => {
    prismaMock.user.findUnique.mockResolvedValue(null);
    prismaMock.user.findFirst.mockResolvedValue(null);
  },
  
  // 用户被禁用
  userInactive: (prismaMock: any, userData: any) => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: userData.id || 'user-123',
      email: userData.email || 'test@example.com',
      name: userData.name || 'Test User',
      status: 'inactive',
      role: userData.role || 'user',
      ...userData
    });
  },
  
  // 企业关联存在
  enterpriseAssociation: (prismaMock: any, associationData: any) => {
    prismaMock.userEnterprise.findFirst.mockResolvedValue({
      userId: associationData.userId || 'user-123',
      enterpriseId: associationData.enterpriseId || 'enterprise-456',
      role: associationData.role || 'member',
      joinedAt: associationData.joinedAt || new Date(),
      ...associationData
    });
  },
  
  // 拼车组成员
  carpoolGroupMember: (prismaMock: any, memberData: any) => {
    prismaMock.carpoolGroupMember.findFirst.mockResolvedValue({
      userId: memberData.userId || 'user-123',
      groupId: memberData.groupId || 'group-789',
      role: memberData.role || 'member',
      joinedAt: memberData.joinedAt || new Date(),
      ...memberData
    });
  }
};

export default {
  createPrismaMock,
  setupPrismaMocks,
  mockPrismaMethod,
  PrismaMockScenarios
};
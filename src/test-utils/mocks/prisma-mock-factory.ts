import { jest } from '@jest/globals';
import type { PrismaClient } from '@prisma/client';

/**
 * Prisma Mock工厂 - 创建完整的Prisma客户端Mock
 */

type DeepMockProxy<T> = {
  [K in keyof T]: T[K] extends (...args: any[]) => any
    ? jest.MockedFunction<T[K]>
    : T[K] extends object
    ? DeepMockProxy<T[K]>
    : T[K];
};

/**
 * 创建Prisma模型的通用Mock
 */
function createModelMock() {
  return {
    findUnique: jest.fn(),
    findUniqueOrThrow: jest.fn(),
    findFirst: jest.fn(),
    findFirstOrThrow: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    createMany: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    upsert: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
    count: jest.fn(),
    aggregate: jest.fn(),
    groupBy: jest.fn()
  };
}

/**
 * 创建完整的Prisma Mock
 */
export function createPrismaMock(): DeepMockProxy<PrismaClient> {
  const mock: any = {
    // 事务支持
    $transaction: jest.fn((callback) => {
      if (typeof callback === 'function') {
        return callback(mock);
      }
      return Promise.all(callback);
    }),
    $connect: jest.fn(),
    $disconnect: jest.fn(),
    $use: jest.fn(),
    $on: jest.fn(),
    $executeRaw: jest.fn(),
    $executeRawUnsafe: jest.fn(),
    $queryRaw: jest.fn(),
    $queryRawUnsafe: jest.fn(),

    // 用户相关模型
    user: createModelMock(),
    userProfile: createModelMock(),
    
    // 企业相关模型
    enterprise: createModelMock(),
    userEnterprise: createModelMock(),
    userEnterpriseRole: createModelMock(),
    
    // 拼车组相关模型
    carpoolGroup: createModelMock(),
    groupMember: createModelMock(),
    groupResourceBinding: createModelMock(),
    
    // AI服务相关模型
    aiServiceAccount: createModelMock(),
    aiAccountAssignment: createModelMock(),
    
    // 使用记录相关
    usageLog: createModelMock(),
    auditLog: createModelMock(),
    
    // 通知相关
    notification: createModelMock(),
    
    // 令牌黑名单
    tokenBlacklist: createModelMock()
  };

  return mock as DeepMockProxy<PrismaClient>;
}

/**
 * 创建预设的Prisma Mock场景
 */
export class PrismaMockScenarios {
  private mock: DeepMockProxy<PrismaClient>;

  constructor(mock: DeepMockProxy<PrismaClient>) {
    this.mock = mock;
  }

  /**
   * 设置用户认证场景
   */
  setupAuthScenario(userId: string = 'user-123') {
    const user = {
      id: userId,
      email: 'test@example.com',
      name: 'Test User',
      password: '$2b$10$hashedpassword',
      status: 'active',
      role: 'user',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    (this.mock.user.findUnique as jest.Mock).mockResolvedValue(user);
    (this.mock.user.findFirst as jest.Mock).mockResolvedValue(user);
    
    return user;
  }

  /**
   * 设置企业成员场景
   */
  setupEnterpriseScenario(
    userId: string = 'user-123',
    enterpriseId: string = 'enterprise-456',
    role: string = 'member'
  ) {
    const userEnterprise = {
      id: 'ue-001',
      userId,
      enterpriseId,
      role,
      isActive: true,
      joinedAt: new Date()
    };

    const enterprise = {
      id: enterpriseId,
      name: 'Test Enterprise',
      description: 'Test enterprise description',
      ownerId: 'owner-789',
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    (this.mock.userEnterprise.findFirst as jest.Mock).mockResolvedValue(userEnterprise);
    (this.mock.userEnterprise.findMany as jest.Mock).mockResolvedValue([userEnterprise]);
    (this.mock.enterprise.findUnique as jest.Mock).mockResolvedValue(enterprise);
    
    return { userEnterprise, enterprise };
  }

  /**
   * 设置拼车组场景
   */
  setupCarpoolGroupScenario(
    groupId: string = 'group-789',
    enterpriseId: string = 'enterprise-456'
  ) {
    const group = {
      id: groupId,
      name: 'Test Group',
      description: 'Test group description',
      enterpriseId,
      resourceBindingMode: 'shared',
      maxMembers: 10,
      currentMembers: 5,
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const members = [
      {
        id: 'gm-001',
        groupId,
        userId: 'user-123',
        role: 'member',
        joinedAt: new Date()
      },
      {
        id: 'gm-002',
        groupId,
        userId: 'user-456',
        role: 'owner',
        joinedAt: new Date()
      }
    ];

    (this.mock.carpoolGroup.findUnique as jest.Mock).mockResolvedValue(group);
    (this.mock.carpoolGroup.findFirst as jest.Mock).mockResolvedValue(group);
    (this.mock.groupMember.findMany as jest.Mock).mockResolvedValue(members);
    (this.mock.groupMember.findFirst as jest.Mock).mockResolvedValue(members[0]);
    
    return { group, members };
  }

  /**
   * 设置AI服务账户场景
   */
  setupAiServiceAccountScenario() {
    const accounts = [
      {
        id: 'account-001',
        name: 'Claude Account',
        serviceType: 'claude',
        authType: 'api_key',
        status: 'active',
        isEnabled: true,
        currentLoad: 2,
        maxConcurrent: 5,
        supportedModels: ['claude-3-opus', 'claude-3-sonnet'],
        enterpriseId: 'enterprise-456',
        totalRequests: BigInt(100),
        totalTokens: BigInt(50000),
        totalCost: 10.5,
        lastUsedAt: new Date()
      },
      {
        id: 'account-002',
        name: 'GPT Account',
        serviceType: 'openai',
        authType: 'api_key',
        status: 'active',
        isEnabled: true,
        currentLoad: 1,
        maxConcurrent: 3,
        supportedModels: ['gpt-4', 'gpt-3.5-turbo'],
        enterpriseId: 'enterprise-456',
        totalRequests: BigInt(50),
        totalTokens: BigInt(25000),
        totalCost: 5.0,
        lastUsedAt: new Date()
      }
    ];

    (this.mock.aiServiceAccount.findMany as jest.Mock).mockResolvedValue(accounts);
    (this.mock.aiServiceAccount.findFirst as jest.Mock).mockResolvedValue(accounts[0]);
    (this.mock.aiServiceAccount.findUnique as jest.Mock).mockImplementation(({ where }) => {
      return accounts.find(a => a.id === where.id) || null;
    });
    
    return accounts;
  }

  /**
   * 设置权限场景
   */
  setupPermissionScenario(
    userId: string = 'user-123',
    permissions: string[] = []
  ) {
    const userRoles = permissions.map((permission, index) => ({
      id: `role-${index}`,
      userId,
      role: permission,
      scope: 'global',
      isActive: true,
      createdAt: new Date()
    }));

    (this.mock.userEnterpriseRole.findMany as jest.Mock).mockResolvedValue(userRoles);
    
    return userRoles;
  }

  /**
   * 设置使用记录场景
   */
  setupUsageLogScenario() {
    const logs = [
      {
        id: 'log-001',
        userId: 'user-123',
        groupId: 'group-789',
        accountId: 'account-001',
        model: 'claude-3-opus',
        promptTokens: 100,
        completionTokens: 200,
        totalTokens: 300,
        cost: 0.03,
        createdAt: new Date()
      }
    ];

    (this.mock.usageLog.findMany as jest.Mock).mockResolvedValue(logs);
    (this.mock.usageLog.create as jest.Mock).mockResolvedValue(logs[0]);
    (this.mock.usageLog.aggregate as jest.Mock).mockResolvedValue({
      _sum: {
        totalTokens: 300,
        cost: 0.03
      },
      _count: 1
    });
    
    return logs;
  }

  /**
   * 重置所有Mock
   */
  resetAll() {
    Object.values(this.mock).forEach(value => {
      if (typeof value === 'object' && value !== null) {
        Object.values(value).forEach(method => {
          if (typeof method === 'function' && 'mockReset' in method) {
            (method as jest.Mock).mockReset();
          }
        });
      }
    });
  }

  /**
   * 清除所有Mock调用历史
   */
  clearAll() {
    Object.values(this.mock).forEach(value => {
      if (typeof value === 'object' && value !== null) {
        Object.values(value).forEach(method => {
          if (typeof method === 'function' && 'mockClear' in method) {
            (method as jest.Mock).mockClear();
          }
        });
      }
    });
  }
}

/**
 * 创建带场景的Prisma Mock
 */
export function createPrismaMockWithScenarios() {
  const mock = createPrismaMock();
  const scenarios = new PrismaMockScenarios(mock);
  
  return { mock, scenarios };
}
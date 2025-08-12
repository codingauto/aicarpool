import { prisma } from '@/lib/prisma'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'

/**
 * 创建测试用户
 */
export async function createTestUser(data?: Partial<any>) {
  const defaultData = {
    email: 'test@example.com',
    password: await bcrypt.hash('password123', 10),
    name: 'Test User',
    role: 'user',
  }
  
  return prisma.user.create({
    data: { ...defaultData, ...data }
  })
}

/**
 * 创建测试企业
 */
export async function createTestEnterprise(ownerId: string, data?: Partial<any>) {
  const defaultData = {
    name: 'Test Enterprise',
    description: 'Test enterprise for testing',
    ownerId,
  }
  
  return prisma.enterprise.create({
    data: { ...defaultData, ...data }
  })
}

/**
 * 生成测试Token
 */
export function generateTestToken(userId: string) {
  return jwt.sign(
    { userId, email: 'test@example.com' },
    process.env.JWT_SECRET!,
    { expiresIn: '1h' }
  )
}

/**
 * 清理测试数据库
 */
export async function cleanDatabase() {
  const tables = [
    'usageStat',
    'groupAccountBinding',
    'groupMember',
    'group',
    'aiServiceAccount',
    'enterpriseMember',
    'enterprise',
    'user',
  ]
  
  for (const table of tables) {
    await prisma.$executeRawUnsafe(`DELETE FROM ${table}`)
  }
}

/**
 * 创建认证请求头
 */
export function createAuthHeaders(token: string) {
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  }
}
import '@testing-library/jest-dom'
import { loadEnvConfig } from '@next/env'
import { TextEncoder, TextDecoder } from 'util'

// 加载测试环境变量
loadEnvConfig(process.cwd())

// 修复TextEncoder/TextDecoder在Jest环境中的问题
global.TextEncoder = TextEncoder
global.TextDecoder = TextDecoder as any

// 设置测试环境变量
// NODE_ENV 在 Next.js 中是只读的，所以跳过设置
if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = 'test-secret-key'
}
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = 'mysql://test:test@localhost:3306/aicarpool_test'
}

// Mock console方法（可选）
global.console = {
  ...console,
  error: jest.fn(),
  warn: jest.fn(),
}

// 清理函数
afterEach(() => {
  jest.clearAllMocks()
})

// 全局测试超时
jest.setTimeout(10000)
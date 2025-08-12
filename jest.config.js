const nextJest = require('next/jest')

const createJestConfig = nextJest({
  // Next.js应用的路径
  dir: './',
})

const customJestConfig = {
  // 测试环境
  testEnvironment: 'node',
  
  // 测试文件匹配模式
  testMatch: [
    '<rootDir>/src/**/__tests__/**/*.{js,jsx,ts,tsx}',
    '<rootDir>/src/**/*.{spec,test}.{js,jsx,ts,tsx}'
  ],
  
  // 覆盖率收集
  collectCoverageFrom: [
    'src/**/*.{js,jsx,ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/*.stories.{js,jsx,ts,tsx}',
    '!src/**/_*.{js,jsx,ts,tsx}',
    '!src/**/index.{js,ts}',
    '!src/app/layout.tsx',
    '!src/app/page.tsx',
  ],
  
  // 覆盖率阈值
  coverageThreshold: {
    global: {
      branches: 60,
      functions: 60,
      lines: 70,
      statements: 70
    }
  },
  
  // 模块路径映射
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@components/(.*)$': '<rootDir>/src/components/$1',
    '^@lib/(.*)$': '<rootDir>/src/lib/$1',
    '^@hooks/(.*)$': '<rootDir>/src/hooks/$1',
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
  },
  
  // 设置文件
  setupFilesAfterEnv: ['<rootDir>/src/test-utils/setup.ts'],
  
  // 忽略路径
  testPathIgnorePatterns: ['/node_modules/', '/.next/'],
  transformIgnorePatterns: [
    '/node_modules/',
    '^.+\\.module\\.(css|sass|scss)$',
  ],
  
  // 模块目录
  moduleDirectories: ['node_modules', 'src'],
  
  // 测试超时
  testTimeout: 10000,
  
  // 详细输出
  verbose: true,
}

module.exports = createJestConfig(customJestConfig)
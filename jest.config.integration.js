const baseConfig = require('./jest.config')

module.exports = {
  ...baseConfig,
  testMatch: ['<rootDir>/src/**/__tests__/integration/**/*.{test,spec}.{js,jsx,ts,tsx}'],
  coverageDirectory: 'coverage/integration',
  testTimeout: 30000,
}
const baseConfig = require('./jest.config')

module.exports = {
  ...baseConfig,
  testMatch: ['<rootDir>/src/**/__tests__/unit/**/*.{test,spec}.{js,jsx,ts,tsx}'],
  coverageDirectory: 'coverage/unit',
}
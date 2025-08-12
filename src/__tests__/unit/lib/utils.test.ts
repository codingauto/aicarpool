import { describe, it, expect } from '@jest/globals'

// 简单的工具函数用于测试
function formatCurrency(amount: number): string {
  return `$${amount.toFixed(2)}`
}

function calculateDiscount(price: number, percentage: number): number {
  return price * (1 - percentage / 100)
}

describe('工具函数测试', () => {
  describe('formatCurrency', () => {
    it('应该正确格式化货币', () => {
      expect(formatCurrency(100)).toBe('$100.00')
      expect(formatCurrency(99.99)).toBe('$99.99')
      expect(formatCurrency(0)).toBe('$0.00')
    })
  })

  describe('calculateDiscount', () => {
    it('应该正确计算折扣', () => {
      expect(calculateDiscount(100, 10)).toBe(90)
      expect(calculateDiscount(100, 25)).toBe(75)
      expect(calculateDiscount(100, 50)).toBe(50)
      expect(calculateDiscount(100, 0)).toBe(100)
    })
  })
})
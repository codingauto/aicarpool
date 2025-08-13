import { describe, it, expect } from '@jest/globals'
import { 
  cn, 
  getErrorMessage, 
  errorHasMessage, 
  errorMessageIncludes,
  generateApiKey,
  generateSecureRandomString 
} from '@/lib/utils'

describe('Utils 工具函数', () => {
  describe('cn - 类名合并', () => {
    it('应该正确合并类名', () => {
      expect(cn('px-2', 'py-3')).toBe('px-2 py-3')
      expect(cn('px-2', { 'text-red': true })).toBe('px-2 text-red')
      expect(cn('px-2', { 'text-red': false })).toBe('px-2')
    })

    it('应该正确处理 tailwind 冲突', () => {
      expect(cn('px-2', 'px-4')).toBe('px-4')
      expect(cn('text-red-500', 'text-blue-500')).toBe('text-blue-500')
    })
  })

  describe('错误处理函数', () => {
    describe('getErrorMessage', () => {
      it('应该从 Error 对象获取消息', () => {
        const error = new Error('测试错误')
        expect(getErrorMessage(error)).toBe('测试错误')
      })

      it('应该处理非 Error 对象', () => {
        expect(getErrorMessage('字符串错误')).toBe('字符串错误')
        expect(getErrorMessage(123)).toBe('123')
        expect(getErrorMessage(null)).toBe('null')
      })
    })

    describe('errorHasMessage', () => {
      it('应该检查错误是否有特定消息', () => {
        const error = new Error('特定消息')
        expect(errorHasMessage(error, '特定消息')).toBe(true)
        expect(errorHasMessage(error, '其他消息')).toBe(false)
      })

      it('应该处理非 Error 对象', () => {
        expect(errorHasMessage('错误消息', '错误消息')).toBe(true)
        expect(errorHasMessage(123, '123')).toBe(true)
      })
    })

    describe('errorMessageIncludes', () => {
      it('应该检查错误消息是否包含文本', () => {
        const error = new Error('这是一个测试错误')
        expect(errorMessageIncludes(error, '测试')).toBe(true)
        expect(errorMessageIncludes(error, '不存在')).toBe(false)
      })

      it('应该处理非 Error 对象', () => {
        expect(errorMessageIncludes('包含某些文本', '某些')).toBe(true)
        expect(errorMessageIncludes(12345, '234')).toBe(true)
      })
    })
  })

  describe('生成函数', () => {
    describe('generateApiKey', () => {
      it('应该生成32位的API密钥', () => {
        const key = generateApiKey()
        expect(key).toHaveLength(32)
        expect(key).toMatch(/^[A-Za-z0-9]+$/)
      })

      it('每次生成的密钥应该不同', () => {
        const key1 = generateApiKey()
        const key2 = generateApiKey()
        expect(key1).not.toBe(key2)
      })
    })

    describe('generateSecureRandomString', () => {
      it('应该生成默认长度的随机字符串', () => {
        const str = generateSecureRandomString()
        expect(str).toHaveLength(16)
        expect(str).toMatch(/^[A-Za-z0-9]+$/)
      })

      it('应该生成指定长度的随机字符串', () => {
        const str = generateSecureRandomString(24)
        expect(str).toHaveLength(24)
        expect(str).toMatch(/^[A-Za-z0-9]+$/)
      })

      it('每次生成的字符串应该不同', () => {
        const str1 = generateSecureRandomString()
        const str2 = generateSecureRandomString()
        expect(str1).not.toBe(str2)
      })
    })
  })
})
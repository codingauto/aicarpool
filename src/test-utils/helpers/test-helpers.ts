import { jest } from '@jest/globals';

/**
 * 测试辅助工具集
 */

/**
 * 创建一个完整的Mock函数，包含所有常用的jest mock方法
 */
export function createMockFunction<T = any>(): jest.MockedFunction<T> {
  return jest.fn() as jest.MockedFunction<T>;
}

/**
 * 设置环境变量用于测试
 */
export function setupTestEnv(overrides: Record<string, string> = {}) {
  const originalEnv = process.env;
  
  beforeEach(() => {
    process.env = {
      ...originalEnv,
      NODE_ENV: 'test',
      JWT_SECRET: 'test-jwt-secret',
      JWT_REFRESH_SECRET: 'test-refresh-secret',
      DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
      ...overrides
    };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  return originalEnv;
}

/**
 * 创建延迟Promise用于测试异步操作
 */
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 创建一个可控的异步操作
 */
export function createControllablePromise<T>() {
  let resolve: (value: T) => void;
  let reject: (reason?: any) => void;
  
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return {
    promise,
    resolve: resolve!,
    reject: reject!
  };
}

/**
 * 等待异步操作完成
 */
export async function flushPromises(): Promise<void> {
  return new Promise(resolve => setImmediate(resolve));
}

/**
 * Mock控制台方法
 */
export function mockConsole() {
  const originalConsole = {
    log: console.log,
    error: console.error,
    warn: console.warn,
    info: console.info
  };

  beforeEach(() => {
    console.log = jest.fn();
    console.error = jest.fn();
    console.warn = jest.fn();
    console.info = jest.fn();
  });

  afterEach(() => {
    console.log = originalConsole.log;
    console.error = originalConsole.error;
    console.warn = originalConsole.warn;
    console.info = originalConsole.info;
  });

  return {
    log: console.log as jest.Mock,
    error: console.error as jest.Mock,
    warn: console.warn as jest.Mock,
    info: console.info as jest.Mock
  };
}

/**
 * 创建测试用的时间控制器
 */
export function setupTimeHelpers() {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  return {
    advance: (ms: number) => jest.advanceTimersByTime(ms),
    runAll: () => jest.runAllTimers(),
    runPending: () => jest.runOnlyPendingTimers(),
    setSystemTime: (date: Date | number) => jest.setSystemTime(date)
  };
}

/**
 * 验证异步函数抛出特定错误
 */
export async function expectAsyncError(
  asyncFn: () => Promise<any>,
  errorMessage?: string | RegExp
): Promise<void> {
  try {
    await asyncFn();
    throw new Error('Expected function to throw, but it did not');
  } catch (error: any) {
    if (errorMessage) {
      if (typeof errorMessage === 'string') {
        expect(error.message).toBe(errorMessage);
      } else {
        expect(error.message).toMatch(errorMessage);
      }
    }
  }
}

/**
 * 创建测试数据快照
 */
export function createSnapshot<T>(data: T): T {
  return JSON.parse(JSON.stringify(data));
}

/**
 * Mock计时器性能测试
 */
export function measurePerformance(fn: () => void | Promise<void>) {
  const start = performance.now();
  const result = fn();
  
  if (result instanceof Promise) {
    return result.then(() => {
      const end = performance.now();
      return end - start;
    });
  }
  
  const end = performance.now();
  return end - start;
}

/**
 * 创建可重置的Mock
 */
export class ResettableMock<T extends (...args: any[]) => any> {
  private originalImplementation?: T;
  public mock: jest.MockedFunction<T>;

  constructor(implementation?: T) {
    this.originalImplementation = implementation;
    this.mock = jest.fn(implementation) as jest.MockedFunction<T>;
  }

  reset() {
    this.mock.mockReset();
    if (this.originalImplementation) {
      this.mock.mockImplementation(this.originalImplementation);
    }
  }

  clear() {
    this.mock.mockClear();
  }
}

/**
 * 批量创建Mock对象
 */
export function createMockObject<T extends Record<string, any>>(
  shape: { [K in keyof T]: 'function' | 'value' | any }
): jest.Mocked<T> {
  const mock: any = {};
  
  for (const [key, type] of Object.entries(shape)) {
    if (type === 'function') {
      mock[key] = jest.fn();
    } else if (type === 'value') {
      mock[key] = undefined;
    } else {
      mock[key] = type;
    }
  }
  
  return mock as jest.Mocked<T>;
}

/**
 * 等待条件满足
 */
export async function waitFor(
  condition: () => boolean | Promise<boolean>,
  timeout: number = 5000,
  interval: number = 100
): Promise<void> {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    const result = await condition();
    if (result) {
      return;
    }
    await delay(interval);
  }
  
  throw new Error(`Timeout waiting for condition after ${timeout}ms`);
}

/**
 * 创建测试上下文
 */
export class TestContext<T = any> {
  private data: Map<string, T> = new Map();

  set(key: string, value: T) {
    this.data.set(key, value);
  }

  get(key: string): T | undefined {
    return this.data.get(key);
  }

  clear() {
    this.data.clear();
  }

  getAll(): Record<string, T> {
    const result: Record<string, T> = {};
    this.data.forEach((value, key) => {
      result[key] = value;
    });
    return result;
  }
}
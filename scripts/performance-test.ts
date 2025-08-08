#!/usr/bin/env tsx

/**
 * 性能测试脚本
 * 
 * 测试高并发场景下的系统性能
 */

import axios from 'axios';
import { performance } from 'perf_hooks';

interface TestConfig {
  baseUrl: string;
  apiKey: string;
  concurrency: number;
  totalRequests: number;
  testDuration?: number; // 秒
}

interface TestResult {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  minResponseTime: number;
  maxResponseTime: number;
  requestsPerSecond: number;
  errors: Map<string, number>;
  statusCodes: Map<number, number>;
}

class PerformanceTester {
  private config: TestConfig;
  private results: TestResult;
  private responseTimes: number[] = [];
  private startTime: number = 0;
  private endTime: number = 0;

  constructor(config: TestConfig) {
    this.config = config;
    this.results = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      minResponseTime: Infinity,
      maxResponseTime: 0,
      requestsPerSecond: 0,
      errors: new Map(),
      statusCodes: new Map()
    };
  }

  /**
   * 发送单个请求
   */
  private async sendRequest(): Promise<void> {
    const requestStart = performance.now();
    
    try {
      const response = await axios.post(
        `${this.config.baseUrl}/api/ai-proxy/chat`,
        {
          messages: [
            {
              role: 'user',
              content: 'Hello, this is a performance test message.'
            }
          ],
          model: 'gpt-3.5-turbo',
          maxTokens: 100
        },
        {
          headers: {
            'Authorization': `Bearer ${this.config.apiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 30000,
          validateStatus: () => true // 接受所有状态码
        }
      );

      const responseTime = performance.now() - requestStart;
      this.responseTimes.push(responseTime);
      
      // 更新统计
      this.results.totalRequests++;
      
      const statusCode = response.status;
      this.results.statusCodes.set(
        statusCode,
        (this.results.statusCodes.get(statusCode) || 0) + 1
      );

      if (statusCode >= 200 && statusCode < 300) {
        this.results.successfulRequests++;
      } else {
        this.results.failedRequests++;
        
        if (statusCode === 429) {
          this.incrementError('Rate Limited');
        } else if (statusCode >= 500) {
          this.incrementError('Server Error');
        } else if (statusCode >= 400) {
          this.incrementError('Client Error');
        }
      }

      // 更新响应时间统计
      this.results.minResponseTime = Math.min(this.results.minResponseTime, responseTime);
      this.results.maxResponseTime = Math.max(this.results.maxResponseTime, responseTime);

    } catch (error) {
      this.results.totalRequests++;
      this.results.failedRequests++;
      
      if (axios.isAxiosError(error)) {
        if (error.code === 'ECONNABORTED') {
          this.incrementError('Timeout');
        } else if (error.code === 'ECONNREFUSED') {
          this.incrementError('Connection Refused');
        } else {
          this.incrementError(error.message);
        }
      } else {
        this.incrementError('Unknown Error');
      }
    }
  }

  /**
   * 记录错误
   */
  private incrementError(errorType: string): void {
    this.results.errors.set(
      errorType,
      (this.results.errors.get(errorType) || 0) + 1
    );
  }

  /**
   * 运行并发测试
   */
  async runConcurrentTest(): Promise<void> {
    console.log('🚀 开始性能测试...');
    console.log(`配置: ${this.config.concurrency} 并发, ${this.config.totalRequests} 总请求`);
    
    this.startTime = performance.now();
    
    const batchSize = this.config.concurrency;
    const totalBatches = Math.ceil(this.config.totalRequests / batchSize);
    
    for (let batch = 0; batch < totalBatches; batch++) {
      const promises: Promise<void>[] = [];
      const requestsInBatch = Math.min(
        batchSize,
        this.config.totalRequests - batch * batchSize
      );
      
      for (let i = 0; i < requestsInBatch; i++) {
        promises.push(this.sendRequest());
      }
      
      await Promise.all(promises);
      
      // 显示进度
      const progress = ((batch + 1) / totalBatches * 100).toFixed(1);
      process.stdout.write(`\r进度: ${progress}% (${this.results.totalRequests}/${this.config.totalRequests})`);
    }
    
    this.endTime = performance.now();
    console.log('\n✅ 测试完成！\n');
  }

  /**
   * 运行持续时间测试
   */
  async runDurationTest(): Promise<void> {
    if (!this.config.testDuration) {
      throw new Error('Test duration not specified');
    }

    console.log('🚀 开始持续性能测试...');
    console.log(`配置: ${this.config.concurrency} 并发, ${this.config.testDuration} 秒持续时间`);
    
    this.startTime = performance.now();
    const endTime = this.startTime + this.config.testDuration * 1000;
    
    const activeRequests = new Set<Promise<void>>();
    
    while (performance.now() < endTime) {
      // 保持并发数
      while (activeRequests.size < this.config.concurrency && performance.now() < endTime) {
        const request = this.sendRequest().finally(() => {
          activeRequests.delete(request);
        });
        activeRequests.add(request);
      }
      
      // 等待一些请求完成
      if (activeRequests.size >= this.config.concurrency) {
        await Promise.race(activeRequests);
      }
      
      // 显示进度
      const elapsed = ((performance.now() - this.startTime) / 1000).toFixed(1);
      process.stdout.write(`\r时间: ${elapsed}/${this.config.testDuration}s, 请求: ${this.results.totalRequests}`);
    }
    
    // 等待所有活动请求完成
    await Promise.all(activeRequests);
    
    this.endTime = performance.now();
    console.log('\n✅ 测试完成！\n');
  }

  /**
   * 计算并显示结果
   */
  displayResults(): void {
    const duration = (this.endTime - this.startTime) / 1000; // 秒
    
    // 计算平均响应时间
    if (this.responseTimes.length > 0) {
      this.results.averageResponseTime = 
        this.responseTimes.reduce((a, b) => a + b, 0) / this.responseTimes.length;
    }
    
    // 计算RPS
    this.results.requestsPerSecond = this.results.totalRequests / duration;
    
    // 计算百分位数
    const sortedTimes = [...this.responseTimes].sort((a, b) => a - b);
    const p50 = sortedTimes[Math.floor(sortedTimes.length * 0.5)] || 0;
    const p95 = sortedTimes[Math.floor(sortedTimes.length * 0.95)] || 0;
    const p99 = sortedTimes[Math.floor(sortedTimes.length * 0.99)] || 0;
    
    console.log('📊 测试结果');
    console.log('═══════════════════════════════════════════');
    console.log(`总请求数:        ${this.results.totalRequests}`);
    console.log(`成功请求:        ${this.results.successfulRequests} (${(this.results.successfulRequests / this.results.totalRequests * 100).toFixed(2)}%)`);
    console.log(`失败请求:        ${this.results.failedRequests} (${(this.results.failedRequests / this.results.totalRequests * 100).toFixed(2)}%)`);
    console.log(`测试时长:        ${duration.toFixed(2)} 秒`);
    console.log(`请求速率:        ${this.results.requestsPerSecond.toFixed(2)} req/s`);
    console.log('');
    console.log('⏱️  响应时间统计 (ms)');
    console.log('───────────────────────────────────────────');
    console.log(`最小值:          ${this.results.minResponseTime.toFixed(2)}`);
    console.log(`最大值:          ${this.results.maxResponseTime.toFixed(2)}`);
    console.log(`平均值:          ${this.results.averageResponseTime.toFixed(2)}`);
    console.log(`P50:            ${p50.toFixed(2)}`);
    console.log(`P95:            ${p95.toFixed(2)}`);
    console.log(`P99:            ${p99.toFixed(2)}`);
    
    if (this.results.statusCodes.size > 0) {
      console.log('');
      console.log('📈 状态码分布');
      console.log('───────────────────────────────────────────');
      for (const [code, count] of this.results.statusCodes) {
        const percentage = (count / this.results.totalRequests * 100).toFixed(2);
        console.log(`${code}:            ${count} (${percentage}%)`);
      }
    }
    
    if (this.results.errors.size > 0) {
      console.log('');
      console.log('❌ 错误分布');
      console.log('───────────────────────────────────────────');
      for (const [error, count] of this.results.errors) {
        const percentage = (count / this.results.failedRequests * 100).toFixed(2);
        console.log(`${error}: ${count} (${percentage}%)`);
      }
    }
    
    console.log('═══════════════════════════════════════════');
    
    // 性能评级
    console.log('');
    console.log('🎯 性能评级');
    console.log('───────────────────────────────────────────');
    
    if (this.results.requestsPerSecond > 100) {
      console.log('✅ 优秀: 系统可以处理高并发请求');
    } else if (this.results.requestsPerSecond > 50) {
      console.log('✅ 良好: 系统性能表现良好');
    } else if (this.results.requestsPerSecond > 20) {
      console.log('⚠️  一般: 系统性能有提升空间');
    } else {
      console.log('❌ 较差: 系统性能需要优化');
    }
    
    if (this.results.averageResponseTime < 200) {
      console.log('✅ 响应时间优秀');
    } else if (this.results.averageResponseTime < 500) {
      console.log('✅ 响应时间良好');
    } else if (this.results.averageResponseTime < 1000) {
      console.log('⚠️  响应时间一般');
    } else {
      console.log('❌ 响应时间过长');
    }
    
    const successRate = this.results.successfulRequests / this.results.totalRequests;
    if (successRate > 0.99) {
      console.log('✅ 可靠性优秀');
    } else if (successRate > 0.95) {
      console.log('✅ 可靠性良好');
    } else if (successRate > 0.90) {
      console.log('⚠️  可靠性一般');
    } else {
      console.log('❌ 可靠性较差');
    }
  }
}

/**
 * 主函数
 */
async function main() {
  // 从命令行参数或环境变量获取配置
  const baseUrl = process.argv[2] || process.env.TEST_BASE_URL || 'http://localhost:4000';
  const apiKey = process.argv[3] || process.env.TEST_API_KEY || 'test-api-key';
  const concurrency = parseInt(process.argv[4] || '10');
  const totalRequests = parseInt(process.argv[5] || '100');
  const testMode = process.argv[6] || 'concurrent'; // 'concurrent' or 'duration'
  const testDuration = parseInt(process.argv[7] || '30'); // 秒

  const config: TestConfig = {
    baseUrl,
    apiKey,
    concurrency,
    totalRequests,
    testDuration: testMode === 'duration' ? testDuration : undefined
  };

  console.log('🔧 性能测试配置');
  console.log('═══════════════════════════════════════════');
  console.log(`目标URL:         ${config.baseUrl}`);
  console.log(`并发数:          ${config.concurrency}`);
  if (testMode === 'duration') {
    console.log(`测试时长:        ${config.testDuration} 秒`);
  } else {
    console.log(`总请求数:        ${config.totalRequests}`);
  }
  console.log('═══════════════════════════════════════════');
  console.log('');

  const tester = new PerformanceTester(config);

  try {
    if (testMode === 'duration') {
      await tester.runDurationTest();
    } else {
      await tester.runConcurrentTest();
    }
    
    tester.displayResults();
    
  } catch (error) {
    console.error('❌ 测试失败:', error);
    process.exit(1);
  }
}

// 运行测试
if (require.main === module) {
  main().catch(console.error);
}

export { PerformanceTester, TestConfig, TestResult };
/**
 * Claude Code 专用代理服务
 * 与现有 aicarpool 系统集成，支持 Claude Code CLI 的特殊需求
 */
import { AiProxyService } from './AiProxyService.js';
import { EdgeClient } from '@/core/EdgeClient.js';
import { 
  ClaudeCodeRequest, 
  ClaudeCodeHeaders,
  SystemMessage,
  ProxyResponse,
  AiServiceConfig
} from '@/types/index.js';

export interface ClaudeCodeConfig {
  supportedVersions: string[];
  systemPrompt: string;
  defaultHeaders: ClaudeCodeHeaders;
  features: {
    tools: boolean;
    files: boolean;
    streaming: boolean;
    memory: boolean;
  };
}

export class ClaudeCodeProxyService extends AiProxyService {
  private claudeCodeConfig: ClaudeCodeConfig;

  constructor(edgeClient: EdgeClient) {
    super(edgeClient);
    
    this.claudeCodeConfig = {
      supportedVersions: ['1.0.55', '1.0.56', '1.0.57', '1.0.58', '1.0.59'],
      systemPrompt: 'You are Claude Code, Anthropic\'s official CLI for Claude.',
      defaultHeaders: {
        'user-agent': 'claude-cli/1.0.57 (external, cli)',
        'anthropic-version': '2024-06-01',
        'x-stainless-lang': 'js',
        'x-stainless-package-version': '0.55.1',
        'x-stainless-os': 'Darwin',
        'x-stainless-arch': 'x64',
        'x-stainless-runtime': 'node',
        'x-stainless-runtime-version': 'v20.19.2',
        'x-app': 'cli',
        'accept-language': '*',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      features: {
        tools: true,
        files: true,
        streaming: true,
        memory: true
      }
    };
  }

  /**
   * 初始化 Claude Code 服务
   */
  async initialize(): Promise<void> {
    await super.initialize();
    
    console.log('初始化 Claude Code 代理服务...');
    
    // 确保 Claude 服务配置存在
    await this.ensureClaudeServiceConfig();
    
    console.log(`Claude Code 代理服务已初始化，支持版本: ${this.claudeCodeConfig.supportedVersions.join(', ')}`);
  }

  /**
   * 确保 Claude 服务配置
   */
  private async ensureClaudeServiceConfig(): Promise<void> {
    const claudeConfig = this.getServiceConfig('claude-code');
    
    if (!claudeConfig) {
      // 如果没有 claude-code 配置，使用默认的 claude 配置
      const defaultClaudeConfig: AiServiceConfig = {
        name: 'claude-code',
        displayName: 'Claude Code CLI',
        endpoint: 'https://api.anthropic.com/v1/messages',
        apiKeyHeader: 'x-api-key',
        timeout: 120000,
        retryAttempts: 3,
        models: [
          'claude-3-5-sonnet-20241022',
          'claude-3-5-haiku-20241022',
          'claude-sonnet-4-20250514'
        ],
        rateLimit: {
          requests: 60,
          window: 60000
        }
      };

      await this.updateServiceConfig([defaultClaudeConfig]);
    }
  }

  /**
   * 验证 Claude Code 请求
   */
  validateClaudeCodeRequest(headers: Record<string, string>): boolean {
    const userAgent = headers['user-agent'] || headers['User-Agent'] || '';
    const versionMatch = userAgent.match(/claude-cli\/(\d+\.\d+\.\d+)/);
    
    if (!versionMatch) {
      return false;
    }

    const version = versionMatch[1];
    return this.claudeCodeConfig.supportedVersions.includes(version);
  }

  /**
   * 提取 Claude Code 版本
   */
  extractClaudeCodeVersion(headers: Record<string, string>): string | null {
    const userAgent = headers['user-agent'] || headers['User-Agent'] || '';
    const versionMatch = userAgent.match(/claude-cli\/(\d+\.\d+\.\d+)/);
    return versionMatch ? versionMatch[1] : null;
  }

  /**
   * 处理 Claude Code 专用请求
   * 与现有 aicarpool 系统集成，通过 API Key 验证用户
   */
  async handleClaudeCodeRequest(
    request: ClaudeCodeRequest, 
    apiKey: string
  ): Promise<ProxyResponse> {
    const startTime = Date.now();

    try {
      // 验证 Claude Code 身份
      if (!this.validateClaudeCodeRequest(request.headers || {})) {
        throw new Error('Invalid Claude Code request');
      }

      // 处理系统提示词 - 这是 Claude Code 的核心特征
      const processedRequest = this.processSystemPrompt(request);

      // 合并 Claude Code 特定 headers
      processedRequest.headers = this.mergeClaudeCodeHeaders(
        processedRequest.headers || {},
        this.extractClaudeCodeVersion(request.headers || {})
      );

      // 设置服务和模型 - 使用 claude-code 服务
      processedRequest.service = 'claude-code';
      if (!processedRequest.model) {
        processedRequest.model = 'claude-3-5-sonnet-20241022';
      }

      // 添加 API Key
      processedRequest.apiKey = apiKey;

      // 调用基础代理服务处理请求
      const response = await this.handleProxyRequest(processedRequest);

      // 记录 Claude Code 特定的使用统计
      await this.recordClaudeCodeUsage(request, response, Date.now() - startTime);

      return response;

    } catch (error: any) {
      console.error(`Claude Code 请求失败: ${error.message}`);
      
      return {
        success: false,
        error: error.message,
        responseTime: Date.now() - startTime,
        service: 'claude-code',
        model: request.model || 'claude-3-5-sonnet-20241022'
      };
    }
  }

  /**
   * 处理系统提示词
   * 确保所有 Claude Code 请求都包含正确的系统提示词
   */
  private processSystemPrompt(request: ClaudeCodeRequest): ClaudeCodeRequest {
    const processedRequest = { ...request };

    // 确保包含 Claude Code 系统提示词
    if (!this.hasClaudeCodeSystemPrompt(request.system)) {
      const claudeCodePrompt: SystemMessage = {
        type: 'text',
        text: this.claudeCodeConfig.systemPrompt,
        cache_control: {
          type: 'ephemeral'
        }
      };

      if (typeof request.system === 'string') {
        // 字符串格式转换为数组格式
        processedRequest.system = [
          claudeCodePrompt,
          {
            type: 'text',
            text: request.system
          }
        ];
      } else if (Array.isArray(request.system)) {
        // 在数组开头插入 Claude Code 提示词
        processedRequest.system = [claudeCodePrompt, ...request.system];
      } else {
        // 没有系统提示词，只添加 Claude Code 提示词
        processedRequest.system = [claudeCodePrompt];
      }
    }

    return processedRequest;
  }

  /**
   * 检查是否包含 Claude Code 系统提示词
   */
  private hasClaudeCodeSystemPrompt(system: string | SystemMessage[] | undefined): boolean {
    if (!system) return false;

    if (typeof system === 'string') {
      return system.includes('You are Claude Code');
    }

    if (Array.isArray(system)) {
      return system.some(msg => 
        msg.type === 'text' && 
        msg.text.includes('You are Claude Code')
      );
    }

    return false;
  }

  /**
   * 合并 Claude Code 特定 headers
   */
  private mergeClaudeCodeHeaders(
    clientHeaders: Record<string, string>,
    userVersion?: string | null
  ): Record<string, string> {
    const mergedHeaders: Record<string, string> = {};
    
    // 先添加默认 headers，跳过 undefined 值
    Object.entries(this.claudeCodeConfig.defaultHeaders).forEach(([key, value]) => {
      if (value !== undefined) {
        mergedHeaders[key] = value;
      }
    });

    // 使用客户端提供的 headers 覆盖默认值
    Object.keys(clientHeaders).forEach(key => {
      if (clientHeaders[key]) {
        mergedHeaders[key] = clientHeaders[key];
      }
    });

    // 如果有用户版本信息，更新 user-agent
    if (userVersion) {
      mergedHeaders['user-agent'] = `claude-cli/${userVersion} (external, cli)`;
    }

    return mergedHeaders;
  }

  /**
   * 记录 Claude Code 使用统计
   * 使用现有的统计系统，但添加 Claude Code 特定的元数据
   */
  private async recordClaudeCodeUsage(
    request: ClaudeCodeRequest,
    response: ProxyResponse,
    duration: number
  ): Promise<void> {
    try {
      // 提取 Claude Code 特定信息
      const version = this.extractClaudeCodeVersion(request.headers || {});
      const hasTools = request.tools && request.tools.length > 0;
      const isStreaming = request.stream === true;
      
      // 估算 token 使用量（实际应该从响应中提取）
      const inputTokens = this.estimateInputTokens(request);
      const outputTokens = response.success ? this.estimateOutputTokens(response.data) : 0;
      const totalTokens = inputTokens + outputTokens;

      // 使用现有的 EdgeClient 记录 API 使用统计
      await this.edgeClient.recordApiUsage({
        service: 'claude-code',
        model: request.model || 'claude-3-5-sonnet-20241022',
        requestId: this.generateClaudeCodeRequestId(),
        timestamp: new Date(),
        responseTime: duration,
        success: response.success,
        inputTokens,
        outputTokens,
        totalTokens,
        estimatedCost: this.calculateClaudeCodeCost(totalTokens, request.model || 'claude-3-5-sonnet-20241022'),
        // Claude Code 特定的元数据
        errorType: response.success ? undefined : this.getClaudeCodeErrorType(response.error),
        errorMessage: response.error,
        // 额外的 Claude Code 元数据
        metadata: {
          claudeCodeVersion: version,
          hasTools,
          isStreaming,
          toolsUsed: request.tools?.map(t => t.name) || [],
          requestType: hasTools ? 'tools' : 'chat'
        }
      });

    } catch (error) {
      console.error('记录 Claude Code 使用统计失败:', error);
    }
  }

  /**
   * 估算输入 tokens
   */
  private estimateInputTokens(request: ClaudeCodeRequest): number {
    let tokens = 0;

    // 系统提示词
    if (request.system) {
      if (typeof request.system === 'string') {
        tokens += Math.ceil(request.system.length / 4);
      } else if (Array.isArray(request.system)) {
        tokens += request.system.reduce((sum, msg) => 
          sum + Math.ceil(msg.text.length / 4), 0);
      }
    }

    // 消息内容
    if (request.messages) {
      tokens += request.messages.reduce((sum, msg) => {
        if (typeof msg.content === 'string') {
          return sum + Math.ceil(msg.content.length / 4);
        }
        return sum + 100; // 非文本内容的估算
      }, 0);
    }

    // 工具定义
    if (request.tools) {
      tokens += request.tools.reduce((sum, tool) => 
        sum + Math.ceil(JSON.stringify(tool).length / 4), 0);
    }

    return tokens;
  }

  /**
   * 估算输出 tokens
   */
  private estimateOutputTokens(data: any): number {
    if (!data) return 0;

    if (typeof data === 'string') {
      return Math.ceil(data.length / 4);
    }

    if (data.content) {
      if (Array.isArray(data.content)) {
        return data.content.reduce((sum: number, item: any) => {
          if (item.type === 'text' && item.text) {
            return sum + Math.ceil(item.text.length / 4);
          }
          return sum + 50; // 非文本内容的估算
        }, 0);
      }
    }

    return 100; // 默认估算
  }

  /**
   * 计算 Claude Code 成本
   */
  private calculateClaudeCodeCost(tokens: number, model: string): number {
    // 简化的成本计算 - 实际应该从配置中获取
    const costPer1K: Record<string, number> = {
      'claude-3-5-sonnet-20241022': 0.015,
      'claude-3-5-haiku-20241022': 0.008,
      'claude-sonnet-4-20250514': 0.020
    };

    const rate = costPer1K[model] || 0.015;
    return (tokens / 1000) * rate;
  }

  /**
   * 获取 Claude Code 错误类型
   */
  private getClaudeCodeErrorType(error?: string): string {
    if (!error) return 'unknown_error';
    
    const lowerError = error.toLowerCase();
    
    if (lowerError.includes('quota') || lowerError.includes('limit')) {
      return 'quota_exceeded';
    }
    if (lowerError.includes('unauthorized') || lowerError.includes('api key')) {
      return 'auth_error';
    }
    if (lowerError.includes('timeout')) {
      return 'timeout';
    }
    if (lowerError.includes('rate limit')) {
      return 'rate_limit';
    }
    
    return 'api_error';
  }

  /**
   * 生成 Claude Code 请求ID
   */
  private generateClaudeCodeRequestId(): string {
    return `cc_req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * 检查 Claude Code 服务健康状态
   */
  async checkClaudeCodeHealth(): Promise<{
    service: string;
    healthy: boolean;
    responseTime?: number;
    error?: string;
    version?: string;
  }> {
    const healthResult = await this.checkServiceHealth('claude-code');
    
    return {
      ...healthResult,
      service: 'claude-code',
      version: this.claudeCodeConfig.supportedVersions[this.claudeCodeConfig.supportedVersions.length - 1]
    };
  }

  /**
   * 获取 Claude Code 配置
   */
  getClaudeCodeConfig(): ClaudeCodeConfig {
    return this.claudeCodeConfig;
  }

  /**
   * 更新 Claude Code 配置
   */
  updateClaudeCodeConfig(config: Partial<ClaudeCodeConfig>): void {
    this.claudeCodeConfig = {
      ...this.claudeCodeConfig,
      ...config
    };
    
    console.log('Claude Code 配置已更新');
  }

  /**
   * 获取用户信息（模拟实现）
   */
  async getUserInfo(apiKey: string): Promise<any> {
    // 这里应该从数据库或 API 获取真实用户信息
    // 现在返回模拟数据
    return {
      userId: `user_${apiKey.substring(apiKey.length - 8)}`,
      apiKey,
      quotaDaily: 50000,
      quotaMonthly: 1500000,
      usedDaily: Math.floor(Math.random() * 10000),
      usedMonthly: Math.floor(Math.random() * 200000),
      createdAt: new Date(),
      lastUsedAt: new Date(),
      status: 'active',
      version: '1.0.57'
    };
  }

  /**
   * 获取用户使用统计（模拟实现）
   */
  async getUserUsage(_apiKey: string): Promise<any[]> {
    // 这里应该从数据库获取真实使用统计
    // 现在返回模拟数据
    const mockUsage = [];
    for (let i = 0; i < 10; i++) {
      mockUsage.push({
        requestId: `req_${Date.now()}_${i}`,
        timestamp: new Date(Date.now() - i * 3600000), // 每小时一条
        model: 'claude-3-5-sonnet-20241022',
        inputTokens: Math.floor(Math.random() * 1000) + 100,
        outputTokens: Math.floor(Math.random() * 500) + 50,
        totalTokens: 0,
        requestDuration: Math.floor(Math.random() * 5000) + 1000,
        success: Math.random() > 0.1, // 90% 成功率
        tools: Math.random() > 0.5 ? ['bash', 'edit'] : [],
        files: Math.random() > 0.7 ? ['file1.ts', 'file2.js'] : []
      });
      mockUsage[i].totalTokens = mockUsage[i].inputTokens + mockUsage[i].outputTokens;
    }
    return mockUsage;
  }
}
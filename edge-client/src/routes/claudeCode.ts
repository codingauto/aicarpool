/**
 * Claude Code 专用路由
 */
import express from 'express';
import { ClaudeCodeProxyService } from '@/services/ClaudeCodeProxyService.js';
import { 
  claudeCodeAuth, 
  claudeCodeQuotaCheck, 
  claudeCodeRequestValidation,
  claudeCodeRateLimit,
  claudeCodeRequestLogger,
  ClaudeCodeRequest
} from '@/middleware/claudeCodeAuth.js';
import { EdgeClient } from '@/core/EdgeClient.js';

const router = express.Router();

/**
 * 初始化 Claude Code 路由
 */
export function initializeClaudeCodeRoutes(edgeClient: EdgeClient): express.Router {
  const claudeCodeService = new ClaudeCodeProxyService(edgeClient);
  
  // 初始化服务
  claudeCodeService.initialize().catch(console.error);

  // Claude Code 消息处理端点 - 兼容官方 API 格式
  router.post('/v1/messages', 
    claudeCodeRequestLogger,
    claudeCodeAuth,
    claudeCodeQuotaCheck,
    claudeCodeRequestValidation,
    claudeCodeRateLimit(60, 60000), // 每分钟60次请求
    async (req: ClaudeCodeRequest, res) => {
      try {
        const startTime = Date.now();
        const isStream = req.body.stream === true;

        if (isStream) {
          // 流式响应
          res.setHeader('Content-Type', 'text/event-stream');
          res.setHeader('Cache-Control', 'no-cache');
          res.setHeader('Connection', 'keep-alive');
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.setHeader('X-Accel-Buffering', 'no');

          // 禁用 Nagle 算法，确保数据立即发送
          if (res.socket && typeof res.socket.setNoDelay === 'function') {
            res.socket.setNoDelay(true);
          }

          // 处理流式请求
          await handleStreamRequest(claudeCodeService, req, res);
        } else {
          // 非流式响应
          const response = await claudeCodeService.handleClaudeCodeRequest(
            req.body, 
            req.claudeCodeUser!.apiKey
          );

          if (response.success) {
            res.json(response.data);
          } else {
            const statusCode = getErrorStatusCode(response.error);
            res.status(statusCode).json({
              error: {
                type: 'api_error',
                message: response.error
              }
            });
          }
        }

        // 记录请求完成
        const duration = Date.now() - startTime;
        console.log(`Claude Code 请求完成: ${duration}ms`);

      } catch (error: any) {
        console.error('Claude Code 请求处理失败:', error);
        
        if (!res.headersSent) {
          res.status(500).json({
            error: {
              type: 'internal_server_error',
              message: 'An internal server error occurred'
            }
          });
        }
      }
    }
  );

  // Claude Code 用户信息端点
  router.get('/v1/user', 
    claudeCodeAuth,
    async (req: ClaudeCodeRequest, res) => {
      try {
        const user = await claudeCodeService.getUserInfo(req.claudeCodeUser!.apiKey);
        
        if (!user) {
          res.status(404).json({
            error: {
              type: 'not_found',
              message: 'User not found'
            }
          });
          return;
        }

        res.json({
          id: user.userId,
          created_at: user.createdAt.toISOString(),
          status: user.status,
          quota: {
            daily: {
              limit: user.quotaDaily,
              used: user.usedDaily,
              remaining: Math.max(0, user.quotaDaily - user.usedDaily)
            },
            monthly: {
              limit: user.quotaMonthly,
              used: user.usedMonthly,
              remaining: Math.max(0, user.quotaMonthly - user.usedMonthly)
            }
          },
          version: user.version,
          last_used_at: user.lastUsedAt?.toISOString()
        });

      } catch (error: any) {
        console.error('获取用户信息失败:', error);
        res.status(500).json({
          error: {
            type: 'internal_server_error',
            message: 'Failed to get user information'
          }
        });
      }
    }
  );

  // Claude Code 使用统计端点
  router.get('/v1/usage',
    claudeCodeAuth,
    async (req: ClaudeCodeRequest, res) => {
      try {
        const usage = await claudeCodeService.getUserUsage(req.claudeCodeUser!.apiKey);
        
        // 计算统计信息
        const stats = calculateUsageStats(usage);
        
        res.json({
          usage_stats: stats,
          recent_requests: usage.slice(-10).map((u: any) => ({
            request_id: u.requestId,
            timestamp: u.timestamp.toISOString(),
            model: u.model,
            input_tokens: u.inputTokens,
            output_tokens: u.outputTokens,
            total_tokens: u.totalTokens,
            duration: u.requestDuration,
            success: u.success,
            tools: u.tools,
            files: u.files
          }))
        });

      } catch (error: any) {
        console.error('获取使用统计失败:', error);
        res.status(500).json({
          error: {
            type: 'internal_server_error',
            message: 'Failed to get usage statistics'
          }
        });
      }
    }
  );

  // Claude Code 健康检查端点
  router.get('/health', async (_req, res) => {
    try {
      const health = await claudeCodeService.checkServiceHealth('claude');
      
      res.json({
        status: health.healthy ? 'healthy' : 'unhealthy',
        service: 'claude-code-proxy',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        claude_service: {
          healthy: health.healthy,
          response_time: health.responseTime,
          error: health.error
        }
      });

    } catch (error: any) {
      console.error('健康检查失败:', error);
      res.status(503).json({
        status: 'unhealthy',
        service: 'claude-code-proxy',
        timestamp: new Date().toISOString(),
        error: error.message
      });
    }
  });

  return router;
}

/**
 * 处理流式请求
 */
async function handleStreamRequest(
  service: ClaudeCodeProxyService, 
  req: ClaudeCodeRequest, 
  res: express.Response
): Promise<void> {
  return new Promise(async (resolve, reject) => {
    try {
      // 处理客户端断开连接
      req.on('close', () => {
        console.log('Claude Code 客户端断开连接');
        if (!res.destroyed) {
          res.end();
        }
        resolve();
      });

      // 发送初始连接确认
      res.write('data: {"type": "ping"}\n\n');

      // 创建一个自定义的响应处理器来模拟流式响应
      const response = await service.handleClaudeCodeRequest(
        req.body, 
        req.claudeCodeUser!.apiKey
      );

      if (response.success && response.data) {
        // 模拟流式响应格式
        if (response.data.content && Array.isArray(response.data.content)) {
          // 发送消息开始事件
          res.write(`data: ${JSON.stringify({
            type: 'message_start',
            message: {
              id: `msg_${Date.now()}`,
              type: 'message',
              role: 'assistant',
              content: [],
              model: response.data.model || req.body.model,
              stop_reason: null,
              stop_sequence: null,
              usage: response.data.usage || {
                input_tokens: 0,
                output_tokens: 0
              }
            }
          })}\n\n`);

          // 逐个发送内容块
          for (const content of response.data.content) {
            if (content.type === 'text') {
              // 将文本分块发送
              const chunks = splitTextIntoChunks(content.text, 50);
              for (const chunk of chunks) {
                res.write(`data: ${JSON.stringify({
                  type: 'content_block_delta',
                  index: 0,
                  delta: {
                    type: 'text_delta',
                    text: chunk
                  }
                })}\n\n`);
                
                // 添加小延迟来模拟真实流式体验
                await sleep(10);
              }
            }
          }

          // 发送消息结束事件
          res.write(`data: ${JSON.stringify({
            type: 'message_delta',
            delta: {
              stop_reason: 'end_turn',
              stop_sequence: null
            },
            usage: response.data.usage
          })}\n\n`);

          res.write(`data: ${JSON.stringify({
            type: 'message_stop'
          })}\n\n`);
        }
      } else {
        // 发送错误
        res.write(`data: ${JSON.stringify({
          type: 'error',
          error: {
            type: 'api_error',
            message: response.error || 'Unknown error occurred'
          }
        })}\n\n`);
      }

      res.end();
      resolve();

    } catch (error: any) {
      console.error('流式请求处理失败:', error);
      
      if (!res.destroyed) {
        res.write(`data: ${JSON.stringify({
          type: 'error',
          error: {
            type: 'internal_server_error',
            message: 'Stream processing failed'
          }
        })}\n\n`);
        res.end();
      }
      
      reject(error);
    }
  });
}

/**
 * 将文本分割成小块
 */
function splitTextIntoChunks(text: string, chunkSize: number): string[] {
  const chunks = [];
  for (let i = 0; i < text.length; i += chunkSize) {
    chunks.push(text.substring(i, i + chunkSize));
  }
  return chunks;
}

/**
 * 睡眠函数
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 根据错误信息确定状态码
 */
function getErrorStatusCode(error?: string): number {
  if (!error) return 500;
  
  const lowerError = error.toLowerCase();
  
  if (lowerError.includes('quota') || lowerError.includes('limit')) {
    return 429;
  }
  if (lowerError.includes('unauthorized') || lowerError.includes('api key')) {
    return 401;
  }
  if (lowerError.includes('forbidden')) {
    return 403;
  }
  if (lowerError.includes('not found')) {
    return 404;
  }
  if (lowerError.includes('timeout')) {
    return 504;
  }
  
  return 500;
}

/**
 * 计算使用统计
 */
function calculateUsageStats(usage: any[]): any {
  if (!usage.length) {
    return {
      total_requests: 0,
      successful_requests: 0,
      failed_requests: 0,
      total_tokens: 0,
      input_tokens: 0,
      output_tokens: 0,
      average_response_time: 0,
      success_rate: 0
    };
  }

  const totalRequests = usage.length;
  const successfulRequests = usage.filter(u => u.success).length;
  const failedRequests = totalRequests - successfulRequests;
  
  const totalTokens = usage.reduce((sum, u) => sum + u.totalTokens, 0);
  const inputTokens = usage.reduce((sum, u) => sum + u.inputTokens, 0);
  const outputTokens = usage.reduce((sum, u) => sum + u.outputTokens, 0);
  
  const averageResponseTime = usage.reduce((sum, u) => sum + u.requestDuration, 0) / totalRequests;
  const successRate = (successfulRequests / totalRequests) * 100;

  return {
    total_requests: totalRequests,
    successful_requests: successfulRequests,
    failed_requests: failedRequests,
    total_tokens: totalTokens,
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    average_response_time: Math.round(averageResponseTime),
    success_rate: Math.round(successRate * 100) / 100
  };
}

export default router;
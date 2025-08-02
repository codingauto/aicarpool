/**
 * 统一AI聊天接口 - SmartAiRouter调用入口
 * 
 * 支持：
 * - 三种资源绑定模式的自动路由
 * - 负载均衡和故障转移
 * - 使用量统计和成本计算
 * - 流式和非流式响应
 */

import { NextRequest } from 'next/server';
import { SmartAiRouter, AiRequest } from '@/lib/services/smart-ai-router';
import { createApiResponse } from '@/lib/middleware';
import { verifyToken } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    // 1. 认证验证
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) {
      return createApiResponse(null, false, '缺少认证令牌', 401);
    }

    const user = await verifyToken(token);
    if (!user) {
      return createApiResponse(null, false, '认证令牌无效', 401);
    }

    // 2. 解析请求体
    const body = await request.json();
    const { groupId, messages, serviceType, model, maxTokens, temperature, stream } = body;

    // 3. 参数验证
    if (!groupId) {
      return createApiResponse(null, false, '缺少拼车组ID', 400);
    }

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return createApiResponse(null, false, '缺少或无效的消息列表', 400);
    }

    // 验证消息格式
    const isValidMessages = messages.every(msg => 
      msg.role && ['user', 'assistant', 'system'].includes(msg.role) && 
      typeof msg.content === 'string'
    );

    if (!isValidMessages) {
      return createApiResponse(null, false, '消息格式无效', 400);
    }

    // 4. 构建AI请求
    const aiRequest: AiRequest = {
      messages,
      serviceType: serviceType || 'claude',
      model,
      maxTokens,
      temperature,
      stream: stream || false
    };

    console.log(`🎯 API /api/ai/chat: 用户 ${user.id} 请求拼车组 ${groupId} 的AI服务`);

    // 5. 使用SmartAiRouter处理请求
    const router = new SmartAiRouter();
    
    if (stream) {
      // 流式响应处理
      return await handleStreamResponse(router, groupId, aiRequest);
    } else {
      // 非流式响应处理
      const response = await router.routeRequest(groupId, aiRequest);
      
      return createApiResponse({
        message: response.message,
        usage: response.usage,
        cost: response.cost,
        accountUsed: response.accountUsed,
        timestamp: new Date().toISOString()
      }, true, 200);
    }

  } catch (error) {
    console.error('AI Chat API Error:', error);
    
    // 处理不同类型的错误
    if (error instanceof Error) {
      const errorMessage = error.message;
      
      if (errorMessage.includes('配额') || errorMessage.includes('限制')) {
        return createApiResponse(null, false, errorMessage, 429);
      }
      
      if (errorMessage.includes('账号') || errorMessage.includes('不可用')) {
        return createApiResponse(null, false, errorMessage, 503);
      }
      
      if (errorMessage.includes('权限') || errorMessage.includes('绑定')) {
        return createApiResponse(null, false, errorMessage, 403);
      }
    }
    
    return createApiResponse(null, false, 'AI服务暂时不可用', 500);
  }
}

/**
 * 处理流式响应
 */
async function handleStreamResponse(
  router: SmartAiRouter, 
  groupId: string, 
  aiRequest: AiRequest
) {
  // 创建可读流
  const stream = new ReadableStream({
    async start(controller) {
      try {
        // 暂时简化处理，实际应该实现真正的流式响应
        const response = await router.routeRequest(groupId, aiRequest);
        
        // 模拟流式数据
        const content = response.message.content;
        const words = content.split(' ');
        
        for (let i = 0; i < words.length; i++) {
          const chunk = {
            choices: [{
              delta: {
                content: words[i] + (i < words.length - 1 ? ' ' : '')
              }
            }]
          };
          
          const chunkData = `data: ${JSON.stringify(chunk)}\\n\\n`;
          controller.enqueue(new TextEncoder().encode(chunkData));
          
          // 模拟延迟
          await new Promise(resolve => setTimeout(resolve, 50));
        }
        
        // 发送结束标记
        controller.enqueue(new TextEncoder().encode('data: [DONE]\\n\\n'));
        controller.close();
        
      } catch (error) {
        console.error('Stream error:', error);
        const errorChunk = {
          error: {
            message: error instanceof Error ? error.message : 'Stream error'
          }
        };
        
        const errorData = `data: ${JSON.stringify(errorChunk)}\\n\\n`;
        controller.enqueue(new TextEncoder().encode(errorData));
        controller.close();
      }
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}

/**
 * 获取支持的AI服务列表
 */
export async function GET(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) {
      return createApiResponse(null, false, '缺少认证令牌', 401);
    }

    const user = await verifyToken(token);
    if (!user) {
      return createApiResponse(null, false, '认证令牌无效', 401);
    }

    // 返回支持的AI服务信息
    const supportedServices = [
      {
        serviceType: 'claude',
        displayName: 'Claude',
        models: ['claude-3.5-sonnet', 'claude-3-opus', 'claude-3-haiku'],
        capabilities: ['chat', 'completion', 'analysis']
      },
      {
        serviceType: 'gemini',
        displayName: 'Gemini',
        models: ['gemini-pro', 'gemini-pro-vision'],
        capabilities: ['chat', 'completion', 'vision']
      },
      {
        serviceType: 'openai',
        displayName: 'OpenAI',
        models: ['gpt-4', 'gpt-4-turbo', 'gpt-3.5-turbo'],
        capabilities: ['chat', 'completion', 'embedding']
      },
      {
        serviceType: 'qwen',
        displayName: '通义千问',
        models: ['qwen-max', 'qwen-plus', 'qwen-turbo'],
        capabilities: ['chat', 'completion']
      }
    ];

    return createApiResponse({
      services: supportedServices,
      timestamp: new Date().toISOString()
    }, true, 200);

  } catch (error) {
    console.error('Get AI services error:', error);
    return createApiResponse(null, false, '获取AI服务列表失败', 500);
  }
}
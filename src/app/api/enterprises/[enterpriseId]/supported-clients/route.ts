/**
 * 支持的客户端API
 * 
 * 支持：
 * - 获取系统支持的客户端列表
 * - 客户端权限和功能描述
 */

import { NextRequest } from 'next/server';
import { createApiResponse } from '@/lib/middleware';
import { verifyToken } from '@/lib/auth';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ enterpriseId: string }> }
) {
  try {
    // 1. 认证验证
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    
    // 开发模式：允许无token访问
    let user = null;
    if (process.env.NODE_ENV === 'development' && !token) {
      console.log('🔐 开发模式：支持的客户端列表使用默认测试用户');
      user = {
        id: 'user_test_001',
        email: 'test@example.com',
        name: '测试用户',
        role: 'user'
      };
    } else {
      if (!token) {
        return createApiResponse(false, null, '缺少认证令牌', 401);
      }

      user = await verifyToken(token);
      if (!user) {
        return createApiResponse(false, null, '认证令牌无效', 401);
      }
    }

    const resolvedParams = await params;
    const { enterpriseId } = resolvedParams;
    
    // 2. 参数验证
    if (!enterpriseId) {
      return createApiResponse(false, null, '缺少企业ID', 400);
    }

    // 3. 返回支持的客户端列表
    const supportedClients = [
      {
        id: 'web',
        name: 'Web 客户端',
        description: '基于浏览器的Web应用，支持所有AI服务',
        features: ['chat', 'completion', 'streaming', 'file_upload'],
        platforms: ['desktop', 'mobile']
      },
      {
        id: 'mobile_app',
        name: '移动应用',
        description: 'iOS和Android原生应用',
        features: ['chat', 'completion', 'offline_sync'],
        platforms: ['ios', 'android']
      },
      {
        id: 'desktop_app',
        name: '桌面应用',
        description: 'Windows、macOS、Linux桌面客户端',
        features: ['chat', 'completion', 'file_upload', 'local_storage'],
        platforms: ['windows', 'macos', 'linux']
      },
      {
        id: 'api_client',
        name: 'API 客户端',
        description: '第三方应用通过API调用',
        features: ['completion', 'embedding', 'batch_processing'],
        platforms: ['all']
      },
      {
        id: 'browser_extension',
        name: '浏览器扩展',
        description: 'Chrome、Firefox、Safari浏览器扩展',
        features: ['chat', 'completion', 'web_integration'],
        platforms: ['chrome', 'firefox', 'safari']
      },
      {
        id: 'cli_tool',
        name: '命令行工具',
        description: '终端命令行工具',
        features: ['completion', 'scripting', 'automation'],
        platforms: ['terminal']
      },
      {
        id: 'sdk',
        name: 'SDK 集成',
        description: '开发者SDK，支持多种编程语言',
        features: ['completion', 'embedding', 'custom_integration'],
        platforms: ['python', 'javascript', 'java', 'csharp', 'go']
      },
      {
        id: 'webhook',
        name: 'Webhook 服务',
        description: '服务器间异步通信',
        features: ['async_processing', 'event_driven'],
        platforms: ['server']
      }
    ];

    console.log(`🎯 API 支持的客户端: 返回 ${supportedClients.length} 个客户端类型`);

    return createApiResponse(supportedClients);

  } catch (error) {
    console.error('获取支持的客户端失败:', error);
    return createApiResponse(false, null, '获取支持的客户端失败', 500);
  }
}

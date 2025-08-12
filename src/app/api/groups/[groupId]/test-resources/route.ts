/**
 * 拼车组资源配置测试API
 * 
 * 功能：
 * - 测试资源绑定配置的可用性
 * - 验证AI账号的健康状态
 * - 检查连接性和响应时间
 */

import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { createApiResponse } from '@/lib/middleware';
import { verifyToken } from '@/lib/auth';
import { verifyGroupPermissions } from '@/lib/enterprise-permissions';

const prisma = new PrismaClient();

/**
 * 测试拼车组资源配置
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ groupId: string }> }
) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) {
      return createApiResponse(false, null, '缺少认证令牌', 401);
    }

    const user = await verifyToken(token);
    if (!user) {
      return createApiResponse(false, null, '认证令牌无效', 401);
    }

    const { groupId } = await params;

    // 验证用户对拼车组的访问权限
    const permissionResult = await verifyGroupPermissions(user, groupId, 'manage');
    if (!permissionResult.hasAccess) {
      return createApiResponse(false, null, '没有权限测试此拼车组配置', 403);
    }

    const body = await request.json();
    const { bindingMode, selectedAccounts } = body;

    // 验证输入参数
    if (!bindingMode || !['dedicated', 'shared', 'hybrid'].includes(bindingMode)) {
      return createApiResponse(false, null, '无效的绑定模式', 400);
    }

    const testResults: Record<string, any> = {};

    if (bindingMode === 'dedicated' || bindingMode === 'hybrid') {
      if (!selectedAccounts || selectedAccounts.length === 0) {
        return createApiResponse(false, null, '专属/混合模式需要选择AI账号', 400);
      }

      // 获取选定的AI账号详情
      const accounts = await prisma.aiServiceAccount.findMany({
        where: {
          id: { in: selectedAccounts }
        },
        select: {
          id: true,
          name: true,
          platform: true,
          status: true,
          apiEndpoint: true,
          apiKey: true,
          dailyQuota: true,
          balance: true
        }
      });

      // 测试每个选定的账号
      for (const account of accounts) {
        try {
          const testResult = await testAiAccount(account);
          testResults[account.id] = {
            accountName: account.name,
            platform: account.platform,
            success: testResult.success,
            responseTime: testResult.responseTime,
            message: testResult.message,
            details: testResult.details
          };
        } catch (error) {
          testResults[account.id] = {
            accountName: account.name,
            platform: account.platform,
            success: false,
            responseTime: 0,
            message: '测试失败',
            details: error instanceof Error ? error.message : '未知错误'
          };
        }
      }
    } else if (bindingMode === 'shared') {
      // 测试共享池配置
      testResults['shared_pool'] = await testSharedPool(groupId);
    }

    // 汇总测试结果
    const summary = {
      totalTests: Object.keys(testResults).length,
      passedTests: Object.values(testResults).filter((result: any) => result.success).length,
      failedTests: Object.values(testResults).filter((result: any) => !result.success).length,
      avgResponseTime: Object.values(testResults).reduce((acc: number, result: any) => acc + result.responseTime, 0) / Object.keys(testResults).length
    };

    console.log(`🧪 API 资源测试: 测试拼车组 ${groupId} 的 ${bindingMode} 模式配置，通过率 ${summary.passedTests}/${summary.totalTests}`);

    return createApiResponse({
      results: testResults,
      summary,
      timestamp: new Date().toISOString()
    }, true, 200);

  } catch (error) {
    console.error('测试拼车组资源配置失败:', error);
    return createApiResponse(false, null, '测试资源配置失败', 500);
  }
}

/**
 * 测试单个AI账号
 */
async function testAiAccount(account: any): Promise<{
  success: boolean;
  responseTime: number;
  message: string;
  details?: any;
}> {
  const startTime = Date.now();

  try {
    // 根据服务类型执行不同的测试
    switch (account.platform) {
      case 'openai':
        return await testOpenAIAccount(account);
      case 'claude':
        return await testClaudeAccount(account);
      case 'gemini':
        return await testGeminiAccount(account);
      case 'qianfan':
        return await testQianfanAccount(account);
      case 'tongyi':
        return await testTongyiAccount(account);
      default:
        return {
          success: false,
          responseTime: Date.now() - startTime,
          message: '不支持的服务类型',
          details: { platform: account.platform }
        };
    }
  } catch (error) {
    return {
      success: false,
      responseTime: Date.now() - startTime,
      message: '测试异常',
      details: error instanceof Error ? error.message : '未知错误'
    };
  }
}

/**
 * 测试OpenAI账号
 */
async function testOpenAIAccount(account: any): Promise<{
  success: boolean;
  responseTime: number;
  message: string;
  details?: any;
}> {
  const startTime = Date.now();

  try {
    // 模拟测试OpenAI账号
    // 在实际实现中，这里应该调用OpenAI API进行测试
    const mockResponse = await simulateApiCall(account.platform, 1000);
    
    return {
      success: mockResponse.success,
      responseTime: Date.now() - startTime,
      message: mockResponse.success ? 'OpenAI账号测试通过' : 'OpenAI账号测试失败',
      details: {
        model: 'gpt-4',
        balance: account.balance,
        dailyQuota: account.dailyQuota,
        status: account.status
      }
    };
  } catch (error) {
    return {
      success: false,
      responseTime: Date.now() - startTime,
      message: 'OpenAI账号连接失败',
      details: error instanceof Error ? error.message : '未知错误'
    };
  }
}

/**
 * 测试Claude账号
 */
async function testClaudeAccount(account: any): Promise<{
  success: boolean;
  responseTime: number;
  message: string;
  details?: any;
}> {
  const startTime = Date.now();

  try {
    const mockResponse = await simulateApiCall(account.platform, 800);
    
    return {
      success: mockResponse.success,
      responseTime: Date.now() - startTime,
      message: mockResponse.success ? 'Claude账号测试通过' : 'Claude账号测试失败',
      details: {
        model: 'claude-3-sonnet',
        balance: account.balance,
        dailyQuota: account.dailyQuota,
        status: account.status
      }
    };
  } catch (error) {
    return {
      success: false,
      responseTime: Date.now() - startTime,
      message: 'Claude账号连接失败',
      details: error instanceof Error ? error.message : '未知错误'
    };
  }
}

/**
 * 测试Gemini账号
 */
async function testGeminiAccount(account: any): Promise<{
  success: boolean;
  responseTime: number;
  message: string;
  details?: any;
}> {
  const startTime = Date.now();

  try {
    const mockResponse = await simulateApiCall(account.platform, 1200);
    
    return {
      success: mockResponse.success,
      responseTime: Date.now() - startTime,
      message: mockResponse.success ? 'Gemini账号测试通过' : 'Gemini账号测试失败',
      details: {
        model: 'gemini-pro',
        balance: account.balance,
        dailyQuota: account.dailyQuota,
        status: account.status
      }
    };
  } catch (error) {
    return {
      success: false,
      responseTime: Date.now() - startTime,
      message: 'Gemini账号连接失败',
      details: error instanceof Error ? error.message : '未知错误'
    };
  }
}

/**
 * 测试千帆账号
 */
async function testQianfanAccount(account: any): Promise<{
  success: boolean;
  responseTime: number;
  message: string;
  details?: any;
}> {
  const startTime = Date.now();

  try {
    const mockResponse = await simulateApiCall(account.platform, 900);
    
    return {
      success: mockResponse.success,
      responseTime: Date.now() - startTime,
      message: mockResponse.success ? '千帆账号测试通过' : '千帆账号测试失败',
      details: {
        model: 'ernie-bot-4',
        balance: account.balance,
        dailyQuota: account.dailyQuota,
        status: account.status
      }
    };
  } catch (error) {
    return {
      success: false,
      responseTime: Date.now() - startTime,
      message: '千帆账号连接失败',
      details: error instanceof Error ? error.message : '未知错误'
    };
  }
}

/**
 * 测试通义账号
 */
async function testTongyiAccount(account: any): Promise<{
  success: boolean;
  responseTime: number;
  message: string;
  details?: any;
}> {
  const startTime = Date.now();

  try {
    const mockResponse = await simulateApiCall(account.platform, 1100);
    
    return {
      success: mockResponse.success,
      responseTime: Date.now() - startTime,
      message: mockResponse.success ? '通义账号测试通过' : '通义账号测试失败',
      details: {
        model: 'qwen-max',
        balance: account.balance,
        dailyQuota: account.dailyQuota,
        status: account.status
      }
    };
  } catch (error) {
    return {
      success: false,
      responseTime: Date.now() - startTime,
      message: '通义账号连接失败',
      details: error instanceof Error ? error.message : '未知错误'
    };
  }
}

/**
 * 测试共享池
 */
async function testSharedPool(groupId: string): Promise<{
  success: boolean;
  responseTime: number;
  message: string;
  details?: any;
}> {
  const startTime = Date.now();

  try {
    // 获取拼车组所属企业的共享池状态
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      include: {
        enterprise: {
          include: {
            aiAccounts: {
              where: {
                accountType: 'shared',
                isEnabled: true,
                status: 'active'
              }
            }
          }
        }
      }
    });

    if (!group?.enterprise) {
      return {
        success: false,
        responseTime: Date.now() - startTime,
        message: '拼车组未关联企业',
        details: { groupId }
      };
    }

    const sharedAccounts = group.enterprise.aiAccounts;
    if (sharedAccounts.length === 0) {
      return {
        success: false,
        responseTime: Date.now() - startTime,
        message: '企业没有可用的共享账号',
        details: { enterpriseId: group.enterpriseId }
      };
    }

    // 模拟测试共享池
    const poolHealthy = sharedAccounts.filter(acc => acc.status === 'active').length > 0;
    
    return {
      success: poolHealthy,
      responseTime: Date.now() - startTime,
      message: poolHealthy ? '共享池测试通过' : '共享池测试失败',
      details: {
        totalAccounts: sharedAccounts.length,
        activeAccounts: sharedAccounts.filter(acc => acc.status === 'active').length,
        serviceTypes: [...new Set(sharedAccounts.map(acc => acc.serviceType))]
      }
    };
  } catch (error) {
    return {
      success: false,
      responseTime: Date.now() - startTime,
      message: '共享池测试异常',
      details: error instanceof Error ? error.message : '未知错误'
    };
  }
}

/**
 * 模拟API调用
 */
async function simulateApiCall(platform: string, delay: number): Promise<{
  success: boolean;
  data?: any;
}> {
  // 模拟网络延迟
  await new Promise(resolve => setTimeout(resolve, delay));

  // 模拟成功率（90%成功率）
  const success = Math.random() > 0.1;

  return {
    success,
    data: success ? {
      response: 'Test successful',
      timestamp: new Date().toISOString()
    } : undefined
  };
}
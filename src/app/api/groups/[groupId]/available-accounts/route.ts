import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { verifyToken } from '@/lib/auth/jwt-utils';

const prisma = new PrismaClient();

/**
 * 获取拼车组可用的AI账号列表
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ groupId: string }> }
) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    let decoded = null;
    
    if (token) {
      decoded = verifyToken(token);
    }
    
    // 为了演示目的，如果没有有效token，使用默认用户
    if (!decoded) {
      decoded = {
        userId: 'cmdspjksg0000rffj71l34nt5',
        email: 'demo@gmail.com',
        role: 'user'
      };
      console.log('使用默认用户进行演示');
    }

    const { groupId } = await params;

    // 为演示目的，跳过权限检查，直接返回模拟数据
    console.log('演示模式：为拼车组', groupId, '生成模拟AI账号数据');

    // 生成模拟的AI账号数据
    const mockAiAccounts = [
      {
        id: 'claude-001',
        name: 'Claude Pro Account 1',
        serviceType: 'claude',
        accountType: 'premium',
        dailyLimit: 100000,
        healthStatus: 'healthy',
        lastHealthCheck: new Date().toISOString(),
        createdAt: new Date().toISOString()
      },
      {
        id: 'gemini-001',
        name: 'Gemini Pro Account 1',
        serviceType: 'gemini',
        accountType: 'premium',
        dailyLimit: 150000,
        healthStatus: 'healthy',
        lastHealthCheck: new Date().toISOString(),
        createdAt: new Date().toISOString()
      },
      {
        id: 'openai-001',
        name: 'OpenAI GPT-4 Account 1',
        serviceType: 'openai',
        accountType: 'premium',
        dailyLimit: 80000,
        healthStatus: 'warning',
        lastHealthCheck: new Date().toISOString(),
        createdAt: new Date().toISOString()
      },
      {
        id: 'qwen-001',
        name: '通义千问 Account 1',
        serviceType: 'qwen',
        accountType: 'basic',
        dailyLimit: 50000,
        healthStatus: 'error',
        lastHealthCheck: new Date().toISOString(),
        createdAt: new Date().toISOString()
      }
    ];

    // 模拟负载和健康状态数据
    const accountsWithStats = mockAiAccounts.map(account => ({
      ...account,
      currentLoad: Math.floor(Math.random() * 100), // 模拟当前负载
      isHealthy: Math.random() > 0.2, // 80%的概率健康
      avgResponseTime: Math.floor(Math.random() * 2000) + 500, // 500-2500ms
      dailyUsage: {
        tokens: Math.floor(Math.random() * account.dailyLimit * 0.8),
        cost: Math.floor(Math.random() * 100) / 100
      }
    }));

    // 按服务类型分组
    const accountsByService = accountsWithStats.reduce((groups, account) => {
      const serviceType = account.serviceType;
      if (!groups[serviceType]) {
        groups[serviceType] = [];
      }
      groups[serviceType].push(account);
      return groups;
    }, {} as Record<string, any[]>);

    return NextResponse.json({
      success: true,
      data: {
        accounts: accountsWithStats,
        accountsByService,
        summary: {
          total: accountsWithStats.length,
          healthy: accountsWithStats.filter(acc => acc.isHealthy).length,
          byService: Object.keys(accountsByService).map(serviceType => ({
            serviceType,
            count: accountsByService[serviceType].length,
            healthyCount: accountsByService[serviceType].filter(acc => acc.isHealthy).length
          }))
        }
      }
    });

  } catch (error) {
    console.error('获取可用AI账号失败:', error);
    return NextResponse.json(
      { success: false, error: '获取可用账号失败' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
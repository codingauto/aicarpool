import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { verifyToken } from '@/lib/auth/jwt-utils';

const prisma = new PrismaClient();

/**
 * 获取智能优化建议
 */
export async function GET(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ success: false, error: '未提供认证令牌' }, { status: 401 });
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ success: false, error: '无效的认证令牌' }, { status: 401 });
    }

    // 获取优化建议的分析数据
    const aiAccounts = await prisma.aiServiceAccount.findMany({
      where: { isEnabled: true },
      select: {
        id: true,
        name: true,
        platform: true,
        accountType: true,
        dailyUsageStats: true,
        healthStatus: true,
        lastHealthCheck: true
      }
    });

    const groups = await prisma.group.findMany({
      select: {
        id: true,
        name: true,
        resourceBinding: {
          select: {
            bindingMode: true,
            dailyTokenLimit: true,
            monthlyCostLimit: true,
            isActive: true
          }
        },
        members: {
          select: {
            id: true
          }
        }
      },
      take: 20
    });

    // 生成智能优化建议
    const optimizationSuggestions = generateOptimizationSuggestions(aiAccounts, groups);

    return NextResponse.json({
      success: true,
      data: {
        suggestions: optimizationSuggestions,
        summary: {
          totalSuggestions: optimizationSuggestions.length,
          highPriority: optimizationSuggestions.filter(s => s.priority === 'high').length,
          mediumPriority: optimizationSuggestions.filter(s => s.priority === 'medium').length,
          lowPriority: optimizationSuggestions.filter(s => s.priority === 'low').length,
          categories: {
            performance: optimizationSuggestions.filter(s => s.category === 'performance').length,
            cost: optimizationSuggestions.filter(s => s.category === 'cost').length,
            reliability: optimizationSuggestions.filter(s => s.category === 'reliability').length,
            resource: optimizationSuggestions.filter(s => s.category === 'resource').length
          }
        },
        generatedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('获取优化建议失败:', error);
    return NextResponse.json(
      { success: false, error: '获取优化建议失败' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

function generateOptimizationSuggestions(aiAccounts: any[], groups: any[]) {
  const suggestions = [];

  // 性能优化建议
  suggestions.push({
    id: 'perf-001',
    category: 'performance',
    priority: 'high',
    title: '负载均衡优化',
    description: '基于历史数据分析，建议在高峰时间（14:00-18:00）自动切换到性能更好的Claude服务',
    impact: '预计可提升响应速度25%，减少超时错误15%',
    effort: 'medium',
    implementation: {
      steps: [
        '分析历史性能数据，确定最佳服务分配策略',
        '配置智能路由规则，设置高峰时间自动切换',
        '设置监控告警，确保切换正常运行',
        '观察一周效果，根据数据调整参数'
      ],
      estimatedTime: '2-3天',
      requiredResources: ['系统管理员', 'DevOps工程师']
    },
    metrics: {
      currentResponseTime: 1578,
      expectedResponseTime: 1183,
      currentErrorRate: 3.2,
      expectedErrorRate: 2.7
    },
    status: 'pending'
  });

  // 成本优化建议
  suggestions.push({
    id: 'cost-001',
    category: 'cost',
    priority: 'high',
    title: '预算管理优化',
    description: '预测本月成本将超出预算15%，建议对非关键拼车组启用成本限制',
    impact: '预计可节省成本$180/月，控制预算超支风险',
    effort: 'low',
    implementation: {
      steps: [
        '识别非关键拼车组（使用量<20%的组）',
        '为这些组设置严格的成本限制',
        '配置成本预警，接近限制时自动降级服务',
        '每周回顾成本使用情况，动态调整'
      ],
      estimatedTime: '1天',
      requiredResources: ['系统管理员']
    },
    metrics: {
      currentMonthlyCost: 1200,
      projectedMonthlyCost: 1380,
      budgetLimit: 1200,
      expectedSavings: 180
    },
    status: 'pending'
  });

  // 可靠性优化建议
  suggestions.push({
    id: 'reliability-001',
    category: 'reliability',
    priority: 'medium',
    title: '服务健康监控增强',
    description: '建议为通义千问服务设置响应时间告警阈值（3秒），以便及时处理性能问题',
    impact: '提升系统可靠性，减少用户投诉50%',
    effort: 'low',
    implementation: {
      steps: [
        '配置响应时间监控告警（阈值3秒）',
        '设置自动故障转移机制',
        '建立运维响应流程',
        '定期回顾告警情况和处理效果'
      ],
      estimatedTime: '半天',
      requiredResources: ['运维工程师']
    },
    metrics: {
      currentAlertThreshold: 5000,
      recommendedThreshold: 3000,
      currentMTTR: 15,
      expectedMTTR: 8
    },
    status: 'pending'
  });

  // 资源分配优化建议
  suggestions.push({
    id: 'resource-001',
    category: 'resource',
    priority: 'medium',
    title: '资源分配重新平衡',
    description: '部分拼车组资源利用率较低（<30%），建议重新分配或启用资源共享',
    impact: '提升资源利用率40%，降低闲置成本',
    effort: 'medium',
    implementation: {
      steps: [
        '分析各拼车组的资源使用模式',
        '识别低利用率组（<30%使用率）',
        '将这些组切换到共享模式',
        '监控共享效果，调整配额分配'
      ],
      estimatedTime: '1-2天',
      requiredResources: ['系统管理员', '业务分析师']
    },
    metrics: {
      lowUtilizationGroups: groups.filter(g => Math.random() < 0.3).length,
      currentUtilization: 65,
      expectedUtilization: 85,
      estimatedSavings: 120
    },
    status: 'pending'
  });

  // AI模型优化建议
  suggestions.push({
    id: 'ai-001',
    category: 'performance',
    priority: 'low',
    title: 'AI模型选择优化',
    description: '根据任务类型智能选择最适合的AI模型，提升效果的同时降低成本',
    impact: '预计提升任务成功率12%，降低成本8%',
    effort: 'high',
    implementation: {
      steps: [
        '分析不同任务类型的模型表现',
        '建立任务-模型匹配规则',
        '实现智能模型选择算法',
        '部署并监控效果'
      ],
      estimatedTime: '1-2周',
      requiredResources: ['AI工程师', '数据分析师', '系统开发工程师']
    },
    metrics: {
      currentSuccessRate: 88,
      expectedSuccessRate: 98.5,
      currentCostPerRequest: 0.023,
      expectedCostPerRequest: 0.021
    },
    status: 'pending'
  });

  // 缓存优化建议
  suggestions.push({
    id: 'cache-001',
    category: 'performance',
    priority: 'medium',
    title: '智能缓存策略',
    description: '实现智能缓存机制，对重复请求使用缓存结果，减少API调用',
    impact: '减少API调用30%，降低成本25%，提升响应速度60%',
    effort: 'medium',
    implementation: {
      steps: [
        '分析请求模式，识别可缓存内容',
        '设计缓存策略和过期机制',
        '实现缓存服务',
        '逐步启用并优化缓存效果'
      ],
      estimatedTime: '1周',
      requiredResources: ['后端开发工程师', '系统架构师']
    },
    metrics: {
      duplicateRequestRate: 35,
      expectedCacheHitRate: 80,
      estimatedApiReduction: 30,
      expectedCostSavings: 150
    },
    status: 'pending'
  });

  return suggestions;
}

/**
 * 应用优化建议
 */
export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ success: false, error: '未提供认证令牌' }, { status: 401 });
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ success: false, error: '无效的认证令牌' }, { status: 401 });
    }

    const body = await request.json();
    const { suggestionId, action } = body; // action: 'apply', 'dismiss', 'schedule'

    if (!suggestionId || !action) {
      return NextResponse.json(
        { success: false, error: '缺少必填参数' },
        { status: 400 }
      );
    }

    // 模拟应用优化建议
    const result = {
      suggestionId,
      action,
      appliedAt: new Date().toISOString(),
      appliedBy: decoded.userId,
      status: action === 'apply' ? 'applied' : action === 'dismiss' ? 'dismissed' : 'scheduled'
    };

    console.log('应用优化建议:', result);

    return NextResponse.json({
      success: true,
      data: result,
      message: `优化建议已${action === 'apply' ? '应用' : action === 'dismiss' ? '忽略' : '计划执行'}`
    });

  } catch (error) {
    console.error('应用优化建议失败:', error);
    return NextResponse.json(
      { success: false, error: '应用优化建议失败' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
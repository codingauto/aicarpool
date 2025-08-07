/**
 * API Key标签API
 * 
 * 支持：
 * - 获取企业下所有API Key的标签
 * - 标签统计和使用频率
 */

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
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
      console.log('🔐 开发模式：API Key标签列表使用默认测试用户');
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

    // 3. 权限验证 - 检查用户是否属于该企业
    const enterprise = await prisma.enterprise.findUnique({
      where: { id: enterpriseId }
    });

    if (!enterprise) {
      return createApiResponse(false, null, '企业不存在', 404);
    }

    // 4. 获取企业下所有API Keys
    const apiKeys = await prisma.apiKey.findMany({
      where: {
        group: {
          enterpriseId
        },
        status: { not: 'deleted' }
      },
      select: {
        id: true,
        tags: true
      }
    });

    // 5. 统计标签使用情况
    const tagCount: { [key: string]: number } = {};
    const allTags: string[] = [];

    apiKeys.forEach(apiKey => {
      if (apiKey.tags && Array.isArray(apiKey.tags)) {
        apiKey.tags.forEach(tag => {
          if (tag && typeof tag === 'string') {
            if (!tagCount[tag]) {
              tagCount[tag] = 0;
              allTags.push(tag);
            }
            tagCount[tag]++;
          }
        });
      }
    });

    // 6. 格式化标签数据
    const formattedTags = allTags.map(tag => ({
      name: tag,
      count: tagCount[tag],
      usageRate: (tagCount[tag] / apiKeys.length * 100).toFixed(1)
    })).sort((a, b) => b.count - a.count);

    console.log(`🎯 API API Key标签: 返回企业 ${enterpriseId} 的 ${formattedTags.length} 个标签`);

    return createApiResponse(formattedTags);

  } catch (error) {
    console.error('获取API Key标签失败:', error);
    return createApiResponse(false, null, '获取API Key标签失败', 500);
  }
}

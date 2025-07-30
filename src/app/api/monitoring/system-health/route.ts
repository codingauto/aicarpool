import { NextRequest } from 'next/server';
import { createApiResponse } from '@/lib/middleware';

export async function GET(req: NextRequest) {
  try {
    // 模拟系统健康数据
    const systemHealth = {
      timestamp: new Date().toISOString(),
      overall_status: 'healthy',
      services: {
        database: {
          status: 'healthy',
          response_time_ms: 12,
          connections: 8,
          max_connections: 100
        },
        redis: {
          status: 'healthy',
          response_time_ms: 2,
          memory_usage_mb: 45.2,
          max_memory_mb: 512
        },
        ai_services: {
          claude: {
            status: 'healthy',
            success_rate: 99.2,
            avg_response_time_ms: 850,
            requests_last_hour: 1250
          },
          gemini: {
            status: 'healthy',
            success_rate: 98.5,
            avg_response_time_ms: 1100,
            requests_last_hour: 320
          },
          ampcode: {
            status: 'degraded',
            success_rate: 95.1,
            avg_response_time_ms: 1800,
            requests_last_hour: 85
          }
        }
      },
      edge_nodes: {
        total: 3,
        online: 2,
        offline: 1,
        avg_health_score: 79.6
      },
      performance: {
        total_requests_today: 15420,
        avg_response_time_ms: 920,
        error_rate_percent: 1.2,
        peak_requests_per_minute: 180
      }
    };

    return createApiResponse(systemHealth, true, 200);

  } catch (error) {
    console.error('Get system health error:', error);
    return createApiResponse({ error: 'Failed to get system health' }, false, 500);
  }
}
import { NextRequest } from 'next/server';
import { createApiResponse } from '@/lib/middleware';

export async function GET() {
  try {
    // 模拟边缘节点数据，匹配前端 EdgeNode 接口
    const mockEdgeNodes = [
      {
        id: 'edge-node-1',
        nodeId: 'edge-node-1',
        nodeName: '新加坡节点 1',
        location: '新加坡',
        endpoint: 'https://sg1.aicarpool.com:8080',
        status: 'active' as const,
        capabilities: {
          cpu: { cores: 8, frequency: '3.2GHz' },
          memory: { total: '16GB', available: '12GB' },
          network: { bandwidth: '1Gbps', latency: 15 },
          maxConnections: 1000
        },
        currentLoad: {
          cpu: 25.5,
          memory: 35.2,
          connections: 45,
          requestsPerSecond: 12
        },
        healthScore: 95.5,
        lastHeartbeat: new Date(),
        version: 'v1.2.3'
      },
      {
        id: 'edge-node-2',
        nodeId: 'edge-node-2',
        nodeName: '美西节点 1',
        location: '美国西部',
        endpoint: 'https://usw1.aicarpool.com:8080',
        status: 'active' as const,
        capabilities: {
          cpu: { cores: 16, frequency: '3.5GHz' },
          memory: { total: '32GB', available: '24GB' },
          network: { bandwidth: '10Gbps', latency: 8 },
          maxConnections: 2000
        },
        currentLoad: {
          cpu: 18.3,
          memory: 28.7,
          connections: 32,
          requestsPerSecond: 8
        },
        healthScore: 98.2,
        lastHeartbeat: new Date(),
        version: 'v1.2.3'
      },
      {
        id: 'edge-node-3',
        nodeId: 'edge-node-3',
        nodeName: '欧洲节点 1',
        location: '德国',
        endpoint: 'https://eu1.aicarpool.com:8080',
        status: 'maintenance' as const,
        capabilities: {
          cpu: { cores: 4, frequency: '2.8GHz' },
          memory: { total: '8GB', available: '6GB' },
          network: { bandwidth: '500Mbps', latency: 25 },
          maxConnections: 500
        },
        currentLoad: {
          cpu: 5.1,
          memory: 12.4,
          connections: 0,
          requestsPerSecond: 0
        },
        healthScore: 45.0,
        lastHeartbeat: new Date(Date.now() - 5 * 60 * 1000),
        version: 'v1.2.1'
      }
    ];

    const summary = {
      total_nodes: mockEdgeNodes.length,
      active_nodes: mockEdgeNodes.filter(node => node.status === 'active').length,
      inactive_nodes: mockEdgeNodes.filter(node => node.status !== 'active').length,
      total_requests_per_minute: mockEdgeNodes.reduce((sum, node) => sum + node.currentLoad.requestsPerSecond, 0)
    };

    return createApiResponse(true, {
      nodes: mockEdgeNodes,
      summary
    }, '获取边缘节点列表成功', 200);

  } catch (error) {
    console.error('Get edge nodes error:', error);
    return createApiResponse(false, null, 'Failed to get edge nodes', 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    
    // 模拟节点注册
    const newNode = {
      node_id: `edge-node-${Date.now()}`,
      node_token: `token_${Math.random().toString(36).substring(2)}`,
      heartbeat_interval: 60,
      assigned_groups: [],
      initial_config_version: 1,
      ...body
    };

    return createApiResponse(true, newNode);

  } catch (error) {
    console.error('Register edge node error:', error);
    return createApiResponse(false, null, 'Failed to register edge node', 500);
  }
}
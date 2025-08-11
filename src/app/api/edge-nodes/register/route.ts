import { NextRequest } from 'next/server';
import { createApiResponse } from '@/lib/middleware';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    
    // 验证必要字段
    const { nodeName, location, endpoint, capabilities } = body;
    
    if (!nodeName || typeof nodeName !== 'string') {
      return createApiResponse(false, null, '节点名称不能为空', 400);
    }
    
    if (!location || !endpoint || !capabilities) {
      return createApiResponse(false, null, '缺少必要的字段', 400);
    }
    
    // 模拟节点注册
    const newNode = {
      id: `edge-node-${Date.now()}`,
      nodeId: `edge-node-${Date.now()}`,
      nodeName: String(nodeName), // 确保是字符串
      location: String(location),
      endpoint: String(endpoint),
      status: 'active' as const,
      capabilities,
      currentLoad: {
        cpu: 0,
        memory: 0,
        connections: 0,
        requestsPerSecond: 0
      },
      healthScore: 100,
      lastHeartbeat: new Date(),
      version: 'v1.0.0',
      node_token: `token_${Math.random().toString(36).substring(2)}`,
      heartbeat_interval: 60,
      assigned_groups: [],
      initial_config_version: 1
    };

    return createApiResponse(true, newNode, '节点注册成功', 200);

  } catch (error) {
    console.error('Register edge node error:', error);
    return createApiResponse(false, null, '节点注册失败', 500);
  }
}
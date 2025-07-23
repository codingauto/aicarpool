import { prisma } from './db';
import crypto from 'crypto';

export interface EdgeNodeInfo {
  id: string;
  nodeId: string;
  serverId?: string;
  nodeName: string;
  location: string;
  endpoint: string;
  publicKey: string;
  status: 'active' | 'inactive' | 'maintenance';
  capabilities: {
    cpu: { cores: number; frequency: string };
    memory: { total: string; available: string };
    network: { bandwidth: string; latency: number };
    maxConnections: number;
  };
  currentLoad: {
    cpu: number;
    memory: number;
    connections: number;
    requestsPerSecond: number;
  };
  healthScore: number;
  lastHeartbeat?: Date;
  version: string;
  metadata?: Record<string, any>;
}

export interface NodeRegistration {
  nodeName: string;
  location: string;
  endpoint: string;
  capabilities: EdgeNodeInfo['capabilities'];
  serverId?: string;
}

export interface LoadBalancingStrategy {
  algorithm: 'round_robin' | 'least_connections' | 'weighted_round_robin' | 'geographic' | 'health_based';
  weights?: Record<string, number>;
  healthThreshold?: number;
  geographicPreference?: string[];
}

export class EdgeNodeManager {
  // 注册新的边缘节点
  async registerNode(registration: NodeRegistration): Promise<{
    nodeId: string;
    publicKey: string;
    privateKey: string;
    endpoint: string;
  }> {
    // 生成唯一的节点ID
    const nodeId = `edge_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // 生成密钥对用于节点认证
    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });

    // 检查节点名称是否重复
    const existingNode = await prisma.edgeNode.findFirst({
      where: { nodeName: registration.nodeName },
    });

    if (existingNode) {
      throw new Error(`节点名称 ${registration.nodeName} 已存在`);
    }

    // 创建边缘节点记录
    const node = await prisma.edgeNode.create({
      data: {
        nodeId,
        serverId: registration.serverId,
        nodeName: registration.nodeName,
        location: registration.location,
        endpoint: registration.endpoint,
        publicKey,
        status: 'active',
        capabilities: registration.capabilities,
        currentLoad: {
          cpu: 0,
          memory: 0,
          connections: 0,
          requestsPerSecond: 0,
        },
        healthScore: 100,
        lastHeartbeat: new Date(),
        version: '1.0.0',
      },
    });

    return {
      nodeId: node.nodeId,
      publicKey,
      privateKey,
      endpoint: registration.endpoint,
    };
  }

  // 获取所有边缘节点
  async getAllNodes(): Promise<EdgeNodeInfo[]> {
    const nodes = await prisma.edgeNode.findMany({
      orderBy: { createdAt: 'desc' },
    });

    return nodes.map(node => this.formatNodeInfo(node));
  }

  // 获取活跃的边缘节点
  async getActiveNodes(): Promise<EdgeNodeInfo[]> {
    const nodes = await prisma.edgeNode.findMany({
      where: {
        status: 'active',
        healthScore: { gte: 50 },
        lastHeartbeat: {
          gte: new Date(Date.now() - 5 * 60 * 1000), // 5分钟内有心跳
        },
      },
      orderBy: { healthScore: 'desc' },
    });

    return nodes.map(node => this.formatNodeInfo(node));
  }

  // 获取拼车组绑定的边缘节点
  async getGroupNodes(groupId: string): Promise<EdgeNodeInfo[]> {
    const groupNodes = await prisma.edgeNodeGroup.findMany({
      where: {
        groupId,
        isEnabled: true,
      },
      include: {
        node: true,
      },
      orderBy: { priority: 'asc' },
    });

    return groupNodes
      .filter(gn => gn.node.status === 'active')
      .map(gn => this.formatNodeInfo(gn.node));
  }

  // 将边缘节点绑定到拼车组
  async bindNodeToGroup(
    nodeId: string,
    groupId: string,
    priority: number = 1,
    config?: Record<string, any>
  ): Promise<void> {
    // 验证节点存在
    const node = await prisma.edgeNode.findUnique({
      where: { nodeId },
    });

    if (!node) {
      throw new Error('边缘节点不存在');
    }

    // 检查是否已绑定
    const existingBinding = await prisma.edgeNodeGroup.findFirst({
      where: { nodeId: node.id, groupId },
    });

    if (existingBinding) {
      throw new Error('节点已绑定到该组');
    }

    await prisma.edgeNodeGroup.create({
      data: {
        nodeId: node.id,
        groupId,
        priority,
        isEnabled: true,
        config: config || {},
      },
    });
  }

  // 解绑边缘节点
  async unbindNodeFromGroup(nodeId: string, groupId: string): Promise<void> {
    const node = await prisma.edgeNode.findUnique({
      where: { nodeId },
    });

    if (!node) {
      throw new Error('边缘节点不存在');
    }

    await prisma.edgeNodeGroup.deleteMany({
      where: {
        nodeId: node.id,
        groupId,
      },
    });
  }

  // 处理节点心跳
  async handleHeartbeat(
    nodeId: string,
    heartbeatData: {
      currentLoad: EdgeNodeInfo['currentLoad'];
      status?: 'active' | 'maintenance';
      metadata?: Record<string, any>;
    }
  ): Promise<void> {
    const node = await prisma.edgeNode.findUnique({
      where: { nodeId },
    });

    if (!node) {
      throw new Error('节点不存在');
    }

    // 计算健康分数
    const healthScore = this.calculateHealthScore(heartbeatData.currentLoad);

    await prisma.edgeNode.update({
      where: { nodeId },
      data: {
        currentLoad: heartbeatData.currentLoad,
        healthScore,
        lastHeartbeat: new Date(),
        status: heartbeatData.status || node.status,
        metadata: {
          ...((node.metadata as any) || {}),
          ...(heartbeatData.metadata || {}),
        },
      },
    });

    // 记录性能指标
    await this.recordNodeMetrics(node.id, heartbeatData.currentLoad);
  }

  // 智能负载调度
  async selectOptimalNodes(
    groupId: string,
    strategy: LoadBalancingStrategy,
    count: number = 1
  ): Promise<EdgeNodeInfo[]> {
    const availableNodes = await this.getGroupNodes(groupId);

    if (availableNodes.length === 0) {
      throw new Error('没有可用的边缘节点');
    }

    // 过滤健康的节点
    const healthyNodes = availableNodes.filter(
      node => node.healthScore >= (strategy.healthThreshold || 50)
    );

    if (healthyNodes.length === 0) {
      throw new Error('没有健康的边缘节点');
    }

    let selectedNodes: EdgeNodeInfo[] = [];

    switch (strategy.algorithm) {
      case 'round_robin':
        selectedNodes = this.selectRoundRobin(healthyNodes, count);
        break;
      
      case 'least_connections':
        selectedNodes = this.selectLeastConnections(healthyNodes, count);
        break;
      
      case 'weighted_round_robin':
        selectedNodes = this.selectWeightedRoundRobin(healthyNodes, strategy.weights || {}, count);
        break;
      
      case 'geographic':
        selectedNodes = this.selectGeographic(healthyNodes, strategy.geographicPreference || [], count);
        break;
      
      case 'health_based':
        selectedNodes = this.selectHealthBased(healthyNodes, count);
        break;
      
      default:
        selectedNodes = this.selectHealthBased(healthyNodes, count);
    }

    return selectedNodes;
  }

  // 配置同步
  async syncConfiguration(
    nodeId: string,
    configuration: {
      aiServices?: Record<string, any>;
      routing?: Record<string, any>;
      security?: Record<string, any>;
    }
  ): Promise<void> {
    const node = await prisma.edgeNode.findUnique({
      where: { nodeId },
    });

    if (!node) {
      throw new Error('节点不存在');
    }

    // 更新节点配置
    await prisma.edgeNode.update({
      where: { nodeId },
      data: {
        metadata: {
          ...((node.metadata as any) || {}),
          configuration,
          lastConfigSync: new Date(),
        },
      },
    });

    // 这里可以触发实际的配置推送
    await this.pushConfigurationToNode(nodeId, configuration);
  }

  // 获取节点统计信息
  async getNodeStatistics(
    nodeId: string,
    timeRange: { start: Date; end: Date }
  ): Promise<{
    metrics: Array<{
      timestamp: Date;
      cpu: number;
      memory: number;
      network: number;
      requests: number;
    }>;
    averages: {
      cpu: number;
      memory: number;
      network: number;
      requests: number;
    };
    uptime: number;
  }> {
    const node = await prisma.edgeNode.findUnique({
      where: { nodeId },
    });

    if (!node) {
      throw new Error('节点不存在');
    }

    const metrics = await prisma.edgeNodeMetric.findMany({
      where: {
        nodeId: node.id,
        timestamp: {
          gte: timeRange.start,
          lte: timeRange.end,
        },
      },
      orderBy: { timestamp: 'asc' },
    });

    // 按时间戳分组统计
    const groupedMetrics = new Map<string, any>();
    
    metrics.forEach(metric => {
      const timestamp = metric.timestamp.toISOString();
      if (!groupedMetrics.has(timestamp)) {
        groupedMetrics.set(timestamp, {
          timestamp: metric.timestamp,
          cpu: 0,
          memory: 0,
          network: 0,
          requests: 0,
        });
      }
      
      const group = groupedMetrics.get(timestamp);
      switch (metric.metricType) {
        case 'cpu':
          group.cpu = Number(metric.value);
          break;
        case 'memory':
          group.memory = Number(metric.value);
          break;
        case 'network':
          group.network = Number(metric.value);
          break;
        case 'requests':
          group.requests = Number(metric.value);
          break;
      }
    });

    const metricsArray = Array.from(groupedMetrics.values());

    // 计算平均值
    const averages = metricsArray.reduce(
      (acc, curr) => ({
        cpu: acc.cpu + curr.cpu,
        memory: acc.memory + curr.memory,
        network: acc.network + curr.network,
        requests: acc.requests + curr.requests,
      }),
      { cpu: 0, memory: 0, network: 0, requests: 0 }
    );

    if (metricsArray.length > 0) {
      averages.cpu /= metricsArray.length;
      averages.memory /= metricsArray.length;
      averages.network /= metricsArray.length;
      averages.requests /= metricsArray.length;
    }

    // 计算在线时间百分比
    const totalTime = timeRange.end.getTime() - timeRange.start.getTime();
    const heartbeats = await prisma.edgeNode.count({
      where: {
        nodeId,
        lastHeartbeat: {
          gte: timeRange.start,
          lte: timeRange.end,
        },
      },
    });

    const uptime = heartbeats > 0 ? Math.min(100, (heartbeats * 60000) / totalTime * 100) : 0;

    return {
      metrics: metricsArray,
      averages,
      uptime,
    };
  }

  // 私有方法：格式化节点信息
  private formatNodeInfo(node: any): EdgeNodeInfo {
    return {
      id: node.id,
      nodeId: node.nodeId,
      serverId: node.serverId || undefined,
      nodeName: node.nodeName,
      location: node.location,
      endpoint: node.endpoint,
      publicKey: node.publicKey,
      status: node.status,
      capabilities: node.capabilities as EdgeNodeInfo['capabilities'],
      currentLoad: node.currentLoad as EdgeNodeInfo['currentLoad'],
      healthScore: node.healthScore,
      lastHeartbeat: node.lastHeartbeat || undefined,
      version: node.version,
      metadata: node.metadata as Record<string, any> || undefined,
    };
  }

  // 私有方法：计算健康分数
  private calculateHealthScore(load: EdgeNodeInfo['currentLoad']): number {
    let score = 100;

    // CPU使用率影响
    if (load.cpu > 80) score -= 20;
    else if (load.cpu > 60) score -= 10;

    // 内存使用率影响
    if (load.memory > 90) score -= 20;
    else if (load.memory > 70) score -= 10;

    // 连接数影响（假设最大1000连接）
    const connectionRatio = load.connections / 1000;
    if (connectionRatio > 0.9) score -= 15;
    else if (connectionRatio > 0.7) score -= 8;

    return Math.max(0, score);
  }

  // 私有方法：记录节点指标
  private async recordNodeMetrics(nodeId: string, load: EdgeNodeInfo['currentLoad']): Promise<void> {
    const timestamp = new Date();

    const metrics = [
      { metricType: 'cpu', value: load.cpu, unit: 'percent' },
      { metricType: 'memory', value: load.memory, unit: 'percent' },
      { metricType: 'network', value: load.requestsPerSecond, unit: 'rps' },
      { metricType: 'requests', value: load.connections, unit: 'count' },
    ];

    await prisma.edgeNodeMetric.createMany({
      data: metrics.map(metric => ({
        nodeId,
        metricType: metric.metricType,
        value: metric.value,
        unit: metric.unit,
        timestamp,
      })),
    });
  }

  // 负载均衡选择算法
  private selectRoundRobin(nodes: EdgeNodeInfo[], count: number): EdgeNodeInfo[] {
    const selected = [];
    for (let i = 0; i < count && i < nodes.length; i++) {
      selected.push(nodes[i % nodes.length]);
    }
    return selected;
  }

  private selectLeastConnections(nodes: EdgeNodeInfo[], count: number): EdgeNodeInfo[] {
    return nodes
      .sort((a, b) => a.currentLoad.connections - b.currentLoad.connections)
      .slice(0, count);
  }

  private selectWeightedRoundRobin(
    nodes: EdgeNodeInfo[],
    weights: Record<string, number>,
    count: number
  ): EdgeNodeInfo[] {
    const weighted = nodes.map(node => ({
      node,
      weight: weights[node.nodeId] || 1,
    }));

    // 简化的加权轮询
    return weighted
      .sort((a, b) => b.weight - a.weight)
      .slice(0, count)
      .map(w => w.node);
  }

  private selectGeographic(
    nodes: EdgeNodeInfo[],
    preferences: string[],
    count: number
  ): EdgeNodeInfo[] {
    const sorted = nodes.sort((a, b) => {
      const aIndex = preferences.indexOf(a.location);
      const bIndex = preferences.indexOf(b.location);
      
      if (aIndex === -1 && bIndex === -1) return 0;
      if (aIndex === -1) return 1;
      if (bIndex === -1) return -1;
      
      return aIndex - bIndex;
    });

    return sorted.slice(0, count);
  }

  private selectHealthBased(nodes: EdgeNodeInfo[], count: number): EdgeNodeInfo[] {
    return nodes
      .sort((a, b) => b.healthScore - a.healthScore)
      .slice(0, count);
  }

  // 私有方法：推送配置到节点
  private async pushConfigurationToNode(
    nodeId: string,
    configuration: Record<string, any>
  ): Promise<void> {
    // 这里可以实现实际的配置推送逻辑
    // 例如：通过WebSocket、HTTP API等方式推送到边缘节点
    console.log(`Pushing configuration to node ${nodeId}:`, configuration);
  }
}

// 单例边缘节点管理器
export const edgeNodeManager = new EdgeNodeManager();
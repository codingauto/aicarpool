import { AIServiceFactory, SupportedAIService } from './factory';
import { ChatRequest, ChatResponse, AIServiceConfig } from './base';
import { prisma } from '@/lib/db';

export interface ServiceRoute {
  serviceId: string;
  serviceName: string;
  priority: number;
  isEnabled: boolean;
  healthScore: number;
  responseTime: number;
  errorRate: number;
  lastHealthCheck: Date;
}

export interface RoutingConfig {
  strategy: 'round_robin' | 'priority' | 'least_connections' | 'response_time';
  failoverEnabled: boolean;
  healthCheckInterval: number;
  maxRetries: number;
  timeout: number;
}

export class AiServiceRouter {
  private routes: Map<string, ServiceRoute[]> = new Map();
  private connections: Map<string, number> = new Map();
  private roundRobinIndex: Map<string, number> = new Map();

  constructor() {}

  async initializeRoutes(groupId: string): Promise<void> {
    const groupServices = await prisma.groupAiService.findMany({
      where: {
        groupId,
        isEnabled: true,
      },
      include: {
        aiService: true,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    const routes: ServiceRoute[] = groupServices.map((service, index) => ({
      serviceId: service.aiServiceId,
      serviceName: service.aiService.serviceName,
      priority: index + 1,
      isEnabled: service.isEnabled,
      healthScore: 100,
      responseTime: 0,
      errorRate: 0,
      lastHealthCheck: new Date(),
    }));

    this.routes.set(groupId, routes);
    this.connections.set(groupId, 0);
    this.roundRobinIndex.set(groupId, 0);
  }

  async routeRequest(
    groupId: string,
    request: ChatRequest,
    config: RoutingConfig = {
      strategy: 'priority',
      failoverEnabled: true,
      healthCheckInterval: 300000, // 5分钟
      maxRetries: 3,
      timeout: 30000, // 30秒
    }
  ): Promise<ChatResponse> {
    let routes = this.routes.get(groupId);
    
    if (!routes) {
      await this.initializeRoutes(groupId);
      routes = this.routes.get(groupId);
    }

    if (!routes || routes.length === 0) {
      throw new Error('没有可用的AI服务');
    }

    // 过滤可用服务
    const availableRoutes = routes.filter(route => 
      route.isEnabled && route.healthScore > 50
    );

    if (availableRoutes.length === 0) {
      throw new Error('所有AI服务都不可用');
    }

    let selectedRoute: ServiceRoute | null = null;
    let attempts = 0;
    const maxAttempts = Math.min(config.maxRetries, availableRoutes.length);

    while (attempts < maxAttempts && !selectedRoute) {
      const route = this.selectRoute(groupId, availableRoutes, config.strategy);
      
      try {
        const startTime = Date.now();
        
        // 增加连接计数
        this.incrementConnections(groupId);
        
        // 创建服务实例并发送请求
        const service = await this.createServiceInstance(groupId, route.serviceId, route.serviceName);
        const response = await Promise.race([
          service.chat(request),
          this.createTimeoutPromise(config.timeout),
        ]);

        const responseTime = Date.now() - startTime;
        
        // 更新路由统计
        this.updateRouteStats(groupId, route.serviceId, {
          responseTime,
          success: true,
        });

        // 减少连接计数
        this.decrementConnections(groupId);

        return response;

      } catch (error) {
        attempts++;
        
        // 更新路由统计
        this.updateRouteStats(groupId, route.serviceId, {
          responseTime: Date.now() - Date.now(),
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });

        // 减少连接计数
        this.decrementConnections(groupId);

        if (!config.failoverEnabled || attempts >= maxAttempts) {
          throw error;
        }

        // 降低失败服务的健康分数
        this.degradeService(groupId, route.serviceId);
        
        console.warn(`Service ${route.serviceName} failed, attempting failover:`, error);
      }
    }

    throw new Error('所有服务重试均失败');
  }

  private selectRoute(
    groupId: string,
    routes: ServiceRoute[],
    strategy: string
  ): ServiceRoute {
    switch (strategy) {
      case 'round_robin':
        return this.roundRobinSelection(groupId, routes);
      
      case 'priority':
        return this.prioritySelection(routes);
      
      case 'least_connections':
        return this.leastConnectionsSelection(routes);
      
      case 'response_time':
        return this.responseTimeSelection(routes);
      
      default:
        return this.prioritySelection(routes);
    }
  }

  private roundRobinSelection(groupId: string, routes: ServiceRoute[]): ServiceRoute {
    const currentIndex = this.roundRobinIndex.get(groupId) || 0;
    const selectedRoute = routes[currentIndex % routes.length];
    this.roundRobinIndex.set(groupId, currentIndex + 1);
    return selectedRoute;
  }

  private prioritySelection(routes: ServiceRoute[]): ServiceRoute {
    return routes.sort((a, b) => {
      // 首先按健康分数排序
      if (a.healthScore !== b.healthScore) {
        return b.healthScore - a.healthScore;
      }
      // 然后按优先级排序
      return a.priority - b.priority;
    })[0];
  }

  private leastConnectionsSelection(routes: ServiceRoute[]): ServiceRoute {
    return routes.sort((a, b) => {
      const connectionsA = this.connections.get(`${a.serviceId}`) || 0;
      const connectionsB = this.connections.get(`${b.serviceId}`) || 0;
      return connectionsA - connectionsB;
    })[0];
  }

  private responseTimeSelection(routes: ServiceRoute[]): ServiceRoute {
    return routes.sort((a, b) => {
      // 按响应时间和健康分数的综合得分排序
      const scoreA = (a.healthScore / 100) * (1000 / Math.max(a.responseTime, 1));
      const scoreB = (b.healthScore / 100) * (1000 / Math.max(b.responseTime, 1));
      return scoreB - scoreA;
    })[0];
  }

  private incrementConnections(groupId: string): void {
    const current = this.connections.get(groupId) || 0;
    this.connections.set(groupId, current + 1);
  }

  private decrementConnections(groupId: string): void {
    const current = this.connections.get(groupId) || 0;
    this.connections.set(groupId, Math.max(0, current - 1));
  }

  private updateRouteStats(
    groupId: string,
    serviceId: string,
    stats: {
      responseTime: number;
      success: boolean;
      error?: string;
    }
  ): void {
    const routes = this.routes.get(groupId);
    if (!routes) return;

    const route = routes.find(r => r.serviceId === serviceId);
    if (!route) return;

    // 更新响应时间（移动平均）
    route.responseTime = (route.responseTime * 0.7) + (stats.responseTime * 0.3);

    // 更新健康分数
    if (stats.success) {
      route.healthScore = Math.min(100, route.healthScore + 2);
      route.errorRate = route.errorRate * 0.9; // 降低错误率
    } else {
      route.healthScore = Math.max(0, route.healthScore - 10);
      route.errorRate = (route.errorRate * 0.9) + 0.1; // 增加错误率
    }

    route.lastHealthCheck = new Date();

    // 记录统计数据到数据库
    this.recordUsageStats(groupId, serviceId, stats);
  }

  private async recordUsageStats(
    groupId: string,
    serviceId: string,
    stats: {
      responseTime: number;
      success: boolean;
      error?: string;
    }
  ): Promise<void> {
    try {
      // 这里可以记录详细的使用统计
      // 暂时省略实现，后续可以扩展
      console.log(`Recording stats for ${serviceId}:`, stats);
    } catch (error) {
      console.error('Failed to record usage stats:', error);
    }
  }

  private degradeService(groupId:string, serviceId: string): void {
    const routes = this.routes.get(groupId);
    if (!routes) return;

    const route = routes.find(r => r.serviceId === serviceId);
    if (route) {
      route.healthScore = Math.max(0, route.healthScore - 20);
    }
  }

  private createTimeoutPromise(timeout: number): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Request timeout')), timeout);
    });
  }

  // 健康检查方法
  async performHealthCheck(groupId: string): Promise<void> {
    const routes = this.routes.get(groupId);
    if (!routes) return;

    const healthCheckPromises = routes.map(async (route) => {
      try {
        const service = await this.createServiceInstance(groupId, route.serviceId, route.serviceName);
        const startTime = Date.now();
        
        // 发送健康检查请求
        await service.healthCheck();
        
        const responseTime = Date.now() - startTime;
        
        // 更新健康分数
        route.healthScore = Math.min(100, route.healthScore + 5);
        route.responseTime = responseTime;
        route.lastHealthCheck = new Date();
        
      } catch (error) {
        console.warn(`Health check failed for ${route.serviceName}:`, error);
        route.healthScore = Math.max(0, route.healthScore - 15);
        route.lastHealthCheck = new Date();
      }
    });

    await Promise.allSettled(healthCheckPromises);
  }

  // 创建服务实例
  private async createServiceInstance(groupId: string, serviceId: string, serviceName: string) {
    const groupService = await prisma.groupAiService.findFirst({
      where: {
        groupId,
        aiServiceId: serviceId,
        isEnabled: true,
      },
      include: {
        aiService: true,
      },
    });

    if (!groupService) {
      throw new Error(`Service ${serviceName} not found or disabled`);
    }

    const authConfig = groupService.authConfig as any;
    if (!authConfig?.apiKey) {
      throw new Error(`Service ${serviceName} not configured`);
    }

    const serviceConfig: AIServiceConfig = {
      apiKey: authConfig.apiKey,
      baseUrl: groupService.aiService.baseUrl,
      timeout: 30000,
    };

    return AIServiceFactory.create(serviceName as SupportedAIService, serviceConfig);
  }

  // 获取路由状态
  getRouteStatus(groupId: string): ServiceRoute[] | undefined {
    return this.routes.get(groupId);
  }

  // 手动禁用服务
  disableService(groupId: string, serviceId: string): void {
    const routes = this.routes.get(groupId);
    if (!routes) return;

    const route = routes.find(r => r.serviceId === serviceId);
    if (route) {
      route.isEnabled = false;
    }
  }

  // 手动启用服务
  enableService(groupId: string, serviceId: string): void {
    const routes = this.routes.get(groupId);
    if (!routes) return;

    const route = routes.find(r => r.serviceId === serviceId);
    if (route) {
      route.isEnabled = true;
      route.healthScore = 100; // 重置健康分数
    }
  }
}

// 单例路由器
export const aiServiceRouter = new AiServiceRouter();
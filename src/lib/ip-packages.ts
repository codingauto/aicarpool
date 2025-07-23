import { prisma } from './db';

export interface IpPackageInfo {
  id: string;
  name: string;
  description?: string;
  packageType: 'residential_dual_isp' | 'datacenter' | 'mobile';
  maxConnections: number;
  bandwidth: string;
  locations: string[];
  monthlyPrice: number;
  setupFee: number;
  features: Record<string, any>;
  isEnabled: boolean;
  sortOrder: number;
  servers?: ServerInfo[];
}

export interface ServerInfo {
  id: string;
  serverName: string;
  hostname: string;
  ipAddress: string;
  location: string;
  provider: string;
  specs: {
    cpu: string;
    memory: string;
    storage: string;
    bandwidth: string;
  };
  status: 'active' | 'maintenance' | 'offline';
  healthScore: number;
  lastCheckAt?: Date;
}

export interface SubscriptionInfo {
  id: string;
  groupId: string;
  packageId: string;
  serverId?: string;
  status: 'active' | 'suspended' | 'expired';
  startDate: Date;
  endDate: Date;
  autoRenew: boolean;
  monthlyFee: number;
  usageStats: {
    bandwidth: number;
    connections: number;
    uptime: number;
  };
  package: IpPackageInfo;
  server?: ServerInfo;
}

export class IpPackageManager {
  // 获取所有可用的IP套餐
  async getAvailablePackages(): Promise<IpPackageInfo[]> {
    const packages = await prisma.ipPackage.findMany({
      where: { isEnabled: true },
      include: {
        servers: {
          where: { status: 'active' },
          select: {
            id: true,
            serverName: true,
            hostname: true,
            ipAddress: true,
            location: true,
            provider: true,
            specs: true,
            status: true,
            healthScore: true,
            lastCheckAt: true,
          },
        },
      },
      orderBy: { sortOrder: 'asc' },
    });

    return packages.map(pkg => ({
      id: pkg.id,
      name: pkg.name,
      description: pkg.description || undefined,
      packageType: pkg.packageType as any,
      maxConnections: pkg.maxConnections,
      bandwidth: pkg.bandwidth,
      locations: pkg.locations as string[],
      monthlyPrice: Number(pkg.monthlyPrice),
      setupFee: Number(pkg.setupFee),
      features: pkg.features as Record<string, any> || {},
      isEnabled: pkg.isEnabled,
      sortOrder: pkg.sortOrder,
      servers: pkg.servers.map(server => ({
        id: server.id,
        serverName: server.serverName,
        hostname: server.hostname,
        ipAddress: server.ipAddress,
        location: server.location,
        provider: server.provider,
        specs: server.specs as any,
        status: server.status as any,
        healthScore: server.healthScore,
        lastCheckAt: server.lastCheckAt || undefined,
      })),
    }));
  }

  // 创建套餐订阅
  async createSubscription(
    groupId: string,
    packageId: string,
    serverId?: string,
    options: {
      autoRenew?: boolean;
      customEndDate?: Date;
    } = {}
  ): Promise<SubscriptionInfo> {
    const packageInfo = await prisma.ipPackage.findUnique({
      where: { id: packageId },
      include: { servers: true },
    });

    if (!packageInfo) {
      throw new Error('IP套餐不存在');
    }

    if (!packageInfo.isEnabled) {
      throw new Error('IP套餐已禁用');
    }

    // 检查是否已有该套餐的活跃订阅
    const existingSubscription = await prisma.ipPackageSubscription.findFirst({
      where: {
        groupId,
        packageId,
        status: 'active',
      },
    });

    if (existingSubscription) {
      throw new Error('该拼车组已订阅此套餐');
    }

    // 如果指定了服务器，验证服务器是否属于该套餐
    let selectedServer = null;
    if (serverId) {
      selectedServer = packageInfo.servers.find(s => s.id === serverId);
      if (!selectedServer) {
        throw new Error('指定的服务器不属于该套餐');
      }
      if (selectedServer.status !== 'active') {
        throw new Error('指定的服务器不可用');
      }
    } else if (packageInfo.servers.length > 0) {
      // 自动分配最佳服务器
      selectedServer = packageInfo.servers
        .filter(s => s.status === 'active')
        .sort((a, b) => b.healthScore - a.healthScore)[0];
    }

    // 计算结束日期（默认一个月）
    const startDate = new Date();
    const endDate = options.customEndDate || new Date(startDate.getTime() + 30 * 24 * 60 * 60 * 1000);

    const subscription = await prisma.ipPackageSubscription.create({
      data: {
        groupId,
        packageId,
        serverId: selectedServer?.id,
        status: 'active',
        startDate,
        endDate,
        autoRenew: options.autoRenew ?? true,
        monthlyFee: packageInfo.monthlyPrice,
        usageStats: {
          bandwidth: 0,
          connections: 0,
          uptime: 100,
        },
        metadata: {
          createdBy: 'system',
          setupFee: packageInfo.setupFee,
        },
      },
      include: {
        package: {
          include: { servers: true },
        },
      },
    });

    return this.formatSubscription(subscription as any);
  }

  // 获取拼车组的订阅列表
  async getGroupSubscriptions(groupId: string): Promise<SubscriptionInfo[]> {
    const subscriptions = await prisma.ipPackageSubscription.findMany({
      where: { groupId },
      include: {
        package: {
          include: { servers: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return subscriptions.map(sub => this.formatSubscription(sub as any));
  }

  // 获取单个订阅详情
  async getSubscription(subscriptionId: string): Promise<SubscriptionInfo | null> {
    const subscription = await prisma.ipPackageSubscription.findUnique({
      where: { id: subscriptionId },
      include: {
        package: {
          include: { servers: true },
        },
      },
    });

    if (!subscription) {
      return null;
    }

    return this.formatSubscription(subscription as any);
  }

  // 更新订阅状态
  async updateSubscriptionStatus(
    subscriptionId: string,
    status: 'active' | 'suspended' | 'expired',
    reason?: string
  ): Promise<void> {
    await prisma.ipPackageSubscription.update({
      where: { id: subscriptionId },
      data: {
        status,
        metadata: {
          statusChangeReason: reason,
          statusChangedAt: new Date(),
        },
      },
    });
  }

  // 续费订阅
  async renewSubscription(
    subscriptionId: string,
    months: number = 1
  ): Promise<SubscriptionInfo> {
    const subscription = await prisma.ipPackageSubscription.findUnique({
      where: { id: subscriptionId },
      include: { package: true },
    });

    if (!subscription) {
      throw new Error('订阅不存在');
    }

    const newEndDate = new Date(subscription.endDate);
    newEndDate.setMonth(newEndDate.getMonth() + months);

    const updated = await prisma.ipPackageSubscription.update({
      where: { id: subscriptionId },
      data: {
        endDate: newEndDate,
        status: 'active',
      },
      include: {
        package: {
          include: { servers: true },
        },
      },
    });

    return this.formatSubscription(updated as any);
  }

  // 取消订阅
  async cancelSubscription(subscriptionId: string, immediate: boolean = false): Promise<void> {
    if (immediate) {
      await prisma.ipPackageSubscription.update({
        where: { id: subscriptionId },
        data: {
          status: 'expired',
          autoRenew: false,
          endDate: new Date(),
        },
      });
    } else {
      await prisma.ipPackageSubscription.update({
        where: { id: subscriptionId },
        data: { autoRenew: false },
      });
    }
  }

  // 更新使用统计
  async updateUsageStats(
    subscriptionId: string,
    stats: {
      bandwidth?: number;
      connections?: number;
      uptime?: number;
    }
  ): Promise<void> {
    const subscription = await prisma.ipPackageSubscription.findUnique({
      where: { id: subscriptionId },
    });

    if (!subscription) {
      throw new Error('订阅不存在');
    }

    const currentStats = subscription.usageStats as any || {};
    const newStats = {
      ...currentStats,
      ...stats,
      lastUpdated: new Date(),
    };

    await prisma.ipPackageSubscription.update({
      where: { id: subscriptionId },
      data: { usageStats: newStats },
    });
  }

  // 检查服务器健康状态
  async checkServerHealth(serverId: string): Promise<{
    isHealthy: boolean;
    healthScore: number;
    metrics: Record<string, any>;
  }> {
    const server = await prisma.integratedServer.findUnique({
      where: { id: serverId },
    });

    if (!server) {
      throw new Error('服务器不存在');
    }

    try {
      // 这里可以实现具体的健康检查逻辑
      // 例如：ping测试、端口检查、API调用等
      const healthMetrics = await this.performHealthCheck(server.hostname, server.port);
      
      const healthScore = this.calculateHealthScore(healthMetrics);
      const isHealthy = healthScore > 70;

      // 更新服务器健康状态
      await prisma.integratedServer.update({
        where: { id: serverId },
        data: {
          healthScore,
          lastCheckAt: new Date(),
          status: isHealthy ? 'active' : 'maintenance',
        },
      });

      return {
        isHealthy,
        healthScore,
        metrics: healthMetrics,
      };
    } catch (error) {
      console.error(`Health check failed for server ${serverId}:`, error);
      
      await prisma.integratedServer.update({
        where: { id: serverId },
        data: {
          healthScore: 0,
          lastCheckAt: new Date(),
          status: 'offline',
        },
      });

      return {
        isHealthy: false,
        healthScore: 0,
        metrics: { error: error instanceof Error ? error.message : 'Unknown error' },
      };
    }
  }

  // 获取套餐使用统计
  async getPackageUsageStats(packageId: string, period: 'day' | 'week' | 'month' = 'month'): Promise<{
    activeSubscriptions: number;
    totalRevenue: number;
    averageUsage: {
      bandwidth: number;
      connections: number;
      uptime: number;
    };
  }> {
    const endDate = new Date();
    const startDate = new Date();
    
    switch (period) {
      case 'day':
        startDate.setDate(startDate.getDate() - 1);
        break;
      case 'week':
        startDate.setDate(startDate.getDate() - 7);
        break;
      case 'month':
        startDate.setMonth(startDate.getMonth() - 1);
        break;
    }

    const subscriptions = await prisma.ipPackageSubscription.findMany({
      where: {
        packageId,
        createdAt: { gte: startDate },
      },
    });

    const activeSubscriptions = subscriptions.filter(s => s.status === 'active').length;
    const totalRevenue = subscriptions.reduce((sum, s) => sum + Number(s.monthlyFee), 0);

    // 计算平均使用率
    const totalStats = subscriptions.reduce(
      (acc, sub) => {
        const stats = sub.usageStats as any || {};
        return {
          bandwidth: acc.bandwidth + (stats.bandwidth || 0),
          connections: acc.connections + (stats.connections || 0),
          uptime: acc.uptime + (stats.uptime || 100),
        };
      },
      { bandwidth: 0, connections: 0, uptime: 0 }
    );

    const averageUsage = {
      bandwidth: subscriptions.length > 0 ? totalStats.bandwidth / subscriptions.length : 0,
      connections: subscriptions.length > 0 ? totalStats.connections / subscriptions.length : 0,
      uptime: subscriptions.length > 0 ? totalStats.uptime / subscriptions.length : 100,
    };

    return {
      activeSubscriptions,
      totalRevenue,
      averageUsage,
    };
  }

  // 私有方法：格式化订阅信息
  private formatSubscription(subscription: any): SubscriptionInfo {
    const selectedServer = subscription.serverId 
      ? subscription.package.servers.find((s: any) => s.id === subscription.serverId)
      : null;

    return {
      id: subscription.id,
      groupId: subscription.groupId,
      packageId: subscription.packageId,
      serverId: subscription.serverId || undefined,
      status: subscription.status,
      startDate: subscription.startDate,
      endDate: subscription.endDate,
      autoRenew: subscription.autoRenew,
      monthlyFee: Number(subscription.monthlyFee),
      usageStats: subscription.usageStats as any || { bandwidth: 0, connections: 0, uptime: 100 },
      package: {
        id: subscription.package.id,
        name: subscription.package.name,
        description: subscription.package.description || undefined,
        packageType: subscription.package.packageType,
        maxConnections: subscription.package.maxConnections,
        bandwidth: subscription.package.bandwidth,
        locations: subscription.package.locations as string[],
        monthlyPrice: Number(subscription.package.monthlyPrice),
        setupFee: Number(subscription.package.setupFee),
        features: subscription.package.features as Record<string, any> || {},
        isEnabled: subscription.package.isEnabled,
        sortOrder: subscription.package.sortOrder,
      },
      server: selectedServer ? {
        id: selectedServer.id,
        serverName: selectedServer.serverName,
        hostname: selectedServer.hostname,
        ipAddress: selectedServer.ipAddress,
        location: selectedServer.location,
        provider: selectedServer.provider,
        specs: selectedServer.specs as any,
        status: selectedServer.status,
        healthScore: selectedServer.healthScore,
        lastCheckAt: selectedServer.lastCheckAt || undefined,
      } : undefined,
    };
  }

  // 私有方法：执行健康检查
  private async performHealthCheck(hostname: string, port: number): Promise<Record<string, any>> {
    // 这里可以实现具体的健康检查逻辑
    // 例如：ping、端口连接测试、HTTP请求等
    
    return new Promise((resolve) => {
      // 模拟健康检查
      setTimeout(() => {
        resolve({
          ping: Math.random() * 100, // ping延迟
          portOpen: Math.random() > 0.1, // 端口是否开放
          httpResponse: Math.random() > 0.05, // HTTP响应是否正常
          cpuUsage: Math.random() * 100, // CPU使用率
          memoryUsage: Math.random() * 100, // 内存使用率
        });
      }, 1000);
    });
  }

  // 私有方法：计算健康分数
  private calculateHealthScore(metrics: Record<string, any>): number {
    let score = 100;

    // 根据各项指标计算健康分数
    if (metrics.ping > 200) score -= 20;
    if (!metrics.portOpen) score -= 30;
    if (!metrics.httpResponse) score -= 25;
    if (metrics.cpuUsage > 80) score -= 15;
    if (metrics.memoryUsage > 90) score -= 10;

    return Math.max(0, score);
  }
}

// 单例IP套餐管理器
export const ipPackageManager = new IpPackageManager();
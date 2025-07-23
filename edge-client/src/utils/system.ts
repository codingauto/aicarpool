/**
 * 系统工具函数
 */
import si from 'systeminformation';
import { NodeLoad, HealthCheckResult } from '@/types/index.js';

export class SystemUtil {
  /**
   * 获取系统负载信息
   */
  static async getSystemLoad(): Promise<NodeLoad> {
    try {
      const [cpu, mem, networkStats] = await Promise.all([
        si.currentLoad(),
        si.mem(),
        si.networkStats()
      ]);

      // 获取网络统计（简化版，实际应该根据具体需求调整）
      const networkInterface = networkStats[0] || { rx_sec: 0, tx_sec: 0 };
      const requestsPerSecond = Math.round((networkInterface.rx_sec + networkInterface.tx_sec) / 1024); // 简化计算

      return {
        cpu: Math.round(cpu.currentLoad || 0),
        memory: Math.round((mem.used / mem.total) * 100),
        connections: await this.getActiveConnections(),
        requestsPerSecond
      };
    } catch (error) {
      console.error('获取系统负载失败:', error);
      return {
        cpu: 0,
        memory: 0,
        connections: 0,
        requestsPerSecond: 0
      };
    }
  }

  /**
   * 获取活跃连接数
   */
  static async getActiveConnections(): Promise<number> {
    try {
      const connections = await si.networkConnections();
      return connections.filter(conn => conn.state === 'ESTABLISHED').length;
    } catch (error) {
      return 0;
    }
  }

  /**
   * 获取系统信息
   */
  static async getSystemInfo() {
    try {
      const [system, cpu, mem, osInfo, network] = await Promise.all([
        si.system(),
        si.cpu(),
        si.mem(),
        si.osInfo(),
        si.networkInterfaces()
      ]);

      return {
        system: {
          manufacturer: system.manufacturer,
          model: system.model,
          version: system.version
        },
        cpu: {
          manufacturer: cpu.manufacturer,
          brand: cpu.brand,
          cores: cpu.cores,
          physicalCores: cpu.physicalCores,
          speed: cpu.speed,
          speedMax: cpu.speedMax
        },
        memory: {
          total: Math.round(mem.total / 1024 / 1024 / 1024) + 'GB',
          available: Math.round(mem.available / 1024 / 1024 / 1024) + 'GB'
        },
        os: {
          platform: osInfo.platform,
          distro: osInfo.distro,
          release: osInfo.release,
          arch: osInfo.arch
        },
        network: network.map(iface => ({
          iface: iface.iface,
          ip4: iface.ip4,
          ip6: iface.ip6,
          mac: iface.mac,
          speed: iface.speed
        }))
      };
    } catch (error) {
      console.error('获取系统信息失败:', error);
      return null;
    }
  }

  /**
   * 执行健康检查
   */
  static async performHealthCheck(): Promise<HealthCheckResult> {
    try {
      const [cpu, mem, disk] = await Promise.all([
        si.currentLoad(),
        si.mem(),
        si.fsSize()
      ]);

      const cpuUsage = cpu.currentLoad || 0;
      const memoryUsage = (mem.used / mem.total) * 100;
      const diskUsage = disk.length > 0 ? disk[0].use : 0;
      const activeConnections = await this.getActiveConnections();

      const checks = {
        cpu: {
          status: cpuUsage < 80 ? 'healthy' : cpuUsage < 95 ? 'warning' : 'unhealthy',
          value: Math.round(cpuUsage)
        },
        memory: {
          status: memoryUsage < 85 ? 'healthy' : memoryUsage < 95 ? 'warning' : 'unhealthy',
          value: Math.round(memoryUsage)
        },
        network: {
          status: activeConnections < 800 ? 'healthy' : activeConnections < 950 ? 'warning' : 'unhealthy',
          value: activeConnections
        },
        disk: {
          status: diskUsage < 85 ? 'healthy' : diskUsage < 95 ? 'warning' : 'unhealthy',
          value: Math.round(diskUsage)
        },
        services: {
          status: 'healthy', // 这里可以添加服务状态检查
          count: 1
        }
      };

      // 计算健康分数
      let score = 100;
      Object.values(checks).forEach(check => {
        if (check.status === 'warning') score -= 10;
        if (check.status === 'unhealthy') score -= 25;
      });

      const overallStatus = score >= 80 ? 'healthy' : score >= 50 ? 'warning' : 'unhealthy';

      return {
        status: overallStatus,
        score: Math.max(0, score),
        checks,
        timestamp: new Date()
      };
    } catch (error) {
      console.error('健康检查失败:', error);
      return {
        status: 'unhealthy',
        score: 0,
        checks: {
          cpu: { status: 'error', value: 0 },
          memory: { status: 'error', value: 0 },
          network: { status: 'error', value: 0 },
          disk: { status: 'error', value: 0 },
          services: { status: 'error', count: 0 }
        },
        timestamp: new Date()
      };
    }
  }

  /**
   * 获取网络延迟
   */
  static async getNetworkLatency(host: string, timeout: number = 5000): Promise<number> {
    return new Promise((resolve) => {
      const start = Date.now();
      const timeoutId = setTimeout(() => {
        resolve(-1); // 超时返回-1
      }, timeout);

      // 简单的ping实现（实际生产环境可能需要更复杂的实现）
      import('net').then(({ createConnection }) => {
        const socket = createConnection(80, host);
        
        socket.on('connect', () => {
          clearTimeout(timeoutId);
          socket.destroy();
          resolve(Date.now() - start);
        });

        socket.on('error', () => {
          clearTimeout(timeoutId);
          resolve(-1);
        });
      });
    });
  }

  /**
   * 格式化字节数
   */
  static formatBytes(bytes: number, decimals: number = 2): string {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }

  /**
   * 检查端口是否可用
   */
  static async isPortAvailable(port: number, host: string = 'localhost'): Promise<boolean> {
    return new Promise((resolve) => {
      import('net').then(({ createServer }) => {
        const server = createServer();
        
        server.listen(port, host, () => {
          server.once('close', () => {
            resolve(true);
          });
          server.close();
        });
        
        server.on('error', () => {
          resolve(false);
        });
      });
    });
  }

  /**
   * 优雅关闭处理
   */
  static setupGracefulShutdown(cleanup: () => Promise<void>): void {
    const signals = ['SIGTERM', 'SIGINT', 'SIGUSR2'];
    
    signals.forEach(signal => {
      process.on(signal, async () => {
        console.log(`收到${signal}信号，开始优雅关闭...`);
        try {
          await cleanup();
          console.log('优雅关闭完成');
          process.exit(0);
        } catch (error) {
          console.error('优雅关闭失败:', error);
          process.exit(1);
        }
      });
    });

    process.on('uncaughtException', (error) => {
      console.error('未捕获的异常:', error);
      process.exit(1);
    });

    process.on('unhandledRejection', (reason, promise) => {
      console.error('未处理的Promise拒绝:', reason, 'at:', promise);
      process.exit(1);
    });
  }
}
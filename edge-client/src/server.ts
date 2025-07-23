/**
 * Edge Client HTTP 服务器
 * 提供 Claude Code 代理服务的 HTTP 接口
 */
import express from 'express';
import cors from 'cors';
import { EdgeClient } from '@/core/EdgeClient.js';
import { EdgeNodeConfig } from '@/types/config.js';
import { initializeClaudeCodeRoutes } from '@/routes/claudeCode.js';
// import { ConfigManager } from '@/core/ConfigManager.js';

export class EdgeServerApp {
  private app: express.Application;
  private edgeClient: EdgeClient;
  private server: any;

  constructor(config: EdgeNodeConfig) {
    this.app = express();
    this.edgeClient = new EdgeClient(config);
    this.setupMiddleware();
    this.setupRoutes();
  }

  /**
   * 设置中间件
   */
  private setupMiddleware(): void {
    // CORS 支持
    this.app.use(cors({
      origin: '*',
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'User-Agent'],
      credentials: true
    }));

    // 解析 JSON 和 URL 编码的请求体
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // 请求日志
    this.app.use((req, _res, next) => {
      console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
      next();
    });

    // 错误处理
    this.app.use((error: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
      console.error('服务器错误:', error);
      
      if (!res.headersSent) {
        res.status(500).json({
          error: {
            type: 'internal_server_error',
            message: 'An internal server error occurred'
          }
        });
      }
    });
  }

  /**
   * 设置路由
   */
  private setupRoutes(): void {
    // 健康检查端点
    this.app.get('/health', (_req, res) => {
      res.json({
        status: 'healthy',
        service: 'aicarpool-edge-client',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        node_id: this.edgeClient.nodeId,
        connected: this.edgeClient.isNodeConnected
      });
    });

    // 根路径
    this.app.get('/', (_req, res) => {
      res.json({
        service: 'AiCarpool Edge Client',
        version: '1.0.0',
        description: 'Edge client with Claude Code proxy support',
        endpoints: {
          health: '/health',
          claude_code: '/claude-code/v1/messages',
          user_info: '/claude-code/v1/user',
          usage_stats: '/claude-code/v1/usage'
        },
        node_info: {
          id: this.edgeClient.nodeId,
          connected: this.edgeClient.isNodeConnected,
          config: this.edgeClient.nodeConfig.node
        }
      });
    });

    // Claude Code 专用路由
    this.app.use('/claude-code', initializeClaudeCodeRoutes(this.edgeClient));

    // 兼容路由 - 直接支持 Claude Code CLI 的默认路径
    this.app.use('/v1', initializeClaudeCodeRoutes(this.edgeClient));

    // 404 处理
    this.app.use('*', (req, res) => {
      res.status(404).json({
        error: {
          type: 'not_found',
          message: `Endpoint ${req.originalUrl} not found`
        },
        available_endpoints: [
          '/health',
          '/claude-code/v1/messages',
          '/claude-code/v1/user',
          '/claude-code/v1/usage',
          '/v1/messages',
          '/v1/user',
          '/v1/usage'
        ]
      });
    });
  }

  /**
   * 启动服务器
   */
  async start(): Promise<void> {
    try {
      // 先启动 EdgeClient
      console.log('启动 Edge Client...');
      await this.edgeClient.start();

      // 然后启动 HTTP 服务器
      const config = this.edgeClient.nodeConfig;
      this.server = this.app.listen(config.server.port, config.server.host, () => {
        console.log(`🚀 AiCarpool Edge Client 已启动`);
        console.log(`📍 节点ID: ${this.edgeClient.nodeId}`);
        console.log(`🌐 HTTP 服务器: http://${config.server.host}:${config.server.port}`);
        console.log(`🤖 Claude Code API: http://${config.server.host}:${config.server.port}/v1/messages`);
        console.log(`📊 健康检查: http://${config.server.host}:${config.server.port}/health`);
        console.log(`🔗 中央服务器连接: ${this.edgeClient.isNodeConnected ? '已连接' : '断开'}`);
      });

      this.server.timeout = config.server.requestTimeout;
      this.server.keepAliveTimeout = config.server.keepAliveTimeout;

      // 设置优雅关闭
      this.setupGracefulShutdown();

    } catch (error) {
      console.error('启动服务器失败:', error);
      process.exit(1);
    }
  }

  /**
   * 停止服务器
   */
  async stop(): Promise<void> {
    try {
      console.log('正在停止服务器...');

      // 关闭 HTTP 服务器
      if (this.server) {
        await new Promise<void>((resolve) => {
          this.server.close(() => {
            console.log('HTTP 服务器已关闭');
            resolve();
          });
        });
      }

      // 停止 EdgeClient
      await this.edgeClient.stop();

      console.log('服务器已完全停止');

    } catch (error) {
      console.error('停止服务器时发生错误:', error);
    }
  }

  /**
   * 设置优雅关闭
   */
  private setupGracefulShutdown(): void {
    const shutdown = async (signal: string) => {
      console.log(`收到 ${signal} 信号，开始优雅关闭...`);
      
      try {
        await this.stop();
        process.exit(0);
      } catch (error) {
        console.error('优雅关闭失败:', error);
        process.exit(1);
      }
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
    
    // 处理未捕获的异常
    process.on('uncaughtException', (error) => {
      console.error('未捕获的异常:', error);
      shutdown('uncaughtException');
    });
    
    process.on('unhandledRejection', (reason, promise) => {
      console.error('未处理的 Promise 拒绝:', reason, 'at:', promise);
      shutdown('unhandledRejection');
    });
  }

  /**
   * 获取 EdgeClient 实例
   */
  getEdgeClient(): EdgeClient {
    return this.edgeClient;
  }

  /**
   * 获取 Express 应用实例
   */
  getApp(): express.Application {
    return this.app;
  }
}

/**
 * 启动应用程序
 */
async function startApplication(): Promise<void> {
  try {
    // 创建默认配置
    const defaultConfig: EdgeNodeConfig = {
      node: {
        name: process.env.NODE_NAME || 'Edge Node 1',
        location: process.env.NODE_LOCATION || 'Local',
        endpoint: process.env.NODE_ENDPOINT || 'http://localhost:3000',
        capabilities: {
          cpu: {
            cores: parseInt(process.env.CPU_CORES || '4'),
            frequency: process.env.CPU_FREQUENCY || '2.4GHz'
          },
          memory: {
            total: process.env.MEMORY_TOTAL || '8GB',
            available: process.env.MEMORY_AVAILABLE || '6GB'
          },
          network: {
            bandwidth: process.env.NETWORK_BANDWIDTH || '1Gbps',
            latency: parseInt(process.env.NETWORK_LATENCY || '10')
          },
          maxConnections: parseInt(process.env.MAX_CONNECTIONS || '1000')
        }
      },
      server: {
        port: parseInt(process.env.HTTP_PORT || '3000'),
        host: process.env.HTTP_HOST || '0.0.0.0',
        keepAliveTimeout: 65000,
        requestTimeout: 30000,
        maxConnections: 1000
      },
      centralServer: {
        url: process.env.CENTRAL_BASE_URL || 'http://localhost:8080',
        wsUrl: process.env.CENTRAL_WS_URL || 'ws://localhost:8080',
        timeout: 30000,
        retryAttempts: 3,
        retryDelay: 5000
      },
      auth: {
        privateKeyPath: process.env.PRIVATE_KEY_PATH || './keys/private.pem',
        publicKeyPath: process.env.PUBLIC_KEY_PATH || './keys/public.pem',
        tokenExpiration: 86400 // 24 hours
      },
      logging: {
        level: (process.env.LOG_LEVEL as 'error' | 'warn' | 'info' | 'debug') || 'info',
        maxSize: '20m',
        maxFiles: '14d',
        datePattern: 'YYYY-MM-DD',
        zippedArchive: true
      },
      monitoring: {
        metricsInterval: 60000,
        heartbeatInterval: 30000,
        healthCheckInterval: 60000,
        retentionDays: 30
      },
      proxy: {
        timeout: 30000,
        retryAttempts: 3,
        retryDelay: 1000,
        rateLimit: {
          windowMs: 60000,
          max: 100
        }
      },
      environment: (process.env.NODE_ENV as 'development' | 'production' | 'test') || 'development',
      debug: process.env.DEBUG === 'true'
    };
    const config = defaultConfig;

    // 创建并启动服务器
    const app = new EdgeServerApp(config);
    await app.start();

  } catch (error) {
    console.error('应用程序启动失败:', error);
    process.exit(1);
  }
}

// 如果直接运行此文件，则启动应用程序
if (require.main === module) {
  startApplication();
}

export default EdgeServerApp;
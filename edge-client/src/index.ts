/**
 * 边缘节点客户端主入口文件
 */
import dotenv from 'dotenv';
import { EdgeClient } from '@/core/EdgeClient.js';
import { EdgeNodeConfig } from '@/types/config.js';
import { SystemUtil } from '@/utils/system.js';
import path from 'path';
import { fileURLToPath } from 'url';

// 加载环境变量
dotenv.config();

// 获取当前目录（ES模块兼容）
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

/**
 * 创建边缘节点配置
 */
function createEdgeNodeConfig(): EdgeNodeConfig {
  return {
    node: {
      name: process.env.NODE_NAME || 'edge-node-001',
      location: process.env.NODE_LOCATION || 'Beijing',
      endpoint: process.env.NODE_ENDPOINT || 'https://localhost:8080',
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
      port: parseInt(process.env.PORT || '8080'),
      host: process.env.HOST || '0.0.0.0',
      ssl: {
        enabled: process.env.SSL_ENABLED === 'true',
        certPath: process.env.SSL_CERT_PATH || path.join(rootDir, 'certs', 'server.crt'),
        keyPath: process.env.SSL_KEY_PATH || path.join(rootDir, 'certs', 'server.key')
      },
      keepAliveTimeout: parseInt(process.env.KEEP_ALIVE_TIMEOUT || '65000'),
      requestTimeout: parseInt(process.env.REQUEST_TIMEOUT || '30000'),
      maxConnections: parseInt(process.env.MAX_CONNECTIONS || '1000')
    },
    centralServer: {
      url: process.env.CENTRAL_SERVER_URL || 'https://aicarpool.example.com',
      wsUrl: process.env.CENTRAL_SERVER_WS_URL || 'wss://aicarpool.example.com/ws',
      timeout: parseInt(process.env.CENTRAL_SERVER_TIMEOUT || '30000'),
      retryAttempts: parseInt(process.env.RETRY_ATTEMPTS || '3'),
      retryDelay: parseInt(process.env.RETRY_DELAY || '1000')
    },
    auth: {
      privateKeyPath: process.env.NODE_PRIVATE_KEY_PATH || path.join(rootDir, 'certs', 'node-private-key.pem'),
      publicKeyPath: process.env.NODE_PUBLIC_KEY_PATH || path.join(rootDir, 'certs', 'node-public-key.pem'),
      tokenExpiration: parseInt(process.env.TOKEN_EXPIRATION || '3600')
    },
    logging: {
      level: (process.env.LOG_LEVEL as any) || 'info',
      maxSize: process.env.LOG_MAX_SIZE || '20m',
      maxFiles: process.env.LOG_MAX_FILES || '14d',
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true
    },
    monitoring: {
      metricsInterval: parseInt(process.env.METRICS_INTERVAL || '30000'),
      heartbeatInterval: parseInt(process.env.HEARTBEAT_INTERVAL || '60000'),
      healthCheckInterval: parseInt(process.env.HEALTH_CHECK_INTERVAL || '30000'),
      retentionDays: parseInt(process.env.METRICS_RETENTION_DAYS || '7')
    },
    proxy: {
      timeout: parseInt(process.env.PROXY_TIMEOUT || '120000'),
      retryAttempts: parseInt(process.env.RETRY_ATTEMPTS || '3'),
      retryDelay: parseInt(process.env.RETRY_DELAY || '1000'),
      rateLimit: {
        windowMs: parseInt(process.env.RATE_LIMIT_WINDOW || '60000'),
        max: parseInt(process.env.RATE_LIMIT_MAX || '100')
      }
    },
    environment: (process.env.NODE_ENV as any) || 'production',
    debug: process.env.DEBUG === 'true'
  };
}

/**
 * 主启动函数
 */
async function main(): Promise<void> {
  try {
    console.log('='.repeat(60));
    console.log('AI Carpool 边缘节点客户端启动中...');
    console.log('='.repeat(60));

    // 显示系统信息
    await displaySystemInfo();

    // 创建配置
    const config = createEdgeNodeConfig();
    
    if (config.debug) {
      console.log('配置信息:', JSON.stringify(config, null, 2));
    }

    // 创建并启动边缘客户端
    const edgeClient = new EdgeClient(config);

    // 设置事件监听器
    setupEventListeners(edgeClient);

    // 启动客户端
    await edgeClient.start();

    console.log('='.repeat(60));
    console.log('边缘节点客户端启动成功！');
    console.log(`节点名称: ${config.node.name}`);
    console.log(`节点位置: ${config.node.location}`);
    console.log(`服务端点: ${config.node.endpoint}`);
    console.log(`中央服务器: ${config.centralServer.url}`);
    console.log('='.repeat(60));

    // 设置优雅关闭
    SystemUtil.setupGracefulShutdown(async () => {
      console.log('\n正在优雅关闭边缘节点客户端...');
      await edgeClient.stop();
      console.log('边缘节点客户端已关闭');
    });

  } catch (error) {
    console.error('边缘节点客户端启动失败:', error);
    process.exit(1);
  }
}

/**
 * 显示系统信息
 */
async function displaySystemInfo(): Promise<void> {
  try {
    const systemInfo = await SystemUtil.getSystemInfo();
    
    if (systemInfo) {
      console.log('系统信息:');
      console.log(`  操作系统: ${systemInfo.os.distro} ${systemInfo.os.release}`);
      console.log(`  CPU: ${systemInfo.cpu.brand} (${systemInfo.cpu.cores}核)`);
      console.log(`  内存: ${systemInfo.memory.total}`);
      console.log(`  架构: ${systemInfo.os.arch}`);
      console.log(`  Node.js版本: ${process.version}`);
      console.log('');
    }
  } catch (error) {
    console.warn('获取系统信息失败:', error instanceof Error ? error.message : String(error));
  }
}

/**
 * 设置事件监听器
 */
function setupEventListeners(edgeClient: EdgeClient): void {
  // 客户端启动事件
  edgeClient.on('started', () => {
    console.log('✅ 边缘客户端已启动');
  });

  // 客户端停止事件
  edgeClient.on('stopped', () => {
    console.log('🛑 边缘客户端已停止');
  });

  // 节点注册事件
  edgeClient.on('registered', (nodeAuth) => {
    console.log(`📝 节点注册成功: ${nodeAuth.nodeId}`);
  });

  // 连接事件
  edgeClient.on('connected', () => {
    console.log('🔗 已连接到中央服务器');
  });

  // 断开连接事件
  edgeClient.on('disconnected', () => {
    console.log('💔 与中央服务器断开连接');
  });

  // 配置更新事件
  edgeClient.on('config_updated', (configData) => {
    console.log(`⚙️  配置已更新，版本: ${configData.version}`);
  });

  // 健康检查事件
  edgeClient.on('health_check', (healthResult) => {
    const statusEmoji = healthResult.status === 'healthy' ? '💚' : 
                       healthResult.status === 'warning' ? '💛' : '❤️';
    console.log(`${statusEmoji} 健康检查: ${healthResult.status} (分数: ${healthResult.score})`);
  });

  // 健康状态变化事件
  edgeClient.on('health_status_changed', (statusChange) => {
    console.log(`🔄 健康状态变化: ${statusChange.previous.status} -> ${statusChange.current.status}`);
  });

  // 错误事件
  edgeClient.on('error', (error) => {
    console.error('❌ 边缘客户端错误:', error.message);
    
    if (process.env.DEBUG === 'true') {
      console.error('错误堆栈:', error.stack);
    }
  });

  // WebSocket消息事件
  edgeClient.on('message', (message) => {
    if (process.env.DEBUG === 'true') {
      console.log('📨 收到消息:', message.type);
    }
  });

  // 发送消息事件（用于健康监控器）
  edgeClient.on('send_message', (message) => {
    // 这里可以实现实际的消息发送逻辑
    if (process.env.DEBUG === 'true') {
      console.log('📤 发送消息:', message.type);
    }
  });
}

/**
 * 错误处理
 */
process.on('uncaughtException', (error) => {
  console.error('未捕获的异常:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('未处理的Promise拒绝:', reason, 'at:', promise);
  process.exit(1);
});

// 启动应用
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('应用启动失败:', error);
    process.exit(1);
  });
}
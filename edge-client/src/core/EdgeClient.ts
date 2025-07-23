/**
 * 边缘客户端主类
 */
import EventEmitter from 'events';
import { EdgeNodeConfig } from '@/types/config.js';
import { NodeAuth, HeartbeatData, ConfigSync } from '@/types/index.js';
import { RegisterNodeRequest, RegisterNodeResponse } from '@/types/api.js';
import { HeartbeatManager } from './HeartbeatManager.js';
import { ConfigManager } from './ConfigManager.js';
import { HealthMonitor } from './HealthMonitor.js';
import { AiProxyService } from '@/services/AiProxyService.js';
import { MetricsService } from '@/services/MetricsService.js';
import { NetworkUtil } from '@/utils/network.js';
import { CryptoUtil } from '@/utils/crypto.js';
import { SystemUtil } from '@/utils/system.js';
import { AxiosInstance } from 'axios';
import WebSocket from 'ws';

export class EdgeClient extends EventEmitter {
  private config: EdgeNodeConfig;
  private nodeAuth: NodeAuth | null = null;
  private httpClient: AxiosInstance;
  private wsClient: WebSocket | null = null;
  private heartbeatManager: HeartbeatManager;
  private configManager: ConfigManager;
  private healthMonitor: HealthMonitor;
  public aiProxyService: AiProxyService;
  private metricsService: MetricsService;
  private isConnected: boolean = false;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 10;
  private reconnectDelay: number = 5000;

  constructor(config: EdgeNodeConfig) {
    super();
    this.config = config;
    
    // 初始化HTTP客户端
    this.httpClient = NetworkUtil.createHttpClient(
      this.config.centralServer.url,
      {
        timeout: this.config.centralServer.timeout,
        headers: {
          'X-Node-Version': '1.0.0',
          'X-Node-Type': 'edge-client'
        }
      }
    );

    // 初始化管理器
    this.heartbeatManager = new HeartbeatManager(this);
    this.configManager = new ConfigManager(this);
    this.healthMonitor = new HealthMonitor(this);
    this.aiProxyService = new AiProxyService(this);
    this.metricsService = new MetricsService(this);

    this.setupEventHandlers();
  }

  /**
   * 启动边缘客户端
   */
  async start(): Promise<void> {
    try {
      console.log('正在启动边缘客户端...');

      // 检查或生成密钥对
      await this.ensureKeyPair();

      // 注册节点
      await this.registerNode();

      // 连接到中央服务器
      await this.connectToCentralServer();

      // 启动各个管理器
      await this.metricsService.initialize();
      await this.aiProxyService.initialize();
      await this.heartbeatManager.start();
      await this.configManager.start();
      await this.healthMonitor.start();

      this.isConnected = true;
      console.log('边缘客户端启动成功');
      this.emit('started');

    } catch (error) {
      console.error('边缘客户端启动失败:', error);
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * 停止边缘客户端
   */
  async stop(): Promise<void> {
    try {
      console.log('正在停止边缘客户端...');

      this.isConnected = false;

      // 停止各个管理器
      await this.heartbeatManager.stop();
      await this.configManager.stop();
      await this.healthMonitor.stop();
      await this.metricsService.close();

      // 关闭WebSocket连接
      if (this.wsClient) {
        this.wsClient.close();
        this.wsClient = null;
      }

      console.log('边缘客户端已停止');
      this.emit('stopped');

    } catch (error) {
      console.error('边缘客户端停止失败:', error);
      this.emit('error', error);
    }
  }

  /**
   * 检查或生成密钥对
   */
  private async ensureKeyPair(): Promise<void> {
    try {
      // 尝试加载现有密钥
      const privateKey = await CryptoUtil.loadKeyFromFile(this.config.auth.privateKeyPath);
      const publicKey = await CryptoUtil.loadKeyFromFile(this.config.auth.publicKeyPath);
      
      if (privateKey && publicKey) {
        console.log('密钥对验证成功');
      }
      
      console.log('已加载现有密钥对');
    } catch (error) {
      // 生成新的密钥对
      console.log('生成新的密钥对...');
      const { privateKey, publicKey } = CryptoUtil.generateKeyPair();
      
      await CryptoUtil.saveKeyToFile(privateKey, this.config.auth.privateKeyPath);
      await CryptoUtil.saveKeyToFile(publicKey, this.config.auth.publicKeyPath);
      
      console.log('密钥对已生成并保存');
    }
  }

  /**
   * 注册节点到中央服务器
   */
  private async registerNode(): Promise<void> {
    try {
      const publicKey = await CryptoUtil.loadKeyFromFile(this.config.auth.publicKeyPath);
      
      const registrationData: RegisterNodeRequest = {
        nodeName: this.config.node.name,
        location: this.config.node.location,
        endpoint: this.config.node.endpoint,
        capabilities: this.config.node.capabilities
      };

      console.log('正在注册节点到中央服务器...');
      
      const response = await NetworkUtil.requestWithRetry<RegisterNodeResponse>(
        this.httpClient,
        {
          method: 'POST',
          url: '/api/edge-nodes/register',
          data: registrationData,
          headers: {
            'X-Node-Public-Key': Buffer.from(publicKey).toString('base64')
          }
        },
        this.config.centralServer.retryAttempts,
        this.config.centralServer.retryDelay
      );

      if (response.data.success && response.data.data) {
        this.nodeAuth = response.data.data;
        console.log(`节点注册成功，节点ID: ${this.nodeAuth!.nodeId}`);
        this.emit('registered', this.nodeAuth);
      } else {
        throw new Error(response.data.error || '节点注册失败');
      }

    } catch (error) {
      console.error('节点注册失败:', error);
      throw error;
    }
  }

  /**
   * 连接到中央服务器WebSocket
   */
  private async connectToCentralServer(): Promise<void> {
    if (!this.nodeAuth) {
      throw new Error('节点未注册，无法连接到中央服务器');
    }

    try {
      const wsUrl = `${this.config.centralServer.wsUrl}?nodeId=${this.nodeAuth.nodeId}`;
      
      console.log('正在连接到中央服务器WebSocket...');
      
      this.wsClient = new WebSocket(wsUrl, {
        headers: {
          'Authorization': `Bearer ${await this.generateAuthToken()}`
        }
      });

      this.wsClient.on('open', () => {
        console.log('WebSocket连接已建立');
        this.reconnectAttempts = 0;
        this.emit('connected');
      });

      this.wsClient.on('message', (data: WebSocket.Data) => {
        this.handleWebSocketMessage(data.toString());
      });

      this.wsClient.on('close', (code: number, reason: Buffer) => {
        console.log(`WebSocket连接已关闭: ${code} ${reason.toString()}`);
        this.emit('disconnected');
        
        if (this.isConnected) {
          this.scheduleReconnect();
        }
      });

      this.wsClient.on('error', (error: Error) => {
        console.error('WebSocket连接错误:', error);
        this.emit('error', error);
      });

      // 等待连接建立
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('WebSocket连接超时'));
        }, 10000);

        this.wsClient!.once('open', () => {
          clearTimeout(timeout);
          resolve(void 0);
        });

        this.wsClient!.once('error', (error) => {
          clearTimeout(timeout);
          reject(error);
        });
      });

    } catch (error) {
      console.error('连接到中央服务器失败:', error);
      throw error;
    }
  }

  /**
   * 处理WebSocket消息
   */
  private handleWebSocketMessage(data: string): void {
    try {
      const message = JSON.parse(data);
      
      switch (message.type) {
        case 'config_update':
          this.configManager.handleConfigUpdate(message.data);
          break;
        case 'node_command':
          this.handleNodeCommand(message.data);
          break;
        case 'health_check_request':
          this.healthMonitor.performHealthCheck();
          break;
        default:
          console.warn('收到未知的WebSocket消息类型:', message.type);
      }

      this.emit('message', message);

    } catch (error) {
      console.error('处理WebSocket消息失败:', error);
    }
  }

  /**
   * 处理节点命令
   */
  private async handleNodeCommand(command: any): Promise<void> {
    try {
      console.log('收到节点命令:', command);

      switch (command.command) {
        case 'restart':
          await this.restart();
          break;
        case 'update_config':
          await this.configManager.updateConfig(command.parameters);
          break;
        case 'health_check':
          await this.healthMonitor.performHealthCheck();
          break;
        default:
          console.warn('未知的节点命令:', command.command);
      }

    } catch (error) {
      console.error('处理节点命令失败:', error);
    }
  }

  /**
   * 重启节点
   */
  private async restart(): Promise<void> {
    console.log('正在重启节点...');
    
    await this.stop();
    await NetworkUtil.delay(2000);
    await this.start();
  }

  /**
   * 计划重连
   */
  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('达到最大重连次数，停止重连');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
    
    console.log(`计划在${delay}ms后进行第${this.reconnectAttempts}次重连...`);
    
    setTimeout(async () => {
      try {
        await this.connectToCentralServer();
      } catch (error) {
        console.error('重连失败:', error);
        this.scheduleReconnect();
      }
    }, delay);
  }

  /**
   * 生成认证令牌
   */
  private async generateAuthToken(): Promise<string> {
    if (!this.nodeAuth) {
      throw new Error('节点未认证');
    }

    const privateKey = await CryptoUtil.loadKeyFromFile(this.config.auth.privateKeyPath);
    
    const payload = {
      nodeId: this.nodeAuth.nodeId,
      nodeName: this.config.node.name,
      type: 'edge-client'
    };

    return CryptoUtil.generateJWT(payload, privateKey, '1h');
  }

  /**
   * 发送心跳数据
   */
  async sendHeartbeat(heartbeatData: HeartbeatData): Promise<void> {
    if (!NetworkUtil.isWebSocketConnected(this.wsClient)) {
      console.warn('WebSocket未连接，无法发送心跳');
      return;
    }

    const message = {
      type: 'heartbeat',
      id: `heartbeat_${Date.now()}`,
      timestamp: new Date().toISOString(),
      data: heartbeatData
    };

    NetworkUtil.safeWebSocketSend(this.wsClient, message);
  }

  /**
   * 同步配置
   */
  async syncConfiguration(): Promise<ConfigSync | null> {
    if (!this.nodeAuth) {
      return null;
    }

    try {
      const response = await NetworkUtil.requestWithRetry(
        this.httpClient,
        {
          method: 'POST',
          url: '/api/edge-nodes/config/sync',
          data: {
            nodeId: this.nodeAuth.nodeId,
            currentVersion: this.configManager.getCurrentVersion()
          },
          headers: {
            'Authorization': `Bearer ${await this.generateAuthToken()}`
          }
        }
      );

      if (response.data.success && response.data.data) {
        return response.data.data;
      }

      return null;

    } catch (error) {
      console.error('配置同步失败:', error);
      return null;
    }
  }

  /**
   * 上报健康状态
   */
  async reportHealthStatus(healthData: any): Promise<void> {
    if (!NetworkUtil.isWebSocketConnected(this.wsClient)) {
      console.warn('WebSocket未连接，无法上报健康状态');
      return;
    }

    const message = {
      type: 'health_report',
      id: `health_${Date.now()}`,
      timestamp: new Date().toISOString(),
      data: {
        nodeId: this.nodeAuth?.nodeId,
        healthData
      }
    };

    NetworkUtil.safeWebSocketSend(this.wsClient, message);
  }

  /**
   * 记录API使用统计
   */
  async recordApiUsage(usage: any): Promise<void> {
    try {
      await this.metricsService.recordApiUsage(usage);
    } catch (error) {
      console.error('记录API使用统计失败:', error);
    }
  }

  /**
   * 设置事件处理器
   */
  private setupEventHandlers(): void {
    // 优雅关闭处理
    SystemUtil.setupGracefulShutdown(async () => {
      await this.stop();
    });
  }

  // Getters
  get isNodeConnected(): boolean {
    return this.isConnected && NetworkUtil.isWebSocketConnected(this.wsClient);
  }

  get nodeId(): string | null {
    return this.nodeAuth?.nodeId || null;
  }

  get nodeConfig(): EdgeNodeConfig {
    return this.config;
  }

  get httpClientInstance(): AxiosInstance {
    return this.httpClient;
  }
}
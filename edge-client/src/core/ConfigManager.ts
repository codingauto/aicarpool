/**
 * 配置管理器
 */
import { EdgeClient } from './EdgeClient.js';
import { ConfigSync, AiServiceConfig } from '@/types/index.js';
import fs from 'fs/promises';
import path from 'path';
import cron from 'node-cron';

export class ConfigManager {
  private edgeClient: EdgeClient;
  private currentConfig: Record<string, any> = {};
  private currentVersion: string = '1.0.0';
  private configSyncTask: cron.ScheduledTask | null = null;
  private isRunning: boolean = false;
  private configPath: string;

  constructor(edgeClient: EdgeClient) {
    this.edgeClient = edgeClient;
    this.configPath = path.join(process.cwd(), 'config', 'runtime-config.json');
  }

  /**
   * 启动配置管理器
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      return;
    }

    console.log('启动配置管理器');

    // 加载本地配置
    await this.loadLocalConfig();

    // 执行初始配置同步
    await this.syncConfigFromServer();

    // 启动定期配置同步任务（每5分钟检查一次）
    this.configSyncTask = cron.schedule('*/5 * * * *', async () => {
      await this.syncConfigFromServer();
    }, {
      scheduled: false
    });

    this.configSyncTask.start();
    this.isRunning = true;
  }

  /**
   * 停止配置管理器
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    console.log('停止配置管理器');

    if (this.configSyncTask) {
      this.configSyncTask.stop();
      this.configSyncTask = null;
    }

    // 保存当前配置到本地
    await this.saveLocalConfig();

    this.isRunning = false;
  }

  /**
   * 从服务器同步配置
   */
  async syncConfigFromServer(): Promise<void> {
    try {
      console.log('从服务器同步配置...');
      
      const configSync = await this.edgeClient.syncConfiguration();
      
      if (configSync && configSync.version !== this.currentVersion) {
        console.log(`配置更新检测到新版本: ${configSync.version}`);
        await this.updateConfig(configSync);
        
        // 应用新配置到相关服务
        await this.applyConfigToServices(configSync);
      } else {
        console.log('配置已是最新版本');
      }

    } catch (error) {
      console.error('配置同步失败:', error);
    }
  }

  /**
   * 将配置应用到相关服务
   */
  private async applyConfigToServices(configSync: ConfigSync): Promise<void> {
    try {
      // 更新AI代理服务的配置
      if (configSync.aiServices) {
        const aiProxyService = this.edgeClient.aiProxyService;
        if (aiProxyService) {
          const aiServiceConfigs = Object.values(configSync.aiServices);
          await aiProxyService.updateServiceConfig(aiServiceConfigs);
          console.log('AI代理服务配置已更新');
        }
      }

      // 应用安全配置
      if (configSync.security) {
        await this.applySecurityConfig(configSync.security);
      }

      // 应用路由配置
      if (configSync.routing) {
        await this.applyRoutingConfig(configSync.routing);
      }

    } catch (error) {
      console.error('应用配置到服务失败:', error);
    }
  }

  /**
   * 应用安全配置
   */
  private async applySecurityConfig(securityConfig: any): Promise<void> {
    // 这里可以更新HTTP服务器的安全设置
    console.log('应用安全配置:', securityConfig);
  }

  /**
   * 应用路由配置
   */
  private async applyRoutingConfig(routingConfig: any): Promise<void> {
    // 这里可以更新负载均衡策略
    console.log('应用路由配置:', routingConfig);
  }

  /**
   * 更新配置
   */
  async updateConfig(configSync: ConfigSync): Promise<void> {
    try {
      console.log('正在更新配置...');

      // 备份当前配置
      const backupConfig = { ...this.currentConfig };

      // 应用新配置
      if (configSync.aiServices) {
        this.currentConfig.aiServices = configSync.aiServices;
        console.log('AI服务配置已更新');
      }

      if (configSync.routing) {
        this.currentConfig.routing = configSync.routing;
        console.log('路由配置已更新');
      }

      if (configSync.security) {
        this.currentConfig.security = configSync.security;
        console.log('安全配置已更新');
      }

      this.currentVersion = configSync.version;
      this.currentConfig.version = this.currentVersion;
      this.currentConfig.lastUpdate = configSync.timestamp;

      // 保存到本地文件
      await this.saveLocalConfig();

      // 触发配置更新事件
      this.edgeClient.emit('config_updated', {
        oldConfig: backupConfig,
        newConfig: this.currentConfig,
        version: this.currentVersion
      });

      console.log(`配置更新完成，版本: ${this.currentVersion}`);

    } catch (error) {
      console.error('配置更新失败:', error);
      throw error;
    }
  }

  /**
   * 处理配置更新消息
   */
  async handleConfigUpdate(configData: any): Promise<void> {
    try {
      console.log('收到配置更新消息');
      
      const configSync: ConfigSync = {
        aiServices: configData.aiServices,
        routing: configData.routing,
        security: configData.security,
        version: configData.version,
        timestamp: new Date(configData.timestamp)
      };

      await this.updateConfig(configSync);

    } catch (error) {
      console.error('处理配置更新消息失败:', error);
    }
  }

  /**
   * 加载本地配置
   */
  private async loadLocalConfig(): Promise<void> {
    try {
      const configData = await fs.readFile(this.configPath, 'utf-8');
      this.currentConfig = JSON.parse(configData);
      this.currentVersion = this.currentConfig.version || '1.0.0';
      
      console.log(`已加载本地配置，版本: ${this.currentVersion}`);
      
    } catch (error) {
      console.log('本地配置文件不存在，使用默认配置');
      this.currentConfig = this.getDefaultConfig();
      await this.saveLocalConfig();
    }
  }

  /**
   * 保存配置到本地文件
   */
  private async saveLocalConfig(): Promise<void> {
    try {
      const configDir = path.dirname(this.configPath);
      await fs.mkdir(configDir, { recursive: true });
      
      const configData = JSON.stringify(this.currentConfig, null, 2);
      await fs.writeFile(this.configPath, configData, 'utf-8');
      
      console.log('配置已保存到本地文件');
      
    } catch (error) {
      console.error('保存配置文件失败:', error);
    }
  }

  /**
   * 获取默认配置
   */
  private getDefaultConfig(): Record<string, any> {
    return {
      version: '1.0.0',
      aiServices: {},
      routing: {
        strategy: 'round_robin',
        healthThreshold: 50
      },
      security: {
        rateLimiting: {
          windowMs: 60000,
          max: 100
        },
        cors: {
          enabled: true,
          origins: ['*']
        }
      },
      lastUpdate: new Date().toISOString()
    };
  }

  /**
   * 获取AI服务配置
   */
  getAiServiceConfig(serviceName: string): AiServiceConfig | null {
    const aiServices = this.currentConfig.aiServices || {};
    return aiServices[serviceName] || null;
  }

  /**
   * 获取所有AI服务配置
   */
  getAllAiServiceConfigs(): Record<string, AiServiceConfig> {
    return this.currentConfig.aiServices || {};
  }

  /**
   * 获取路由配置
   */
  getRoutingConfig(): any {
    return this.currentConfig.routing || {};
  }

  /**
   * 获取安全配置
   */
  getSecurityConfig(): any {
    return this.currentConfig.security || {};
  }

  /**
   * 获取当前配置版本
   */
  getCurrentVersion(): string {
    return this.currentVersion;
  }

  /**
   * 获取完整配置
   */
  getFullConfig(): Record<string, any> {
    return { ...this.currentConfig };
  }

  /**
   * 检查配置是否有效
   */
  validateConfig(config: any): boolean {
    try {
      // 基本结构检查
      if (!config || typeof config !== 'object') {
        return false;
      }

      // 版本检查
      if (!config.version || typeof config.version !== 'string') {
        return false;
      }

      // AI服务配置检查
      if (config.aiServices && typeof config.aiServices !== 'object') {
        return false;
      }

      // 路由配置检查
      if (config.routing && typeof config.routing !== 'object') {
        return false;
      }

      return true;

    } catch (error) {
      console.error('配置验证失败:', error);
      return false;
    }
  }

  /**
   * 重置配置为默认值
   */
  async resetToDefault(): Promise<void> {
    console.log('重置配置为默认值');
    
    this.currentConfig = this.getDefaultConfig();
    this.currentVersion = this.currentConfig.version;
    
    await this.saveLocalConfig();
    
    this.edgeClient.emit('config_reset', this.currentConfig);
  }
}
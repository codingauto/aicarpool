import { prisma } from './prisma';
import { encryptSensitiveData, decryptSensitiveData, generateRandomString } from './crypto';
import axios from 'axios';
import crypto from 'crypto';
import { generateOAuthParams } from './oauth-helper';
import redis from './redis';

export interface AiAccountCredentials {
  apiKey?: string;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number;
  scopes?: string[];
  projectId?: string;
  // 多模型支持
  modelSpecificKeys?: Record<string, string>; // 模型特定的API密钥
  fallbackKeys?: string[]; // 备用API密钥列表
}

export interface ProxyConfig {
  type: 'socks5' | 'http' | 'https';
  host: string;
  port: number;
  username?: string;
  password?: string;
}

export interface MultiModelConfig {
  supportedModels?: string[]; // 该账号支持的模型列表
  defaultModel?: string; // 默认模型
  rateLimits?: Record<string, {
    requestsPerMinute?: number;
    tokensPerMinute?: number;
  }>; // 各模型的速率限制
}

export interface CreateAccountData {
  groupId: string;
  serviceType: 'claude' | 'gemini' | 'ampcode' | 'kimi' | 'zhipu' | 'qwen';
  name: string;
  description?: string;
  accountType: 'shared' | 'dedicated';
  authType: 'oauth' | 'api_key';
  credentials: AiAccountCredentials;
  proxy?: ProxyConfig;
  multiModelConfig?: MultiModelConfig; // 多模型配置
}

export interface OAuthSession {
  sessionId: string;
  serviceType: string; // 添加服务类型
  codeVerifier?: string;
  state: string;
  codeChallenge?: string;
  proxy?: ProxyConfig;
  createdAt: Date;
  expiresAt: Date;
}

// OAuth 会话现在存储在 Redis 中

class AiAccountService {
  // 创建AI服务账户
  async createAccount(data: CreateAccountData) {
    const encryptedCredentials = encryptSensitiveData(JSON.stringify(data.credentials));
    
    const account = await prisma.aiServiceAccount.create({
      data: {
        groupId: data.groupId,
        serviceType: data.serviceType,
        name: data.name,
        description: data.description,
        accountType: data.accountType,
        authType: data.authType,
        encryptedCredentials,
        // OAuth 字段
        oauthAccessToken: data.credentials.accessToken ? encryptSensitiveData(data.credentials.accessToken) : null,
        oauthRefreshToken: data.credentials.refreshToken ? encryptSensitiveData(data.credentials.refreshToken) : null,
        oauthExpiresAt: data.credentials.expiresAt ? new Date(data.credentials.expiresAt) : null,
        oauthScopes: data.credentials.scopes?.join(' '),
        // 代理字段
        proxyType: data.proxy?.type,
        proxyHost: data.proxy?.host,
        proxyPort: data.proxy?.port,
        proxyUsername: data.proxy?.username ? encryptSensitiveData(data.proxy.username) : null,
        proxyPassword: data.proxy?.password ? encryptSensitiveData(data.proxy.password) : null,
        // Gemini 特有
        projectId: data.credentials.projectId,
      },
    });

    return this.formatAccount(account);
  }

  // 获取所有账户
  async getAllAccounts(groupId: string, serviceType?: string) {
    const accounts = await prisma.aiServiceAccount.findMany({
      where: {
        groupId,
        ...(serviceType && { serviceType }),
      },
      include: {
        groupAiServices: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return accounts.map(account => this.formatAccount(account));
  }

  // 获取单个账户
  async getAccount(accountId: string) {
    const account = await prisma.aiServiceAccount.findUnique({
      where: { id: accountId },
      include: {
        groupAiServices: true,
      },
    });

    if (!account) {
      throw new Error('Account not found');
    }

    return this.formatAccount(account);
  }

  // 更新账户
  async updateAccount(accountId: string, data: Partial<CreateAccountData>) {
    const existingAccount = await prisma.aiServiceAccount.findUnique({
      where: { id: accountId },
    });

    if (!existingAccount) {
      throw new Error('Account not found');
    }

    const updateData: any = {};

    if (data.name) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.accountType) updateData.accountType = data.accountType;

    if (data.credentials) {
      updateData.encryptedCredentials = encryptSensitiveData(JSON.stringify(data.credentials));
      
      if (data.credentials.accessToken) {
        updateData.oauthAccessToken = encryptSensitiveData(data.credentials.accessToken);
      }
      if (data.credentials.refreshToken) {
        updateData.oauthRefreshToken = encryptSensitiveData(data.credentials.refreshToken);
      }
      if (data.credentials.expiresAt) {
        updateData.oauthExpiresAt = new Date(data.credentials.expiresAt);
      }
      if (data.credentials.scopes) {
        updateData.oauthScopes = data.credentials.scopes.join(' ');
      }
      if (data.credentials.projectId) {
        updateData.projectId = data.credentials.projectId;
      }
    }

    if (data.proxy) {
      updateData.proxyType = data.proxy.type;
      updateData.proxyHost = data.proxy.host;
      updateData.proxyPort = data.proxy.port;
      updateData.proxyUsername = data.proxy.username ? encryptSensitiveData(data.proxy.username) : null;
      updateData.proxyPassword = data.proxy.password ? encryptSensitiveData(data.proxy.password) : null;
    }

    const updatedAccount = await prisma.aiServiceAccount.update({
      where: { id: accountId },
      data: updateData,
      include: {
        groupAiServices: true,
      },
    });

    return this.formatAccount(updatedAccount);
  }

  // 删除账户
  async deleteAccount(accountId: string) {
    // 检查是否有服务绑定到此账户
    const boundServices = await prisma.groupAiService.findMany({
      where: { accountId },
    });

    if (boundServices.length > 0) {
      throw new Error(`Cannot delete account: ${boundServices.length} services are bound to this account`);
    }

    await prisma.aiServiceAccount.delete({
      where: { id: accountId },
    });

    return { success: true };
  }

  // 切换账户状态
  async toggleAccountStatus(accountId: string) {
    const account = await prisma.aiServiceAccount.findUnique({
      where: { id: accountId },
    });

    if (!account) {
      throw new Error('Account not found');
    }

    const updatedAccount = await prisma.aiServiceAccount.update({
      where: { id: accountId },
      data: {
        isEnabled: !account.isEnabled,
      },
      include: {
        groupAiServices: true,
      },
    });

    return this.formatAccount(updatedAccount);
  }

  // 获取账户凭证（解密）
  async getAccountCredentials(accountId: string): Promise<AiAccountCredentials> {
    const account = await prisma.aiServiceAccount.findUnique({
      where: { id: accountId },
    });

    if (!account) {
      throw new Error('Account not found');
    }

    try {
      const credentials = JSON.parse(decryptSensitiveData(account.encryptedCredentials));
      return credentials;
    } catch (error) {
      throw new Error('Failed to decrypt account credentials');
    }
  }

  // 刷新OAuth Token
  async refreshToken(accountId: string) {
    const account = await prisma.aiServiceAccount.findUnique({
      where: { id: accountId },
    });

    if (!account || account.authType !== 'oauth') {
      throw new Error('Account not found or not OAuth account');
    }

    if (!account.oauthRefreshToken) {
      throw new Error('No refresh token available');
    }

    const refreshToken = decryptSensitiveData(account.oauthRefreshToken);
    
    try {
      let newTokens: { accessToken: string; refreshToken?: string; expiresAt: string } | null = null;
      
      if (account.serviceType === 'claude') {
        newTokens = await this.refreshClaudeToken(refreshToken, account);
      } else if (account.serviceType === 'gemini') {
        newTokens = await this.refreshGeminiToken(refreshToken, account);
      } else if (account.serviceType === 'ampcode') {
        newTokens = await this.refreshAmpcodeToken(refreshToken, account);
      } else {
        throw new Error(`Token refresh not supported for service type: ${account.serviceType}`);
      }

      if (!newTokens) {
        throw new Error('Failed to refresh tokens');
      }

      // 更新数据库中的token
      await prisma.aiServiceAccount.update({
        where: { id: accountId },
        data: {
          oauthAccessToken: encryptSensitiveData(newTokens.accessToken),
          oauthRefreshToken: newTokens.refreshToken ? encryptSensitiveData(newTokens.refreshToken) : account.oauthRefreshToken,
          oauthExpiresAt: new Date(newTokens.expiresAt),
          lastUsedAt: new Date(),
          status: 'active',
          errorMessage: null,
        },
      });

      return {
        success: true,
        accessToken: newTokens.accessToken,
        expiresAt: newTokens.expiresAt,
      };
    } catch (error) {
      // 更新错误状态
      await prisma.aiServiceAccount.update({
        where: { id: accountId },
        data: {
          status: 'error',
          errorMessage: error instanceof Error ? error.message : String(error),
        },
      });
      
      throw error;
    }
  }

  // 生成OAuth授权URL
  async generateOAuthUrl(serviceType: string, proxy?: ProxyConfig) {
    const sessionId = crypto.randomUUID();
    
    if (serviceType === 'claude') {
      // 使用专门的 OAuth 参数生成函数
      const oauthParams = generateOAuthParams();

      // 存储会话信息到 Redis
      const session: OAuthSession = {
        sessionId,
        serviceType,
        codeVerifier: oauthParams.codeVerifier,
        state: oauthParams.state,
        codeChallenge: oauthParams.codeChallenge,
        proxy,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10分钟过期
      };

      await redis.setOAuthSession(sessionId, session, 600); // 10分钟 TTL

      return {
        authUrl: oauthParams.authUrl,
        sessionId,
        instructions: [
          '1. 复制上面的链接到浏览器中打开',
          '2. 登录您的 Claude 账户',
          '3. 同意应用权限',
          '4. 复制浏览器地址栏中的完整 URL',
          '5. 在表单中粘贴完整的回调 URL 或提取授权码',
        ],
      };
    } else if (serviceType === 'gemini') {
      const state = generateRandomString(16);
      const params = new URLSearchParams({
        response_type: 'code',
        client_id: '581584304501-4pf1rce7lqbbvmhk15p4i37cpv3kd10v.apps.googleusercontent.com',
        redirect_uri: 'http://localhost:45462',
        scope: 'https://www.googleapis.com/auth/cloud-platform',
        access_type: 'offline',
        prompt: 'consent',
        state,
      });

      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;

      // 存储会话信息到 Redis
      const session = {
        sessionId,
        serviceType,
        state,
        proxy,
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(), // 10分钟过期
      };

      await redis.setOAuthSession(sessionId, session, 600); // 10分钟 TTL

      return {
        authUrl,
        sessionId,
        instructions: [
          '1. 复制上面的链接到浏览器中打开',
          '2. 登录您的 Google 账户',
          '3. 同意应用权限',
          '4. 复制浏览器地址栏中的完整 URL',
          '5. 在表单中粘贴完整的回调 URL 或提取授权码',
        ],
      };
    } else if (serviceType === 'ampcode') {
      const state = generateRandomString(16);
      // AMPCode OAuth 配置
      const params = new URLSearchParams({
        response_type: 'code',
        client_id: 'ampcode-client-id', // 需要实际的client_id
        redirect_uri: 'http://localhost:3000/oauth/callback',
        scope: 'api:read api:write',
        state,
      });

      const authUrl = `https://auth.ampcode.ai/oauth/authorize?${params.toString()}`;

      // 存储会话信息到 Redis
      const session = {
        sessionId,
        serviceType,
        state,
        proxy,
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(), // 10分钟过期
      };

      await redis.setOAuthSession(sessionId, session, 600); // 10分钟 TTL

      return {
        authUrl,
        sessionId,
        instructions: [
          '1. 复制上面的链接到浏览器中打开',
          '2. 登录您的 AMPCode 账户',
          '3. 同意应用权限',
          '4. 复制浏览器地址栏中的完整 URL',
          '5. 在表单中粘贴完整的回调 URL 或提取授权码',
        ],
      };
    } else {
      throw new Error(`OAuth not supported for service type: ${serviceType}`);
    }
  }

  // 获取OAuth会话信息
  async getOAuthSession(sessionId: string): Promise<any> {
    try {
      return await redis.getOAuthSession(sessionId);
    } catch (error) {
      console.error('Failed to get OAuth session from Redis:', error);
      return null;
    }
  }

  // 交换OAuth授权码
  async exchangeOAuthCode(sessionId: string, authCodeOrUrl: string) {
    const session = await redis.getOAuthSession(sessionId);
    if (!session) {
      throw new Error('Invalid or expired OAuth session');
    }

    const expiresAt = new Date(session.expiresAt);
    if (new Date() > expiresAt) {
      await redis.deleteOAuthSession(sessionId);
      throw new Error('OAuth session has expired');
    }

    // 解析授权码 - 使用与claude-relay-service相同的逻辑
    let authCode: string;
    try {
      const { parseCallbackUrl } = await import('./oauth-helper');
      authCode = parseCallbackUrl(authCodeOrUrl);
    } catch (error) {
      // 如果parseCallbackUrl失败，回退到简单解析
      try {
        if (authCodeOrUrl.includes('code=')) {
          const url = new URL(authCodeOrUrl);
          authCode = url.searchParams.get('code') || '';
          if (!authCode) {
            throw new Error('No authorization code found in URL');
          }
        } else {
          // 简单清理：移除URL fragments和参数
          authCode = authCodeOrUrl.split('#')[0]?.split('&')[0] ?? authCodeOrUrl;
        }
      } catch (fallbackError) {
        throw new Error('Failed to parse authorization code from input');
      }
    }

    try {
      let tokens;
      
      if (session.serviceType === 'claude') {
        // 使用真实的 Claude OAuth token 交换
        const { exchangeCodeForTokens } = await import('./oauth-helper');
        
        tokens = await exchangeCodeForTokens(
          authCode,
          session.codeVerifier!,
          session.state,
          session.proxy || null
        );
      } else if (session.serviceType === 'gemini') {
        // Gemini token 交换逻辑（暂时保持简化实现）
        tokens = {
          accessToken: 'gemini-mock-access-token',
          refreshToken: 'gemini-mock-refresh-token',
          expiresAt: Date.now() + 3600000,
          scopes: ['https://www.googleapis.com/auth/cloud-platform'],
          isMax: false
        };
      } else {
        throw new Error(`OAuth not supported for service type: ${session.serviceType}`);
      }
      
      // 清理会话
      await redis.deleteOAuthSession(sessionId);
      
      return {
        success: true,
        tokens: {
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          expiresAt: tokens.expiresAt,
          scopes: tokens.scopes,
        },
      };
    } catch (error) {
      // 清理会话，即使失败也要清理
      await redis.deleteOAuthSession(sessionId);
      
      // 改进错误信息，包含更多上下文
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Token exchange failed: ${errorMessage}`);
    }
  }

  // 选择可用账户（负载均衡）
  async selectAvailableAccount(groupId: string, serviceType: string, sessionHash?: string) {
    const accounts = await prisma.aiServiceAccount.findMany({
      where: {
        groupId,
        serviceType,
        isEnabled: true,
        status: 'active',
        accountType: 'shared', // 只从共享账户中选择
      },
      orderBy: {
        lastUsedAt: 'asc', // 最久未使用的优先
      },
    });

    if (accounts.length === 0) {
      throw new Error(`No active shared ${serviceType} accounts available`);
    }

    // 选择第一个（最久未使用的）
    const selectedAccount = accounts[0];
    
    // 更新最后使用时间
    await prisma.aiServiceAccount.update({
      where: { id: selectedAccount.id },
      data: { lastUsedAt: new Date() },
    });

    return selectedAccount.id;
  }

  // 为多模型选择合适的账户和API密钥
  async selectAccountForModel(groupId: string, modelId: string, serviceTypes: string[] = ['claude', 'kimi', 'zhipu', 'qwen']) {
    // 优先选择支持该模型的专用账户
    for (const serviceType of serviceTypes) {
      const accounts = await prisma.aiServiceAccount.findMany({
        where: {
          groupId,
          serviceType,
          isEnabled: true,
          status: 'active',
        },
        orderBy: {
          lastUsedAt: 'asc',
        },
      });

      for (const account of accounts) {
        try {
          const credentials = await this.getAccountCredentials(account.id);
          
          // 检查是否有模型特定的密钥
          if (credentials.modelSpecificKeys && credentials.modelSpecificKeys[modelId]) {
            await this.updateAccountUsage(account.id);
            return {
              accountId: account.id,
              apiKey: credentials.modelSpecificKeys[modelId],
              serviceType: account.serviceType,
              modelId,
            };
          }
          
          // 使用通用API密钥
          if (credentials.apiKey) {
            await this.updateAccountUsage(account.id);
            return {
              accountId: account.id,
              apiKey: credentials.apiKey,
              serviceType: account.serviceType,
              modelId,
            };
          }
        } catch (error) {
          console.warn(`Failed to get credentials for account ${account.id}:`, error);
          continue;
        }
      }
    }

    throw new Error(`No suitable account found for model: ${modelId}`);
  }

  // 更新账户使用情况
  private async updateAccountUsage(accountId: string) {
    await prisma.aiServiceAccount.update({
      where: { id: accountId },
      data: { lastUsedAt: new Date() },
    });
  }

  // 获取多模型支持情况
  async getMultiModelSupport(groupId: string) {
    const accounts = await prisma.aiServiceAccount.findMany({
      where: {
        groupId,
        isEnabled: true,
        status: 'active',
      },
    });

    const modelSupport: Record<string, string[]> = {};
    const availableModels = new Set<string>();

    for (const account of accounts) {
      try {
        const credentials = await this.getAccountCredentials(account.id);
        
        // 收集该账户支持的模型
        const supportedModels: string[] = [];
        
        // 从模型特定密钥收集
        if (credentials.modelSpecificKeys) {
          Object.keys(credentials.modelSpecificKeys).forEach(modelId => {
            supportedModels.push(modelId);
            availableModels.add(modelId);
          });
        }
        
        // 根据服务类型添加默认支持的模型
        const defaultModelsByService: Record<string, string[]> = {
          claude: ['claude-4-sonnet', 'claude-4-opus'],
          kimi: ['kimi-k2'],
          zhipu: ['glm-4.5'],
          qwen: ['qwen-max'],
        };
        
        const serviceDefaults = defaultModelsByService[account.serviceType] || [];
        serviceDefaults.forEach(modelId => {
          if (!supportedModels.includes(modelId)) {
            supportedModels.push(modelId);
            availableModels.add(modelId);
          }
        });
        
        modelSupport[account.id] = supportedModels;
      } catch (error) {
        console.warn(`Failed to check model support for account ${account.id}:`, error);
      }
    }

    return {
      accountModelSupport: modelSupport,
      availableModels: Array.from(availableModels).sort(),
      totalAccounts: accounts.length,
    };
  }

  // 格式化账户数据（移除敏感信息）
  private formatAccount(account: any) {
    const proxy = account.proxyType ? {
      type: account.proxyType,
      host: account.proxyHost,
      port: account.proxyPort,
      username: account.proxyUsername ? '***' : undefined, // 隐藏用户名
      password: account.proxyPassword ? '***' : undefined, // 隐藏密码
    } : null;

    return {
      id: account.id,
      groupId: account.groupId,
      serviceType: account.serviceType,
      name: account.name,
      description: account.description,
      accountType: account.accountType,
      authType: account.authType,
      status: account.status,
      isEnabled: account.isEnabled,
      lastUsedAt: account.lastUsedAt,
      createdAt: account.createdAt,
      updatedAt: account.updatedAt,
      errorMessage: account.errorMessage,
      // OAuth信息（隐藏敏感部分）
      hasAccessToken: !!account.oauthAccessToken,
      hasRefreshToken: !!account.oauthRefreshToken,
      oauthExpiresAt: account.oauthExpiresAt,
      oauthScopes: account.oauthScopes?.split(' ') || [],
      // 代理信息（隐藏敏感部分）
      proxy,
      // Gemini特有
      projectId: account.projectId,
      // 关联的服务数量
      boundServicesCount: account.groupAiServices?.length || 0,
    };
  }

  // Claude Token刷新（占位符实现）
  private async refreshClaudeToken(refreshToken: string, account: any): Promise<{ accessToken: string; refreshToken?: string; expiresAt: string }> {
    // 实际实现需要调用Claude API
    throw new Error('Claude token refresh not implemented');
  }

  // Gemini Token刷新（占位符实现）
  private async refreshGeminiToken(refreshToken: string, account: any): Promise<{ accessToken: string; refreshToken?: string; expiresAt: string }> {
    // 实际实现需要调用Google OAuth API
    throw new Error('Gemini token refresh not implemented');
  }

  // AMPCode Token刷新（占位符实现）
  private async refreshAmpcodeToken(refreshToken: string, account: any): Promise<{ accessToken: string; refreshToken?: string; expiresAt: string }> {
    // 实际实现需要调用AMPCode API
    throw new Error('AMPCode token refresh not implemented');
  }
}

export const aiAccountService = new AiAccountService();
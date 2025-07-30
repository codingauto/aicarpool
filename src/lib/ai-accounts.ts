import { prisma } from './prisma';
import { encryptSensitiveData, decryptSensitiveData, generateRandomString } from './crypto';
import axios from 'axios';

export interface AiAccountCredentials {
  apiKey?: string;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number;
  scopes?: string[];
  projectId?: string;
}

export interface ProxyConfig {
  type: 'socks5' | 'http' | 'https';
  host: string;
  port: number;
  username?: string;
  password?: string;
}

export interface CreateAccountData {
  groupId: string;
  serviceType: 'claude' | 'gemini' | 'ampcode';
  name: string;
  description?: string;
  accountType: 'shared' | 'dedicated';
  authType: 'oauth' | 'api_key';
  credentials: AiAccountCredentials;
  proxy?: ProxyConfig;
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

// 临时存储 OAuth 会话（在实际项目中应该使用 Redis 或数据库）
const oauthSessions = new Map<string, OAuthSession>();

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
      let newTokens;
      
      if (account.serviceType === 'claude') {
        newTokens = await this.refreshClaudeToken(refreshToken, account);
      } else if (account.serviceType === 'gemini') {
        newTokens = await this.refreshGeminiToken(refreshToken, account);
      } else if (account.serviceType === 'ampcode') {
        newTokens = await this.refreshAmpcodeToken(refreshToken, account);
      } else {
        throw new Error(`Token refresh not supported for service type: ${account.serviceType}`);
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
          errorMessage: error.message,
        },
      });
      
      throw error;
    }
  }

  // 生成OAuth授权URL
  async generateOAuthUrl(serviceType: string, proxy?: ProxyConfig) {
    const sessionId = generateRandomString(32);
    const state = generateRandomString(16);
    
    let authUrl: string;
    let codeVerifier: string | undefined;
    let codeChallenge: string | undefined;

    if (serviceType === 'claude') {
      // 生成 PKCE 参数
      codeVerifier = generateRandomString(32);
      codeChallenge = require('crypto')
        .createHash('sha256')
        .update(codeVerifier)
        .digest('base64url');

      const params = new URLSearchParams({
        response_type: 'code',
        client_id: '9d1c250a-e61b-44d9-88ed-5944d1962f5e', // Claude 官方 client_id
        redirect_uri: 'https://claude.ai/oauth/callback',
        scope: 'user:inference',
        state,
        code_challenge: codeChallenge,
        code_challenge_method: 'S256',
      });

      authUrl = `https://console.anthropic.com/oauth/authorize?${params.toString()}`;
    } else if (serviceType === 'gemini') {
      const params = new URLSearchParams({
        response_type: 'code',
        client_id: '581584304501-4pf1rce7lqbbvmhk15p4i37cpv3kd10v.apps.googleusercontent.com',
        redirect_uri: 'http://localhost:45462',
        scope: 'https://www.googleapis.com/auth/cloud-platform',
        access_type: 'offline',
        prompt: 'consent',
        state,
      });

      authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
    } else if (serviceType === 'ampcode') {
      // AMPCode OAuth 配置
      const params = new URLSearchParams({
        response_type: 'code',
        client_id: 'ampcode-client-id', // 需要实际的client_id
        redirect_uri: 'http://localhost:3000/oauth/callback',
        scope: 'api:read api:write',
        state,
      });

      authUrl = `https://auth.ampcode.ai/oauth/authorize?${params.toString()}`;
    } else {
      throw new Error(`OAuth not supported for service type: ${serviceType}`);
    }

    // 存储会话信息
    const session: OAuthSession = {
      sessionId,
      serviceType,
      codeVerifier,
      state,
      codeChallenge,
      proxy,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10分钟过期
    };

    oauthSessions.set(sessionId, session);

    return {
      authUrl,
      sessionId,
      instructions: [
        '1. 复制上面的链接到浏览器中打开',
        '2. 登录您的账户',
        '3. 同意应用权限',
        '4. 复制浏览器地址栏中的完整 URL',
        '5. 在表单中粘贴完整的回调 URL 或提取授权码',
      ],
    };
  }

  // 获取OAuth会话信息
  getOAuthSession(sessionId: string): OAuthSession | null {
    return oauthSessions.get(sessionId) || null;
  }

  // 交换OAuth授权码
  async exchangeOAuthCode(sessionId: string, authCodeOrUrl: string) {
    const session = oauthSessions.get(sessionId);
    if (!session) {
      throw new Error('Invalid or expired OAuth session');
    }

    if (new Date() > session.expiresAt) {
      oauthSessions.delete(sessionId);
      throw new Error('OAuth session has expired');
    }

    // 解析授权码
    let authCode: string;
    try {
      if (authCodeOrUrl.includes('code=')) {
        const url = new URL(authCodeOrUrl);
        authCode = url.searchParams.get('code') || '';
        if (!authCode) {
          throw new Error('No authorization code found in URL');
        }
      } else {
        authCode = authCodeOrUrl;
      }
    } catch (error) {
      throw new Error('Failed to parse authorization code from input');
    }

    try {
      let tokens;
      // 这里需要根据不同服务类型实现token交换逻辑
      // 由于没有实际的OAuth client secrets，这里只是示例结构
      
      // 清理会话
      oauthSessions.delete(sessionId);
      
      return {
        success: true,
        tokens: {
          accessToken: 'mock-access-token',
          refreshToken: 'mock-refresh-token',
          expiresAt: Date.now() + 3600000, // 1小时
          scopes: ['user:inference'],
        },
      };
    } catch (error) {
      oauthSessions.delete(sessionId);
      throw error;
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
  private async refreshClaudeToken(refreshToken: string, account: any) {
    // 实际实现需要调用Claude API
    throw new Error('Claude token refresh not implemented');
  }

  // Gemini Token刷新（占位符实现）
  private async refreshGeminiToken(refreshToken: string, account: any) {
    // 实际实现需要调用Google OAuth API
    throw new Error('Gemini token refresh not implemented');
  }

  // AMPCode Token刷新（占位符实现）
  private async refreshAmpcodeToken(refreshToken: string, account: any) {
    // 实际实现需要调用AMPCode API
    throw new Error('AMPCode token refresh not implemented');
  }
}

export const aiAccountService = new AiAccountService();
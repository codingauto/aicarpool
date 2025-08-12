/**
 * 认证服务
 * 
 * 集中管理token的存储、获取和刷新
 * 处理并发刷新请求，避免多次刷新
 */

interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

interface RefreshResponse {
  success: boolean;
  data?: TokenPair;
  message?: string;
  code?: string;
}

class AuthService {
  private static instance: AuthService;
  private refreshPromise: Promise<string | null> | null = null;
  private tokenExpiryTimeout: NodeJS.Timeout | null = null;

  private constructor() {}

  static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService();
    }
    return AuthService.instance;
  }

  /**
   * 获取access token
   */
  getAccessToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('token');
  }

  /**
   * 获取refresh token
   */
  getRefreshToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('refreshToken');
  }

  /**
   * 保存token对
   */
  saveTokens(tokens: TokenPair): void {
    if (typeof window === 'undefined') return;
    
    localStorage.setItem('token', tokens.accessToken);
    localStorage.setItem('refreshToken', tokens.refreshToken);
    
    // 设置自动刷新定时器（提前1分钟刷新）
    this.scheduleTokenRefresh(tokens.expiresIn);
  }

  /**
   * 清除tokens
   */
  clearTokens(): void {
    if (typeof window === 'undefined') return;
    
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    
    // 清除定时器
    if (this.tokenExpiryTimeout) {
      clearTimeout(this.tokenExpiryTimeout);
      this.tokenExpiryTimeout = null;
    }
  }

  /**
   * 刷新access token
   * 使用Promise避免并发刷新
   */
  async refreshAccessToken(): Promise<string | null> {
    // 如果已经在刷新，返回现有的Promise
    if (this.refreshPromise) {
      console.log('🔄 Token刷新已在进行中，等待结果...');
      return this.refreshPromise;
    }

    // 创建新的刷新Promise
    this.refreshPromise = this.doRefreshToken();
    
    try {
      const result = await this.refreshPromise;
      return result;
    } finally {
      // 清除Promise引用
      this.refreshPromise = null;
    }
  }

  /**
   * 实际执行token刷新
   */
  private async doRefreshToken(): Promise<string | null> {
    const refreshToken = this.getRefreshToken();
    
    if (!refreshToken) {
      console.error('❌ 没有refresh token，需要重新登录');
      this.clearTokens();
      return null;
    }

    try {
      console.log('🔄 开始刷新token...');
      
      const response = await fetch('/api/auth/refresh', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refreshToken }),
      });

      const data: RefreshResponse = await response.json();

      if (data.success && data.data) {
        console.log('✅ Token刷新成功');
        this.saveTokens(data.data);
        return data.data.accessToken;
      } else {
        console.error('❌ Token刷新失败:', data.message || data.code);
        
        // 如果refresh token过期，清除所有token
        if (data.code === 'REFRESH_TOKEN_EXPIRED' || data.code === 'INVALID_REFRESH_TOKEN') {
          this.clearTokens();
        }
        
        return null;
      }
    } catch (error) {
      console.error('❌ Token刷新请求失败:', error);
      return null;
    }
  }

  /**
   * 设置token自动刷新定时器
   */
  private scheduleTokenRefresh(expiresIn: number): void {
    // 清除现有定时器
    if (this.tokenExpiryTimeout) {
      clearTimeout(this.tokenExpiryTimeout);
    }

    // 提前60秒刷新token（确保不会在临界点失效）
    const refreshTime = Math.max((expiresIn - 60) * 1000, 0);
    
    if (refreshTime > 0) {
      console.log(`⏰ 将在 ${refreshTime / 1000} 秒后自动刷新token`);
      
      this.tokenExpiryTimeout = setTimeout(async () => {
        console.log('⏰ 自动刷新token时间到...');
        const newToken = await this.refreshAccessToken();
        
        if (!newToken) {
          console.error('❌ 自动刷新token失败');
          // 可以触发一个事件通知应用token刷新失败
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('auth:token-refresh-failed'));
          }
        }
      }, refreshTime);
    }
  }

  /**
   * 检查token是否即将过期
   * @param thresholdSeconds 过期阈值（秒）
   */
  isTokenExpiringSoon(thresholdSeconds: number = 60): boolean {
    const token = this.getAccessToken();
    if (!token) return true;

    try {
      // 验证 token 格式
      const parts = token.split('.');
      if (parts.length !== 3) {
        console.warn('Invalid token format');
        return true;
      }

      // 解码JWT token获取过期时间
      // 处理 base64url 编码（替换 - 和 _ 字符）
      const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      // 添加必要的填充
      const padded = base64 + '='.repeat((4 - base64.length % 4) % 4);
      const payload = JSON.parse(atob(padded));
      
      const expiryTime = payload.exp * 1000; // 转换为毫秒
      const currentTime = Date.now();
      const timeUntilExpiry = expiryTime - currentTime;
      
      return timeUntilExpiry < thresholdSeconds * 1000;
    } catch (error) {
      console.error('解析token失败:', error);
      return true;
    }
  }

  /**
   * 验证当前认证状态
   */
  isAuthenticated(): boolean {
    return !!this.getAccessToken();
  }

  /**
   * 处理登录响应
   */
  handleLoginResponse(tokens: TokenPair, user: any): void {
    this.saveTokens(tokens);
    
    if (typeof window !== 'undefined' && user) {
      localStorage.setItem('user', JSON.stringify(user));
    }
  }

  /**
   * 处理登出
   */
  logout(): void {
    this.clearTokens();
    
    // 触发登出事件
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('auth:logout'));
    }
  }
}

// 导出单例实例
export const authService = AuthService.getInstance();

// 导出类型
export type { TokenPair, RefreshResponse };
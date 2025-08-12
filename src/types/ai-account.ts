// AI账户相关类型定义

export interface ProxyConfig {
  enabled: boolean;
  type: 'socks5' | 'http' | 'https';
  host: string;
  port: string;
  username?: string;
  password?: string;
}

// Claude Console 配置选项
export interface ClaudeConsoleConfig {
  mode: 'native-api' | 'relay-service';
  relayServices: {
    kimi: boolean;
    qwen: boolean;
    glm: boolean;
    custom: boolean;
    customUrl?: string;
  };
}

export interface AccountForm {
  platform: 'claude' | 'gemini' | 'claude-console';
  addType: 'oauth' | 'manual';
  name: string;
  description: string;
  accountType: 'shared' | 'dedicated' | 'group';
  groupId?: string;
  projectId?: string;
  accessToken?: string;
  refreshToken?: string;
  proxy: ProxyConfig;
  // Claude Console 特定字段
  apiUrl?: string;
  apiKey?: string;
  priority: number;
  supportedModels?: string;
  userAgent?: string;
  rateLimitDuration: number;
  // 新增的Console配置
  consoleConfig?: ClaudeConsoleConfig;
}

export interface FormErrors {
  name?: string;
  accessToken?: string;
  apiUrl?: string;
  apiKey?: string;
  consoleConfig?: {
    mode?: string;
    relayServices?: string;
  };
}

export interface AccountGroup {
  id: string;
  name: string;
  platform: string;
  memberCount: number;
  description?: string;
}

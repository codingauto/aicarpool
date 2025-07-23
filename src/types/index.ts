// 用户相关类型
export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  role: 'admin' | 'user';
  status: 'active' | 'inactive' | 'banned';
  emailVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// AI服务相关类型
export interface AiService {
  id: string;
  serviceName: 'claude' | 'gemini' | 'ampcode';
  displayName: string;
  description?: string;
  baseUrl: string;
  isEnabled: boolean;
  rateLimits?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

// 拼车组相关类型
export interface Group {
  id: string;
  name: string;
  description?: string;
  maxMembers: number;
  status: 'active' | 'inactive' | 'suspended';
  settings?: Record<string, any>;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface GroupMember {
  id: string;
  groupId: string;
  userId: string;
  role: 'admin' | 'member';
  status: 'active' | 'inactive';
  joinedAt: Date;
}

export interface GroupAiService {
  id: string;
  groupId: string;
  aiServiceId: string;
  isEnabled: boolean;
  quota?: Record<string, any>;
  authConfig?: Record<string, any>;
  proxySettings?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

// 邀请相关类型
export interface Invitation {
  id: string;
  token: string;
  email: string;
  groupId: string;
  inviterId: string;
  status: 'pending' | 'accepted' | 'expired' | 'revoked';
  expiresAt: Date;
  createdAt: Date;
}

// API密钥相关类型
export interface ApiKey {
  id: string;
  key: string;
  name: string;
  description?: string;
  groupId: string;
  userId: string;
  aiServiceId: string;
  quotaLimit?: bigint;
  quotaUsed: bigint;
  status: 'active' | 'inactive' | 'revoked';
  expiresAt?: Date;
  lastUsedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// 代理相关类型
export interface ProxyResource {
  id: string;
  type: 'socks5' | 'http' | 'https';
  host: string;
  port: number;
  username?: string;
  password?: string;
  location?: string;
  provider?: string;
  status: 'active' | 'inactive' | 'error';
  lastChecked?: Date;
  responseTime?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProxyBinding {
  id: string;
  groupId: string;
  proxyResourceId: string;
  aiServiceId?: string;
  priority: number;
  isEnabled: boolean;
  createdAt: Date;
}

// 使用统计相关类型
export interface UsageStat {
  id: string;
  userId: string;
  groupId: string;
  aiServiceId: string;
  requestType: string;
  tokenCount: bigint;
  cost: number;
  requestTime: Date;
  responseTime?: number;
  status: 'success' | 'error' | 'timeout';
  errorCode?: string;
  metadata?: Record<string, any>;
}

// API响应类型
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// 认证相关类型
export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  name: string;
  email: string;
  password: string;
  inviteToken?: string;
}

export interface AuthResponse {
  user: User;
  token: string;
}

// 分页类型
export interface PaginationParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// 统计相关类型
export interface UsageStats {
  totalTokens: bigint;
  totalCost: number;
  requestCount: number;
  averageResponseTime: number;
}

export interface GroupStats {
  memberCount: number;
  activeApiKeys: number;
  totalUsage: UsageStats;
  serviceUsage: Record<string, UsageStats>;
}
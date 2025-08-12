'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { authService } from '@/lib/api/auth-service';
import { api } from '@/lib/api/api-client';

export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  avatar?: string;
  enterpriseRoles?: Array<{
    roleName: string;
    displayName: string;
    scope: string;
    enterpriseId: string;
    enterpriseName: string;
  }>;
}

interface UserContextType {
  user: User | null;
  isLoading: boolean;
  login: (token: string, refreshToken: string, userData: User) => void;
  logout: () => void;
  updateUser: (userData: Partial<User>) => void;
  refreshUser: () => Promise<void>;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

interface UserProviderProps {
  children: ReactNode;
}

export function UserProvider({ children }: UserProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // 从localStorage恢复用户状态
  useEffect(() => {
    const initializeUser = async () => {
      try {
        const token = authService.getAccessToken();
        const storedUser = localStorage.getItem('user');
        
        if (token && storedUser) {
          const userData = JSON.parse(storedUser);
          setUser(userData);
          
          // 检查token是否即将过期，如果是则尝试刷新
          if (authService.isTokenExpiringSoon(300)) { // 5分钟内过期
            console.log('🔄 Token即将过期，尝试刷新...');
            await authService.refreshAccessToken();
          }
        }
      } catch (error) {
        console.error('初始化用户状态失败:', error);
        // 清理无效的存储数据
        authService.clearTokens();
      } finally {
        setIsLoading(false);
      }
    };

    initializeUser();
    
    // 监听认证事件
    const handleLogout = () => {
      setUser(null);
      window.location.href = '/auth/login';
    };
    
    const handleTokenRefreshFailed = () => {
      console.error('Token自动刷新失败，需要重新登录');
      setUser(null);
      window.location.href = '/auth/login';
    };
    
    window.addEventListener('auth:logout', handleLogout);
    window.addEventListener('auth:token-refresh-failed', handleTokenRefreshFailed);
    
    return () => {
      window.removeEventListener('auth:logout', handleLogout);
      window.removeEventListener('auth:token-refresh-failed', handleTokenRefreshFailed);
    };
  }, []);

  const login = (token: string, refreshToken: string, userData: User) => {
    try {
      authService.handleLoginResponse(
        { accessToken: token, refreshToken, expiresIn: 900 },
        userData
      );
      setUser(userData);
    } catch (error) {
      console.error('登录状态保存失败:', error);
    }
  };

  const logout = () => {
    try {
      authService.logout();
      setUser(null);
    } catch (error) {
      console.error('登出清理失败:', error);
    }
  };

  const updateUser = (userData: Partial<User>) => {
    if (!user) return;
    
    try {
      const updatedUser = { ...user, ...userData };
      localStorage.setItem('user', JSON.stringify(updatedUser));
      setUser(updatedUser);
    } catch (error) {
      console.error('更新用户信息失败:', error);
    }
  };

  const refreshUser = async () => {
    if (!authService.isAuthenticated()) return;

    try {
      const response = await api.get('/api/auth/me');

      if (response.success && response.data) {
        updateUser(response.data);
      }
    } catch (error) {
      console.error('刷新用户信息失败:', error);
    }
  };

  const value: UserContextType = {
    user,
    isLoading,
    login,
    logout,
    updateUser,
    refreshUser
  };

  return (
    <UserContext.Provider value={value}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser(): UserContextType {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
}

// 简化的hooks，用于常见用例
export function useCurrentUser(): User | null {
  const { user } = useUser();
  return user;
}

export function useIsAuthenticated(): boolean {
  const { user } = useUser();
  return user !== null;
}

export function useUserRole(): string | null {
  const { user } = useUser();
  return user?.role || null;
}
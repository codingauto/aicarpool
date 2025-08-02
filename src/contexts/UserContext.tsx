'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

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
  login: (token: string, userData: User) => void;
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
    const initializeUser = () => {
      try {
        const token = localStorage.getItem('token');
        const storedUser = localStorage.getItem('user');
        
        if (token && storedUser) {
          const userData = JSON.parse(storedUser);
          setUser(userData);
        }
      } catch (error) {
        console.error('初始化用户状态失败:', error);
        // 清理无效的存储数据
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      } finally {
        setIsLoading(false);
      }
    };

    initializeUser();
  }, []);

  const login = (token: string, userData: User) => {
    try {
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(userData));
      setUser(userData);
    } catch (error) {
      console.error('登录状态保存失败:', error);
    }
  };

  const logout = () => {
    try {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
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
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      const response = await fetch('/api/auth/me', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const userData = await response.json();
        if (userData.success && userData.data) {
          updateUser(userData.data);
        }
      } else if (response.status === 401) {
        // Token无效，清理登录状态
        logout();
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
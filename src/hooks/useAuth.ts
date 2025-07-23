import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  role: string;
  groups?: Array<{
    id: string;
    name: string;
    role: string;
  }>;
}

interface AuthState {
  user: User | null;
  token: string | null;
  loading: boolean;
  isAuthenticated: boolean;
}

export function useAuth(): AuthState & {
  login: (token: string, user: User) => void;
  logout: () => void;
  updateUser: (user: User) => void;
} {
  const [state, setState] = useState<AuthState>({
    user: null,
    token: null,
    loading: true,
    isAuthenticated: false,
  });
  const router = useRouter();

  useEffect(() => {
    initializeAuth();
  }, []);

  const initializeAuth = async () => {
    try {
      const token = localStorage.getItem('token');
      const storedUser = localStorage.getItem('user');

      if (token && storedUser) {
        try {
          const user = JSON.parse(storedUser);
          setState({
            user,
            token,
            loading: false,
            isAuthenticated: true,
          });

          // 验证token是否仍然有效
          await validateToken(token);
        } catch (error) {
          console.error('Failed to parse stored user:', error);
          logout();
        }
      } else {
        setState(prev => ({
          ...prev,
          loading: false,
          isAuthenticated: false,
        }));
      }
    } catch (error) {
      console.error('Failed to initialize auth:', error);
      setState(prev => ({
        ...prev,
        loading: false,
        isAuthenticated: false,
      }));
    }
  };

  const validateToken = async (token: string) => {
    try {
      const response = await fetch('/api/auth/me', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Token validation failed');
      }

      const result = await response.json();
      if (result.success) {
        updateUser(result.data);
      } else {
        throw new Error('Invalid token');
      }
    } catch (error) {
      console.error('Token validation failed:', error);
      logout();
    }
  };

  const login = (token: string, user: User) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    setState({
      user,
      token,
      loading: false,
      isAuthenticated: true,
    });
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setState({
      user: null,
      token: null,
      loading: false,
      isAuthenticated: false,
    });
    router.push('/');
  };

  const updateUser = (user: User) => {
    localStorage.setItem('user', JSON.stringify(user));
    setState(prev => ({
      ...prev,
      user,
    }));
  };

  return {
    ...state,
    login,
    logout,
    updateUser,
  };
}
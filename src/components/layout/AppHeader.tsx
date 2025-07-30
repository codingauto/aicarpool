'use client';

import { useRouter, usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { 
  LayoutDashboard,
  Users, 
  Globe, 
  Activity, 
  Server,
  Network,
  LogOut,
  BookOpen
} from 'lucide-react';

interface NavigationItem {
  label: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
}

const navigationItems: NavigationItem[] = [
  { label: '仪表盘', path: '/dashboard', icon: LayoutDashboard },
  { label: '拼车组', path: '/groups', icon: Users },
  { label: 'IP资源池', path: '/ip-management', icon: Network },
  { label: '监控中心', path: '/monitoring', icon: Activity },
  { label: '边缘节点', path: '/edge-nodes', icon: Server },
  { label: '使用教程', path: '/tutorial', icon: BookOpen },
];

interface AppHeaderProps {
  title?: string;
  showUserInfo?: boolean;
  children?: React.ReactNode;
}

export function AppHeader({ title, showUserInfo = true, children }: AppHeaderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(showUserInfo);

  useEffect(() => {
    if (showUserInfo) {
      fetchUserInfo();
    }
  }, [showUserInfo]);

  const fetchUserInfo = async () => {
    try {
      // 首先尝试从localStorage获取
      const storedUser = localStorage.getItem('user');
      if (storedUser) {
        try {
          const userData = JSON.parse(storedUser);
          setUser(userData);
        } catch (e) {
          console.error('Failed to parse stored user:', e);
        }
      }

      // 然后从API获取最新信息
      const token = localStorage.getItem('token');
      if (token) {
        const response = await fetch('/api/user/profile', {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            setUser(data.data);
            localStorage.setItem('user', JSON.stringify(data.data));
          }
        }
      }
    } catch (error) {
      console.error('获取用户信息失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    router.push('/');
  };

  const isActive = (path: string) => {
    if (path === '/groups') {
      return pathname === '/groups' || pathname.startsWith('/groups/');
    }
    return pathname === path;
  };

  const getPageTitle = () => {
    if (title) return title;
    
    const currentItem = navigationItems.find(item => isActive(item.path));
    return currentItem ? currentItem.label : 'AiCarpool';
  };

  return (
    <header className="bg-white shadow-sm border-b">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center py-4">
          <div className="flex items-center space-x-6">
            <h1 className="text-2xl font-bold text-gray-900">
              {getPageTitle()}
            </h1>
            <nav className="hidden md:flex space-x-4">
              {navigationItems.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.path);
                
                return (
                  <Button
                    key={item.path}
                    variant="ghost"
                    className={`flex items-center space-x-2 ${
                      active ? 'bg-gray-100 text-gray-900' : 'text-gray-600 hover:text-gray-900'
                    }`}
                    onClick={() => router.push(item.path)}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{item.label}</span>
                  </Button>
                );
              })}
            </nav>
          </div>

          <div className="flex items-center space-x-4">
            {children}
            {showUserInfo && (
              <>
                {loading ? (
                  <div className="text-sm text-gray-400">加载中...</div>
                ) : user ? (
                  <div className="flex items-center space-x-3">
                    <div className="hidden sm:block">
                      <span className="text-sm text-gray-600">
                        欢迎，{user.name}
                      </span>
                    </div>
                    <div className="flex items-center space-x-2">
                      {user.avatar ? (
                        <img 
                          src={user.avatar} 
                          alt={user.name}
                          className="w-8 h-8 rounded-full"
                        />
                      ) : (
                        <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
                          <span className="text-sm font-medium text-gray-600">
                            {user.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                ) : null}
                
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={handleLogout}
                  className="flex items-center space-x-2"
                >
                  <LogOut className="w-4 h-4" />
                  <span className="hidden sm:inline">退出登录</span>
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Mobile Navigation */}
        <div className="md:hidden pb-4">
          <div className="flex space-x-2 overflow-x-auto">
            {navigationItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.path);
              
              return (
                <Button
                  key={item.path}
                  variant="ghost"
                  size="sm"
                  className={`flex items-center space-x-1 whitespace-nowrap ${
                    active ? 'bg-gray-100 text-gray-900' : 'text-gray-600'
                  }`}
                  onClick={() => router.push(item.path)}
                >
                  <Icon className="w-4 h-4" />
                  <span className="text-xs">{item.label}</span>
                </Button>
              );
            })}
          </div>
        </div>
      </div>
    </header>
  );
}
'use client';

import { useRouter, usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { 
  LayoutDashboard,
  Users, 
  Activity, 
  Server,
  Network,
  LogOut,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  XIcon,
  Building2,
  Shield,
  DollarSign,
  Database
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
  { label: '企业管理', path: '/enterprise', icon: Building2 },
  { label: '账号池', path: '/account-pools', icon: Database },
  { label: '预算管理', path: '/budget', icon: DollarSign },
  { label: '权限管理', path: '/permissions', icon: Shield },
  { label: '监控中心', path: '/monitoring', icon: Activity },
  { label: '边缘节点', path: '/edge-nodes', icon: Server },
  { label: '使用教程', path: '/tutorial', icon: BookOpen },
];

interface SidebarProps {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  isMobileOpen: boolean;
  onMobileToggle: () => void;
}

export function Sidebar({ isCollapsed, onToggleCollapse, isMobileOpen, onMobileToggle }: SidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUserInfo();
  }, []);

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

  return (
    <>
      {/* Mobile Overlay */}
      {isMobileOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={onMobileToggle}
        />
      )}

      {/* Sidebar */}
      <div className={`
        fixed top-0 left-0 h-full bg-white border-r border-gray-200 z-50 transition-all duration-300 ease-in-out
        ${isCollapsed ? 'w-16' : 'w-64'}
        ${isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200">
            {!isCollapsed && (
              <h1 className="text-xl font-bold text-gray-900">AiCarpool</h1>
            )}
            <div className="flex items-center gap-2">
              {/* Desktop collapse toggle */}
              <Button
                variant="ghost"
                size="sm"
                onClick={onToggleCollapse}
                className="hidden lg:flex"
              >
                {isCollapsed ? (
                  <ChevronRight className="w-4 h-4" />
                ) : (
                  <ChevronLeft className="w-4 h-4" />
                )}
              </Button>
              
              {/* Mobile close button */}
              <Button
                variant="ghost"
                size="sm"
                onClick={onMobileToggle}
                className="lg:hidden"
              >
                <XIcon className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
            {navigationItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.path);
              
              return (
                <Button
                  key={item.path}
                  variant="ghost"
                  className={`w-full justify-start gap-3 h-11 ${
                    active 
                      ? 'bg-blue-50 text-blue-700 border border-blue-200' 
                      : 'text-gray-700 hover:bg-gray-100'
                  } ${isCollapsed ? 'px-3' : 'px-4'}`}
                  onClick={() => {
                    router.push(item.path);
                    if (isMobileOpen) onMobileToggle();
                  }}
                  title={isCollapsed ? item.label : undefined}
                >
                  <Icon className="w-5 h-5 flex-shrink-0" />
                  {!isCollapsed && (
                    <span className="truncate">{item.label}</span>
                  )}
                </Button>
              );
            })}
          </nav>

          {/* User Info */}
          <div className="p-4 border-t border-gray-200">
            {loading ? (
              <div className="text-sm text-gray-400">加载中...</div>
            ) : user ? (
              <div className="space-y-3">
                <div className={`flex items-center gap-3 ${isCollapsed ? 'justify-center' : ''}`}>
                  {user.avatar ? (
                    <img 
                      src={user.avatar} 
                      alt={user.name}
                      className="w-8 h-8 rounded-full flex-shrink-0"
                    />
                  ) : (
                    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-sm font-medium text-blue-700">
                        {user.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                  )}
                  {!isCollapsed && (
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-gray-900 truncate">
                        {user.name}
                      </div>
                      <div className="text-xs text-gray-500 truncate">
                        {user.email}
                      </div>
                    </div>
                  )}
                </div>
                
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={handleLogout}
                  className={`w-full gap-2 ${isCollapsed ? 'px-2' : ''}`}
                  title={isCollapsed ? '退出登录' : undefined}
                >
                  <LogOut className="w-4 h-4 flex-shrink-0" />
                  {!isCollapsed && <span>退出登录</span>}
                </Button>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </>
  );
}
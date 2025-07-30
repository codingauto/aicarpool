'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Menu } from 'lucide-react';
import { Sidebar } from './Sidebar';

interface AppLayoutProps {
  children: React.ReactNode;
  title?: string;
  actions?: React.ReactNode;
}

export function AppLayout({ children, title, actions }: AppLayoutProps) {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  // 从 localStorage 恢复侧边栏状态
  useEffect(() => {
    const saved = localStorage.getItem('sidebar-collapsed');
    if (saved) {
      setIsCollapsed(JSON.parse(saved));
    }
  }, []);

  // 保存侧边栏状态到 localStorage
  const handleToggleCollapse = () => {
    const newState = !isCollapsed;
    setIsCollapsed(newState);
    localStorage.setItem('sidebar-collapsed', JSON.stringify(newState));
  };

  const handleMobileToggle = () => {
    setIsMobileOpen(!isMobileOpen);
  };

  // 获取页面标题
  const getPageTitle = () => {
    if (title) return title;
    
    const routeTitles: Record<string, string> = {
      '/dashboard': '仪表盘',
      '/groups': '拼车组',
      '/ip-management': 'IP资源池', 
      '/monitoring': '监控中心',
      '/edge-nodes': '边缘节点',
      '/tutorial': '使用教程',
      '/claude-code': 'Claude Code',
      '/debug': '调试页面',
      '/status': '系统状态',
    };

    // 处理动态路由
    if (pathname.startsWith('/groups/')) {
      return '拼车组详情';
    }
    if (pathname.startsWith('/invite/')) {
      return '邀请链接';
    }
    if (pathname.startsWith('/join/')) {
      return '加入拼车组';
    }

    return routeTitles[pathname] || 'AiCarpool';
  };

  // 检查是否是认证页面
  const isAuthPage = pathname.startsWith('/auth/') || pathname === '/';

  if (isAuthPage) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar 
        isCollapsed={isCollapsed}
        onToggleCollapse={handleToggleCollapse}
        isMobileOpen={isMobileOpen}
        onMobileToggle={handleMobileToggle}
      />
      
      {/* Main Content */}
      <div className={`transition-all duration-300 ease-in-out ${
        isCollapsed ? 'lg:ml-16' : 'lg:ml-64'
      }`}>
        {/* Top Bar */}
        <header className="bg-white border-b border-gray-200 px-4 py-3 lg:px-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {/* Mobile menu button */}
              <Button
                variant="ghost"
                size="sm"
                onClick={handleMobileToggle}
                className="lg:hidden"
              >
                <Menu className="w-5 h-5" />
              </Button>
              
              <h1 className="text-xl font-semibold text-gray-900">
                {getPageTitle()}
              </h1>
            </div>
            
            {/* Actions */}
            {actions && (
              <div className="flex items-center gap-2">
                {actions}
              </div>
            )}
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1">
          {children}
        </main>
      </div>
    </div>
  );
}
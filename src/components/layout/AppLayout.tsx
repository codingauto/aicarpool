'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Menu } from 'lucide-react';
import { Sidebar } from './Sidebar';
import { TopNavigation } from './TopNavigation';

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
      '/monitoring': '监控中心',
      '/edge-nodes': '边缘节点',
      '/tutorial': '使用教程',
      '/claude-code': 'Claude Code',
      '/debug': '调试页面',
      '/status': '系统状态',
      '/permissions': '权限管理',
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

  // 检查页面类型
  const isAuthPage = pathname.startsWith('/auth/') || pathname === '/landing';
  const isEnterpriseSelectionPage = pathname === '/'; // 企业选择页面
  const isEnterprisePage = pathname.startsWith('/enterprise/'); // 企业内部页面

  // 认证页面和企业页面跳过全局布局
  if (isAuthPage || isEnterprisePage) {
    return <>{children}</>;
  }

  // 企业选择页面使用顶部导航
  if (isEnterpriseSelectionPage) {
    return (
      <div className="min-h-screen bg-gray-50">
        <TopNavigation showNavigationMenu={true} />
        <main className="flex-1">
          {children}
        </main>
      </div>
    );
  }

  // 其他全局页面使用顶部导航 + 主内容
  return (
    <div className="min-h-screen bg-gray-50">
      <TopNavigation showNavigationMenu={true} />
      
      {/* Page Content - 直接渲染内容，不需要额外的标题栏 */}
      <main className="flex-1">
        {children}
      </main>
    </div>
  );
}
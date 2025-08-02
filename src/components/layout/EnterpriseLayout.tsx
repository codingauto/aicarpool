'use client';

import { useState, useEffect } from 'react';
import { usePathname, useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Menu, X } from 'lucide-react';
import { EnterpriseSidebar } from './EnterpriseSidebar';
import { EnterpriseTopNavigation } from './EnterpriseTopNavigation';

interface EnterpriseLayoutProps {
  children: React.ReactNode;
  title?: string;
  actions?: React.ReactNode;
}

export function EnterpriseLayout({ children, title, actions }: EnterpriseLayoutProps) {
  const pathname = usePathname();
  const params = useParams();
  const enterpriseId = params.enterpriseId as string;
  
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  // 从 localStorage 恢复侧边栏状态
  useEffect(() => {
    const saved = localStorage.getItem('enterprise-sidebar-collapsed');
    if (saved) {
      setIsCollapsed(JSON.parse(saved));
    }
  }, []);

  // 保存侧边栏状态到 localStorage
  const handleToggleCollapse = () => {
    const newState = !isCollapsed;
    setIsCollapsed(newState);
    localStorage.setItem('enterprise-sidebar-collapsed', JSON.stringify(newState));
  };

  const handleMobileToggle = () => {
    setIsMobileOpen(!isMobileOpen);
  };

  // 获取页面标题
  const getPageTitle = () => {
    if (title) return title;
    
    const routeTitles: Record<string, string> = {
      'dashboard': '企业仪表盘',
      'groups': '拼车组管理',
      'ai-resources': 'AI资源管理',
      'analytics': '数据分析',
      'budget': '预算管理',
      'permissions': '权限管理',
      'organization': '组织架构',
      'monitoring': '监控中心',
      'alerts': '告警管理',
      'settings': '企业设置',
    };

    // 从路径中提取页面类型
    const pathParts = pathname.split('/');
    const pageType = pathParts[pathParts.length - 1];
    
    // 处理动态路由
    if (pathname.includes('/groups/') && pathParts.length > 4) {
      return '拼车组详情';
    }

    return routeTitles[pageType] || 'AiCarpool';
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 企业顶部导航 */}
      <EnterpriseTopNavigation enterpriseId={enterpriseId} />
      
      <div className="flex">
        {/* 侧边栏 */}
        <EnterpriseSidebar
          enterpriseId={enterpriseId}
          isCollapsed={isCollapsed}
          isMobileOpen={isMobileOpen}
          onToggleCollapse={handleToggleCollapse}
          onMobileToggle={handleMobileToggle}
        />

        {/* 主内容区域 */}
        <div className={`flex-1 transition-all duration-300 ${
          isCollapsed ? 'lg:ml-16' : 'lg:ml-64'
        }`}>
          {/* 移动端遮罩 */}
          {isMobileOpen && (
            <div
              className="fixed inset-0 z-30 bg-black bg-opacity-50 lg:hidden"
              onClick={handleMobileToggle}
            />
          )}

          {/* 页面标题栏 */}
          <div className="bg-white border-b border-gray-200">
            <div className="px-6 py-4">
              <div className="flex items-center justify-between">
                {/* 移动端菜单按钮 + 标题 */}
                <div className="flex items-center">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="lg:hidden mr-3"
                    onClick={handleMobileToggle}
                  >
                    <Menu className="h-5 w-5" />
                  </Button>
                  <h1 className="text-lg font-semibold text-gray-900">
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
            </div>
          </div>

          {/* 页面内容 */}
          <main className="p-6">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
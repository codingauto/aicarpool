'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Menu } from 'lucide-react';
import { EnterpriseSidebar } from './EnterpriseSidebar';

interface SimpleEnterpriseLayoutProps {
  children: React.ReactNode;
}

export function SimpleEnterpriseLayout({ children }: SimpleEnterpriseLayoutProps) {
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

  return (
    <div className="min-h-screen bg-gray-50">
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

          {/* 移动端菜单按钮 */}
          <Button
            variant="outline"
            size="sm"
            className="fixed top-4 left-4 z-20 lg:hidden bg-white shadow-md"
            onClick={handleMobileToggle}
          >
            <Menu className="h-4 w-4" />
          </Button>

          {/* 页面内容 */}
          <main className="min-h-screen p-4 md:p-6 lg:p-8">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
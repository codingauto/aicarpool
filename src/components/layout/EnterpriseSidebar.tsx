'use client';

import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useEnterpriseContext } from '@/contexts/enterprise-context';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  BarChart3,
  Users,
  Brain,
  TrendingUp,
  Shield,
  Building,
  Settings,
  ChevronLeft,
  ChevronRight,
  X,
  Home,
  Building2,
} from 'lucide-react';

interface EnterpriseSidebarProps {
  enterpriseId: string;
  isCollapsed: boolean;
  isMobileOpen: boolean;
  onToggleCollapse: () => void;
  onMobileToggle: () => void;
}

interface NavigationItem {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
}

export function EnterpriseSidebar({
  enterpriseId,
  isCollapsed,
  isMobileOpen,
  onToggleCollapse,
  onMobileToggle,
}: EnterpriseSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { currentEnterprise } = useEnterpriseContext();

  const handleBackToSelection = () => {
    router.push('/');
  };

  const navigationItems: NavigationItem[] = [
    {
      title: '仪表盘',
      href: `/enterprise/${enterpriseId}/dashboard`,
      icon: BarChart3,
    },
    {
      title: '拼车组管理',
      href: `/enterprise/${enterpriseId}/groups`,
      icon: Users,
    },
    {
      title: 'AI资源管理',
      href: `/enterprise/${enterpriseId}/ai-resources`,
      icon: Brain,
    },
    {
      title: '数据分析',
      href: `/enterprise/${enterpriseId}/analytics`,
      icon: TrendingUp,
    },
    {
      title: '权限管理',
      href: `/enterprise/${enterpriseId}/permissions`,
      icon: Shield,
    },
    {
      title: '组织架构',
      href: `/enterprise/${enterpriseId}/organization`,
      icon: Building,
    },
    {
      title: '企业设置',
      href: `/enterprise/${enterpriseId}/settings`,
      icon: Settings,
    },
  ];

  const isActiveLink = (href: string) => {
    return pathname === href;
  };

  const NavItem = ({ item }: { item: NavigationItem }) => {
    const Icon = item.icon;
    const isActive = isActiveLink(item.href);

    const itemContent = (
      <Link href={item.href}>
        <Button
          variant={isActive ? 'secondary' : 'ghost'}
          className={cn(
            'w-full justify-start h-10',
            isCollapsed ? 'px-2' : 'px-3',
            isActive && 'bg-blue-100 text-blue-700 hover:bg-blue-200'
          )}
        >
          <Icon className={cn('h-5 w-5', isCollapsed ? '' : 'mr-3')} />
          {!isCollapsed && (
            <>
              <span className="flex-1 text-left">{item.title}</span>
              {item.badge && (
                <span className="ml-auto bg-red-100 text-red-700 text-xs px-2 py-1 rounded-full">
                  {item.badge}
                </span>
              )}
            </>
          )}
        </Button>
      </Link>
    );

    if (isCollapsed) {
      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              {itemContent}
            </TooltipTrigger>
            <TooltipContent side="right" className="flex items-center gap-4">
              {item.title}
              {item.badge && (
                <span className="ml-auto bg-red-100 text-red-700 text-xs px-2 py-1 rounded-full">
                  {item.badge}
                </span>
              )}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    }

    return itemContent;
  };

  return (
    <>
      {/* 桌面端侧边栏 */}
      <div
        className={cn(
          'fixed left-0 top-0 z-40 h-full bg-white border-r border-gray-200 transition-all duration-300',
          'hidden lg:flex lg:flex-col',
          isCollapsed ? 'w-16' : 'w-64'
        )}
      >
        {/* 企业信息头部 */}
        <div className="p-4 border-b border-gray-200">
          {!isCollapsed ? (
            <>
              {/* 返回企业选择按钮 */}
              <Button
                variant="ghost"
                size="sm"
                onClick={handleBackToSelection}
                className="w-full justify-start mb-3 text-gray-600 hover:text-gray-900"
              >
                <Home className="h-4 w-4 mr-2" />
                切换企业
              </Button>
              
              {/* 当前企业信息 */}
              {currentEnterprise && (
                <div className="bg-blue-50 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Building2 className="h-5 w-5 text-blue-600" />
                    <h3 className="font-semibold text-gray-900 truncate">
                      {currentEnterprise.name}
                    </h3>
                  </div>
                  <div className="text-xs text-gray-600">
                    企业ID: {enterpriseId.slice(0, 8)}...
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center space-y-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleBackToSelection}
                title="切换企业"
                className="p-2"
              >
                <Home className="h-4 w-4" />
              </Button>
              {currentEnterprise && (
                <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Building2 className="h-4 w-4 text-blue-600" />
                </div>
              )}
            </div>
          )}
        </div>

        {/* 侧边栏内容 */}
        <div className="flex-1 overflow-y-auto py-4">
          <nav className={cn('space-y-1', isCollapsed ? 'px-2' : 'px-3')}>
            {navigationItems.map((item) => (
              <NavItem key={item.href} item={item} />
            ))}
          </nav>
        </div>

        {/* 折叠按钮 */}
        <div className={cn('p-3 border-t border-gray-200', isCollapsed && 'px-2')}>
          <Button
            variant="ghost"
            size="sm"
            className="w-full"
            onClick={onToggleCollapse}
          >
            {isCollapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <>
                <ChevronLeft className="h-4 w-4 mr-2" />
                收起菜单
              </>
            )}
          </Button>
        </div>
      </div>

      {/* 移动端侧边栏 */}
      <div
        className={cn(
          'fixed left-0 top-0 z-50 h-full w-64 bg-white border-r border-gray-200 transform transition-transform duration-300 lg:hidden',
          isMobileOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* 移动端头部 */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">企业导航</h2>
          <Button variant="ghost" size="sm" onClick={onMobileToggle}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* 企业信息和切换按钮 */}
        <div className="p-4 border-b border-gray-200">
          {/* 返回企业选择按钮 */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              handleBackToSelection();
              onMobileToggle(); // 关闭移动端菜单
            }}
            className="w-full justify-start mb-3 text-gray-600 hover:text-gray-900"
          >
            <Home className="h-4 w-4 mr-2" />
            切换企业
          </Button>
          
          {/* 当前企业信息 */}
          {currentEnterprise && (
            <div className="bg-blue-50 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-2">
                <Building2 className="h-5 w-5 text-blue-600" />
                <h3 className="font-semibold text-gray-900 truncate">
                  {currentEnterprise.name}
                </h3>
              </div>
              <div className="text-xs text-gray-600">
                企业ID: {enterpriseId.slice(0, 8)}...
              </div>
            </div>
          )}
        </div>

        {/* 侧边栏内容 */}
        <div className="flex-1 overflow-y-auto py-4">
          <nav className="space-y-1 px-3">
            {navigationItems.map((item) => (
              <NavItem key={item.href} item={item} />
            ))}
          </nav>
        </div>
      </div>
    </>
  );
}
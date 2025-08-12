'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useEnterpriseContext, EnterpriseRole } from '@/contexts/enterprise-context';
import { EnterpriseGate } from '@/components/auth/enterprise-gate';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  Building2,
  LayoutDashboard,
  Users,
  Database,
  Zap,
  BarChart3,
  DollarSign,
  Settings,
  Shield,
  Bell,
  Activity,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
  Crown,
  Eye,
  LogOut,
  Home,
  ChevronDown,
  Globe,
  BookOpen
} from 'lucide-react';

interface NavItem {
  id: string;
  label: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
  requiredRoles: EnterpriseRole[];
  requiredPermissions?: string[];
  badge?: string | number;
  children?: NavItem[];
}

interface EnterpriseNavigationProps {
  enterpriseId: string;
  collapsed?: boolean;
  onCollapseChange?: (collapsed: boolean) => void;
  className?: string;
}

export function EnterpriseNavigation({ 
  enterpriseId, 
  collapsed = false, 
  onCollapseChange,
  className = ''
}: EnterpriseNavigationProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { currentEnterprise, userRole, hasRole } = useEnterpriseContext();

  // 根据企业类型获取导航菜单配置
  const getNavigationItems = (): NavItem[] => {
    const organizationType = currentEnterprise?.organizationType || 'enterprise';
    
    // 拼车组模式的简化菜单
    if (organizationType === 'carpool_group') {
      return [
        {
          id: 'dashboard',
          label: '拼车组总览',
          path: `/enterprise/${enterpriseId}/dashboard`,
          icon: LayoutDashboard,
          requiredRoles: ['owner', 'admin', 'member', 'viewer']
        },
        {
          id: 'members',
          label: '成员管理',
          path: `/enterprise/${enterpriseId}/members`,
          icon: Users,
          requiredRoles: ['owner', 'admin'],
          badge: currentEnterprise?.memberCount
        },
        {
          id: 'ai-resources',
          label: 'AI工具',
          path: `/enterprise/${enterpriseId}/ai-resources`,
          icon: Zap,
          requiredRoles: ['owner', 'admin', 'member']
        },
        {
          id: 'analytics',
          label: '使用统计',
          path: `/enterprise/${enterpriseId}/analytics`,
          icon: BarChart3,
          requiredRoles: ['owner', 'admin', 'member', 'viewer']
        },
        {
          id: 'settings',
          label: '拼车组设置',
          path: `/enterprise/${enterpriseId}/settings`,
          icon: Settings,
          requiredRoles: ['owner'],
          requiredPermissions: ['enterprise.manage']
        }
      ];
    }
    
    // 企业模式的完整菜单
    return [
      {
        id: 'dashboard',
        label: '企业总览',
        path: `/enterprise/${enterpriseId}/dashboard`,
        icon: LayoutDashboard,
        requiredRoles: ['owner', 'admin', 'member', 'viewer']
      },
      {
        id: 'groups',
        label: '拼车组管理',
        path: `/enterprise/${enterpriseId}/groups`,
        icon: Users,
        requiredRoles: ['owner', 'admin'],
        requiredPermissions: ['groups.manage'],
        badge: currentEnterprise?.groupCount
      },
      {
        id: 'ai-resources',
        label: 'AI资源管理',
        path: `/enterprise/${enterpriseId}/ai-resources`,
        icon: Zap,
        requiredRoles: ['owner', 'admin'],
        requiredPermissions: ['resources.manage']
      },
      {
        id: 'organization',
        label: '组织架构',
        path: `/enterprise/${enterpriseId}/organization`,
        icon: Building2,
        requiredRoles: ['owner', 'admin'],
        requiredPermissions: ['members.manage']
      },
      {
        id: 'analytics',
        label: '数据分析',
        path: `/enterprise/${enterpriseId}/analytics`,
        icon: BarChart3,
        requiredRoles: ['owner', 'admin', 'member', 'viewer'],
        requiredPermissions: ['analytics.view']
      },
      {
        id: 'permissions',
        label: '权限管理',
        path: `/enterprise/${enterpriseId}/permissions`,
        icon: Shield,
        requiredRoles: ['owner', 'admin'],
        requiredPermissions: ['members.manage']
      },
      {
        id: 'monitoring',
        label: '监控中心',
        path: `/enterprise/${enterpriseId}/monitoring`,
        icon: Activity,
        requiredRoles: ['owner', 'admin'],
        requiredPermissions: ['analytics.view']
      },
      {
        id: 'alerts',
        label: '告警管理',
        path: `/enterprise/${enterpriseId}/alerts`,
        icon: Bell,
        requiredRoles: ['owner', 'admin']
      },
      {
        id: 'settings',
        label: '企业设置',
        path: `/enterprise/${enterpriseId}/settings`,
        icon: Settings,
        requiredRoles: ['owner'],
        requiredPermissions: ['enterprise.manage']
      }
    ];
  };

  const navigationItems = getNavigationItems();

  const getRoleIcon = (role: EnterpriseRole | null) => {
    switch (role) {
      case 'owner':
        return <Crown className="w-4 h-4 text-yellow-600" />;
      case 'admin':
        return <Shield className="w-4 h-4 text-blue-600" />;
      case 'member':
        return <Users className="w-4 h-4 text-green-600" />;
      case 'viewer':
        return <Eye className="w-4 h-4 text-gray-600" />;
      default:
        return <Users className="w-4 h-4 text-gray-600" />;
    }
  };

  const getRoleLabel = (role: EnterpriseRole | null) => {
    switch (role) {
      case 'owner':
        return '所有者';
      case 'admin':
        return '管理员';
      case 'member':
        return '成员';
      case 'viewer':
        return '查看者';
      default:
        return '成员';
    }
  };

  const isActiveItem = (item: NavItem) => {
    return pathname === item.path || pathname.startsWith(item.path + '/');
  };

  const handleItemClick = (item: NavItem) => {
    router.push(item.path);
  };

  const handleBackToSelection = () => {
    router.push('/');
  };

  const NavItemComponent = ({ item }: { item: NavItem }) => (
    <EnterpriseGate 
      requiredRoles={item.requiredRoles} 
      requiredPermissions={item.requiredPermissions}
      showError={false}
    >
      <button
        onClick={() => handleItemClick(item)}
        className={`
          w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors
          ${isActiveItem(item) 
            ? 'bg-blue-100 text-blue-900 border border-blue-200' 
            : 'text-gray-700 hover:bg-gray-100'
          }
          ${collapsed ? 'justify-center px-2' : ''}
        `}
        title={collapsed ? item.label : undefined}
      >
        <item.icon className="w-5 h-5 flex-shrink-0" />
        {!collapsed && (
          <>
            <span className="flex-1 font-medium">{item.label}</span>
            {item.badge && (
              <Badge variant="secondary" className="text-xs">
                {item.badge}
              </Badge>
            )}
          </>
        )}
      </button>
    </EnterpriseGate>
  );

  const NavigationContent = () => (
    <div className="flex flex-col h-full">
      {/* 企业信息头部 */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleBackToSelection}
            className="text-gray-600 hover:text-gray-900 p-1"
            title="切换企业"
          >
            <ChevronLeft className="w-4 h-4" />
            {!collapsed && <span className="ml-1">切换企业</span>}
          </Button>
          
          {!collapsed && onCollapseChange && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onCollapseChange(true)}
              className="p-1"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
          )}
        </div>

        {!collapsed && currentEnterprise && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              {currentEnterprise.organizationType === 'carpool_group' ? (
                <Users className="w-5 h-5 text-green-600" />
              ) : (
                <Building2 className="w-5 h-5 text-blue-600" />
              )}
              <h2 className="font-semibold text-gray-900 truncate">
                {currentEnterprise.name}
              </h2>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              {getRoleIcon(userRole)}
              <span>{getRoleLabel(userRole)}</span>
              <Separator orientation="vertical" className="h-4" />
              <span className="text-xs">
                {currentEnterprise.memberCount} {currentEnterprise.organizationType === 'carpool_group' ? '车友' : '成员'}
              </span>
            </div>
            {currentEnterprise.organizationType === 'carpool_group' && (
              <div className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded">
                轻量级拼车模式
              </div>
            )}
          </div>
        )}

        {collapsed && currentEnterprise && (
          <div className="flex justify-center">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
              currentEnterprise.organizationType === 'carpool_group' 
                ? 'bg-green-100' 
                : 'bg-blue-100'
            }`}>
              {currentEnterprise.organizationType === 'carpool_group' ? (
                <Users className="w-5 h-5 text-green-600" />
              ) : (
                <Building2 className="w-5 h-5 text-blue-600" />
              )}
            </div>
          </div>
        )}
      </div>

      {/* 导航菜单 */}
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {navigationItems.map((item) => (
          <NavItemComponent key={item.id} item={item} />
        ))}
      </nav>

      {/* 底部信息 */}
      {!collapsed && (
        <div className="p-4 border-t border-gray-200">
          <div className="text-xs text-gray-500 space-y-1">
            <div>AiCarpool v2.3</div>
            <div>
              {currentEnterprise?.organizationType === 'carpool_group' 
                ? '场景化AI拼车平台' 
                : '企业级AI资源管理平台'
              }
            </div>
          </div>
        </div>
      )}

      {/* 展开按钮 */}
      {collapsed && onCollapseChange && (
        <div className="p-2 border-t border-gray-200">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onCollapseChange(false)}
            className="w-full p-2"
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      )}
    </div>
  );

  return (
    <div className={`flex-col bg-white border-r border-gray-200 ${className}`}>
      <div className={`transition-all duration-200 ${collapsed ? 'w-16' : 'w-64'}`}>
        <NavigationContent />
      </div>
    </div>
  );
}

// 企业顶部导航组件
interface EnterpriseTopBarProps {
  enterpriseId: string;
  onMobileMenuToggle: () => void;
}

function EnterpriseTopBar({ enterpriseId, onMobileMenuToggle }: EnterpriseTopBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { currentEnterprise, userRole } = useEnterpriseContext();
  const [user, setUser] = useState<any>(null);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showGlobalMenu, setShowGlobalMenu] = useState(false);

  useEffect(() => {
    fetchUserInfo();
  }, []);

  const fetchUserInfo = async () => {
    try {
      const storedUser = localStorage.getItem('user');
      if (storedUser) {
        setUser(JSON.parse(storedUser));
      }
    } catch (error) {
      console.error('获取用户信息失败:', error);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    router.push('/');
  };

  const handleBackToSelection = () => {
    router.push('/');
  };

  // 生成面包屑导航
  const getBreadcrumbs = () => {
    const segments = pathname.split('/').filter(Boolean);
    const breadcrumbs = [
      { label: '企业选择', path: '/', icon: Home }
    ];

    if (currentEnterprise) {
      breadcrumbs.push({
        label: currentEnterprise.name,
        path: `/enterprise/${enterpriseId}/dashboard`,
        icon: Building2
      });
    }

    // 根据路径添加面包屑（只在非dashboard页面添加）
    if (segments.includes('groups')) {
      breadcrumbs.push({
        label: '拼车组管理',
        path: `/enterprise/${enterpriseId}/groups`,
        icon: Users
      });
    } else if (segments.includes('ai-resources')) {
      breadcrumbs.push({
        label: 'AI资源管理',
        path: `/enterprise/${enterpriseId}/ai-resources`,
        icon: Zap
      });
    }
    // 移除了dashboard的重复添加，因为企业名称已经指向dashboard

    return breadcrumbs;
  };

  const breadcrumbs = getBreadcrumbs();

  return (
    <header className="bg-white border-b border-gray-200 px-4 py-3 lg:px-6">
      <div className="flex items-center justify-between">
        {/* 左侧：移动端菜单按钮 + 面包屑 */}
        <div className="flex items-center gap-4">
          {/* 移动端菜单按钮 */}
          <Button
            variant="ghost"
            size="sm"
            onClick={onMobileMenuToggle}
            className="md:hidden"
          >
            <Menu className="w-5 h-5" />
          </Button>
          
          {/* 面包屑导航 */}
          <nav className="flex items-center space-x-2 text-sm">
            {breadcrumbs.map((crumb, index) => {
              const Icon = crumb.icon;
              const isLast = index === breadcrumbs.length - 1;
              
              return (
                <React.Fragment key={`breadcrumb-${index}`}>
                  {index > 0 && (
                    <span className="text-gray-400">/</span>
                  )}
                  <button
                    onClick={() => router.push(crumb.path)}
                    className={`flex items-center gap-1 hover:text-blue-600 transition-colors ${
                      isLast ? 'text-gray-900 font-medium' : 'text-gray-600'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{crumb.label}</span>
                  </button>
                </React.Fragment>
              );
            })}
          </nav>
        </div>

        {/* 右侧：全局功能 + 企业信息 + 用户菜单 */}
        <div className="flex items-center gap-4">
          {/* 全局功能入口 */}
          <div className="relative" data-dropdown>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowGlobalMenu(!showGlobalMenu)}
              className="flex items-center gap-2 px-3 py-1"
              title="全局功能"
            >
              <Globe className="w-4 h-4 text-gray-600" />
              <span className="hidden md:inline text-sm text-gray-700">全局功能</span>
              <ChevronDown className="w-3 h-3 text-gray-400" />
            </Button>

            {/* 全局功能下拉菜单 */}
            {showGlobalMenu && (
              <div className="absolute right-0 top-full mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
                <div className="p-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      router.push('/dashboard');
                      setShowGlobalMenu(false);
                    }}
                    className="w-full justify-start gap-2 text-left"
                  >
                    <LayoutDashboard className="w-4 h-4" />
                    仪表盘
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      router.push('/permissions');
                      setShowGlobalMenu(false);
                    }}
                    className="w-full justify-start gap-2 text-left"
                  >
                    <Shield className="w-4 h-4" />
                    权限管理
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      router.push('/monitoring');
                      setShowGlobalMenu(false);
                    }}
                    className="w-full justify-start gap-2 text-left"
                  >
                    <Activity className="w-4 h-4" />
                    监控中心
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      router.push('/tutorial');
                      setShowGlobalMenu(false);
                    }}
                    className="w-full justify-start gap-2 text-left"
                  >
                    <BookOpen className="w-4 h-4" />
                    使用教程
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* 企业信息（桌面端） */}
          {currentEnterprise && (
            <div className="hidden md:flex items-center gap-2 px-3 py-1 bg-blue-50 rounded-lg">
              <Building2 className="w-4 h-4 text-blue-600" />
              <span className="text-sm font-medium text-blue-900">
                {currentEnterprise.name}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleBackToSelection}
                className="p-1 h-auto text-blue-600 hover:text-blue-800"
                title="切换企业"
              >
                <ChevronDown className="w-3 h-3" />
              </Button>
            </div>
          )}

          {/* 用户菜单 */}
          {user && (
            <div className="relative" data-dropdown>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center gap-2 p-2"
              >
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                  <span className="text-sm font-medium text-blue-700">
                    {user.name?.charAt(0)?.toUpperCase() || 'U'}
                  </span>
                </div>
                <div className="hidden md:block text-left">
                  <div className="text-sm font-medium text-gray-900">
                    {user.name}
                  </div>
                  <div className="text-xs text-gray-500">
                    {userRole === 'owner' ? '所有者' : userRole === 'admin' ? '管理员' : '成员'}
                  </div>
                </div>
                <ChevronDown className="w-4 h-4 text-gray-400" />
              </Button>

              {/* 用户下拉菜单 */}
              {showUserMenu && (
                <div className="absolute right-0 top-full mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
                  <div className="p-3 border-b border-gray-100">
                    <div className="text-sm font-medium text-gray-900">{user.name}</div>
                    <div className="text-xs text-gray-500">{user.email}</div>
                  </div>
                  <div className="p-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        handleBackToSelection();
                        setShowUserMenu(false);
                      }}
                      className="w-full justify-start gap-2 text-left"
                    >
                      <Building2 className="w-4 h-4" />
                      切换企业
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        handleLogout();
                        setShowUserMenu(false);
                      }}
                      className="w-full justify-start gap-2 text-left text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <LogOut className="w-4 h-4" />
                      退出登录
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

// 企业布局组件
interface EnterpriseLayoutProps {
  children: React.ReactNode;
  enterpriseId: string;
}

export function EnterpriseLayout({ children, enterpriseId }: EnterpriseLayoutProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 顶部导航栏 */}
      <EnterpriseTopBar
        enterpriseId={enterpriseId}
        onMobileMenuToggle={() => setMobileMenuOpen(!mobileMenuOpen)}
      />
      
      {/* 主内容区域 */}
      <div className="flex">
        {/* 左侧导航 */}
        <EnterpriseNavigation
          enterpriseId={enterpriseId}
          collapsed={sidebarCollapsed}
          onCollapseChange={setSidebarCollapsed}
          className="hidden md:flex"
        />
        
        {/* 移动端导航覆盖层 */}
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-50 md:hidden">
            <div 
              className="fixed inset-0 bg-black bg-opacity-50" 
              onClick={() => setMobileMenuOpen(false)} 
            />
            <div className="fixed left-0 top-0 bottom-0 w-64 bg-white shadow-xl">
              <div className="flex items-center justify-between p-4 border-b border-gray-200">
                <h2 className="font-semibold text-gray-900">导航菜单</h2>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-1"
                >
                  <X className="w-5 h-5" />
                </Button>
              </div>
              <EnterpriseNavigation
                enterpriseId={enterpriseId}
                collapsed={false}
                onCollapseChange={() => {}}
              />
            </div>
          </div>
        )}
        
        {/* 主内容 */}
        <main className={`flex-1 transition-all duration-200 ${
          sidebarCollapsed ? 'md:ml-16' : 'md:ml-64'
        }`}>
          {children}
        </main>
      </div>
    </div>
  );
}
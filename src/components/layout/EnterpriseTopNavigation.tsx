'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { Building2, ChevronDown, Settings, LogOut, User, Home, Bell } from 'lucide-react';

interface EnterpriseTopNavigationProps {
  enterpriseId: string;
}

interface Enterprise {
  id: string;
  name: string;
  planType: string;
}

interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
}

export function EnterpriseTopNavigation({ enterpriseId }: EnterpriseTopNavigationProps) {
  const router = useRouter();
  const [enterprise, setEnterprise] = useState<Enterprise | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // 获取企业信息
        const enterpriseRes = await fetch(`/api/enterprises/${enterpriseId}`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
          }
        });
        if (enterpriseRes.ok) {
          const enterpriseData = await enterpriseRes.json();
          if (enterpriseData.success) {
            setEnterprise(enterpriseData.data);
          }
        }

        // 获取用户信息
        const userRes = await fetch('/api/user/profile', {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
          }
        });
        if (userRes.ok) {
          const userData = await userRes.json();
          if (userData.success) {
            setUser(userData.data);
          }
        }
      } catch (error) {
        console.error('Failed to fetch data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [enterpriseId]);

  const handleLogout = () => {
    localStorage.removeItem('auth_token');
    router.push('/auth/login');
  };

  const getPlanBadgeColor = (planType: string) => {
    switch (planType) {
      case 'enterprise':
        return 'bg-purple-100 text-purple-800';
      case 'custom':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getPlanName = (planType: string) => {
    switch (planType) {
      case 'enterprise':
        return '企业版';
      case 'custom':
        return '定制版';
      default:
        return '基础版';
    }
  };

  if (loading) {
    return (
      <div className="bg-white border-b border-gray-200">
        <div className="px-6 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-gray-200 rounded animate-pulse" />
              <div className="w-32 h-5 bg-gray-200 rounded animate-pulse" />
            </div>
            <div className="w-8 h-8 bg-gray-200 rounded-full animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border-b border-gray-200">
      <div className="px-6 py-3">
        <div className="flex items-center justify-between">
          {/* 企业信息 */}
          <div className="flex items-center space-x-3">
            <Building2 className="h-8 w-8 text-blue-600" />
            <div className="flex items-center space-x-2">
              <h1 className="text-xl font-bold text-gray-900">
                {enterprise?.name || '加载中...'}
              </h1>
              {enterprise && (
                <Badge className={getPlanBadgeColor(enterprise.planType)}>
                  {getPlanName(enterprise.planType)}
                </Badge>
              )}
            </div>
          </div>

          {/* 右侧操作区 */}
          <div className="flex items-center space-x-4">
            {/* 返回首页 */}
            <Button variant="ghost" size="sm" asChild>
              <Link href="/">
                <Home className="h-4 w-4 mr-2" />
                返回首页
              </Link>
            </Button>

            {/* 通知按钮 */}
            <Button variant="ghost" size="sm">
              <Bell className="h-4 w-4" />
            </Button>

            {/* 用户菜单 */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={user?.avatar} alt={user?.name} />
                    <AvatarFallback>
                      {user?.name?.charAt(0)?.toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <div className="flex items-center justify-start gap-2 p-2">
                  <div className="flex flex-col space-y-1 leading-none">
                    <p className="font-medium">{user?.name}</p>
                    <p className="w-[200px] truncate text-sm text-muted-foreground">
                      {user?.email}
                    </p>
                  </div>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem>
                  <User className="mr-2 h-4 w-4" />
                  <span>个人资料</span>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href={`/enterprise/${enterpriseId}/settings`}>
                    <Settings className="mr-2 h-4 w-4" />
                    <span>企业设置</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout}>
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>登出</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </div>
  );
}
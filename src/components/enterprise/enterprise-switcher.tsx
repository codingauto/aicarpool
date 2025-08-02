'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useEnterpriseContext } from '@/contexts/enterprise-context';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { 
  Building2,
  ChevronDown,
  Check,
  Plus,
  Search,
  ArrowRight,
  Crown,
  Shield,
  Users,
  Eye,
  Clock
} from 'lucide-react';

interface UserEnterprise {
  id: string;
  name: string;
  planType: string;
  role: string;
  memberCount: number;
  groupCount: number;
  lastAccessed: string;
  isActive: boolean;
}

interface EnterpriseSwitcherProps {
  className?: string;
  showCreateOption?: boolean;
}

export function EnterpriseSwitcher({ 
  className = '', 
  showCreateOption = true 
}: EnterpriseSwitcherProps) {
  const router = useRouter();
  const { currentEnterprise, switchEnterprise, loading } = useEnterpriseContext();
  const [open, setOpen] = useState(false);
  const [enterprises, setEnterprises] = useState<UserEnterprise[]>([]);
  const [searchValue, setSearchValue] = useState('');
  const [fetchingEnterprises, setFetchingEnterprises] = useState(false);

  // 获取用户的所有企业
  const fetchUserEnterprises = async () => {
    try {
      setFetchingEnterprises(true);
      const token = localStorage.getItem('token');
      if (!token) return;

      const response = await fetch('/api/user/enterprises', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data) {
          const formattedEnterprises = data.data.map((item: any) => ({
            id: item.enterprise.id,
            name: item.enterprise.name,
            planType: item.enterprise.planType,
            role: item.role,
            memberCount: item.enterprise._count?.members || 0,
            groupCount: item.enterprise._count?.groups || 0,
            lastAccessed: item.lastAccessed || item.joinedAt,
            isActive: item.isActive
          }));
          setEnterprises(formattedEnterprises);
        }
      }
    } catch (error) {
      console.error('获取企业列表失败:', error);
    } finally {
      setFetchingEnterprises(false);
    }
  };

  useEffect(() => {
    if (open) {
      fetchUserEnterprises();
    }
  }, [open]);

  const getRoleIcon = (role: string) => {
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

  const getRoleLabel = (role: string) => {
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

  const getPlanTypeBadge = (planType: string) => {
    switch (planType) {
      case 'enterprise':
        return <Badge className="bg-purple-100 text-purple-800">企业版</Badge>;
      case 'professional':
        return <Badge className="bg-blue-100 text-blue-800">专业版</Badge>;
      default:
        return <Badge className="bg-gray-100 text-gray-800">基础版</Badge>;
    }
  };

  const handleEnterpriseSelect = async (enterprise: UserEnterprise) => {
    setOpen(false);
    if (enterprise.id !== currentEnterprise?.id) {
      await switchEnterprise(enterprise.id);
    }
  };

  const handleCreateEnterprise = () => {
    setOpen(false);
    router.push('/enterprises/create');
  };

  const filteredEnterprises = enterprises.filter(enterprise =>
    enterprise.name.toLowerCase().includes(searchValue.toLowerCase())
  );

  // 按最近访问时间排序
  const sortedEnterprises = [...filteredEnterprises].sort((a, b) => 
    new Date(b.lastAccessed).getTime() - new Date(a.lastAccessed).getTime()
  );

  const recentEnterprises = sortedEnterprises.slice(0, 3);
  const otherEnterprises = sortedEnterprises.slice(3);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={`justify-between ${className}`}
          disabled={loading}
        >
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4" />
            <span className="truncate max-w-[200px]">
              {currentEnterprise?.name || '选择企业'}
            </span>
          </div>
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        <Command>
          <CommandInput
            placeholder="搜索企业..."
            value={searchValue}
            onValueChange={setSearchValue}
          />
          <CommandList>
            <CommandEmpty>
              {fetchingEnterprises ? '加载中...' : '没有找到企业'}
            </CommandEmpty>
            
            {/* 最近访问的企业 */}
            {recentEnterprises.length > 0 && (
              <CommandGroup heading="最近访问">
                {recentEnterprises.map((enterprise) => (
                  <CommandItem
                    key={enterprise.id}
                    value={enterprise.id}
                    onSelect={() => handleEnterpriseSelect(enterprise)}
                    className="flex items-center justify-between p-3"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        {currentEnterprise?.id === enterprise.id && (
                          <Check className="w-4 h-4 text-blue-600" />
                        )}
                        <Building2 className="w-4 h-4 text-gray-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium truncate">{enterprise.name}</span>
                          {getPlanTypeBadge(enterprise.planType)}
                        </div>
                        <div className="flex items-center gap-2 text-sm text-gray-500">
                          {getRoleIcon(enterprise.role)}
                          <span>{getRoleLabel(enterprise.role)}</span>
                          <Separator orientation="vertical" className="h-3" />
                          <span>{enterprise.memberCount} 成员</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-gray-400">
                      <Clock className="w-3 h-3" />
                      <span>{new Date(enterprise.lastAccessed).toLocaleDateString()}</span>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {/* 其他企业 */}
            {otherEnterprises.length > 0 && (
              <CommandGroup heading="其他企业">
                {otherEnterprises.map((enterprise) => (
                  <CommandItem
                    key={enterprise.id}
                    value={enterprise.id}
                    onSelect={() => handleEnterpriseSelect(enterprise)}
                    className="flex items-center justify-between p-3"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        {currentEnterprise?.id === enterprise.id && (
                          <Check className="w-4 h-4 text-blue-600" />
                        )}
                        <Building2 className="w-4 h-4 text-gray-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium truncate">{enterprise.name}</span>
                          {getPlanTypeBadge(enterprise.planType)}
                        </div>
                        <div className="flex items-center gap-2 text-sm text-gray-500">
                          {getRoleIcon(enterprise.role)}
                          <span>{getRoleLabel(enterprise.role)}</span>
                          <Separator orientation="vertical" className="h-3" />
                          <span>{enterprise.memberCount} 成员</span>
                        </div>
                      </div>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {/* 创建新企业选项 */}
            {showCreateOption && (
              <CommandGroup>
                <CommandItem onSelect={handleCreateEnterprise} className="p-3">
                  <div className="flex items-center gap-3">
                    <Plus className="w-4 h-4 text-gray-500" />
                    <span className="font-medium">创建新企业</span>
                  </div>
                  <ArrowRight className="w-4 h-4 text-gray-400 ml-auto" />
                </CommandItem>
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

// 简化版企业切换按钮（用于导航栏）
interface CompactEnterpriseSwitcherProps {
  className?: string;
}

export function CompactEnterpriseSwitcher({ className = '' }: CompactEnterpriseSwitcherProps) {
  const { currentEnterprise } = useEnterpriseContext();
  
  return (
    <EnterpriseSwitcher 
      className={`w-auto min-w-0 ${className}`}
      showCreateOption={false}
    />
  );
}

// 企业信息卡片
interface EnterpriseCardProps {
  enterprise: UserEnterprise;
  onSelect: (enterprise: UserEnterprise) => void;
  isSelected?: boolean;
  showLastAccessed?: boolean;
}

export function EnterpriseCard({ 
  enterprise, 
  onSelect, 
  isSelected = false,
  showLastAccessed = true 
}: EnterpriseCardProps) {
  const getRoleIcon = (role: string) => {
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

  const getRoleLabel = (role: string) => {
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

  const getPlanTypeBadge = (planType: string) => {
    switch (planType) {
      case 'enterprise':
        return <Badge className="bg-purple-100 text-purple-800">企业版</Badge>;
      case 'professional':
        return <Badge className="bg-blue-100 text-blue-800">专业版</Badge>;
      default:
        return <Badge className="bg-gray-100 text-gray-800">基础版</Badge>;
    }
  };

  return (
    <div 
      className={`
        p-4 border rounded-lg cursor-pointer transition-all hover:shadow-md
        ${isSelected ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}
      `}
      onClick={() => onSelect(enterprise)}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Building2 className="w-5 h-5 text-blue-600" />
          <h3 className="font-medium text-gray-900">{enterprise.name}</h3>
        </div>
        <div className="flex items-center gap-2">
          {getPlanTypeBadge(enterprise.planType)}
          {isSelected && <Check className="w-4 h-4 text-blue-600" />}
        </div>
      </div>
      
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm text-gray-600">
          {getRoleIcon(enterprise.role)}
          <span>您的角色: {getRoleLabel(enterprise.role)}</span>
        </div>
        
        <div className="flex items-center gap-4 text-sm text-gray-500">
          <span>{enterprise.memberCount} 成员</span>
          <span>{enterprise.groupCount} 拼车组</span>
        </div>
        
        {showLastAccessed && (
          <div className="flex items-center gap-1 text-xs text-gray-400">
            <Clock className="w-3 h-3" />
            <span>最后访问: {new Date(enterprise.lastAccessed).toLocaleDateString()}</span>
          </div>
        )}
      </div>
    </div>
  );
}
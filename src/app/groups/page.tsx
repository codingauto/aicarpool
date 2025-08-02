'use client';

/**
 * 拼车组管理页面
 * 
 * 功能：
 * - 显示用户参与的拼车组列表
 * - 拼车组资源配置入口
 * - 拼车组使用统计概览
 * - 创建和管理拼车组
 */

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { 
  Users,
  Settings,
  Plus,
  Search,
  Activity,
  DollarSign,
  Zap,
  AlertTriangle,
  CheckCircle,
  Clock,
  Database
} from 'lucide-react';

interface Group {
  id: string;
  name: string;
  description?: string;
  memberCount: number;
  role: 'admin' | 'member';
  resourceConfig?: {
    bindingMode: 'dedicated' | 'shared' | 'hybrid';
    isConfigured: boolean;
    isActive: boolean;
  };
  usageStats: {
    dailyTokens: number;
    dailyCost: number;
    requestCount: number;
    tokenLimit: number;
    costLimit: number;
  };
  createdAt: string;
  lastActiveAt: string;
}

export default function GroupsPage() {
  const router = useRouter();
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRole, setFilterRole] = useState<string>('all');

  useEffect(() => {
    // 检查用户是否已登录
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/auth/login');
      return;
    }
    fetchGroups();
  }, [router]);

  const fetchGroups = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        router.push('/auth/login');
        return;
      }

      const response = await fetch('/api/groups', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        router.push('/auth/login');
        return;
      }

      if (!response.ok) {
        throw new Error('获取拼车组列表失败');
      }

      const data = await response.json();
      
      if (data.success) {
        // 转换API数据格式为前端期望的格式
        const formattedGroups: Group[] = data.data.map((apiGroup: any) => {
          // 计算资源配置状态
          const hasAiServices = apiGroup.aiServices && apiGroup.aiServices.length > 0;
          const isActive = apiGroup.status === 'active';
          
          return {
            id: apiGroup.id,
            name: apiGroup.name,
            description: apiGroup.description || '',
            memberCount: apiGroup.stats?.memberCount || apiGroup.members?.length || 1,
            role: apiGroup.memberRole || 'member',
            resourceConfig: {
              bindingMode: 'shared', // 默认值，后续从resourceBinding获取
              isConfigured: hasAiServices,
              isActive: isActive && hasAiServices
            },
            usageStats: {
              // 临时使用随机数据，后续实现真实统计API
              dailyTokens: Math.floor(Math.random() * 10000),
              dailyCost: Math.random() * 50,
              requestCount: Math.floor(Math.random() * 200),
              tokenLimit: 50000,
              costLimit: 500
            },
            createdAt: apiGroup.createdAt || new Date().toISOString(),
            lastActiveAt: apiGroup.updatedAt || apiGroup.createdAt || new Date().toISOString()
          };
        });
        
        setGroups(formattedGroups);
      } else {
        throw new Error(data.error || '获取拼车组列表失败');
      }
    } catch (error) {
      console.error('获取拼车组列表失败:', error);
      // 如果没有拼车组数据，保持空数组状态
      setGroups([]);
    } finally {
      setLoading(false);
    }
  };

  // 筛选拼车组
  const filteredGroups = groups.filter(group => {
    const matchesSearch = group.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         group.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = filterRole === 'all' || group.role === filterRole;
    
    return matchesSearch && matchesRole;
  });

  const getBindingModeDisplayName = (mode: string) => {
    const displayNames: Record<string, string> = {
      'dedicated': '专属',
      'shared': '共享',
      'hybrid': '混合'
    };
    return displayNames[mode] || mode;
  };

  const getBindingModeBadgeVariant = (mode: string) => {
    const variants: Record<string, string> = {
      'dedicated': 'default',
      'shared': 'secondary', 
      'hybrid': 'outline'
    };
    return variants[mode] || 'outline';
  };

  const getConfigStatusIcon = (config?: Group['resourceConfig']) => {
    if (!config) {
      return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
    }
    
    if (config.isConfigured && config.isActive) {
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    } else if (config.isConfigured && !config.isActive) {
      return <AlertTriangle className="h-4 w-4 text-orange-500" />;
    } else {
      return <AlertTriangle className="h-4 w-4 text-red-500" />;
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-48 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* 页面标题和操作 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">拼车组管理</h1>
          <p className="text-gray-600 mt-1">管理您参与的拼车组和AI资源配置</p>
        </div>
        
        <Button onClick={() => router.push('/groups/create')}>
          <Plus className="h-4 w-4 mr-2" />
          创建拼车组
        </Button>
      </div>

      {/* 搜索和筛选 */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="搜索拼车组名称或描述..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            
            <Select value={filterRole} onValueChange={setFilterRole}>
              <SelectTrigger className="w-full md:w-32">
                <SelectValue placeholder="角色" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">所有角色</SelectItem>
                <SelectItem value="admin">管理员</SelectItem>
                <SelectItem value="member">成员</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* 拼车组列表 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {filteredGroups.map((group) => (
          <Card key={group.id} className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="flex items-center space-x-2">
                    <span>{group.name}</span>
                    {getConfigStatusIcon(group.resourceConfig)}
                  </CardTitle>
                  {group.description && (
                    <p className="text-sm text-gray-600 mt-1">{group.description}</p>
                  )}
                </div>
                <div className="flex flex-col items-end space-y-1">
                  <Badge variant={group.role === 'admin' ? 'default' : 'secondary'}>
                    {group.role === 'admin' ? '管理员' : '成员'}
                  </Badge>
                  {group.resourceConfig && (
                    <Badge variant={getBindingModeBadgeVariant(group.resourceConfig.bindingMode) as any}>
                      {getBindingModeDisplayName(group.resourceConfig.bindingMode)}
                    </Badge>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* 基本信息 */}
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center space-x-1">
                  <Users className="h-4 w-4 text-gray-500" />
                  <span>{group.memberCount} 成员</span>
                </div>
                <div className="flex items-center space-x-1">
                  <Clock className="h-4 w-4 text-gray-500" />
                  <span>最后活跃: {new Date(group.lastActiveAt).toLocaleDateString()}</span>
                </div>
              </div>

              {/* 使用统计 */}
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <div className="flex items-center justify-center space-x-1 mb-1">
                      <Activity className="h-3 w-3 text-blue-500" />
                      <span className="text-xs text-gray-600">Token使用</span>
                    </div>
                    <div className="text-sm font-medium">
                      {group.usageStats.dailyTokens.toLocaleString()}
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center justify-center space-x-1 mb-1">
                      <DollarSign className="h-3 w-3 text-green-500" />
                      <span className="text-xs text-gray-600">今日成本</span>
                    </div>
                    <div className="text-sm font-medium">
                      ${group.usageStats.dailyCost.toFixed(2)}
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center justify-center space-x-1 mb-1">
                      <Database className="h-3 w-3 text-purple-500" />
                      <span className="text-xs text-gray-600">请求数</span>
                    </div>
                    <div className="text-sm font-medium">
                      {group.usageStats.requestCount}
                    </div>
                  </div>
                </div>

                {/* Token使用进度 */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span>Token使用率</span>
                    <span>
                      {((group.usageStats.dailyTokens / group.usageStats.tokenLimit) * 100).toFixed(1)}%
                    </span>
                  </div>
                  <Progress 
                    value={(group.usageStats.dailyTokens / group.usageStats.tokenLimit) * 100} 
                    className="h-2" 
                  />
                </div>
              </div>

              {/* 操作按钮 */}
              <div className="flex space-x-2 pt-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="flex-1"
                  onClick={() => router.push(`/groups/${group.id}`)}
                >
                  <Users className="h-4 w-4 mr-2" />
                  进入拼车组
                </Button>
                
                {(group.role === 'admin' || group.resourceConfig?.isConfigured) && (
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => router.push(`/groups/${group.id}/resources`)}
                  >
                    <Settings className="h-4 w-4 mr-2" />
                    资源配置
                  </Button>
                )}
              </div>

              {/* 配置状态提示 */}
              {!group.resourceConfig?.isConfigured && group.role === 'admin' && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                  <div className="flex items-center space-x-2">
                    <AlertTriangle className="h-4 w-4 text-yellow-600" />
                    <span className="text-sm text-yellow-800">
                      尚未配置AI资源，
                      <Button 
                        variant="link" 
                        size="sm" 
                        className="p-0 h-auto text-yellow-800 underline"
                        onClick={() => router.push(`/groups/${group.id}/resources`)}
                      >
                        立即配置
                      </Button>
                    </span>
                  </div>
                </div>
              )}

              {group.resourceConfig?.isConfigured && !group.resourceConfig?.isActive && (
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                  <div className="flex items-center space-x-2">
                    <AlertTriangle className="h-4 w-4 text-orange-600" />
                    <span className="text-sm text-orange-800">
                      资源配置已停用，正在使用默认分配策略
                    </span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredGroups.length === 0 && (
        <div className="text-center py-12">
          <Users className="h-16 w-16 mx-auto text-gray-400 mb-4" />
          <h3 className="text-xl font-medium mb-2">没有找到拼车组</h3>
          <p className="text-gray-600 mb-6">
            {searchQuery ? '尝试调整搜索条件' : '您还没有加入任何拼车组'}
          </p>
          <Button onClick={() => router.push('/groups/create')}>
            <Plus className="h-4 w-4 mr-2" />
            创建第一个拼车组
          </Button>
        </div>
      )}
    </div>
  );
}
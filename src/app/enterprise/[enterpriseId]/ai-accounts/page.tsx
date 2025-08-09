'use client';

/**
 * 企业AI账号管理页面
 * 
 * 功能：
 * - 管理企业的AI服务账号
 * - 查看账号状态和使用情况
 * - 添加、编辑、删除AI账号
 * - 账号健康检查
 */

import React, { useState, useEffect, use } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Plus,
  Search,
  Filter,
  Settings,
  Trash2,
  Edit,
  Eye,
  CheckCircle,
  XCircle,
  AlertTriangle,
  RefreshCw,
  MoreHorizontal,
  ChevronLeft,
  Building2
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEnterpriseContext } from '@/contexts/enterprise-context';
import { toast } from 'sonner';

interface AiAccount {
  id: string;
  name: string;
  description: string;
  platform: string; // 改为platform
  authType: string;
  accountType: string;
  priority: number;
  isEnabled: boolean;
  status: string;
  validationStatus: string;
  currentLoad: number;
  dailyLimit: number;
  totalRequests: number;
  totalTokens: number;
  totalCost: number;
  lastUsedAt: string | null;
  recentUsage: {
    tokens: number;
    cost: number;
  };
  healthStatus: {
    isHealthy: boolean;
    responseTime: number;
    checkedAt: string;
  } | null;
  boundGroups: {
    id: string;
    name: string;
    priority: number;
    isActive: boolean;
  }[];
  // 平台特定配置
  geminiProjectId?: string;
  claudeConsoleApiUrl?: string;
  proxyEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

interface AiAccountsResponse {
  accounts: AiAccount[];
  totalCount: number;
  pagination: {
    page: number;
    pageSize: number;
    totalPages: number;
    hasMore: boolean;
  };
}

export default function EnterpriseAiAccountsPage({ params }: { params: Promise<{ enterpriseId: string }> }) {
  const { enterpriseId } = use(params);
  const router = useRouter();
  const { currentEnterprise, hasRole } = useEnterpriseContext();
  const [accounts, setAccounts] = useState<AiAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedService, setSelectedService] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  useEffect(() => {
    fetchAccounts();
  }, [enterpriseId, currentPage, selectedService, selectedStatus, searchTerm]);

  const fetchAccounts = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const params = new URLSearchParams({
        page: currentPage.toString(),
        pageSize: '20',
        ...(selectedService && { platform: selectedService }), // 改为platform
        ...(selectedStatus && { status: selectedStatus })
      });

      const response = await fetch(`/api/enterprises/${enterpriseId}/ai-accounts?${params}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          setAccounts(result.data.accounts);
          setTotalCount(result.data.totalCount);
          setError('');
        } else {
          setError(result.message || '获取AI账号列表失败');
        }
      } else {
        setError('获取AI账号列表失败');
      }
    } catch (error) {
      console.error('获取AI账号列表失败:', error);
      setError('获取AI账号列表失败');
    } finally {
      setLoading(false);
    }
  };

  const getPlatformDisplayName = (platform: string) => {
    const displayNames: Record<string, string> = {
      'claude': 'Claude',
      'gemini': 'Gemini',
      'claude_console': 'Claude Console',
      'openai': 'OpenAI',
      'qwen': '通义千问',
      'zhipu': '智谱AI',
      'kimi': 'Kimi'
    };
    return displayNames[platform] || platform;
  };

  const getAuthTypeDisplayName = (authType: string) => {
    const displayNames: Record<string, string> = {
      'oauth': 'OAuth',
      'manual': '手动Token',
      'api_key': 'API密钥'
    };
    return displayNames[authType] || authType;
  };

  const getStatusBadge = (status: string, isEnabled: boolean) => {
    if (!isEnabled) {
      return <Badge variant="secondary">已禁用</Badge>;
    }
    
    switch (status) {
      case 'active':
        return <Badge className="bg-green-100 text-green-800">活跃</Badge>;
      case 'inactive':
        return <Badge variant="secondary">闲置</Badge>;
      case 'error':
        return <Badge variant="destructive">错误</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getHealthIcon = (healthStatus: AiAccount['healthStatus']) => {
    if (!healthStatus) {
      return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
    }
    
    return healthStatus.isHealthy 
      ? <CheckCircle className="w-4 h-4 text-green-500" />
      : <XCircle className="w-4 h-4 text-red-500" />;
  };

  const handleCreateAccount = () => {
    router.push(`/enterprise/${enterpriseId}/ai-accounts/create`);
  };

  const handleEditAccount = (accountId: string) => {
    // TODO: 实现编辑功能
    toast.info('编辑功能正在开发中，敬请期待！', {
      description: '我们正在努力完善此功能'
    });
    console.log('编辑账号:', accountId);
  };

  const handleViewAccount = (accountId: string) => {
    // TODO: 实现查看功能
    toast.info('查看详情功能正在开发中，敬请期待！', {
      description: '我们正在努力完善此功能'
    });
    console.log('查看账号:', accountId);
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-48 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-6xl mx-auto">
        {/* 面包屑和标题 */}
        <div className="flex items-center gap-4 mb-6">
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => router.push(`/enterprise/${enterpriseId}/dashboard`)}
          >
            <ChevronLeft className="w-4 h-4 mr-2" />
            返回企业控制面板
          </Button>
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Building2 className="w-4 h-4" />
            <span>{currentEnterprise?.name || '未知企业'}</span>
            <span>/</span>
            <span>AI账号管理</span>
          </div>
        </div>

        <div className="space-y-6">
        {/* 页面标题和操作 */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">AI账号管理111</h1>
            <p className="text-gray-600 mt-1">管理企业的AI服务账号和配置</p>
          </div>
          
          {(hasRole('owner') || hasRole('admin')) && (
            <Button onClick={handleCreateAccount}>
              <Plus className="h-4 w-4 mr-2" />
              添加账号
            </Button>
          )}
        </div>

        {/* 搜索和筛选 */}
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="搜索账号名称..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          
          <div className="flex gap-2">
            <select
              value={selectedService}
              onChange={(e) => setSelectedService(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md"
            >
              <option value="">所有服务</option>
              <option value="claude">Claude</option>
              <option value="openai">OpenAI</option>
              <option value="gemini">Gemini</option>
              <option value="qwen">通义千问</option>
              <option value="zhipu">智谱AI</option>
              <option value="kimi">Kimi</option>
            </select>
            
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md"
            >
              <option value="">所有状态</option>
              <option value="active">活跃</option>
              <option value="inactive">闲置</option>
              <option value="error">错误</option>
            </select>
          </div>
        </div>

        {/* 账号列表 - 表格格式 */}
        {error ? (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <AlertTriangle className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">加载失败</h3>
                <p className="text-gray-600 mb-4">{error}</p>
                <Button onClick={fetchAccounts}>重试</Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>AI账号列表 ({totalCount})</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="text-left py-3 px-4 font-medium text-gray-900">名称</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-900">平台/类型</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-900">状态</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-900">优先级</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-900">代理</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-900">今日使用</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-900">合适端口</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-900">最后使用</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-900">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {accounts.map((account) => (
                      <tr key={account.id} className="border-b hover:bg-gray-50">
                        {/* 名称列 */}
                        <td className="py-3 px-4">
                          <div className="flex items-center space-x-2">
                            <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center text-white text-xs font-medium">
                              {account.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div className="font-medium text-gray-900">{account.name}</div>
                              <div className="text-xs text-gray-500">{account.id.substring(0, 8)}...</div>
                            </div>
                          </div>
                        </td>
                        
                        {/* 平台/类型列 */}
                        <td className="py-3 px-4">
                          <div className="flex items-center space-x-1">
                            <Badge variant="outline" className="text-xs">
                              {getPlatformDisplayName(account.platform)}
                            </Badge>
                            <Badge variant="secondary" className="text-xs">
                              {getAuthTypeDisplayName(account.authType)}
                            </Badge>
                          </div>
                        </td>
                        
                        {/* 状态列 */}
                        <td className="py-3 px-4">
                          {getStatusBadge(account.status, account.isEnabled)}
                        </td>
                        
                        {/* 优先级列 */}
                        <td className="py-3 px-4">
                          <span className="text-sm text-gray-900">
                            {account.priority ? account.priority : 'N/A'}
                          </span>
                        </td>
                        
                        {/* 代理列 */}
                        <td className="py-3 px-4">
                          <span className="text-sm text-gray-600">
                            {account.proxyEnabled ? '已启用' : '无代理'}
                          </span>
                        </td>
                        
                        {/* 今日使用列 */}
                        <td className="py-3 px-4">
                          <div className="text-sm">
                            <div className="text-gray-900">
                              {account.recentUsage.tokens}次
                            </div>
                            <div className="text-gray-500">
                              {account.recentUsage.tokens.toLocaleString()} tokens
                            </div>
                          </div>
                        </td>
                        
                        {/* 合适端口列 */}
                        <td className="py-3 px-4">
                          <span className="text-sm text-gray-600">N/A</span>
                        </td>
                        
                        {/* 最后使用列 */}
                        <td className="py-3 px-4">
                          <span className="text-sm text-gray-600">
                            {account.lastUsedAt 
                              ? new Date(account.lastUsedAt).toLocaleDateString('zh-CN')
                              : '从未使用'
                            }
                          </span>
                        </td>
                        
                        {/* 操作列 */}
                        <td className="py-3 px-4">
                          <div className="flex items-center space-x-1">
                            {/* 启用/禁用按钮 */}
                            <Button
                              variant={account.isEnabled ? "default" : "secondary"}
                              size="sm"
                              className="h-8 px-3 text-xs"
                            >
                              {account.isEnabled ? '启用' : '禁用'}
                            </Button>
                            
                            {/* 编辑按钮 */}
                            {(hasRole('owner') || hasRole('admin')) && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleEditAccount(account.id)}
                                className="h-8 px-3 text-xs"
                              >
                                编辑
                              </Button>
                            )}
                            
                            {/* 删除按钮 */}
                            {(hasRole('owner') || hasRole('admin')) && (
                              <Button
                                variant="destructive"
                                size="sm"
                                className="h-8 px-3 text-xs"
                              >
                                删除
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                    
                    {accounts.length === 0 && (
                      <tr>
                        <td colSpan={9} className="text-center py-12">
                          <p className="text-gray-500 mb-4">暂无AI账号</p>
                          {(hasRole('owner') || hasRole('admin')) && (
                            <Button onClick={handleCreateAccount}>
                              <Plus className="h-4 w-4 mr-2" />
                              添加第一个账号
                            </Button>
                          )}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
        </div>
      </div>
    </div>
  );
}
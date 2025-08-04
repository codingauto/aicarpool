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
  serviceType: string;
  accountType: string;
  isEnabled: boolean;
  status: string;
  currentLoad: number;
  supportedModels: string[];
  currentModel: string;
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
        ...(selectedService && { serviceType: selectedService }),
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

  const getServiceTypeDisplayName = (serviceType: string) => {
    const displayNames: Record<string, string> = {
      'claude': 'Claude',
      'gemini': 'Gemini',
      'openai': 'OpenAI',
      'qwen': '通义千问',
      'zhipu': '智谱AI',
      'kimi': 'Kimi'
    };
    return displayNames[serviceType] || serviceType;
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
            <h1 className="text-3xl font-bold">AI账号管理</h1>
            <p className="text-gray-600 mt-1">管理企业的AI服务账号和配置</p>
          </div>
          
          {hasRole(['owner', 'admin']) && (
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

        {/* 账号列表 */}
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
            <CardContent>
              <div className="space-y-4">
                {accounts.map((account) => (
                  <div key={account.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50">
                    <div className="flex items-center space-x-4">
                      <div className="flex items-center space-x-2">
                        {getHealthIcon(account.healthStatus)}
                        <div>
                          <h4 className="font-medium text-gray-900">{account.name}</h4>
                          <p className="text-sm text-gray-600">{account.description}</p>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <Badge variant="outline">
                          {getServiceTypeDisplayName(account.serviceType)}
                        </Badge>
                        {getStatusBadge(account.status, account.isEnabled)}
                        <Badge variant="secondary">
                          {account.accountType === 'dedicated' ? '专用' : '共享'}
                        </Badge>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <div className="text-right text-sm">
                        <div className="font-medium">
                          {account.recentUsage.tokens.toLocaleString()} tokens
                        </div>
                        <div className="text-gray-500">
                          ${account.recentUsage.cost.toFixed(2)} (24h)
                        </div>
                      </div>
                      
                      <div className="flex space-x-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleViewAccount(account.id)}
                          title="查看账号详情"
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        {hasRole(['owner', 'admin']) && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditAccount(account.id)}
                            title="编辑账号"
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                
                {accounts.length === 0 && (
                  <div className="text-center py-12">
                    <p className="text-gray-500">暂无AI账号</p>
                    {hasRole(['owner', 'admin']) && (
                      <Button onClick={handleCreateAccount} className="mt-4">
                        <Plus className="h-4 w-4 mr-2" />
                        添加第一个账号
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}
        </div>
      </div>
    </div>
  );
}
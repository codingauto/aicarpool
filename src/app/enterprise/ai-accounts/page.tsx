'use client';

/**
 * 企业AI账号管理页面
 * 
 * 功能：
 * - AI账号列表展示
 * - 搜索和筛选
 * - 批量操作
 * - 账号状态管理
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { 
  Plus,
  Search,
  Filter,
  MoreHorizontal,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Activity,
  DollarSign,
  Clock,
  Settings,
  Trash2,
  Power,
  PowerOff
} from 'lucide-react';
import { useRouter } from 'next/navigation';

interface AiAccount {
  id: string;
  name: string;
  description?: string;
  platform: string;
  accountType: string;
  isEnabled: boolean;
  status: string;
  currentLoad: number;
  dailyLimit: number;
  totalRequests: number;
  totalTokens: number;
  totalCost: number;
  lastUsedAt?: string;
  recentUsage: {
    tokens: number;
    cost: number;
  };
  healthStatus?: {
    isHealthy: boolean;
    responseTime?: number;
    checkedAt: string;
  };
  boundGroups: {
    id: string;
    name: string;
  }[];
  createdAt: string;
}

export default function AiAccountsPage() {
  const router = useRouter();
  const [accounts, setAccounts] = useState<AiAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [serviceTypeFilter, setServiceTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [accountToDelete, setAccountToDelete] = useState<string | null>(null);

  useEffect(() => {
    fetchAccounts();
  }, [serviceTypeFilter, statusFilter]);

  const fetchAccounts = async () => {
    try {
      setLoading(true);
      
      // 模拟数据，实际应该调用API
      const mockAccounts: AiAccount[] = [
        {
          id: '1',
          name: 'Claude-Pro-01',
          description: '主要用于代码生成和分析',
          serviceType: 'claude',
          accountType: 'dedicated',
          isEnabled: true,
          status: 'active',
          currentLoad: 45,
          dailyLimit: 10000,
          totalRequests: 12340,
          totalTokens: 1450000,
          totalCost: 234.56,
          lastUsedAt: '2024-01-15T14:30:00Z',
          recentUsage: { tokens: 15600, cost: 12.45 },
          healthStatus: { isHealthy: true, responseTime: 1200, checkedAt: '2024-01-15T14:25:00Z' },
          boundGroups: [{ id: '1', name: '前端开发组' }, { id: '2', name: '后端开发组' }],
          createdAt: '2024-01-10T10:00:00Z'
        },
        {
          id: '2',
          name: 'Gemini-Shared-01',
          description: '共享池账号',
          serviceType: 'gemini',
          accountType: 'shared',
          isEnabled: true,
          status: 'active',
          currentLoad: 67,
          dailyLimit: 8000,
          totalRequests: 8760,
          totalTokens: 980000,
          totalCost: 156.78,
          lastUsedAt: '2024-01-15T14:28:00Z',
          recentUsage: { tokens: 12300, cost: 8.76 },
          healthStatus: { isHealthy: true, responseTime: 890, checkedAt: '2024-01-15T14:20:00Z' },
          boundGroups: [{ id: '3', name: '产品设计组' }],
          createdAt: '2024-01-12T15:30:00Z'
        },
        {
          id: '3',
          name: 'OpenAI-GPT4-01',
          description: '高端模型账号',
          serviceType: 'openai',
          accountType: 'dedicated',
          isEnabled: false,
          status: 'error',
          currentLoad: 0,
          dailyLimit: 5000,
          totalRequests: 5432,
          totalTokens: 654000,
          totalCost: 98.45,
          lastUsedAt: '2024-01-14T16:45:00Z',
          recentUsage: { tokens: 0, cost: 0 },
          healthStatus: { isHealthy: false, responseTime: 0, checkedAt: '2024-01-15T14:15:00Z' },
          boundGroups: [],
          createdAt: '2024-01-08T09:15:00Z'
        }
      ];
      
      setAccounts(mockAccounts);
    } catch (error) {
      console.error('获取AI账号列表失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 筛选账号
  const filteredAccounts = accounts.filter(account => {
    const matchesSearch = account.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         account.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesServiceType = serviceTypeFilter === 'all' || account.platform === serviceTypeFilter;
    const matchesStatus = statusFilter === 'all' || account.status === statusFilter;
    
    return matchesSearch && matchesServiceType && matchesStatus;
  });

  // 处理全选
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedAccounts(filteredAccounts.map(account => account.id));
    } else {
      setSelectedAccounts([]);
    }
  };

  // 处理单选
  const handleSelectAccount = (accountId: string, checked: boolean) => {
    if (checked) {
      setSelectedAccounts([...selectedAccounts, accountId]);
    } else {
      setSelectedAccounts(selectedAccounts.filter(id => id !== accountId));
    }
  };

  // 批量操作
  const handleBatchOperation = async (action: string) => {
    if (selectedAccounts.length === 0) return;

    try {
      console.log(`执行批量操作: ${action}`, selectedAccounts);
      // 这里应该调用API执行批量操作
      
      // 更新本地状态
      setAccounts(accounts.map(account => {
        if (selectedAccounts.includes(account.id)) {
          switch (action) {
            case 'enable':
              return { ...account, isEnabled: true, status: 'active' };
            case 'disable':
              return { ...account, isEnabled: false, status: 'inactive' };
            default:
              return account;
          }
        }
        return account;
      }));
      
      setSelectedAccounts([]);
    } catch (error) {
      console.error(`批量操作失败:`, error);
    }
  };

  // 删除账号
  const handleDeleteAccount = async (accountId: string) => {
    try {
      console.log('删除账号:', accountId);
      // 这里应该调用API删除账号
      
      setAccounts(accounts.filter(account => account.id !== accountId));
      setDeleteDialogOpen(false);
      setAccountToDelete(null);
    } catch (error) {
      console.error('删除账号失败:', error);
    }
  };

  const getServiceTypeDisplayName = (platform: string) => {
    const displayNames: Record<string, string> = {
      'claude': 'Claude',
      'gemini': 'Gemini',
      'openai': 'OpenAI',
      'qwen': '通义千问'
    };
    return displayNames[serviceType] || serviceType;
  };

  const getStatusBadge = (account: AiAccount) => {
    if (!account.isEnabled) {
      return <Badge variant="secondary">已禁用</Badge>;
    }
    
    switch (account.status) {
      case 'active':
        return <Badge variant="default" className="bg-green-500">正常</Badge>;
      case 'error':
        return <Badge variant="destructive">错误</Badge>;
      case 'inactive':
        return <Badge variant="secondary">非活跃</Badge>;
      default:
        return <Badge variant="outline">{account.status}</Badge>;
    }
  };

  const getHealthIcon = (account: AiAccount) => {
    if (!account.healthStatus) {
      return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
    }
    
    return account.healthStatus.isHealthy ? 
      <CheckCircle className="h-4 w-4 text-green-500" /> :
      <XCircle className="h-4 w-4 text-red-500" />;
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="h-32 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* 页面标题和操作 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">AI账号管理</h1>
          <p className="text-gray-600 mt-1">管理企业AI账号和配置</p>
        </div>
        
        <Button onClick={() => router.push('/enterprise/ai-accounts/create')}>
          <Plus className="h-4 w-4 mr-2" />
          添加账号
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
                  placeholder="搜索账号名称或描述..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            
            <Select value={serviceTypeFilter} onValueChange={setServiceTypeFilter}>
              <SelectTrigger className="w-full md:w-48">
                <SelectValue placeholder="选择服务类型" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">所有服务</SelectItem>
                <SelectItem value="claude">Claude</SelectItem>
                <SelectItem value="gemini">Gemini</SelectItem>
                <SelectItem value="openai">OpenAI</SelectItem>
                <SelectItem value="qwen">通义千问</SelectItem>
              </SelectContent>
            </Select>
            
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-32">
                <SelectValue placeholder="状态" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">所有状态</SelectItem>
                <SelectItem value="active">正常</SelectItem>
                <SelectItem value="error">错误</SelectItem>
                <SelectItem value="inactive">非活跃</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* 批量操作 */}
      {selectedAccounts.length > 0 && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">
                已选择 {selectedAccounts.length} 个账号
              </span>
              
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => handleBatchOperation('enable')}>
                  <Power className="h-4 w-4 mr-2" />
                  启用
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleBatchOperation('disable')}>
                  <PowerOff className="h-4 w-4 mr-2" />
                  禁用
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 账号列表 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>AI账号列表</CardTitle>
            <div className="flex items-center space-x-2">
              <Checkbox
                checked={selectedAccounts.length === filteredAccounts.length && filteredAccounts.length > 0}
                onCheckedChange={handleSelectAll}
              />
              <span className="text-sm text-gray-600">全选</span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {filteredAccounts.map((account) => (
              <div key={account.id} className="border rounded-lg p-4 space-y-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-3">
                    <Checkbox
                      checked={selectedAccounts.includes(account.id)}
                      onCheckedChange={(checked) => handleSelectAccount(account.id, !!checked)}
                    />
                    
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <h3 className="font-medium">{account.name}</h3>
                        {getHealthIcon(account)}
                        {getStatusBadge(account)}
                        <Badge variant="outline">
                          {getServiceTypeDisplayName(account.platform)}
                        </Badge>
                        <Badge variant={account.accountType === 'dedicated' ? 'default' : 'secondary'}>
                          {account.accountType === 'dedicated' ? '专属' : '共享'}
                        </Badge>
                      </div>
                      
                      {account.description && (
                        <p className="text-sm text-gray-600">{account.description}</p>
                      )}
                      
                      <div className="flex items-center space-x-4 text-sm text-gray-500">
                        <div className="flex items-center space-x-1">
                          <Activity className="h-3 w-3" />
                          <span>负载 {account.currentLoad}%</span>
                        </div>
                        
                        <div className="flex items-center space-x-1">
                          <DollarSign className="h-3 w-3" />
                          <span>总成本 ${account.totalCost.toFixed(2)}</span>
                        </div>
                        
                        {account.lastUsedAt && (
                          <div className="flex items-center space-x-1">
                            <Clock className="h-3 w-3" />
                            <span>最后使用 {new Date(account.lastUsedAt).toLocaleDateString()}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => router.push(`/enterprise/ai-accounts/${account.id}`)}>
                        <Settings className="h-4 w-4 mr-2" />
                        查看详情
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={() => handleBatchOperation(account.isEnabled ? 'disable' : 'enable')}
                      >
                        {account.isEnabled ? (
                          <>
                            <PowerOff className="h-4 w-4 mr-2" />
                            禁用账号
                          </>
                        ) : (
                          <>
                            <Power className="h-4 w-4 mr-2" />
                            启用账号
                          </>
                        )}
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        className="text-red-600"
                        onClick={() => {
                          setAccountToDelete(account.id);
                          setDeleteDialogOpen(true);
                        }}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        删除账号
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                
                {/* 绑定的拼车组 */}
                {account.boundGroups.length > 0 && (
                  <div className="pt-2 border-t">
                    <div className="text-sm text-gray-600 mb-2">绑定的拼车组:</div>
                    <div className="flex flex-wrap gap-2">
                      {account.boundGroups.map((group) => (
                        <Badge key={group.id} variant="outline" className="text-xs">
                          {group.name}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
            
            {filteredAccounts.length === 0 && (
              <div className="text-center py-12 text-gray-500">
                <p>没有找到匹配的AI账号</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 删除确认对话框 */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              此操作将永久删除该AI账号。如果账号正在被拼车组使用，删除操作将失败。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction 
              className="bg-red-600 hover:bg-red-700"
              onClick={() => accountToDelete && handleDeleteAccount(accountToDelete)}
            >
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
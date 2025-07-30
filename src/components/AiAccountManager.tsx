'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, RefreshCw, ToggleLeft, ToggleRight, Trash2, Edit, Key } from 'lucide-react';

interface AiAccount {
  id: string;
  name: string;
  description?: string;
  serviceType: 'claude' | 'gemini' | 'ampcode';
  accountType: 'shared' | 'dedicated';
  authType: 'oauth' | 'api_key';
  status: string;
  isEnabled: boolean;
  lastUsedAt?: string;
  createdAt: string;
  hasAccessToken: boolean;
  hasRefreshToken: boolean;
  oauthExpiresAt?: string;
  boundServicesCount: number;
  errorMessage?: string;
}

interface AiAccountManagerProps {
  groupId: string;
  serviceType?: 'claude' | 'gemini' | 'ampcode';
  onAccountSelect?: (accountId: string) => void;
  onShowAccountForm?: (account?: AiAccount) => void; // 新增：通知父组件显示账户表单
  onAccountsRefresh?: (refreshFn: () => void) => void; // 新增：向父组件提供刷新函数
}

export default function AiAccountManager({ groupId, serviceType, onAccountSelect, onShowAccountForm, onAccountsRefresh }: AiAccountManagerProps) {
  const [accounts, setAccounts] = useState<AiAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // 获取账户列表
  const fetchAccounts = async () => {
    try {
      const params = new URLSearchParams();
      if (serviceType) {
        params.append('serviceType', serviceType);
      }
      
      const response = await fetch(`/api/groups/${groupId}/ai-accounts?${params}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });
      
      const data = await response.json();
      if (data.success) {
        setAccounts(data.data);
      }
    } catch (error) {
      console.error('获取账户列表失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 切换账户状态
  const toggleAccountStatus = async (accountId: string) => {
    setActionLoading(accountId);
    try {
      const response = await fetch(`/api/groups/${groupId}/ai-accounts/${accountId}/toggle-status`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });
      
      const data = await response.json();
      if (data.success) {
        await fetchAccounts();
      }
    } catch (error) {
      console.error('切换账户状态失败:', error);
    } finally {
      setActionLoading(null);
    }
  };

  // 刷新Token
  const refreshToken = async (accountId: string) => {
    setActionLoading(accountId);
    try {
      const response = await fetch(`/api/groups/${groupId}/ai-accounts/${accountId}/refresh-token`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });
      
      const data = await response.json();
      if (data.success) {
        await fetchAccounts();
      }
    } catch (error) {
      console.error('刷新Token失败:', error);
    } finally {
      setActionLoading(null);
    }
  };

  // 删除账户
  const deleteAccount = async (accountId: string) => {
    if (!confirm('确定要删除此账户吗？')) return;
    
    setActionLoading(accountId);
    try {
      const response = await fetch(`/api/groups/${groupId}/ai-accounts/${accountId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });
      
      const data = await response.json();
      if (data.success) {
        await fetchAccounts();
      }
    } catch (error) {
      console.error('删除账户失败:', error);
    } finally {
      setActionLoading(null);
    }
  };

  useEffect(() => {
    fetchAccounts();
  }, [groupId, serviceType]);
  
  useEffect(() => {
    // 向父组件提供刷新函数
    onAccountsRefresh?.(fetchAccounts);
  }, [onAccountsRefresh]);

  const getServiceTypeBadge = (type: string) => {
    const colors = {
      claude: 'bg-orange-100 text-orange-800',
      gemini: 'bg-blue-100 text-blue-800',
      ampcode: 'bg-purple-100 text-purple-800',
    };
    return colors[type] || 'bg-gray-100 text-gray-800';
  };

  const getStatusBadge = (account: AiAccount) => {
    if (!account.isEnabled) {
      return <Badge variant="secondary">已禁用</Badge>;
    }
    if (account.status === 'error') {
      return <Badge variant="destructive">错误</Badge>;
    }
    return <Badge variant="default">正常</Badge>;
  };

  if (loading) {
    return <div className="p-4">加载中...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">
          AI账户管理 {serviceType && `(${serviceType.toUpperCase()})`}
        </h3>
        <Button 
          onClick={() => onShowAccountForm?.()}
          size="sm"
        >
          <Plus className="w-4 h-4 mr-2" />
          添加账户
        </Button>
      </div>

      {accounts.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center text-gray-500">
            暂无AI账户，点击"添加账户"开始配置
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {accounts.map((account) => (
            <Card key={account.id} className="relative">
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      {account.name}
                      <Badge className={getServiceTypeBadge(account.serviceType)}>
                        {account.serviceType.toUpperCase()}
                      </Badge>
                      {getStatusBadge(account)}
                    </CardTitle>
                    {account.description && (
                      <p className="text-sm text-gray-600 mt-1">{account.description}</p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {account.authType === 'oauth' && account.hasRefreshToken && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => refreshToken(account.id)}
                        disabled={actionLoading === account.id}
                      >
                        <RefreshCw className="w-4 h-4" />
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => toggleAccountStatus(account.id)}
                      disabled={actionLoading === account.id}
                    >
                      {account.isEnabled ? (
                        <ToggleRight className="w-4 h-4 text-green-600" />
                      ) : (
                        <ToggleLeft className="w-4 h-4 text-gray-400" />
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onShowAccountForm?.(account)}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => deleteAccount(account.id)}
                      disabled={account.boundServicesCount > 0 || actionLoading === account.id}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500">账户类型:</span>
                    <div className="font-medium">
                      {account.accountType === 'shared' ? '共享' : '专用'}
                    </div>
                  </div>
                  <div>
                    <span className="text-gray-500">认证方式:</span>
                    <div className="font-medium flex items-center gap-1">
                      <Key className="w-3 h-3" />
                      {account.authType === 'oauth' ? 'OAuth' : 'API Key'}
                    </div>
                  </div>
                  <div>
                    <span className="text-gray-500">绑定服务:</span>
                    <div className="font-medium">{account.boundServicesCount} 个</div>
                  </div>
                  <div>
                    <span className="text-gray-500">最后使用:</span>
                    <div className="font-medium">
                      {account.lastUsedAt 
                        ? new Date(account.lastUsedAt).toLocaleDateString()
                        : '从未使用'
                      }
                    </div>
                  </div>
                </div>
                
                {account.authType === 'oauth' && (
                  <div className="mt-3 pt-3 border-t grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-500">访问令牌:</span>
                      <div className="font-medium">
                        {account.hasAccessToken ? '✓ 可用' : '✗ 不可用'}
                      </div>
                    </div>
                    <div>
                      <span className="text-gray-500">过期时间:</span>
                      <div className="font-medium">
                        {account.oauthExpiresAt 
                          ? new Date(account.oauthExpiresAt).toLocaleString()
                          : '未知'
                        }
                      </div>
                    </div>
                  </div>
                )}

                {account.errorMessage && (
                  <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-800">
                    错误: {account.errorMessage}
                  </div>
                )}

                {onAccountSelect && (
                  <div className="mt-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onAccountSelect(account.id)}
                      disabled={!account.isEnabled || account.status === 'error'}
                    >
                      选择此账户
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

    </div>
  );
}
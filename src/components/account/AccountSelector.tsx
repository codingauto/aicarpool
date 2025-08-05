'use client';

import { AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Label } from '@/components/ui/label';

interface AiServiceAccount {
  id: string;
  name: string;
  description?: string;
  serviceType: string;
  accountType: string;
  isEnabled: boolean;
  status: string;
  currentLoad?: number;
  isBound?: boolean;
  boundToGroupId?: string;
  boundToGroupName?: string;
}

interface AccountSelectorProps {
  accounts: AiServiceAccount[];
  selectedAccountIds: string[];
  onSelectionChange: (accountIds: string[]) => void;
  mode: 'single' | 'multiple';
  bindingMode: 'dedicated' | 'shared' | 'hybrid';
  enterpriseId: string;
  excludeGroupId?: string; // 编辑模式时排除当前拼车组
  className?: string;
}

export default function AccountSelector({
  accounts,
  selectedAccountIds,
  onSelectionChange,
  mode,
  bindingMode,
  enterpriseId,
  excludeGroupId,
  className = ''
}: AccountSelectorProps) {
  
  // 根据绑定模式过滤账号
  const getFilteredAccounts = () => {
    return accounts.filter(account => {
      // 基本条件：启用且活跃
      if (!account.isEnabled || account.status !== 'active') return false;
      
      // 专享模式：只显示未绑定的账号，或者已绑定到当前拼车组的账号
      if (bindingMode === 'dedicated') {
        return !account.isBound || account.boundToGroupId === excludeGroupId;
      }
      
      // 共享和混合模式：可以显示所有可用账号
      return true;
    });
  };

  const filteredAccounts = getFilteredAccounts();

  const handleAccountClick = (accountId: string) => {
    if (mode === 'single') {
      // 单选模式：直接设置或取消选择
      onSelectionChange(selectedAccountIds.includes(accountId) ? [] : [accountId]);
    } else {
      // 多选模式：添加或移除
      if (selectedAccountIds.includes(accountId)) {
        onSelectionChange(selectedAccountIds.filter(id => id !== accountId));
      } else {
        onSelectionChange([...selectedAccountIds, accountId]);
      }
    }
  };

  const getServiceTypeColor = (serviceType: string) => {
    switch (serviceType.toLowerCase()) {
      case 'claude': return 'bg-orange-500';
      case 'gemini': return 'bg-blue-500';
      case 'openai': return 'bg-green-500';
      default: return 'bg-gray-500';
    }
  };

  const getBindingStatusBadge = (account: AiServiceAccount) => {
    if (!account.isBound) {
      return (
        <div className="px-2 py-1 rounded-full text-xs bg-green-100 text-green-700">
          可用
        </div>
      );
    }

    if (account.boundToGroupId === excludeGroupId) {
      return (
        <div className="px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-700">
          当前绑定
        </div>
      );
    }

    return (
      <div className="px-2 py-1 rounded-full text-xs bg-red-100 text-red-700">
        已绑定到: {account.boundToGroupName}
      </div>
    );
  };

  const getModeDescription = () => {
    switch (bindingMode) {
      case 'dedicated':
        return mode === 'single' 
          ? '专属模式：选择一个专用AI账号，享有最佳性能和可预测性。'
          : '专属模式：选择多个专用AI账号进行绑定。';
      case 'shared':
        return '共享模式：使用企业的共享AI账号池，成本较低但可能需要排队。';
      case 'hybrid':
        return '混合模式：优先使用专属账号，不可用时自动切换到共享池。';
      default:
        return '';
    }
  };

  if (filteredAccounts.length === 0) {
    return (
      <div className={`space-y-4 ${className}`}>
        <div className="space-y-2">
          <Label>选择AI账号</Label>
          <p className="text-sm text-gray-600">{getModeDescription()}</p>
        </div>
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            暂无可用的AI账号。请先到{' '}
            <a 
              href={`/enterprise/${enterpriseId}/ai-accounts`}
              className="text-blue-600 hover:underline"
            >
              AI资源管理
            </a>{' '}
            创建账号。
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="space-y-2">
        <Label>选择AI账号 {bindingMode === 'dedicated' && mode === 'single' && '*'}</Label>
        <p className="text-sm text-gray-600">{getModeDescription()}</p>
      </div>

      <div className="space-y-3">
        {filteredAccounts.map(account => (
          <div 
            key={account.id}
            className={`
              border rounded-lg p-4 cursor-pointer transition-all
              ${selectedAccountIds.includes(account.id) 
                ? 'border-blue-500 bg-blue-50' 
                : 'border-gray-200 hover:border-gray-300'
              }
              ${(!account.isBound || account.boundToGroupId === excludeGroupId) 
                ? '' 
                : 'opacity-60 cursor-not-allowed'
              }
            `}
            onClick={() => {
              if (!account.isBound || account.boundToGroupId === excludeGroupId) {
                handleAccountClick(account.id);
              }
            }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full ${getServiceTypeColor(account.serviceType)}`} />
                <div>
                  <div className="font-medium">{account.name}</div>
                  <div className="text-sm text-gray-600 capitalize">
                    {account.serviceType} • {account.accountType}
                  </div>
                  {account.description && (
                    <div className="text-xs text-gray-500 mt-1">
                      {account.description}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {getBindingStatusBadge(account)}
                {selectedAccountIds.includes(account.id) && (
                  <div className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
                    <div className="w-2 h-2 bg-white rounded-full" />
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {bindingMode === 'dedicated' && mode === 'single' && selectedAccountIds.length === 0 && (
        <p className="text-sm text-red-600">专属模式需要选择一个AI账号</p>
      )}
    </div>
  );
}
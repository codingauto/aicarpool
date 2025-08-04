/**
 * AI账号列表组件
 * 支持多平台AI服务账号的显示和管理
 */

'use client';

import React, { useState, useEffect } from 'react';
import { 
  PlusIcon,
  MagnifyingGlassIcon,
  AdjustmentsHorizontalIcon,
  EllipsisVerticalIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  CpuChipIcon,
  BanknotesIcon,
  ChartBarIcon
} from '@heroicons/react/24/outline';
import PlatformSelector, { SimplePlatformSelector } from '@/components/ui/platform-selector';
import AccountCreationWizard from './account-creation-wizard';
import { ServiceType, getPlatformConfig } from '@/lib/ai-platforms/platform-configs';
import { AiServiceAccount } from '@/lib/ai-platforms/ai-service-client';

interface AccountListProps {
  accounts: AiServiceAccount[];
  onCreateAccount: (accountData: any) => void;
  onUpdateAccount: (accountId: string, updates: Partial<AiServiceAccount>) => void;
  onDeleteAccount: (accountId: string) => void;
  onTestAccount: (accountId: string) => Promise<boolean>;
  onValidateAccount: (accountId: string) => Promise<{ isValid: boolean; error?: string }>;
  loading?: boolean;
  enterpriseId?: string;
  groupId?: string;
}

interface FilterState {
  search: string;
  platform: ServiceType | '';
  status: 'all' | 'active' | 'inactive' | 'error';
  authType: 'all' | 'api_key' | 'oauth';
}

export default function AccountList({
  accounts,
  onCreateAccount,
  onUpdateAccount,
  onDeleteAccount,
  onTestAccount,
  onValidateAccount,
  loading = false,
  enterpriseId,
  groupId
}: AccountListProps) {
  const [showCreateWizard, setShowCreateWizard] = useState(false);
  const [filters, setFilters] = useState<FilterState>({
    search: '',
    platform: '',
    status: 'all',
    authType: 'all'
  });
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [accountStatuses, setAccountStatuses] = useState<Record<string, {
    isHealthy: boolean;
    responseTime?: number;
    lastChecked: Date;
  }>>({});

  // 过滤账号
  const filteredAccounts = accounts.filter(account => {
    // 搜索过滤
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      if (!account.name.toLowerCase().includes(searchLower) &&
          !getPlatformConfig(account.serviceType).displayName.toLowerCase().includes(searchLower)) {
        return false;
      }
    }

    // 平台过滤
    if (filters.platform && account.serviceType !== filters.platform) {
      return false;
    }

    // 状态过滤
    if (filters.status !== 'all' && account.status !== filters.status) {
      return false;
    }

    // 认证类型过滤
    if (filters.authType !== 'all' && account.authType !== filters.authType) {
      return false;
    }

    return true;
  });

  // 批量操作
  const handleBatchAction = async (action: 'enable' | 'disable' | 'test' | 'delete') => {
    for (const accountId of selectedAccounts) {
      switch (action) {
        case 'enable':
          onUpdateAccount(accountId, { isEnabled: true });
          break;
        case 'disable':
          onUpdateAccount(accountId, { isEnabled: false });
          break;
        case 'test':
          await onTestAccount(accountId);
          break;
        case 'delete':
          if (confirm('确定要删除选中的账号吗？')) {
            onDeleteAccount(accountId);
          }
          break;
      }
    }
    setSelectedAccounts([]);
  };

  // 全选/取消全选
  const toggleSelectAll = () => {
    if (selectedAccounts.length === filteredAccounts.length) {
      setSelectedAccounts([]);
    } else {
      setSelectedAccounts(filteredAccounts.map(account => account.id));
    }
  };

  return (
    <div className="space-y-6">
      {/* 头部操作栏 */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">AI服务账号</h2>
          <p className="mt-1 text-sm text-gray-500">
            管理所有AI平台的服务账号，共 {accounts.length} 个账号
          </p>
        </div>
        <div className="mt-4 sm:mt-0 flex space-x-3">
          <button
            type="button"
            onClick={() => setShowCreateWizard(true)}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <PlusIcon className="h-4 w-4 mr-2" />
            添加账号
          </button>
        </div>
      </div>

      {/* 过滤和搜索 */}
      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* 搜索 */}
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="搜索账号名称或平台..."
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              className="pl-10 w-full border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* 平台过滤 */}
          <SimplePlatformSelector
            selectedPlatform={filters.platform || undefined}
            onSelect={(platform) => setFilters({ ...filters, platform })}
            className="w-full"
          />

          {/* 状态过滤 */}
          <select
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value as any })}
            className="w-full border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="all">所有状态</option>
            <option value="active">活跃</option>
            <option value="inactive">未激活</option>
            <option value="error">错误</option>
          </select>

          {/* 认证类型过滤 */}
          <select  
            value={filters.authType}
            onChange={(e) => setFilters({ ...filters, authType: e.target.value as any })}
            className="w-full border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="all">所有认证</option>
            <option value="api_key">API Key</option>
            <option value="oauth">OAuth</option>
          </select>
        </div>

        {/* 批量操作和视图切换 */}
        {(selectedAccounts.length > 0 || filteredAccounts.length > 0) && (
          <div className="mt-4 flex items-center justify-between border-t border-gray-200 pt-4">
            <div className="flex items-center space-x-4">
              {selectedAccounts.length > 0 && (
                <>
                  <span className="text-sm text-gray-500">
                    已选择 {selectedAccounts.length} 个账号
                  </span>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => handleBatchAction('enable')}
                      className="text-sm text-green-600 hover:text-green-700"
                    >
                      启用
                    </button>
                    <button
                      onClick={() => handleBatchAction('disable')}
                      className="text-sm text-orange-600 hover:text-orange-700"
                    >
                      禁用
                    </button>
                    <button
                      onClick={() => handleBatchAction('test')}
                      className="text-sm text-blue-600 hover:text-blue-700"
                    >
                      测试
                    </button>
                    <button
                      onClick={() => handleBatchAction('delete')}
                      className="text-sm text-red-600 hover:text-red-700"
                    >
                      删除
                    </button>
                  </div>
                </>
              )}
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded ${viewMode === 'grid' ? 'bg-blue-100 text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}
              >
                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM11 13a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                </svg>
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 rounded ${viewMode === 'list' ? 'bg-blue-100 text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}
              >
                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 账号列表 */}
      {loading ? (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-2 text-gray-500">加载中...</span>
        </div>
      ) : filteredAccounts.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
          <CpuChipIcon className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">没有找到账号</h3>
          <p className="mt-1 text-sm text-gray-500">
            {accounts.length === 0 ? '开始添加您的第一个AI服务账号' : '尝试调整搜索条件'}
          </p>
          {accounts.length === 0 && (
            <div className="mt-6">
              <button
                type="button"
                onClick={() => setShowCreateWizard(true)}
                className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                <PlusIcon className="h-4 w-4 mr-2" />
                添加账号
              </button>
            </div>
          )}
        </div>
      ) : viewMode === 'grid' ? (
        <AccountGridView 
          accounts={filteredAccounts}
          selectedAccounts={selectedAccounts}
          onSelectAccount={(accountId, selected) => {
            if (selected) {
              setSelectedAccounts([...selectedAccounts, accountId]);
            } else {
              setSelectedAccounts(selectedAccounts.filter(id => id !== accountId));
            }
          }}
          onSelectAll={toggleSelectAll}
          onUpdateAccount={onUpdateAccount}
          onDeleteAccount={onDeleteAccount}
          onTestAccount={onTestAccount}
          accountStatuses={accountStatuses}
        />
      ) : (
        <AccountTableView
          accounts={filteredAccounts}
          selectedAccounts={selectedAccounts}
          onSelectAccount={(accountId, selected) => {
            if (selected) {
              setSelectedAccounts([...selectedAccounts, accountId]);
            } else {
              setSelectedAccounts(selectedAccounts.filter(id => id !== accountId));
            }
          }}
          onSelectAll={toggleSelectAll}
          onUpdateAccount={onUpdateAccount}
          onDeleteAccount={onDeleteAccount}
          onTestAccount={onTestAccount}
          accountStatuses={accountStatuses}
        />
      )}

      {/* 创建账号向导 */}
      <AccountCreationWizard
        isOpen={showCreateWizard}
        onClose={() => setShowCreateWizard(false)}
        onSuccess={onCreateAccount}
        enterpriseId={enterpriseId}
        groupId={groupId}
      />
    </div>
  );
}

// 网格视图组件
function AccountGridView({
  accounts,
  selectedAccounts,
  onSelectAccount,
  onSelectAll,
  onUpdateAccount,
  onDeleteAccount,
  onTestAccount,
  accountStatuses
}: {
  accounts: AiServiceAccount[];
  selectedAccounts: string[];
  onSelectAccount: (accountId: string, selected: boolean) => void;
  onSelectAll: () => void;
  onUpdateAccount: (accountId: string, updates: Partial<AiServiceAccount>) => void;
  onDeleteAccount: (accountId: string) => void;
  onTestAccount: (accountId: string) => Promise<boolean>;
  accountStatuses: Record<string, any>;
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {accounts.map(account => (
        <AccountCard
          key={account.id}
          account={account}
          selected={selectedAccounts.includes(account.id)}
          onSelect={(selected) => onSelectAccount(account.id, selected)}
          onUpdate={(updates) => onUpdateAccount(account.id, updates)}
          onDelete={() => onDeleteAccount(account.id)}
          onTest={() => onTestAccount(account.id)}
          status={accountStatuses[account.id]}
        />
      ))}
    </div>
  );
}

// 表格视图组件
function AccountTableView({
  accounts,
  selectedAccounts,
  onSelectAccount,
  onSelectAll,
  onUpdateAccount,
  onDeleteAccount,
  onTestAccount,
  accountStatuses
}: {
  accounts: AiServiceAccount[];
  selectedAccounts: string[];
  onSelectAccount: (accountId: string, selected: boolean) => void;
  onSelectAll: () => void;
  onUpdateAccount: (accountId: string, updates: Partial<AiServiceAccount>) => void;
  onDeleteAccount: (accountId: string) => void;
  onTestAccount: (accountId: string) => Promise<boolean>;
  accountStatuses: Record<string, any>;
}) {
  return (
    <div className="bg-white shadow-sm rounded-lg overflow-hidden">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left">
              <input
                type="checkbox"
                checked={selectedAccounts.length === accounts.length && accounts.length > 0}
                onChange={onSelectAll}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              账号信息
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              平台
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              状态
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              认证方式
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              最后更新
            </th>
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              操作
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {accounts.map(account => (
            <AccountTableRow
              key={account.id}
              account={account}
              selected={selectedAccounts.includes(account.id)}
              onSelect={(selected) => onSelectAccount(account.id, selected)}
              onUpdate={(updates) => onUpdateAccount(account.id, updates)}
              onDelete={() => onDeleteAccount(account.id)}
              onTest={() => onTestAccount(account.id)}
              status={accountStatuses[account.id]}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

// 账号卡片组件
function AccountCard({
  account,
  selected,
  onSelect,
  onUpdate,
  onDelete,
  onTest,
  status
}: {
  account: AiServiceAccount;
  selected: boolean;
  onSelect: (selected: boolean) => void;
  onUpdate: (updates: Partial<AiServiceAccount>) => void;
  onDelete: () => void;
  onTest: () => Promise<boolean>;
  status?: any;
}) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const platformConfig = getPlatformConfig(account.serviceType);

  const handleTest = async () => {
    setIsTesting(true);
    try {
      await onTest();
    } finally {
      setIsTesting(false);
    }
  };

  const getStatusIcon = () => {
    switch (account.status) {
      case 'active':
        return <CheckCircleIcon className="h-5 w-5 text-green-500" />;
      case 'error':
        return <XCircleIcon className="h-5 w-5 text-red-500" />;
      default:
        return <ClockIcon className="h-5 w-5 text-gray-400" />;
    }
  };

  return (
    <div className={`
      relative bg-white rounded-lg border-2 p-6 hover:shadow-md transition-all
      ${selected ? 'border-blue-500 bg-blue-50' : 'border-gray-200'}
    `}>
      {/* 选择复选框 */}
      <div className="absolute top-4 left-4">
        <input
          type="checkbox"
          checked={selected}
          onChange={(e) => onSelect(e.target.checked)}
          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
        />
      </div>

      {/* 操作菜单 */}
      <div className="absolute top-4 right-4">
        <div className="relative">
          <button
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="p-1 rounded-full hover:bg-gray-100"
          >
            <EllipsisVerticalIcon className="h-5 w-5 text-gray-400" />
          </button>
          
          {isDropdownOpen && (
            <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg z-10 border border-gray-200">
              <div className="py-1">
                <button
                  onClick={handleTest}
                  disabled={isTesting}
                  className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                >
                  {isTesting ? '测试中...' : '测试连接'}
                </button>
                <button
                  onClick={() => onUpdate({ isEnabled: !account.isEnabled })}
                  className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                >
                  {account.isEnabled ? '禁用' : '启用'}
                </button>
                <button
                  onClick={() => {
                    if (confirm('确定要删除这个账号吗？')) {
                      onDelete();
                    }
                  }}
                  className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-100"
                >
                  删除
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 账号信息 */}
      <div className="mt-6">
        <div className="flex items-center space-x-3">
          <div className="text-2xl">
            {getPlatformIcon(account.serviceType)}
          </div>
          <div>
            <h3 className="text-lg font-medium text-gray-900">
              {account.name}
            </h3>
            <p className="text-sm text-gray-500">
              {platformConfig.displayName}
            </p>
          </div>
        </div>

        <div className="mt-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">状态</span>
            <div className="flex items-center space-x-1">
              {getStatusIcon()}
              <span className={`text-sm font-medium ${
                account.status === 'active' ? 'text-green-600' : 
                account.status === 'error' ? 'text-red-600' : 'text-gray-500'
              }`}>
                {account.status === 'active' ? '正常' : 
                 account.status === 'error' ? '错误' : '未激活'}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">认证</span>
            <span className="text-sm text-gray-900">{account.authType}</span>
          </div>

          {account.currentModel && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">模型</span>
              <span className="text-sm text-gray-900">{account.currentModel}</span>
            </div>
          )}

          {status?.responseTime && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">响应时间</span>
              <span className="text-sm text-gray-900">{status.responseTime}ms</span>
            </div>
          )}
        </div>

        {/* 启用/禁用状态 */}
        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">启用状态</span>
            <button
              onClick={() => onUpdate({ isEnabled: !account.isEnabled })}
              className={`
                relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
                ${account.isEnabled ? 'bg-blue-600' : 'bg-gray-200'}
              `}
            >
              <span
                className={`
                  pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out
                  ${account.isEnabled ? 'translate-x-5' : 'translate-x-0'}
                `}
              />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// 表格行组件
function AccountTableRow({
  account,
  selected,
  onSelect,
  onUpdate,
  onDelete,
  onTest,
  status
}: {
  account: AiServiceAccount;
  selected: boolean;
  onSelect: (selected: boolean) => void;
  onUpdate: (updates: Partial<AiServiceAccount>) => void;
  onDelete: () => void;
  onTest: () => Promise<boolean>;
  status?: any;
}) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const platformConfig = getPlatformConfig(account.serviceType);

  const handleTest = async () => {
    setIsTesting(true);
    try {
      await onTest();
    } finally {
      setIsTesting(false);
    }
  };

  const getStatusBadge = () => {
    const classes = {
      active: 'bg-green-100 text-green-800',
      error: 'bg-red-100 text-red-800',
      inactive: 'bg-gray-100 text-gray-800'
    };

    const labels = {
      active: '正常',
      error: '错误',
      inactive: '未激活'
    };

    return (
      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${classes[account.status]}`}>
        {labels[account.status]}
      </span>
    );
  };

  return (
    <tr className={selected ? 'bg-blue-50' : ''}>
      <td className="px-6 py-4 whitespace-nowrap">
        <input
          type="checkbox"
          checked={selected}
          onChange={(e) => onSelect(e.target.checked)}
          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
        />
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="flex items-center">
          <div className="text-lg mr-3">
            {getPlatformIcon(account.serviceType)}
          </div>
          <div>
            <div className="text-sm font-medium text-gray-900">
              {account.name}
            </div>
            <div className="text-sm text-gray-500">
              ID: {account.id.slice(0, 8)}...
            </div>
          </div>
        </div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="text-sm text-gray-900">{platformConfig.displayName}</div>
        <div className="text-sm text-gray-500">{platformConfig.name}</div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        {getStatusBadge()}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
        {account.authType}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
        {new Date(account.updatedAt).toLocaleDateString()}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
        <div className="relative">
          <button
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="text-gray-400 hover:text-gray-500"
          >
            <EllipsisVerticalIcon className="h-5 w-5" />
          </button>
          
          {isDropdownOpen && (
            <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg z-10 border border-gray-200">
              <div className="py-1">
                <button
                  onClick={handleTest}
                  disabled={isTesting}
                  className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                >
                  {isTesting ? '测试中...' : '测试连接'}
                </button>
                <button
                  onClick={() => onUpdate({ isEnabled: !account.isEnabled })}
                  className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                >
                  {account.isEnabled ? '禁用' : '启用'}
                </button>
                <button
                  onClick={() => {
                    if (confirm('确定要删除这个账号吗？')) {
                      onDelete();
                    }
                  }}
                  className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-100"
                >
                  删除
                </button>
              </div>
            </div>
          )}
        </div>
      </td>
    </tr>
  );
}

// 获取平台图标
function getPlatformIcon(serviceType: ServiceType): string {
  const icons = {
    [ServiceType.CLAUDE]: '🤖',
    [ServiceType.CLAUDE_CONSOLE]: '🔧',
    [ServiceType.OPENAI]: '🎯',
    [ServiceType.GEMINI]: '💎',
    [ServiceType.QWEN]: '🌟',
    [ServiceType.GLM]: '🧠',
    [ServiceType.KIMI]: '🌙',
    [ServiceType.WENXIN]: '🎨',
    [ServiceType.SPARK]: '⚡',
    [ServiceType.HUNYUAN]: '☁️',
    [ServiceType.MINIMAX]: '📏',
    [ServiceType.BAICHUAN]: '🏔️',
    [ServiceType.SENSETIME]: '👁️',
    [ServiceType.DOUBAO]: '🎁'
  };
  
  return icons[serviceType] || '🤖';
}
/**
 * AI账号创建向导组件
 * 支持多平台AI服务账号的创建和配置
 */

'use client';

import React, { useState, useEffect } from 'react';
import { 
  ArrowLeftIcon, 
  ArrowRightIcon, 
  CheckIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  EyeIcon,
  EyeSlashIcon
} from '@heroicons/react/24/outline';
import PlatformSelector, { PlatformCard } from '@/components/ui/platform-selector';
import { ServiceType, AuthType, getPlatformConfig } from '@/lib/ai-platforms/platform-configs';
import { validateAccountCredentials, generateOAuthUrl, isPlatformOAuthSupported } from '@/lib/ai-platforms/adapter-manager';

interface ProxyConfig {
  type: 'http' | 'https' | 'socks5';
  host: string;
  port: number;
  username?: string;
  password?: string;
}

interface AccountData {
  name: string;
  serviceType?: ServiceType;
  authType?: AuthType;
  credentials: Record<string, string>;
  proxyConfig?: ProxyConfig;
  region?: string;
  endpointUrl?: string;
  platformConfig?: Record<string, any>;
}

interface WizardStep {
  id: string;
  title: string;
  description: string;
  isValid: (data: AccountData) => boolean;
}

const WIZARD_STEPS: WizardStep[] = [
  {
    id: 'platform',
    title: '选择AI平台',
    description: '选择要添加的AI服务平台',
    isValid: (data) => !!data.serviceType
  },
  {
    id: 'auth-method',
    title: '认证方式',
    description: '选择账号认证方式',
    isValid: (data) => !!data.authType
  },
  {
    id: 'credentials',
    title: '账号凭据',
    description: '配置API密钥或OAuth认证',
    isValid: (data) => {
      if (!data.authType) return false;
      
      switch (data.authType) {
        case AuthType.API_KEY:
          return !!data.credentials.apiKey;
        case AuthType.OAUTH:
          return !!data.credentials.accessToken || !!data.credentials.authCode;
        case AuthType.ACCESS_KEY:
          return !!data.credentials.accessKeyId && !!data.credentials.accessKeySecret;
        case AuthType.APP_KEY:
          return !!data.credentials.appId && !!data.credentials.apiKey && !!data.credentials.apiSecret;
        default:
          return false;
      }
    }
  },
  {
    id: 'configuration',
    title: '配置选项',
    description: '配置代理、区域等高级选项',
    isValid: () => true // 这一步是可选的
  },
  {
    id: 'validation',
    title: '验证测试',
    description: '验证账号配置是否正确',
    isValid: () => true // 验证结果会动态更新
  }
];

interface AccountCreationWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (accountData: AccountData) => void;
  enterpriseId?: string;
  groupId?: string;
}

export default function AccountCreationWizard({
  isOpen,
  onClose,
  onSuccess,
  enterpriseId,
  groupId
}: AccountCreationWizardProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [accountData, setAccountData] = useState<AccountData>({
    name: '',
    credentials: {}
  });
  const [isValidating, setIsValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<{
    isValid: boolean;
    errorMessage?: string;
  } | null>(null);
  const [showCredentials, setShowCredentials] = useState(false);

  // 重置向导状态
  const resetWizard = () => {
    setCurrentStep(0);
    setAccountData({
      name: '',
      credentials: {}
    });
    setValidationResult(null);
  };

  useEffect(() => {
    if (isOpen) {
      resetWizard();
    }
  }, [isOpen]);

  // 更新账号数据
  const updateAccountData = (updates: Partial<AccountData>) => {
    setAccountData(prev => ({ ...prev, ...updates }));
  };

  // 下一步
  const nextStep = () => {
    if (currentStep < WIZARD_STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  // 上一步  
  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  // 验证账号
  const validateAccount = async () => {
    if (!accountData.serviceType || !accountData.authType) {
      return;
    }

    setIsValidating(true);
    setValidationResult(null);

    try {
      const result = await validateAccountCredentials(
        accountData.serviceType,
        accountData.credentials,
        accountData.proxyConfig
      );

      setValidationResult(result);
    } catch (error) {
      setValidationResult({
        isValid: false,
        errorMessage: error instanceof Error ? error.message : '验证失败'
      });
    } finally {
      setIsValidating(false);
    }
  };

  // 完成创建
  const handleComplete = () => {
    if (validationResult?.isValid) {
      onSuccess(accountData);
      onClose();
    }
  };

  const currentStepData = WIZARD_STEPS[currentStep];
  const isStepValid = currentStepData.isValid(accountData);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-end justify-center px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        {/* 背景遮罩 */}
        <div 
          className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
          onClick={onClose}
        />

        {/* 模态框 */}
        <div className="relative inline-block w-full max-w-4xl my-8 overflow-hidden text-left align-middle bg-white rounded-lg shadow-xl transform transition-all">
          {/* 头部 */}
          <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium text-gray-900">
                添加AI服务账号
              </h3>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-500"
              >
                <span className="sr-only">关闭</span>
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* 步骤指示器 */}
            <div className="mt-4">
              <nav aria-label="Progress">
                <ol className="flex items-center">
                  {WIZARD_STEPS.map((step, index) => (
                    <li key={step.id} className={`relative ${index !== WIZARD_STEPS.length - 1 ? 'pr-8 sm:pr-20' : ''}`}>
                      <div className="absolute inset-0 flex items-center" aria-hidden="true">
                        {index !== WIZARD_STEPS.length - 1 && (
                          <div className={`h-0.5 w-full ${index < currentStep ? 'bg-blue-600' : 'bg-gray-200'}`} />
                        )}
                      </div>
                      <div className={`
                        relative flex h-8 w-8 items-center justify-center rounded-full
                        ${index < currentStep 
                          ? 'bg-blue-600 text-white' 
                          : index === currentStep 
                            ? 'border-2 border-blue-600 bg-white text-blue-600'
                            : 'border-2 border-gray-300 bg-white text-gray-400'
                        }
                      `}>
                        {index < currentStep ? (
                          <CheckIcon className="h-5 w-5" />
                        ) : (
                          <span className="text-sm font-medium">{index + 1}</span>
                        )}
                      </div>
                    </li>
                  ))}
                </ol>
              </nav>
            </div>
          </div>

          {/* 主体内容 */}
          <div className="px-6 py-6">
            <div className="mb-6">
              <h4 className="text-lg font-medium text-gray-900">
                {currentStepData.title}
              </h4>
              <p className="mt-1 text-sm text-gray-500">
                {currentStepData.description}
              </p>
            </div>

            {/* 步骤内容 */}
            <div className="space-y-6">
              {currentStep === 0 && <PlatformSelectionStep accountData={accountData} updateAccountData={updateAccountData} />}
              {currentStep === 1 && <AuthMethodStep accountData={accountData} updateAccountData={updateAccountData} />}
              {currentStep === 2 && <CredentialsStep accountData={accountData} updateAccountData={updateAccountData} showCredentials={showCredentials} setShowCredentials={setShowCredentials} />}
              {currentStep === 3 && <ConfigurationStep accountData={accountData} updateAccountData={updateAccountData} />}
              {currentStep === 4 && <ValidationStep accountData={accountData} isValidating={isValidating} validationResult={validationResult} onValidate={validateAccount} />}
            </div>
          </div>

          {/* 底部按钮 */}
          <div className="bg-gray-50 px-6 py-4 flex justify-between">
            <button
              type="button"
              onClick={prevStep}
              disabled={currentStep === 0}
              className={`
                inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md
                ${currentStep === 0 
                  ? 'text-gray-400 bg-white cursor-not-allowed' 
                  : 'text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'
                }
              `}
            >
              <ArrowLeftIcon className="h-4 w-4 mr-2" />
              上一步
            </button>

            <div className="flex space-x-3">
              {currentStep === WIZARD_STEPS.length - 1 ? (
                <button
                  type="button"
                  onClick={handleComplete}
                  disabled={!validationResult?.isValid}
                  className={`
                    inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white
                    ${validationResult?.isValid
                      ? 'bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500'
                      : 'bg-gray-400 cursor-not-allowed'
                    }
                  `}
                >
                  <CheckIcon className="h-4 w-4 mr-2" />
                  完成创建
                </button>
              ) : (
                <button
                  type="button"
                  onClick={nextStep}
                  disabled={!isStepValid}
                  className={`
                    inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white
                    ${isStepValid
                      ? 'bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'
                      : 'bg-gray-400 cursor-not-allowed'
                    }
                  `}
                >
                  下一步
                  <ArrowRightIcon className="h-4 w-4 ml-2" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// 平台选择步骤
function PlatformSelectionStep({ 
  accountData, 
  updateAccountData 
}: { 
  accountData: AccountData; 
  updateAccountData: (updates: Partial<AccountData>) => void;
}) {
  const handlePlatformSelect = (platform: ServiceType) => {
    const config = getPlatformConfig(platform);
    updateAccountData({ 
      serviceType: platform,
      name: `${config.displayName} 账号`,
      authType: undefined, // 重置认证方式
      credentials: {} // 重置凭据
    });
  };

  return (
    <div>
      <PlatformSelector
        selectedPlatform={accountData.serviceType}
        onSelect={handlePlatformSelect}
        className="w-full"
        placeholder="选择要添加的AI平台"
      />
      
      {accountData.serviceType && (
        <div className="mt-4 p-4 bg-blue-50 rounded-lg">
          <div className="flex">
            <InformationCircleIcon className="h-5 w-5 text-blue-400" />
            <div className="ml-3">
              <h4 className="text-sm font-medium text-blue-800">
                平台信息
              </h4>
              <div className="mt-2 text-sm text-blue-700">
                <p>{getPlatformConfig(accountData.serviceType).description}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// 认证方式选择步骤
function AuthMethodStep({ 
  accountData, 
  updateAccountData 
}: { 
  accountData: AccountData; 
  updateAccountData: (updates: Partial<AccountData>) => void;
}) {
  if (!accountData.serviceType) return null;

  const platformConfig = getPlatformConfig(accountData.serviceType);
  const supportedAuthTypes = platformConfig.supportedAuthTypes;

  const authTypeLabels = {
    [AuthType.API_KEY]: { label: 'API Key', description: '使用API密钥进行认证' },
    [AuthType.OAUTH]: { label: 'OAuth 2.0', description: '使用OAuth授权登录' },
    [AuthType.ACCESS_KEY]: { label: 'Access Key', description: '使用访问密钥ID和密钥' },
    [AuthType.APP_KEY]: { label: 'App Key', description: '使用应用ID和密钥' },
    [AuthType.SESSION_TOKEN]: { label: 'Session Token', description: '使用会话令牌' },
    [AuthType.BEARER_TOKEN]: { label: 'Bearer Token', description: '使用Bearer令牌' },
    [AuthType.PROJECT_KEY]: { label: 'Project Key', description: '使用项目密钥' }
  };

  return (
    <div className="space-y-4">
      {supportedAuthTypes.map((authType) => {
        const authInfo = authTypeLabels[authType];
        return (
          <div key={authType} className="relative">
            <input
              type="radio"
              id={authType}
              name="authType"
              value={authType}
              checked={accountData.authType === authType}
              onChange={() => updateAccountData({ 
                authType,
                credentials: {} // 重置凭据
              })}
              className="sr-only"
            />
            <label
              htmlFor={authType}
              className={`
                relative block w-full p-4 border-2 rounded-lg cursor-pointer
                ${accountData.authType === authType 
                  ? 'border-blue-500 bg-blue-50' 
                  : 'border-gray-300 hover:border-gray-400'
                }
              `}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium text-gray-900">
                    {authInfo.label}
                  </div>
                  <div className="text-sm text-gray-500">
                    {authInfo.description}
                  </div>
                </div>
                {accountData.authType === authType && (
                  <CheckIcon className="h-5 w-5 text-blue-500" />
                )}
              </div>
            </label>
          </div>
        );
      })}
    </div>
  );
}

// 凭据配置步骤
function CredentialsStep({ 
  accountData, 
  updateAccountData, 
  showCredentials, 
  setShowCredentials 
}: { 
  accountData: AccountData; 
  updateAccountData: (updates: Partial<AccountData>) => void;
  showCredentials: boolean;
  setShowCredentials: (show: boolean) => void;
}) {
  const updateCredential = (key: string, value: string) => {
    updateAccountData({
      credentials: {
        ...accountData.credentials,
        [key]: value
      }
    });
  };

  const updateName = (name: string) => {
    updateAccountData({ name });
  };

  if (!accountData.authType) return null;

  return (
    <div className="space-y-6">
      {/* 账号名称 */}
      <div>
        <label className="block text-sm font-medium text-gray-700">
          账号名称 *
        </label>
        <input
          type="text"
          value={accountData.name}
          onChange={(e) => updateName(e.target.value)}
          className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
          placeholder="输入账号名称"
        />
      </div>

      {/* 根据认证方式显示不同的表单 */}
      {accountData.authType === AuthType.API_KEY && (
        <div>
          <label className="block text-sm font-medium text-gray-700">
            API Key *
          </label>
          <div className="mt-1 relative">
            <input
              type={showCredentials ? 'text' : 'password'}
              value={accountData.credentials.apiKey || ''}
              onChange={(e) => updateCredential('apiKey', e.target.value)}
              className="block w-full pr-10 border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
              placeholder="输入API Key"
            />
            <button
              type="button"
              onClick={() => setShowCredentials(!showCredentials)}
              className="absolute inset-y-0 right-0 pr-3 flex items-center"
            >
              {showCredentials ? (
                <EyeSlashIcon className="h-5 w-5 text-gray-400" />
              ) : (
                <EyeIcon className="h-5 w-5 text-gray-400" />
              )}
            </button>
          </div>
        </div>
      )}

      {accountData.authType === AuthType.ACCESS_KEY && (
        <>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Access Key ID *
            </label>
            <input
              type="text"
              value={accountData.credentials.accessKeyId || ''}
              onChange={(e) => updateCredential('accessKeyId', e.target.value)}
              className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
              placeholder="输入Access Key ID"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Access Key Secret *
            </label>
            <div className="mt-1 relative">
              <input
                type={showCredentials ? 'text' : 'password'}
                value={accountData.credentials.accessKeySecret || ''}
                onChange={(e) => updateCredential('accessKeySecret', e.target.value)}
                className="block w-full pr-10 border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                placeholder="输入Access Key Secret"
              />
              <button
                type="button"
                onClick={() => setShowCredentials(!showCredentials)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center"
              >
                {showCredentials ? (
                  <EyeSlashIcon className="h-5 w-5 text-gray-400" />
                ) : (
                  <EyeIcon className="h-5 w-5 text-gray-400" />
                )}
              </button>
            </div>
          </div>
        </>
      )}

      {accountData.authType === AuthType.APP_KEY && (
        <>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              App ID *
            </label>
            <input
              type="text"
              value={accountData.credentials.appId || ''}
              onChange={(e) => updateCredential('appId', e.target.value)}
              className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
              placeholder="输入App ID"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              API Key *
            </label>
            <input
              type="text"
              value={accountData.credentials.apiKey || ''}
              onChange={(e) => updateCredential('apiKey', e.target.value)}
              className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
              placeholder="输入API Key"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              API Secret *
            </label>
            <div className="mt-1 relative">
              <input
                type={showCredentials ? 'text' : 'password'}
                value={accountData.credentials.apiSecret || ''}
                onChange={(e) => updateCredential('apiSecret', e.target.value)}
                className="block w-full pr-10 border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                placeholder="输入API Secret"
              />
              <button
                type="button"
                onClick={() => setShowCredentials(!showCredentials)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center"
              >
                {showCredentials ? (
                  <EyeSlashIcon className="h-5 w-5 text-gray-400" />
                ) : (
                  <EyeIcon className="h-5 w-5 text-gray-400" />
                )}
              </button>
            </div>
          </div>
        </>
      )}

      {accountData.authType === AuthType.OAUTH && accountData.serviceType && isPlatformOAuthSupported(accountData.serviceType) && (
        <div className="p-4 bg-blue-50 rounded-lg">
          <div className="flex">
            <InformationCircleIcon className="h-5 w-5 text-blue-400" />
            <div className="ml-3">
              <h4 className="text-sm font-medium text-blue-800">
                OAuth 认证
              </h4>
              <div className="mt-2 text-sm text-blue-700">
                <p>OAuth认证需要在浏览器中完成授权流程。点击下面的按钮开始授权。</p>
              </div>
              <div className="mt-3">
                <button
                  type="button"
                  className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  开始OAuth授权
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// 配置选项步骤
function ConfigurationStep({ 
  accountData, 
  updateAccountData 
}: { 
  accountData: AccountData; 
  updateAccountData: (updates: Partial<AccountData>) => void;
}) {
  const [useProxy, setUseProxy] = useState(!!accountData.proxyConfig);

  const updateProxyConfig = (updates: Partial<ProxyConfig>) => {
    updateAccountData({
      proxyConfig: {
        ...accountData.proxyConfig,
        ...updates
      } as ProxyConfig
    });
  };

  return (
    <div className="space-y-6">
      {/* 代理配置 */}
      <div>
        <div className="flex items-center">
          <input
            id="use-proxy"
            type="checkbox"
            checked={useProxy}
            onChange={(e) => {
              setUseProxy(e.target.checked);
              if (!e.target.checked) {
                updateAccountData({ proxyConfig: undefined });
              }
            }}
            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
          />
          <label htmlFor="use-proxy" className="ml-2 block text-sm font-medium text-gray-700">
            使用代理服务器
          </label>
        </div>

        {useProxy && (
          <div className="mt-4 space-y-4 p-4 border border-gray-200 rounded-lg">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  代理类型
                </label>
                <select
                  value={accountData.proxyConfig?.type || 'http'}
                  onChange={(e) => updateProxyConfig({ type: e.target.value as any })}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="http">HTTP</option>
                  <option value="https">HTTPS</option>
                  <option value="socks5">SOCKS5</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  端口
                </label>
                <input
                  type="number"
                  value={accountData.proxyConfig?.port || ''}
                  onChange={(e) => updateProxyConfig({ port: parseInt(e.target.value) || 0 })}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                  placeholder="8080"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                代理地址
              </label>
              <input
                type="text"
                value={accountData.proxyConfig?.host || ''}
                onChange={(e) => updateProxyConfig({ host: e.target.value })}
                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                placeholder="proxy.example.com"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  用户名（可选）
                </label>
                <input
                  type="text"
                  value={accountData.proxyConfig?.username || ''}
                  onChange={(e) => updateProxyConfig({ username: e.target.value })}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  密码（可选）
                </label>
                <input
                  type="password"
                  value={accountData.proxyConfig?.password || ''}
                  onChange={(e) => updateProxyConfig({ password: e.target.value })}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 区域配置 */}
      <div>
        <label className="block text-sm font-medium text-gray-700">
          服务区域（可选）
        </label>
        <input
          type="text"
          value={accountData.region || ''}
          onChange={(e) => updateAccountData({ region: e.target.value })}
          className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
          placeholder="如：us-east-1"
        />
        <p className="mt-1 text-sm text-gray-500">
          某些服务需要指定区域
        </p>
      </div>

      {/* 自定义端点 */}
      <div>
        <label className="block text-sm font-medium text-gray-700">
          自定义API端点（可选）
        </label>
        <input
          type="url"
          value={accountData.endpointUrl || ''}
          onChange={(e) => updateAccountData({ endpointUrl: e.target.value })}
          className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
          placeholder="https://api.example.com"
        />
        <p className="mt-1 text-sm text-gray-500">
          留空使用默认API端点
        </p>
      </div>
    </div>
  );
}

// 验证测试步骤
function ValidationStep({ 
  accountData, 
  isValidating, 
  validationResult, 
  onValidate 
}: { 
  accountData: AccountData;
  isValidating: boolean;
  validationResult: { isValid: boolean; errorMessage?: string } | null;
  onValidate: () => void;
}) {
  return (
    <div className="space-y-6">
      {/* 配置摘要 */}
      <div className="bg-gray-50 p-4 rounded-lg">
        <h4 className="text-sm font-medium text-gray-900 mb-3">配置摘要</h4>
        <dl className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2">
          <div>
            <dt className="text-sm font-medium text-gray-500">账号名称</dt>
            <dd className="text-sm text-gray-900">{accountData.name}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">AI平台</dt>
            <dd className="text-sm text-gray-900">
              {accountData.serviceType ? getPlatformConfig(accountData.serviceType).displayName : '未选择'}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">认证方式</dt>
            <dd className="text-sm text-gray-900">{accountData.authType || '未选择'}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">代理配置</dt>
            <dd className="text-sm text-gray-900">
              {accountData.proxyConfig ? '已配置' : '未配置'}
            </dd>
          </div>
        </dl>
      </div>

      {/* 验证按钮 */}
      <div className="text-center">
        <button
          type="button"
          onClick={onValidate}
          disabled={isValidating}
          className={`
            inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white
            ${isValidating 
              ? 'bg-gray-400 cursor-not-allowed' 
              : 'bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'
            }
          `}
        >
          {isValidating ? (
            <>
              <svg className="animate-spin -ml-1 mr-3 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              验证中...
            </>
          ) : (
            '验证账号配置'
          )}
        </button>
      </div>

      {/* 验证结果 */}
      {validationResult && (
        <div className={`
          p-4 rounded-lg
          ${validationResult.isValid ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}
        `}>
          <div className="flex">
            {validationResult.isValid ? (
              <CheckIcon className="h-5 w-5 text-green-400" />
            ) : (
              <ExclamationTriangleIcon className="h-5 w-5 text-red-400" />
            )}
            <div className="ml-3">
              <h4 className={`text-sm font-medium ${validationResult.isValid ? 'text-green-800' : 'text-red-800'}`}>
                {validationResult.isValid ? '验证成功' : '验证失败'}
              </h4>
              {validationResult.errorMessage && (
                <div className={`mt-2 text-sm ${validationResult.isValid ? 'text-green-700' : 'text-red-700'}`}>
                  <p>{validationResult.errorMessage}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
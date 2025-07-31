'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Link, Copy, Check, AlertTriangle, Info, Lightbulb, Key, RefreshCw } from 'lucide-react';
import { ProxyConfigData } from './ProxyConfig';

interface OAuthFlowProps {
  platform: 'claude' | 'gemini' | 'ampcode';
  proxy?: ProxyConfigData;
  groupId: string;
  onSuccess: (tokenInfo: any) => void;
  onBack: () => void;
}

export default function OAuthFlow({ platform, proxy, groupId, onSuccess, onBack }: OAuthFlowProps) {
  
  const [loading, setLoading] = useState(false);
  const [exchanging, setExchanging] = useState(false);
  const [authUrl, setAuthUrl] = useState('');
  const [authCode, setAuthCode] = useState('');
  const [copied, setCopied] = useState(false);
  const [sessionId, setSessionId] = useState('');
  const [error, setError] = useState('');

  // 格式化错误消息
  const formatErrorMessage = (error: any, defaultMessage: string): string => {
    let message = '';
    
    if (typeof error === 'string') {
      message = error;
    } else if (error instanceof Error) {
      message = error.message;
    } else {
      return defaultMessage;
    }
    
    // 尝试解析JSON错误
    try {
      if (message.includes('{') && message.includes('}')) {
        const jsonStart = message.indexOf('{');
        const jsonPart = message.substring(jsonStart);
        const parsed = JSON.parse(jsonPart);
        message = parsed.error || parsed.message || message;
      }
    } catch {
      // JSON解析失败，继续处理字符串
    }
    
    // 清理常见的错误格式
    message = message
      .replace(/^HTTP \d+:\s*/, '')
      .replace(/^Error:\s*/, '')
      .replace(/^\{.*\}$/, '')
      .trim();
    
    // 处理常见的错误情况
    if (message.includes('Invalid \'code\' in request')) {
      return '授权码无效，请检查是否复制了完整正确的授权码';
    }
    
    if (message.includes('OAuth session') || message.includes('expired')) {
      return '授权会话已过期，请重新生成授权链接';
    }
    
    if (message.includes('Network Error') || message.includes('fetch')) {
      return '网络连接失败，请检查网络连接后重试';
    }
    
    if (message.includes('401') || message.includes('Unauthorized')) {
      return '认证失败，请重新登录后重试';
    }
    
    if (message.includes('403') || message.includes('Forbidden')) {
      return '权限不足，请检查账户权限设置';
    }
    
    if (message.includes('500') || message.includes('Internal Server Error')) {
      return '服务器内部错误，请稍后重试';
    }
    
    // 如果消息太长、为空或包含技术细节，使用默认消息
    if (!message || message.length > 200 || 
        message.includes('stack') || 
        message.includes('TypeError') ||
        message.includes('undefined') ||
        /^[{[].*[}\]]$/.test(message)) {
      return defaultMessage;
    }
    
    return message || defaultMessage;
  };

  // 平台配置
  const platformConfig = {
    claude: {
      name: 'Claude',
      color: 'blue',
      icon: '🤖',
      description: '请按照以下步骤完成 Claude 账户的授权：',
      codeLabel: 'Authorization Code',
      codePlaceholder: '粘贴从Claude页面获取的Authorization Code...',
      codeHint: '请粘贴从Claude页面复制的Authorization Code'
    },
    gemini: {
      name: 'Gemini', 
      color: 'green',
      icon: '🧠',
      description: '请按照以下步骤完成 Gemini 账户的授权：',
      codeLabel: '复制oauth后的链接',
      codePlaceholder: '粘贴以 http://localhost:45462 开头的完整链接...',
      codeHint: '支持粘贴完整链接，系统会自动提取授权码'
    },
    ampcode: {
      name: 'AMPCode',
      color: 'purple', 
      icon: '⚡',
      description: '请按照以下步骤完成 AMPCode 账户的授权：',
      codeLabel: 'Authorization Code',
      codePlaceholder: '粘贴从AMPCode页面获取的Authorization Code...',
      codeHint: '请粘贴从AMPCode页面复制的Authorization Code'
    }
  };

  const config = platformConfig[platform];
  const colorClasses = {
    blue: {
      bg: 'bg-blue-50',
      border: 'border-blue-200',
      text: 'text-blue-800',
      title: 'text-blue-900',
      icon: 'bg-blue-500',
      step: 'bg-blue-600',
      button: 'text-blue-600 hover:text-blue-700'
    },
    green: {
      bg: 'bg-green-50',
      border: 'border-green-200', 
      text: 'text-green-800',
      title: 'text-green-900',
      icon: 'bg-green-500',
      step: 'bg-green-600',
      button: 'text-green-600 hover:text-green-700'
    },
    purple: {
      bg: 'bg-purple-50',
      border: 'border-purple-200',
      text: 'text-purple-800', 
      title: 'text-purple-900',
      icon: 'bg-purple-500',
      step: 'bg-purple-600',
      button: 'text-purple-600 hover:text-purple-700'
    }
  };

  const colors = colorClasses[config.color as keyof typeof colorClasses];

  // 生成授权URL
  const generateAuthUrl = async () => {
    setLoading(true);
    setError('');
    
    // 检查必要参数
    if (!groupId) {
      setError('groupId 参数缺失');
      setLoading(false);
      return;
    }
    
    if (!platform) {
      setError('platform 参数缺失');
      setLoading(false);
      return;
    }
    
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('未找到认证 token，请重新登录');
      }
      
      const proxyConfig = proxy?.enabled ? { proxy } : {};
      
      const apiUrl = `/api/groups/${groupId}/ai-accounts/oauth/generate-auth-url`;
      const requestHeaders = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      };
      
      const requestBody = {
        serviceType: platform,
        ...proxyConfig,
      };
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: requestHeaders,
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        let errorText = '';
        try {
          errorText = await response.text();
          // 尝试解析JSON错误
          try {
            const errorData = JSON.parse(errorText);
            throw new Error(errorData.error || errorData.message || `请求失败 (${response.status})`);
          } catch {
            // 如果不是JSON，使用原始错误文本
            throw new Error(errorText || `请求失败 (${response.status})`);
          }
        } catch (textError) {
          throw new Error(`请求失败 (${response.status})`);
        }
      }

      const data = await response.json();

      if (data.success && data.data?.authUrl) {
        setAuthUrl(data.data.authUrl);
        setSessionId(data.data.sessionId);
      } else {
        throw new Error(data.error || data.message || '生成授权链接失败');
      }
    } catch (error) {
      const errorMessage = formatErrorMessage(error, '生成授权链接失败');
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // 重新生成授权URL
  const regenerateAuthUrl = () => {
    setAuthUrl('');
    setAuthCode('');
    setError('');
    generateAuthUrl();
  };

  // 复制授权URL
  const copyAuthUrl = async () => {
    try {
      await navigator.clipboard.writeText(authUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      // 降级方案
      const input = document.createElement('input');
      input.value = authUrl;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // 监听授权码输入，自动提取URL中的code参数
  useEffect(() => {
    if (!authCode || typeof authCode !== 'string') return;
    
    const trimmedValue = authCode.trim();
    if (!trimmedValue) return;

    // 检查是否是URL格式
    const isUrl = trimmedValue.startsWith('http://') || trimmedValue.startsWith('https://');
    
    if (isUrl && platform === 'gemini') {
      try {
        const url = new URL(trimmedValue);
        const code = url.searchParams.get('code');
        
        if (code && code !== authCode) {
          setAuthCode(code);
        }
      } catch (error) {
        // URL解析失败，保持原值
      }
    }
  }, [authCode, platform]);

  // 交换授权码
  const exchangeCode = async () => {
    if (!authUrl || !authCode.trim()) return;
    
    setExchanging(true);
    setError('');
    try {
      const data: any = {
        sessionId,
        accountName: `${config.name} Account ${Date.now()}`, // 生成默认账户名
        description: `通过OAuth授权创建的${config.name}账户`,
        accountType: 'shared',
      };

      if (platform === 'claude') {
        data.authCodeOrUrl = authCode.trim();
      } else if (platform === 'gemini') {
        data.authCodeOrUrl = authCode.trim();
      } else if (platform === 'ampcode') {
        data.authCodeOrUrl = authCode.trim();
      }

      const response = await fetch(`/api/groups/${groupId}/ai-accounts/oauth/exchange-code`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        let errorText = '';
        try {
          errorText = await response.text();
          // 尝试解析JSON错误
          try {
            const errorData = JSON.parse(errorText);
            throw new Error(errorData.error || errorData.message || `授权请求失败 (${response.status})`);
          } catch {
            // 如果不是JSON，使用原始错误文本
            throw new Error(errorText || `授权请求失败 (${response.status})`);
          }
        } catch (textError) {
          throw new Error(`授权请求失败 (${response.status})`);
        }
      }

      const result = await response.json();
      if (result.success) {
        onSuccess(result.data);
      } else {
        throw new Error(result.error || result.message || '授权失败');
      }
    } catch (error) {
      const errorMessage = formatErrorMessage(error, '授权失败');
      setError(errorMessage);
    } finally {
      setExchanging(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className={`${colors.bg} ${colors.border}`}>
        <CardHeader>
          <div className="flex items-start gap-4">
            <div className={`w-10 h-10 ${colors.icon} rounded-lg flex items-center justify-center flex-shrink-0`}>
              <span className="text-white text-lg">{config.icon}</span>
            </div>
            <div className="flex-1">
              <CardTitle className={`${colors.title} mb-3`}>
                {config.name} 账户授权
              </CardTitle>
              <p className={`text-sm ${colors.text} mb-4`}>
                {config.description}
              </p>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {/* 步骤1: 生成授权链接 */}
          <div className="bg-white/80 rounded-lg p-4 border border-gray-200">
            <div className="flex items-start gap-3">
              <div className={`w-6 h-6 ${colors.step} text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0`}>
                1
              </div>
              <div className="flex-1">
                <p className={`font-medium ${colors.title} mb-2`}>
                  点击下方按钮生成授权链接
                </p>
                {!authUrl ? (
                  <Button
                    onClick={generateAuthUrl}
                    disabled={loading}
                    className="text-sm"
                  >
                    {loading ? (
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Link className="w-4 h-4 mr-2" />
                    )}
                    {loading ? '生成中...' : '生成授权链接'}
                  </Button>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Input
                        value={authUrl}
                        readOnly
                        className="flex-1 text-xs font-mono bg-gray-50"
                      />
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={copyAuthUrl}
                        title="复制链接"
                      >
                        {copied ? (
                          <Check className="w-4 h-4 text-green-500" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => window.open(authUrl, '_blank')}
                        title="打开链接"
                      >
                        <Link className="w-4 h-4" />
                      </Button>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={regenerateAuthUrl}
                        className={`text-xs ${colors.button}`}
                      >
                        <RefreshCw className="w-3 h-3 mr-1" />
                        重新生成
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => window.open(authUrl, '_blank')}
                        className={`text-xs ${colors.button}`}
                      >
                        <Link className="w-3 h-3 mr-1" />
                        直接打开
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 步骤2: 访问链接并授权 */}
          <div className="bg-white/80 rounded-lg p-4 border border-gray-200">
            <div className="flex items-start gap-3">
              <div className={`w-6 h-6 ${colors.step} text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0`}>
                2
              </div>
              <div className="flex-1">
                <p className={`font-medium ${colors.title} mb-2`}>
                  在浏览器中打开链接并完成授权
                </p>
                {platform === 'claude' && (
                  <>
                    <p className={`text-sm ${colors.text} mb-2`}>
                      请在新标签页中打开授权链接，登录您的 Claude 账户并授权。
                    </p>
                    <div className="bg-yellow-50 p-3 rounded border border-yellow-300">
                      <p className="text-xs text-yellow-800 flex items-start gap-2">
                        <AlertTriangle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                        <span>
                          <strong>注意：</strong>如果您设置了代理，请确保浏览器也使用相同的代理访问授权页面。
                        </span>
                      </p>
                    </div>
                  </>
                )}
                {platform === 'gemini' && (
                  <>
                    <ol className={`text-sm ${colors.text} space-y-1 list-decimal list-inside mb-3`}>
                      <li>点击上方的授权链接，在新页面中完成Google账号登录</li>
                      <li>点击"登录"按钮后可能会加载很慢（这是正常的）</li>
                      <li>如果超过1分钟还在加载，请按 F5 刷新页面</li>
                      <li>授权完成后会跳转到 http://localhost:45462 (可能显示无法访问)</li>
                    </ol>
                    <div className="bg-green-100 p-3 rounded border border-green-300">
                      <p className="text-xs text-green-700 flex items-start gap-2">
                        <Lightbulb className="w-3 h-3 mt-0.5 flex-shrink-0" />
                        <span>
                          <strong>提示：</strong>如果页面一直无法跳转，可以打开浏览器开发者工具（F12），F5刷新一下授权页再点击页面的登录按钮，在"网络"标签中找到以 localhost:45462 开头的请求，复制其完整URL。
                        </span>
                      </p>
                    </div>
                  </>
                )}
                {platform === 'ampcode' && (
                  <p className={`text-sm ${colors.text} mb-2`}>
                    请在新标签页中打开授权链接，登录您的 AMPCode 账户并授权。
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* 步骤3: 输入授权码 */}
          <div className="bg-white/80 rounded-lg p-4 border border-gray-200">
            <div className="flex items-start gap-3">
              <div className={`w-6 h-6 ${colors.step} text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0`}>
                3
              </div>
              <div className="flex-1">
                <p className={`font-medium ${colors.title} mb-2`}>
                  {platform === 'claude' ? '输入 Authorization Code' : 
                   platform === 'gemini' ? '复制oauth后的链接' : 
                   '输入 Authorization Code'}
                </p>
                <p className={`text-sm ${colors.text} mb-3`}>
                  {platform === 'claude' ? '授权完成后，页面会显示一个 Authorization Code，请将其复制并粘贴到下方输入框：' :
                   platform === 'gemini' ? '复制浏览器地址栏的完整链接并粘贴到下方输入框：' :
                   '授权完成后，页面会显示一个 Authorization Code，请将其复制并粘贴到下方输入框：'}
                </p>
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Key className={`w-4 h-4 ${colors.icon.replace('bg-', 'text-')}`} />
                      {config.codeLabel}
                    </Label>
                    <textarea
                      value={authCode}
                      onChange={(e) => setAuthCode(e.target.value)}
                      rows={3}
                      className="w-full p-3 border border-gray-300 rounded-md resize-none font-mono text-sm"
                      placeholder={config.codePlaceholder}
                    />
                  </div>
                  {platform === 'gemini' ? (
                    <div className="space-y-1">
                      <p className="text-xs text-gray-600 flex items-center gap-1">
                        <Check className="w-3 h-3 text-green-500" />
                        支持粘贴完整链接，系统会自动提取授权码
                      </p>
                      <p className="text-xs text-gray-600 flex items-center gap-1">
                        <Check className="w-3 h-3 text-green-500" />
                        也可以直接粘贴授权码（code参数的值）
                      </p>
                    </div>
                  ) : (
                    <p className="text-xs text-gray-500 flex items-center gap-1">
                      <Info className="w-3 h-3" />
                      {config.codeHint}
                    </p>
                  )}
                </div>
                
                {/* 错误提示 - 放在第三步下方 */}
                {error && (
                  <div className="mt-4 bg-red-50 border border-red-200 p-4 rounded-lg">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-red-800 font-medium mb-1">
                          {exchanging || (!authUrl && !loading) ? '授权失败' : '生成授权链接失败'}
                        </p>
                        <p className="text-red-700 text-sm mb-3">{error}</p>
                        <div className="flex gap-2">
                          {!authUrl ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setError('');
                                generateAuthUrl();
                              }}
                              disabled={loading}
                              className="text-xs"
                            >
                              {loading ? '重试中...' : '重试'}
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setError('');
                                setAuthCode('');
                              }}
                              className="text-xs"
                            >
                              重新输入
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setError('')}
                            className="text-xs"
                          >
                            关闭
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 操作按钮 */}
      <div className="flex gap-3">
        <Button
          variant="outline"
          onClick={onBack}
          className="flex-1"
        >
          上一步
        </Button>
        <Button
          onClick={exchangeCode}
          disabled={!authUrl || !authCode.trim() || exchanging}
          className="flex-1"
        >
          {exchanging && <RefreshCw className="w-4 h-4 mr-2 animate-spin" />}
          {exchanging ? '验证中...' : '完成授权'}
        </Button>
      </div>
    </div>
  );
}
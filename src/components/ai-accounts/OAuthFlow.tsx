import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Link, RefreshCw, CheckCircle, Copy, AlertTriangle } from 'lucide-react';
import { ProxyConfig } from '@/types/ai-account';
import { toast } from 'sonner';

interface OAuthFlowProps {
  platform: 'claude' | 'gemini';
  proxy: ProxyConfig;
  enterpriseId: string;
  onComplete: (oauthData: any) => void;
}

export function OAuthFlow({ platform, proxy, enterpriseId, onComplete }: OAuthFlowProps) {
  const [loading, setLoading] = useState(false);
  const [authUrl, setAuthUrl] = useState('');
  const [authCode, setAuthCode] = useState('');
  const [copied, setCopied] = useState(false);
  const [oauthParams, setOauthParams] = useState<any>(null);

  // 生成OAuth授权链接
  const generateAuthUrl = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      
      // 根据平台选择对应的接口
      let apiUrl;
      switch (platform) {
        case 'claude':
          apiUrl = `/api/enterprises/${enterpriseId}/claude-accounts/generate-auth-url`;
          break;
        case 'gemini':
          apiUrl = `/api/enterprises/${enterpriseId}/gemini-accounts/generate-auth-url`;
          break;
        default:
          toast.error(`不支持的平台: ${platform}`);
          return;
      }
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          state: `${platform}_${Date.now()}`,
          proxy: proxy.enabled ? proxy : null
        })
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          setAuthUrl(result.data.authUrl);
          // 保存 OAuth 参数用于后续回调
          setOauthParams(result.data.oauthParams);
        } else {
          toast.error(result.message || '生成授权链接失败');
        }
      } else {
        toast.error('生成授权链接失败');
      }
    } catch (error) {
      console.error('生成授权链接失败:', error);
      toast.error('生成授权链接失败');
    } finally {
      setLoading(false);
    }
  };

  // 复制授权链接
  const copyAuthUrl = async () => {
    if (!authUrl) return;
    
    try {
      await navigator.clipboard.writeText(authUrl);
      setCopied(true);
      toast.success('链接已复制到剪贴板');
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast.error('复制失败');
    }
  };

  // 处理OAuth认证
  const handleOAuthAuth = async () => {
    if (!authCode.trim()) {
      toast.error('请输入授权码');
      return;
    }

    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/enterprises/${enterpriseId}/oauth/callback`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          platform,
          code: authCode,
          oauthParams,
          proxy: proxy.enabled ? proxy : null
        })
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          // OAuth成功，调用回调
          onComplete(result.data);
        } else {
          toast.error(result.message || 'OAuth认证失败');
        }
      } else {
        toast.error('OAuth认证失败');
      }
    } catch (error) {
      console.error('OAuth认证失败:', error);
      toast.error('OAuth认证失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-blue-50 p-6 rounded-lg border border-blue-200">
      <div className="flex items-start gap-4">
        <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center flex-shrink-0">
          <Link className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1">
          <h4 className="font-semibold text-blue-900 mb-3">
            {platform === 'claude' ? 'Claude' : 'Gemini'} 账户授权
          </h4>
          <p className="text-sm text-blue-800 mb-4">
            请按照以下步骤完成 {platform === 'claude' ? 'Claude' : 'Gemini'} 账户的授权：
          </p>

          {platform === 'claude' ? (
            <div className="space-y-4">
              {/* 步骤1: 生成授权链接 */}
              <div className="bg-white/80 rounded-lg p-4 border border-blue-300">
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">
                    1
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-blue-900 mb-2">点击下方按钮生成授权链接</p>
                    {!authUrl ? (
                      <Button 
                        onClick={generateAuthUrl}
                        disabled={loading}
                        size="sm"
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
                            className="text-xs font-mono bg-gray-50 flex-1"
                          />
                          <Button 
                            variant="outline"
                            size="sm"
                            onClick={copyAuthUrl}
                            title="复制链接"
                          >
                            {copied ? (
                              <CheckCircle className="w-4 h-4 text-green-500" />
                            ) : (
                              <Copy className="w-4 h-4" />
                            )}
                          </Button>
                        </div>
                        <Button 
                          variant="ghost"
                          size="sm"
                          onClick={generateAuthUrl}
                        >
                          <RefreshCw className="w-4 h-4 mr-1" />
                          重新生成
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* 步骤2: 访问链接并授权 */}
              <div className="bg-white/80 rounded-lg p-4 border border-blue-300">
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">
                    2
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-blue-900 mb-2">在浏览器中打开链接并完成授权</p>
                    <p className="text-sm text-blue-700 mb-2">
                      请在新标签页中打开授权链接，登录您的 Claude 账户并授权。
                    </p>
                    {proxy.enabled && (
                      <div className="bg-yellow-50 p-3 rounded border border-yellow-300">
                        <p className="text-xs text-yellow-800">
                          <AlertTriangle className="w-3 h-3 inline mr-1" />
                          <strong>注意：</strong>如果您设置了代理，请确保浏览器也使用相同的代理访问授权页面。
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* 步骤3: 输入授权码 */}
              <div className="bg-white/80 rounded-lg p-4 border border-blue-300">
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">
                    3
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-blue-900 mb-2">输入授权码完成认证</p>
                    <p className="text-sm text-blue-700 mb-3">
                      完成授权后，页面会显示授权码，请复制并粘贴到下方输入框中。
                    </p>
                    <div className="space-y-3">
                      <Input
                        value={authCode}
                        onChange={(e) => setAuthCode(e.target.value)}
                        placeholder="请输入授权码..."
                        className="font-mono"
                      />
                      <Button 
                        onClick={handleOAuthAuth}
                        disabled={loading || !authCode.trim()}
                        size="sm"
                      >
                        {loading && <RefreshCw className="w-4 h-4 mr-2 animate-spin" />}
                        {loading ? '认证中...' : '完成认证'}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            // Gemini OAuth 流程
            <div className="bg-green-50 p-6 rounded-lg border border-green-200">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-green-500 rounded-lg flex items-center justify-center flex-shrink-0">
                  <i className="fas fa-robot text-white" />
                </div>
                <div className="flex-1">
                  <h4 className="font-semibold text-green-900 mb-3">Gemini 账户授权</h4>
                  <p className="text-sm text-green-800 mb-4">
                    请按照以下步骤完成 Gemini 账户的授权：
                  </p>

                  <div className="space-y-4">
                    {/* 步骤1: 生成授权链接 */}
                    <div className="bg-white/80 rounded-lg p-4 border border-green-300">
                      <div className="flex items-start gap-3">
                        <div className="w-6 h-6 bg-green-600 text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">
                          1
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-green-900 mb-2">点击下方按钮生成授权链接</p>
                          {!authUrl ? (
                            <Button 
                              onClick={generateAuthUrl}
                              disabled={loading}
                              size="sm"
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
                                  className="text-xs font-mono bg-gray-50 flex-1"
                                />
                                <Button 
                                  variant="outline"
                                  size="sm"
                                  onClick={copyAuthUrl}
                                  title="复制链接"
                                >
                                  {copied ? (
                                    <CheckCircle className="w-4 h-4 text-green-500" />
                                  ) : (
                                    <Copy className="w-4 h-4" />
                                  )}
                                </Button>
                              </div>
                              <Button 
                                variant="ghost"
                                size="sm"
                                onClick={generateAuthUrl}
                              >
                                <RefreshCw className="w-4 h-4 mr-1" />
                                重新生成
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* 步骤2: 访问链接并授权 */}
                    <div className="bg-white/80 rounded-lg p-4 border border-green-300">
                      <div className="flex items-start gap-3">
                        <div className="w-6 h-6 bg-green-600 text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">
                          2
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-green-900 mb-2">在浏览器中打开链接并完成授权</p>
                          <p className="text-sm text-green-700 mb-2">
                            请在新标签页中打开授权链接，登录您的 Gemini 账户并授权。
                          </p>
                          {proxy.enabled && (
                            <div className="bg-yellow-50 p-3 rounded border border-yellow-300">
                              <p className="text-xs text-yellow-800">
                                <AlertTriangle className="w-3 h-3 inline mr-1" />
                                <strong>注意：</strong>如果您设置了代理，请确保浏览器也使用相同的代理访问授权页面。
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* 步骤3: 输入授权码 */}
                    <div className="bg-white/80 rounded-lg p-4 border border-green-300">
                      <div className="flex items-start gap-3">
                        <div className="w-6 h-6 bg-green-600 text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">
                          3
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-green-900 mb-2">输入授权码完成认证</p>
                          <p className="text-sm text-green-700 mb-3">
                            完成授权后，粘贴从 Gemini 页面复制的 Authorization Code。
                          </p>
                          <div className="space-y-3">
                            <textarea
                              value={authCode}
                              onChange={(e) => setAuthCode(e.target.value)}
                              placeholder="粘贴从Gemini页面获取的Authorization Code..."
                              rows={3}
                              className="w-full resize-none font-mono text-sm border border-gray-300 rounded px-3 py-2"
                            />
                            <div className="text-xs text-gray-600">
                              <i className="fas fa-check-circle text-green-500 mr-1" />
                              请粘贴从Gemini页面复制的Authorization Code 
                            </div>
                            <Button 
                              onClick={handleOAuthAuth}
                              disabled={loading || !authCode.trim()}
                              size="sm"
                            >
                              {loading && <RefreshCw className="w-4 h-4 mr-2 animate-spin" />}
                              {loading ? '认证中...' : '完成认证'}
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

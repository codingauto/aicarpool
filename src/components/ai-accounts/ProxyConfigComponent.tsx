import React, { useState } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Server, Info, Eye, EyeOff } from 'lucide-react';
import { ProxyConfig } from '@/types/ai-account';

interface ProxyConfigComponentProps {
  proxy: ProxyConfig;
  onProxyChange: (proxy: ProxyConfig) => void;
}

export function ProxyConfigComponent({ proxy, onProxyChange }: ProxyConfigComponentProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [showProxyAuth, setShowProxyAuth] = useState(false);

  const updateProxy = (updates: Partial<ProxyConfig>) => {
    onProxyChange({ ...proxy, ...updates });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-semibold">代理设置 (可选)</Label>
        <div className="flex items-center space-x-2">
          <Checkbox 
            id="proxy-enabled"
            checked={proxy.enabled}
            onCheckedChange={(checked) => updateProxy({ enabled: checked === true })}
          />
          <Label htmlFor="proxy-enabled" className="text-sm">启用代理</Label>
        </div>
      </div>

      {proxy.enabled && (
        <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 space-y-4">
          <div className="flex items-start gap-3 mb-3">
            <div className="w-8 h-8 bg-gray-500 rounded-lg flex items-center justify-center flex-shrink-0">
              <Server className="w-4 h-4 text-white" />
            </div>
            <div className="flex-1">
              <p className="text-sm text-gray-700">
                配置代理以访问受限的网络资源。支持 SOCKS5 和 HTTP 代理。
              </p>
              <p className="text-xs text-gray-500 mt-1">
                请确保代理服务器稳定可用，否则会影响账户的正常使用。
              </p>
            </div>
          </div>

          <div>
            <Label className="text-sm font-medium">代理类型</Label>
            <Select 
              value={proxy.type} 
              onValueChange={(value) => updateProxy({ type: value as any })}
            >
              <SelectTrigger className="mt-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="socks5">SOCKS5</SelectItem>
                <SelectItem value="http">HTTP</SelectItem>
                <SelectItem value="https">HTTPS</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-sm font-medium">主机地址</Label>
              <Input
                value={proxy.host}
                onChange={(e) => updateProxy({ host: e.target.value })}
                placeholder="例如: 192.168.1.100"
                className="mt-2"
              />
            </div>
            <div>
              <Label className="text-sm font-medium">端口</Label>
              <Input
                type="number"
                value={proxy.port}
                onChange={(e) => updateProxy({ port: e.target.value })}
                placeholder="例如: 1080"
                className="mt-2"
              />
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="proxy-auth"
                checked={showProxyAuth}
                onCheckedChange={(checked) => setShowProxyAuth(checked === true)}
              />
              <Label htmlFor="proxy-auth" className="text-sm">需要身份验证</Label>
            </div>

            {showProxyAuth && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium">用户名</Label>
                  <Input
                    value={proxy.username}
                    onChange={(e) => updateProxy({ username: e.target.value })}
                    placeholder="代理用户名"
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label className="text-sm font-medium">密码</Label>
                  <div className="relative">
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      value={proxy.password}
                      onChange={(e) => updateProxy({ password: e.target.value })}
                      placeholder="代理密码"
                      className="mt-2 pr-10"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6 p-0"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
            <p className="text-xs text-blue-700">
              <Info className="w-3 h-3 inline mr-1" />
              <strong>提示：</strong>代理设置将用于所有与此账户相关的API请求。请确保代理服务器支持HTTPS流量转发。
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

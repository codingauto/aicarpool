'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Globe, 
  Eye, 
  EyeOff,
  Info
} from 'lucide-react';

export interface ProxyConfigData {
  enabled: boolean;
  type: 'socks5' | 'http' | 'https';
  host: string;
  port: string;
  username?: string;
  password?: string;
}

interface ProxyConfigProps {
  groupId?: string;
  value: ProxyConfigData;
  onChange: (config: ProxyConfigData) => void;
}

export default function ProxyConfig({ groupId, value, onChange }: ProxyConfigProps) {
  const [showPassword, setShowPassword] = useState(false);

  const handleFieldChange = (field: keyof ProxyConfigData, newValue: any) => {
    onChange({
      ...value,
      [field]: newValue
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-gray-700">代理设置 (可选)</h4>
        <div className="flex items-center space-x-2">
          <Switch
            checked={value.enabled}
            onCheckedChange={(enabled) => handleFieldChange('enabled', enabled)}
          />
          <Label>启用代理</Label>
        </div>
      </div>

      {value.enabled && (
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center flex-shrink-0">
                <Globe className="w-4 h-4 text-white" />
              </div>
              <div className="flex-1">
                <CardTitle className="text-base">代理服务器配置</CardTitle>
                <p className="text-sm text-gray-600 mt-1">
                  配置此账户的代理服务器设置，用于网络访问。
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* 代理类型选择 */}
            <div className="space-y-2">
              <Label>代理类型</Label>
              <Select 
                value={value.type} 
                onValueChange={(type: 'socks5' | 'http' | 'https') => handleFieldChange('type', type)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="socks5">SOCKS5</SelectItem>
                  <SelectItem value="http">HTTP</SelectItem>
                  <SelectItem value="https">HTTPS</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* 主机地址和端口 */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>主机地址</Label>
                <Input
                  value={value.host}
                  onChange={(e) => handleFieldChange('host', e.target.value)}
                  placeholder="例如: proxy.example.com"
                />
              </div>
              <div className="space-y-2">
                <Label>端口</Label>
                <Input
                  type="number"
                  min="1"
                  max="65535"
                  value={value.port}
                  onChange={(e) => handleFieldChange('port', e.target.value)}
                  placeholder="例如: 1080"
                />
              </div>
            </div>

            {/* 认证信息 */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>用户名（可选）</Label>
                <Input
                  value={value.username || ''}
                  onChange={(e) => handleFieldChange('username', e.target.value)}
                  placeholder="代理认证用户名"
                />
              </div>
              <div className="space-y-2">
                <Label>密码（可选）</Label>
                <div className="relative">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    value={value.password || ''}
                    onChange={(e) => handleFieldChange('password', e.target.value)}
                    placeholder="代理认证密码"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            </div>

            {/* 提示信息 */}
            <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
              <div className="flex items-start">
                <Info className="w-4 h-4 text-blue-600 mr-2 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-blue-800">
                  <div className="font-medium mb-1">代理配置说明</div>
                  <ul className="space-y-1 text-xs">
                    <li>• SOCKS5: 支持TCP和UDP流量，推荐用于Claude Code</li>
                    <li>• HTTP/HTTPS: 仅支持HTTP流量，适用于基本代理需求</li>
                    <li>• 如果代理服务器需要认证，请填写用户名和密码</li>
                    <li>• 代理配置将用于此账户的所有API请求</li>
                  </ul>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
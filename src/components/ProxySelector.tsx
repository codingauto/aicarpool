'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { 
  Server, 
  Globe, 
  CheckCircle, 
  AlertTriangle, 
  ExternalLink,
  Loader2,
  Plus
} from 'lucide-react';

interface IpProxyConfig {
  id: string;
  name: string;
  description?: string;
  proxyType: string;
  host: string;
  port: number;
  username?: string;
  password?: string;
  location?: string;
  isEnabled: boolean;
  status: string;
  currentConnections: number;
  maxConnections: number;
}

export interface ProxySelectorData {
  enabled: boolean;
  selectedProxyId?: string;
  // 兼容原有接口
  type: 'socks5' | 'http' | 'https';
  host: string;
  port: string;
  username?: string;
  password?: string;
}

interface ProxySelectorProps {
  groupId: string;
  value: ProxySelectorData;
  onChange: (config: ProxySelectorData) => void;
}

export default function ProxySelector({ groupId, value, onChange }: ProxySelectorProps) {
  const [proxies, setProxies] = useState<IpProxyConfig[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // 获取IP代理列表
  const fetchProxies = async () => {
    if (!groupId) return;
    
    setLoading(true);
    setError('');

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/groups/${groupId}/ip-proxy`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();
      if (data.success) {
        // 只显示已启用的代理
        const enabledProxies = data.data.filter((proxy: IpProxyConfig) => proxy.isEnabled);
        setProxies(enabledProxies);
      } else {
        setError(data.error || '获取代理列表失败');
      }
    } catch (error) {
      console.error('获取代理列表失败:', error);
      setError('网络错误，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProxies();
  }, [groupId]);

  // 处理代理选择
  const handleProxySelect = (proxyId: string) => {
    if (proxyId === 'none') {
      onChange({
        ...value,
        selectedProxyId: undefined,
        type: 'socks5',
        host: '',
        port: '',
        username: '',
        password: ''
      });
      return;
    }

    const selectedProxy = proxies.find(p => p.id === proxyId);
    if (selectedProxy) {
      onChange({
        ...value,
        selectedProxyId: proxyId,
        type: selectedProxy.proxyType as 'socks5' | 'http' | 'https',
        host: selectedProxy.host,
        port: selectedProxy.port.toString(),
        username: selectedProxy.username || '',
        password: selectedProxy.password || ''
      });
    }
  };

  // 获取选中的代理信息
  const selectedProxy = value.selectedProxyId 
    ? proxies.find(p => p.id === value.selectedProxyId)
    : null;

  // 获取代理状态徽章
  const getProxyStatusBadge = (proxy: IpProxyConfig) => {
    switch (proxy.status) {
      case 'online':
        return <Badge variant="default" className="text-green-800 bg-green-100"><CheckCircle className="mr-1 w-3 h-3" />在线</Badge>;
      case 'offline':
        return <Badge variant="destructive"><AlertTriangle className="mr-1 w-3 h-3" />离线</Badge>;
      default:
        return <Badge variant="secondary">未知</Badge>;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-gray-700">代理设置 (可选)</h4>
        <div className="flex items-center space-x-2">
          <Switch
            checked={value.enabled}
            onCheckedChange={(enabled) => onChange({ ...value, enabled })}
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
                <CardTitle className="text-base">选择代理服务器</CardTitle>
                <p className="text-sm text-gray-600 mt-1">
                  从已配置的IP代理中选择一个用于此账户的网络访问。
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* 代理选择下拉框 */}
            <div className="space-y-2">
              <Label>选择代理</Label>
              {loading ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  <span className="text-sm text-gray-500">加载代理列表...</span>
                </div>
              ) : error ? (
                <div className="text-sm text-red-600 bg-red-50 p-3 rounded border border-red-200">
                  {error}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={fetchProxies}
                    className="ml-2"
                  >
                    重试
                  </Button>
                </div>
              ) : (
                <Select 
                  value={value.selectedProxyId || 'none'} 
                  onValueChange={handleProxySelect}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="选择代理服务器" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">
                      <div className="flex items-center gap-2">
                        <Server className="w-4 h-4 text-gray-400" />
                        <span>不使用代理</span>
                      </div>
                    </SelectItem>
                    {proxies.length === 0 ? (
                      <SelectItem value="no-proxies" disabled>
                        <div className="flex items-center gap-2 text-gray-500">
                          <AlertTriangle className="w-4 h-4" />
                          <span>暂无可用代理</span>
                        </div>
                      </SelectItem>
                    ) : (
                      proxies.map((proxy) => (
                        <SelectItem key={proxy.id} value={proxy.id}>
                          <div className="flex items-center justify-between w-full">
                            <div className="flex items-center gap-2">
                              <Server className="w-4 h-4 text-blue-500" />
                              <div>
                                <div className="font-medium">{proxy.name}</div>
                                <div className="text-xs text-gray-500">
                                  {proxy.proxyType.toUpperCase()} • {proxy.host}:{proxy.port}
                                  {proxy.location && ` • ${proxy.location}`}
                                </div>
                              </div>
                            </div>
                          </div>
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* 选中代理的详细信息 */}
            {selectedProxy && (
              <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                <div className="flex items-center justify-between mb-3">
                  <h5 className="font-medium text-blue-900">代理详情</h5>
                  {getProxyStatusBadge(selectedProxy)}
                </div>
                <div className="space-y-2 text-sm">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-blue-700 font-medium">名称：</span>
                      <span className="text-blue-800">{selectedProxy.name}</span>
                    </div>
                    <div>
                      <span className="text-blue-700 font-medium">类型：</span>
                      <span className="text-blue-800">{selectedProxy.proxyType.toUpperCase()}</span>
                    </div>
                    <div>
                      <span className="text-blue-700 font-medium">地址：</span>
                      <span className="text-blue-800">{selectedProxy.host}:{selectedProxy.port}</span>
                    </div>
                    <div>
                      <span className="text-blue-700 font-medium">连接数：</span>
                      <span className="text-blue-800">
                        {selectedProxy.currentConnections}/{selectedProxy.maxConnections}
                      </span>
                    </div>
                  </div>
                  {selectedProxy.description && (
                    <div>
                      <span className="text-blue-700 font-medium">描述：</span>
                      <span className="text-blue-800">{selectedProxy.description}</span>
                    </div>
                  )}
                  {selectedProxy.location && (
                    <div>
                      <span className="text-blue-700 font-medium">位置：</span>
                      <span className="text-blue-800">{selectedProxy.location}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 无代理时的提示和管理入口 */}
            {proxies.length === 0 && !loading && !error && (
              <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 text-center">
                <Plus className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                <p className="text-sm text-gray-600 mb-3">
                  还没有配置代理服务器
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    // 跳转到IP代理管理页面
                    window.open(`/groups/${groupId}#ip-proxy`, '_blank');
                  }}
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  管理代理服务器
                </Button>
              </div>
            )}

            {/* 管理代理入口 */}
            {proxies.length > 0 && (
              <div className="flex justify-end">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    window.open(`/groups/${groupId}#ip-proxy`, '_blank');
                  }}
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  管理代理服务器
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
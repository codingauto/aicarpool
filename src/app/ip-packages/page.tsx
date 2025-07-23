'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AppHeader } from '@/components/layout/AppHeader';
import { 
  Globe, 
  Server, 
  Activity, 
  DollarSign, 
  Clock, 
  MapPin,
  CheckCircle,
  AlertCircle
} from 'lucide-react';

interface IpPackage {
  id: string;
  packageName: string;
  provider: string;
  type: 'residential' | 'datacenter' | 'mobile';
  pricing: {
    monthly: number;
    traffic: number;
    concurrent: number;
  };
  locations: string[];
  features: string[];
  status: 'available' | 'limited' | 'sold_out';
  description?: string;
}

interface Subscription {
  id: string;
  packageId: string;
  packageName: string;
  serverId?: string;
  serverName?: string;
  status: 'active' | 'expired' | 'suspended';
  startDate: Date;
  endDate: Date;
  usage: {
    totalTraffic: number;
    usedTraffic: number;
    concurrent: number;
    maxConcurrent: number;
  };
  proxy: {
    host: string;
    port: number;
    username: string;
    password: string;
  };
}

export default function IpPackagesPage() {
  const [packages, setPackages] = useState<IpPackage[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('browse');
  const router = useRouter();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        router.push('/auth/login');
        return;
      }

      const [packagesRes, subscriptionsRes] = await Promise.all([
        fetch('/api/ip-packages', {
          headers: { 'Authorization': `Bearer ${token}` },
        }),
        fetch('/api/ip-packages/subscriptions', {
          headers: { 'Authorization': `Bearer ${token}` },
        }),
      ]);

      const packagesData = await packagesRes.json();
      const subscriptionsData = await subscriptionsRes.json();

      if (packagesData.success) {
        setPackages(packagesData.data);
      }

      if (subscriptionsData.success) {
        setSubscriptions(subscriptionsData.data);
      }
    } catch (error) {
      console.error('获取数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubscribe = async (packageId: string, serverId?: string) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/ip-packages/subscribe', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ packageId, serverId }),
      });

      const data = await response.json();
      if (data.success) {
        await fetchData();
        alert('订阅成功！');
      } else {
        alert(`订阅失败: ${data.error}`);
      }
    } catch (error) {
      alert('网络错误，请稍后重试');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'available':
        return 'default';
      case 'limited':
        return 'secondary';
      case 'sold_out':
        return 'destructive';
      case 'active':
        return 'default';
      case 'expired':
        return 'destructive';
      case 'suspended':
        return 'secondary';
      default:
        return 'default';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'available':
        return '可订阅';
      case 'limited':
        return '库存有限';
      case 'sold_out':
        return '已售罄';
      case 'active':
        return '活跃';
      case 'expired':
        return '已过期';
      case 'suspended':
        return '已暂停';
      default:
        return status;
    }
  };

  const getPackageTypeText = (type: string) => {
    switch (type) {
      case 'residential':
        return '住宅IP';
      case 'datacenter':
        return '数据中心IP';
      case 'mobile':
        return '移动IP';
      default:
        return type;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-lg">加载中...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader showUserInfo={false} />

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="browse">浏览套餐</TabsTrigger>
            <TabsTrigger value="subscriptions">我的订阅</TabsTrigger>
          </TabsList>

          <TabsContent value="browse" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {packages.map((pkg) => (
                <Card key={pkg.id} className="relative">
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          <Globe className="h-5 w-5" />
                          {pkg.packageName}
                        </CardTitle>
                        <CardDescription>
                          {pkg.provider} · {getPackageTypeText(pkg.type)}
                        </CardDescription>
                      </div>
                      <Badge variant={getStatusColor(pkg.status)}>
                        {getStatusText(pkg.status)}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* 价格信息 */}
                    <div className="bg-blue-50 p-3 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-gray-600">月费</span>
                        <span className="text-lg font-bold text-blue-600">
                          ¥{pkg.pricing.monthly}
                        </span>
                      </div>
                      <div className="text-sm text-gray-600 space-y-1">
                        <div>流量: {pkg.pricing.traffic}GB/月</div>
                        <div>并发: {pkg.pricing.concurrent}个</div>
                      </div>
                    </div>

                    {/* 地区支持 */}
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <MapPin className="h-4 w-4 text-gray-500" />
                        <span className="text-sm font-medium">支持地区</span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {pkg.locations.slice(0, 3).map((location) => (
                          <Badge key={location} variant="outline" className="text-xs">
                            {location}
                          </Badge>
                        ))}
                        {pkg.locations.length > 3 && (
                          <Badge variant="outline" className="text-xs">
                            +{pkg.locations.length - 3}
                          </Badge>
                        )}
                      </div>
                    </div>

                    {/* 特性 */}
                    <div>
                      <div className="text-sm font-medium mb-2">特性</div>
                      <ul className="text-sm text-gray-600 space-y-1">
                        {pkg.features.slice(0, 3).map((feature, index) => (
                          <li key={index} className="flex items-center gap-2">
                            <CheckCircle className="h-3 w-3 text-green-500" />
                            {feature}
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* 操作按钮 */}
                    <Button
                      className="w-full"
                      disabled={pkg.status === 'sold_out'}
                      onClick={() => handleSubscribe(pkg.id)}
                    >
                      {pkg.status === 'sold_out' ? '已售罄' : '立即订阅'}
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="subscriptions" className="space-y-6">
            {subscriptions.length > 0 ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {subscriptions.map((sub) => (
                  <Card key={sub.id}>
                    <CardHeader>
                      <div className="flex justify-between items-start">
                        <div>
                          <CardTitle className="flex items-center gap-2">
                            <Server className="h-5 w-5" />
                            {sub.packageName}
                          </CardTitle>
                          <CardDescription>
                            {sub.serverName && `服务器: ${sub.serverName}`}
                          </CardDescription>
                        </div>
                        <Badge variant={getStatusColor(sub.status)}>
                          {getStatusText(sub.status)}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* 订阅信息 */}
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <div className="text-sm text-gray-500">开始时间</div>
                          <div className="font-medium">
                            {new Date(sub.startDate).toLocaleDateString('zh-CN')}
                          </div>
                        </div>
                        <div>
                          <div className="text-sm text-gray-500">到期时间</div>
                          <div className="font-medium">
                            {new Date(sub.endDate).toLocaleDateString('zh-CN')}
                          </div>
                        </div>
                      </div>

                      {/* 使用情况 */}
                      <div className="bg-gray-50 p-3 rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          <Activity className="h-4 w-4 text-gray-500" />
                          <span className="text-sm font-medium">使用情况</span>
                        </div>
                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span>流量使用</span>
                            <span>
                              {(sub.usage.usedTraffic / 1024).toFixed(1)}GB / 
                              {(sub.usage.totalTraffic / 1024).toFixed(1)}GB
                            </span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-blue-600 h-2 rounded-full"
                              style={{
                                width: `${Math.min(100, (sub.usage.usedTraffic / sub.usage.totalTraffic) * 100)}%`
                              }}
                            />
                          </div>
                          <div className="flex justify-between text-sm">
                            <span>并发连接</span>
                            <span>
                              {sub.usage.concurrent} / {sub.usage.maxConcurrent}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* 代理配置 */}
                      <div className="bg-blue-50 p-3 rounded-lg">
                        <div className="text-sm font-medium mb-2">代理配置</div>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div>
                            <span className="text-gray-500">代理主机:</span>
                            <div className="font-mono">{sub.proxy.host}</div>
                          </div>
                          <div>
                            <span className="text-gray-500">端口号:</span>
                            <div className="font-mono">{sub.proxy.port}</div>
                          </div>
                          <div>
                            <span className="text-gray-500">账号:</span>
                            <div className="font-mono">{sub.proxy.username}</div>
                          </div>
                          <div>
                            <span className="text-gray-500">密码:</span>
                            <div className="font-mono">••••••••</div>
                          </div>
                        </div>
                      </div>

                      {/* 操作按钮 */}
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" className="flex-1">
                          查看详情
                        </Button>
                        {sub.status === 'active' && (
                          <Button variant="outline" size="sm" className="flex-1">
                            续费
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  暂无订阅
                </h3>
                <p className="text-gray-500 mb-4">
                  您还没有订阅任何IP代理套餐
                </p>
                <Button onClick={() => setActiveTab('browse')}>
                  浏览套餐
                </Button>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
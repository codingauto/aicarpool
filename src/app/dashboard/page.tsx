'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { UserProfile } from '@/components/dashboard/user-profile';
import { UsageStats } from '@/components/dashboard/usage-stats';
import { EnhancedUsageStats } from '@/components/dashboard/enhanced-usage-stats';
import { User } from '@/types';

interface UserData extends User {
  groups: Array<{
    id: string;
    name: string;
    description?: string;
    status: string;
    createdAt: Date;
    memberRole: string;
    joinedAt: Date;
  }>;
  apiKeys: Array<{
    id: string;
    name: string;
    aiServiceId: string;
    quotaLimit?: bigint;
    quotaUsed: bigint;
    status: string;
    lastUsedAt?: Date;
    createdAt: Date;
  }>;
}

export default function DashboardPage() {
  const [user, setUser] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const router = useRouter();

  const fetchUserData = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        router.push('/auth/login');
        return;
      }

      const response = await fetch('/api/user/profile', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (data.success) {
        setUser(data.data);
      } else {
        if (response.status === 401) {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          router.push('/auth/login');
        } else {
          setError(data.error || '获取用户数据失败');
        }
      }
    } catch (error) {
      setError('网络错误，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUserData();
  }, []);


  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-lg">加载中...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-500 mb-4">{error}</div>
          <Button onClick={fetchUserData}>重试</Button>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="p-6">
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">仪表盘</h1>
        <p className="text-gray-600 mt-1">查看您的使用统计和拼车组信息</p>
      </div>

      {/* Main Content */}
      <div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Profile and Groups */}
          <div className="lg:col-span-1 space-y-6">
            {/* User Profile */}
            <UserProfile user={user} onUpdate={fetchUserData} />

            {/* Groups */}
            <Card>
              <CardHeader>
                <CardTitle>我的拼车组</CardTitle>
                <CardDescription>
                  您参与的拼车组列表
                </CardDescription>
              </CardHeader>
              <CardContent>
                {user.groups.length > 0 ? (
                  <div className="space-y-3">
                    {user.groups.map((group) => (
                      <div key={group.id} className="p-3 border rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-semibold">{group.name}</h4>
                          <Badge variant={group.memberRole === 'admin' ? 'default' : 'secondary'}>
                            {group.memberRole === 'admin' ? '管理员' : '成员'}
                          </Badge>
                        </div>
                        {group.description && (
                          <p className="text-sm text-gray-600 mb-2">
                            {group.description}
                          </p>
                        )}
                        <div className="text-xs text-gray-500">
                          加入于 {new Date(group.joinedAt).toLocaleDateString('zh-CN')}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-gray-500 mb-4">您还没有加入任何拼车组</p>
                    <Button size="sm" onClick={() => router.push('/groups')}>创建拼车组</Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* API Keys */}
            <Card>
              <CardHeader>
                <CardTitle>API密钥</CardTitle>
                <CardDescription>
                  您的API密钥列表
                </CardDescription>
              </CardHeader>
              <CardContent>
                {user.apiKeys.length > 0 ? (
                  <div className="space-y-3">
                    {user.apiKeys.map((apiKey) => (
                      <div key={apiKey.id} className="p-3 border rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-semibold">{apiKey.name}</h4>
                          <Badge variant={apiKey.status === 'active' ? 'default' : 'secondary'}>
                            {apiKey.status === 'active' ? '活跃' : '禁用'}
                          </Badge>
                        </div>
                        <div className="text-sm text-gray-600">
                          配额: {apiKey.quotaUsed.toString()} / {apiKey.quotaLimit?.toString() || '无限制'}
                        </div>
                        <div className="text-xs text-gray-500">
                          {apiKey.lastUsedAt 
                            ? `最后使用: ${new Date(apiKey.lastUsedAt).toLocaleDateString('zh-CN')}`
                            : '从未使用'
                          }
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-gray-500 mb-4">您还没有创建任何API密钥</p>
                    <Button size="sm">创建API密钥</Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Enhanced Usage Stats */}
          <div className="lg:col-span-2">
            <EnhancedUsageStats 
              title="个人使用统计"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Users, Key, Activity } from 'lucide-react';

interface Group {
  id: string;
  name: string;
  description?: string;
  maxMembers: number;
  status: string;
  memberRole: string;
  joinedAt: string;
  createdAt: string;
  createdBy: {
    id: string;
    name: string;
    email: string;
  };
  members: Array<{
    id: string;
    role: string;
    user: {
      id: string;
      name: string;
      email: string;
      avatar?: string;
    };
  }>;
  aiServices: Array<{
    id: string;
    isEnabled: boolean;
    aiService: {
      id: string;
      serviceName: string;
      displayName: string;
    };
  }>;
  stats: {
    memberCount: number;
    apiKeyCount: number;
  };
}

export function GroupList() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // 创建拼车组相关状态
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState('');
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDescription, setNewGroupDescription] = useState('');
  const [newGroupMaxMembers, setNewGroupMaxMembers] = useState(5);

  const fetchGroups = async () => {
    setLoading(true);
    setError('');

    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/groups', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (data.success) {
        setGroups(data.data);
      } else {
        setError(data.error || '获取拼车组列表失败');
      }
    } catch (error) {
      setError('网络错误，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateLoading(true);
    setCreateError('');

    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/groups', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: newGroupName,
          description: newGroupDescription || undefined,
          maxMembers: newGroupMaxMembers,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setShowCreateDialog(false);
        setNewGroupName('');
        setNewGroupDescription('');
        setNewGroupMaxMembers(5);
        fetchGroups(); // 刷新列表
      } else {
        setCreateError(data.error || '创建拼车组失败');
      }
    } catch (error) {
      setCreateError('网络错误，请稍后重试');
    } finally {
      setCreateLoading(false);
    }
  };

  useEffect(() => {
    fetchGroups();
  }, []);

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="text-gray-500">加载中...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <div className="text-red-500 mb-4">{error}</div>
        <Button onClick={fetchGroups}>重试</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">我的拼车组</h2>
          <p className="text-gray-600">管理您参与的AI工具拼车组</p>
        </div>
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              创建拼车组
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>创建新拼车组</DialogTitle>
              <DialogDescription>
                创建一个新的AI工具拼车组，邀请其他用户一起使用AI服务
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreateGroup} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="groupName">拼车组名称</Label>
                <Input
                  id="groupName"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  required
                  disabled={createLoading}
                  placeholder="请输入拼车组名称"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="groupDescription">描述（可选）</Label>
                <Textarea
                  id="groupDescription"
                  value={newGroupDescription}
                  onChange={(e) => setNewGroupDescription(e.target.value)}
                  disabled={createLoading}
                  placeholder="请输入拼车组描述"
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="maxMembers">最大成员数</Label>
                <Input
                  id="maxMembers"
                  type="number"
                  min={2}
                  max={20}
                  value={newGroupMaxMembers}
                  onChange={(e) => setNewGroupMaxMembers(parseInt(e.target.value))}
                  required
                  disabled={createLoading}
                />
              </div>
              {createError && (
                <div className="text-red-500 text-sm">{createError}</div>
              )}
              <div className="flex space-x-2">
                <Button type="submit" disabled={createLoading}>
                  {createLoading ? '创建中...' : '创建'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowCreateDialog(false)}
                  disabled={createLoading}
                >
                  取消
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Groups Grid */}
      {groups.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {groups.map((group) => (
            <Card key={group.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{group.name}</CardTitle>
                  <Badge variant={group.memberRole === 'admin' ? 'default' : 'secondary'}>
                    {group.memberRole === 'admin' ? '管理员' : '成员'}
                  </Badge>
                </div>
                {group.description && (
                  <CardDescription>{group.description}</CardDescription>
                )}
              </CardHeader>
              <CardContent className="space-y-4">
                {/* 统计信息 */}
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <div className="flex items-center justify-center mb-1">
                      <Users className="w-4 h-4 text-blue-600" />
                    </div>
                    <div className="text-sm font-semibold">
                      {group.stats.memberCount}/{group.maxMembers}
                    </div>
                    <div className="text-xs text-gray-600">成员</div>
                  </div>
                  <div>
                    <div className="flex items-center justify-center mb-1">
                      <Key className="w-4 h-4 text-green-600" />
                    </div>
                    <div className="text-sm font-semibold">{group.stats.apiKeyCount}</div>
                    <div className="text-xs text-gray-600">API密钥</div>
                  </div>
                  <div>
                    <div className="flex items-center justify-center mb-1">
                      <Activity className="w-4 h-4 text-purple-600" />
                    </div>
                    <div className="text-sm font-semibold">{group.aiServices.length}</div>
                    <div className="text-xs text-gray-600">AI服务</div>
                  </div>
                </div>

                {/* AI服务列表 */}
                {group.aiServices.length > 0 && (
                  <div>
                    <div className="text-sm font-medium mb-2">已配置的AI服务：</div>
                    <div className="flex flex-wrap gap-1">
                      {group.aiServices.map((service) => (
                        <Badge key={service.id} variant="outline" className="text-xs">
                          {service.aiService.displayName}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* 操作按钮 */}
                <div className="pt-4 border-t">
                  <Link href={`/groups/${group.id}`}>
                    <Button className="w-full" size="sm">
                      查看详情
                    </Button>
                  </Link>
                </div>

                {/* 元信息 */}
                <div className="text-xs text-gray-500 pt-2 border-t">
                  <div>创建者：{group.createdBy.name}</div>
                  <div>
                    加入时间：{new Date(group.joinedAt).toLocaleDateString('zh-CN')}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center py-16">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Users className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            还没有拼车组
          </h3>
          <p className="text-gray-600 mb-6">
            创建您的第一个拼车组，或等待其他用户的邀请
          </p>
          <Button onClick={() => setShowCreateDialog(true)}>
            <Plus className="w-4 h-4 mr-2" />
            创建拼车组
          </Button>
        </div>
      )}
    </div>
  );
}
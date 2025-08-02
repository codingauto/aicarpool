'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Users, 
  Settings, 
  Share, 
  BarChart3,
  Zap,
  DollarSign,
  Calendar,
  Crown,
  UserPlus,
  Activity
} from 'lucide-react';

interface CarpoolGroup {
  id: string;
  name: string;
  organizationType: string;
  creationTemplate: string;
  uiTheme: string;
  featureSet: any;
  createdAt: string;
  settings: any;
  memberCount: number;
  userRole: string;
}

export default function CarpoolGroupDetailPage() {
  const router = useRouter();
  const params = useParams();
  const groupId = params.groupId as string;
  
  const [group, setGroup] = useState<CarpoolGroup | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    loadGroupData();
  }, [groupId]);

  const loadGroupData = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        router.push('/auth/login');
        return;
      }

      // 获取拼车组详情
      const response = await fetch(`/api/carpool-groups/${groupId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setGroup(data.data);
        } else {
          setError(data.error || '获取拼车组信息失败');
        }
      } else {
        if (response.status === 401) {
          router.push('/auth/login');
        } else if (response.status === 403) {
          setError('您没有权限访问此拼车组');
        } else {
          setError('获取拼车组信息失败');
        }
      }
    } catch (error) {
      setError('网络错误，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  const handleInviteMembers = () => {
    // TODO: 实现邀请成员功能
    alert('邀请成员功能开发中...');
  };

  const handleShareGroup = () => {
    // TODO: 实现分享拼车组功能
    alert('分享功能开发中...');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="text-lg text-gray-600">加载拼车组信息...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Alert variant="destructive" className="max-w-md">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
          <Button onClick={() => router.back()} className="mt-4">
            返回
          </Button>
        </div>
      </div>
    );
  }

  if (!group) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 顶部导航 */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center mr-3">
                <span className="text-xl">🚗</span>
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">{group.name}</h1>
                <div className="flex items-center space-x-2">
                  <Badge variant="secondary" className="text-xs">
                    拼车组
                  </Badge>
                  {group.userRole === 'owner' && (
                    <Badge className="text-xs bg-yellow-100 text-yellow-800">
                      <Crown className="w-3 h-3 mr-1" />
                      组长
                    </Badge>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <Button onClick={handleInviteMembers} size="sm">
                <UserPlus className="w-4 h-4 mr-2" />
                邀请成员
              </Button>
              <Button onClick={handleShareGroup} variant="outline" size="sm">
                <Share className="w-4 h-4 mr-2" />
                分享
              </Button>
              {group.userRole === 'owner' && (
                <Button variant="outline" size="sm" onClick={() => router.push(`/carpool-groups/${groupId}/settings`)}>
                  <Settings className="w-4 h-4 mr-2" />
                  设置
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 主要内容 */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* 左侧主要信息 */}
          <div className="lg:col-span-2 space-y-6">
            {/* 拼车组概览 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Activity className="w-5 h-5 mr-2" />
                  拼车组概览
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="text-center">
                    <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-2">
                      <Users className="w-6 h-6 text-blue-600" />
                    </div>
                    <div className="text-2xl font-bold text-gray-900">{group.memberCount || 1}</div>
                    <div className="text-sm text-gray-500">活跃成员</div>
                  </div>
                  
                  <div className="text-center">
                    <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-2">
                      <Zap className="w-6 h-6 text-green-600" />
                    </div>
                    <div className="text-2xl font-bold text-gray-900">
                      {group.featureSet?.selectedServices?.length || 0}
                    </div>
                    <div className="text-sm text-gray-500">AI服务</div>
                  </div>
                  
                  <div className="text-center">
                    <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-2">
                      <DollarSign className="w-6 h-6 text-purple-600" />
                    </div>
                    <div className="text-2xl font-bold text-gray-900">
                      ${group.featureSet?.budget || '100'}
                    </div>
                    <div className="text-sm text-gray-500">月预算</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* AI服务状态 */}
            <Card>
              <CardHeader>
                <CardTitle>AI服务状态</CardTitle>
                <CardDescription>
                  当前拼车组使用的AI编程工具服务
                </CardDescription>
              </CardHeader>
              <CardContent>
                {group.featureSet?.selectedServices?.length > 0 ? (
                  <div className="grid gap-4">
                    {group.featureSet.selectedServices.map((serviceId: string) => {
                      const serviceNames: Record<string, string> = {
                        'claude': 'Claude Code',
                        'openai': 'OpenAI GPT-4',
                        'gemini': 'Google Gemini',
                        'cursor': 'Cursor Pro',
                        'github': 'GitHub Copilot'
                      };
                      
                      return (
                        <div key={serviceId} className="flex items-center justify-between p-4 border rounded-lg">
                          <div className="flex items-center space-x-3">
                            <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
                              <span className="text-sm">🤖</span>
                            </div>
                            <div>
                              <div className="font-medium">{serviceNames[serviceId] || serviceId}</div>
                              <div className="text-sm text-gray-500">等待绑定账号</div>
                            </div>
                          </div>
                          <Badge variant="outline" className="text-gray-500">
                            未配置
                          </Badge>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <div className="text-gray-500 mb-4">还没有选择AI服务</div>
                    <Button size="sm" onClick={() => router.push(`/carpool-groups/${groupId}/settings`)}>
                      配置AI服务
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* 使用统计 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <BarChart3 className="w-5 h-5 mr-2" />
                  使用统计
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8">
                  <div className="text-gray-500 mb-4">暂无使用数据</div>
                  <div className="text-sm text-gray-400">
                    配置AI账号后开始记录使用统计
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 右侧信息面板 */}
          <div className="space-y-6">
            {/* 拼车组信息 */}
            <Card>
              <CardHeader>
                <CardTitle>拼车组信息</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="text-sm text-gray-500">创建时间</div>
                  <div className="flex items-center mt-1">
                    <Calendar className="w-4 h-4 text-gray-400 mr-2" />
                    <span className="text-sm">
                      {new Date(group.createdAt).toLocaleDateString('zh-CN')}
                    </span>
                  </div>
                </div>
                
                {group.settings?.description && (
                  <div>
                    <div className="text-sm text-gray-500">描述</div>
                    <div className="text-sm mt-1">{group.settings.description}</div>
                  </div>
                )}
                
                <div>
                  <div className="text-sm text-gray-500">预期成员数</div>
                  <div className="text-sm mt-1">{group.featureSet?.maxMembers || 5}人</div>
                </div>
                
                <div>
                  <div className="text-sm text-gray-500">您的角色</div>
                  <div className="text-sm mt-1">
                    {group.userRole === 'owner' ? '拼车组长' : '拼车成员'}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 快捷操作 */}
            <Card>
              <CardHeader>
                <CardTitle>快捷操作</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button 
                  onClick={() => router.push(`/carpool-groups/${groupId}/members`)}
                  variant="outline" 
                  className="w-full justify-start"
                >
                  <Users className="w-4 h-4 mr-2" />
                  管理成员
                </Button>
                
                <Button 
                  onClick={() => router.push(`/carpool-groups/${groupId}/accounts`)}
                  variant="outline" 
                  className="w-full justify-start"
                >
                  <Zap className="w-4 h-4 mr-2" />
                  绑定AI账号
                </Button>
                
                <Button 
                  onClick={() => router.push(`/carpool-groups/${groupId}/stats`)}
                  variant="outline" 
                  className="w-full justify-start"
                >
                  <BarChart3 className="w-4 h-4 mr-2" />
                  查看统计
                </Button>
                
                {group.userRole === 'owner' && (
                  <Button 
                    onClick={() => router.push(`/carpool-groups/${groupId}/settings`)}
                    variant="outline" 
                    className="w-full justify-start"
                  >
                    <Settings className="w-4 h-4 mr-2" />
                    拼车组设置
                  </Button>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
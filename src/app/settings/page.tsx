'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ChangePasswordModal } from '@/components/account/change-password-modal';
import { 
  User, 
  Lock, 
  Mail, 
  Calendar,
  Shield,
  Settings,
  ChevronLeft
} from 'lucide-react';
import { toast } from '@/components/ui/toast';

interface UserInfo {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
  updatedAt: string;
  enterprises?: any[];
  groups?: any[];
}

export default function SettingsPage() {
  const router = useRouter();
  const [user, setUser] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileData, setProfileData] = useState({
    name: '',
    email: ''
  });

  useEffect(() => {
    fetchUserInfo();
  }, []);

  const fetchUserInfo = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        router.push('/auth/login');
        return;
      }

      const response = await fetch('/api/user/profile', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setUser(data.data);
          setProfileData({
            name: data.data.name || '',
            email: data.data.email || ''
          });
        }
      } else if (response.status === 401) {
        router.push('/auth/login');
      }
    } catch (error) {
      console.error('获取用户信息失败:', error);
      toast.error('获取用户信息失败', '请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProfile = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/user/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: profileData.name
        })
      });

      const data = await response.json();

      if (data.success) {
        toast.success('保存成功', '个人信息已更新');
        setUser(prev => prev ? { ...prev, name: profileData.name } : null);
        setEditingProfile(false);
        
        // 更新本地存储的用户信息
        const storedUser = localStorage.getItem('user');
        if (storedUser) {
          const userObj = JSON.parse(storedUser);
          userObj.name = profileData.name;
          localStorage.setItem('user', JSON.stringify(userObj));
        }
      } else {
        toast.error('保存失败', data.message || '请稍后重试');
      }
    } catch (error) {
      console.error('保存个人信息失败:', error);
      toast.error('保存失败', '网络错误，请稍后重试');
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getRoleBadge = (role: string) => {
    const roleMap: Record<string, { label: string; className: string }> = {
      admin: { label: '管理员', className: 'bg-red-100 text-red-700' },
      enterprise_admin: { label: '企业管理员', className: 'bg-blue-100 text-blue-700' },
      user: { label: '普通用户', className: 'bg-gray-100 text-gray-700' }
    };
    
    const roleInfo = roleMap[role] || roleMap.user;
    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${roleInfo.className}`}>
        {roleInfo.label}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">加载中...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">无法加载用户信息</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto p-6">
        {/* 头部 */}
        <div className="mb-6">
          <Button
            variant="ghost"
            onClick={() => router.back()}
            className="mb-4"
          >
            <ChevronLeft className="w-4 h-4 mr-2" />
            返回
          </Button>
          <div className="flex items-center gap-3">
            <Settings className="w-8 h-8 text-gray-700" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">账号设置</h1>
              <p className="text-gray-500">管理您的账号信息和安全设置</p>
            </div>
          </div>
        </div>

        {/* 主内容 */}
        <Tabs defaultValue="profile" className="space-y-6">
          <TabsList>
            <TabsTrigger value="profile">个人信息</TabsTrigger>
            <TabsTrigger value="security">安全设置</TabsTrigger>
            <TabsTrigger value="account">账号信息</TabsTrigger>
          </TabsList>

          {/* 个人信息标签页 */}
          <TabsContent value="profile">
            <Card>
              <CardHeader>
                <CardTitle>个人信息</CardTitle>
                <CardDescription>更新您的个人资料信息</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">姓名</Label>
                  <div className="flex gap-2">
                    <Input
                      id="name"
                      value={profileData.name}
                      onChange={(e) => setProfileData(prev => ({ ...prev, name: e.target.value }))}
                      disabled={!editingProfile}
                      placeholder="请输入姓名"
                    />
                    {!editingProfile ? (
                      <Button
                        variant="outline"
                        onClick={() => setEditingProfile(true)}
                      >
                        编辑
                      </Button>
                    ) : (
                      <>
                        <Button
                          variant="outline"
                          onClick={() => {
                            setEditingProfile(false);
                            setProfileData({
                              name: user.name || '',
                              email: user.email || ''
                            });
                          }}
                        >
                          取消
                        </Button>
                        <Button onClick={handleSaveProfile}>
                          保存
                        </Button>
                      </>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">邮箱</Label>
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-gray-400" />
                    <Input
                      id="email"
                      value={profileData.email}
                      disabled
                      className="bg-gray-50"
                    />
                  </div>
                  <p className="text-sm text-gray-500">邮箱地址不可修改</p>
                </div>

                <div className="space-y-2">
                  <Label>角色</Label>
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-gray-400" />
                    {getRoleBadge(user.role)}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* 安全设置标签页 */}
          <TabsContent value="security">
            <Card>
              <CardHeader>
                <CardTitle>安全设置</CardTitle>
                <CardDescription>管理您的账号安全</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <Lock className="w-5 h-5 text-gray-500" />
                      <div>
                        <h3 className="font-medium">密码</h3>
                        <p className="text-sm text-gray-500">定期更改密码以保护账号安全</p>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      onClick={() => setShowChangePassword(true)}
                    >
                      修改密码
                    </Button>
                  </div>

                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <h4 className="font-medium text-blue-900 mb-2">安全建议</h4>
                    <ul className="space-y-1 text-sm text-blue-700">
                      <li>• 使用强密码，包含大小写字母、数字和特殊字符</li>
                      <li>• 定期更改密码，建议每3个月更新一次</li>
                      <li>• 不要在其他网站使用相同的密码</li>
                      <li>• 不要将密码告诉他人或写在容易被发现的地方</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* 账号信息标签页 */}
          <TabsContent value="account">
            <Card>
              <CardHeader>
                <CardTitle>账号信息</CardTitle>
                <CardDescription>查看您的账号详细信息</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>用户ID</Label>
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-gray-400" />
                      <span className="text-sm font-mono bg-gray-100 px-2 py-1 rounded">
                        {user.id}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>注册时间</Label>
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-gray-400" />
                      <span className="text-sm">
                        {formatDate(user.createdAt)}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>最后更新</Label>
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-gray-400" />
                      <span className="text-sm">
                        {formatDate(user.updatedAt)}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>账号状态</Label>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      活跃
                    </span>
                  </div>
                </div>

                {/* 关联信息 */}
                {(user.enterprises && user.enterprises.length > 0) && (
                  <div className="pt-4 border-t">
                    <h4 className="font-medium mb-2">关联企业</h4>
                    <div className="space-y-2">
                      {user.enterprises.map((enterprise: any) => (
                        <div key={enterprise.id} className="text-sm text-gray-600">
                          • {enterprise.name}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {(user.groups && user.groups.length > 0) && (
                  <div className="pt-4 border-t">
                    <h4 className="font-medium mb-2">所属拼车组</h4>
                    <div className="space-y-2">
                      {user.groups.map((group: any) => (
                        <div key={group.id} className="text-sm text-gray-600">
                          • {group.name}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* 修改密码弹窗 */}
      <ChangePasswordModal
        open={showChangePassword}
        onClose={() => setShowChangePassword(false)}
      />
    </div>
  );
}
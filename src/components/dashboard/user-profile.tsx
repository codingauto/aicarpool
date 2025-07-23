'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { User } from '@/types';

interface UserProfileProps {
  user: User;
  onUpdate: () => void;
}

export function UserProfile({ user, onUpdate }: UserProfileProps) {
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState(user.name);
  const [avatar, setAvatar] = useState(user.avatar || '');
  const [error, setError] = useState('');

  // 修改密码相关状态
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState('');

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/user/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: name !== user.name ? name : undefined,
          avatar: avatar !== user.avatar ? avatar : undefined,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setEditing(false);
        onUpdate();
      } else {
        setError(data.error || '更新失败');
      }
    } catch (error) {
      setError('网络错误，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordLoading(true);
    setPasswordError('');

    if (newPassword !== confirmPassword) {
      setPasswordError('两次输入的密码不一致');
      setPasswordLoading(false);
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/user/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setShowChangePassword(false);
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        alert('密码修改成功');
      } else {
        setPasswordError(data.error || '修改密码失败');
      }
    } catch (error) {
      setPasswordError('网络错误，请稍后重试');
    } finally {
      setPasswordLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>个人档案</CardTitle>
        <CardDescription>
          管理您的账户信息和设置
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* 基本信息 */}
        <div className="flex items-center space-x-4">
          <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center">
            {avatar ? (
              <img src={avatar} alt="Avatar" className="w-16 h-16 rounded-full object-cover" />
            ) : (
              <span className="text-xl font-semibold text-gray-600">
                {user.name.charAt(0).toUpperCase()}
              </span>
            )}
          </div>
          <div>
            <h3 className="text-lg font-semibold">{user.name}</h3>
            <p className="text-gray-600">{user.email}</p>
            <div className="flex items-center space-x-2 mt-1">
              <Badge variant={user.role === 'admin' ? 'default' : 'secondary'}>
                {user.role === 'admin' ? '管理员' : '用户'}
              </Badge>
              <Badge variant={user.status === 'active' ? 'default' : 'destructive'}>
                {user.status === 'active' ? '活跃' : '禁用'}
              </Badge>
              {user.emailVerified && (
                <Badge variant="outline">邮箱已验证</Badge>
              )}
            </div>
          </div>
        </div>

        {/* 编辑表单 */}
        {editing ? (
          <form onSubmit={handleUpdateProfile} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">姓名</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                disabled={loading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="avatar">头像URL</Label>
              <Input
                id="avatar"
                type="url"
                value={avatar}
                onChange={(e) => setAvatar(e.target.value)}
                disabled={loading}
                placeholder="https://example.com/avatar.jpg"
              />
            </div>
            {error && (
              <div className="text-red-500 text-sm">{error}</div>
            )}
            <div className="flex space-x-2">
              <Button type="submit" disabled={loading}>
                {loading ? '保存中...' : '保存'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setEditing(false);
                  setName(user.name);
                  setAvatar(user.avatar || '');
                  setError('');
                }}
                disabled={loading}
              >
                取消
              </Button>
            </div>
          </form>
        ) : (
          <div className="flex space-x-2">
            <Button onClick={() => setEditing(true)}>
              编辑档案
            </Button>
            <Dialog open={showChangePassword} onOpenChange={setShowChangePassword}>
              <DialogTrigger asChild>
                <Button variant="outline">修改密码</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>修改密码</DialogTitle>
                  <DialogDescription>
                    请输入当前密码和新密码
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleChangePassword} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="currentPassword">当前密码</Label>
                    <Input
                      id="currentPassword"
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      required
                      disabled={passwordLoading}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="newPassword">新密码</Label>
                    <Input
                      id="newPassword"
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                      disabled={passwordLoading}
                      placeholder="至少6个字符"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">确认新密码</Label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      disabled={passwordLoading}
                    />
                  </div>
                  {passwordError && (
                    <div className="text-red-500 text-sm">{passwordError}</div>
                  )}
                  <div className="flex space-x-2">
                    <Button type="submit" disabled={passwordLoading}>
                      {passwordLoading ? '修改中...' : '修改密码'}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setShowChangePassword(false)}
                      disabled={passwordLoading}
                    >
                      取消
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        )}

        {/* 账户信息 */}
        <div className="pt-4 border-t">
          <h4 className="font-semibold mb-2">账户信息</h4>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-600">注册时间：</span>
              <span>{new Date(user.createdAt).toLocaleDateString('zh-CN')}</span>
            </div>
            <div>
              <span className="text-gray-600">最后更新：</span>
              <span>{new Date(user.updatedAt).toLocaleDateString('zh-CN')}</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
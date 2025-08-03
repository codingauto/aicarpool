'use client';

/**
 * 用户邀请对话框组件
 * 
 * 功能：
 * - 邀请新用户加入企业
 * - 设置用户角色
 * - 批量邀请
 * - 邀请链接生成
 */

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { 
  Mail,
  Users,
  Send,
  Copy,
  Link,
  Plus,
  X,
  UserPlus,
  Shield,
  Crown,
  UserCheck,
  AlertCircle,
  Check
} from 'lucide-react';

interface UserInviteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  enterpriseId: string;
  availableRoles: Array<{
    key: string;
    name: string;
    permissions: string[];
  }>;
  onInviteSuccess: () => void;
}

interface InviteUser {
  id: string;
  email: string;
  role: string;
  department?: string;
}

export function UserInviteDialog({
  open,
  onOpenChange,
  enterpriseId,
  availableRoles,
  onInviteSuccess
}: UserInviteDialogProps) {
  const [inviteUsers, setInviteUsers] = useState<InviteUser[]>([
    { id: '1', email: '', role: 'member' }
  ]);
  const [inviteMessage, setInviteMessage] = useState('');
  const [inviteLink, setInviteLink] = useState('');
  const [inviteLinkRole, setInviteLinkRole] = useState('member');
  const [sending, setSending] = useState(false);
  const [generatingLink, setGeneratingLink] = useState(false);

  const addInviteUser = () => {
    const newUser: InviteUser = {
      id: Date.now().toString(),
      email: '',
      role: 'member'
    };
    setInviteUsers([...inviteUsers, newUser]);
  };

  const removeInviteUser = (id: string) => {
    if (inviteUsers.length > 1) {
      setInviteUsers(inviteUsers.filter(user => user.id !== id));
    }
  };

  const updateInviteUser = (id: string, field: keyof InviteUser, value: string) => {
    setInviteUsers(inviteUsers.map(user => 
      user.id === id ? { ...user, [field]: value } : user
    ));
  };

  const handleSendInvites = async () => {
    setSending(true);
    try {
      const headers: HeadersInit = {
        'Content-Type': 'application/json'
      };

      // 生产环境下添加认证头
      if (process.env.NODE_ENV !== 'development') {
        const token = localStorage.getItem('token');
        if (token) {
          headers.Authorization = `Bearer ${token}`;
        }
      }

      const validUsers = inviteUsers.filter(user => user.email.trim());
      
      for (const user of validUsers) {
        const response = await fetch(`/api/enterprises/${enterpriseId}/invites`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            email: user.email,
            role: user.role,
            department: user.department,
            message: inviteMessage
          })
        });

        if (!response.ok) {
          console.error(`邀请 ${user.email} 失败`);
        }
      }

      onInviteSuccess();
      onOpenChange(false);
      
      // 重置表单
      setInviteUsers([{ id: '1', email: '', role: 'member' }]);
      setInviteMessage('');
    } catch (error) {
      console.error('发送邀请失败:', error);
    } finally {
      setSending(false);
    }
  };

  const handleGenerateInviteLink = async () => {
    setGeneratingLink(true);
    try {
      const headers: HeadersInit = {
        'Content-Type': 'application/json'
      };

      // 生产环境下添加认证头
      if (process.env.NODE_ENV !== 'development') {
        const token = localStorage.getItem('token');
        if (token) {
          headers.Authorization = `Bearer ${token}`;
        }
      }

      const response = await fetch(`/api/enterprises/${enterpriseId}/invite-links`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          role: inviteLinkRole,
          expiresIn: '7d' // 7天过期
        })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data?.inviteLink) {
          setInviteLink(data.data.inviteLink);
        }
      }
    } catch (error) {
      console.error('生成邀请链接失败:', error);
    } finally {
      setGeneratingLink(false);
    }
  };

  const copyInviteLink = () => {
    navigator.clipboard.writeText(inviteLink);
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'owner':
        return <Crown className="w-4 h-4" />;
      case 'admin':
        return <Shield className="w-4 h-4" />;
      case 'member':
        return <UserCheck className="w-4 h-4" />;
      default:
        return <Users className="w-4 h-4" />;
    }
  };

  const isValidEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const canSendInvites = inviteUsers.some(user => 
    user.email.trim() && isValidEmail(user.email)
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="w-5 h-5" />
            邀请用户
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="email" className="space-y-4">
          <TabsList>
            <TabsTrigger value="email">邮箱邀请</TabsTrigger>
            <TabsTrigger value="link">邀请链接</TabsTrigger>
          </TabsList>

          <TabsContent value="email" className="space-y-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium">邮箱邀请</h3>
                <Button onClick={addInviteUser} variant="outline" size="sm">
                  <Plus className="w-4 h-4 mr-2" />
                  添加用户
                </Button>
              </div>

              <div className="space-y-4">
                {inviteUsers.map((user, index) => (
                  <div key={user.id} className="flex items-center gap-3 p-4 border rounded-lg">
                    <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div>
                        <Label htmlFor={`email-${user.id}`}>邮箱地址 *</Label>
                        <Input
                          id={`email-${user.id}`}
                          type="email"
                          placeholder="user@example.com"
                          value={user.email}
                          onChange={(e) => updateInviteUser(user.id, 'email', e.target.value)}
                          className={!user.email || isValidEmail(user.email) ? '' : 'border-red-300'}
                        />
                      </div>
                      <div>
                        <Label htmlFor={`role-${user.id}`}>角色</Label>
                        <Select 
                          value={user.role} 
                          onValueChange={(value) => updateInviteUser(user.id, 'role', value)}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {availableRoles.map((role) => (
                              <SelectItem key={role.key} value={role.key}>
                                <div className="flex items-center gap-2">
                                  {getRoleIcon(role.key)}
                                  <span>{role.name}</span>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor={`department-${user.id}`}>部门 (可选)</Label>
                        <Input
                          id={`department-${user.id}`}
                          placeholder="技术部门"
                          value={user.department || ''}
                          onChange={(e) => updateInviteUser(user.id, 'department', e.target.value)}
                        />
                      </div>
                    </div>
                    {inviteUsers.length > 1 && (
                      <Button
                        onClick={() => removeInviteUser(user.id)}
                        variant="ghost"
                        size="sm"
                        className="text-red-500 hover:text-red-700"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>

              <div>
                <Label htmlFor="message">邀请消息 (可选)</Label>
                <Textarea
                  id="message"
                  placeholder="欢迎加入我们的团队..."
                  value={inviteMessage}
                  onChange={(e) => setInviteMessage(e.target.value)}
                  rows={3}
                />
              </div>

              <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-lg">
                <AlertCircle className="w-4 h-4 text-blue-500" />
                <p className="text-sm text-blue-700">
                  被邀请用户将收到邮件邀请，需要点击链接完成注册并加入企业。
                </p>
              </div>

              <div className="flex justify-end gap-2">
                <Button onClick={() => onOpenChange(false)} variant="outline">
                  取消
                </Button>
                <Button 
                  onClick={handleSendInvites} 
                  disabled={!canSendInvites || sending}
                >
                  <Send className="w-4 h-4 mr-2" />
                  {sending ? '发送中...' : `发送邀请 (${inviteUsers.filter(u => u.email.trim()).length})`}
                </Button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="link" className="space-y-6">
            <div className="space-y-4">
              <h3 className="text-lg font-medium">生成邀请链接</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="link-role">默认角色</Label>
                  <Select value={inviteLinkRole} onValueChange={setInviteLinkRole}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {availableRoles.map((role) => (
                        <SelectItem key={role.key} value={role.key}>
                          <div className="flex items-center gap-2">
                            {getRoleIcon(role.key)}
                            <span>{role.name}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end">
                  <Button 
                    onClick={handleGenerateInviteLink} 
                    disabled={generatingLink}
                    className="w-full"
                  >
                    <Link className="w-4 h-4 mr-2" />
                    {generatingLink ? '生成中...' : '生成邀请链接'}
                  </Button>
                </div>
              </div>

              {inviteLink && (
                <div className="space-y-3">
                  <Label>邀请链接</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      value={inviteLink}
                      readOnly
                      className="flex-1"
                    />
                    <Button onClick={copyInviteLink} variant="outline" size="sm">
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                  <div className="flex items-center gap-2 p-3 bg-green-50 rounded-lg">
                    <Check className="w-4 h-4 text-green-500" />
                    <p className="text-sm text-green-700">
                      邀请链接已生成，有效期7天。任何拥有此链接的人都可以注册并加入企业。
                    </p>
                  </div>
                </div>
              )}

              <Separator />

              <div className="space-y-3">
                <h4 className="font-medium">使用说明</h4>
                <div className="space-y-2 text-sm text-gray-600">
                  <p>• 邀请链接适用于批量邀请或公开招募</p>
                  <p>• 通过链接注册的用户将自动获得指定角色</p>
                  <p>• 链接有效期为7天，过期后需要重新生成</p>
                  <p>• 您可以随时在用户管理中调整用户角色和权限</p>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
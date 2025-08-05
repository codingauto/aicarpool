'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { UserPlus, Send, Clock, CheckCircle, XCircle, Copy, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { GroupManagerGuard } from '@/components/auth/PermissionGuard';

interface Invitation {
  id: string;
  email: string;
  role: string;
  status: string;
  message?: string;
  inviteCode: string;
  expiresAt: string;
  createdAt: string;
  invitedBy: {
    id: string;
    name: string;
    email: string;
  };
}

interface InvitationManagementProps {
  groupId: string;
  canManageMembers: boolean;
}

export function InvitationManagement({ groupId, canManageMembers }: InvitationManagementProps) {
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  
  // 创建邀请表单状态
  const [inviteForm, setInviteForm] = useState({
    email: '',
    role: 'member',
    message: ''
  });

  const fetchInvitations = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/groups/${groupId}/invitations`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setInvitations(data.data || []);
        } else {
          console.error('获取邀请列表失败:', data.message);
          toast.error(data.message || '获取邀请列表失败');
        }
      } else {
        const errorData = await response.json().catch(() => ({}));
        toast.error(errorData.message || '获取邀请列表失败');
      }
    } catch (error) {
      console.error('获取邀请列表失败:', error);
      toast.error('获取邀请列表失败');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateInvitation = async () => {
    if (!inviteForm.email.trim()) {
      toast.error('请输入邮箱地址');
      return;
    }

    setCreating(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/groups/${groupId}/invitations`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(inviteForm)
      });

      const data = await response.json();
      if (data.success) {
        toast.success('邀请已发送');
        setShowCreateDialog(false);
        setInviteForm({ email: '', role: 'member', message: '' });
        fetchInvitations();
      } else {
        throw new Error(data.message || '发送邀请失败');
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '发送邀请失败');
    } finally {
      setCreating(false);
    }
  };

  const handleCancelInvitation = async (invitationId: string) => {
    if (!confirm('确定要取消这个邀请吗？')) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/groups/${groupId}/invitations/${invitationId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        toast.success('邀请已取消');
        fetchInvitations();
      } else {
        throw new Error('取消邀请失败');
      }
    } catch (error) {
      toast.error('取消邀请失败');
    }
  };

  const handleResendInvitation = async (invitationId: string) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/groups/${groupId}/invitations/${invitationId}/resend`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        toast.success('邀请已重新发送');
        fetchInvitations();
      } else {
        throw new Error('重新发送失败');
      }
    } catch (error) {
      toast.error('重新发送失败');
    }
  };

  const copyInviteLink = (inviteCode: string) => {
    const inviteLink = `${window.location.origin}/groups/join/${inviteCode}`;
    navigator.clipboard.writeText(inviteLink);
    toast.success('邀请链接已复制到剪贴板');
  };

  const getStatusDisplay = (status: string, expiresAt: string) => {
    const isExpired = new Date(expiresAt) < new Date();
    
    if (isExpired && status === 'pending') {
      return { label: '已过期', color: 'bg-gray-100 text-gray-800', icon: Clock };
    }
    
    switch (status) {
      case 'pending':
        return { label: '待接受', color: 'bg-yellow-100 text-yellow-800', icon: Clock };
      case 'accepted':
        return { label: '已接受', color: 'bg-green-100 text-green-800', icon: CheckCircle };
      case 'declined':
        return { label: '已拒绝', color: 'bg-red-100 text-red-800', icon: XCircle };
      case 'cancelled':
        return { label: '已取消', color: 'bg-gray-100 text-gray-800', icon: XCircle };
      default:
        return { label: status, color: 'bg-gray-100 text-gray-800', icon: Clock };
    }
  };

  const getRoleDisplayName = (role: string) => {
    switch (role) {
      case 'admin': return '管理员';
      case 'member': return '成员';
      default: return role;
    }
  };

  useEffect(() => {
    fetchInvitations();
  }, [groupId]);

  if (loading) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="py-8">
            <div className="text-center text-gray-500">加载邀请列表...</div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const pendingInvitations = invitations.filter(inv => inv.status === 'pending');
  const expiredInvitations = invitations.filter(inv => 
    inv.status === 'pending' && new Date(inv.expiresAt) < new Date()
  );

  return (
    <div className="space-y-6">
      {/* 邀请统计 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">总邀请数</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{invitations.length}</div>
            <div className="text-sm text-gray-500">历史邀请</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">待接受</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{pendingInvitations.length}</div>
            <div className="text-sm text-gray-500">等待回复</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">已接受</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {invitations.filter(inv => inv.status === 'accepted').length}
            </div>
            <div className="text-sm text-gray-500">成功加入</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">已过期</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{expiredInvitations.length}</div>
            <div className="text-sm text-gray-500">需要重新发送</div>
          </CardContent>
        </Card>
      </div>

      {/* 邀请管理 */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>邀请管理</CardTitle>
              <CardDescription>邀请新成员加入拼车组</CardDescription>
            </div>
            <GroupManagerGuard groupId={groupId}>
              <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
                <DialogTrigger asChild>
                  <Button className="bg-blue-500 hover:bg-blue-600 text-white">
                    <UserPlus className="w-4 h-4 mr-2" />
                    发送邀请
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>邀请新成员</DialogTitle>
                    <DialogDescription>
                      发送邀请链接给新成员，让他们加入拼车组
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="email">邮箱地址</Label>
                      <Input
                        id="email"
                        type="email"
                        value={inviteForm.email}
                        onChange={(e) => setInviteForm(prev => ({ ...prev, email: e.target.value }))}
                        placeholder="输入邀请者的邮箱地址"
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="role">角色</Label>
                      <Select value={inviteForm.role} onValueChange={(value) => setInviteForm(prev => ({ ...prev, role: value }))}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="member">成员</SelectItem>
                          <SelectItem value="admin">管理员</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div>
                      <Label htmlFor="message">邀请消息（可选）</Label>
                      <Textarea
                        id="message"
                        value={inviteForm.message}
                        onChange={(e) => setInviteForm(prev => ({ ...prev, message: e.target.value }))}
                        placeholder="添加个人邀请消息..."
                        rows={3}
                      />
                    </div>
                    
                    <div className="flex gap-2 justify-end">
                      <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                        取消
                      </Button>
                      <Button onClick={handleCreateInvitation} disabled={creating}>
                        {creating ? (
                          <>
                            <Send className="w-4 h-4 mr-2 animate-pulse" />
                            发送中...
                          </>
                        ) : (
                          <>
                            <Send className="w-4 h-4 mr-2" />
                            发送邀请
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </GroupManagerGuard>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {invitations.map((invitation) => {
              const statusDisplay = getStatusDisplay(invitation.status, invitation.expiresAt);
              const isExpired = new Date(invitation.expiresAt) < new Date();
              const StatusIcon = statusDisplay.icon;
              
              return (
                <div key={invitation.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                      <StatusIcon className="w-5 h-5 text-blue-600" />
                    </div>
                    
                    <div>
                      <div className="font-medium">{invitation.email}</div>
                      <div className="text-sm text-gray-500">
                        邀请角色: {getRoleDisplayName(invitation.role)}
                      </div>
                      <div className="text-xs text-gray-400">
                        邀请时间: {new Date(invitation.createdAt).toLocaleDateString('zh-CN')}
                      </div>
                      <div className="text-xs text-gray-400">
                        过期时间: {new Date(invitation.expiresAt).toLocaleDateString('zh-CN')}
                      </div>
                      {invitation.message && (
                        <div className="text-xs text-gray-500 mt-1">
                          消息: {invitation.message}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <Badge className={statusDisplay.color}>
                      {statusDisplay.label}
                    </Badge>
                    
                    {canManageMembers && invitation.status === 'pending' && (
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => copyInviteLink(invitation.inviteCode)}
                          className="text-blue-600"
                        >
                          <Copy className="w-4 h-4 mr-1" />
                          复制链接
                        </Button>
                        
                        {isExpired && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleResendInvitation(invitation.id)}
                            className="text-green-600"
                          >
                            <RefreshCw className="w-4 h-4 mr-1" />
                            重新发送
                          </Button>
                        )}
                        
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleCancelInvitation(invitation.id)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          取消
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            
            {invitations.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <UserPlus className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                <p>暂无邀请记录</p>
                <p className="text-sm">点击"发送邀请"来邀请新成员加入</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
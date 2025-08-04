'use client';

/**
 * 部门成员管理组件
 * 
 * 功能：
 * - 显示部门成员列表
 * - 添加/移除部门成员
 * - 成员角色管理
 * - 与邀请功能集成
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { EnhancedUserInviteDialog } from './EnhancedUserInviteDialog';
import { 
  Users, 
  UserPlus, 
  UserMinus, 
  Search, 
  Crown, 
  Shield, 
  UserCheck,
  Mail,
  Calendar,
  Building2,
  AlertCircle,
  CheckCircle,
  Clock
} from 'lucide-react';

interface DepartmentMember {
  id: string;
  userId: string;
  departmentId: string;
  role: string;
  joinedAt: string;
  status: string;
  user: {
    id: string;
    name: string;
    email: string;
    avatar?: string;
  };
}

interface Department {
  id: string;
  name: string;
  description?: string;
  members?: DepartmentMember[];
}

interface DepartmentMemberManagementProps {
  department: Department;
  enterpriseId: string;
  isAdmin: boolean;
  onMemberUpdate?: () => void;
}

export function DepartmentMemberManagement({ 
  department, 
  enterpriseId, 
  isAdmin,
  onMemberUpdate 
}: DepartmentMemberManagementProps) {
  const [members, setMembers] = useState<DepartmentMember[]>(department.members || []);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [addMemberDialogOpen, setAddMemberDialogOpen] = useState(false);
  const [availableUsers, setAvailableUsers] = useState<any[]>([]);
  const [selectedUserId, setSelectedUserId] = useState('');

  useEffect(() => {
    if (addMemberDialogOpen) {
      fetchAvailableUsers();
    }
  }, [addMemberDialogOpen]);

  const fetchAvailableUsers = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/enterprises/${enterpriseId}/users?not_in_department=${department.id}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setAvailableUsers(data.data || []);
        }
      }
    } catch (error) {
      console.error('获取可用用户失败:', error);
    }
  };

  const handleAddMember = async () => {
    if (!selectedUserId) return;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/enterprises/${enterpriseId}/departments/${department.id}/members`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId: selectedUserId,
          role: 'member'
        })
      });

      if (response.ok) {
        alert('成员添加成功');
        setAddMemberDialogOpen(false);
        setSelectedUserId('');
        if (onMemberUpdate) onMemberUpdate();
      } else {
        const data = await response.json();
        alert(data.error || '添加成员失败');
      }
    } catch (error) {
      alert('添加成员失败');
    }
  };

  const handleRemoveMember = async (memberId: string, userName: string) => {
    if (!confirm(`确定要从部门中移除 ${userName} 吗？`)) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/enterprises/${enterpriseId}/departments/${department.id}/members/${memberId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        alert('成员移除成功');
        if (onMemberUpdate) onMemberUpdate();
      } else {
        const data = await response.json();
        alert(data.error || '移除成员失败');
      }
    } catch (error) {
      alert('移除成员失败');
    }
  };

  const handleRoleChange = async (memberId: string, newRole: string) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/enterprises/${enterpriseId}/departments/${department.id}/members/${memberId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          role: newRole
        })
      });

      if (response.ok) {
        alert('角色更新成功');
        if (onMemberUpdate) onMemberUpdate();
      } else {
        const data = await response.json();
        alert(data.error || '角色更新失败');
      }
    } catch (error) {
      alert('角色更新失败');
    }
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

  const getRoleBadgeStyle = (role: string) => {
    switch (role) {
      case 'owner': return 'bg-purple-100 text-purple-800';
      case 'admin': return 'bg-blue-100 text-blue-800';
      case 'member': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'pending':
        return <Clock className="w-4 h-4 text-yellow-500" />;
      default:
        return <AlertCircle className="w-4 h-4 text-gray-500" />;
    }
  };

  const filteredMembers = members.filter(member =>
    member.user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    member.user.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-8 p-2">
      {/* 头部统计 */}
      <div className="flex flex-wrap gap-4 text-sm text-gray-600">
        <div className="flex items-center gap-1">
          <Users className="w-4 h-4" />
          <span>总成员: <span className="font-semibold text-blue-600">{members.length}</span></span>
        </div>
        <div className="flex items-center gap-1">
          <CheckCircle className="w-4 h-4" />
          <span>活跃: <span className="font-semibold text-green-600">{members.filter(m => m.status === 'active').length}</span></span>
        </div>
        <div className="flex items-center gap-1">
          <Shield className="w-4 h-4" />
          <span>管理员: <span className="font-semibold text-purple-600">{members.filter(m => ['owner', 'admin'].includes(m.role)).length}</span></span>
        </div>
        <div className="flex items-center gap-1">
          <Clock className="w-4 h-4" />
          <span>待激活: <span className="font-semibold text-yellow-600">{members.filter(m => m.status === 'pending').length}</span></span>
        </div>
      </div>

      {/* 成员列表 */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Building2 className="w-5 h-5" />
                {department.name} - 成员管理
              </CardTitle>
              <CardDescription className="mt-1">
                管理部门成员，设置角色和权限
              </CardDescription>
            </div>
            {isAdmin && (
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setAddMemberDialogOpen(true)}
                >
                  <UserPlus className="w-4 h-4 mr-1" />
                  添加成员
                </Button>
                <Button 
                  size="sm"
                  onClick={() => setInviteDialogOpen(true)}
                >
                  <Mail className="w-4 h-4 mr-1" />
                  邀请新用户
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 搜索栏 */}
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="搜索成员姓名或邮箱..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-10"
            />
          </div>

          {/* 成员列表 */}
          <div className="space-y-3">
            {filteredMembers.map((member) => (
              <div key={member.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors">
                <div className="flex items-center gap-3 flex-1">
                  <Avatar className="w-10 h-10">
                    <AvatarImage src={member.user.avatar} alt={member.user.name} />
                    <AvatarFallback className="bg-gray-100 text-gray-600 font-medium">
                      {member.user.name.slice(0, 1).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{member.user.name}</span>
                      {getStatusIcon(member.status)}
                    </div>
                    <div className="text-sm text-gray-500 truncate">{member.user.email}</div>
                    <div className="flex items-center gap-1 text-xs text-gray-400">
                      <Calendar className="w-3 h-3" />
                      {new Date(member.joinedAt).toLocaleDateString('zh-CN')}
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  {/* 角色徽章 */}
                  <Badge className={getRoleBadgeStyle(member.role)}>
                    <div className="flex items-center gap-1">
                      {getRoleIcon(member.role)}
                      <span className="text-xs">
                        {member.role === 'owner' ? '负责人' : member.role === 'admin' ? '管理员' : '成员'}
                      </span>
                    </div>
                  </Badge>
                  
                  {/* 管理操作 */}
                  {isAdmin && member.role !== 'owner' && (
                    <div className="flex items-center gap-1">
                      <Select 
                        value={member.role}
                        onValueChange={(newRole) => handleRoleChange(member.id, newRole)}
                      >
                        <SelectTrigger className="w-20 h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="member">成员</SelectItem>
                          <SelectItem value="admin">管理员</SelectItem>
                        </SelectContent>
                      </Select>
                      
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveMember(member.id, member.user.name)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50 h-8 w-8 p-0"
                      >
                        <UserMinus className="w-3 h-3" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            ))}
            
            {filteredMembers.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <Users className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p className="font-medium mb-1">暂无成员</p>
                <p className="text-sm text-gray-400">添加或邀请成员加入部门</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 添加现有成员对话框 */}
      <Dialog open={addMemberDialogOpen} onOpenChange={setAddMemberDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader className="space-y-3">
            <DialogTitle className="text-xl font-semibold">添加部门成员</DialogTitle>
          </DialogHeader>
          <div className="space-y-6 pt-4">
            <div className="space-y-3">
              <Label className="text-sm font-medium">选择用户</Label>
              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger className="h-12">
                  <SelectValue placeholder="选择要添加的用户" />
                </SelectTrigger>
                <SelectContent>
                  {availableUsers.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      <div className="flex items-center gap-3">
                        <span className="font-medium">{user.name}</span>
                        <span className="text-sm text-gray-500">({user.email})</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex justify-end gap-3 pt-4">
              <Button 
                variant="outline" 
                onClick={() => setAddMemberDialogOpen(false)}
                className="min-w-20"
              >
                取消
              </Button>
              <Button 
                onClick={handleAddMember} 
                disabled={!selectedUserId}
                className="min-w-20"
              >
                添加
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 邀请新用户对话框 */}
      <EnhancedUserInviteDialog
        open={inviteDialogOpen}
        onOpenChange={setInviteDialogOpen}
        enterpriseId={enterpriseId}
        availableRoles={[
          { key: 'member', name: '普通成员', permissions: ['basic'] },
          { key: 'admin', name: '管理员', permissions: ['admin'] }
        ]}
        onInviteSuccess={() => {
          if (onMemberUpdate) onMemberUpdate();
        }}
      />
    </div>
  );
}
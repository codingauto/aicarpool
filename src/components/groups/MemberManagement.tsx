'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Users, UserPlus, BarChart3, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { GroupManagerGuard } from '@/components/auth/PermissionGuard';
import { OrganizationMemberSelector } from './OrganizationMemberSelector';

interface Member {
  id: string;
  role: string;
  status: string;
  joinedAt: string;
  user: {
    id: string;
    name: string;
    email: string;
    avatar?: string;
    enterpriseRoles?: Array<{
      roleName: string;
      displayName: string;
      scope: string;
    }>;
  };
}

interface MemberManagementProps {
  groupId: string;
  groupName: string;
  enterpriseId: string;
  members: Member[];
  currentUserId?: string;
  canManageMembers: boolean;
  onInviteClick: () => void;
  onMembersChanged?: () => void;
}

export function MemberManagement({ 
  groupId,
  groupName,
  enterpriseId, 
  members, 
  currentUserId, 
  canManageMembers,
  onInviteClick,
  onMembersChanged
}: MemberManagementProps) {
  const [loadingMember, setLoadingMember] = useState<string | null>(null);
  const [orgSelectorOpen, setOrgSelectorOpen] = useState(false);

  const handleRoleChange = async (memberId: string, newRole: string) => {
    setLoadingMember(memberId);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/groups/${groupId}/members/${memberId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ role: newRole })
      });

      if (response.ok) {
        toast.success('成员角色更新成功');
        // 触发数据刷新
        if (onMembersChanged) {
          onMembersChanged();
        }
      } else {
        throw new Error('更新失败');
      }
    } catch (error) {
      toast.error('更新成员角色失败');
    } finally {
      setLoadingMember(null);
    }
  };

  const handleRemoveMember = async (memberId: string, memberName: string) => {
    if (!confirm(`确定要移除成员 ${memberName} 吗？此操作无法撤销。`)) {
      return;
    }

    setLoadingMember(memberId);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/groups/${groupId}/members/${memberId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        toast.success('成员已移除');
        // 触发数据刷新
        if (onMembersChanged) {
          onMembersChanged();
        }
      } else {
        throw new Error('移除失败');
      }
    } catch (error) {
      toast.error('移除成员失败');
    } finally {
      setLoadingMember(null);
    }
  };

  const getRoleDisplayName = (role: string) => {
    switch (role) {
      case 'owner': return '创建者';
      case 'admin': return '管理员';
      case 'member': return '成员';
      default: return role;
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

  const getStatusBadgeStyle = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'inactive': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const activeMembers = members.filter(m => m.status === 'active').length;
  const adminMembers = members.filter(m => ['owner', 'admin'].includes(m.role)).length;
  const enterpriseMembers = members.filter(m => m.user.enterpriseRoles?.length > 0).length;

  return (
    <div className="space-y-6">
      {/* 成员统计概览 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">总成员数</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{members.length}</div>
            <div className="text-sm text-gray-500">当前成员</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">管理员</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{adminMembers}</div>
            <div className="text-sm text-gray-500">拥有管理权限</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">活跃成员</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeMembers}</div>
            <div className="text-sm text-gray-500">当前活跃</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">企业成员</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{enterpriseMembers}</div>
            <div className="text-sm text-gray-500">来自企业</div>
          </CardContent>
        </Card>
      </div>

      {/* 成员列表 */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>成员列表</CardTitle>
              <CardDescription>拼车组所有成员和权限管理</CardDescription>
            </div>
            <GroupManagerGuard groupId={groupId}>
              <div className="flex gap-2">
                <Button 
                  variant="outline"
                  onClick={() => setOrgSelectorOpen(true)}
                >
                  <Users className="w-4 h-4 mr-2" />
                  从组织添加
                </Button>
                <Button 
                  className="bg-blue-500 hover:bg-blue-600 text-white"
                  onClick={onInviteClick}
                >
                  <UserPlus className="w-4 h-4 mr-2" />
                  邀请成员
                </Button>
              </div>
            </GroupManagerGuard>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {members.map((member) => {
              const isCurrentUser = currentUserId === member.user.id;
              const canManageMember = canManageMembers && !isCurrentUser && member.role !== 'owner';
              const isLoading = loadingMember === member.id;
              
              return (
                <div key={member.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-4">
                    {/* 用户头像 */}
                    <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                      {member.user.avatar ? (
                        <img 
                          src={member.user.avatar} 
                          alt={member.user.name} 
                          className="w-10 h-10 rounded-full object-cover"
                        />
                      ) : (
                        <span className="text-gray-600 font-medium">
                          {member.user.name.slice(0, 1).toUpperCase()}
                        </span>
                      )}
                    </div>
                    
                    {/* 用户信息 */}
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{member.user.name}</span>
                        {isCurrentUser && (
                          <Badge variant="outline" className="text-xs">
                            您
                          </Badge>
                        )}
                        {member.user.enterpriseRoles?.length > 0 && (
                          <Badge variant="secondary" className="text-xs">
                            企业成员
                          </Badge>
                        )}
                      </div>
                      <div className="text-sm text-gray-500">{member.user.email}</div>
                      <div className="text-xs text-gray-400">
                        加入时间: {new Date(member.joinedAt).toLocaleDateString('zh-CN')}
                      </div>
                      {member.user.enterpriseRoles?.length > 0 && (
                        <div className="text-xs text-gray-400">
                          企业角色: {member.user.enterpriseRoles[0].displayName}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* 角色和操作 */}
                  <div className="flex items-center gap-3">
                    {/* 角色标签 */}
                    <Badge className={getRoleBadgeStyle(member.role)}>
                      {getRoleDisplayName(member.role)}
                    </Badge>
                    
                    {/* 状态标签 */}
                    <Badge className={getStatusBadgeStyle(member.status)}>
                      {member.status === 'active' ? '活跃' :
                       member.status === 'pending' ? '待激活' : '停用'}
                    </Badge>
                    
                    {/* 管理操作 */}
                    {canManageMember && (
                      <div className="flex items-center gap-2">
                        <Select 
                          value={member.role}
                          onValueChange={(newRole) => handleRoleChange(member.id, newRole)}
                          disabled={isLoading}
                        >
                          <SelectTrigger className="w-24 h-8">
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
                          disabled={isLoading}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          {isLoading ? (
                            <div className="flex items-center gap-1">
                              <div className="animate-spin rounded-full h-3 w-3 border-b border-red-600"></div>
                              <span>处理中...</span>
                            </div>
                          ) : (
                            '移除'
                          )}
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            
            {members.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <Users className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                <p>暂无成员</p>
                <p className="text-sm">请邀请成员加入拼车组</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 成员活动提醒 */}
      {members.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5" />
              成员活动提醒
            </CardTitle>
            <CardDescription>成员管理相关的重要提醒</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {members.filter(m => m.status === 'pending').length > 0 && (
                <div className="flex items-center gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <AlertTriangle className="w-4 h-4 text-yellow-600" />
                  <span className="text-sm text-yellow-800">
                    有 {members.filter(m => m.status === 'pending').length} 名成员待激活
                  </span>
                </div>
              )}
              
              {adminMembers === 1 && (
                <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <AlertTriangle className="w-4 h-4 text-blue-600" />
                  <span className="text-sm text-blue-800">
                    建议设置至少2名管理员以确保拼车组管理的连续性
                  </span>
                </div>
              )}
              
              {enterpriseMembers < members.length && (
                <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                  <AlertTriangle className="w-4 h-4 text-green-600" />
                  <span className="text-sm text-green-800">
                    鼓励成员加入企业组织以获得更好的资源支持
                  </span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 组织架构成员选择对话框 */}
      <OrganizationMemberSelector
        open={orgSelectorOpen}
        onOpenChange={setOrgSelectorOpen}
        enterpriseId={enterpriseId}
        groupId={groupId}
        groupName={groupName}
        existingMemberIds={members.map(m => m.user.id)}
        onMembersAdded={() => {
          if (onMembersChanged) {
            onMembersChanged();
          }
        }}
      />
    </div>
  );
}
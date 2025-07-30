'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { UserPlus, MoreHorizontal } from 'lucide-react';

interface GroupMember {
  id: string;
  role: string;
  status: string;
  joinedAt: string;
  user: {
    id: string;
    name: string;
    email: string;
    avatar?: string;
  };
}

interface GroupDetail {
  members: GroupMember[];
}

interface MembersTabProps {
  group: GroupDetail;
  isAdmin: boolean;
  currentUser: any;
  onInviteClick: () => void;
}

export function MembersTab({ group, isAdmin, currentUser, onInviteClick }: MembersTabProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>成员列表</CardTitle>
            <CardDescription>
              管理拼车组成员和权限
            </CardDescription>
          </div>
          {isAdmin && (
            <Button onClick={onInviteClick}>
              <UserPlus className="w-4 h-4 mr-2" />
              邀请成员
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>用户</TableHead>
              <TableHead>角色</TableHead>
              <TableHead>状态</TableHead>
              <TableHead>加入时间</TableHead>
              <TableHead>操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {group.members.map((member) => (
              <TableRow key={member.id}>
                <TableCell>
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
                      {member.user.avatar ? (
                        <img 
                          src={member.user.avatar} 
                          alt={member.user.name}
                          className="w-8 h-8 rounded-full"
                        />
                      ) : (
                        <span className="text-sm font-medium">
                          {member.user.name.charAt(0).toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div>
                      <div className="font-medium">{member.user.name}</div>
                      <div className="text-sm text-gray-500">{member.user.email}</div>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant={member.role === 'admin' ? 'default' : 'secondary'}>
                    {member.role === 'admin' ? '管理员' : '成员'}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge variant={member.status === 'active' ? 'default' : 'secondary'}>
                    {member.status === 'active' ? '活跃' : '禁用'}
                  </Badge>
                </TableCell>
                <TableCell>
                  {new Date(member.joinedAt).toLocaleDateString('zh-CN', {
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit'
                  })}
                </TableCell>
                <TableCell>
                  {isAdmin && member.user.id !== currentUser?.id && (
                    <Button variant="ghost" size="sm">
                      <MoreHorizontal className="w-4 h-4" />
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
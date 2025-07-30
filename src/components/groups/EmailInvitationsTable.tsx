'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { RefreshCw, X } from 'lucide-react';

interface Invitation {
  id: string;
  email: string;
  status: 'pending' | 'accepted' | 'expired';
  createdAt: string;
  expiresAt: string;
  inviter: {
    name: string;
  };
}

interface EmailInvitationsTableProps {
  invitations: Invitation[];
  isAdmin: boolean;
  loading?: string | null;
  onResend: (invitationId: string) => Promise<void>;
  onCancel: (invitationId: string) => Promise<void>;
}

export function EmailInvitationsTable({ 
  invitations, 
  isAdmin, 
  loading, 
  onResend, 
  onCancel 
}: EmailInvitationsTableProps) {
  const formatDate = (dateString: string): string => {
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return '日期格式错误';
      return date.toLocaleDateString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      });
    } catch (error) {
      return '日期解析失败';
    }
  };

  const getStatusBadge = (status: string) => {
    const variant = status === 'pending' || status === 'accepted' ? 'default' : 'secondary';
    const text = status === 'pending' ? '待接受' : 
                status === 'accepted' ? '已接受' : '已过期';
    return <Badge variant={variant}>{text}</Badge>;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>邮件邀请记录</CardTitle>
        <CardDescription>
          查看和管理邮件邀请记录
        </CardDescription>
      </CardHeader>
      <CardContent>
        {invitations.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>邮箱</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>邀请者</TableHead>
                <TableHead>邀请时间</TableHead>
                <TableHead>过期时间</TableHead>
                <TableHead>操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invitations.map((invitation) => (
                <TableRow key={invitation.id}>
                  <TableCell className="font-medium">{invitation.email}</TableCell>
                  <TableCell>
                    {getStatusBadge(invitation.status)}
                  </TableCell>
                  <TableCell>{invitation.inviter.name}</TableCell>
                  <TableCell>
                    {formatDate(invitation.createdAt)}
                  </TableCell>
                  <TableCell>
                    {formatDate(invitation.expiresAt)}
                  </TableCell>
                  <TableCell>
                    {isAdmin && invitation.status === 'pending' && (
                      <div className="flex space-x-2">
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => onResend(invitation.id)}
                          disabled={loading === invitation.id}
                          title="重新发送邀请"
                        >
                          {loading === invitation.id ? (
                            <div className="w-4 h-4 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600"></div>
                          ) : (
                            <RefreshCw className="w-4 h-4 text-blue-600" />
                          )}
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => onCancel(invitation.id)}
                          disabled={loading === invitation.id}
                          title="撤销邀请"
                        >
                          {loading === invitation.id ? (
                            <div className="w-4 h-4 animate-spin rounded-full border-2 border-gray-300 border-t-red-600"></div>
                          ) : (
                            <X className="w-4 h-4 text-red-600" />
                          )}
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="text-center py-8">
            <div className="text-gray-500">没有邮件邀请记录</div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
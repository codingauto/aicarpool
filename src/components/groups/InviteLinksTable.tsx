'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Copy, QrCode } from 'lucide-react';

interface InviteLink {
  id: string;
  name: string;
  token: string;
  usedCount: number;
  maxUses: number;
  status: 'active' | 'expired' | 'disabled';
  expiresAt?: string;
  creator: {
    name: string;
  };
}

interface InviteLinksTableProps {
  links: InviteLink[];
  onCopyLink: (url: string) => Promise<void>;
  onGenerateQR: (linkId: string) => Promise<void>;
  baseUrl?: string;
}

export function InviteLinksTable({ 
  links, 
  onCopyLink, 
  onGenerateQR, 
  baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001'
}: InviteLinksTableProps) {
  const formatDate = (dateString?: string): string => {
    try {
      if (!dateString) return '无过期时间';
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return '日期格式错误';
      return date.toLocaleDateString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      });
    } catch (error) {
      console.error('日期解析错误:', error, dateString);
      return '日期解析失败';
    }
  };

  const getStatusBadge = (status: string) => {
    const variant = status === 'active' ? 'default' : 'secondary';
    const text = status === 'active' ? '活跃' : 
                status === 'expired' ? '已过期' : '已禁用';
    return <Badge variant={variant}>{text}</Badge>;
  };

  const getInviteUrl = (token: string) => `${baseUrl}/join/${token}`;

  return (
    <Card>
      <CardHeader>
        <CardTitle>邀请链接管理</CardTitle>
        <CardDescription>
          管理可重复使用的邀请链接
        </CardDescription>
      </CardHeader>
      <CardContent>
        {links.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>链接名称</TableHead>
                <TableHead>使用情况</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>创建者</TableHead>
                <TableHead>过期时间</TableHead>
                <TableHead>操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {links.map((link) => (
                <TableRow key={link.id}>
                  <TableCell className="font-medium">{link.name}</TableCell>
                  <TableCell>
                    <div className="text-sm">
                      {link.usedCount}/{link.maxUses} 次使用
                    </div>
                  </TableCell>
                  <TableCell>
                    {getStatusBadge(link.status)}
                  </TableCell>
                  <TableCell>{link.creator.name}</TableCell>
                  <TableCell>
                    {formatDate(link.expiresAt)}
                  </TableCell>
                  <TableCell>
                    <div className="flex space-x-2">
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => onCopyLink(getInviteUrl(link.token))}
                        title="复制链接"
                      >
                        <Copy className="w-4 h-4 text-blue-600" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => onGenerateQR(link.id)}
                        title="生成二维码"
                      >
                        <QrCode className="w-4 h-4 text-green-600" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="text-center py-8">
            <div className="text-gray-500">没有邀请链接</div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
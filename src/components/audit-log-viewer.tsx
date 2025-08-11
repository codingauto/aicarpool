'use client';

import React, { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  History,
  User,
  Calendar,
  Filter,
  Search,
  ChevronLeft,
  ChevronRight,
  Shield,
  UserPlus,
  UserMinus,
  Edit,
  Trash,
  Key,
  Building2,
} from 'lucide-react';

interface AuditLog {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  details: any;
  user: {
    id: string;
    name: string;
    email: string;
    avatar?: string;
  };
  createdAt: string;
  ipAddress?: string;
}

interface AuditLogViewerProps {
  enterpriseId: string;
}

export function AuditLogViewer({ enterpriseId }: AuditLogViewerProps) {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filters, setFilters] = useState({
    action: '',
    userId: '',
    startDate: '',
    endDate: '',
  });

  useEffect(() => {
    fetchLogs();
  }, [page, filters]);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams({
        page: page.toString(),
        pageSize: '20',
        ...(filters.action && { action: filters.action }),
        ...(filters.userId && { userId: filters.userId }),
        ...(filters.startDate && { startDate: filters.startDate }),
        ...(filters.endDate && { endDate: filters.endDate }),
      });

      const response = await fetch(
        `/api/enterprises/${enterpriseId}/audit-logs?${queryParams}`,
        {
          headers: {
            'Content-Type': 'application/json',
            ...(process.env.NODE_ENV !== 'development' && {
              Authorization: `Bearer ${localStorage.getItem('token')}`,
            }),
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setLogs(data.data.logs);
          setTotalPages(data.data.pagination.totalPages);
        }
      }
    } catch (error) {
      console.error('获取审计日志失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const getActionIcon = (action: string) => {
    if (action.includes('create') || action.includes('add')) return <UserPlus className="w-4 h-4" />;
    if (action.includes('delete') || action.includes('remove')) return <UserMinus className="w-4 h-4" />;
    if (action.includes('update') || action.includes('edit')) return <Edit className="w-4 h-4" />;
    if (action.includes('permission') || action.includes('role')) return <Key className="w-4 h-4" />;
    if (action.includes('department')) return <Building2 className="w-4 h-4" />;
    return <Shield className="w-4 h-4" />;
  };

  const getActionColor = (action: string) => {
    if (action.includes('create') || action.includes('add')) return 'bg-green-100 text-green-800';
    if (action.includes('delete') || action.includes('remove')) return 'bg-red-100 text-red-800';
    if (action.includes('update') || action.includes('edit')) return 'bg-blue-100 text-blue-800';
    return 'bg-gray-100 text-gray-800';
  };

  const formatAction = (action: string) => {
    const actionMap: { [key: string]: string } = {
      'user.create': '创建用户',
      'user.update': '更新用户',
      'user.delete': '删除用户',
      'department.create': '创建部门',
      'department.update': '更新部门',
      'department.delete': '删除部门',
      'permission.grant': '授予权限',
      'permission.revoke': '撤销权限',
      'role.assign': '分配角色',
      'role.remove': '移除角色',
    };
    return actionMap[action] || action;
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <History className="w-5 h-5" />
            审计日志
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setFilters({ action: '', userId: '', startDate: '', endDate: '' })}
          >
            <Filter className="w-4 h-4 mr-2" />
            清除筛选
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {/* 筛选器 */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div>
            <Label htmlFor="action">操作类型</Label>
            <Select value={filters.action} onValueChange={(value) => setFilters({ ...filters, action: value })}>
              <SelectTrigger id="action">
                <SelectValue placeholder="所有操作" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">所有操作</SelectItem>
                <SelectItem value="user.create">创建用户</SelectItem>
                <SelectItem value="user.update">更新用户</SelectItem>
                <SelectItem value="user.delete">删除用户</SelectItem>
                <SelectItem value="department.create">创建部门</SelectItem>
                <SelectItem value="department.update">更新部门</SelectItem>
                <SelectItem value="permission.grant">授予权限</SelectItem>
                <SelectItem value="role.assign">分配角色</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="startDate">开始日期</Label>
            <Input
              id="startDate"
              type="date"
              value={filters.startDate}
              onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="endDate">结束日期</Label>
            <Input
              id="endDate"
              type="date"
              value={filters.endDate}
              onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
            />
          </div>
          <div className="flex items-end">
            <Button onClick={fetchLogs} className="w-full">
              <Search className="w-4 h-4 mr-2" />
              搜索
            </Button>
          </div>
        </div>

        {/* 日志列表 */}
        <ScrollArea className="h-[500px]">
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-2 text-gray-500">加载中...</p>
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <History className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p>暂无审计日志</p>
            </div>
          ) : (
            <div className="space-y-4">
              {logs.map((log) => (
                <div key={log.id} className="border rounded-lg p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-3">
                      <div className="mt-1">
                        {getActionIcon(log.action)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <Badge className={getActionColor(log.action)}>
                            {formatAction(log.action)}
                          </Badge>
                          <span className="text-sm text-gray-500">
                            {log.entityType} #{log.entityId}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <User className="w-3 h-3" />
                          <span>{log.user.name}</span>
                          <span className="text-gray-400">•</span>
                          <Calendar className="w-3 h-3" />
                          <span>{formatDateTime(log.createdAt)}</span>
                          {log.ipAddress && (
                            <>
                              <span className="text-gray-400">•</span>
                              <span className="text-xs">{log.ipAddress}</span>
                            </>
                          )}
                        </div>
                        {log.details && (
                          <div className="mt-2 text-sm text-gray-600">
                            <pre className="whitespace-pre-wrap">
                              {JSON.stringify(log.details, null, 2)}
                            </pre>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        {/* 分页 */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1}
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              上一页
            </Button>
            <span className="text-sm text-gray-600">
              第 {page} 页，共 {totalPages} 页
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(Math.min(totalPages, page + 1))}
              disabled={page === totalPages}
            >
              下一页
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
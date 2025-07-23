'use client';

import { useState, useEffect } from 'react';
import { AppHeader } from '@/components/layout/AppHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Loader2, Plus, Edit2, Trash2, RefreshCw } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

interface ProxyResource {
  id: string;
  type: string;
  host: string;
  port: number;
  username?: string;
  password?: string;
  location?: string;
  provider?: string;
  status: string;
  lastChecked?: string;
  responseTime?: number;
  createdAt: string;
  binding?: {
    id: string;
    priority: number;
    isEnabled: boolean;
  };
}

interface ProxyFormData {
  type: string;
  host: string;
  port: number;
  username: string;
  password: string;
  location: string;
  provider: string;
}

const initialFormData: ProxyFormData = {
  type: 'socks5',
  host: '',
  port: 1080,
  username: '',
  password: '',
  location: '',
  provider: '',
};

export default function IpManagementPage() {
  const { user, token } = useAuth();
  const [proxyResources, setProxyResources] = useState<ProxyResource[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingResource, setEditingResource] = useState<ProxyResource | null>(null);
  const [formData, setFormData] = useState<ProxyFormData>(initialFormData);

  // 获取当前用户的组ID
  const getUserGroupId = () => {
    // 从localStorage获取当前选择的组ID，或使用第一个组
    const selectedGroupId = localStorage.getItem('selectedGroupId');
    if (selectedGroupId) return selectedGroupId;
    
    // 如果用户有组信息，使用第一个组
    if (user?.groups && user.groups.length > 0) {
      return user.groups[0].id;
    }
    
    // 默认值（实际部署时需要处理这种情况）
    return 'temp-group-id';
  };

  const groupId = getUserGroupId();

  useEffect(() => {
    fetchProxyResources();
  }, []);

  const fetchProxyResources = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/proxy-resources?groupId=${groupId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const result = await response.json();
      if (result.success) {
        setProxyResources(result.data);
      } else {
        toast.error(result.message || '获取代理资源失败');
      }
    } catch (error) {
      console.error('Failed to fetch proxy resources:', error);
      toast.error('获取代理资源失败');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const url = editingResource ? '/api/proxy-resources' : '/api/proxy-resources';
      const method = editingResource ? 'PUT' : 'POST';
      const payload = editingResource 
        ? { id: editingResource.id, groupId, ...formData }
        : { groupId, ...formData };

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json();
      if (result.success) {
        toast.success(editingResource ? '代理资源更新成功' : '代理资源创建成功');
        setDialogOpen(false);
        setEditingResource(null);
        setFormData(initialFormData);
        fetchProxyResources();
      } else {
        toast.error(result.message || '操作失败');
      }
    } catch (error) {
      console.error('Failed to submit proxy resource:', error);
      toast.error('操作失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (resource: ProxyResource) => {
    setEditingResource(resource);
    setFormData({
      type: resource.type,
      host: resource.host,
      port: resource.port,
      username: resource.username || '',
      password: resource.password || '',
      location: resource.location || '',
      provider: resource.provider || '',
    });
    setDialogOpen(true);
  };

  const handleDelete = async (resource: ProxyResource) => {
    if (!confirm('确定要删除这个代理资源吗？')) {
      return;
    }

    try {
      const response = await fetch(`/api/proxy-resources?id=${resource.id}&groupId=${groupId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const result = await response.json();
      if (result.success) {
        toast.success('代理资源删除成功');
        fetchProxyResources();
      } else {
        toast.error(result.message || '删除失败');
      }
    } catch (error) {
      console.error('Failed to delete proxy resource:', error);
      toast.error('删除失败');
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      active: { label: '活跃', variant: 'default' as const },
      inactive: { label: '离线', variant: 'secondary' as const },
      error: { label: '错误', variant: 'destructive' as const },
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.inactive;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const getTypeLabel = (type: string) => {
    const typeLabels = {
      socks5: 'SOCKS5',
      http: 'HTTP',
      https: 'HTTPS',
    };
    return typeLabels[type as keyof typeof typeLabels] || type.toUpperCase();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader title="IP管理" showUserInfo={false}>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchProxyResources}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            刷新
          </Button>
          
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" onClick={() => {
                setEditingResource(null);
                setFormData(initialFormData);
              }}>
                <Plus className="h-4 w-4 mr-2" />
                添加代理
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>
                  {editingResource ? '编辑代理资源' : '添加代理资源'}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="type">代理类型</Label>
                    <Select
                      value={formData.type}
                      onValueChange={(value) => setFormData({ ...formData, type: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="socks5">SOCKS5</SelectItem>
                        <SelectItem value="http">HTTP</SelectItem>
                        <SelectItem value="https">HTTPS</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="port">端口号</Label>
                    <Input
                      id="port"
                      type="number"
                      value={formData.port}
                      onChange={(e) => setFormData({ ...formData, port: parseInt(e.target.value) || 0 })}
                      min={1}
                      max={65535}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="host">代理主机</Label>
                  <Input
                    id="host"
                    value={formData.host}
                    onChange={(e) => setFormData({ ...formData, host: e.target.value })}
                    placeholder="例如: 192.168.1.100"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="username">账号</Label>
                    <Input
                      id="username"
                      value={formData.username}
                      onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                      placeholder="用户名（可选）"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">密码</Label>
                    <Input
                      id="password"
                      type="password"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      placeholder="密码（可选）"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="location">位置</Label>
                    <Input
                      id="location"
                      value={formData.location}
                      onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                      placeholder="如: 美国西部（可选）"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="provider">提供商</Label>
                    <Input
                      id="provider"
                      value={formData.provider}
                      onChange={(e) => setFormData({ ...formData, provider: e.target.value })}
                      placeholder="服务提供商（可选）"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setDialogOpen(false)}
                  >
                    取消
                  </Button>
                  <Button type="submit" disabled={submitting}>
                    {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    {editingResource ? '更新' : '创建'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </AppHeader>

      <div className="p-6">
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b">
            <h2 className="text-lg font-semibold">代理资源列表</h2>
            <p className="text-sm text-gray-600 mt-1">
              管理您的静态IP代理配置，包括SOCKS5、HTTP等类型的代理服务器
            </p>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
              <span className="ml-2 text-gray-500">加载中...</span>
            </div>
          ) : proxyResources.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-gray-400 mb-4">
                <Plus className="h-12 w-12 mx-auto opacity-50" />
              </div>
              <p className="text-gray-500 mb-4">暂无代理资源</p>
              <p className="text-sm text-gray-400">
                点击右上角"添加代理"按钮创建您的第一个代理配置
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>代理信息</TableHead>
                  <TableHead>类型</TableHead>
                  <TableHead>认证</TableHead>
                  <TableHead>位置/提供商</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>响应时间</TableHead>
                  <TableHead>操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {proxyResources.map((resource) => (
                  <TableRow key={resource.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{resource.host}:{resource.port}</div>
                        <div className="text-sm text-gray-500">
                          优先级: {resource.binding?.priority || 1}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {getTypeLabel(resource.type)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {resource.username ? (
                        <div className="text-sm">
                          <div>{resource.username}</div>
                          <div className="text-gray-400">***</div>
                        </div>
                      ) : (
                        <span className="text-gray-400">无认证</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {resource.location && (
                          <div>{resource.location}</div>
                        )}
                        {resource.provider && (
                          <div className="text-gray-500">{resource.provider}</div>
                        )}
                        {!resource.location && !resource.provider && (
                          <span className="text-gray-400">-</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(resource.status)}
                    </TableCell>
                    <TableCell>
                      {resource.responseTime ? (
                        <span className="text-sm">{resource.responseTime}ms</span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(resource)}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(resource)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </div>
    </div>
  );
}
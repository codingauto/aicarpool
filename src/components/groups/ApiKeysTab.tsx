'use client';

import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Copy, MoreHorizontal } from 'lucide-react';

interface ApiKey {
  id: string;
  name: string;
  description?: string;
  key: string;
  status: string;
  quotaUsed: number;
  quotaLimit?: number;
  lastUsedAt?: string;
  user: {
    name: string;
  };
  aiService: {
    displayName: string;
  };
}

interface AiService {
  isEnabled: boolean;
  aiService: {
    id: string;
    displayName: string;
  };
}

interface GroupDetail {
  apiKeys: ApiKey[];
  aiServices: AiService[];
}

interface ApiKeysTabProps {
  group: GroupDetail;
  onCreateApiKey: (data: { name: string; description: string; aiServiceId: string }) => Promise<void>;
  onCopyApiKey: (key: string) => Promise<void>;
}

export function ApiKeysTab({ group, onCreateApiKey, onCopyApiKey }: ApiKeysTabProps) {
  const [showCreateKeyDialog, setShowCreateKeyDialog] = useState(false);
  const [keyName, setKeyName] = useState('');
  const [keyDescription, setKeyDescription] = useState('');
  const [selectedAiService, setSelectedAiService] = useState('');
  const [createKeyLoading, setCreateKeyLoading] = useState(false);
  const [createKeyError, setCreateKeyError] = useState('');

  const formatApiKeyDisplay = (key: string) => {
    if (key.length <= 12) return key;
    return `${key.slice(0, 6)}...${key.slice(-6)}`;
  };

  const handleCreateApiKey = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateKeyLoading(true);
    setCreateKeyError('');

    try {
      await onCreateApiKey({
        name: keyName,
        description: keyDescription,
        aiServiceId: selectedAiService
      });
      
      setShowCreateKeyDialog(false);
      setKeyName('');
      setKeyDescription('');
      setSelectedAiService('');
    } catch (error: any) {
      setCreateKeyError(error.message || '创建API密钥失败');
    } finally {
      setCreateKeyLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>API密钥管理</CardTitle>
            <CardDescription>
              管理拼车组的API密钥
            </CardDescription>
          </div>
          <Dialog open={showCreateKeyDialog} onOpenChange={setShowCreateKeyDialog}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                创建密钥
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>创建API密钥</DialogTitle>
                <DialogDescription>
                  为指定的AI服务创建新的API密钥
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreateApiKey} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="keyName">密钥名称</Label>
                  <Input
                    id="keyName"
                    value={keyName}
                    onChange={(e) => setKeyName(e.target.value)}
                    required
                    disabled={createKeyLoading}
                    placeholder="请输入密钥名称"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="keyDescription">描述（可选）</Label>
                  <Textarea
                    id="keyDescription"
                    value={keyDescription}
                    onChange={(e) => setKeyDescription(e.target.value)}
                    disabled={createKeyLoading}
                    placeholder="请输入密钥描述"
                    rows={3}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="aiService">AI服务</Label>
                  <Select value={selectedAiService} onValueChange={setSelectedAiService} required>
                    <SelectTrigger>
                      <SelectValue placeholder="选择AI服务" />
                    </SelectTrigger>
                    <SelectContent>
                      {group.aiServices.filter(s => s.isEnabled).map((service) => (
                        <SelectItem key={service.aiService.id} value={service.aiService.id}>
                          {service.aiService.displayName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {createKeyError && (
                  <div className="text-red-500 text-sm">{createKeyError}</div>
                )}
                <div className="flex space-x-2">
                  <Button type="submit" disabled={createKeyLoading}>
                    {createKeyLoading ? '创建中...' : '创建'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowCreateKeyDialog(false)}
                    disabled={createKeyLoading}
                  >
                    取消
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {group.apiKeys.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>名称</TableHead>
                <TableHead>API密钥</TableHead>
                <TableHead>AI服务</TableHead>
                <TableHead>创建者</TableHead>
                <TableHead>配额使用</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>最后使用</TableHead>
                <TableHead>操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {group.apiKeys.map((apiKey) => (
                <TableRow key={apiKey.id}>
                  <TableCell>
                    <div>
                      <div className="font-medium">{apiKey.name}</div>
                      {apiKey.description && (
                        <div className="text-sm text-gray-500">{apiKey.description}</div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-2">
                      <code className="text-xs bg-gray-100 px-2 py-1 rounded font-mono">
                        {formatApiKeyDisplay(apiKey.key)}
                      </code>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onCopyApiKey(apiKey.key)}
                        className="h-6 w-6 p-0 hover:bg-gray-100"
                      >
                        <Copy className="w-3 h-3" />
                      </Button>
                    </div>
                  </TableCell>
                  <TableCell>{apiKey.aiService.displayName}</TableCell>
                  <TableCell>{apiKey.user.name}</TableCell>
                  <TableCell>
                    <div className="text-sm">
                      {apiKey.quotaUsed.toString()} / {apiKey.quotaLimit?.toString() || '无限制'}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={apiKey.status === 'active' ? 'default' : 'secondary'}>
                      {apiKey.status === 'active' ? '活跃' : '禁用'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {apiKey.lastUsedAt 
                      ? new Date(apiKey.lastUsedAt).toLocaleDateString('zh-CN')
                      : '从未使用'
                    }
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm">
                      <MoreHorizontal className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="text-center py-8">
            <div className="text-gray-500 mb-4">还没有创建API密钥</div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
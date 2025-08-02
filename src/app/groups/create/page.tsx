'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ArrowLeft, Loader2, Users, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';

interface CreateGroupForm {
  name: string;
  description: string;
  maxMembers: number;
}

export default function CreateGroupPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState<CreateGroupForm>({
    name: '',
    description: '',
    maxMembers: 5
  });

  const handleInputChange = (field: keyof CreateGroupForm, value: string | number) => {
    setForm(prev => ({
      ...prev,
      [field]: value
    }));
    // 清除错误状态
    if (error) setError('');
  };

  const validateForm = (): string | null => {
    if (!form.name.trim()) {
      return '拼车组名称不能为空';
    }
    if (form.name.trim().length < 2) {
      return '拼车组名称至少需要2个字符';
    }
    if (form.name.trim().length > 50) {
      return '拼车组名称不能超过50个字符';
    }
    if (form.description.length > 200) {
      return '描述不能超过200个字符';
    }
    if (form.maxMembers < 2 || form.maxMembers > 20) {
      return '成员数量必须在2-20之间';
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    setError('');

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        router.push('/auth/login');
        return;
      }

      const response = await fetch('/api/groups', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: form.name.trim(),
          description: form.description.trim() || undefined,
          maxMembers: form.maxMembers
        })
      });

      if (response.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        router.push('/auth/login');
        return;
      }

      const data = await response.json();

      if (data.success) {
        toast.success('拼车组创建成功！');
        router.push('/groups');
      } else {
        setError(data.error || '创建拼车组失败');
      }
    } catch (error) {
      console.error('创建拼车组失败:', error);
      setError('创建拼车组失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-2xl">
      {/* 返回按钮 */}
      <div className="mb-6">
        <Button 
          variant="ghost" 
          onClick={() => router.back()}
          className="mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          返回
        </Button>
        
        <div>
          <h1 className="text-3xl font-bold">创建拼车组</h1>
          <p className="text-gray-600 mt-1">创建一个新的AI资源拼车组，邀请团队成员加入</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            拼车组信息
          </CardTitle>
          <CardDescription>
            填写拼车组的基本信息。创建后，您将成为该拼车组的管理员。
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-6">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* 组名 */}
            <div className="space-y-2">
              <Label htmlFor="name">拼车组名称 *</Label>
              <Input
                id="name"
                placeholder="例如：前端开发组"
                value={form.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                maxLength={50}
                disabled={loading}
                className={error && !form.name.trim() ? 'border-red-500' : ''}
              />
              <p className="text-xs text-gray-500">
                {form.name.length}/50 字符
              </p>
            </div>

            {/* 描述 */}
            <div className="space-y-2">
              <Label htmlFor="description">描述 (可选)</Label>
              <Textarea
                id="description"
                placeholder="描述拼车组的用途和目标..."
                value={form.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                maxLength={200}
                rows={3}
                disabled={loading}
              />
              <p className="text-xs text-gray-500">
                {form.description.length}/200 字符
              </p>
            </div>

            {/* 最大成员数 */}
            <div className="space-y-2">
              <Label htmlFor="maxMembers">最大成员数 *</Label>
              <Input
                id="maxMembers"
                type="number"
                min={2}
                max={20}
                value={form.maxMembers}
                onChange={(e) => handleInputChange('maxMembers', parseInt(e.target.value) || 2)}
                disabled={loading}
              />
              <p className="text-xs text-gray-500">
                拼车组可容纳的最大成员数量 (2-20人)
              </p>
            </div>

            {/* 提示信息 */}
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>创建后您可以：</strong>
                <ul className="list-disc list-inside mt-2 space-y-1">
                  <li>邀请成员加入拼车组</li>
                  <li>配置AI资源和访问权限</li>
                  <li>管理拼车组设置和成员角色</li>
                  <li>查看使用统计和成本分析</li>
                </ul>
              </AlertDescription>
            </Alert>

            {/* 提交按钮 */}
            <div className="flex space-x-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.back()}
                disabled={loading}
                className="flex-1"
              >
                取消
              </Button>
              <Button
                type="submit"
                disabled={loading}
                className="flex-1"
              >
                {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                创建拼车组
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
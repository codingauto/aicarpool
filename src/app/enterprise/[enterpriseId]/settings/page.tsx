'use client';

/**
 * 企业设置页面 - 简化版
 * 
 * 功能：
 * - 企业基本信息设置
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { 
  Settings,
  Building,
  Save,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  ChevronLeft,
  Building2,
  Shield
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEnterpriseContext } from '@/contexts/enterprise-context';

interface EnterpriseSettings {
  name: string;
  description: string;
  planType: string;
}

export default function EnterpriseSettingsPage({ params }: { params: Promise<{ enterpriseId: string }> }) {
  const { enterpriseId } = React.use(params);
  const router = useRouter();
  const { currentEnterprise, hasRole } = useEnterpriseContext();
  const [settings, setSettings] = useState<EnterpriseSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    fetchSettings();
  }, [enterpriseId]);

  const fetchSettings = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/enterprises/${enterpriseId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          const enterprise = data.data;
          setSettings({
            name: enterprise.name,
            description: enterprise.description || '',
            planType: enterprise.planType || 'basic'
          });
        } else {
          setError(data.message || '获取企业信息失败');
        }
      } else {
        setError('获取企业信息失败');
      }
    } catch (error) {
      console.error('获取企业信息失败:', error);
      setError('获取企业信息失败');
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    if (!settings) return;

    try {
      setSaving(true);
      setError('');
      setSuccess('');

      const token = localStorage.getItem('token');
      const response = await fetch(`/api/enterprises/${enterpriseId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(settings)
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setSuccess('企业信息保存成功');
          setTimeout(() => setSuccess(''), 3000);
        } else {
          setError(data.message || '保存失败');
        }
      } else {
        setError('保存失败');
      }
    } catch (error) {
      console.error('保存失败:', error);
      setError('保存失败');
    } finally {
      setSaving(false);
    }
  };

  const updateSettings = (field: string, value: any) => {
    if (!settings) return;

    setSettings({
      ...settings,
      [field]: value
    });
  };

  // 权限检查
  if (!(hasRole('owner') || hasRole('admin'))) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center py-12">
          <Shield className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">访问受限</h3>
          <p className="text-gray-600">您没有权限访问企业设置页面</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-40 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error && !settings) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center py-12">
          <Settings className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">设置加载失败</h3>
          <p className="text-gray-600 mb-4">{error}</p>
          <Button onClick={fetchSettings}>重试</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-6xl mx-auto">
        {/* 面包屑和标题 */}
        <div className="flex items-center gap-4 mb-6">
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => router.push(`/enterprise/${enterpriseId}/dashboard`)}
          >
            <ChevronLeft className="w-4 h-4 mr-2" />
            返回企业控制面板
          </Button>
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Building2 className="w-4 h-4" />
            <span>{currentEnterprise?.name || '未知企业'}</span>
            <span>/</span>
            <span>企业设置</span>
          </div>
        </div>

        <div className="space-y-6">
        {/* 页面标题 */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Settings className="w-6 h-6 text-blue-600" />
              企业设置
            </h1>
            <p className="text-gray-600 mt-1">
              管理企业基本信息
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={fetchSettings} disabled={loading}>
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              刷新
            </Button>
            <Button onClick={saveSettings} disabled={saving || !settings}>
              <Save className={`w-4 h-4 mr-2 ${saving ? 'animate-spin' : ''}`} />
              保存
            </Button>
          </div>
        </div>

        {/* 状态提示 */}
        {error && (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="pt-6">
              <div className="flex items-center space-x-2 text-red-600">
                <AlertTriangle className="w-4 h-4" />
                <span>{error}</span>
              </div>
            </CardContent>
          </Card>
        )}

        {success && (
          <Card className="border-green-200 bg-green-50">
            <CardContent className="pt-6">
              <div className="flex items-center space-x-2 text-green-600">
                <CheckCircle className="w-4 h-4" />
                <span>{success}</span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* 企业基本信息 */}
        {settings && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building className="w-5 h-5" />
                企业基本信息
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="name">企业名称</Label>
                  <Input
                    id="name"
                    value={settings.name}
                    onChange={(e) => updateSettings('name', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="planType">计划类型</Label>
                  <Select
                    value={settings.planType}
                    onValueChange={(value) => updateSettings('planType', value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="basic">基础版</SelectItem>
                      <SelectItem value="enterprise">企业版</SelectItem>
                      <SelectItem value="custom">定制版</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">企业描述</Label>
                <Textarea
                  id="description"
                  value={settings.description}
                  onChange={(e) => updateSettings('description', e.target.value)}
                  rows={3}
                  placeholder="请输入企业描述信息..."
                />
              </div>
            </CardContent>
          </Card>
        )}
        </div>
      </div>
    </div>
  );
}
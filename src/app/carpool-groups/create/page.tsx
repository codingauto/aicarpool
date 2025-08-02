'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  ArrowLeft, 
  Users, 
  Sparkles, 
  Zap,
  Heart,
  CheckCircle,
  Upload
} from 'lucide-react';

export default function CreateCarpoolGroupPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    avatar: null as File | null,
    expectedMembers: '5',
    aiServices: [] as string[],
    budget: '100'
  });

  const aiServiceOptions = [
    { id: 'claude', name: 'Claude Code', icon: '🤖', popular: true },
    { id: 'openai', name: 'OpenAI GPT-4', icon: '⚡', popular: true },
    { id: 'gemini', name: 'Google Gemini', icon: '✨', popular: false },
    { id: 'cursor', name: 'Cursor Pro', icon: '🎯', popular: true },
    { id: 'github', name: 'GitHub Copilot', icon: '🐙', popular: false },
  ];

  const handleServiceToggle = (serviceId: string) => {
    setFormData(prev => ({
      ...prev,
      aiServices: prev.aiServices.includes(serviceId)
        ? prev.aiServices.filter(id => id !== serviceId)
        : [...prev.aiServices, serviceId]
    }));
  };

  const handleNext = () => {
    if (step < 3) {
      setStep(step + 1);
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    } else {
      router.back();
    }
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError('');

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        router.push('/auth/login');
        return;
      }

      const response = await fetch('/api/carpool-groups', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          organizationType: 'carpool_group',
          creationTemplate: 'quick_carpool'
        }),
      });

      const data = await response.json();

      if (data.success) {
        // 创建成功，跳转到拼车组
        router.push(`/carpool-groups/${data.data.id}`);
      } else {
        setError(data.error || '创建拼车组失败');
      }
    } catch (error) {
      setError('网络错误，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* 头部 */}
      <div className="bg-white border-b">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <Button variant="ghost" onClick={handleBack} className="mr-4">
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div>
                <h1 className="text-xl font-bold text-gray-900">创建拼车组</h1>
                <p className="text-sm text-gray-500">轻量级团队AI协作解决方案</p>
              </div>
            </div>
            <div className="text-sm text-gray-500">
              步骤 {step} / 3
            </div>
          </div>
        </div>
      </div>

      {/* 进度条 */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        <div className="flex items-center mb-8">
          {[1, 2, 3].map((stepNum) => (
            <div key={stepNum} className="flex items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                stepNum <= step 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-200 text-gray-500'
              }`}>
                {stepNum < step ? <CheckCircle className="w-5 h-5" /> : stepNum}
              </div>
              {stepNum < 3 && (
                <div className={`w-16 h-1 mx-2 ${
                  stepNum < step ? 'bg-blue-600' : 'bg-gray-200'
                }`} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* 主内容 */}
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {step === 1 && (
          <Card>
            <CardHeader className="text-center">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Users className="w-8 h-8 text-blue-600" />
              </div>
              <CardTitle>基础信息</CardTitle>
              <CardDescription>
                为您的拼车组起个好名字，让团队成员更容易识别
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <Label htmlFor="name">拼车组名称 *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({...prev, name: e.target.value}))}
                  placeholder="例如：前端开发小组、AI学习组"
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="description">拼车组描述</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({...prev, description: e.target.value}))}
                  placeholder="简单描述一下这个拼车组的用途和目标"
                  className="mt-1"
                  rows={3}
                />
              </div>

              <div>
                <Label htmlFor="members">预期成员数量</Label>
                <Input
                  id="members"
                  type="number"
                  value={formData.expectedMembers}
                  onChange={(e) => setFormData(prev => ({...prev, expectedMembers: e.target.value}))}
                  placeholder="5"
                  className="mt-1"
                  min="2"
                  max="15"
                />
                <p className="text-xs text-gray-500 mt-1">
                  拼车组建议2-15人，便于灵活管理和成本控制
                </p>
              </div>

              <Button 
                onClick={handleNext} 
                className="w-full" 
                disabled={!formData.name.trim()}
              >
                下一步：选择AI服务
              </Button>
            </CardContent>
          </Card>
        )}

        {step === 2 && (
          <Card>
            <CardHeader className="text-center">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Sparkles className="w-8 h-8 text-blue-600" />
              </div>
              <CardTitle>选择AI服务</CardTitle>
              <CardDescription>
                选择要一起拼车的AI编程工具，可以多选
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3">
                {aiServiceOptions.map((service) => (
                  <div
                    key={service.id}
                    className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                      formData.aiServices.includes(service.id)
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                    onClick={() => handleServiceToggle(service.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <span className="text-2xl">{service.icon}</span>
                        <div>
                          <div className="font-medium text-gray-900">
                            {service.name}
                            {service.popular && (
                              <span className="ml-2 text-xs bg-orange-100 text-orange-800 px-2 py-1 rounded-full">
                                热门
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      {formData.aiServices.includes(service.id) && (
                        <CheckCircle className="w-5 h-5 text-blue-600" />
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex space-x-3 pt-4">
                <Button variant="outline" onClick={handleBack} className="flex-1">
                  上一步
                </Button>
                <Button 
                  onClick={handleNext} 
                  className="flex-1"
                  disabled={formData.aiServices.length === 0}
                >
                  下一步：完成创建
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {step === 3 && (
          <Card>
            <CardHeader className="text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Heart className="w-8 h-8 text-green-600" />
              </div>
              <CardTitle>确认创建</CardTitle>
              <CardDescription>
                检查信息无误后，点击创建拼车组
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* 信息预览 */}
              <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                <div>
                  <span className="text-sm text-gray-500">拼车组名称</span>
                  <p className="font-medium">{formData.name}</p>
                </div>
                {formData.description && (
                  <div>
                    <span className="text-sm text-gray-500">描述</span>
                    <p className="text-sm">{formData.description}</p>
                  </div>
                )}
                <div>
                  <span className="text-sm text-gray-500">预期成员</span>
                  <p className="text-sm">{formData.expectedMembers}人</p>
                </div>
                <div>
                  <span className="text-sm text-gray-500">选择的AI服务</span>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {formData.aiServices.map(serviceId => {
                      const service = aiServiceOptions.find(s => s.id === serviceId);
                      return (
                        <span key={serviceId} className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                          {service?.name}
                        </span>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* 下一步提示 */}
              <div className="bg-blue-50 rounded-lg p-4">
                <h4 className="font-medium text-blue-900 mb-2">创建后您可以：</h4>
                <ul className="text-sm text-blue-800 space-y-1">
                  <li>• 邀请团队成员加入拼车组</li>
                  <li>• 绑定AI账号开始使用</li>
                  <li>• 查看使用统计和成本分摊</li>
                  <li>• 管理拼车组设置和权限</li>
                </ul>
              </div>

              <div className="flex space-x-3">
                <Button variant="outline" onClick={handleBack} className="flex-1">
                  上一步
                </Button>
                <Button 
                  onClick={handleSubmit} 
                  className="flex-1 bg-green-600 hover:bg-green-700"
                  disabled={loading}
                >
                  {loading ? '创建中...' : '创建拼车组'}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
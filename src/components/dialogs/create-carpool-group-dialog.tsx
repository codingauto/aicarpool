'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Users, 
  Sparkles, 
  Heart,
  CheckCircle,
  ArrowRight,
  ArrowLeft
} from 'lucide-react';

interface CreateCarpoolGroupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function CreateCarpoolGroupDialog({ open, onOpenChange, onSuccess }: CreateCarpoolGroupDialogProps) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
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
    }
  };

  const handleClose = () => {
    setStep(1);
    setFormData({
      name: '',
      description: '',
      expectedMembers: '5',
      aiServices: [],
      budget: '100'
    });
    setError('');
    onOpenChange(false);
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
        handleClose();
        if (onSuccess) {
          onSuccess();
        }
        // 创建成功后跳转到拼车组
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gray-100 rounded-md flex items-center justify-center">
              <span className="text-lg">🚗</span>
            </div>
            创建拼车组
          </DialogTitle>
          <DialogDescription>
            轻量级团队AI协作解决方案 • 步骤 {step} / 3
          </DialogDescription>
        </DialogHeader>

        {/* 进度条 */}
        <div className="flex items-center mb-6">
          {[1, 2, 3].map((stepNum) => (
            <div key={stepNum} className="flex items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                stepNum <= step 
                  ? 'bg-gray-900 text-white' 
                  : 'bg-gray-200 text-gray-500'
              }`}>
                {stepNum < step ? <CheckCircle className="w-4 h-4" /> : stepNum}
              </div>
              {stepNum < 3 && (
                <div className={`w-12 h-1 mx-2 rounded-full transition-colors ${
                  stepNum < step ? 'bg-gray-900' : 'bg-gray-200'
                }`} />
              )}
            </div>
          ))}
        </div>

        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {step === 1 && (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <div className="w-12 h-12 bg-gray-100 rounded-md flex items-center justify-center mx-auto mb-4">
                <Users className="w-5 h-5 text-gray-700" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">基础信息</h3>
              <p className="text-sm text-gray-600">
                为您的拼车组起个好名字，让团队成员更容易识别
              </p>
            </div>

            <div className="space-y-4">
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
            </div>

            <div className="flex justify-end">
              <Button 
                onClick={handleNext} 
                disabled={!formData.name.trim()}
                size="sm"
              >
                下一步
                <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <div className="w-12 h-12 bg-gray-100 rounded-md flex items-center justify-center mx-auto mb-4">
                <Sparkles className="w-5 h-5 text-gray-700" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">选择AI服务</h3>
              <p className="text-sm text-gray-600">
                选择要一起拼车的AI编程工具，可以多选
              </p>
            </div>

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

            <div className="flex space-x-3">
              <Button variant="outline" onClick={handleBack} className="flex-1">
                <ArrowLeft className="w-4 h-4 mr-2" />
                上一步
              </Button>
              <Button 
                onClick={handleNext} 
                className="flex-1"
                disabled={formData.aiServices.length === 0}
              >
                下一步
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Heart className="w-8 h-8 text-green-600" />
              </div>
              <h3 className="text-lg font-semibold">确认创建</h3>
              <p className="text-sm text-gray-600">
                检查信息无误后，点击创建拼车组
              </p>
            </div>

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
                <ArrowLeft className="w-4 h-4 mr-2" />
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
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
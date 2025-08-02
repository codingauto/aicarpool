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
  Building2, 
  Users, 
  Settings,
  Shield,
  CheckCircle,
  ArrowRight,
  ArrowLeft
} from 'lucide-react';

interface CreateEnterpriseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function CreateEnterpriseDialog({ open, onOpenChange, onSuccess }: CreateEnterpriseDialogProps) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    industry: '',
    expectedSize: '50',
    planType: 'professional',
    features: [] as string[]
  });

  const industryOptions = [
    '软件开发', '互联网', '人工智能', '金融科技', '电商', 
    '游戏', '教育', '医疗健康', '制造业', '其他'
  ];

  const featureOptions = [
    { id: 'advanced_analytics', name: '高级数据分析', description: '深度使用统计和成本分析' },
    { id: 'department_management', name: '部门管理', description: '多部门组织架构管理' },
    { id: 'advanced_permissions', name: '高级权限管理', description: '细粒度权限控制' },
    { id: 'api_integration', name: 'API集成', description: '企业系统集成能力' },
    { id: 'audit_logs', name: '审计日志', description: '详细的操作审计记录' },
    { id: 'sso_integration', name: 'SSO集成', description: '单点登录集成' }
  ];

  const handleFeatureToggle = (featureId: string) => {
    setFormData(prev => ({
      ...prev,
      features: prev.features.includes(featureId)
        ? prev.features.filter(id => id !== featureId)
        : [...prev.features, featureId]
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
      industry: '',
      expectedSize: '50',
      planType: 'professional',
      features: []
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

      const response = await fetch('/api/enterprises', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          organizationType: 'enterprise',
          creationTemplate: 'full_enterprise'
        }),
      });

      const data = await response.json();

      if (data.success) {
        handleClose();
        if (onSuccess) {
          onSuccess();
        }
        // 创建成功后跳转到企业
        router.push(`/enterprise/${data.data.id}/dashboard`);
      } else {
        setError(data.error || '创建企业失败');
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
            <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
              <Building2 className="w-5 h-5 text-purple-600" />
            </div>
            创建企业
          </DialogTitle>
          <DialogDescription>
            完整企业级AI资源管理平台 • 步骤 {step} / 3
          </DialogDescription>
        </DialogHeader>

        {/* 进度条 */}
        <div className="flex items-center mb-6">
          {[1, 2, 3].map((stepNum) => (
            <div key={stepNum} className="flex items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                stepNum <= step 
                  ? 'bg-purple-600 text-white' 
                  : 'bg-gray-200 text-gray-500'
              }`}>
                {stepNum < step ? <CheckCircle className="w-5 h-5" /> : stepNum}
              </div>
              {stepNum < 3 && (
                <div className={`w-12 h-1 mx-2 ${
                  stepNum < step ? 'bg-purple-600' : 'bg-gray-200'
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
              <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Building2 className="w-8 h-8 text-purple-600" />
              </div>
              <h3 className="text-lg font-semibold">企业基础信息</h3>
              <p className="text-sm text-gray-600">
                填写您企业的基本信息，为后续配置做准备
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <Label htmlFor="name">企业名称 *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({...prev, name: e.target.value}))}
                  placeholder="例如：科技有限公司、创新研发中心"
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="description">企业描述</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({...prev, description: e.target.value}))}
                  placeholder="简单介绍您的企业和主要业务"
                  className="mt-1"
                  rows={3}
                />
              </div>

              <div>
                <Label htmlFor="industry">所属行业</Label>
                <select
                  id="industry"
                  value={formData.industry}
                  onChange={(e) => setFormData(prev => ({...prev, industry: e.target.value}))}
                  className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                >
                  <option value="">请选择行业</option>
                  {industryOptions.map(industry => (
                    <option key={industry} value={industry}>{industry}</option>
                  ))}
                </select>
              </div>

              <div>
                <Label htmlFor="size">预期规模</Label>
                <Input
                  id="size"
                  type="number"
                  value={formData.expectedSize}
                  onChange={(e) => setFormData(prev => ({...prev, expectedSize: e.target.value}))}
                  placeholder="50"
                  className="mt-1"
                  min="10"
                  max="10000"
                />
                <p className="text-xs text-gray-500 mt-1">
                  企业员工数量，用于推荐合适的功能配置
                </p>
              </div>
            </div>

            <div className="flex justify-end">
              <Button 
                onClick={handleNext} 
                disabled={!formData.name.trim()}
                className="px-6 bg-purple-600 hover:bg-purple-700"
              >
                下一步
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Settings className="w-8 h-8 text-purple-600" />
              </div>
              <h3 className="text-lg font-semibold">功能配置</h3>
              <p className="text-sm text-gray-600">
                选择适合您企业的高级功能模块
              </p>
            </div>

            <div className="space-y-3">
              {featureOptions.map((feature) => (
                <div
                  key={feature.id}
                  className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                    formData.features.includes(feature.id)
                      ? 'border-purple-500 bg-purple-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => handleFeatureToggle(feature.id)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="font-medium text-gray-900 mb-1">
                        {feature.name}
                      </div>
                      <div className="text-sm text-gray-600">
                        {feature.description}
                      </div>
                    </div>
                    {formData.features.includes(feature.id) && (
                      <CheckCircle className="w-5 h-5 text-purple-600 flex-shrink-0 ml-3" />
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
                className="flex-1 bg-purple-600 hover:bg-purple-700"
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
                <Shield className="w-8 h-8 text-green-600" />
              </div>
              <h3 className="text-lg font-semibold">确认创建</h3>
              <p className="text-sm text-gray-600">
                检查企业信息无误后，点击创建企业
              </p>
            </div>

            {/* 信息预览 */}
            <div className="bg-gray-50 rounded-lg p-4 space-y-3">
              <div>
                <span className="text-sm text-gray-500">企业名称</span>
                <p className="font-medium">{formData.name}</p>
              </div>
              {formData.description && (
                <div>
                  <span className="text-sm text-gray-500">企业描述</span>
                  <p className="text-sm">{formData.description}</p>
                </div>
              )}
              {formData.industry && (
                <div>
                  <span className="text-sm text-gray-500">所属行业</span>
                  <p className="text-sm">{formData.industry}</p>
                </div>
              )}
              <div>
                <span className="text-sm text-gray-500">预期规模</span>
                <p className="text-sm">{formData.expectedSize}人</p>
              </div>
              {formData.features.length > 0 && (
                <div>
                  <span className="text-sm text-gray-500">选择的功能</span>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {formData.features.map(featureId => {
                      const feature = featureOptions.find(f => f.id === featureId);
                      return (
                        <span key={featureId} className="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded-full">
                          {feature?.name}
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* 下一步提示 */}
            <div className="bg-purple-50 rounded-lg p-4">
              <h4 className="font-medium text-purple-900 mb-2">创建后您可以：</h4>
              <ul className="text-sm text-purple-800 space-y-1">
                <li>• 设置企业组织架构和部门</li>
                <li>• 邀请管理员和员工加入</li>
                <li>• 配置企业级AI账号池</li>
                <li>• 管理拼车组和权限分配</li>
                <li>• 查看详细的使用分析报告</li>
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
                {loading ? '创建中...' : '创建企业'}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
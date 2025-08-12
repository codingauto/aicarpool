import React, { useState } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Eye, EyeOff } from 'lucide-react';
import { FormErrors } from '@/types/ai-account';
import { toast } from 'sonner';

interface ClaudeConsoleConfigProps {
  form: {
    apiUrl?: string;
    apiKey?: string;
    supportedModels?: string;
    userAgent?: string;
    rateLimitDuration: number;
    priority: number;
  };
  errors: FormErrors;
  onFormChange: (updates: Partial<ClaudeConsoleConfigProps['form']>) => void;
}

export function ClaudeConsoleConfig({ form, errors, onFormChange }: ClaudeConsoleConfigProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [apiMode, setApiMode] = useState<'native' | 'proxy'>('proxy');
  const [selectedProxy, setSelectedProxy] = useState('tongyi-qianwen-3');

  // 初始化默认值
  React.useEffect(() => {
    if (!form.apiUrl) {
      onFormChange({
        apiUrl: 'https://qwen-api.aliyun.com/v1'
      });
    }
  }, []);

  const addPresetModel = (modelName: string) => {
    const currentModels = form.supportedModels
      ? form.supportedModels.split('\n').filter(m => m.trim())
      : [];
    
    if (currentModels.includes(modelName)) {
      toast.info(`模型 ${modelName} 已存在`);
      return;
    }
    
    currentModels.push(modelName);
    onFormChange({
      supportedModels: currentModels.join('\n')
    });
    toast.success(`已添加模型 ${modelName}`);
  };

  // 处理代理服务选择
  const handleProxyChange = (proxyService: string) => {
    setSelectedProxy(proxyService);
    const proxyUrls = {
      'kimi-k2': 'https://kimi-api.example.com/v1',
      'tongyi-qianwen-3': 'https://qwen-api.aliyun.com/v1',
      'zhipu-glm-4.5': 'https://zhipu-api.example.com/v1',
      'custom': ''
    };
    onFormChange({
      apiUrl: proxyUrls[proxyService as keyof typeof proxyUrls] || ''
    });
  };

  // 处理API模式切换
  const handleApiModeChange = (mode: 'native' | 'proxy') => {
    setApiMode(mode);
    if (mode === 'native') {
      onFormChange({ apiUrl: 'https://api.anthropic.com/v1' });
    } else {
      handleProxyChange(selectedProxy);
    }
  };

  return (
    <div className="space-y-4">
      {/* API模式选择 */}
      <div>
        <Label className="text-sm font-semibold">Console模式选择</Label>
        <RadioGroup 
          value={apiMode} 
          onValueChange={(value) => handleApiModeChange(value as 'native' | 'proxy')}
          className="mt-3 space-y-3"
        >
          <div className="flex items-start space-x-3">
            <RadioGroupItem value="native" id="native-api" className="mt-1" />
            <div className="flex-1">
              <Label htmlFor="native-api" className="text-sm font-medium">原生API (需要官方API Key)</Label>
              <p className="text-xs text-gray-500 mt-1">直接使用Claude官方API接口</p>
            </div>
          </div>
          
          <div className="flex items-start space-x-3">
            <RadioGroupItem value="proxy" id="proxy-service" className="mt-1" />
            <div className="flex-1">
              <Label htmlFor="proxy-service" className="text-sm font-medium">中转服务</Label>
              <p className="text-xs text-gray-500 mt-1">使用第三方中转服务</p>
              
              {/* 中转服务选择 */}
              {apiMode === 'proxy' && (
                <div className="mt-3 space-y-2">
                  <div className="flex flex-wrap gap-2">
                    {[
                      { value: 'kimi-k2', label: 'Kimi k2', icon: '○' },
                      { value: 'tongyi-qianwen-3', label: '通义千问 3', icon: '●' },
                      { value: 'zhipu-glm-4.5', label: '智谱GLM 4.5', icon: '○' },
                      { value: 'custom', label: '自定义中转', icon: '○' }
                    ].map((service) => (
                      <Button
                        key={service.value}
                        type="button"
                        variant={selectedProxy === service.value ? "default" : "outline"}
                        size="sm"
                        onClick={() => handleProxyChange(service.value)}
                        className="text-xs"
                      >
                        <span className="mr-1">
                          {selectedProxy === service.value ? '●' : '○'}
                        </span>
                        {service.label}
                      </Button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </RadioGroup>
      </div>

      {/* API URL配置 */}
      <div>
        <Label htmlFor="apiUrl" className="text-sm font-semibold">API Endpoint:</Label>
        <Input
          id="apiUrl"
          value={form.apiUrl}
          onChange={(e) => onFormChange({ apiUrl: e.target.value })}
          placeholder="https://qwen-api.aliyun.com/v1"
          className={`mt-2 ${errors.apiUrl ? 'border-red-500' : ''}`}
        />
        {errors.apiUrl && (
          <p className="text-red-500 text-xs mt-1">{errors.apiUrl}</p>
        )}
      </div>

      {/* API Key配置 */}
      <div>
        <Label htmlFor="apiKey" className="text-sm font-semibold">API Key:</Label>
        <div className="relative">
          <Input
            id="apiKey"
            type={showPassword ? 'text' : 'password'}
            value={form.apiKey}
            onChange={(e) => onFormChange({ apiKey: e.target.value })}
            placeholder="sk-********************************"
            className={`pr-10 mt-2 ${errors.apiKey ? 'border-red-500' : ''}`}
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6 p-0"
            onClick={() => setShowPassword(!showPassword)}
          >
            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </Button>
        </div>
        {errors.apiKey && (
          <p className="text-red-500 text-xs mt-1">{errors.apiKey}</p>
        )}
      </div>

      {/* 模型配置 - 只在原生API模式下显示 */}
      {apiMode === 'native' && (
        <div>
          <Label className="text-sm font-semibold">支持的模型 (可选) -- 注意，ClaudeCode必须加上haiku模型！</Label>
          <div className="mb-2 flex gap-2 flex-wrap">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => addPresetModel('claude-sonnet-4-20250514')}
            >
              + claude-sonnet-4-20250514
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => addPresetModel('claude-opus-4-20250514')}
            >
              + claude-opus-4-20250514
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => addPresetModel('claude-3-5-haiku-20241022')}
            >
              + claude-3-5-haiku-20241022
            </Button>
          </div>
          <Textarea
            value={form.supportedModels}
            onChange={(e) => onFormChange({ supportedModels: e.target.value })}
            placeholder="每行一个模型，留空表示支持所有模型。特别注意,ClaudeCode必须加上haiku模型！"
            rows={3}
          />
          <p className="text-xs text-gray-500 mt-1">
            留空表示支持所有模型。如果指定模型，请求中的模型不在列表内将不会调度到此账号
          </p>
        </div>
      )}

      {/* 中转服务模式的说明 */}
      {apiMode === 'proxy' && (
        <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
          <div className="flex items-start gap-2">
            <div className="text-blue-500 text-sm">ℹ️</div>
            <div>
              <p className="text-sm font-medium text-blue-900">中转服务模型说明</p>
              <p className="text-xs text-blue-700 mt-1">
                {selectedProxy === 'tongyi-qianwen-3' && '通义千问3中转服务支持主流Claude模型，具体支持列表由中转服务商决定'}
                {selectedProxy === 'kimi-k2' && 'Kimi k2中转服务支持的模型列表由服务商决定'}
                {selectedProxy === 'zhipu-glm-4.5' && '智谱GLM中转服务支持的模型列表由服务商决定'}
                {selectedProxy === 'custom' && '自定义中转服务的模型支持情况请咨询服务商'}
              </p>
            </div>
          </div>
        </div>
      )}

      <div>
        <Label htmlFor="userAgent" className="text-sm font-semibold">自定义 User-Agent (可选)</Label>
        <Input
          id="userAgent"
          value={form.userAgent}
          onChange={(e) => onFormChange({ userAgent: e.target.value })}
          placeholder="默认：claude-cli/1.0.61 (console, cli)"
        />
      </div>

      <div>
        <Label htmlFor="rateLimitDuration" className="text-sm font-semibold">限流时间 (分钟)</Label>
        <Input
          id="rateLimitDuration"
          type="number"
          min="1"
          value={form.rateLimitDuration}
          onChange={(e) => onFormChange({ rateLimitDuration: parseInt(e.target.value) || 60 })}
          placeholder="默认60分钟"
        />
        <p className="text-xs text-gray-500 mt-1">
          当账号返回429错误时，暂停调度的时间（分钟）
        </p>
      </div>

      <div>
        <Label htmlFor="priority" className="text-sm font-semibold">调度优先级 (1-100)</Label>
        <Input
          id="priority"
          type="number"
          min="1"
          max="100"
          value={form.priority}
          onChange={(e) => onFormChange({ priority: parseInt(e.target.value) || 50 })}
          placeholder="数字越小优先级越高，默认50"
        />
        <p className="text-xs text-gray-500 mt-1">
          数字越小优先级越高，建议范围：1-100
        </p>
      </div>
    </div>
  );
}

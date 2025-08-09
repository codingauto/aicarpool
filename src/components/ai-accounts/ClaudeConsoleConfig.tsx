import React, { useState } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
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

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="apiUrl" className="text-sm font-semibold">API URL *</Label>
        <Input
          id="apiUrl"
          value={form.apiUrl}
          onChange={(e) => onFormChange({ apiUrl: e.target.value })}
          placeholder="例如：https://api.example.com"
          className={errors.apiUrl ? 'border-red-500' : ''}
        />
        {errors.apiUrl && (
          <p className="text-red-500 text-xs mt-1">{errors.apiUrl}</p>
        )}
      </div>

      <div>
        <Label htmlFor="apiKey" className="text-sm font-semibold">API Key *</Label>
        <div className="relative">
          <Input
            id="apiKey"
            type={showPassword ? 'text' : 'password'}
            value={form.apiKey}
            onChange={(e) => onFormChange({ apiKey: e.target.value })}
            placeholder="请输入API Key"
            className={`pr-10 ${errors.apiKey ? 'border-red-500' : ''}`}
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

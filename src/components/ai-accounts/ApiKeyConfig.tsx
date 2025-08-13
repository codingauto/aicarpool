import React, { useState } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Eye, EyeOff } from 'lucide-react';
import { FormErrors } from '@/types/ai-account';
import { toast } from 'sonner';

interface ApiKeyConfigProps {
  form: {
    apiUrl?: string;
    apiKey?: string;
    supportedModels?: string;
    userAgent?: string;
    rateLimitDuration: number;
    priority: number;
  };
  errors: FormErrors;
  onFormChange: (updates: Partial<ApiKeyConfigProps['form']>) => void;
  platform: string;
  platformName: string;
}

export function ApiKeyConfig({ form, errors, onFormChange, platform, platformName }: ApiKeyConfigProps) {
  const [showApiKey, setShowApiKey] = useState(false);

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

  // 根据平台获取预设模型
  const getPresetModels = () => {
    switch (platform) {
      case 'qwen':
        return [
          'qwen-turbo',
          'qwen-plus',
          'qwen-max',
          'qwen-math-plus',
          'qwen-coder-plus'
        ];
      case 'cursor-agent':
        return [
          'cursor-agent-v1',
          'cursor-agent-fast'
        ];
      case 'codex':
        return [
          'gpt-4-turbo',
          'gpt-4',
          'gpt-3.5-turbo-instruct'
        ];
      case 'ampcode':
        return [
          'ampcode-claude-4-sonnet',
          'ampcode-claude-3.5-sonnet'
        ];
      default:
        return [];
    }
  };

  return (
    <div className="space-y-4">
      {/* API URL */}
      <div>
        <Label htmlFor="apiUrl" className="text-sm font-semibold">API URL</Label>
        <Input
          id="apiUrl"
          value={form.apiUrl || ''}
          onChange={(e) => onFormChange({ apiUrl: e.target.value })}
          placeholder={`${platformName} API 地址`}
          className={errors.apiUrl ? 'border-red-500' : ''}
        />
        {errors.apiUrl && <p className="text-red-500 text-xs mt-1">{errors.apiUrl}</p>}
      </div>

      {/* API Key */}
      <div>
        <Label htmlFor="apiKey" className="text-sm font-semibold">API Key</Label>
        <div className="relative">
          <Input
            id="apiKey"
            type={showApiKey ? 'text' : 'password'}
            value={form.apiKey || ''}
            onChange={(e) => onFormChange({ apiKey: e.target.value })}
            placeholder={`${platformName} API 密钥`}
            className={errors.apiKey ? 'border-red-500 pr-10' : 'pr-10'}
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
            onClick={() => setShowApiKey(!showApiKey)}
          >
            {showApiKey ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
          </Button>
        </div>
        {errors.apiKey && <p className="text-red-500 text-xs mt-1">{errors.apiKey}</p>}
      </div>

      {/* 支持的模型 */}
      <div>
        <Label htmlFor="supportedModels" className="text-sm font-semibold">支持的模型</Label>
        <Textarea
          id="supportedModels"
          value={form.supportedModels || ''}
          onChange={(e) => onFormChange({ supportedModels: e.target.value })}
          placeholder="每行一个模型名称"
          rows={4}
        />
        
        {/* 预设模型快速添加 */}
        {getPresetModels().length > 0 && (
          <div className="mt-2">
            <p className="text-xs text-gray-500 mb-2">预设模型：</p>
            <div className="flex flex-wrap gap-2">
              {getPresetModels().map((model) => (
                <Button
                  key={model}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => addPresetModel(model)}
                  className="text-xs"
                >
                  + {model}
                </Button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 用户代理 */}
      <div>
        <Label htmlFor="userAgent" className="text-sm font-semibold">User Agent (可选)</Label>
        <Input
          id="userAgent"
          value={form.userAgent || ''}
          onChange={(e) => onFormChange({ userAgent: e.target.value })}
          placeholder="自定义用户代理字符串"
        />
      </div>

      {/* 速率限制时长 */}
      <div>
        <Label htmlFor="rateLimitDuration" className="text-sm font-semibold">速率限制时长 (秒)</Label>
        <Input
          id="rateLimitDuration"
          type="number"
          min="1"
          max="3600"
          value={form.rateLimitDuration}
          onChange={(e) => onFormChange({ rateLimitDuration: parseInt(e.target.value) || 60 })}
          placeholder="60"
        />
        <p className="text-xs text-gray-500 mt-1">
          API请求间隔限制，建议范围：10-3600秒
        </p>
      </div>

      {/* 平台特定说明 */}
      <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
        <div className="flex items-start gap-2">
          <div className="text-blue-500 text-sm">ℹ️</div>
          <div>
            <p className="text-sm font-medium text-blue-900">{platformName} 配置说明</p>
            <p className="text-xs text-blue-700 mt-1">
              {platform === 'qwen' && '通义千问是阿里云的大语言模型服务，支持多种对话和生成任务。请确保API Key具有足够的权限。'}
              {platform === 'cursor-agent' && 'Cursor Agent 是专为编程设计的AI助手，支持代码生成、分析和优化功能。'}
              {platform === 'codex' && 'OpenAI Codex (已被GPT-4替代) 是强大的代码生成模型，建议使用最新的GPT-4模型。'}
              {platform === 'ampcode' && 'AmpCode 是基于Claude的编程助手，提供高质量的代码生成和编程辅助功能。'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

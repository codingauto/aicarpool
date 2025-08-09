import React from 'react';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Info } from 'lucide-react';
import { FormErrors } from '@/types/ai-account';

interface ManualTokenInputProps {
  platform: 'claude' | 'gemini';
  form: {
    accessToken?: string;
    refreshToken?: string;
  };
  errors: FormErrors;
  onFormChange: (updates: any) => void;
  show: boolean;
}

export function ManualTokenInput({ platform, form, errors, onFormChange, show }: ManualTokenInputProps) {
  if (!show) return null;

  return (
    <div className="space-y-4 bg-blue-50 p-4 rounded-lg border border-blue-200">
      <div className="flex items-start gap-3 mb-4">
        <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center flex-shrink-0">
          <Info className="w-4 h-4 text-white" />
        </div>
        <div>
          <h5 className="font-semibold text-blue-900 mb-2">手动输入 Token</h5>
          <p className="text-sm text-blue-800 mb-2">
            {platform === 'claude' 
              ? '请输入有效的 Claude Access Token。如果您有 Refresh Token，建议也一并填写以支持自动刷新。'
              : '请输入有效的 Gemini Access Token。如果您有 Refresh Token，建议也一并填写以支持自动刷新。'
            }
          </p>
          <div className="bg-white/80 rounded-lg p-3 mt-2 mb-2 border border-blue-300">
            <p className="text-sm text-blue-900 font-medium mb-1">
              ⚠️ 重要提示：
            </p>
            <p className="text-xs text-blue-800">
              {platform === 'claude'
                ? '请勿使用 Claude 官网 API Keys 页面的密钥。'
                : '请从已登录 Gemini CLI 的机器上获取 ~/.config/gemini/credentials.json 文件中的凭证。'
              }
            </p>
          </div>
          <p className="text-xs text-blue-600">
            💡 如果未填写 Refresh Token，Token 过期后需要手动更新。
          </p>
        </div>
      </div>

      <div>
        <Label htmlFor="accessToken" className="text-sm font-semibold">Access Token *</Label>
        <Textarea
          id="accessToken"
          value={form.accessToken}
          onChange={(e) => onFormChange({ accessToken: e.target.value })}
          placeholder="请输入 Access Token..."
          rows={4}
          className={`font-mono text-xs ${errors.accessToken ? 'border-red-500' : ''}`}
        />
        {errors.accessToken && (
          <p className="text-red-500 text-xs mt-1">{errors.accessToken}</p>
        )}
      </div>

      <div>
        <Label htmlFor="refreshToken" className="text-sm font-semibold">Refresh Token (可选)</Label>
        <Textarea
          id="refreshToken"
          value={form.refreshToken}
          onChange={(e) => onFormChange({ refreshToken: e.target.value })}
          placeholder="请输入 Refresh Token..."
          rows={4}
          className="font-mono text-xs"
        />
      </div>
    </div>
  );
}

import React from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Info } from 'lucide-react';
import { FormErrors } from '@/types/ai-account';

interface BasicInfoFormProps {
  form: {
    name: string;
    description: string;
    accountType: 'shared' | 'dedicated' | 'group';
    projectId?: string;
    priority: number;
  };
  errors: FormErrors;
  platform: 'claude' | 'gemini' | 'claude-console';
  onFormChange: (updates: any) => void;
}

export function BasicInfoForm({ form, errors, platform, onFormChange }: BasicInfoFormProps) {
  return (
    <div className="space-y-6">
      {/* 账户名称 */}
      <div>
        <Label htmlFor="name" className="text-sm font-semibold">账户名称</Label>
        <Input
          id="name"
          value={form.name}
          onChange={(e) => onFormChange({ name: e.target.value })}
          placeholder="为账户设置一个易识别的名称"
          className={errors.name ? 'border-red-500' : ''}
        />
        {errors.name && (
          <p className="text-red-500 text-xs mt-1">{errors.name}</p>
        )}
      </div>

      {/* 描述 */}
      <div>
        <Label htmlFor="description" className="text-sm font-semibold">描述 (可选)</Label>
        <Textarea
          id="description"
          value={form.description}
          onChange={(e) => onFormChange({ description: e.target.value })}
          placeholder="账户用途说明..."
          rows={3}
        />
      </div>

      {/* 账户类型 */}
      <div>
        <Label className="text-sm font-semibold">账户类型</Label>
        <RadioGroup 
          value={form.accountType} 
          onValueChange={(value) => onFormChange({ accountType: value })}
          className="flex gap-4 mt-3"
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="shared" id="shared" />
            <Label htmlFor="shared">共享账户</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="dedicated" id="dedicated" />
            <Label htmlFor="dedicated">专属账户</Label>
          </div>
        </RadioGroup>
        <p className="text-xs text-gray-500 mt-2">
          共享账户：供所有API Key使用；专属账户：仅供特定API Key使用
        </p>
      </div>

      {/* Gemini 项目 ID */}
      {platform === 'gemini' && (
        <div>
          <Label htmlFor="projectId" className="text-sm font-semibold">项目 ID (可选)</Label>
          <Input
            id="projectId"
            value={form.projectId}
            onChange={(e) => onFormChange({ projectId: e.target.value })}
            placeholder="例如：verdant-wares-464411-k9"
          />
          <div className="mt-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="flex items-start gap-2">
              <Info className="w-4 h-4 text-yellow-600 mt-0.5 flex-shrink-0" />
              <div className="text-xs text-yellow-700">
                <p className="font-medium mb-1">Google Cloud/Workspace 账号需要提供项目 ID</p>
                <p>某些 Google 账号（特别是绑定了 Google Cloud 的账号）会被识别为 Workspace 账号，需要提供额外的项目 ID。</p>
                <p className="mt-2">
                  <strong>提示：</strong>如果您的账号是普通个人账号（未绑定 Google Cloud），请留空此字段。
                  OAuth 授权时，如果账号被识别为 Workspace 账号但未提供项目 ID，系统将提示确认。
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 调度优先级 */}
      {(platform === 'claude' || platform === 'claude-console') && (
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
      )}
    </div>
  );
}

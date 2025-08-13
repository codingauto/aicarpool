import React from 'react';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

interface PlatformSelectorProps {
  platform: 'claude' | 'gemini' | 'claude-console' | 'qwen' | 'cursor-agent' | 'codex' | 'ampcode';
  onPlatformChange: (platform: 'claude' | 'gemini' | 'claude-console' | 'qwen' | 'cursor-agent' | 'codex' | 'ampcode') => void;
}

export function PlatformSelector({ platform, onPlatformChange }: PlatformSelectorProps) {
  return (
    <div>
      <Label className="text-sm font-semibold">AI 平台</Label>
      <RadioGroup 
        value={platform} 
        onValueChange={(value) => onPlatformChange(value as any)}
        className="grid grid-cols-2 gap-3 mt-3"
      >
        {/* 国际平台 */}
        <div className="col-span-2">
          <div className="text-xs text-gray-500 mb-2">国际平台</div>
        </div>
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="claude" id="claude" />
          <Label htmlFor="claude">Claude</Label>
        </div>
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="claude-console" id="claude-console" />
          <Label htmlFor="claude-console">Claude Console</Label>
        </div>
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="gemini" id="gemini" />
          <Label htmlFor="gemini">Gemini</Label>
        </div>
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="cursor-agent" id="cursor-agent" />
          <Label htmlFor="cursor-agent">Cursor Agent</Label>
        </div>
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="codex" id="codex" />
          <Label htmlFor="codex">OpenAI Codex</Label>
        </div>
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="ampcode" id="ampcode" />
          <Label htmlFor="ampcode">AmpCode</Label>
        </div>
        
        {/* 国内平台 */}
        <div className="col-span-2 mt-4">
          <div className="text-xs text-gray-500 mb-2">国内平台</div>
        </div>
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="qwen" id="qwen" />
          <Label htmlFor="qwen">通义千问</Label>
        </div>
      </RadioGroup>
    </div>
  );
}

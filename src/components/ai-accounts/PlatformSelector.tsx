import React from 'react';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

interface PlatformSelectorProps {
  platform: 'claude' | 'gemini' | 'claude-console';
  onPlatformChange: (platform: 'claude' | 'gemini' | 'claude-console') => void;
}

export function PlatformSelector({ platform, onPlatformChange }: PlatformSelectorProps) {
  return (
    <div>
      <Label className="text-sm font-semibold">平台</Label>
      <RadioGroup 
        value={platform} 
        onValueChange={(value) => onPlatformChange(value as any)}
        className="flex gap-4 mt-3"
      >
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
      </RadioGroup>
    </div>
  );
}

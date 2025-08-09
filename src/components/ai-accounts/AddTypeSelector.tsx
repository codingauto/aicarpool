import React from 'react';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

interface AddTypeSelectorProps {
  addType: 'oauth' | 'manual';
  onAddTypeChange: (addType: 'oauth' | 'manual') => void;
  showSelector: boolean;
}

export function AddTypeSelector({ addType, onAddTypeChange, showSelector }: AddTypeSelectorProps) {
  if (!showSelector) return null;
  
  return (
    <div>
      <Label className="text-sm font-semibold">添加方式</Label>
      <RadioGroup 
        value={addType} 
        onValueChange={(value) => onAddTypeChange(value as any)}
        className="flex gap-4 mt-3"
      >
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="oauth" id="oauth" />
          <Label htmlFor="oauth">OAuth 授权 (推荐)</Label>
        </div>
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="manual" id="manual" />
          <Label htmlFor="manual">手动输入 Access Token</Label>
        </div>
      </RadioGroup>
    </div>
  );
}

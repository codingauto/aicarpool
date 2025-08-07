'use client';

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Check, Copy, Eye, EyeOff, X, AlertTriangle } from 'lucide-react';

interface ApiKeySuccessDialogProps {
  open: boolean;
  onClose: () => void;
  apiKeyName: string;
  apiKey: string;
}

export function ApiKeySuccessDialog({ 
  open, 
  onClose, 
  apiKeyName, 
  apiKey 
}: ApiKeySuccessDialogProps) {
  const [showApiKey, setShowApiKey] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      const keyStr = String(apiKey || '');
      if (!keyStr) {
        console.error('API Key 为空');
        return;
      }
      await navigator.clipboard.writeText(keyStr);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('复制失败:', error);
    }
  };

  const toggleApiKeyVisibility = () => {
    setShowApiKey(!showApiKey);
  };

  const formatApiKey = (key: string) => {
    // 确保 key 是字符串类型
    const keyStr = String(key || '');
    
    if (!keyStr) {
      return '未知';
    }
    
    if (showApiKey) {
      return keyStr;
    }
    
    // 如果 key 长度小于等于10，直接显示
    if (keyStr.length <= 10) {
      return keyStr;
    }
    
    // 显示前6位和后4位，中间用点号代替
    const prefix = keyStr.substring(0, 6);
    const suffix = keyStr.substring(keyStr.length - 4);
    const dots = '•'.repeat(Math.max(0, keyStr.length - 10));
    return `${prefix}${dots}${suffix}`;
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          {/* 移除手动添加的关闭按钮，使用DialogContent默认的关闭按钮 */}
        </DialogHeader>
        
        <div className="space-y-6">
          {/* 成功图标和标题 */}
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-green-500 rounded-lg flex items-center justify-center flex-shrink-0">
              <Check className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-bold text-gray-900">API Key 创建成功</h2>
              <p className="text-sm text-gray-600 mt-1">请妥善保存您的 API Key</p>
            </div>
          </div>

          {/* 重要提醒 */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" />
              <div>
                <h3 className="text-sm font-semibold text-yellow-800 mb-1">重要提醒</h3>
                <p className="text-sm text-yellow-700">
                  这是您唯一能看到完整 API Key 的机会。关闭此窗口后，系统将不再显示完整的 API Key。请立即复制并妥善保存。
                </p>
              </div>
            </div>
          </div>

          {/* API Key 信息 */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="apiKeyName" className="text-sm font-medium text-gray-700">
                API Key 名称
              </Label>
              <Input
                id="apiKeyName"
                value={apiKeyName}
                readOnly
                className="bg-gray-50"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="apiKey" className="text-sm font-medium text-gray-700">
                API Key
              </Label>
              <div className="relative">
                <Input
                  id="apiKey"
                  value={formatApiKey(apiKey)}
                  readOnly
                  className="bg-gray-800 text-gray-100 pr-12"
                />
                <button
                  type="button"
                  onClick={toggleApiKeyVisibility}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-200"
                >
                  {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-xs text-gray-500">
                点击眼睛图标切换显示模式，使用下方按钮复制完整 API Key
              </p>
            </div>
          </div>

          {/* 操作按钮 */}
          <div className="flex gap-3 pt-4">
            <Button
              onClick={handleCopy}
              className="flex-1 bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white"
            >
              <Copy className="w-4 h-4 mr-2" />
              {copied ? '已复制' : '复制 API Key'}
            </Button>
            <Button
              variant="outline"
              onClick={onClose}
              className="px-6"
            >
              我已保存
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

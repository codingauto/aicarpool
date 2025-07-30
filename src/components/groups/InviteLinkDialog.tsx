'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Link, AlertTriangle } from 'lucide-react';

interface InviteLinkFormData {
  name: string;
  maxUses: number;
  expiresInDays: number;
}

interface InviteLinkDialogProps {
  onCreateLink: (data: InviteLinkFormData) => Promise<void>;
  trigger?: React.ReactNode;
}

export function InviteLinkDialog({ onCreateLink, trigger }: InviteLinkDialogProps) {
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState<InviteLinkFormData>({
    name: '',
    maxUses: 10,
    expiresInDays: 7
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    setLoading(true);
    setError('');

    try {
      await onCreateLink(formData);
      setOpen(false);
      setFormData({ name: '', maxUses: 10, expiresInDays: 7 });
    } catch (err) {
      setError(err instanceof Error ? err.message : '创建邀请链接失败');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setOpen(false);
    setError('');
  };

  const defaultTrigger = (
    <Button variant="outline" className="h-20 flex-col space-y-2">
      <Link className="w-6 h-6" />
      <span>创建链接</span>
    </Button>
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || defaultTrigger}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>创建邀请链接</DialogTitle>
          <DialogDescription>
            创建可重复使用的邀请链接
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="linkName">链接名称</Label>
            <Input
              id="linkName"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
              disabled={loading}
              placeholder="请输入链接名称"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="maxUses">最大使用次数</Label>
              <Input
                id="maxUses"
                type="number"
                min="1"
                max="100"
                value={formData.maxUses}
                onChange={(e) => setFormData({ 
                  ...formData, 
                  maxUses: parseInt(e.target.value) || 10 
                })}
                disabled={loading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="expiresInDays">有效期（天）</Label>
              <Input
                id="expiresInDays"
                type="number"
                min="1"
                max="30"
                value={formData.expiresInDays}
                onChange={(e) => setFormData({ 
                  ...formData, 
                  expiresInDays: parseInt(e.target.value) || 7 
                })}
                disabled={loading}
              />
            </div>
          </div>
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <div className="flex items-start">
                <AlertTriangle className="w-5 h-5 text-red-600 mr-2 mt-0.5 flex-shrink-0" />
                <div>
                  <div className="text-red-800 font-medium mb-1">创建失败</div>
                  <div className="text-red-700 text-sm">{error}</div>
                </div>
              </div>
            </div>
          )}
          <div className="flex space-x-2">
            <Button type="submit" disabled={loading}>
              {loading ? (
                <>
                  <div className="w-4 h-4 animate-spin rounded-full border-2 border-white border-t-transparent mr-2"></div>
                  创建中...
                </>
              ) : (
                '创建链接'
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={loading}
            >
              取消
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
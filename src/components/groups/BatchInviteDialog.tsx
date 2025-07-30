'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Users } from 'lucide-react';

interface BatchInviteResult {
  summary: {
    successful: number;
    failed: number;
    skippedMembers: number;
    skippedInvitations: number;
  };
}

interface BatchInviteDialogProps {
  onBatchInvite: (emails: string[]) => Promise<BatchInviteResult>;
  trigger?: React.ReactNode;
}

export function BatchInviteDialog({ onBatchInvite, trigger }: BatchInviteDialogProps) {
  const [open, setOpen] = useState(false);
  const [emails, setEmails] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<BatchInviteResult | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emails.trim()) return;

    setLoading(true);
    setError('');
    setResult(null);

    try {
      const emailList = emails
        .split('\n')
        .map(email => email.trim())
        .filter(email => email.length > 0);

      if (emailList.length === 0) {
        throw new Error('请输入至少一个邮箱地址');
      }

      if (emailList.length > 50) {
        throw new Error('一次最多邀请50个用户');
      }

      const batchResult = await onBatchInvite(emailList);
      setResult(batchResult);
      setEmails('');
    } catch (err) {
      setError(err instanceof Error ? err.message : '批量邀请失败');
    } finally {
      setLoading(false);
    }
  };

  const resetDialog = () => {
    setOpen(false);
    setEmails('');
    setError('');
    setResult(null);
  };

  const defaultTrigger = (
    <Button variant="outline" className="h-20 flex-col space-y-2">
      <Users className="w-6 h-6" />
      <span>批量邀请</span>
    </Button>
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || defaultTrigger}
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>批量邀请</DialogTitle>
          <DialogDescription>
            一次邀请多个用户，每行一个邮箱地址
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="batchEmails">邮箱列表</Label>
            <Textarea
              id="batchEmails"
              value={emails}
              onChange={(e) => setEmails(e.target.value)}
              placeholder="user1@example.com&#10;user2@example.com&#10;user3@example.com"
              rows={6}
              disabled={loading}
            />
            <div className="text-sm text-gray-500">
              最多一次邀请50个用户
            </div>
          </div>
          {error && (
            <div className="text-red-500 text-sm">{error}</div>
          )}
          {result && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <h4 className="font-medium text-green-800 mb-2">批量邀请结果</h4>
              <div className="text-sm text-green-700 space-y-1">
                <div>成功: {result.summary.successful} 个</div>
                <div>失败: {result.summary.failed} 个</div>
                <div>跳过: {result.summary.skippedMembers + result.summary.skippedInvitations} 个</div>
              </div>
            </div>
          )}
          <div className="flex space-x-2">
            <Button type="submit" disabled={loading}>
              {loading ? '邀请中...' : '批量邀请'}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={resetDialog}
              disabled={loading}
            >
              {result ? '重置' : '取消'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
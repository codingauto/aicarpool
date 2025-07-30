'use client';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Copy, Download } from 'lucide-react';

interface QRCodeData {
  qrCode: string;
  inviteUrl: string;
}

interface QRCodeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  loading: boolean;
  qrCodeData: QRCodeData | null;
  onCopyLink: (url: string) => Promise<void>;
}

export function QRCodeDialog({ 
  open, 
  onOpenChange, 
  loading, 
  qrCodeData, 
  onCopyLink 
}: QRCodeDialogProps) {
  const handleDownload = () => {
    if (!qrCodeData) return;
    
    const link = document.createElement('a');
    link.href = qrCodeData.qrCode;
    link.download = '邀请二维码.png';
    link.click();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>邀请二维码</DialogTitle>
          <DialogDescription>
            扫描二维码加入拼车组
          </DialogDescription>
        </DialogHeader>
        <div className="text-center space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
              <span className="ml-2">正在生成二维码...</span>
            </div>
          ) : qrCodeData ? (
            <>
              <div className="flex justify-center">
                <img 
                  src={qrCodeData.qrCode} 
                  alt="邀请二维码" 
                  className="border rounded-lg"
                />
              </div>
              <div className="text-sm text-gray-600">
                <p>邀请链接:</p>
                <code className="block bg-gray-100 p-2 rounded text-xs break-all">
                  {qrCodeData.inviteUrl}
                </code>
              </div>
              <div className="flex space-x-2 justify-center">
                <Button 
                  onClick={() => onCopyLink(qrCodeData.inviteUrl)}
                  variant="outline"
                >
                  <Copy className="w-4 h-4 mr-2" />
                  复制链接
                </Button>
                <Button 
                  onClick={handleDownload}
                  variant="outline"
                >
                  <Download className="w-4 h-4 mr-2" />
                  下载二维码
                </Button>
              </div>
            </>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
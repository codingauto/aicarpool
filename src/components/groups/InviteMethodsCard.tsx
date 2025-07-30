'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { QrCode } from 'lucide-react';
import { EmailInviteDialog } from './EmailInviteDialog';
import { BatchInviteDialog } from './BatchInviteDialog';
import { InviteLinkDialog } from './InviteLinkDialog';

interface BatchInviteResult {
  summary: {
    successful: number;
    failed: number;
    skippedMembers: number;
    skippedInvitations: number;
  };
}

interface InviteLinkFormData {
  name: string;
  maxUses: number;
  expiresInDays: number;
}

interface InviteMethodsCardProps {
  onEmailInvite: (email: string) => Promise<void>;
  onBatchInvite: (emails: string[]) => Promise<BatchInviteResult>;
  onCreateInviteLink: (data: InviteLinkFormData) => Promise<void>;
  onGenerateQRCode: () => Promise<void>;
}

export function InviteMethodsCard({ 
  onEmailInvite, 
  onBatchInvite, 
  onCreateInviteLink, 
  onGenerateQRCode 
}: InviteMethodsCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>邀请新成员</CardTitle>
        <CardDescription>
          选择适合的邀请方式快速邀请新成员加入
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <EmailInviteDialog onInvite={onEmailInvite} />
          
          <BatchInviteDialog onBatchInvite={onBatchInvite} />
          
          <InviteLinkDialog onCreateLink={onCreateInviteLink} />
          
          <Button 
            variant="outline" 
            className="h-20 flex-col space-y-2"
            onClick={onGenerateQRCode}
          >
            <QrCode className="w-6 h-6" />
            <span>生成二维码</span>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
'use client';

import { useState, useEffect } from 'react';
import { InviteMethodsCard } from './InviteMethodsCard';
import { EmailInvitationsTable } from './EmailInvitationsTable';
import { InviteLinksTable } from './InviteLinksTable';
import { QRCodeDialog } from './QRCodeDialog';

interface Invitation {
  id: string;
  email: string;
  status: 'pending' | 'accepted' | 'expired';
  createdAt: string;
  expiresAt: string;
  inviter: {
    name: string;
  };
}

interface InviteLink {
  id: string;
  name: string;
  token: string;
  usedCount: number;
  maxUses: number;
  status: 'active' | 'expired' | 'disabled';
  expiresAt?: string;
  creator: {
    name: string;
  };
}

interface QRCodeData {
  qrCode: string;
  inviteUrl: string;
}

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

interface GroupDetail {
  invitations: Invitation[];
}

interface InvitationsTabProps {
  groupId: string;
  group: GroupDetail;
  isAdmin: boolean;
  inviteLinks: InviteLink[];
  onRefresh: () => void;
}

export function InvitationsTab({ 
  groupId, 
  group, 
  isAdmin, 
  inviteLinks,
  onRefresh 
}: InvitationsTabProps) {
  const [inviteActionLoading, setInviteActionLoading] = useState<string | null>(null);
  const [showQRCodeDialog, setShowQRCodeDialog] = useState(false);
  const [qrCodeData, setQRCodeData] = useState<QRCodeData | null>(null);
  const [qrCodeLoading, setQRCodeLoading] = useState(false);

  const handleEmailInvite = async (email: string) => {
    const token = localStorage.getItem('token');
    const response = await fetch(`/api/groups/${groupId}/invitations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ email }),
    });

    const data = await response.json();
    if (!data.success) {
      throw new Error(data.error || '邀请用户失败');
    }
    
    onRefresh();
  };

  const handleBatchInvite = async (emails: string[]): Promise<BatchInviteResult> => {
    const token = localStorage.getItem('token');
    const response = await fetch(`/api/groups/${groupId}/invitations/batch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ emails }),
    });

    const data = await response.json();
    if (!data.success) {
      throw new Error(data.message || '批量邀请失败');
    }

    onRefresh();
    return data.data;
  };

  const handleCreateInviteLink = async (formData: InviteLinkFormData) => {
    const token = localStorage.getItem('token');
    const response = await fetch(`/api/groups/${groupId}/invite-link`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(formData),
    });

    const data = await response.json();
    if (!data.success) {
      throw new Error(data.message || '创建邀请链接失败');
    }
    
    onRefresh();
  };

  const handleGenerateQRCode = async (linkId?: string) => {
    setQRCodeLoading(true);
    setShowQRCodeDialog(true);
    
    try {
      const token = localStorage.getItem('token');
      const url = linkId 
        ? `/api/groups/${groupId}/qrcode?linkId=${linkId}`
        : `/api/groups/${groupId}/qrcode`;
        
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();
      if (data.success) {
        setQRCodeData(data.data);
      } else {
        throw new Error(data.message || '生成二维码失败');
      }
    } catch (error) {
      console.error('生成二维码失败:', error);
      alert('生成二维码失败，请重试');
    } finally {
      setQRCodeLoading(false);
    }
  };

  const handleCopyLink = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      alert('链接已复制到剪贴板');
    } catch (error) {
      console.error('复制失败:', error);
      alert('复制失败，请手动复制');
    }
  };

  const handleResendInvitation = async (invitationId: string) => {
    setInviteActionLoading(invitationId);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/groups/${groupId}/invitations/${invitationId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();
      if (data.success) {
        alert('邀请已重新发送');
        onRefresh();
      } else {
        alert(data.message || '重新发送邀请失败');
      }
    } catch (error) {
      console.error('重新发送邀请失败:', error);
      alert('重新发送邀请失败，请重试');
    } finally {
      setInviteActionLoading(null);
    }
  };

  const handleCancelInvitation = async (invitationId: string) => {
    setInviteActionLoading(invitationId);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/groups/${groupId}/invitations/${invitationId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();
      if (data.success) {
        onRefresh();
      } else {
        alert(data.message || '撤销邀请失败');
      }
    } catch (error) {
      console.error('撤销邀请失败:', error);
      alert('撤销邀请失败，请重试');
    } finally {
      setInviteActionLoading(null);
    }
  };

  return (
    <div className="space-y-6">
      {isAdmin && (
        <InviteMethodsCard
          onEmailInvite={handleEmailInvite}
          onBatchInvite={handleBatchInvite}
          onCreateInviteLink={handleCreateInviteLink}
          onGenerateQRCode={() => handleGenerateQRCode()}
        />
      )}

      <EmailInvitationsTable
        invitations={group.invitations}
        isAdmin={isAdmin}
        loading={inviteActionLoading}
        onResend={handleResendInvitation}
        onCancel={handleCancelInvitation}
      />

      <InviteLinksTable
        links={inviteLinks}
        onCopyLink={handleCopyLink}
        onGenerateQR={handleGenerateQRCode}
      />

      <QRCodeDialog
        open={showQRCodeDialog}
        onOpenChange={setShowQRCodeDialog}
        loading={qrCodeLoading}
        qrCodeData={qrCodeData}
        onCopyLink={handleCopyLink}
      />
    </div>
  );
}
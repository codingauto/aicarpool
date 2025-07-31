'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AiServiceConfig } from '@/components/groups/AiServiceConfig';
import { DeploymentModeConfig } from '@/components/groups/DeploymentModeConfig';
import { IpProxyManagement } from '@/components/groups/IpProxyManagement';
import { EnhancedUsageStats } from '@/components/dashboard/enhanced-usage-stats';
import { GroupHeader } from '@/components/groups/GroupHeader';
import { MembersTab } from '@/components/groups/MembersTab';
import { ApiKeysTab } from '@/components/groups/ApiKeysTab';
import { InvitationsTab } from '@/components/groups/InvitationsTab';
import { EdgeNodesTab } from '@/components/groups/EdgeNodesTab';

interface GroupDetail {
  id: string;
  name: string;
  description?: string;
  maxMembers: number;
  status: string;
  stats: {
    memberCount: number;
    apiKeyCount: number;
    totalCost: number;
  };
  members: Array<{
    id: string;
    role: string;
    status: string;
    joinedAt: string;
    user: {
      id: string;
      name: string;
      email: string;
      avatar?: string;
    };
  }>;
  aiServices: Array<{
    isEnabled: boolean;
    aiService: {
      id: string;
      displayName: string;
    };
  }>;
  apiKeys: Array<{
    id: string;
    name: string;
    description?: string;
    key: string;
    status: string;
    quotaUsed: number;
    quotaLimit?: number;
    lastUsedAt?: string;
    user: {
      name: string;
    };
    aiService: {
      displayName: string;
    };
  }>;
  invitations: Array<{
    id: string;
    email: string;
    status: 'pending' | 'accepted' | 'expired';
    createdAt: string;
    expiresAt: string;
    inviter: {
      name: string;
    };
  }>;
}

export default function GroupDetailPage() {
  const params = useParams();
  const router = useRouter();
  const groupId = params.id as string;

  const [group, setGroup] = useState<GroupDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentUser, setCurrentUser] = useState<{ id: string; name: string; email: string } | null>(null);
  const [activeTab, setActiveTab] = useState('members');
  const [inviteLinks, setInviteLinks] = useState<Array<{
    id: string;
    name: string;
    token: string;
    usedCount: number;
    maxUses: number;
    status: 'active' | 'expired' | 'disabled';
    expiresAt?: string;
    creator: { name: string };
  }>>([]);

  // Check if current user is admin or owner
  const isAdmin = group?.members.find(m => 
    m.user.id === currentUser?.id && (m.role === 'admin' || m.role === 'owner')
  ) !== undefined;

  const fetchGroupDetail = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        router.push('/auth/login');
        return;
      }

      const response = await fetch(`/api/groups/${groupId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        router.push('/auth/login');
        return;
      }

      const data = await response.json();
      if (data.success) {
        setGroup(data.data);
      } else {
        setError(data.message || '获取拼车组详情失败');
      }
    } catch (error) {
      console.error('获取拼车组详情失败:', error);
      setError('获取拼车组详情失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  const fetchInviteLinks = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/groups/${groupId}/invite-link`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();
      if (data.success) {
        setInviteLinks(data.data);
      }
    } catch (error) {
      console.error('获取邀请链接失败:', error);
    }
  };

  const handleCreateApiKey = async (data: { name: string; description: string; aiServiceId: string }) => {
    const token = localStorage.getItem('token');
    const response = await fetch(`/api/groups/${groupId}/api-keys`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    });

    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error || '创建API密钥失败');
    }
    
    fetchGroupDetail();
  };

  const handleCopyApiKey = async (key: string) => {
    try {
      await navigator.clipboard.writeText(key);
      alert('API密钥已复制到剪贴板');
    } catch (error) {
      console.error('复制失败:', error);
      alert('复制失败，请手动复制');
    }
  };

  useEffect(() => {
    fetchGroupDetail();
    fetchInviteLinks();
    
    // Get current user info
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      setCurrentUser(JSON.parse(storedUser));
    }
  }, [groupId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="text-lg text-gray-600">加载中...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="text-red-500 mb-4">{error}</div>
          <button onClick={fetchGroupDetail} className="bg-blue-500 text-white px-4 py-2 rounded">
            重试
          </button>
        </div>
      </div>
    );
  }

  if (!group) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="text-gray-500">拼车组不存在</div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <GroupHeader group={group} isAdmin={isAdmin} />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-8">
          <TabsTrigger value="members">成员管理</TabsTrigger>
          <TabsTrigger value="services">AI服务</TabsTrigger>
          <TabsTrigger value="api-keys">API密钥</TabsTrigger>
          <TabsTrigger value="deployment">部署模式</TabsTrigger>
          <TabsTrigger value="ip-proxy">IP代理</TabsTrigger>
          <TabsTrigger value="edge-nodes">边缘节点</TabsTrigger>
          <TabsTrigger value="invitations">邀请管理</TabsTrigger>
          <TabsTrigger value="usage">使用统计</TabsTrigger>
        </TabsList>

        <TabsContent value="members" className="space-y-6">
          <MembersTab 
            group={group} 
            isAdmin={isAdmin} 
            currentUser={currentUser}
            onInviteClick={() => setActiveTab('invitations')}
          />
        </TabsContent>

        <TabsContent value="services" className="space-y-6">
          <AiServiceConfig
            groupId={groupId}
            isAdmin={isAdmin}
            onRefresh={fetchGroupDetail}
          />
        </TabsContent>

        <TabsContent value="api-keys" className="space-y-6">
          <ApiKeysTab
            group={group}
            onCreateApiKey={handleCreateApiKey}
            onCopyApiKey={handleCopyApiKey}
          />
        </TabsContent>

        <TabsContent value="deployment" className="space-y-6">
          <DeploymentModeConfig
            groupId={groupId}
            isAdmin={isAdmin}
          />
        </TabsContent>

        <TabsContent value="ip-proxy" className="space-y-6">
          <IpProxyManagement groupId={groupId} isAdmin={isAdmin} />
        </TabsContent>

        <TabsContent value="edge-nodes" className="space-y-6">
          <EdgeNodesTab isAdmin={isAdmin} />
        </TabsContent>

        <TabsContent value="invitations" className="space-y-6">
          <InvitationsTab
            groupId={groupId}
            group={group}
            isAdmin={isAdmin}
            inviteLinks={inviteLinks}
            onRefresh={() => {
              fetchGroupDetail();
              fetchInviteLinks();
            }}
          />
        </TabsContent>

        <TabsContent value="usage" className="space-y-6">
          <EnhancedUsageStats 
            groupId={groupId}
            title="拼车组使用统计"
            showMemberUsage={true}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
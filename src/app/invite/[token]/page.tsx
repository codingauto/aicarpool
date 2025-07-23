'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface InvitationData {
  id: string;
  email: string;
  status: string;
  expiresAt: string;
  group: {
    id: string;
    name: string;
    description: string;
    maxMembers: number;
    _count: {
      members: number;
    };
  };
  inviter: {
    id: string;
    name: string;
    email: string;
  };
}

export default function InvitePage() {
  const params = useParams();
  const router = useRouter();
  const [invitation, setInvitation] = useState<InvitationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accepting, setAccepting] = useState(false);

  const token = params.token as string;

  useEffect(() => {
    const verifyInvitation = async () => {
      try {
        const response = await fetch(`/api/invite/${token}`);
        const data = await response.json();

        if (data.success) {
          setInvitation(data.data);
        } else {
          setError(data.message);
        }
      } catch (err) {
        setError('验证邀请时出错');
      } finally {
        setLoading(false);
      }
    };

    if (token) {
      verifyInvitation();
    }
  }, [token]);

  const handleAcceptInvitation = async () => {
    // 检查用户是否已登录
    const response = await fetch('/api/auth/me');
    if (!response.ok) {
      // 未登录，跳转到注册页面并携带邀请token
      router.push(`/auth/register?invite=${token}&email=${encodeURIComponent(invitation?.email || '')}`);
      return;
    }

    const userData = await response.json();
    
    // 检查邮箱是否匹配
    if (userData.data.email !== invitation?.email) {
      setError('当前登录账户的邮箱与邀请邮箱不匹配，请使用正确的账户登录');
      return;
    }

    setAccepting(true);
    try {
      const acceptResponse = await fetch(`/api/invite/${token}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: userData.data.id,
        }),
      });

      const acceptData = await acceptResponse.json();

      if (acceptData.success) {
        router.push(`/groups/${invitation.group.id}?welcome=true`);
      } else {
        setError(acceptData.message);
      }
    } catch (err) {
      setError('接受邀请时出错');
    } finally {
      setAccepting(false);
    }
  };

  if (loading) {
    return (
      <div className=\"min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center\">
        <Card className=\"w-full max-w-md\">
          <CardContent className=\"flex items-center justify-center py-6\">
            <div className=\"animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600\"></div>
            <span className=\"ml-2\">正在验证邀请...</span>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className=\"min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center\">
        <Card className=\"w-full max-w-md\">
          <CardHeader className=\"text-center\">
            <CardTitle className=\"text-red-600\">🚫 邀请无效</CardTitle>
          </CardHeader>
          <CardContent className=\"text-center\">
            <p className=\"text-gray-600 mb-4\">{error}</p>
            <div className=\"space-y-2\">
              <Link href=\"/dashboard\">
                <Button variant=\"outline\" className=\"w-full\">
                  返回首页
                </Button>
              </Link>
              <Link href=\"/auth/login\">
                <Button className=\"w-full\">
                  登录账户
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!invitation) {
    return null;
  }

  const expiresAt = new Date(invitation.expiresAt);
  const remainingHours = Math.ceil((expiresAt.getTime() - new Date().getTime()) / (1000 * 60 * 60));

  return (
    <div className=\"min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4\">
      <Card className=\"w-full max-w-md\">
        <CardHeader className=\"text-center\">
          <CardTitle className=\"text-2xl\">🎉 拼车组邀请</CardTitle>
          <CardDescription>
            您已被邀请加入 AiCarpool 拼车组
          </CardDescription>
        </CardHeader>
        
        <CardContent className=\"space-y-4\">
          <div className=\"bg-gradient-to-r from-indigo-50 to-purple-50 rounded-lg p-4 border\">
            <h3 className=\"font-semibold text-lg mb-2\">{invitation.group.name}</h3>
            {invitation.group.description && (
              <p className=\"text-gray-600 text-sm mb-3\">{invitation.group.description}</p>
            )}
            <div className=\"flex justify-between text-sm text-gray-500\">
              <span>成员数量</span>
              <span>{invitation.group._count.members}/{invitation.group.maxMembers}</span>
            </div>
          </div>

          <div className=\"bg-gray-50 rounded-lg p-4\">
            <p className=\"text-sm text-gray-600 mb-2\">
              <strong>{invitation.inviter.name}</strong> 邀请您加入此拼车组
            </p>
            <p className=\"text-sm text-gray-500\">
              邀请邮箱：{invitation.email}
            </p>
            <p className=\"text-sm text-gray-500\">
              过期时间：还剩 {remainingHours} 小时
            </p>
          </div>

          <div className=\"bg-blue-50 rounded-lg p-4\">
            <h4 className=\"font-medium mb-2\">🚀 加入后您将获得：</h4>
            <ul className=\"text-sm text-gray-600 space-y-1\">
              <li>• 使用多种AI编程工具（Claude Code、Gemini CLI等）</li>
              <li>• 享受成本分摊，降低使用费用</li>
              <li>• 统一的API接口和服务管理</li>
              <li>• 团队协作，提升开发效率</li>
            </ul>
          </div>

          <div className=\"space-y-2\">
            <Button
              onClick={handleAcceptInvitation}
              disabled={accepting}
              className=\"w-full\"
            >
              {accepting ? '正在加入...' : '接受邀请'}
            </Button>
            
            <Link href=\"/\">
              <Button variant=\"outline\" className=\"w-full\">
                暂不加入
              </Button>
            </Link>
          </div>

          <p className=\"text-xs text-gray-500 text-center\">
            点击"接受邀请"即表示您同意加入该拼车组
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
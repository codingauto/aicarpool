'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface InviteLinkData {
  id: string;
  name: string;
  maxUses: number;
  usedCount: number;
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
  creator: {
    id: string;
    name: string;
    email: string;
  };
}

export default function JoinPage() {
  const params = useParams();
  const router = useRouter();
  const [inviteLink, setInviteLink] = useState<InviteLinkData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);
  const [showRegistration, setShowRegistration] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    name: '',
    password: '',
    confirmPassword: ''
  });
  const [validationError, setValidationError] = useState('');

  const token = params.token as string;

  useEffect(() => {
    const verifyInviteLink = async () => {
      try {
        const response = await fetch(`/api/join/${token}`);
        const data = await response.json();

        if (data.success) {
          setInviteLink(data.data);
        } else {
          setError(data.message);
        }
      } catch (error) {
        console.error('验证邀请链接失败:', error);
        setError('验证邀请链接时出错');
      } finally {
        setLoading(false);
      }
    };

    if (token) {
      verifyInviteLink();
    }
  }, [token]);

  const validateForm = () => {
    if (!formData.email.trim()) {
      setValidationError('请输入邮箱地址');
      return false;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      setValidationError('请输入有效的邮箱地址');
      return false;
    }
    if (showRegistration) {
      if (!formData.name.trim()) {
        setValidationError('请输入姓名');
        return false;
      }
      if (formData.password.length < 6) {
        setValidationError('密码至少需要6位');
        return false;
      }
      if (formData.password !== formData.confirmPassword) {
        setValidationError('两次输入的密码不一致');
        return false;
      }
    }
    setValidationError('');
    return true;
  };

  const handleJoinGroup = async () => {
    if (!inviteLink) return;

    if (!validateForm()) return;

    setJoining(true);
    try {
      const requestBody: any = {
        email: formData.email,
      };
      
      if (showRegistration) {
        requestBody.name = formData.name;
        requestBody.password = formData.password;
      }

      const response = await fetch(`/api/join/${token}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      const data = await response.json();
      if (data.success) {
        // 保存登录token
        if (data.data.authToken) {
          localStorage.setItem('token', data.data.authToken);
        }
        
        // 成功加入，根据类型跳转
        if (data.data.isEnterpriseInvite) {
          // 企业邀请，跳转到企业页面
          const enterpriseId = data.data.enterpriseId;
          if (data.data.isNewUser) {
            router.push(`/enterprise/${enterpriseId}/dashboard?message=欢迎加入企业！账户已自动创建`);
          } else {
            router.push(`/enterprise/${enterpriseId}/dashboard?message=成功加入企业`);
          }
        } else {
          // 普通拼车组邀请
          if (data.data.isNewUser) {
            router.push('/dashboard?message=欢迎加入AiCarpool！账户已自动创建');
          } else {
            router.push('/dashboard?message=成功加入拼车组');
          }
        }
      } else {
        console.log('API Error:', data);
        if (data.error === '新用户需要提供姓名和密码' || data.message === '新用户需要提供姓名和密码') {
          console.log('Showing registration form');
          setShowRegistration(true);
          setValidationError(''); // 清除之前的错误
        } else {
          setError(data.error || data.message);
        }
      }
    } catch (error) {
      console.error('加入拼车组失败:', error);
      setError('加入拼车组时出错');
    } finally {
      setJoining(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="flex items-center justify-center py-6">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            <span className="ml-2">正在验证邀请链接...</span>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-red-600">🚫 邀请链接无效</CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-gray-600 mb-4">{error}</p>
            <div className="space-y-2">
              <Link href="/dashboard">
                <Button variant="outline" className="w-full">
                  返回首页
                </Button>
              </Link>
              <Link href="/auth/login">
                <Button className="w-full">
                  登录账户
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!inviteLink) {
    return null;
  }

  const remainingUses = inviteLink.maxUses - inviteLink.usedCount;
  const expiresAt = new Date(inviteLink.expiresAt);
  const remainingHours = Math.ceil((expiresAt.getTime() - new Date().getTime()) / (1000 * 60 * 60));
  
  // 检查是否是企业邀请
  const isEnterpriseInvite = inviteLink.group.organizationType === 'enterprise_group' &&
                             inviteLink.group.settings?.invitationType === 'enterprise_link';

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">
            {isEnterpriseInvite ? '🏢 加入企业' : '🎉 加入拼车组'}
          </CardTitle>
          <CardDescription>
            {isEnterpriseInvite 
              ? `通过邀请链接加入 ${inviteLink.group.enterprise?.name || '企业'}`
              : '通过邀请链接加入 AiCarpool 拼车组'
            }
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-4">
          <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-lg p-4 border">
            <h3 className="font-semibold text-lg mb-2">
              {isEnterpriseInvite 
                ? inviteLink.group.enterprise?.name || '企业' 
                : inviteLink.group.name
              }
            </h3>
            {inviteLink.group.description && (
              <p className="text-gray-600 text-sm mb-3">{inviteLink.group.description}</p>
            )}
            <div className="space-y-1 text-sm text-gray-500">
              {isEnterpriseInvite ? (
                <>
                  <div className="flex justify-between">
                    <span>邀请角色</span>
                    <span>{inviteLink.group.settings?.inviteRole || 'member'}</span>
                  </div>
                  {inviteLink.group.settings?.inviteDepartmentId && (
                    <div className="flex justify-between">
                      <span>部门</span>
                      <span>指定部门</span>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="flex justify-between">
                    <span>成员数量</span>
                    <span>{inviteLink.group._count.members}/{inviteLink.group.maxMembers}</span>
                  </div>
                </>
              )}
              <div className="flex justify-between">
                <span>剩余名额</span>
                <span>{remainingUses}/{inviteLink.maxUses}</span>
              </div>
            </div>
          </div>

          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-sm text-gray-600 mb-2">
              邀请链接名称：<strong>{inviteLink.name}</strong>
            </p>
            <p className="text-sm text-gray-500 mb-2">
              创建者：{inviteLink.creator.name}
            </p>
            <p className="text-sm text-gray-500">
              过期时间：还剩 {remainingHours} 小时
            </p>
          </div>

          <div className="space-y-3">
            <div>
              <Label htmlFor="email">邮箱地址</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({...formData, email: e.target.value})}
                placeholder="请输入您的邮箱地址"
                className="mt-1"
              />
            </div>

            {showRegistration && (
              <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-200 space-y-3">
                <h4 className="font-medium">📝 完成注册信息</h4>
                <div>
                  <Label htmlFor="name">姓名</Label>
                  <Input
                    id="name"
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    placeholder="请输入您的姓名"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="password">密码</Label>
                  <Input
                    id="password"
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({...formData, password: e.target.value})}
                    placeholder="至少6位密码"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="confirmPassword">确认密码</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={formData.confirmPassword}
                    onChange={(e) => setFormData({...formData, confirmPassword: e.target.value})}
                    placeholder="再次输入密码"
                    className="mt-1"
                  />
                </div>
              </div>
            )}

            {validationError && (
              <div className="text-red-500 text-sm">{validationError}</div>
            )}
          </div>

          <div className="bg-blue-50 rounded-lg p-4">
            <h4 className="font-medium mb-2">🚀 加入后您将获得：</h4>
            <ul className="text-sm text-gray-600 space-y-1">
              {isEnterpriseInvite ? (
                <>
                  <li>• 访问企业的组织架构和资源</li>
                  <li>• 使用企业配置的AI服务账号</li>
                  <li>• 参与企业内部的协作与管理</li>
                  <li>• 享受企业级的权限和配额</li>
                </>
              ) : (
                <>
                  <li>• 使用多种AI编程工具（Claude Code、Gemini CLI等）</li>
                  <li>• 享受成本分摊，降低使用费用</li>
                  <li>• 统一的API接口和服务管理</li>
                  <li>• 团队协作，提升开发效率</li>
                </>
              )}
            </ul>
          </div>

          <div className="space-y-2">
            <Button
              onClick={handleJoinGroup}
              disabled={joining}
              className="w-full"
            >
              {joining 
                ? '正在加入...' 
                : (showRegistration 
                  ? '完成注册并加入' 
                  : (isEnterpriseInvite ? '加入企业' : '加入拼车组')
                )
              }
            </Button>
            
            <Link href="/">
              <Button variant="outline" className="w-full">
                暂不加入
              </Button>
            </Link>
          </div>

          <p className="text-xs text-gray-500 text-center">
            {showRegistration 
              ? '点击"完成注册并加入"即表示您同意创建账户并加入该拼车组'
              : '点击"加入拼车组"即表示您同意加入该拼车组'
            }
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
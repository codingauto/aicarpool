'use client';

/**
 * 增强版用户邀请对话框组件 - 结合部门管理
 * 
 * 功能：
 * - 邀请新用户加入企业
 * - 设置用户角色和部门
 * - 批量邀请
 * - 邀请链接生成
 * - 部门层级显示和选择
 */

import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { 
  Mail,
  Users,
  Send,
  Copy,
  Link,
  Plus,
  X,
  UserPlus,
  Shield,
  Crown,
  UserCheck,
  AlertCircle,
  Check,
  Building2,
  ChevronRight,
  Download
} from 'lucide-react';

interface Department {
  id: string;
  name: string;
  description?: string;
  parentId?: string;
  children: Department[];
}

interface EnhancedUserInviteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  enterpriseId: string;
  availableRoles: Array<{
    key: string;
    name: string;
    permissions: string[];
  }>;
  onInviteSuccess: () => void;
}

interface InviteUser {
  id: string;
  email: string;
  role: string;
  departmentId?: string;
}

export function EnhancedUserInviteDialog({
  open,
  onOpenChange,
  enterpriseId,
  availableRoles,
  onInviteSuccess
}: EnhancedUserInviteDialogProps) {
  const [inviteUsers, setInviteUsers] = useState<InviteUser[]>([
    { id: '1', email: '', role: 'member' }
  ]);
  const [batchEmails, setBatchEmails] = useState('');
  const [inviteMessage, setInviteMessage] = useState('');
  const [inviteLink, setInviteLink] = useState('');
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState('');
  const [inviteLinkRole, setInviteLinkRole] = useState('member');
  const [inviteLinkDepartment, setInviteLinkDepartment] = useState<string>('none');
  const [sending, setSending] = useState(false);
  const [generatingLink, setGeneratingLink] = useState(false);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loadingDepartments, setLoadingDepartments] = useState(false);

  // 获取部门列表
  useEffect(() => {
    if (open) {
      fetchDepartments();
    }
  }, [open, enterpriseId]);

  const fetchDepartments = async () => {
    setLoadingDepartments(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/enterprises/${enterpriseId}/departments`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setDepartments(data.data.departments || []);
        }
      }
    } catch (error) {
      console.error('获取部门列表失败:', error);
    } finally {
      setLoadingDepartments(false);
    }
  };

  const addInviteUser = () => {
    const newUser: InviteUser = {
      id: Date.now().toString(),
      email: '',
      role: 'member'
    };
    setInviteUsers([...inviteUsers, newUser]);
  };

  const removeInviteUser = (id: string) => {
    if (inviteUsers.length > 1) {
      setInviteUsers(inviteUsers.filter(user => user.id !== id));
    }
  };

  const updateInviteUser = (id: string, field: keyof InviteUser, value: string) => {
    setInviteUsers(inviteUsers.map(user => 
      user.id === id ? { ...user, [field]: value } : user
    ));
  };

  const handleSendInvites = async () => {
    setSending(true);
    try {
      const token = localStorage.getItem('token');
      const headers: HeadersInit = {
        'Content-Type': 'application/json'
      };

      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      const validUsers = inviteUsers.filter(user => user.email.trim() && isValidEmail(user.email));
      let successCount = 0;
      let errorCount = 0;
      
      for (const user of validUsers) {
        const response = await fetch(`/api/enterprises/${enterpriseId}/invites`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            email: user.email,
            role: user.role,
            departmentId: user.departmentId && user.departmentId !== 'none' && user.departmentId !== '' ? user.departmentId : undefined,
            message: inviteMessage
          })
        });

        if (response.ok) {
          successCount++;
        } else {
          errorCount++;
          const errorData = await response.json();
          console.error(`邀请 ${user.email} 失败:`, errorData.error);
        }
      }

      if (successCount > 0) {
        onInviteSuccess();
        onOpenChange(false);
        
        // 重置表单
        setInviteUsers([{ id: '1', email: '', role: 'member' }]);
        setInviteMessage('');
        
        alert(`成功发送 ${successCount} 个邀请${errorCount > 0 ? `，${errorCount} 个失败` : ''}`);
      } else if (errorCount > 0) {
        alert('所有邀请发送失败，请检查邮箱地址和权限');
      }
    } catch (error) {
      console.error('发送邀请失败:', error);
      alert('发送邀请失败，请稍后重试');
    } finally {
      setSending(false);
    }
  };

  const handleBatchInvite = async () => {
    if (!batchEmails.trim()) return;

    setSending(true);
    try {
      const token = localStorage.getItem('token');
      const headers: HeadersInit = {
        'Content-Type': 'application/json'
      };

      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      const emailList = batchEmails
        .split('\n')
        .map(email => email.trim())
        .filter(email => email.length > 0 && isValidEmail(email));

      if (emailList.length === 0) {
        alert('请输入至少一个有效的邮箱地址');
        return;
      }

      if (emailList.length > 50) {
        alert('一次最多邀请50个用户');
        return;
      }

      let successCount = 0;
      let errorCount = 0;
      
      for (const email of emailList) {
        const response = await fetch(`/api/enterprises/${enterpriseId}/invites`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            email,
            role: inviteLinkRole,
            departmentId: inviteLinkDepartment && inviteLinkDepartment !== 'none' ? inviteLinkDepartment : undefined,
            message: inviteMessage
          })
        });

        if (response.ok) {
          successCount++;
        } else {
          errorCount++;
          const errorData = await response.json();
          console.error(`邀请 ${email} 失败:`, errorData.error);
        }
      }

      onInviteSuccess();
      onOpenChange(false);
      
      // 重置表单
      setBatchEmails('');
      setInviteMessage('');
      
      alert(`批量邀请完成：成功 ${successCount} 个${errorCount > 0 ? `，失败 ${errorCount} 个` : ''}`);
    } catch (error) {
      console.error('批量邀请失败:', error);
      alert('批量邀请失败，请稍后重试');
    } finally {
      setSending(false);
    }
  };

  const handleGenerateInviteLink = async () => {
    setGeneratingLink(true);
    try {
      const token = localStorage.getItem('token');
      const headers: HeadersInit = {
        'Content-Type': 'application/json'
      };

      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      const response = await fetch(`/api/enterprises/${enterpriseId}/invite-links`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          name: `邀请链接-${new Date().toLocaleString()}`,
          role: inviteLinkRole,
          departmentId: inviteLinkDepartment && inviteLinkDepartment !== 'none' ? inviteLinkDepartment : undefined,
          maxUses: 10,
          expiresInDays: 7
        })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data?.url) {
          setInviteLink(data.data.url);
          // 生成二维码
          try {
            const qrDataUrl = await QRCode.toDataURL(data.data.url, {
              width: 200,
              margin: 2,
              color: {
                dark: '#000000',
                light: '#FFFFFF'
              }
            });
            setQrCodeDataUrl(qrDataUrl);
          } catch (qrError) {
            console.error('生成二维码失败:', qrError);
          }
        }
      } else {
        const errorData = await response.json();
        console.error('生成邀请链接失败:', errorData.error);
      }
    } catch (error) {
      console.error('生成邀请链接失败:', error);
    } finally {
      setGeneratingLink(false);
    }
  };

  const copyInviteLink = () => {
    navigator.clipboard.writeText(inviteLink);
    alert('邀请链接已复制到剪贴板');
  };

  const downloadQRCode = () => {
    if (!qrCodeDataUrl) return;
    
    const link = document.createElement('a');
    link.href = qrCodeDataUrl;
    link.download = '企业邀请二维码.png';
    link.click();
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'owner':
        return <Crown className="w-4 h-4" />;
      case 'admin':
        return <Shield className="w-4 h-4" />;
      case 'member':
        return <UserCheck className="w-4 h-4" />;
      default:
        return <Users className="w-4 h-4" />;
    }
  };

  const isValidEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const canSendInvites = inviteUsers.some(user => 
    user.email.trim() && isValidEmail(user.email)
  );

  // 渲染部门树形选择器
  const renderDepartmentOptions = (depts: Department[], level: number = 0): React.ReactNode[] => {
    const options: React.ReactNode[] = [];
    
    depts.forEach(dept => {
      const indent = '  '.repeat(level);
      options.push(
        <SelectItem key={dept.id} value={dept.id}>
          <div className="flex items-center gap-2">
            {level > 0 && <ChevronRight className="w-3 h-3 text-gray-400" />}
            <Building2 className="w-3 h-3" />
            <span>{indent}{dept.name}</span>
          </div>
        </SelectItem>
      );
      
      if (dept.children && dept.children.length > 0) {
        options.push(...renderDepartmentOptions(dept.children, level + 1));
      }
    });
    
    return options;
  };

  const getDepartmentDisplayName = (departmentId: string): string => {
    const findDepartment = (depts: Department[]): Department | null => {
      for (const dept of depts) {
        if (dept.id === departmentId) return dept;
        const found = findDepartment(dept.children || []);
        if (found) return found;
      }
      return null;
    };
    
    const dept = findDepartment(departments);
    return dept ? dept.name : '未知部门';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="w-5 h-5" />
            邀请用户加入企业
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="email" className="space-y-4">
          <TabsList>
            <TabsTrigger value="email">邮箱邀请</TabsTrigger>
            <TabsTrigger value="batch">批量邮箱</TabsTrigger>
            <TabsTrigger value="link">链接&二维码</TabsTrigger>
          </TabsList>

          <TabsContent value="email" className="space-y-8">
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium">邮箱邀请</h3>
                <Button onClick={addInviteUser} variant="outline" size="sm">
                  <Plus className="w-4 h-4 mr-2" />
                  添加用户
                </Button>
              </div>

              <div className="space-y-6">
                {inviteUsers.map((user, index) => (
                  <div key={user.id} className="flex items-start gap-4 p-6 border rounded-lg bg-gray-50">
                    <div className="flex-1 space-y-6">
                      {/* 第一行：邮箱地址 */}
                      <div className="space-y-2">
                        <Label htmlFor={`email-${user.id}`} className="text-sm font-medium text-gray-700">
                          邮箱地址 *
                        </Label>
                        <Input
                          id={`email-${user.id}`}
                          type="email"
                          placeholder="user@example.com"
                          value={user.email}
                          onChange={(e) => updateInviteUser(user.id, 'email', e.target.value)}
                          className={`mt-1 ${!user.email || isValidEmail(user.email) ? '' : 'border-red-300'}`}
                        />
                      </div>
                      
                      {/* 第二行：角色和部门 */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <Label htmlFor={`role-${user.id}`} className="text-sm font-medium text-gray-700">
                            角色
                          </Label>
                          <Select 
                            value={user.role} 
                            onValueChange={(value) => updateInviteUser(user.id, 'role', value)}
                          >
                            <SelectTrigger className="mt-1">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {availableRoles.map((role) => (
                                <SelectItem key={role.key} value={role.key}>
                                  <div className="flex items-center gap-2">
                                    {getRoleIcon(role.key)}
                                    <span>{role.name}</span>
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        
                        <div className="space-y-2">
                          <Label htmlFor={`department-${user.id}`} className="text-sm font-medium text-gray-700">
                            部门 (可选)
                          </Label>
                          <Select 
                            value={user.departmentId || 'none'} 
                            onValueChange={(value) => updateInviteUser(user.id, 'departmentId', value === 'none' ? '' : value)}
                            disabled={loadingDepartments}
                          >
                            <SelectTrigger className="mt-1">
                              <SelectValue placeholder={loadingDepartments ? "加载中..." : "选择部门"} />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">不指定部门</SelectItem>
                              {renderDepartmentOptions(departments)}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      
                      {/* 部门显示标签 */}
                      {user.departmentId && user.departmentId !== 'none' && (
                        <div className="flex items-center gap-2 pt-2">
                          <span className="text-sm text-gray-600">已选择部门:</span>
                          <Badge variant="outline" className="text-xs">
                            <Building2 className="w-3 h-3 mr-1" />
                            {getDepartmentDisplayName(user.departmentId)}
                          </Badge>
                        </div>
                      )}
                    </div>
                    {inviteUsers.length > 1 && (
                      <Button
                        onClick={() => removeInviteUser(user.id)}
                        variant="ghost"
                        size="sm"
                        className="text-red-500 hover:text-red-700"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>

              <div className="space-y-3">
                <Label htmlFor="message" className="text-sm font-medium text-gray-700">
                  邀请消息 (可选)
                </Label>
                <Textarea
                  id="message"
                  placeholder="欢迎加入我们的团队..."
                  value={inviteMessage}
                  onChange={(e) => setInviteMessage(e.target.value)}
                  rows={3}
                  className="mt-1"
                />
              </div>

              <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-lg">
                <AlertCircle className="w-4 h-4 text-blue-500" />
                <p className="text-sm text-blue-700">
                  被邀请用户将收到邮件邀请，需要点击链接完成注册并加入企业。指定的部门将自动分配给用户。
                </p>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button onClick={() => onOpenChange(false)} variant="outline" size="lg">
                  取消
                </Button>
                <Button 
                  onClick={handleSendInvites} 
                  disabled={!canSendInvites || sending}
                  size="lg"
                >
                  <Send className="w-4 h-4 mr-2" />
                  {sending ? '发送中...' : `发送邀请 (${inviteUsers.filter(u => u.email.trim()).length})`}
                </Button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="link" className="space-y-6">
            <div className="space-y-4">
              <h3 className="text-lg font-medium">邀请链接与二维码</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="link-role">默认角色</Label>
                  <Select value={inviteLinkRole} onValueChange={setInviteLinkRole}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {availableRoles.map((role) => (
                        <SelectItem key={role.key} value={role.key}>
                          <div className="flex items-center gap-2">
                            {getRoleIcon(role.key)}
                            <span>{role.name}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="link-department">默认部门</Label>
                  <Select 
                    value={inviteLinkDepartment} 
                    onValueChange={setInviteLinkDepartment}
                    disabled={loadingDepartments}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={loadingDepartments ? "加载中..." : "选择部门"} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">不指定部门</SelectItem>
                      {renderDepartmentOptions(departments)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end">
                  <Button 
                    onClick={handleGenerateInviteLink} 
                    disabled={generatingLink}
                    className="w-full"
                  >
                    <Link className="w-4 h-4 mr-2" />
                    {generatingLink ? '生成中...' : '生成邀请'}
                  </Button>
                </div>
              </div>

              {inviteLink && (
                <div className="space-y-6">
                  {/* 邀请链接和二维码并排显示 */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* 邀请链接部分 */}
                    <div className="space-y-3">
                      <Label>邀请链接</Label>
                      <div className="flex items-center gap-2">
                        <Input
                          value={inviteLink}
                          readOnly
                          className="flex-1 font-mono text-sm"
                        />
                        <Button onClick={copyInviteLink} variant="outline" size="sm">
                          <Copy className="w-4 h-4" />
                        </Button>
                      </div>
                      <div className="space-y-2 text-sm text-gray-600">
                        <p>• 适用于在线分享和邮件转发</p>
                        <p>• 点击链接即可访问注册页面</p>
                        <p>• 支持复制粘贴到任何平台</p>
                      </div>
                    </div>

                    {/* 二维码部分 */}
                    <div className="space-y-3">
                      <Label>二维码</Label>
                      <div className="flex flex-col items-center space-y-3">
                        {qrCodeDataUrl ? (
                          <>
                            <div className="p-4 bg-white border-2 border-gray-200 rounded-lg">
                              <img 
                                src={qrCodeDataUrl} 
                                alt="邀请二维码" 
                                className="w-48 h-48"
                              />
                            </div>
                            <Button onClick={downloadQRCode} variant="outline" size="sm">
                              <Download className="w-4 h-4 mr-2" />
                              下载二维码
                            </Button>
                          </>
                        ) : (
                          <div className="w-48 h-48 bg-gray-100 border-2 border-gray-200 rounded-lg flex items-center justify-center">
                            <div className="text-gray-500 text-sm">生成二维码中...</div>
                          </div>
                        )}
                        <div className="space-y-2 text-sm text-gray-600 text-center">
                          <p>• 扫码即可快速访问</p>
                          <p>• 适用于海报、宣传单</p>
                          <p>• 移动端友好</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 状态提示 */}
                  <div className="flex items-center gap-2 p-3 bg-green-50 rounded-lg">
                    <Check className="w-4 h-4 text-green-500" />
                    <p className="text-sm text-green-700">
                      邀请已生成，有效期7天。通过链接或扫码注册的用户将自动获得 
                      <Badge className="mx-1">{availableRoles.find(r => r.key === inviteLinkRole)?.name}</Badge>
                      角色
                      {inviteLinkDepartment && inviteLinkDepartment !== 'none' && (
                        <>
                          并加入
                          <Badge className="mx-1">{getDepartmentDisplayName(inviteLinkDepartment)}</Badge>
                          部门
                        </>
                      )}
                      。
                    </p>
                  </div>
                </div>
              )}

              <Separator />

              <div className="space-y-3">
                <h4 className="font-medium">适用场景</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-600">
                  <div className="space-y-2">
                    <h5 className="font-medium text-gray-700">邀请链接</h5>
                    <p>• 邮件邀请和在线分享</p>
                    <p>• 社交媒体传播</p>
                    <p>• 批量招募宣传</p>
                  </div>
                  <div className="space-y-2">
                    <h5 className="font-medium text-gray-700">二维码</h5>
                    <p>• 现场招募和活动推广</p>
                    <p>• 打印材料和海报</p>
                    <p>• 移动端快速访问</p>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="batch" className="space-y-8">
            <div className="space-y-6">
              <h3 className="text-lg font-medium">批量邮箱邀请</h3>
              
              <div className="space-y-6">
                <div className="space-y-3">
                  <Label htmlFor="batch-emails" className="text-sm font-medium text-gray-700">
                    邮箱列表 (每行一个邮箱)
                  </Label>
                  <Textarea
                    id="batch-emails"
                    placeholder="user1@example.com&#10;user2@example.com&#10;user3@example.com"
                    value={batchEmails}
                    onChange={(e) => setBatchEmails(e.target.value)}
                    rows={8}
                    className="font-mono text-sm mt-1"
                  />
                  <p className="text-sm text-gray-500">
                    支持最多50个邮箱地址，每行一个
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="batch-role" className="text-sm font-medium text-gray-700">
                      统一角色
                    </Label>
                    <Select value={inviteLinkRole} onValueChange={setInviteLinkRole}>
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {availableRoles.map((role) => (
                          <SelectItem key={role.key} value={role.key}>
                            <div className="flex items-center gap-2">
                              {getRoleIcon(role.key)}
                              <span>{role.name}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="batch-department" className="text-sm font-medium text-gray-700">
                      统一部门
                    </Label>
                    <Select 
                      value={inviteLinkDepartment} 
                      onValueChange={setInviteLinkDepartment}
                      disabled={loadingDepartments}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder={loadingDepartments ? "加载中..." : "选择部门"} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">不指定部门</SelectItem>
                        {renderDepartmentOptions(departments)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-3">
                  <Label htmlFor="batch-message" className="text-sm font-medium text-gray-700">
                    邀请消息 (可选)
                  </Label>
                  <Textarea
                    id="batch-message"
                    placeholder="欢迎加入我们的企业团队..."
                    value={inviteMessage}
                    onChange={(e) => setInviteMessage(e.target.value)}
                    rows={3}
                    className="mt-1"
                  />
                </div>

                <div className="flex items-center gap-2 p-4 bg-orange-50 rounded-lg">
                  <AlertCircle className="w-4 h-4 text-orange-500" />
                  <p className="text-sm text-orange-700">
                    批量邀请将使用统一的角色和部门设置。所有用户将收到邮件邀请。
                  </p>
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <Button onClick={() => onOpenChange(false)} variant="outline" size="lg">
                    取消
                  </Button>
                  <Button 
                    onClick={handleBatchInvite} 
                    disabled={!batchEmails.trim() || sending}
                    size="lg"
                  >
                    <Send className="w-4 h-4 mr-2" />
                    {sending ? '发送中...' : `批量邀请`}
                  </Button>
                </div>
              </div>
            </div>
          </TabsContent>

        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
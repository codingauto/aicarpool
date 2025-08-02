'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CreateCarpoolGroupDialog } from '@/components/dialogs/create-carpool-group-dialog';
import { CreateEnterpriseDialog } from '@/components/dialogs/create-enterprise-dialog';
import { 
  Building2, 
  Plus, 
  Search, 
  Users, 
  Activity, 
  DollarSign,
  AlertCircle,
  ArrowRight,
  Crown,
  Shield
} from 'lucide-react';

interface Enterprise {
  id: string;
  name: string;
  planType: string;
  organizationType: string;
  creationTemplate?: string;
  uiTheme?: string;
  featureSet?: any;
  userRole: 'owner' | 'admin' | 'member';
  memberCount: number;
  groupCount: number;
  monthlyUsage: number;
  lastAccessed: string;
  isActive: boolean;
}

export default function EnterpriseSelectionPage() {
  const router = useRouter();
  const [enterprises, setEnterprises] = useState<Enterprise[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [user, setUser] = useState<any>(null);
  
  // 弹框状态
  const [showCarpoolDialog, setShowCarpoolDialog] = useState(false);
  const [showEnterpriseDialog, setShowEnterpriseDialog] = useState(false);

  useEffect(() => {
    checkAuthAndLoadEnterprises();
  }, []);

  const checkAuthAndLoadEnterprises = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        router.push('/landing');
        return;
      }

      // 获取用户信息
      const userResponse = await fetch('/api/user/profile', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!userResponse.ok) {
        if (userResponse.status === 401) {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          router.push('/landing');
          return;
        }
        throw new Error('获取用户信息失败');
      }

      const userData = await userResponse.json();
      if (userData.success) {
        setUser(userData.data);
      }

      // 获取用户的企业列表
      const enterprisesResponse = await fetch('/api/user/enterprises', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (enterprisesResponse.ok) {
        const enterprisesData = await enterprisesResponse.json();
        if (enterprisesData.success && enterprisesData.data) {
          const userEnterprises = enterprisesData.data.map((item: any) => ({
            id: item.enterprise.id,
            name: item.enterprise.name,
            planType: item.enterprise.planType,
            userRole: item.role,
            memberCount: item.enterprise._count?.members || 0,
            groupCount: item.enterprise._count?.groups || 0,
            monthlyUsage: 0, // TODO: 从实际API获取
            lastAccessed: item.lastAccessed || item.joinedAt,
            isActive: item.isActive
          }));

          setEnterprises(userEnterprises);

          // 注释掉自动跳转逻辑，让用户手动选择企业
          // if (userEnterprises.length === 1) {
          //   const enterprise = userEnterprises[0];
          //   await updateLastAccessed(enterprise.id);
          //   router.push(`/enterprise/${enterprise.id}/dashboard`);
          //   return;
          // }
        } else {
          // 用户没有企业，显示创建/加入企业的引导
          setEnterprises([]);
        }
      } else {
        setError('获取企业列表失败');
      }
    } catch (error) {
      console.error('加载企业列表失败:', error);
      setError('加载失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  const updateLastAccessed = async (enterpriseId: string) => {
    try {
      const token = localStorage.getItem('token');
      await fetch('/api/user/enterprises/access', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ enterpriseId })
      });
    } catch (error) {
      console.warn('更新访问时间失败:', error);
    }
  };

  const handleEnterpriseSelect = async (enterprise: Enterprise) => {
    await updateLastAccessed(enterprise.id);
    
    // 根据组织类型跳转到不同的页面
    if (enterprise.organizationType === 'carpool_group') {
      router.push(`/carpool-groups/${enterprise.id}`);
    } else {
      router.push(`/enterprise/${enterprise.id}/dashboard`);
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'owner':
        return <Crown className="w-4 h-4 text-yellow-600" />;
      case 'admin':
        return <Shield className="w-4 h-4 text-blue-600" />;
      default:
        return <Users className="w-4 h-4 text-gray-600" />;
    }
  };

  const getRoleLabel = (role: string, organizationType: string = 'enterprise') => {
    if (organizationType === 'carpool_group') {
      switch (role) {
        case 'owner':
          return '拼车组长';
        default:
          return '拼车成员';
      }
    } else {
      switch (role) {
        case 'owner':
          return '所有者';
        case 'admin':
          return '管理员';
        default:
          return '成员';
      }
    }
  };

  const getPlanTypeColor = (planType: string) => {
    switch (planType) {
      case 'enterprise':
        return 'bg-purple-100 text-purple-800';
      case 'professional':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const filteredEnterprises = enterprises.filter(enterprise =>
    enterprise.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="text-lg text-gray-600">加载企业信息...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">

      {/* 主内容 */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {enterprises.length === 0 ? (
          // 场景化创建界面
          <div className="text-center py-12">
            <Building2 className="w-20 h-20 mx-auto text-gray-400 mb-6" />
            <h2 className="text-2xl font-bold text-gray-900 mb-4">欢迎使用 AiCarpool</h2>
            <p className="text-gray-600 mb-8 max-w-2xl mx-auto">
              选择最适合您团队的AI资源管理方式，开始高效的AI编程工具协作体验。
            </p>
            
            {/* 场景选择卡片 */}
            <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto mb-8">
              {/* 拼车组场景 */}
              <Card className="hover:shadow-lg transition-all cursor-pointer border-2 hover:border-blue-300" 
                    onClick={() => setShowCarpoolDialog(true)}>
                <CardContent className="pt-6 pb-8 px-8">
                  <div className="text-center">
                    <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <span className="text-2xl">🚗</span>
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2">创建拼车组</h3>
                    <p className="text-gray-600 mb-4 text-sm">
                      适合3-15人的小团队<br/>
                      轻量级协作，快速上手
                    </p>
                    <div className="flex items-center justify-center space-x-4 text-xs text-gray-500 mb-6">
                      <span>⚡ 5分钟创建</span>
                      <span>📱 移动友好</span>
                      <span>💰 成本分摊</span>
                    </div>
                    <Button className="w-full bg-blue-600 hover:bg-blue-700">
                      创建拼车组
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* 企业场景 */}
              <Card className="hover:shadow-lg transition-all cursor-pointer border-2 hover:border-purple-300"
                    onClick={() => setShowEnterpriseDialog(true)}>
                <CardContent className="pt-6 pb-8 px-8">
                  <div className="text-center">
                    <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <span className="text-2xl">🏢</span>
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2">创建企业</h3>
                    <p className="text-gray-600 mb-4 text-sm">
                      适合50+人的正式企业<br/>
                      完整管理，专业功能
                    </p>
                    <div className="flex items-center justify-center space-x-4 text-xs text-gray-500 mb-6">
                      <span>🏗️ 完整配置</span>
                      <span>👥 组织架构</span>
                      <span>🔒 权限管理</span>
                    </div>
                    <Button className="w-full bg-purple-600 hover:bg-purple-700">
                      创建企业
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* 加入现有组织 */}
            <div className="mt-8 pt-6 border-t border-gray-200">
              <p className="text-sm text-gray-500 mb-4">已有邀请码？</p>
              <div className="flex justify-center">
                <Button variant="outline" onClick={() => router.push('/join')}>
                  加入现有组织
                </Button>
              </div>
            </div>
          </div>
        ) : (
          // 企业选择界面
          <>
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-gray-900 mb-4">我的组织</h2>
              <p className="text-gray-600 max-w-2xl mx-auto">
                选择要进入的组织。每个组织都有独立的AI资源管理和团队协作功能。
              </p>
            </div>

            {/* 搜索栏 */}
            {enterprises.length > 4 && (
              <div className="mb-6">
                <div className="relative max-w-md mx-auto">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <Input
                    placeholder="搜索企业..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
            )}


            {/* 所有企业列表 */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                {searchQuery ? '搜索结果' : '所有企业'}
              </h3>
              <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 justify-items-center max-w-6xl mx-auto">
                {filteredEnterprises.map((enterprise) => (
                  <Card 
                    key={enterprise.id} 
                    className="hover:shadow-lg transition-shadow cursor-pointer w-full max-w-sm"
                    onClick={() => handleEnterpriseSelect(enterprise)}
                  >
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="flex items-center gap-3">
                          {enterprise.organizationType === 'carpool_group' ? (
                            <div className="w-6 h-6 text-blue-500">🚗</div>
                          ) : (
                            <Building2 className="w-6 h-6 text-blue-500" />
                          )}
                          {enterprise.name}
                        </CardTitle>
                        <div className="flex items-center gap-2">
                          {getRoleIcon(enterprise.userRole)}
                          <Badge className={
                            enterprise.organizationType === 'carpool_group' 
                              ? 'bg-blue-100 text-blue-800'
                              : getPlanTypeColor(enterprise.planType)
                          }>
                            {enterprise.organizationType === 'carpool_group' 
                              ? '拼车组' 
                              : (enterprise.planType === 'enterprise' ? '企业版' : 
                                 enterprise.planType === 'professional' ? '专业版' : '基础版')
                            }
                          </Badge>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <CardDescription>
                        您的角色：{getRoleLabel(enterprise.userRole, enterprise.organizationType)}
                      </CardDescription>
                      
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div className="text-center">
                          <div className="flex items-center justify-center mb-1">
                            <Users className="w-4 h-4 text-gray-500" />
                          </div>
                          <div className="font-medium">{enterprise.memberCount}</div>
                          <div className="text-gray-500">成员</div>
                        </div>
                        <div className="text-center">
                          <div className="flex items-center justify-center mb-1">
                            <Activity className="w-4 h-4 text-gray-500" />
                          </div>
                          <div className="font-medium">{enterprise.groupCount}</div>
                          <div className="text-gray-500">拼车组</div>
                        </div>
                        <div className="text-center">
                          <div className="flex items-center justify-center mb-1">
                            <DollarSign className="w-4 h-4 text-gray-500" />
                          </div>
                          <div className="font-medium">${enterprise.monthlyUsage}</div>
                          <div className="text-gray-500">月使用</div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t">
                        <div className="text-xs text-gray-500">
                          最后访问: {new Date(enterprise.lastAccessed).toLocaleDateString('zh-CN')}
                        </div>
                        <Button size="sm" variant="outline">
                          进入管理
                          <ArrowRight className="w-4 h-4 ml-1" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

            {/* 创建新组织按钮 */}
            <div className="mt-8 text-center space-x-4">
              <Button 
                variant="outline" 
                onClick={() => setShowCarpoolDialog(true)}
                className="border-blue-300 text-blue-600 hover:bg-blue-50"
              >
                <Plus className="w-4 h-4 mr-2" />
                创建拼车组
              </Button>
              <Button 
                variant="outline" 
                onClick={() => setShowEnterpriseDialog(true)}
                className="border-purple-300 text-purple-600 hover:bg-purple-50"
              >
                <Plus className="w-4 h-4 mr-2" />
                创建企业
              </Button>
            </div>
          </>
        )}
      </div>

      {/* 创建拼车组弹框 */}
      <CreateCarpoolGroupDialog
        open={showCarpoolDialog}
        onOpenChange={setShowCarpoolDialog}
        onSuccess={() => {
          // 创建成功后刷新页面数据
          checkAuthAndLoadEnterprises();
        }}
      />

      {/* 创建企业弹框 */}
      <CreateEnterpriseDialog
        open={showEnterpriseDialog}
        onOpenChange={setShowEnterpriseDialog}
        onSuccess={() => {
          // 创建成功后刷新页面数据
          checkAuthAndLoadEnterprises();
        }}
      />
    </div>
  );
}

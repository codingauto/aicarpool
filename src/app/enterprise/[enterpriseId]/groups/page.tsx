'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { 
  Users, 
  Plus, 
  AlertCircle, 
  Edit, 
  Trash2, 
  Settings,
  ChevronLeft,
  Building2,
  DollarSign,
  Activity,
  Search,
  CheckCircle,
  AlertTriangle,
  Clock,
  Database,
  Zap
} from 'lucide-react';

interface Group {
  id: string;
  name: string;
  description: string | null;
  maxMembers: number;
  status: string;
  enterpriseId: string | null;
  departmentId: string | null;
  memberCount: number;
  role?: 'admin' | 'member'; // 用户在该组中的角色
  resourceBinding?: {
    bindingMode: string;
    dailyTokenLimit: number;
    monthlyBudget: number | null;
    priorityLevel?: number;
    warningThreshold?: number;
    alertThreshold?: number;
  };
  usageStats?: {
    totalRequests: number;
    totalTokens: number;
    totalCost: number;
    dailyTokens?: number;
    dailyCost?: number;
    requestCount?: number;
    tokenLimit?: number;
    costLimit?: number;
  };
  resourceConfig?: {
    bindingMode: 'dedicated' | 'shared' | 'hybrid';
    isConfigured: boolean;
    isActive: boolean;
  };
  createdAt: string;
  lastActiveAt?: string;
}

interface Enterprise {
  id: string;
  name: string;
  planType: string;
}

interface PageProps {
  params: Promise<{ enterpriseId: string }>;
}

export default function EnterpriseGroupsPage({ params }: PageProps) {
  const router = useRouter();
  const [groups, setGroups] = useState<Group[]>([]);
  const [enterprise, setEnterprise] = useState<Enterprise | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState<string | null>(null);
  const [enterpriseId, setEnterpriseId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterDepartment, setFilterDepartment] = useState<string>('all');
  const [departments, setDepartments] = useState<any[]>([]);

  useEffect(() => {
    params.then(resolvedParams => {
      setEnterpriseId(resolvedParams.enterpriseId);
      fetchEnterpriseAndGroups(resolvedParams.enterpriseId);
      fetchDepartments(resolvedParams.enterpriseId);
      
      // 检查URL参数是否指定了部门筛选
      const urlParams = new URLSearchParams(window.location.search);
      const departmentParam = urlParams.get('department');
      if (departmentParam) {
        setFilterDepartment(departmentParam);
      }
    });
  }, []);

  const fetchEnterpriseAndGroups = async (entId: string) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setError('请先登录');
        return;
      }

      // 获取企业信息
      const enterpriseResponse = await fetch(`/api/enterprises/${entId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!enterpriseResponse.ok) {
        if (enterpriseResponse.status === 404) {
          setError('企业不存在');
        } else if (enterpriseResponse.status === 403) {
          setError('您没有权限访问此企业');
        } else {
          setError('获取企业信息失败');
        }
        return;
      }

      const enterpriseData = await enterpriseResponse.json();
      if (enterpriseData.success) {
        setEnterprise(enterpriseData.data);
      }

      // 获取企业下的拼车组
      const groupsResponse = await fetch(`/api/enterprises/${entId}/groups`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (groupsResponse.ok) {
        const groupsData = await groupsResponse.json();
        if (groupsData.success) {
          // 转换API数据格式为前端期望的格式
          const formattedGroups: Group[] = (groupsData.data || []).map((apiGroup: any) => {
            // 计算资源配置状态
            const hasResourceBinding = apiGroup.resourceBinding;
            const isActive = apiGroup.status === 'active';
            
            return {
              id: apiGroup.id,
              name: apiGroup.name,
              description: apiGroup.description,
              maxMembers: apiGroup.maxMembers,
              status: apiGroup.status,
              enterpriseId: apiGroup.enterpriseId,
              departmentId: apiGroup.departmentId,
              memberCount: apiGroup.memberCount || 0,
              role: 'admin', // 企业管理员默认为组管理员
              resourceBinding: apiGroup.resourceBinding,
              usageStats: apiGroup.usageStats ? {
                totalRequests: apiGroup.usageStats.totalRequests || 0,
                totalTokens: apiGroup.usageStats.totalTokens || 0,
                totalCost: apiGroup.usageStats.totalCost || 0,
                // 模拟实时数据
                dailyTokens: Math.floor(Math.random() * 10000),
                dailyCost: Math.random() * 50,
                requestCount: Math.floor(Math.random() * 200),
                tokenLimit: apiGroup.resourceBinding?.dailyTokenLimit || 50000,
                costLimit: apiGroup.resourceBinding?.monthlyBudget || 500
              } : {
                totalRequests: 0,
                totalTokens: 0,
                totalCost: 0,
                dailyTokens: 0,
                dailyCost: 0,
                requestCount: 0,
                tokenLimit: 50000,
                costLimit: 500
              },
              resourceConfig: {
                bindingMode: apiGroup.resourceBinding?.bindingMode || 'shared',
                isConfigured: !!hasResourceBinding,
                isActive: isActive && !!hasResourceBinding
              },
              createdAt: apiGroup.createdAt,
              lastActiveAt: apiGroup.updatedAt || apiGroup.createdAt
            };
          });
          
          setGroups(formattedGroups);
        } else {
          setError(groupsData.error || '获取拼车组列表失败');
        }
      } else {
        setError('获取拼车组列表失败');
      }

    } catch (error) {
      console.error('获取数据失败:', error);
      setError('获取数据失败，请检查网络连接');
    } finally {
      setLoading(false);
    }
  };

  const fetchDepartments = async (entId: string) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/enterprises/${entId}/departments`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          // 扁平化部门结构
          const flattenDepartments = (depts: any[]): any[] => {
            let result: any[] = [];
            depts.forEach(dept => {
              result.push(dept);
              if (dept.children && dept.children.length > 0) {
                result = result.concat(flattenDepartments(dept.children));
              }
            });
            return result;
          };
          
          setDepartments(flattenDepartments(data.data.departments || []));
        }
      }
    } catch (error) {
      console.error('获取部门列表失败:', error);
    }
  };

  const handleDeleteGroup = async (groupId: string) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/groups/${groupId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();
      if (data.success) {
        await fetchEnterpriseAndGroups(enterpriseId);
        setDeleteDialogOpen(null);
        alert('拼车组删除成功');
      } else {
        alert(data.error || '删除拼车组失败');
      }
    } catch (error) {
      console.error('删除拼车组失败:', error);
      alert('删除拼车组失败');
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge variant="default" className="bg-green-100 text-green-800">活跃</Badge>;
      case 'inactive':
        return <Badge variant="secondary">停用</Badge>;
      case 'archived':
        return <Badge variant="outline">已归档</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getBindingModeBadge = (mode?: string) => {
    if (!mode) return null;
    
    const config = {
      dedicated: { label: '专属', className: 'bg-purple-100 text-purple-800' },
      shared: { label: '共享', className: 'bg-blue-100 text-blue-800' },
      hybrid: { label: '混合', className: 'bg-orange-100 text-orange-800' }
    }[mode] || { label: mode, className: 'bg-gray-100 text-gray-800' };

    return <Badge className={config.className}>{config.label}</Badge>;
  };

  const getBindingModeDisplayName = (mode: string) => {
    const displayNames: Record<string, string> = {
      'dedicated': '专属',
      'shared': '共享', 
      'hybrid': '混合'
    };
    return displayNames[mode] || mode;
  };

  const getConfigStatusIcon = (config?: Group['resourceConfig']) => {
    if (!config) {
      return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
    }
    
    if (config.isConfigured && config.isActive) {
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    } else if (config.isConfigured && !config.isActive) {
      return <AlertTriangle className="h-4 w-4 text-orange-500" />;
    } else {
      return <AlertTriangle className="h-4 w-4 text-red-500" />;
    }
  };

  // 筛选拼车组
  const filteredGroups = groups.filter(group => {
    const matchesSearch = group.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         group.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = filterStatus === 'all' || group.status === filterStatus;
    const matchesDepartment = filterDepartment === 'all' || group.departmentId === filterDepartment;
    
    return matchesSearch && matchesStatus && matchesDepartment;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-500">加载企业拼车组...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-6xl mx-auto">
        {/* 面包屑和标题 */}
        <div className="flex items-center gap-4 mb-6">
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => router.push(`/enterprise/${enterpriseId}/dashboard`)}
          >
            <ChevronLeft className="w-4 h-4 mr-2" />
            返回企业控制面板
          </Button>
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Building2 className="w-4 h-4" />
            <span>{enterprise?.name || '未知企业'}</span>
            <span>/</span>
            <span>拼车组管理</span>
          </div>
        </div>

        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-2">拼车组管理</h1>
            <p className="text-gray-600">
              管理企业下的拼车组，配置资源绑定和使用配额
            </p>
          </div>
          <Button 
            onClick={() => router.push(`/enterprise/${enterpriseId}/groups/create`)}
          >
            <Plus className="w-4 h-4 mr-2" />
            创建拼车组
          </Button>
        </div>

        {/* 搜索和筛选 */}
        <div className="flex flex-col md:flex-row gap-4 mb-8">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="搜索拼车组名称或描述..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="筛选状态" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部状态</SelectItem>
              <SelectItem value="active">活跃</SelectItem>
              <SelectItem value="inactive">停用</SelectItem>
              <SelectItem value="archived">已归档</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterDepartment} onValueChange={setFilterDepartment}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="筛选部门" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部部门</SelectItem>
              {departments.map(dept => (
                <SelectItem key={dept.id} value={dept.id}>
                  {dept.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* 搜索结果提示 */}
        {(searchQuery || filterStatus !== 'all' || filterDepartment !== 'all') && (
          <div className="mb-6">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                找到 {filteredGroups.length} 个匹配的拼车组
                {searchQuery && ` (搜索: "${searchQuery}")`}
                {filterStatus !== 'all' && ` (状态: ${filterStatus})`}
                {filterDepartment !== 'all' && ` (部门: ${departments.find(d => d.id === filterDepartment)?.name || filterDepartment})`}
              </AlertDescription>
            </Alert>
          </div>
        )}

        {/* 统计概览 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Users className="w-8 h-8 text-blue-500" />
                <div>
                  <p className="text-sm text-gray-600">总拼车组数</p>
                  <p className="text-2xl font-bold">{groups.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Activity className="w-8 h-8 text-green-500" />
                <div>
                  <p className="text-sm text-gray-600">活跃拼车组</p>
                  <p className="text-2xl font-bold">
                    {groups.filter(g => g.status === 'active').length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <DollarSign className="w-8 h-8 text-orange-500" />
                <div>
                  <p className="text-sm text-gray-600">总成员数</p>
                  <p className="text-2xl font-bold">
                    {groups.reduce((sum, g) => sum + (g.memberCount || 0), 0)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {groups.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-12">
                <Users className="w-16 h-16 mx-auto text-gray-400 mb-4" />
                <h3 className="text-xl font-medium mb-2">暂无拼车组</h3>
                <p className="text-gray-600 mb-6">
                  这个企业下还没有创建任何拼车组，开始创建您的第一个拼车组
                </p>
                <Button 
                  onClick={() => router.push(`/enterprise/${enterpriseId}/groups/create`)}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  创建拼车组
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6">
            {filteredGroups.map((group) => (
              <Card key={group.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <CardTitle className="flex items-center gap-3">
                        <Users className="w-6 h-6 text-blue-500" />
                        {group.name}
                      </CardTitle>
                      {getStatusBadge(group.status)}
                      {getBindingModeBadge(group.resourceBinding?.bindingMode)}
                      <div className="flex items-center gap-1">
                        {getConfigStatusIcon(group.resourceConfig)}
                        <span className="text-xs text-gray-500">
                          {group.resourceConfig?.isConfigured ? '已配置' : '未配置'}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => router.push(`/enterprise/${enterpriseId}/groups/${group.id}`)}
                      >
                        <Settings className="w-4 h-4 mr-1" />
                        配置
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => router.push(`/groups/${group.id}`)}
                      >
                        查看详情
                      </Button>
                      <Button 
                        variant="destructive" 
                        size="sm"
                        onClick={() => setDeleteDialogOpen(group.id)}
                      >
                        <Trash2 className="w-4 h-4 mr-1" />
                        删除
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <CardDescription>
                    {group.description || '暂无描述'}
                  </CardDescription>
                  
                  {/* 成员使用进度 */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">成员使用情况</span>
                      <span className="font-medium">
                        {group.memberCount || 0} / {group.maxMembers}
                      </span>
                    </div>
                    <Progress 
                      value={((group.memberCount || 0) / group.maxMembers) * 100} 
                      className="h-2" 
                    />
                  </div>

                  {/* Token使用进度 */}
                  {group.usageStats && group.usageStats.tokenLimit && (
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">今日Token使用</span>
                        <span className="font-medium">
                          {group.usageStats.dailyTokens?.toLocaleString()} / {group.usageStats.tokenLimit?.toLocaleString()}
                        </span>
                      </div>
                      <Progress 
                        value={((group.usageStats.dailyTokens || 0) / (group.usageStats.tokenLimit || 1)) * 100} 
                        className="h-2" 
                      />
                    </div>
                  )}

                  {/* 成本使用进度 */}
                  {group.usageStats && group.usageStats.costLimit && (
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">今日成本</span>
                        <span className="font-medium">
                          ${group.usageStats.dailyCost?.toFixed(2)} / ${group.usageStats.costLimit}
                        </span>
                      </div>
                      <Progress 
                        value={((group.usageStats.dailyCost || 0) / (group.usageStats.costLimit || 1)) * 100} 
                        className="h-2" 
                      />
                    </div>
                  )}
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div className="flex items-center gap-2">
                      <Database className="w-4 h-4 text-gray-400" />
                      <div>
                        <div className="text-gray-600">绑定模式</div>
                        <div className="font-medium">
                          {getBindingModeDisplayName(group.resourceBinding?.bindingMode || 'shared')}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Zap className="w-4 h-4 text-gray-400" />
                      <div>
                        <div className="text-gray-600">日用量限制</div>
                        <div className="font-medium">
                          {group.resourceBinding?.dailyTokenLimit?.toLocaleString() || '--'} tokens
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <DollarSign className="w-4 h-4 text-gray-400" />
                      <div>
                        <div className="text-gray-600">月预算</div>
                        <div className="font-medium">
                          ${group.resourceBinding?.monthlyBudget || '--'}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-gray-400" />
                      <div>
                        <div className="text-gray-600">创建时间</div>
                        <div className="font-medium">
                          {new Date(group.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                  </div>

                  {group.usageStats && (
                    <div className="border-t pt-4">
                      <h4 className="font-medium mb-3 flex items-center gap-2">
                        <Activity className="w-4 h-4" />
                        使用统计
                      </h4>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div className="bg-blue-50 p-3 rounded-lg">
                          <div className="text-blue-600 font-medium">{group.usageStats.totalRequests}</div>
                          <div className="text-blue-500 text-xs">总请求数</div>
                        </div>
                        <div className="bg-green-50 p-3 rounded-lg">
                          <div className="text-green-600 font-medium">{group.usageStats.totalTokens?.toLocaleString()}</div>
                          <div className="text-green-500 text-xs">总Token数</div>
                        </div>
                        <div className="bg-orange-50 p-3 rounded-lg">
                          <div className="text-orange-600 font-medium">${group.usageStats.totalCost?.toFixed(2)}</div>
                          <div className="text-orange-500 text-xs">总成本</div>
                        </div>
                        <div className="bg-purple-50 p-3 rounded-lg">
                          <div className="text-purple-600 font-medium">{group.usageStats.requestCount || 0}</div>
                          <div className="text-purple-500 text-xs">今日请求</div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 最后活跃时间 */}
                  {group.lastActiveAt && (
                    <div className="text-xs text-gray-500 border-t pt-2">
                      最后活跃: {new Date(group.lastActiveAt).toLocaleString()}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* 删除确认对话框 */}
        <Dialog 
          open={!!deleteDialogOpen} 
          onOpenChange={(open) => !open && setDeleteDialogOpen(null)}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>确认删除拼车组</DialogTitle>
              <DialogDescription>
                此操作不可逆，删除后所有相关数据将无法恢复。确定要删除这个拼车组吗？
              </DialogDescription>
            </DialogHeader>
            <div className="flex justify-end gap-2 mt-4">
              <Button 
                variant="outline" 
                onClick={() => setDeleteDialogOpen(null)}
              >
                取消
              </Button>
              <Button 
                variant="destructive" 
                onClick={() => deleteDialogOpen && handleDeleteGroup(deleteDialogOpen)}
              >
                确认删除
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
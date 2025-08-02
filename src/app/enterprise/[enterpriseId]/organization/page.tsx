'use client';

/**
 * 企业专属组织架构页面
 * 
 * 功能：
 * - 部门层级管理
 * - 人员分配
 * - 组织架构图
 * - 拼车组归属管理
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Building,
  Users,
  UserPlus,
  FolderPlus,
  Edit,
  Trash2,
  Plus,
  Search,
  ChevronRight,
  ChevronDown,
  Building2,
  MapPin,
  Crown,
  Shield,
  UserCheck,
  ChevronLeft
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEnterpriseContext } from '@/contexts/enterprise-context';

interface Department {
  id: string;
  name: string;
  description?: string;
  parentId?: string;
  children?: Department[];
  memberCount: number;
  groupCount: number;
  budgetLimit?: number;
  manager?: {
    id: string;
    name: string;
    email: string;
  };
}

interface OrganizationMember {
  id: string;
  name: string;
  email: string;
  role: string;
  department: string;
  title?: string;
  joinedAt: string;
  status: 'active' | 'inactive';
}

interface OrganizationGroup {
  id: string;
  name: string;
  department: string;
  memberCount: number;
  aiResourcesUsed: number;
  status: 'active' | 'inactive';
}

interface OrganizationData {
  departments: Department[];
  members: OrganizationMember[];
  groups: OrganizationGroup[];
  stats: {
    totalDepartments: number;
    totalMembers: number;
    totalGroups: number;
    activeDepartments: number;
  };
}

export default function EnterpriseOrganizationPage({ params }: { params: Promise<{ enterpriseId: string }> }) {
  const { enterpriseId } = React.use(params);
  const router = useRouter();
  const { currentEnterprise, hasRole } = useEnterpriseContext();
  const [organizationData, setOrganizationData] = useState<OrganizationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [showDepartmentDialog, setShowDepartmentDialog] = useState(false);
  const [showMemberDialog, setShowMemberDialog] = useState(false);
  const [selectedDepartment, setSelectedDepartment] = useState<Department | null>(null);
  const [expandedDepartments, setExpandedDepartments] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchOrganizationData();
  }, [enterpriseId]);

  const fetchOrganizationData = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/enterprises/${enterpriseId}/organization`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setOrganizationData(data.data);
        } else {
          setError(data.message || '获取组织架构数据失败');
        }
      } else {
        setError('获取组织架构数据失败');
      }
    } catch (error) {
      console.error('获取组织架构数据失败:', error);
      setError('获取组织架构数据失败');
    } finally {
      setLoading(false);
    }
  };

  const buildDepartmentTree = (departments: Department[], parentId?: string): Department[] => {
    return departments
      .filter(dept => dept.parentId === parentId)
      .map(dept => ({
        ...dept,
        children: buildDepartmentTree(departments, dept.id)
      }));
  };

  const toggleDepartmentExpansion = (departmentId: string) => {
    const newExpanded = new Set(expandedDepartments);
    if (newExpanded.has(departmentId)) {
      newExpanded.delete(departmentId);
    } else {
      newExpanded.add(departmentId);
    }
    setExpandedDepartments(newExpanded);
  };

  const renderDepartmentTree = (departments: Department[], level = 0) => {
    return departments.map((dept) => (
      <div key={dept.id} className="space-y-2">
        <div 
          className={`flex items-center justify-between p-3 border rounded-lg cursor-pointer hover:bg-gray-50 ${
            level > 0 ? 'ml-' + (level * 4) + ' border-l-4 border-l-blue-200' : ''
          }`}
          onClick={() => setSelectedDepartment(dept)}
        >
          <div className="flex items-center space-x-3">
            {dept.children && dept.children.length > 0 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleDepartmentExpansion(dept.id);
                }}
                className="p-1 hover:bg-gray-200 rounded"
              >
                {expandedDepartments.has(dept.id) ? (
                  <ChevronDown className="w-4 h-4" />
                ) : (
                  <ChevronRight className="w-4 h-4" />
                )}
              </button>
            )}
            <Building2 className="w-5 h-5 text-blue-500" />
            <div>
              <h4 className="font-medium text-gray-900">{dept.name}</h4>
              {dept.description && (
                <p className="text-sm text-gray-600">{dept.description}</p>
              )}
              {dept.manager && (
                <p className="text-xs text-gray-500">负责人: {dept.manager.name}</p>
              )}
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <div className="text-right text-sm text-gray-500">
              <p>{dept.memberCount} 名成员</p>
              <p>{dept.groupCount} 个拼车组</p>
            </div>
            {hasRole(['owner', 'admin']) && (
              <Button variant="ghost" size="sm">
                <Edit className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
        {dept.children && dept.children.length > 0 && expandedDepartments.has(dept.id) && (
          <div className="ml-4">
            {renderDepartmentTree(dept.children, level + 1)}
          </div>
        )}
      </div>
    ));
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'owner':
        return <Crown className="w-4 h-4 text-purple-500" />;
      case 'admin':
        return <Shield className="w-4 h-4 text-blue-500" />;
      default:
        return <UserCheck className="w-4 h-4 text-green-500" />;
    }
  };

  const filteredMembers = organizationData?.members.filter(member =>
    member.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    member.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    member.department.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-40 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error || !organizationData) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center py-12">
          <Building className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">组织架构加载失败</h3>
          <p className="text-gray-600 mb-4">{error || '暂无组织架构数据'}</p>
          <Button onClick={fetchOrganizationData}>重试</Button>
        </div>
      </div>
    );
  }

  const departmentTree = buildDepartmentTree(organizationData.departments);

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
            <span>{currentEnterprise?.name || '未知企业'}</span>
            <span>/</span>
            <span>组织架构</span>
          </div>
        </div>

        <div className="space-y-6">
        {/* 页面标题 */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Building className="w-6 h-6 text-blue-600" />
              组织架构
            </h1>
            <p className="text-gray-600 mt-1">
              管理企业部门结构和人员分配
            </p>
          </div>
          {hasRole(['owner', 'admin']) && (
            <div className="flex gap-2">
              <Dialog open={showMemberDialog} onOpenChange={setShowMemberDialog}>
                <DialogTrigger asChild>
                  <Button variant="outline">
                    <UserPlus className="w-4 h-4 mr-2" />
                    添加成员
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>添加成员</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="text-center py-8">
                      <UserPlus className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-600">成员管理功能开发中...</p>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
              <Dialog open={showDepartmentDialog} onOpenChange={setShowDepartmentDialog}>
                <DialogTrigger asChild>
                  <Button>
                    <FolderPlus className="w-4 h-4 mr-2" />
                    创建部门
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>创建部门</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="text-center py-8">
                      <FolderPlus className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-600">部门管理功能开发中...</p>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          )}
        </div>

        {/* 组织概览统计 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">总部门数</p>
                  <p className="text-2xl font-bold text-gray-900">{organizationData.stats.totalDepartments}</p>
                </div>
                <Building2 className="w-8 h-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">总成员数</p>
                  <p className="text-2xl font-bold text-gray-900">{organizationData.stats.totalMembers}</p>
                </div>
                <Users className="w-8 h-8 text-green-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">拼车组数</p>
                  <p className="text-2xl font-bold text-gray-900">{organizationData.stats.totalGroups}</p>
                </div>
                <MapPin className="w-8 h-8 text-purple-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">活跃部门</p>
                  <p className="text-2xl font-bold text-gray-900">{organizationData.stats.activeDepartments}</p>
                </div>
                <Building className="w-8 h-8 text-orange-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 详细信息标签页 */}
        <Tabs defaultValue="departments" className="space-y-4">
          <TabsList>
            <TabsTrigger value="departments">部门结构</TabsTrigger>
            <TabsTrigger value="members">成员管理</TabsTrigger>
            <TabsTrigger value="groups">拼车组管理</TabsTrigger>
          </TabsList>

          <TabsContent value="departments">
            <Card>
              <CardHeader>
                <CardTitle>部门层级结构</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {departmentTree.length > 0 ? (
                    renderDepartmentTree(departmentTree)
                  ) : (
                    <div className="text-center py-8">
                      <Building2 className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-600">暂无部门数据</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="members">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>成员管理</CardTitle>
                  <div className="relative">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                    <Input
                      placeholder="搜索成员..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10 w-64"
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {filteredMembers.map((member) => (
                    <div key={member.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center space-x-4">
                        {getRoleIcon(member.role)}
                        <div>
                          <h4 className="font-medium text-gray-900">{member.name}</h4>
                          <p className="text-sm text-gray-600">{member.email}</p>
                          {member.title && (
                            <p className="text-xs text-gray-500">{member.title}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center space-x-3">
                        <div className="text-right text-sm text-gray-500">
                          <p>{member.department}</p>
                          <p>加入时间: {new Date(member.joinedAt).toLocaleDateString('zh-CN')}</p>
                        </div>
                        <Badge 
                          variant={member.status === 'active' ? 'default' : 'secondary'}
                        >
                          {member.status === 'active' ? '活跃' : '非活跃'}
                        </Badge>
                        {hasRole(['owner', 'admin']) && (
                          <Button variant="ghost" size="sm">
                            <Edit className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="groups">
            <Card>
              <CardHeader>
                <CardTitle>拼车组管理</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {organizationData.groups.map((group) => (
                    <div key={group.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center space-x-4">
                        <MapPin className="w-5 h-5 text-purple-500" />
                        <div>
                          <h4 className="font-medium text-gray-900">{group.name}</h4>
                          <p className="text-sm text-gray-600">归属部门: {group.department}</p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-3">
                        <div className="text-right text-sm text-gray-500">
                          <p>{group.memberCount} 名成员</p>
                          <p>AI资源使用: {group.aiResourcesUsed}%</p>
                        </div>
                        <Badge 
                          variant={group.status === 'active' ? 'default' : 'secondary'}
                        >
                          {group.status === 'active' ? '活跃' : '非活跃'}
                        </Badge>
                        {hasRole(['owner', 'admin']) && (
                          <Button variant="ghost" size="sm">
                            <Edit className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
        </div>
      </div>
    </div>
  );
}
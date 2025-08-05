'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Building2, 
  Users, 
  Search,
  UserPlus,
  AlertCircle
} from 'lucide-react';
import { toast } from 'sonner';

interface Department {
  id: string;
  name: string;
  description?: string;
  children: Department[];
  _count: {
    children: number;
    members: number;
  };
}

interface User {
  id: string;
  name: string;
  email: string;
  department?: {
    id: string;
    name: string;
  };
  roles?: Array<{
    role: string;
    scope: string;
  }>;
}

interface OrganizationMemberSelectorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  enterpriseId: string;
  groupId: string;
  groupName: string;
  existingMemberIds: string[];
  onMembersAdded: () => void;
}

export function OrganizationMemberSelector({
  open,
  onOpenChange,
  enterpriseId,
  groupId,
  groupName,
  existingMemberIds,
  onMembersAdded
}: OrganizationMemberSelectorProps) {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string>('');

  useEffect(() => {
    if (open) {
      fetchOrganizationData();
    }
  }, [open, enterpriseId]);

  const fetchOrganizationData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      
      // 获取企业部门结构
      const deptResponse = await fetch(`/api/enterprises/${enterpriseId}/departments`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (deptResponse.ok) {
        const deptData = await deptResponse.json();
        if (deptData.success) {
          setDepartments(deptData.data || []);
        }
      }

      // 获取企业用户列表
      const usersResponse = await fetch(`/api/enterprises/${enterpriseId}/users`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (usersResponse.ok) {
        const usersData = await usersResponse.json();
        if (usersData.success) {
          // 处理不同的API响应格式
          let userList = [];
          if (usersData.data && Array.isArray(usersData.data.users)) {
            userList = usersData.data.users;
          } else if (Array.isArray(usersData.data)) {
            userList = usersData.data;
          }
          
          // 过滤掉已经是拼车组成员的用户
          const availableUsers = userList.filter(
            (user: User) => !existingMemberIds.includes(user.id)
          );
          setUsers(availableUsers);
        } else {
          toast.error(usersData.message || '获取用户数据失败');
        }
      } else {
        const errorData = await usersResponse.json().catch(() => ({}));
        toast.error(errorData.message || '获取用户数据失败');
      }
    } catch (error) {
      console.error('获取组织数据失败:', error);
      toast.error('获取组织数据失败');
    } finally {
      setLoading(false);
    }
  };

  const handleAddMembers = async () => {
    if (selectedUserIds.length === 0) {
      toast.error('请选择要添加的成员');
      return;
    }

    setAdding(true);
    try {
      const token = localStorage.getItem('token');
      
      // 批量添加成员到拼车组
      const promises = selectedUserIds.map(userId =>
        fetch(`/api/groups/${groupId}/members`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            userId,
            role: 'member'
          })
        })
      );

      const results = await Promise.all(promises);
      const successCount = results.filter(r => r.ok).length;

      if (successCount === selectedUserIds.length) {
        toast.success(`成功添加 ${successCount} 名成员到拼车组`);
        setSelectedUserIds([]);
        onMembersAdded();
        onOpenChange(false);
      } else {
        toast.warning(`部分添加成功：${successCount}/${selectedUserIds.length}`);
        onMembersAdded();
      }
    } catch (error) {
      console.error('添加成员失败:', error);
      toast.error('添加成员失败');
    } finally {
      setAdding(false);
    }
  };

  // 过滤用户
  const filteredUsers = users.filter(user => {
    const matchesSearch = !searchTerm || 
      user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesDepartment = !selectedDepartmentId || 
      user.department?.id === selectedDepartmentId;

    return matchesSearch && matchesDepartment;
  });

  // 按部门分组用户
  const usersByDepartment = filteredUsers.reduce((acc, user) => {
    const deptId = user.department?.id || 'no-department';
    const deptName = user.department?.name || '未分配部门';
    
    if (!acc[deptId]) {
      acc[deptId] = { name: deptName, users: [] };
    }
    acc[deptId].users.push(user);
    return acc;
  }, {} as Record<string, { name: string; users: User[] }>);

  const handleUserToggle = (userId: string) => {
    setSelectedUserIds(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-blue-600" />
            从组织架构添加成员
          </DialogTitle>
          <DialogDescription>
            从企业组织架构中选择成员添加到拼车组 "{groupName}"
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* 搜索和筛选 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>搜索成员</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="搜索姓名或邮箱..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label>筛选部门</Label>
              <select
                value={selectedDepartmentId}
                onChange={(e) => setSelectedDepartmentId(e.target.value)}
                className="w-full p-2 border rounded-md"
              >
                <option value="">所有部门</option>
                {departments.map(dept => (
                  <option key={dept.id} value={dept.id}>{dept.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* 选择统计 */}
          {selectedUserIds.length > 0 && (
            <Alert>
              <UserPlus className="h-4 w-4" />
              <AlertDescription>
                已选择 {selectedUserIds.length} 名成员，点击"添加成员"将他们加入拼车组
              </AlertDescription>
            </Alert>
          )}

          {/* 成员列表 */}
          <Tabs defaultValue="by-department" className="w-full">
            <TabsList>
              <TabsTrigger value="by-department" className="flex items-center gap-2">
                <Building2 className="w-4 h-4" />
                按部门显示
              </TabsTrigger>
              <TabsTrigger value="all-users" className="flex items-center gap-2">
                <Users className="w-4 h-4" />
                全部成员
              </TabsTrigger>
            </TabsList>

            <TabsContent value="by-department" className="space-y-4">
              {loading ? (
                <div className="text-center py-8">
                  <div className="inline-flex items-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                    <span>正在加载组织数据...</span>
                  </div>
                </div>
              ) : Object.keys(usersByDepartment).length === 0 ? (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    没有找到可添加的成员。可能所有成员都已经在拼车组中。
                  </AlertDescription>
                </Alert>
              ) : (
                Object.entries(usersByDepartment).map(([deptId, { name, users }]) => (
                  <Card key={deptId}>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Building2 className="w-4 h-4" />
                        {name}
                        <Badge variant="outline">{users.length}人</Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {users.map(user => (
                          <div 
                            key={user.id} 
                            className="flex items-center space-x-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50"
                            onClick={() => handleUserToggle(user.id)}
                          >
                            <Checkbox
                              checked={selectedUserIds.includes(user.id)}
                              onChange={() => handleUserToggle(user.id)}
                            />
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm">{user.name}</p>
                              <p className="text-xs text-gray-600">{user.email}</p>
                              {user.roles && user.roles.length > 0 && (
                                <div className="flex gap-1 mt-1">
                                  {user.roles.slice(0, 2).map((role, idx) => (
                                    <Badge key={idx} variant="secondary" className="text-xs">
                                      {role.role}
                                    </Badge>
                                  ))}
                                  {user.roles.length > 2 && (
                                    <Badge variant="outline" className="text-xs">
                                      +{user.roles.length - 2}
                                    </Badge>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </TabsContent>

            <TabsContent value="all-users" className="space-y-4">
              {loading ? (
                <div className="text-center py-8">
                  <div className="inline-flex items-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                    <span>正在加载成员数据...</span>
                  </div>
                </div>
              ) : filteredUsers.length === 0 ? (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    没有找到符合条件的成员。
                  </AlertDescription>
                </Alert>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {filteredUsers.map(user => (
                    <div 
                      key={user.id} 
                      className="flex items-center space-x-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50"
                      onClick={() => handleUserToggle(user.id)}
                    >
                      <Checkbox
                        checked={selectedUserIds.includes(user.id)}
                        onChange={() => handleUserToggle(user.id)}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm">{user.name}</p>
                        <p className="text-xs text-gray-600">{user.email}</p>
                        {user.department && (
                          <p className="text-xs text-blue-600">{user.department.name}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>

        {/* 操作按钮 */}
        <div className="flex justify-end gap-3 pt-6 border-t">
          <Button 
            variant="outline" 
            onClick={() => onOpenChange(false)}
            disabled={adding}
          >
            取消
          </Button>
          <Button 
            onClick={handleAddMembers}
            disabled={selectedUserIds.length === 0 || adding}
          >
            {adding ? '添加中...' : `添加成员 (${selectedUserIds.length})`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
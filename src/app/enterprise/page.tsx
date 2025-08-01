'use client';

import { useState, useEffect } from 'react';
import { EnterpriseDashboard } from '@/components/enterprise/EnterpriseDashboard';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Building2, Plus, AlertCircle } from 'lucide-react';

interface Enterprise {
  id: string;
  name: string;
  planType: string;
}

export default function EnterprisePage() {
  const [enterprises, setEnterprises] = useState<Enterprise[]>([]);
  const [selectedEnterprise, setSelectedEnterprise] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    fetchEnterprises();
  }, []);

  const fetchEnterprises = async () => {
    try {
      const token = localStorage.getItem('token');
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      
      // 检查用户是否是管理员
      setIsAdmin(user.role === 'admin' || user.role === 'enterprise_admin');

      // 模拟企业数据 - 实际应用中应该从API获取用户所属的企业
      const mockEnterprises = [
        {
          id: 'ent_001',
          name: 'AI创新科技有限公司',
          planType: 'enterprise'
        },
        {
          id: 'ent_002', 
          name: '智能科技发展有限公司',
          planType: 'professional'
        }
      ];

      setEnterprises(mockEnterprises);
      
      // 如果只有一个企业，自动选择
      if (mockEnterprises.length === 1) {
        setSelectedEnterprise(mockEnterprises[0].id);
      }

    } catch (error) {
      console.error('获取企业列表失败:', error);
      setError('获取企业列表失败');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-500">加载企业信息...</div>
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

  // 如果用户已选择企业，显示企业控制面板
  if (selectedEnterprise) {
    return (
      <div className="container mx-auto px-4 py-8">
        <EnterpriseDashboard 
          enterpriseId={selectedEnterprise} 
          isAdmin={isAdmin} 
        />
      </div>
    );
  }

  // 显示企业选择界面
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-4">企业管理中心</h1>
          <p className="text-gray-600">选择要管理的企业以访问企业级功能</p>
        </div>

        {enterprises.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-12">
                <Building2 className="w-16 h-16 mx-auto text-gray-400 mb-4" />
                <h3 className="text-xl font-medium mb-2">暂无企业</h3>
                <p className="text-gray-600 mb-6">
                  您还没有加入任何企业，请联系管理员添加您到企业中
                </p>
                {isAdmin && (
                  <Button>
                    <Plus className="w-4 h-4 mr-2" />
                    创建企业
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 md:grid-cols-2">
            {enterprises.map((enterprise) => (
              <Card 
                key={enterprise.id} 
                className="hover:shadow-lg transition-shadow cursor-pointer"
                onClick={() => setSelectedEnterprise(enterprise.id)}
              >
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-3">
                      <Building2 className="w-6 h-6 text-blue-500" />
                      {enterprise.name}
                    </CardTitle>
                    <div className={`px-3 py-1 rounded-full text-xs font-medium ${
                      enterprise.planType === 'enterprise' 
                        ? 'bg-purple-100 text-purple-800'
                        : 'bg-blue-100 text-blue-800'
                    }`}>
                      {enterprise.planType === 'enterprise' ? '企业版' : '专业版'}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <CardDescription>
                    点击进入企业管理控制面板，管理组织架构、账号池、预算和权限等
                  </CardDescription>
                  
                  <div className="flex items-center justify-between pt-4">
                    <div className="text-sm text-gray-600">
                      企业ID: {enterprise.id}
                    </div>
                    <Button variant="outline" size="sm">
                      进入管理
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {enterprises.length > 0 && (
          <div className="mt-8 text-center">
            <p className="text-sm text-gray-600">
              需要帮助？查看 <a href="/tutorial" className="text-blue-600 hover:underline">使用教程</a> 
              了解如何使用企业级功能
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
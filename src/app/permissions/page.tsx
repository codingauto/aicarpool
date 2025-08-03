'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Shield, Users, Building, CheckCircle, ExternalLink } from 'lucide-react';

interface PermissionsData {
  user: {
    id: string;
    name: string;
    email: string;
  };
  permissions: string[];
  enterprises: Array<{
    id: string;
    name: string;
    role: string;
  }>;
  roles: Array<{
    enterpriseId: string;
    role: string;
    scope: string;
    resourceId?: string;
  }>;
  allPermissions: string[];
  allRoles: string[];
}

export default function PermissionsPage() {
  const [data, setData] = useState<PermissionsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchPermissions();
  }, []);

  const fetchPermissions = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/permissions');
      const result = await response.json();
      
      if (result.success) {
        setData(result.data);
        setError(null);
      } else {
        setError(result.message || '获取权限数据失败');
      }
    } catch (error) {
      console.error('获取权限失败:', error);
      setError('网络请求失败');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-gray-500">加载中...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <Card className="border-red-200 bg-red-50">
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-red-600 mb-4">{error}</p>
                <Button onClick={fetchPermissions} variant="outline">
                  重试
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center text-gray-500">
                暂无权限数据
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* 页面标题 */}
        <div className="flex items-center gap-2">
          <Shield className="w-6 h-6 text-blue-600" />
          <h1 className="text-2xl font-bold">权限管理</h1>
        </div>

        {/* 用户信息 */}
        <Card>
          <CardHeader>
            <CardTitle>当前用户</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-4">
              <div>
                <p className="font-medium">{data.user.name}</p>
                <p className="text-sm text-gray-600">{data.user.email}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 我的权限 */}
        <Card>
          <CardHeader>
            <CardTitle>我的权限</CardTitle>
          </CardHeader>
          <CardContent>
            {data.permissions.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {data.permissions.map((permission) => (
                  <Badge key={permission} variant="outline" className="justify-start p-2">
                    <CheckCircle className="w-3 h-3 mr-2 text-green-500" />
                    {permission}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-gray-500">暂无权限</p>
            )}
          </CardContent>
        </Card>

        {/* 我的角色 */}
        <Card>
          <CardHeader>
            <CardTitle>我的角色</CardTitle>
          </CardHeader>
          <CardContent>
            {data.roles.length > 0 ? (
              <div className="space-y-3">
                {data.roles.map((roleInfo, index) => (
                  <div key={index} className="flex items-center justify-between p-3 border rounded">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">{roleInfo.role}</Badge>
                        <span className="text-sm text-gray-600">范围: {roleInfo.scope}</span>
                      </div>
                      {roleInfo.resourceId && (
                        <p className="text-xs text-gray-500">资源ID: {roleInfo.resourceId}</p>
                      )}
                    </div>
                    {roleInfo.enterpriseId && (
                      <div className="text-sm text-gray-600">
                        企业: {roleInfo.enterpriseId}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500">暂无角色分配</p>
            )}
          </CardContent>
        </Card>

        {/* 管理企业 */}
        <Card>
          <CardHeader>
            <CardTitle>管理企业</CardTitle>
          </CardHeader>
          <CardContent>
            {data.enterprises.length > 0 ? (
              <div className="space-y-3">
                {data.enterprises.map((enterprise) => (
                  <div key={enterprise.id} className="flex items-center justify-between p-3 border rounded">
                    <div className="flex items-center space-x-3">
                      <Building className="w-5 h-5 text-blue-500" />
                      <span className="font-medium">{enterprise.name}</span>
                      <Badge>{enterprise.role}</Badge>
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => window.open(`/enterprise/${enterprise.id}/permissions`, '_blank')}
                    >
                      <ExternalLink className="w-4 h-4 mr-1" />
                      管理权限
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500">您暂未加入任何企业</p>
            )}
          </CardContent>
        </Card>

        {/* 系统权限信息（仅供参考） */}
        <Card>
          <CardHeader>
            <CardTitle>系统权限参考</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h4 className="font-medium mb-2">可用权限</h4>
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {data.allPermissions.map((permission) => (
                    <Badge key={permission} variant="outline" className="text-xs">
                      {permission}
                    </Badge>
                  ))}
                </div>
              </div>
              <div>
                <h4 className="font-medium mb-2">可用角色</h4>
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {data.allRoles.map((role) => (
                    <Badge key={role} variant="outline" className="text-xs">
                      {role}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function StatusPage() {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);
  const [apiTest, setApiTest] = useState<string>('未测试');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // 检查localStorage中的token和用户数据
    const storedToken = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');
    
    setToken(storedToken);
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch (e) {
        console.error('Failed to parse user data:', e);
      }
    }
  }, []);

  const testApi = async () => {
    setLoading(true);
    setApiTest('测试中...');
    
    try {
      const response = await fetch('/api/user/profile', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      const data = await response.json();
      
      if (data.success) {
        setApiTest('✅ API测试成功');
      } else {
        setApiTest(`❌ API测试失败: ${data.error}`);
      }
    } catch (error) {
      setApiTest(`❌ 网络错误: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  const clearStorage = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
    setApiTest('未测试');
  };

  const goToLogin = () => {
    window.location.href = '/auth/login';
  };

  const goToDashboard = () => {
    window.location.href = '/dashboard';
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <h1 className="text-3xl font-bold">系统状态检查</h1>
        
        {/* 认证Token */}
        <Card>
          <CardHeader>
            <CardTitle>认证Token</CardTitle>
            <CardDescription>检查localStorage中存储的认证token</CardDescription>
          </CardHeader>
          <CardContent>
            {token ? (
              <div>
                <p className="text-green-500">✅ Token存在</p>
                <p className="text-sm text-gray-500 mt-2 font-mono break-all">
                  {token.substring(0, 50)}...
                </p>
              </div>
            ) : (
              <p className="text-red-500">❌ 未找到token</p>
            )}
          </CardContent>
        </Card>

        {/* 用户信息 */}
        <Card>
          <CardHeader>
            <CardTitle>用户信息</CardTitle>
            <CardDescription>检查localStorage中存储的用户数据</CardDescription>
          </CardHeader>
          <CardContent>
            {user ? (
              <div>
                <p className="text-green-500">✅ 用户数据存在</p>
                <div className="mt-2 text-sm">
                  <p><strong>姓名:</strong> {user.name}</p>
                  <p><strong>邮箱:</strong> {user.email}</p>
                  <p><strong>用户ID:</strong> {user.id}</p>
                </div>
              </div>
            ) : (
              <p className="text-red-500">❌ 未找到用户数据</p>
            )}
          </CardContent>
        </Card>

        {/* API 测试 */}
        <Card>
          <CardHeader>
            <CardTitle>API 测试</CardTitle>
            <CardDescription>测试用户档案API是否正常工作</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p>{apiTest}</p>
            <Button 
              onClick={testApi} 
              disabled={!token || loading}
            >
              测试API
            </Button>
          </CardContent>
        </Card>

        {/* 操作 */}
        <Card>
          <CardHeader>
            <CardTitle>操作</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex space-x-4">
              <Button 
                onClick={clearStorage}
                variant="destructive"
              >
                清除所有存储数据
              </Button>
              <Button 
                onClick={goToLogin}
                variant="outline"
              >
                前往登录页面
              </Button>
              <Button 
                onClick={goToDashboard}
                variant="outline"
              >
                前往仪表盘
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
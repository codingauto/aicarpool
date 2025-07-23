'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function DebugPage() {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);
  const [apiResponse, setApiResponse] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // 检查localStorage中的数据
    const storedToken = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');
    
    setToken(storedToken);
    
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch (e) {
        console.error('Failed to parse stored user:', e);
      }
    }
  }, []);

  const testApi = async () => {
    if (!token) {
      setApiResponse({ error: '没有找到token' });
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/user/profile', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();
      setApiResponse({
        status: response.status,
        data: data,
      });
    } catch (error) {
      setApiResponse({
        error: '网络请求失败',
        details: error
      });
    } finally {
      setLoading(false);
    }
  };

  const clearStorage = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
    setApiResponse(null);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <h1 className="text-3xl font-bold">调试页面</h1>
        
        {/* Token 信息 */}
        <Card>
          <CardHeader>
            <CardTitle>认证Token</CardTitle>
            <CardDescription>检查localStorage中存储的认证token</CardDescription>
          </CardHeader>
          <CardContent>
            {token ? (
              <div className="space-y-2">
                <p className="text-sm"><strong>Token存在:</strong> ✅</p>
                <p className="text-xs text-gray-600 font-mono break-all">
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
              <div className="space-y-2">
                <p className="text-sm"><strong>用户数据存在:</strong> ✅</p>
                <div className="text-sm space-y-1">
                  <p><strong>姓名:</strong> {user.name}</p>
                  <p><strong>邮箱:</strong> {user.email}</p>
                  <p><strong>角色:</strong> {user.role}</p>
                  <p><strong>状态:</strong> {user.status}</p>
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
            <Button onClick={testApi} disabled={loading || !token}>
              {loading ? '测试中...' : '测试API'}
            </Button>
            
            {apiResponse && (
              <div className="p-4 bg-gray-100 rounded-lg">
                <pre className="text-sm overflow-auto">
                  {JSON.stringify(apiResponse, null, 2)}
                </pre>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 控制按钮 */}
        <Card>
          <CardHeader>
            <CardTitle>操作</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex space-x-4">
              <Button onClick={clearStorage} variant="destructive">
                清除所有存储数据
              </Button>
              <Button onClick={() => window.location.href = '/auth/login'} variant="outline">
                前往登录页面
              </Button>
              <Button onClick={() => window.location.href = '/dashboard'} variant="outline">
                前往仪表盘
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
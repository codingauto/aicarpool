'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { api } from '@/lib/api/api-client';
import { authService } from '@/lib/api/auth-service';

export default function TestAuthPage() {
  const [testResults, setTestResults] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const addResult = (message: string) => {
    setTestResults(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${message}`]);
  };

  const testTokenRefresh = async () => {
    setLoading(true);
    setTestResults([]);
    
    try {
      addResult('开始测试token刷新功能...');
      
      // 1. 检查当前token状态
      const currentToken = authService.getAccessToken();
      const refreshToken = authService.getRefreshToken();
      
      if (!currentToken) {
        addResult('❌ 未找到access token，请先登录');
        return;
      }
      
      if (!refreshToken) {
        addResult('❌ 未找到refresh token，请先登录');
        return;
      }
      
      addResult('✅ 找到access token和refresh token');
      
      // 2. 检查token是否即将过期
      const isExpiringSoon = authService.isTokenExpiringSoon(900); // 15分钟
      addResult(`Token状态: ${isExpiringSoon ? '即将过期' : '有效'}`);
      
      // 3. 测试API调用（会自动刷新token）
      addResult('测试API调用...');
      const response = await api.get('/api/user/profile');
      
      if (response.success) {
        addResult('✅ API调用成功，用户信息已获取');
        addResult(`用户: ${response.data?.name || response.data?.email}`);
      } else {
        addResult(`❌ API调用失败: ${response.error}`);
      }
      
      // 4. 手动触发token刷新
      addResult('手动触发token刷新...');
      const newToken = await authService.refreshAccessToken();
      
      if (newToken) {
        addResult('✅ Token刷新成功');
        addResult(`新token前10字符: ${newToken.substring(0, 10)}...`);
      } else {
        addResult('❌ Token刷新失败');
      }
      
      // 5. 再次测试API调用
      addResult('使用新token测试API调用...');
      const response2 = await api.get('/api/user/profile');
      
      if (response2.success) {
        addResult('✅ 使用新token调用成功');
      } else {
        addResult(`❌ 使用新token调用失败: ${response2.error}`);
      }
      
      addResult('测试完成！');
      
    } catch (error) {
      addResult(`❌ 测试过程中出错: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  const simulateExpiredToken = async () => {
    setLoading(true);
    setTestResults([]);
    
    try {
      addResult('模拟token过期场景...');
      
      // 设置一个无效的token
      localStorage.setItem('token', 'invalid_token_for_testing');
      addResult('已设置无效token');
      
      // 尝试API调用，应该会自动尝试刷新
      addResult('尝试API调用...');
      const response = await api.get('/api/user/profile');
      
      if (response.success) {
        addResult('✅ API调用成功（token已自动刷新）');
      } else if (response.code === 'AUTH_EXPIRED') {
        addResult('⚠️ 认证已过期，需要重新登录');
      } else {
        addResult(`❌ API调用失败: ${response.error}`);
      }
      
    } catch (error) {
      addResult(`❌ 测试过程中出错: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  const clearTokens = () => {
    authService.clearTokens();
    setTestResults(['已清除所有token']);
  };

  return (
    <div className="container mx-auto py-8">
      <Card>
        <CardHeader>
          <CardTitle>Token刷新功能测试</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4">
            <Button 
              onClick={testTokenRefresh} 
              disabled={loading}
            >
              测试Token刷新
            </Button>
            <Button 
              onClick={simulateExpiredToken} 
              disabled={loading}
              variant="secondary"
            >
              模拟Token过期
            </Button>
            <Button 
              onClick={clearTokens} 
              disabled={loading}
              variant="destructive"
            >
              清除Token
            </Button>
          </div>
          
          <div className="mt-4 p-4 bg-gray-100 rounded-lg">
            <h3 className="font-semibold mb-2">测试结果：</h3>
            {testResults.length === 0 ? (
              <p className="text-gray-500">点击按钮开始测试</p>
            ) : (
              <div className="space-y-1">
                {testResults.map((result, index) => (
                  <div key={index} className="text-sm font-mono">
                    {result}
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
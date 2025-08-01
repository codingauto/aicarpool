'use client';

import { useState, useEffect } from 'react';
import { AccountPoolManager } from '@/components/enterprise/AccountPoolManager';

export default function AccountPoolsPage() {
  const [enterpriseId, setEnterpriseId] = useState<string>('');
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    // 从localStorage获取用户信息
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    setIsAdmin(user.role === 'admin' || user.role === 'enterprise_admin');
    
    // 模拟企业ID - 实际应用中应该从用户信息或路由参数获取
    setEnterpriseId('ent_001');
  }, []);

  if (!enterpriseId) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-500">加载中...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <AccountPoolManager 
        enterpriseId={enterpriseId} 
        isAdmin={isAdmin} 
      />
    </div>
  );
}
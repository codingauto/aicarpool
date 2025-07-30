'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { GroupList } from '@/components/groups/group-list';

export default function GroupsPage() {
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // 检查用户是否已登录
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/auth/login');
      return;
    }
    setLoading(false);
  }, [router]);


  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-lg">加载中...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">拼车组</h1>
        <p className="text-gray-600 mt-1">管理您的拼车组，邀请成员共享AI资源</p>
      </div>

      {/* Main Content */}
      <GroupList />
    </div>
  );
}
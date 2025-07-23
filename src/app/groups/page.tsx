'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { GroupList } from '@/components/groups/group-list';
import { AppHeader } from '@/components/layout/AppHeader';

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
    <div className="min-h-screen bg-gray-50">
      <AppHeader showUserInfo={false} />

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <GroupList />
      </main>
    </div>
  );
}
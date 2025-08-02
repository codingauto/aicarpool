'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * 企业优先架构重定向页面
 * 
 * 在 v2.2 架构调整中，用户应该通过企业选择页面进入系统，
 * 而不是直接访问个人仪表盘。此页面将用户重定向到企业选择界面。
 */
export default function DashboardRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    // 重定向到企业选择页面（根路径）
    router.replace('/');
  }, [router]);

  // 显示加载提示
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="text-lg text-gray-600 mb-2">正在重定向...</div>
        <div className="text-sm text-gray-500">
          根据v2.2企业优先架构，请通过企业选择页面访问您的数据
        </div>
      </div>
    </div>
  );
}
'use client';

/**
 * 企业专属组织架构页面
 * 
 * 功能：
 * - 部门层级管理
 * - 人员分配
 * - 组织架构图
 * - 拼车组归属管理
 */

import React, { use } from 'react';
import { Button } from '@/components/ui/button';
import { Building2, ChevronLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEnterpriseContext } from '@/contexts/enterprise-context';
import { OrganizationStructure } from '@/components/enterprise/OrganizationStructure';

export default function EnterpriseOrganizationPage({ params }: { params: Promise<{ enterpriseId: string }> }) {
  const { enterpriseId } = use(params);
  const router = useRouter();
  const { currentEnterprise, hasRole } = useEnterpriseContext();

  // 检查是否是管理员
  const isAdmin = hasRole('owner') || hasRole('admin');

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-6xl mx-auto">
        {/* 面包屑和标题 */}
        <div className="flex items-center gap-4 mb-6">
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => router.push(`/enterprise/${enterpriseId}/dashboard`)}
          >
            <ChevronLeft className="w-4 h-4 mr-2" />
            返回企业控制面板
          </Button>
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Building2 className="w-4 h-4" />
            <span>{currentEnterprise?.name || '未知企业'}</span>
            <span>/</span>
            <span>组织架构</span>
          </div>
        </div>

        {/* 使用我们已经实现的完整组织架构组件 */}
        <OrganizationStructure 
          enterpriseId={enterpriseId} 
          isAdmin={isAdmin} 
        />
      </div>
    </div>
  );
}
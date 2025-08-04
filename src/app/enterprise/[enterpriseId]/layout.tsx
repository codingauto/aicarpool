import React, { use } from 'react';
import { SimpleEnterpriseLayout } from '@/components/layout/SimpleEnterpriseLayout';
import { EnterpriseProvider } from '@/contexts/enterprise-context';

export default function EnterpriseIdLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ enterpriseId: string }>;
}) {
  // 使用 use() hook 处理 async params
  const { enterpriseId } = use(params);
  
  return (
    <EnterpriseProvider enterpriseId={enterpriseId}>
      <SimpleEnterpriseLayout>
        {children}
      </SimpleEnterpriseLayout>
    </EnterpriseProvider>
  );
}
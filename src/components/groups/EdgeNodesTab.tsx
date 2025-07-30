'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Server } from 'lucide-react';

interface EdgeNodesTabProps {
  isAdmin: boolean;
}

export function EdgeNodesTab({ isAdmin }: EdgeNodesTabProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>边缘节点管理</CardTitle>
            <CardDescription>
              管理和监控边缘节点性能
            </CardDescription>
          </div>
          {isAdmin && (
            <Button>
              <Server className="w-4 h-4 mr-2" />
              添加节点
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-center py-12">
          <Server className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            边缘节点功能开发中
          </h3>
          <p className="text-gray-500 mb-6 max-w-sm mx-auto">
            我们正在开发强大的边缘节点管理功能，敬请期待。
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-2xl mx-auto">
            <div className="text-center p-4">
              <div className="text-blue-600 font-medium mb-2">节点管理</div>
              <div className="text-sm text-gray-500">
                添加、配置和管理边缘节点
              </div>
            </div>
            <div className="text-center p-4">
              <div className="text-green-600 font-medium mb-2">健康监控</div>
              <div className="text-sm text-gray-500">
                实时监控节点状态和性能
              </div>
            </div>
            <div className="text-center p-4">
              <div className="text-orange-600 font-medium mb-2">负载调度</div>
              <div className="text-sm text-gray-500">
                智能分配和优化节点负载
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
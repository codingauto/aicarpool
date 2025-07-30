'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Users, Key, Activity, DollarSign, Settings } from 'lucide-react';

interface GroupDetail {
  id: string;
  name: string;
  description?: string;
  maxMembers: number;
  status: string;
  stats: {
    memberCount: number;
    apiKeyCount: number;
    totalCost: number;
  };
  aiServices: any[];
}

interface GroupHeaderProps {
  group: GroupDetail;
  isAdmin: boolean;
}

export function GroupHeader({ group, isAdmin }: GroupHeaderProps) {
  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{group.name}</h1>
          {group.description && (
            <p className="text-gray-600 mt-2">{group.description}</p>
          )}
        </div>
        <div className="flex items-center space-x-2">
          <Badge variant={group.status === 'active' ? 'default' : 'secondary'}>
            {group.status === 'active' ? '活跃' : '禁用'}
          </Badge>
          {isAdmin && (
            <Button variant="outline" size="sm">
              <Settings className="w-4 h-4 mr-2" />
              设置
            </Button>
          )}
        </div>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center">
              <Users className="w-5 h-5 text-blue-600 mr-3" />
              <div>
                <div className="text-2xl font-bold">
                  {group.stats.memberCount}/{group.maxMembers}
                </div>
                <div className="text-sm text-gray-600">成员</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center">
              <Key className="w-5 h-5 text-green-600 mr-3" />
              <div>
                <div className="text-2xl font-bold">{group.stats.apiKeyCount}</div>
                <div className="text-sm text-gray-600">API密钥</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center">
              <Activity className="w-5 h-5 text-purple-600 mr-3" />
              <div>
                <div className="text-2xl font-bold">{group.aiServices.length}</div>
                <div className="text-sm text-gray-600">AI服务</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center">
              <DollarSign className="w-5 h-5 text-orange-600 mr-3" />
              <div>
                <div className="text-2xl font-bold">
                  ${group.stats.totalCost.toFixed(2)}
                </div>
                <div className="text-sm text-gray-600">总费用</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
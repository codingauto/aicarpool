/**
 * Claude Code 管理主页面
 */
'use client';
import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ClaudeCodeStats } from '@/components/claude-code/ClaudeCodeStats';
import { ClaudeCodeUsers } from '@/components/claude-code/ClaudeCodeUsers';
import { ClaudeCodeNodes } from '@/components/claude-code/ClaudeCodeNodes';
import { ClaudeCodeSettings } from '@/components/claude-code/ClaudeCodeSettings';

export default function ClaudeCodeManagement() {
  const [activeTab, setActiveTab] = useState('overview');
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/claude-code/stats?timeRange=7d');
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Claude Code 代理管理
        </h1>
        <p className="text-gray-600">
          管理和监控 Claude Code CLI 代理服务
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">概览</TabsTrigger>
          <TabsTrigger value="users">用户管理</TabsTrigger>
          <TabsTrigger value="nodes">边缘节点</TabsTrigger>
          <TabsTrigger value="settings">设置</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <ClaudeCodeStats stats={stats} onRefresh={fetchStats} />
        </TabsContent>

        <TabsContent value="users" className="space-y-6">
          <ClaudeCodeUsers />
        </TabsContent>

        <TabsContent value="nodes" className="space-y-6">
          <ClaudeCodeNodes />
        </TabsContent>

        <TabsContent value="settings" className="space-y-6">
          <ClaudeCodeSettings />
        </TabsContent>
      </Tabs>
    </div>
  );
}
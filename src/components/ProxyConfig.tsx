'use client';

import ProxySelector, { ProxySelectorData } from './ProxySelector';

// 保持向后兼容的接口
export interface ProxyConfigData {
  enabled: boolean;
  type: 'socks5' | 'http' | 'https';
  host: string;
  port: string;
  username?: string;
  password?: string;
  // 新增字段用于代理选择
  selectedProxyId?: string;
}

interface ProxyConfigProps {
  groupId?: string; // 新增groupId参数
  value: ProxyConfigData;
  onChange: (config: ProxyConfigData) => void;
}

export default function ProxyConfig({ groupId, value, onChange }: ProxyConfigProps) {
  // 如果没有提供groupId，则回退到原来的手动输入模式
  if (!groupId) {
    // 这里可以保留原来的手动输入逻辑作为备用
    // 但为了简化，我们直接使用新的代理选择器，只是不显示代理列表
    console.warn('ProxyConfig: groupId not provided, proxy selection will be limited');
  }

  // 将ProxyConfigData转换为ProxySelectorData
  const selectorValue: ProxySelectorData = {
    enabled: value.enabled,
    selectedProxyId: value.selectedProxyId,
    type: value.type,
    host: value.host,
    port: value.port,
    username: value.username,
    password: value.password
  };

  // 处理代理选择器的变化
  const handleSelectorChange = (config: ProxySelectorData) => {
    onChange({
      enabled: config.enabled,
      selectedProxyId: config.selectedProxyId,
      type: config.type,
      host: config.host,
      port: config.port,
      username: config.username,
      password: config.password
    });
  };

  return (
    <ProxySelector
      groupId={groupId || ''}
      value={selectorValue}
      onChange={handleSelectorChange}
    />
  );
}
interface AlertEmailProps {
  alertType: 'quota_warning' | 'quota_exceeded' | 'service_down' | 'key_expired';
  groupName?: string;
  serviceName?: string;
  currentUsage?: number;
  limit?: number;
  message?: string;
}

export function AlertEmail({ alertType, groupName, serviceName, currentUsage, limit, message }: AlertEmailProps) {
  const getAlertTitle = () => {
    switch (alertType) {
      case 'quota_warning':
        return '配额预警通知';
      case 'quota_exceeded':
        return '配额超限通知';
      case 'service_down':
        return '服务异常通知';
      case 'key_expired':
        return 'API Key 过期通知';
      default:
        return '系统通知';
    }
  };

  const getAlertColor = () => {
    switch (alertType) {
      case 'quota_warning':
        return '#f59e0b';
      case 'quota_exceeded':
      case 'service_down':
      case 'key_expired':
        return '#dc2626';
      default:
        return '#6b7280';
    }
  };

  return (
    <div style={{ fontFamily: 'Arial, sans-serif', padding: '20px', backgroundColor: '#f5f5f5' }}>
      <div style={{ maxWidth: '600px', margin: '0 auto', backgroundColor: '#white', padding: '20px', borderRadius: '8px' }}>
        <h1 style={{ color: getAlertColor(), marginBottom: '20px' }}>{getAlertTitle()}</h1>
        
        {groupName && <p><strong>拼车组：</strong>{groupName}</p>}
        {serviceName && <p><strong>服务：</strong>{serviceName}</p>}
        
        {alertType === 'quota_warning' && currentUsage && limit && (
          <p>当前使用量：{currentUsage} / {limit} ({Math.round((currentUsage / limit) * 100)}%)</p>
        )}
        
        {alertType === 'quota_exceeded' && (
          <p style={{ color: '#dc2626', fontWeight: 'bold' }}>配额已超限，服务可能受到影响。</p>
        )}
        
        {alertType === 'service_down' && (
          <p style={{ color: '#dc2626', fontWeight: 'bold' }}>服务当前不可用，请检查配置。</p>
        )}
        
        {alertType === 'key_expired' && (
          <p style={{ color: '#dc2626', fontWeight: 'bold' }}>API Key 已过期，请更新密钥。</p>
        )}
        
        {message && (
          <p style={{ backgroundColor: '#f3f4f6', padding: '10px', borderRadius: '4px', marginTop: '15px' }}>
            {message}
          </p>
        )}
        
        <p style={{ marginTop: '20px', fontSize: '14px', color: '#666' }}>
          请及时处理以确保服务正常运行。
        </p>
      </div>
    </div>
  );
}
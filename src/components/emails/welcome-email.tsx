interface WelcomeEmailProps {
  userName: string;
  groupName: string;
}

export function WelcomeEmail({ userName, groupName }: WelcomeEmailProps) {
  return (
    <div style={{ fontFamily: 'Arial, sans-serif', padding: '20px', backgroundColor: '#f5f5f5' }}>
      <div style={{ maxWidth: '600px', margin: '0 auto', backgroundColor: '#white', padding: '20px', borderRadius: '8px' }}>
        <h1 style={{ color: '#16a34a', marginBottom: '20px' }}>欢迎加入 AiCarpool</h1>
        <p>您好 <strong>{userName}</strong>！</p>
        <p>欢迎您成功加入拼车组 <strong>{groupName}</strong>。</p>
        <p>现在您可以：</p>
        <ul>
          <li>使用共享的AI服务资源</li>
          <li>参与拼车组管理</li>
          <li>查看使用统计和费用分摊</li>
        </ul>
        <p style={{ marginTop: '20px', fontSize: '14px', color: '#666' }}>
          如有任何问题，请联系拼车组管理员。
        </p>
      </div>
    </div>
  );
}
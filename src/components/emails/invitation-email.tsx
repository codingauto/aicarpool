interface InvitationEmailProps {
  inviterName: string;
  groupName: string;
  invitationLink: string;
}

export function InvitationEmail({ inviterName, groupName, invitationLink }: InvitationEmailProps) {
  return (
    <div style={{ fontFamily: 'Arial, sans-serif', padding: '20px', backgroundColor: '#f5f5f5' }}>
      <div style={{ maxWidth: '600px', margin: '0 auto', backgroundColor: '#white', padding: '20px', borderRadius: '8px' }}>
        <h1 style={{ color: '#2563eb', marginBottom: '20px' }}>AiCarpool 拼车邀请</h1>
        <p>您好！</p>
        <p><strong>{inviterName}</strong> 邀请您加入拼车组 <strong>{groupName}</strong>。</p>
        <p>点击下面的链接加入：</p>
        <a 
          href={invitationLink} 
          style={{ 
            display: 'inline-block', 
            padding: '12px 24px', 
            backgroundColor: '#2563eb', 
            color: 'white', 
            textDecoration: 'none', 
            borderRadius: '6px',
            marginTop: '10px'
          }}
        >
          加入拼车组
        </a>
        <p style={{ marginTop: '20px', fontSize: '14px', color: '#666' }}>
          如果按钮无法点击，请复制以下链接到浏览器中打开：<br />
          {invitationLink}
        </p>
      </div>
    </div>
  );
}
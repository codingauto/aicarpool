import {
  Html,
  Head,
  Body,
  Container,
  Section,
  Heading,
  Text,
  Button,
  Hr,
} from '@react-email/components';

interface InvitationEmailProps {
  inviterName: string;
  groupName: string;
  invitationLink: string;
}

export function InvitationEmail({
  inviterName,
  groupName,
  invitationLink,
}: InvitationEmailProps) {
  return (
    <Html>
      <Head />
      <Body style={main}>
        <Container style={container}>
          <Section style={header}>
            <Heading style={h1}>🚗 AiCarpool 拼车</Heading>
            <Text style={subtitle}>AI编程工具拼车服务平台</Text>
          </Section>

          <Section style={content}>
            <Heading style={h2}>邀请加入拼车组</Heading>
            
            <Text style={text}>
              您好！
            </Text>
            
            <Text style={text}>
              <strong>{inviterName}</strong> 邀请您加入 <strong>"{groupName}"</strong> 拼车组。
            </Text>
            
            <Text style={text}>
              通过加入这个拼车组，您将能够：
            </Text>
            
            <ul style={list}>
              <li>使用多种AI编程工具（Claude Code、Gemini CLI、AmpCode等）</li>
              <li>享受成本分摊，降低使用费用</li>
              <li>获得统一的API接口和服务管理</li>
              <li>参与团队协作，提升开发效率</li>
            </ul>
            
            <Section style={buttonContainer}>
              <Button href={invitationLink} style={button}>
                接受邀请
              </Button>
            </Section>
            
            <Text style={smallText}>
              如果按钮无法点击，请复制以下链接到浏览器：
            </Text>
            <Text style={linkText}>
              {invitationLink}
            </Text>
            
            <Hr style={hr} />
            
            <Text style={smallText}>
              此邀请链接将在24小时后过期。如有疑问，请联系邀请人。
            </Text>
          </Section>

          <Section style={footer}>
            <Text style={footerText}>
              © 2025 AiCarpool 拼车. All rights reserved.
            </Text>
            <Text style={footerText}>
              Share AI, Share Costs
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

// 样式定义
const main = {
  backgroundColor: '#f6f9fc',
  fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Ubuntu,sans-serif',
};

const container = {
  backgroundColor: '#ffffff',
  margin: '0 auto',
  padding: '20px 0 48px',
  marginBottom: '64px',
};

const header = {
  padding: '32px 24px',
  textAlign: 'center' as const,
  borderBottom: '1px solid #e6ebf1',
};

const h1 = {
  color: '#1f2937',
  fontSize: '32px',
  fontWeight: 'bold',
  margin: '0 0 8px',
};

const subtitle = {
  color: '#6b7280',
  fontSize: '16px',
  margin: '0',
};

const content = {
  padding: '32px 24px',
};

const h2 = {
  color: '#1f2937',
  fontSize: '24px',
  fontWeight: 'bold',
  margin: '0 0 24px',
};

const text = {
  color: '#374151',
  fontSize: '16px',
  lineHeight: '24px',
  margin: '0 0 16px',
};

const list = {
  color: '#374151',
  fontSize: '16px',
  lineHeight: '24px',
  margin: '0 0 16px',
  paddingLeft: '20px',
};

const buttonContainer = {
  textAlign: 'center' as const,
  margin: '32px 0',
};

const button = {
  backgroundColor: '#4f46e5',
  borderRadius: '8px',
  color: '#ffffff',
  fontSize: '16px',
  fontWeight: 'bold',
  textDecoration: 'none',
  textAlign: 'center' as const,
  display: 'inline-block',
  padding: '12px 32px',
};

const smallText = {
  color: '#6b7280',
  fontSize: '14px',
  lineHeight: '20px',
  margin: '0 0 8px',
};

const linkText = {
  color: '#4f46e5',
  fontSize: '14px',
  textDecoration: 'underline',
  margin: '0 0 16px',
  wordBreak: 'break-all' as const,
};

const hr = {
  borderColor: '#e6ebf1',
  margin: '32px 0',
};

const footer = {
  padding: '24px',
  textAlign: 'center' as const,
  borderTop: '1px solid #e6ebf1',
};

const footerText = {
  color: '#9ca3af',
  fontSize: '12px',
  margin: '0 0 4px',
};
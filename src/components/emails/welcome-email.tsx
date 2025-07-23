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

interface WelcomeEmailProps {
  userName: string;
  groupName: string;
}

export function WelcomeEmail({
  userName,
  groupName,
}: WelcomeEmailProps) {
  return (
    <Html>
      <Head />
      <Body style={main}>
        <Container style={container}>
          <Section style={header}>
            <Heading style={h1}>🎉 欢迎加入 AiCarpool 拼车！</Heading>
            <Text style={subtitle}>AI编程工具拼车服务平台</Text>
          </Section>

          <Section style={content}>
            <Text style={text}>
              {userName}，您好！
            </Text>
            
            <Text style={text}>
              恭喜您成功加入 <strong>"{groupName}"</strong> 拼车组！现在您可以开始使用我们的AI编程工具服务了。
            </Text>
            
            <Heading style={h3}>🚀 您现在可以：</Heading>
            
            <ul style={list}>
              <li><strong>管理API密钥</strong>：在拼车组详情页创建和管理您的专属API密钥</li>
              <li><strong>使用AI服务</strong>：通过统一接口访问Claude Code、Gemini CLI、AmpCode等服务</li>
              <li><strong>查看使用统计</strong>：实时监控您的配额使用情况和成本分摊</li>
              <li><strong>团队协作</strong>：与组内其他成员共享AI工具资源</li>
            </ul>
            
            <Heading style={h3}>📚 快速开始：</Heading>
            
            <ol style={list}>
              <li>登录您的账户</li>
              <li>进入拼车组详情页面</li>
              <li>创建您的第一个API密钥</li>
              <li>开始使用AI编程工具</li>
            </ol>
            
            <Section style={buttonContainer}>
              <Button href={`${process.env.NEXT_PUBLIC_APP_URL}/dashboard`} style={button}>
                立即开始使用
              </Button>
            </Section>
            
            <Hr style={hr} />
            
            <Heading style={h3}>💡 使用提示：</Heading>
            
            <ul style={list}>
              <li>建议为不同项目创建不同的API密钥，便于管理</li>
              <li>定期查看使用统计，合理控制配额消耗</li>
              <li>如遇问题，可联系拼车组管理员获得帮助</li>
            </ul>
            
            <Text style={text}>
              如有任何疑问，请随时联系我们的客服团队。祝您使用愉快！
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

// 样式定义（与邀请邮件相同的基础样式）
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
  fontSize: '28px',
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

const h3 = {
  color: '#1f2937',
  fontSize: '18px',
  fontWeight: 'bold',
  margin: '24px 0 12px',
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
  backgroundColor: '#059669',
  borderRadius: '8px',
  color: '#ffffff',
  fontSize: '16px',
  fontWeight: 'bold',
  textDecoration: 'none',
  textAlign: 'center' as const,
  display: 'inline-block',
  padding: '12px 32px',
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
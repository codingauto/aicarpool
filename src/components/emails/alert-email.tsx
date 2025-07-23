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

interface AlertEmailProps {
  alertType: 'quota_warning' | 'quota_exceeded' | 'service_down' | 'key_expired';
  groupName?: string;
  serviceName?: string;
  currentUsage?: number;
  limit?: number;
  message?: string;
}

export function AlertEmail({
  alertType,
  groupName,
  serviceName,
  currentUsage,
  limit,
  message,
}: AlertEmailProps) {
  const getAlertInfo = () => {
    switch (alertType) {
      case 'quota_warning':
        return {
          icon: '⚠️',
          title: '配额预警通知',
          color: '#f59e0b',
          severity: '预警',
        };
      case 'quota_exceeded':
        return {
          icon: '🚫',
          title: '配额超限通知',
          color: '#ef4444',
          severity: '紧急',
        };
      case 'service_down':
        return {
          icon: '🔧',
          title: '服务异常通知',
          color: '#ef4444',
          severity: '故障',
        };
      case 'key_expired':
        return {
          icon: '🔑',
          title: 'API Key 过期通知',
          color: '#f59e0b',
          severity: '提醒',
        };
      default:
        return {
          icon: '📢',
          title: '系统通知',
          color: '#6b7280',
          severity: '通知',
        };
    }
  };

  const alertInfo = getAlertInfo();

  const renderContent = () => {
    switch (alertType) {
      case 'quota_warning':
        return (
          <>
            <Text style={text}>
              您的拼车组 <strong>"{groupName}"</strong> 在 <strong>{serviceName}</strong> 服务的配额使用量即将达到限制。
            </Text>
            <Section style={statsContainer}>
              <Text style={statsText}>
                当前使用量：<strong>{currentUsage?.toLocaleString()}</strong>
              </Text>
              <Text style={statsText}>
                配额限制：<strong>{limit?.toLocaleString()}</strong>
              </Text>
              <Text style={statsText}>
                使用比例：<strong>{limit ? Math.round((currentUsage || 0) / limit * 100) : 0}%</strong>
              </Text>
            </Section>
            <Text style={text}>
              为避免服务中断，建议您：
            </Text>
            <ul style={list}>
              <li>联系拼车组管理员调整配额限制</li>
              <li>优化AI工具使用频率</li>
              <li>考虑升级到更高配额的套餐</li>
            </ul>
          </>
        );

      case 'quota_exceeded':
        return (
          <>
            <Text style={text}>
              您的拼车组 <strong>"{groupName}"</strong> 在 <strong>{serviceName}</strong> 服务的配额已超出限制，服务已被暂停。
            </Text>
            <Section style={alertBox}>
              <Text style={alertText}>
                ⚠️ 服务已暂停，请立即处理
              </Text>
            </Section>
            <Text style={text}>
              请联系拼车组管理员或采取以下措施：
            </Text>
            <ul style={list}>
              <li>增加配额限制</li>
              <li>升级服务套餐</li>
              <li>等待下个计费周期重置</li>
            </ul>
          </>
        );

      case 'service_down':
        return (
          <>
            <Text style={text}>
              <strong>{serviceName}</strong> 服务出现异常，影响您的拼车组 <strong>"{groupName}"</strong> 的正常使用。
            </Text>
            {message && (
              <Section style={messageBox}>
                <Text style={messageText}>
                  错误详情：{message}
                </Text>
              </Section>
            )}
            <Text style={text}>
              我们正在紧急处理这个问题，预计恢复时间：
            </Text>
            <ul style={list}>
              <li>轻微问题：5-15分钟</li>
              <li>一般问题：15-60分钟</li>
              <li>严重问题：1-4小时</li>
            </ul>
            <Text style={text}>
              您可以尝试使用其他可用的AI服务作为临时替代方案。
            </Text>
          </>
        );

      case 'key_expired':
        return (
          <>
            <Text style={text}>
              您在拼车组 <strong>"{groupName}"</strong> 中的API Key即将过期或已过期。
            </Text>
            <Text style={text}>
              受影响的服务：<strong>{serviceName}</strong>
            </Text>
            <Text style={text}>
              请及时采取以下措施：
            </Text>
            <ul style={list}>
              <li>登录系统重新生成API Key</li>
              <li>更新您应用中的API Key配置</li>
              <li>测试新Key的可用性</li>
            </ul>
          </>
        );

      default:
        return (
          <Text style={text}>
            {message || '系统通知消息'}
          </Text>
        );
    }
  };

  return (
    <Html>
      <Head />
      <Body style={main}>
        <Container style={container}>
          <Section style={header}>
            <Heading style={h1}>
              {alertInfo.icon} {alertInfo.title}
            </Heading>
            <Text style={subtitle}>AiCarpool 拼车 - 系统通知</Text>
            <Text style={{...severityBadge, backgroundColor: alertInfo.color}}>
              {alertInfo.severity}
            </Text>
          </Section>

          <Section style={content}>
            <Text style={greeting}>
              您好！
            </Text>
            
            {renderContent()}
            
            <Section style={buttonContainer}>
              <Button href={`${process.env.NEXT_PUBLIC_APP_URL}/dashboard`} style={button}>
                前往管理面板
              </Button>
            </Section>
            
            <Hr style={hr} />
            
            <Text style={smallText}>
              如需帮助，请联系技术支持或拼车组管理员。
            </Text>
            <Text style={smallText}>
              通知时间：{new Date().toLocaleString('zh-CN')}
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
  fontSize: '24px',
  fontWeight: 'bold',
  margin: '0 0 8px',
};

const subtitle = {
  color: '#6b7280',
  fontSize: '16px',
  margin: '0 0 12px',
};

const severityBadge = {
  color: '#ffffff',
  fontSize: '12px',
  fontWeight: 'bold',
  padding: '4px 12px',
  borderRadius: '12px',
  display: 'inline-block',
  textTransform: 'uppercase' as const,
};

const content = {
  padding: '32px 24px',
};

const greeting = {
  color: '#374151',
  fontSize: '16px',
  margin: '0 0 16px',
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

const statsContainer = {
  backgroundColor: '#f9fafb',
  border: '1px solid #e5e7eb',
  borderRadius: '8px',
  padding: '16px',
  margin: '16px 0',
};

const statsText = {
  color: '#374151',
  fontSize: '14px',
  margin: '0 0 8px',
};

const alertBox = {
  backgroundColor: '#fef2f2',
  border: '1px solid #fecaca',
  borderRadius: '8px',
  padding: '16px',
  margin: '16px 0',
};

const alertText = {
  color: '#dc2626',
  fontSize: '16px',
  fontWeight: 'bold',
  margin: '0',
  textAlign: 'center' as const,
};

const messageBox = {
  backgroundColor: '#f9fafb',
  border: '1px solid #d1d5db',
  borderRadius: '8px',
  padding: '16px',
  margin: '16px 0',
};

const messageText = {
  color: '#374151',
  fontSize: '14px',
  fontFamily: 'monospace',
  margin: '0',
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

const hr = {
  borderColor: '#e6ebf1',
  margin: '32px 0',
};

const smallText = {
  color: '#6b7280',
  fontSize: '14px',
  lineHeight: '20px',
  margin: '0 0 8px',
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
import nodemailer from 'nodemailer';
import { render } from '@react-email/render';
import { InvitationEmail } from '@/components/emails/invitation-email';
import { WelcomeEmail } from '@/components/emails/welcome-email';
import { AlertEmail } from '@/components/emails/alert-email';
import { ReactElement } from 'react';

export interface EmailConfig {
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass: string;
  };
}

export class EmailService {
  private transporter: nodemailer.Transporter;

  constructor(config: EmailConfig) {
    this.transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: config.auth,
    });
  }

  async sendInvitationEmail(
    to: string,
    inviterName: string,
    groupName: string,
    invitationLink: string
  ) {
    const htmlContent = InvitationEmail({
      inviterName,
      groupName,
      invitationLink,
    }) as ReactElement;
    
    const html = await render(htmlContent);

    const result = await this.transporter.sendMail({
      from: process.env.EMAIL_FROM || 'noreply@aicarpool.com',
      to,
      subject: `【AiCarpool 拼车】${inviterName} 邀请您加入 ${groupName}`,
      html,
    });

    return result;
  }

  async sendWelcomeEmail(
    to: string,
    userName: string,
    groupName: string
  ) {
    const htmlContent = WelcomeEmail({
      userName,
      groupName,
    }) as ReactElement;
    
    const html = await render(htmlContent);

    const result = await this.transporter.sendMail({
      from: process.env.EMAIL_FROM || 'noreply@aicarpool.com',
      to,
      subject: `【AiCarpool 拼车】欢迎加入 ${groupName}`,
      html,
    });

    return result;
  }

  async sendAlertEmail(
    to: string,
    alertType: 'quota_warning' | 'quota_exceeded' | 'service_down' | 'key_expired',
    details: {
      groupName?: string;
      serviceName?: string;
      currentUsage?: number;
      limit?: number;
      message?: string;
    }
  ) {
    const htmlContent = AlertEmail({
      alertType,
      ...details,
    }) as ReactElement;
    
    const html = await render(htmlContent);

    let subject = '【AiCarpool 拼车】系统通知';
    switch (alertType) {
      case 'quota_warning':
        subject = '【AiCarpool 拼车】配额预警通知';
        break;
      case 'quota_exceeded':
        subject = '【AiCarpool 拼车】配额超限通知';
        break;
      case 'service_down':
        subject = '【AiCarpool 拼车】服务异常通知';
        break;
      case 'key_expired':
        subject = '【AiCarpool 拼车】API Key 过期通知';
        break;
    }

    const result = await this.transporter.sendMail({
      from: process.env.EMAIL_FROM || 'noreply@aicarpool.com',
      to,
      subject,
      html,
    });

    return result;
  }

  async verifyConnection() {
    try {
      await this.transporter.verify();
      return true;
    } catch (error) {
      console.error('Email service connection failed:', error);
      return false;
    }
  }
}

// 单例邮件服务
export const emailService = new EmailService({
  host: process.env.EMAIL_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.EMAIL_PORT || '587'),
  secure: process.env.EMAIL_SECURE === 'true',
  auth: {
    user: process.env.EMAIL_USER || '',
    pass: process.env.EMAIL_PASS || '',
  },
});

// 邮件发送记录接口
export interface EmailLog {
  id: string;
  to: string;
  subject: string;
  type: 'invitation' | 'welcome' | 'alert';
  status: 'pending' | 'sent' | 'failed';
  createdAt: Date;
  sentAt?: Date;
  error?: string;
}

// 邮件队列管理
export class EmailQueue {
  private queue: Array<{
    id: string;
    type: string;
    payload: any;
    attempts: number;
    maxAttempts: number;
  }> = [];

  async addToQueue(
    type: 'invitation' | 'welcome' | 'alert',
    payload: any,
    maxAttempts = 3
  ) {
    const id = `email_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    this.queue.push({
      id,
      type,
      payload,
      attempts: 0,
      maxAttempts,
    });

    // 立即尝试发送
    this.processQueue();
    
    return id;
  }

  private async processQueue() {
    while (this.queue.length > 0) {
      const job = this.queue.shift();
      if (!job) continue;

      try {
        await this.sendEmail(job.type as any, job.payload);
        console.log(`Email sent successfully: ${job.id}`);
      } catch (error) {
        job.attempts++;
        console.error(`Email failed (attempt ${job.attempts}/${job.maxAttempts}):`, error);
        
        if (job.attempts < job.maxAttempts) {
          // 重新加入队列，延迟重试
          setTimeout(() => {
            this.queue.push(job);
          }, 30000 * job.attempts); // 30秒、1分钟、1.5分钟
        }
      }
    }
  }

  private async sendEmail(type: 'invitation' | 'welcome' | 'alert', payload: any) {
    switch (type) {
      case 'invitation':
        return emailService.sendInvitationEmail(
          payload.to,
          payload.inviterName,
          payload.groupName,
          payload.invitationLink
        );
      case 'welcome':
        return emailService.sendWelcomeEmail(
          payload.to,
          payload.userName,
          payload.groupName
        );
      case 'alert':
        return emailService.sendAlertEmail(
          payload.to,
          payload.alertType,
          payload.details
        );
      default:
        throw new Error(`Unknown email type: ${type}`);
    }
  }
}

export const emailQueue = new EmailQueue();
import nodemailer from 'nodemailer';
import { logger } from './logger.js';
import { prisma } from './db.js';

export interface SendMailParams {
  to: string;
  subject: string;
  text: string;
  html: string;
  attachments?: {
    filename: string;
    path: string;
  }[];
  licenseId?: string | null;
}

export async function sendEmail(params: SendMailParams): Promise<{ success: boolean; error?: string }> {
  try {
    let config: any = {};

    // Email config only comes from global settings (lab_settings)
    // License-level email fields have been removed
    const settingsRecord = await prisma.setting.findUnique({
      where: { key: 'lab_settings' }
    });
    if (settingsRecord) {
      try {
        const globalConfig = JSON.parse(settingsRecord.value);
        config = {
          emailEnabled: globalConfig.emailEnabled,
          emailSmtpHost: globalConfig.emailSmtpHost,
          emailSmtpPort: globalConfig.emailSmtpPort,
          emailSmtpUser: globalConfig.emailSmtpUser,
          emailSmtpPass: globalConfig.emailSmtpPass,
          emailSender: globalConfig.emailSender
        };
      } catch (e) {}
    }

    const { emailEnabled, emailSmtpHost, emailSmtpPort, emailSmtpUser, emailSmtpPass, emailSender } = config;

    if (!emailEnabled) {
      logger.info('[Email Simulator] Sending email (Simulated - Email Disabled in settings):', {
        to: params.to,
        subject: params.subject,
        attachments: params.attachments?.map(a => a.filename)
      });
      return { success: true };
    }

    if (!emailSmtpHost || !emailSmtpUser || !emailSmtpPass) {
      logger.warn('[Email System] SMTP credentials missing. Running in simulated fallback mode.');
      logger.info('[Email Simulator] Email sent:', {
        to: params.to,
        subject: params.subject,
        attachments: params.attachments?.map(a => a.filename)
      });
      return { success: true };
    }

    // Configure SMTP transport
    const transporter = nodemailer.createTransport({
      host: emailSmtpHost,
      port: Number(emailSmtpPort) || 587,
      secure: Number(emailSmtpPort) === 465, // true for 465, false for other ports
      auth: {
        user: emailSmtpUser,
        pass: emailSmtpPass
      }
    });

    const mailOptions = {
      from: emailSender || emailSmtpUser,
      to: params.to,
      subject: params.subject,
      text: params.text,
      html: params.html,
      attachments: params.attachments
    };

    const info = await transporter.sendMail(mailOptions);
    logger.info(`[Email System] Email sent successfully to ${params.to}. MessageId: ${info.messageId}`);
    return { success: true };
  } catch (error: any) {
    logger.error('[Email System] Failed to send email:', error);
    return { success: false, error: error.message || 'SMTP transmission error' };
  }
}

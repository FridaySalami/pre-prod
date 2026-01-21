
import nodemailer from 'nodemailer';
import { env } from '$env/dynamic/private';

const transporter = nodemailer.createTransport({
  host: env.SMTP_HOST || 'smtp.azurecomm.net',
  port: Number(env.SMTP_PORT) || 587,
  secure: false, // true for 465, false for other ports
  auth: {
    user: env.SMTP_USER,
    pass: env.SMTP_PASS
  },
  tls: {
    ciphers: 'SSLv3'
  }
});

export async function sendEmail({ to, subject, html }: { to: string, subject: string, html: string }) {
  if (!env.SMTP_USER || env.SMTP_USER.includes('your-gmail') || env.SMTP_USER.includes('your-app-password')) {
    console.warn('Skipping email send: SMTP not configured (Check SMTP_USER in .env)');
    return { success: false, message: 'SMTP not configured' };
  }

  try {
    const info = await transporter.sendMail({
      from: env.ALERT_EMAIL_FROM || env.SMTP_USER, // Azure requires the 'MailFrom' address to be verified in Azure Portal
      to,
      subject,
      html
    });
    console.log('Message sent: %s', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error: any) {
    console.error('Error sending email:', error);
    if (error.code === 'EAUTH') {
      console.error('SMTP Authentication Failed. Please check SMTP_USER and SMTP_PASS in .env. If using Azure, ensure you have the correct "MailFrom" address configured.');
    }
  }
}

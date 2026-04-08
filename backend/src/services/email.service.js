import { Resend } from 'resend';
import env from '../config/env.js';

const resend = new Resend(env.RESEND_API_KEY);

console.log('✅ Resend email service ready');

/**
 * Send an email
 */
const sendEmail = async ({ to, subject, html, text }) => {
  try {
    const { data, error } = await resend.emails.send({
      from: `${env.SMTP_FROM_NAME} <${env.SMTP_FROM_EMAIL}>`,
      to,
      subject,
      html,
      text,
    });

    if (error) {
      console.error('❌ Email send error:', error.message);
      throw new Error(error.message);
    }

    if (env.NODE_ENV === 'development') {
      console.log('📧 Email sent:', data.id);
    }

    return data;
  } catch (err) {
    console.error('❌ Email send error:', err.message);
    throw err;
  }
};

/**
 * Send OTP verification email
 */
export const sendOTPEmail = async (email, otp, type = 'verify') => {
  const isVerify = type === 'verify';
  const subject = isVerify
    ? `Tong — Email Verification Code: ${otp}`
    : `Tong — Password Reset Code: ${otp}`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; background: #f0f2f5; padding: 20px; }
        .container { max-width: 480px; margin: 0 auto; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 12px rgba(0,0,0,0.08); }
        .header { background: linear-gradient(135deg, #6366f1, #8b5cf6); padding: 32px; text-align: center; }
        .header h1 { color: #fff; margin: 0; font-size: 24px; }
        .body { padding: 32px; text-align: center; }
        .otp-code { font-size: 36px; font-weight: 700; letter-spacing: 8px; color: #6366f1; background: #f5f3ff; padding: 16px 32px; border-radius: 8px; display: inline-block; margin: 20px 0; }
        .info { color: #64748b; font-size: 14px; margin-top: 16px; }
        .footer { text-align: center; padding: 16px; color: #94a3b8; font-size: 12px; border-top: 1px solid #f1f5f9; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🔒 tong</h1>
        </div>
        <div class="body">
          <p style="color: #334155; font-size: 16px;">
            ${isVerify ? 'Your email verification code is:' : 'Your password reset code is:'}
          </p>
          <div class="otp-code">${otp}</div>
          <p class="info">
            This code expires in <strong>${env.OTP_EXPIRES_MINUTES} minutes</strong>.<br/>
            If you didn't request this, please ignore this email.
          </p>
        </div>
        <div class="footer">
          © ${new Date().getFullYear()} tong — Messaging Platform
        </div>
      </div>
    </body>
    </html>
  `;

  const text = `Your tong ${isVerify ? 'verification' : 'password reset'} code is: ${otp}. It expires in ${env.OTP_EXPIRES_MINUTES} minutes.`;

  return sendEmail({ to: email, subject, html, text });
};

export default sendEmail;

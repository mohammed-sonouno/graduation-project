// Simple script to send a test email using the same SMTP settings as the login code flow.
// Usage (from project root):
//   node server/send-test-email.js                 # sends to SMTP_USER
//   node server/send-test-email.js someone@host   # sends to that address

import 'dotenv/config';
import nodemailer from 'nodemailer';

async function main() {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const port = Number(process.env.SMTP_PORT) || 587;
  const secure = process.env.SMTP_SECURE === 'true';

  if (!host || !user || !pass) {
    console.error('Missing SMTP config. Please set SMTP_HOST, SMTP_USER, SMTP_PASS in .env');
    process.exit(1);
  }

  const to = process.argv[2] || user; // default: same Najah email

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  });

  try {
    console.log(`Sending test email to ${to} via ${host}:${port} ...`);
    const testCode = String(Math.floor(100000 + Math.random() * 900000));
    const plainText = `Dear,

Thank you for using the An-Najah National University online services.

To complete the verification of your email address, please use the verification code below:

Verification Code: [${testCode}]

Please enter this code on the verification page to confirm your email address.
This code is valid for a limited time only.

If you did not request this verification, please ignore this email.

Best regards,

An-Najah National University

(Test email — not a real login code)`;

    const info = await transporter.sendMail({
      from: process.env.EMAIL_FROM || user,
      to,
      subject: 'Najah platform — email verification test',
      text: plainText,
      html: `<p>Dear,</p>
<p>Thank you for using the An-Najah National University online services.</p>
<p>To complete the verification of your email address, please use the verification code below:</p>
<p><strong>Verification Code: [${testCode}]</strong></p>
<p>Please enter this code on the verification page to confirm your email address.<br/>
This code is valid for a limited time only.</p>
<p>If you did not request this verification, please ignore this email.</p>
<p>Best regards,<br/>An-Najah National University</p>
<hr/>
<p style="font-size: 12px; color: #666;">(Test email — not a real login code)</p>`,
    });
    console.log('Test email sent. MessageId:', info.messageId || '(no id)');
  } catch (err) {
    console.error('Failed to send test email:', err);
    process.exit(1);
  }
}

main();


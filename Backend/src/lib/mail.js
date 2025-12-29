/**
 * Simple mail helper using nodemailer.
 *
 * In development, if SMTP settings are missing,
 * the reset link will be logged to the console instead of sending an email.
 */

import nodemailer from "nodemailer";

let transporter = null;

function createTransporter() {
  if (
    !process.env.SMTP_HOST ||
    !process.env.SMTP_PORT ||
    !process.env.SMTP_USER ||
    !process.env.SMTP_PASS
  ) {
    console.warn(
      "[MAIL] SMTP config missing; emails will not be sent, links will be logged instead."
    );
    return null;
  }

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: false, 
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

export function getTransporter() {
  if (transporter !== null) return transporter;
  transporter = createTransporter();
  return transporter;
}

/**
 * Send a password reset email, or log the URL if SMTP config is missing.
 * @param {string} to - Recipient email address.
 * @param {string} resetUrl - Full URL to the frontend reset-password page.
 */

export async function sendPasswordResetEmail(to, resetUrl) {
  const from = process.env.SMTP_FROM || "TimeCore <no-reply@timecore.local>";
  const subject = "Reset your TimeCore password";

  const text = `You requested a password reset for your TimeCore account.

If you did not request this, you can ignore this email.

To reset your password, open this link:
${resetUrl}

This link will expire in 1 hour.`;

  const html = `<p>You requested a password reset for your TimeCore account.</p>
<p>If you did not request this, you can ignore this email.</p>
<p>To reset your password, click the link below:</p>
<p><a href="${resetUrl}">${resetUrl}</a></p>
<p>This link will expire in 1 hour.</p>`;

  const tx = getTransporter();


  if (!tx) {
    console.log("[MAIL DEV] Would send password reset email to:", to);
    console.log("[MAIL DEV] Reset URL:", resetUrl);
    return;
  }
  
  await tx.sendMail({
    from,
    to,
    subject,
    text,
    html,
  });
}

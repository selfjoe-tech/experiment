import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

type NodemailerMessage = {
  from: string;
  to: string;
  subject: string;
  text: string;
  html: string;
};

type NodemailerTransport = {
  sendMail(message: NodemailerMessage): Promise<unknown>;
};

type NodemailerModule = {
  createTransport(options: {
    host: string;
    port: number;
    secure: boolean;
    auth?: { user: string; pass: string };
    connectionTimeout: number;
    greetingTimeout: number;
    socketTimeout: number;
  }): NodemailerTransport;
};

// Nodemailer is a CommonJS package. Keep its runtime import server-only.
const nodemailer = require("nodemailer") as NodemailerModule;

type AuthEmailUser = {
  email?: string;
};

type AuthEmailData = {
  token?: string;
  email_action_type?: string;
};

export type SendEmailHookPayload = {
  user?: AuthEmailUser;
  email_data?: AuthEmailData;
};

const RECOVERY_EMAIL_TEMPLATE = {
  subject: "Reset your Goon Gram password",
  heading: "Password reset code",
  explanation: "Enter this code on Goon Gram to continue resetting your password.",
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function buildRecoveryEmail(
  otp: string
): { subject: string; text: string; html: string } {
  if (!/^\d{6}$/.test(otp)) {
    throw new Error("Supabase did not provide a valid six-digit recovery code.");
  }

  const template = RECOVERY_EMAIL_TEMPLATE;
  const otpHtml = `<div style="margin:28px 0;padding:20px 16px;background:#f3f3f3;border-radius:8px;text-align:center;">
         <span style="font-size:30px;letter-spacing:8px;font-weight:700;color:#111111;">${escapeHtml(otp)}</span>
       </div>`;

  const text = `Goon Gram\n\n${template.heading}\n\n${template.explanation}\n\n${otp}\n\nThis message was sent because a password reset was requested. If you did not request it, you can ignore this email.`;

  const html = `<!doctype html>
<html lang="en">
  <body style="margin:0;padding:32px 16px;background:#f5f5f5;font-family:Arial,Helvetica,sans-serif;color:#111111;">
    <div style="max-width:560px;margin:0 auto;padding:36px 28px;background:#ffffff;border:1px solid #e8e8e8;">
      <p style="margin:0 0 28px;font-size:13px;font-weight:700;letter-spacing:2px;text-transform:uppercase;">GOON GRAM</p>
      <h1 style="margin:0 0 14px;font-size:25px;line-height:1.25;">${template.heading}</h1>
      <p style="margin:0;color:#555555;font-size:15px;line-height:1.7;">${template.explanation}</p>
      ${otpHtml}
      <p style="margin:24px 0 0;color:#777777;font-size:12px;line-height:1.6;">This message was sent because a password reset was requested. If you did not request it, you can ignore this email. Do not share your verification code with anyone.</p>
      <p style="margin:30px 0 0;color:#999999;font-size:11px;">Goon Gram · Account Security</p>
    </div>
  </body>
</html>`;

  return { subject: template.subject, text, html };
}

async function sendMessage(to: string, otp: string) {
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) {
    throw new Error("The Auth email hook provided an invalid recipient.");
  }

  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASSWORD;
  const from = process.env.SMTP_FROM;

  if (!host || !Number.isInteger(port) || port <= 0 || !from) {
    throw new Error("SMTP_HOST, SMTP_PORT and SMTP_FROM must be configured.");
  }

  if (Boolean(user) !== Boolean(pass)) {
    throw new Error("SMTP_USER and SMTP_PASSWORD must either both be set or both be empty.");
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: process.env.SMTP_SECURE === "true" || port === 465,
    ...(user && pass ? { auth: { user, pass } } : {}),
    connectionTimeout: 3_000,
    greetingTimeout: 3_000,
    socketTimeout: 4_000,
  });

  const message = buildRecoveryEmail(otp);
  await transporter.sendMail({
    from,
    to,
    ...message,
  });
}

/**
 * Verify Supabase's Standard Webhooks signature before accepting an Auth email
 * event. The dashboard secret format is v1,whsec_<base64>; pipe-separated
 * secrets are supported during key rotation.
 */
export function verifySendEmailHookSignature(
  rawBody: string,
  headers: Headers,
  configuredSecret: string
): boolean {
  const webhookId = headers.get("webhook-id");
  const webhookTimestamp = headers.get("webhook-timestamp");
  const signatureHeader = headers.get("webhook-signature");

  if (!webhookId || !webhookTimestamp || !signatureHeader) return false;

  const timestamp = Number(webhookTimestamp);
  if (!Number.isFinite(timestamp)) return false;

  // Reject replayed requests outside the Standard Webhooks five-minute window.
  if (Math.abs(Date.now() / 1000 - timestamp) > 300) return false;

  const signedContent = `${webhookId}.${webhookTimestamp}.${rawBody}`;
  const suppliedSignatures = signatureHeader.trim().split(/\s+/);
  const secrets = configuredSecret.split("|").map((value) => value.trim());

  for (const entry of secrets) {
    const prefix = "v1,whsec_";
    if (!entry.startsWith(prefix)) continue;

    const key = Buffer.from(entry.slice(prefix.length), "base64");
    if (!key.length) continue;

    const digest = createHmac("sha256", key)
      .update(signedContent, "utf8")
      .digest("base64");
    const expected = Buffer.from(`v1,${digest}`);

    for (const supplied of suppliedSignatures) {
      if (!supplied.startsWith("v1,")) continue;
      const actual = Buffer.from(supplied);

      if (
        actual.length === expected.length &&
        timingSafeEqual(actual, expected)
      ) {
        return true;
      }
    }
  }

  return false;
}

export async function sendAuthHookEmail(payload: SendEmailHookPayload) {
  const user = payload.user;
  const emailData = payload.email_data;

  if (!user || !emailData?.email_action_type) {
    throw new Error("The Auth email hook payload is incomplete.");
  }

  // The Send Email Auth Hook receives every Auth email event. Ignore all
  // non-recovery events so this custom mailer never sends signup or sign-in OTPs.
  if (emailData.email_action_type !== "recovery") {
    return;
  }

  if (!user.email) {
    throw new Error("The password recovery hook did not include an email address.");
  }

  if (!emailData.token) {
    throw new Error("Supabase did not include a password recovery code.");
  }

  await sendMessage(user.email, emailData.token);
}

// Shared ACB email layout for all lead-facing automated emails.
//
// This replicates the shell used by acb-onboarding (lib/emails.js) so every
// email a prospect or client receives looks like it came from one company:
// blue header bar with the white ACB chip, white body card, pill CTA button,
// footer with contact info and the mailing address. On top of that shell we
// add the unsubscribe line and the suppression checks the onboarding app
// doesn't have yet.

import crypto from "crypto";
import { prisma } from "@/lib/db";

// Palette lifted verbatim from acb-onboarding/lib/emails.js
const C = {
  blue: "#3D5AF1",
  bg: "#F4F5F9",
  text: "#1A1A2E",
  mid: "#4A4A68",
  light: "#8889A0",
  border: "#E2E4EC",
  panel: "#FAFBFD",
};

const HELP_PHONE = "(321) 379-6063";
const HELP_EMAIL = "nalbers@advancedcb.com";

export function escHtml(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Pill CTA button, Outlook-safe (padding on the td, bgcolor attribute). */
export function emailButton(label: string, url: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:22px 0;"><tr>
    <td bgcolor="${C.blue}" style="border-radius:50px;padding:13px 30px;">
      <a href="${escHtml(url)}" style="color:#ffffff;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:bold;text-decoration:none;display:inline-block;">${escHtml(label)}</a>
    </td></tr></table>`;
}

/** Soft rounded info panel (matches the onboarding checklist panel). */
export function emailPanel(innerHtml: string): string {
  return `<div style="background:${C.panel};border:1px solid ${C.border};border-radius:10px;padding:16px 18px;margin:16px 0;">${innerHtml}</div>`;
}

/** Muted small print inside the body card. */
export function emailFinePrint(text: string): string {
  return `<p style="margin:14px 0 0;color:${C.light};font-size:13px;">${escHtml(text)}</p>`;
}

export function renderAcbEmail(args: {
  preheader: string;
  bodyHtml: string;
  /** When set, the footer includes a working unsubscribe link for this address. */
  unsubscribeEmail?: string | null;
}): string {
  const unsub = args.unsubscribeEmail
    ? `<br/><a href="${escHtml(buildUnsubscribeUrl(args.unsubscribeEmail))}" style="color:${C.light};text-decoration:underline;">Unsubscribe from these emails</a>`
    : "";

  return `<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:${C.bg};">
<div style="display:none;max-height:0;overflow:hidden;">${escHtml(args.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.bg};padding:28px 12px;">
<tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
  <tr><td style="background:${C.blue};border-radius:14px 14px 0 0;padding:20px 30px;font-family:Arial,Helvetica,sans-serif;">
    <img src="${appBaseUrl()}/brand/acb-mark-white.png" alt="ACB" width="34" height="34" style="display:inline-block;vertical-align:middle;border:0;" />
    <span style="color:#ffffff;font-size:16px;font-weight:bold;vertical-align:middle;padding-left:10px;">Advanced Collection Bureau</span>
  </td></tr>
  <tr><td style="background:#ffffff;border:1px solid ${C.border};border-top:none;border-radius:0 0 14px 14px;padding:30px;font-family:Arial,Helvetica,sans-serif;color:${C.text};font-size:15px;line-height:1.6;">
    ${args.bodyHtml}
  </td></tr>
  <tr><td style="padding:18px 10px;text-align:center;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:${C.light};line-height:1.7;">
    Questions? Call or text ${HELP_PHONE} or email <a href="mailto:${HELP_EMAIL}" style="color:${C.blue};">${HELP_EMAIL}</a><br/>
    Advanced Collection Bureau, Inc. &middot; Advancedcb.com &middot; PO Box 560063 Rockledge, FL 32956${unsub}
  </td></tr>
</table>
</td></tr></table>
</body></html>`;
}

// ---- Unsubscribe tokens + suppression ----

function unsubSecret(): string {
  return (
    process.env.UNSUBSCRIBE_SECRET ??
    process.env.WEBHOOK_SECRET ??
    "acb-unsubscribe-fallback"
  );
}

export function unsubscribeToken(email: string): string {
  return crypto
    .createHmac("sha256", unsubSecret())
    .update(email.trim().toLowerCase())
    .digest("hex")
    .slice(0, 32);
}

export function verifyUnsubscribeToken(email: string, token: string): boolean {
  const expected = unsubscribeToken(email);
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(token));
  } catch {
    return false;
  }
}

export function appBaseUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? "https://www.advancedcb.app";
}

export function buildUnsubscribeUrl(email: string): string {
  const e = email.trim().toLowerCase();
  return `${appBaseUrl()}/api/email/unsubscribe?email=${encodeURIComponent(e)}&token=${unsubscribeToken(e)}`;
}

/** Where the public intake form lives (resume + edit links point here). */
export async function intakeFormUrl(): Promise<string> {
  const row = await prisma.systemConfig.findUnique({ where: { key: "intake_form_url" } });
  return (row?.value as string) || "https://www.advancedcb.com/";
}

// ---- Edit links for completed submissions ----
// Stateless token "e.<base64url(sessionId)>.<hmac>": the confirmation email
// can link back to a prefilled form without storing anything extra.

export function buildEditToken(sessionId: string): string {
  const mac = crypto
    .createHmac("sha256", unsubSecret())
    .update(`edit:${sessionId}`)
    .digest("base64url")
    .slice(0, 24);
  return `e.${Buffer.from(sessionId).toString("base64url")}.${mac}`;
}

export function verifyEditToken(token: string): string | null {
  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== "e") return null;
  try {
    const sessionId = Buffer.from(parts[1], "base64url").toString();
    const mac = crypto
      .createHmac("sha256", unsubSecret())
      .update(`edit:${sessionId}`)
      .digest("base64url")
      .slice(0, 24);
    return crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(parts[2])) ? sessionId : null;
  } catch {
    return null;
  }
}

export async function buildEditUrl(sessionId: string): Promise<string> {
  const base = await intakeFormUrl();
  return `${base}${base.includes("?") ? "&" : "?"}resume=${buildEditToken(sessionId)}`;
}

export async function isEmailSuppressed(email: string): Promise<boolean> {
  const row = await prisma.emailSuppression.findUnique({
    where: { email: email.trim().toLowerCase() },
  });
  return !!row;
}

export async function suppressEmail(
  email: string,
  reason: string,
  source?: string
): Promise<void> {
  const e = email.trim().toLowerCase();
  if (!e) return;
  await prisma.emailSuppression.upsert({
    where: { email: e },
    update: { reason, source },
    create: { email: e, reason, source },
  });
}

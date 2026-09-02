"use server";

// Staff invite flow: an admin sends (or resends) a set-password link, the
// invitee opens /set-password/[token], picks a password, and signs in.

import crypto from "crypto";
import { hashSync } from "bcryptjs";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { auth, assertRole } from "@/lib/auth";
import { sendEmail } from "@/lib/email";
import { renderAcbEmail, emailButton, escHtml, appBaseUrl } from "@/lib/acb-email";

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const MIN_PASSWORD_LENGTH = 10;

export async function sendInvite(
  userId: string
): Promise<{ success: boolean; error?: string; expiresAt?: string }> {
  const session = await auth();
  assertRole(session, "ADMIN");

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return { success: false, error: "User not found" };
  if (!user.active) return { success: false, error: "User is inactive" };

  const token = crypto.randomBytes(24).toString("base64url");
  const expiresAt = new Date(Date.now() + INVITE_TTL_MS);

  await prisma.user.update({
    where: { id: userId },
    data: { inviteToken: token, inviteExpiresAt: expiresAt },
  });

  const url = `${appBaseUrl()}/set-password/${token}`;
  const invitedBy = session!.user.name;

  const bodyHtml = `
    <p style="margin:0 0 14px;">Hi ${escHtml(user.name)},</p>
    <p style="margin:0 0 14px;">${escHtml(invitedBy)} has set up an account for you on the ACB Lead Operations Console. Choose a password to finish setting up your login.</p>
    ${emailButton("Set your password", url)}
    <p style="margin:0 0 14px;color:#4A4A68;font-size:13px;">This link works for 7 days. If it expires, ask an admin to resend your invite.</p>
    <p style="margin:0;color:#8889A0;font-size:12px;">If the button does not work, copy this link into your browser:<br/>${escHtml(url)}</p>`;

  const html = renderAcbEmail({
    preheader: "Set your password for the ACB Lead Operations Console.",
    bodyHtml,
  });

  const result = await sendEmail({
    to: user.email,
    subject: "Your ACB Lead Console invite",
    html,
  });

  revalidatePath("/admin/users");
  return { ...result, expiresAt: expiresAt.toISOString() };
}

export async function validateInviteToken(
  token: string
): Promise<{ valid: boolean; name?: string; email?: string; error?: string }> {
  if (!token) return { valid: false, error: "Missing invite token" };
  const user = await prisma.user.findUnique({
    where: { inviteToken: token },
    select: { name: true, email: true, active: true, inviteExpiresAt: true },
  });
  if (!user || !user.active) return { valid: false, error: "This invite link is not valid." };
  if (!user.inviteExpiresAt || user.inviteExpiresAt.getTime() < Date.now()) {
    return { valid: false, error: "This invite link has expired. Ask an admin to resend it." };
  }
  return { valid: true, name: user.name, email: user.email };
}

export async function setPasswordWithInvite(
  token: string,
  password: string,
  confirm: string
): Promise<{ success: boolean; error?: string }> {
  if (!token) return { success: false, error: "Missing invite token" };
  if (typeof password !== "string" || password.length < MIN_PASSWORD_LENGTH) {
    return { success: false, error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.` };
  }
  if (password !== confirm) return { success: false, error: "Passwords do not match." };

  const user = await prisma.user.findUnique({
    where: { inviteToken: token },
    select: { id: true, active: true, inviteExpiresAt: true },
  });
  if (!user || !user.active) return { success: false, error: "This invite link is not valid." };
  if (!user.inviteExpiresAt || user.inviteExpiresAt.getTime() < Date.now()) {
    return { success: false, error: "This invite link has expired. Ask an admin to resend it." };
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash: hashSync(password, 12),
      inviteToken: null,
      inviteExpiresAt: null,
    },
  });

  return { success: true };
}
